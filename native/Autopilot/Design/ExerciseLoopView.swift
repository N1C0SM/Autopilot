import SwiftUI
import AVFoundation
import Network
#if os(iOS)
import UIKit
#else
import AppKit
#endif

/// Reglas del ejercicio en movimiento (el bucle corto de técnica de `exercise-video`, guardado en
/// `site-assets/exercise-videos/`). Los mismos valores que `src/shared/lib/exerciseLoop.ts` en la web.
///
/// Qué se ve, siempre en este orden: la foto al instante → el bucle encima cuando su primer fotograma
/// está listo (mudo, en bucle, sin controles). Sin vídeo, la foto con la huella dorada del ejercicio;
/// sin foto, la huella a su tamaño. Nunca un hueco ni una espera.
enum LoopRules {
    /// Solo archivos de vídeo directos (nuestros clips): nunca GIF, YouTube ni imágenes de terceros.
    static let extensions = ["mp4", "mov", "m4v"]
    /// Bucles vivos a la vez como mucho: una lista nunca crea docenas de reproductores (el resto, la foto).
    static let maxLive = 6
    /// Vídeos precargados en reserva (el siguiente ejercicio del entreno), además de los vivos.
    static let maxWarm = 2
    /// Lo que una miniatura espera en pantalla antes de arrancar: al hacer scroll rápido no se descarga nada.
    static let startDelayMs = 150

    /// La URL del bucle si es un clip propio reproducible en línea; `nil` si no (se queda la foto).
    static func url(_ string: String?) -> URL? {
        guard let value = string?.trimmingCharacters(in: .whitespacesAndNewlines), !value.isEmpty,
              let url = URL(string: value), let scheme = url.scheme?.lowercased(), scheme == "https" || scheme == "http",
              extensions.contains(url.pathExtension.lowercased()) else { return nil }
        return url
    }

    /// ¿Pueden moverse los ejercicios? Con «Reducir movimiento», ahorro de datos o bajo consumo, la foto fija.
    static func allowed(reduceMotion: Bool, saveData: Bool, lowPower: Bool) -> Bool {
        !reduceMotion && !saveData && !lowPower
    }

    /// El ejercicio que se precarga en el entreno: el siguiente al actual (`nil` en el último).
    static func next(after current: Int, total: Int) -> Int? {
        current >= 0 && current + 1 < total ? current + 1 : nil
    }
}

/// Vídeo y foto actuales de cada ejercicio de la biblioteca, pedidos por nombre y en tandas (las
/// miniaturas de una lista se piden juntas en una sola consulta). Como `useExerciseMetadata` en la web.
@MainActor
final class ExerciseLoops: ObservableObject {
    static let shared = ExerciseLoops()
    @Published private(set) var urls: [String: URL] = [:]
    @Published private(set) var images: [String: String] = [:]
    private var asked: Set<String> = []
    private var pending: Set<String> = []
    private var flush: Task<Void, Never>?

    /// El clip de un ejercicio: el de la biblioteca (al día) o, mientras llega, el que guarda el plan.
    func video(_ name: String, plan: String? = nil) -> URL? { urls[name] ?? LoopRules.url(plan) }

    /// Pide un nombre; los de la misma pantalla se juntan en una sola consulta.
    func want(_ name: String) {
        guard !name.isEmpty, !asked.contains(name), !pending.contains(name) else { return }
        pending.insert(name)
        guard flush == nil else { return }
        flush = Task { [weak self] in
            try? await Task.sleep(for: .milliseconds(40))
            guard let self else { return }
            let names = Array(self.pending)
            self.pending = []
            self.flush = nil
            await self.load(names)
        }
    }

    func load(_ names: [String]) async {
        let missing = Array(Set(names.filter { !$0.isEmpty }).subtracting(asked))
        guard !missing.isEmpty else { return }
        asked.formUnion(missing)
        struct R: Decodable { let name: String; let video_url: String?; let image_url: String? }
        do {
            let rows: [R] = try await Backend.client.from("exercises").select("name, video_url, image_url")
                .in("name", values: missing).execute().value
            // Un solo cambio por tanda: las miniaturas se redibujan una vez, no una por fila.
            var nextImages = images, nextUrls = urls
            for r in rows {
                if let image = r.image_url, !image.isEmpty { nextImages[r.name] = image }
                if let url = LoopRules.url(r.video_url) { nextUrls[r.name] = url }
            }
            if nextImages != images { images = nextImages }
            if nextUrls != urls { urls = nextUrls }
        } catch {
            asked.subtract(missing) // sin red: se vuelve a intentar la próxima vez
        }
    }
}

/// Copia en disco de los clips de técnica (mp4 de 4 s): un clip visto una vez no se vuelve a
/// descargar, ni al volver a la lista ni al reabrir la app. El reproductor siempre lee del disco;
/// mientras el clip baja (una sola descarga por URL, compartida) se ve la foto. Tope de
/// `capacity` en Caches con expulsión del menos usado (LRU por la fecha de último uso, que se
/// actualiza en cada lectura). Es la misma idea que la caché `autopilot-video` del service worker web.
@MainActor
final class ExerciseVideoCache {
    static let shared = ExerciseVideoCache()
    /// 300 MB: unos 150–300 clips; al pasarlo se borran los usados hace más tiempo hasta quedar al 80 %.
    nonisolated static let capacity: Int64 = 300_000_000
    private var inflight: [URL: Task<URL?, Never>] = [:]
    /// Sin URLCache: el archivo ya es la caché (no se guarda dos veces).
    private let session: URLSession = {
        let c = URLSessionConfiguration.default
        c.urlCache = nil
        c.requestCachePolicy = .reloadIgnoringLocalCacheData
        c.timeoutIntervalForRequest = 30
        return URLSession(configuration: c)
    }()

    nonisolated private static let directory: URL? = {
        guard let base = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first else { return nil }
        let dir = base.appendingPathComponent("exercise-loops-v1", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir
    }()

    /// Nombre estable por URL (FNV-1a): la URL cambia al regenerar el clip, así que nunca sale uno viejo.
    nonisolated static func file(for remote: URL) -> URL? {
        guard let directory else { return nil }
        var hash: UInt64 = 0xcbf2_9ce4_8422_2325
        for byte in remote.absoluteString.utf8 {
            hash ^= UInt64(byte)
            hash = hash &* 0x0000_0100_0000_01b3
        }
        let ext = remote.pathExtension.isEmpty ? "mp4" : remote.pathExtension.lowercased()
        return directory.appendingPathComponent("\(String(hash, radix: 16)).\(ext)")
    }

    /// El clip en disco si ya se descargó; cada lectura lo marca como recién usado (LRU).
    nonisolated static func local(_ remote: URL) -> URL? {
        guard let file = file(for: remote), FileManager.default.fileExists(atPath: file.path) else { return nil }
        try? FileManager.default.setAttributes([.modificationDate: Date()], ofItemAtPath: file.path)
        return file
    }

    /// Descargas a la vez como mucho (las miniaturas y la precarga hacen cola; el visor, no).
    private static let parallel = 3
    private var active = 0
    private var waiters: [CheckedContinuation<Void, Never>] = []

    private func acquireSlot() async {
        if active < Self.parallel { active += 1; return }
        await withCheckedContinuation { waiters.append($0) }
    }

    private func releaseSlot() {
        if waiters.isEmpty { active -= 1 } else { waiters.removeFirst().resume() }
    }

    /// El clip en disco, descargándolo una sola vez (varias vistas esperan la misma descarga).
    /// `urgent` (el visor del entreno, la ficha y el siguiente ejercicio) no hace cola; una miniatura
    /// que sale de la pantalla mientras espera turno ya no se descarga. `nil` si no hay red: el
    /// reproductor prueba entonces con la URL remota.
    func file(_ remote: URL, urgent: Bool = false) async -> URL? {
        if let hit = Self.local(remote) { return hit }
        if let running = inflight[remote] { return await running.value }
        if !urgent {
            await acquireSlot()
            if Task.isCancelled { releaseSlot(); return nil }
            if let running = inflight[remote] { releaseSlot(); return await running.value }
            if let hit = Self.local(remote) { releaseSlot(); return hit }
        }
        let session = session
        let task = Task.detached(priority: .utility) { await Self.download(remote, session: session) }
        inflight[remote] = task
        let result = await task.value
        inflight[remote] = nil
        if !urgent { releaseSlot() }
        return result
    }

    /// Baja a disco los clips que se van a ver (sesión de hoy, entreno que empieza). Nunca bloquea:
    /// la foto se ve mientras tanto. Con la foto fija (reducir movimiento, ahorro de datos o bajo
    /// consumo) no se descarga nada.
    func prefetch(_ urls: [URL]) {
        guard LoopPolicy.shared.allows(reduceMotion: A11y.reduceMotion) else { return }
        for url in urls where Self.local(url) == nil && inflight[url] == nil {
            Task(priority: .utility) { _ = await file(url) }
        }
    }

    nonisolated private static func download(_ remote: URL, session: URLSession) async -> URL? {
        guard let target = file(for: remote),
              let (temporary, response) = try? await session.download(from: remote),
              let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else { return nil }
        let manager = FileManager.default
        try? manager.removeItem(at: target)
        guard (try? manager.moveItem(at: temporary, to: target)) != nil else { return nil }
        trim()
        return target
    }

    /// LRU: si los clips pasan del tope, se borran primero los usados hace más tiempo.
    nonisolated static func trim(capacity: Int64 = capacity) {
        let keys: [URLResourceKey] = [.contentModificationDateKey, .fileSizeKey]
        guard let directory,
              let files = try? FileManager.default.contentsOfDirectory(at: directory, includingPropertiesForKeys: keys) else { return }
        var entries = files.compactMap { url -> (url: URL, used: Date, size: Int64)? in
            guard let values = try? url.resourceValues(forKeys: Set(keys)) else { return nil }
            return (url, values.contentModificationDate ?? .distantPast, Int64(values.fileSize ?? 0))
        }
        var total = entries.reduce(Int64(0)) { $0 + $1.size }
        guard total > capacity else { return }
        entries.sort { $0.used < $1.used }
        for entry in entries where total > capacity * 8 / 10 {
            try? FileManager.default.removeItem(at: entry.url)
            total -= entry.size
        }
    }
}

/// Lo que se precarga para que la primera foto y el primer clip salgan al instante, igual que
/// `mediaPrefetch.ts` en la web: al abrir Hoy, la sesión de hoy (miniaturas, la foto grande del
/// primer ejercicio y su clip); al empezar un entreno, todas sus fotos grandes y los dos primeros
/// clips; en Entrenar y Mis rutinas, las miniaturas. Siempre por detrás: nunca bloquea la pantalla.
@MainActor
enum MediaPrefetch {
    /// Clips que se bajan al abrir Hoy y al empezar un entreno.
    static let todayVideos = 1
    static let workoutVideos = 2

    /// Hoy: miniaturas de la sesión, la foto grande del primer ejercicio (`hero`, la misma URL que
    /// pinta la tarjeta de la sesión; si no se pasa, la primera foto) y el primer clip.
    static func today(photos: [URL], hero: URL? = nil, videos: [URL]) {
        ImageCache.shared.prefetch(photos, maxSide: MediaSizing.thumb)
        ImageCache.shared.prefetch([hero ?? photos.first].compactMap { $0 }, maxSide: MediaSizing.hero)
        ExerciseVideoCache.shared.prefetch(Array(videos.prefix(todayVideos)))
    }

    /// Entreno que empieza: todas sus fotos (miniatura y grande) y los dos primeros clips.
    static func workout(photos: [URL], videos: [URL]) {
        ImageCache.shared.prefetch(photos, maxSide: MediaSizing.thumb)
        ImageCache.shared.prefetch(photos, maxSide: MediaSizing.hero)
        ExerciseVideoCache.shared.prefetch(Array(videos.prefix(workoutVideos)))
    }

    /// Entrenar y Mis rutinas: las miniaturas de todas las sesiones, para que al abrir una ya estén.
    static func thumbnails(_ photos: [URL]) {
        ImageCache.shared.prefetch(photos, maxSide: MediaSizing.thumb)
    }
}

/// Lo que decide el sistema: bajo consumo y «Modo de datos reducidos» (red limitada). «Reducir
/// movimiento» llega por el entorno de SwiftUI en cada vista.
@MainActor
final class LoopPolicy: ObservableObject {
    static let shared = LoopPolicy()
    @Published private(set) var lowPower = ProcessInfo.processInfo.isLowPowerModeEnabled
    @Published private(set) var dataSaver = false
    private let monitor = NWPathMonitor()
    private var power: NSObjectProtocol?

    private init() {
        power = NotificationCenter.default.addObserver(forName: .NSProcessInfoPowerStateDidChange, object: nil, queue: .main) { [weak self] _ in
            let on = ProcessInfo.processInfo.isLowPowerModeEnabled
            Task { @MainActor in if self?.lowPower != on { self?.lowPower = on } }
        }
        monitor.pathUpdateHandler = { [weak self] path in
            let constrained = path.isConstrained
            Task { @MainActor in if self?.dataSaver != constrained { self?.dataSaver = constrained } }
        }
        monitor.start(queue: DispatchQueue(label: "autopilot.loop-policy", qos: .utility))
    }

    func allows(reduceMotion: Bool) -> Bool {
        LoopRules.allowed(reduceMotion: reduceMotion, saveData: dataSaver, lowPower: lowPower)
    }
}

/// Reproductores compartidos: como mucho `LoopRules.maxLive` vivos y `maxWarm` en reserva, así una
/// lista nunca crea docenas. Cada uno es un `AVQueuePlayer` + `AVPlayerLooper`, mudo y sin bloquear
/// la pantalla, que mezcla con la música del usuario (sesión `.ambient`).
@MainActor
final class ExerciseLoopPool {
    static let shared = ExerciseLoopPool()
    /// Se avisa al liberar un reproductor: las miniaturas que esperaban hueco lo vuelven a pedir.
    static let freed = Notification.Name("ExerciseLoopPool.freed")

    private final class Entry {
        let player = AVQueuePlayer()
        private var looper: AVPlayerLooper?
        var users = 0
        var lastUse = Date()

        init(url: URL) {
            // Del disco si ya se descargó (`ExerciseVideoCache`): sin red y sin esperar.
            let item = AVPlayerItem(url: ExerciseVideoCache.local(url) ?? url)
            item.preferredForwardBufferDuration = 4
            player.isMuted = true
            player.preventsDisplaySleepDuringVideoPlayback = false
            #if os(iOS)
            player.allowsExternalPlayback = false
            #endif
            looper = AVPlayerLooper(player: player, templateItem: item)
        }

        func tearDown() {
            player.pause()
            looper?.disableLooping()
            looper = nil
            player.removeAllItems()
        }
    }

    private var entries: [String: Entry] = [:]
    private var audioReady = false

    /// El visor y la ficha tienen su propio reproductor (una capa por reproductor siempre pinta).
    private static func key(_ url: URL, hero: Bool) -> String { (hero ? "hero|" : "thumb|") + url.absoluteString }

    /// Un reproductor en marcha para esta URL, o `nil` si ya hay seis vivos (el visor siempre tiene hueco).
    func acquire(_ url: URL, hero: Bool) -> AVQueuePlayer? {
        let key = Self.key(url, hero: hero)
        if let entry = entries[key] {
            entry.users += 1
            entry.lastUse = Date()
            entry.player.play()
            return entry.player
        }
        let live = entries.values.filter { $0.users > 0 }.count
        if !hero && live >= LoopRules.maxLive { return nil }
        prepareAudio()
        let entry = Entry(url: url)
        entry.users = 1
        entries[key] = entry
        trim()
        entry.player.play()
        return entry.player
    }

    func release(_ url: URL, hero: Bool) {
        guard let entry = entries[Self.key(url, hero: hero)] else { return }
        entry.users = max(0, entry.users - 1)
        entry.lastUse = Date()
        guard entry.users == 0 else { return }
        entry.player.pause()
        trim()
        // Fuera del ciclo de la vista que se va: las que esperaban piden en el siguiente turno.
        DispatchQueue.main.async { NotificationCenter.default.post(name: Self.freed, object: nil) }
    }

    /// Precarga el siguiente ejercicio del entreno: al pasar a él, su vídeo ya está en disco y con
    /// el reproductor listo. Si aún no está en disco, primero se descarga (una sola vez).
    func preload(_ url: URL) {
        let key = Self.key(url, hero: true)
        guard entries[key] == nil else { return }
        guard ExerciseVideoCache.local(url) != nil else {
            Task { [weak self] in
                guard await ExerciseVideoCache.shared.file(url, urgent: true) != nil, ExerciseVideoCache.local(url) != nil else { return }
                self?.preload(url)
            }
            return
        }
        prepareAudio()
        entries[key] = Entry(url: url) // parado: lee el principio del archivo local
        trim()
    }

    /// Solo quedan los vivos y `maxWarm` parados; sale primero el que lleva más tiempo sin usarse.
    private func trim() {
        let idle = entries.filter { $0.value.users == 0 }.sorted { $0.value.lastUse < $1.value.lastUse }
        var excess = idle.count - LoopRules.maxWarm
        for (key, entry) in idle where excess > 0 {
            entry.tearDown()
            entries[key] = nil
            excess -= 1
        }
    }

    private func prepareAudio() {
        guard !audioReady else { return }
        audioReady = true
        #if os(iOS)
        try? AVAudioSession.sharedInstance().setCategory(.ambient, options: [.mixWithOthers])
        #endif
    }
}

/// El ejercicio en movimiento sobre su foto (o su huella): única pieza para miniaturas, el visor del
/// entreno y la ficha, como `ExerciseLoop` en la web. La foto (`still`) se pinta siempre debajo y el
/// vídeo aparece con un fundido cuando su primer fotograma está listo, así nunca hay un negro. Solo se
/// mueven los que están en pantalla (onAppear/onDisappear) y con «Reducir movimiento», bajo consumo o
/// datos reducidos se queda la foto fija.
struct ExerciseLoopView<Still: View>: View {
    let url: URL?
    var hero: Bool
    var paused: Bool
    /// «Ver vídeo» pulsado con «Reducir movimiento»: se mueve porque se ha pedido.
    var force: Bool
    let still: Still
    @ObservedObject private var policy = LoopPolicy.shared
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    init(url: URL?, hero: Bool = false, paused: Bool = false, force: Bool = false, @ViewBuilder still: () -> Still) {
        self.url = url
        self.hero = hero
        self.paused = paused
        self.force = force
        self.still = still()
    }

    var body: some View {
        ZStack {
            still
            if let url, !paused, force || policy.allows(reduceMotion: reduceMotion) {
                LoopLayer(url: url, hero: hero).id(url)
            }
        }
    }
}

/// El clip de un ejercicio buscado por su nombre (la biblioteca al día y, mientras llega, el del plan)
/// sobre lo que se le pase: para portadas que usan la foto del primer ejercicio.
struct NamedExerciseLoop<Still: View>: View {
    let name: String
    var plan: String?
    let still: Still
    @ObservedObject private var loops = ExerciseLoops.shared

    init(name: String, plan: String? = nil, @ViewBuilder still: () -> Still) {
        self.name = name
        self.plan = plan
        self.still = still()
    }

    var body: some View {
        ExerciseLoopView(url: loops.video(name, plan: plan)) { still }
            .task(id: name) { loops.want(name) }
    }
}

/// La capa de vídeo: pide reproductor al aparecer (tras un instante si es una miniatura), lo devuelve al
/// desaparecer y se ve solo cuando hay imagen que pintar.
private struct LoopLayer: View {
    let url: URL
    let hero: Bool
    @State private var player: AVQueuePlayer?
    @State private var ready = false
    @State private var onScreen = false
    /// El clip ya está en disco (o se intentó bajar): antes de eso no se pide reproductor.
    @State private var fetched = false
    @Environment(\.scenePhase) private var scenePhase

    var body: some View {
        ZStack {
            if let player {
                PlayerLayerView(player: player) { ready = $0 }
                    .opacity(ready ? 1 : 0)
                    .animation(.easeOut(duration: 0.25), value: ready)
            }
        }
        .allowsHitTesting(false)
        .accessibilityHidden(true)
        .onAppear { onScreen = true }
        .task(id: url) {
            onScreen = true
            if !hero { try? await Task.sleep(for: .milliseconds(LoopRules.startDelayMs)) }
            guard !Task.isCancelled else { return }
            // El clip se lee del disco: la primera vez se descarga entero (la foto se ve mientras) y
            // ya no vuelve a bajar. Sin red, el reproductor prueba con la URL remota.
            _ = await ExerciseVideoCache.shared.file(url, urgent: hero)
            guard !Task.isCancelled else { return }
            fetched = true
            take()
        }
        .onReceive(NotificationCenter.default.publisher(for: ExerciseLoopPool.freed)) { _ in take() }
        .onChange(of: scenePhase) { _, phase in if phase == .active { player?.play() } }
        .onDisappear {
            onScreen = false
            give()
        }
    }

    private func take() {
        guard onScreen, fetched, player == nil else { return }
        player = ExerciseLoopPool.shared.acquire(url, hero: hero)
    }

    private func give() {
        guard player != nil else { return }
        player = nil
        ready = false
        ExerciseLoopPool.shared.release(url, hero: hero)
    }
}

#if os(iOS)
private struct PlayerLayerView: UIViewRepresentable {
    let player: AVPlayer
    let onReady: (Bool) -> Void

    final class Host: UIView {
        override class var layerClass: AnyClass { AVPlayerLayer.self }
        var playerLayer: AVPlayerLayer { layer as! AVPlayerLayer }
        var watch: NSKeyValueObservation?
    }

    func makeUIView(context: Context) -> Host {
        let view = Host()
        view.isUserInteractionEnabled = false
        view.backgroundColor = .clear
        // Mismo encuadre que la foto (`scaledToFill`): al aparecer el vídeo nada salta.
        view.playerLayer.videoGravity = .resizeAspectFill
        attach(view)
        return view
    }

    func updateUIView(_ view: Host, context: Context) {
        if view.playerLayer.player !== player { attach(view) }
    }

    static func dismantleUIView(_ view: Host, coordinator: ()) {
        view.watch = nil
        view.playerLayer.player = nil
    }

    private func attach(_ view: Host) {
        view.playerLayer.player = player
        let onReady = onReady
        view.watch = view.playerLayer.observe(\.isReadyForDisplay, options: [.initial, .new]) { layer, _ in
            let ready = layer.isReadyForDisplay
            DispatchQueue.main.async { onReady(ready) }
        }
    }
}
#else
private struct PlayerLayerView: NSViewRepresentable {
    let player: AVPlayer
    let onReady: (Bool) -> Void

    final class Host: NSView {
        let playerLayer = AVPlayerLayer()
        var watch: NSKeyValueObservation?

        override init(frame: NSRect) {
            super.init(frame: frame)
            playerLayer.videoGravity = .resizeAspectFill
            layer = playerLayer
            wantsLayer = true
        }

        required init?(coder: NSCoder) { nil }

        override func hitTest(_ point: NSPoint) -> NSView? { nil }
    }

    func makeNSView(context: Context) -> Host {
        let view = Host()
        attach(view)
        return view
    }

    func updateNSView(_ view: Host, context: Context) {
        if view.playerLayer.player !== player { attach(view) }
    }

    static func dismantleNSView(_ view: Host, coordinator: ()) {
        view.watch = nil
        view.playerLayer.player = nil
    }

    private func attach(_ view: Host) {
        view.playerLayer.player = player
        let onReady = onReady
        view.watch = view.playerLayer.observe(\.isReadyForDisplay, options: [.initial, .new]) { layer, _ in
            let ready = layer.isReadyForDisplay
            DispatchQueue.main.async { onReady(ready) }
        }
    }
}
#endif
