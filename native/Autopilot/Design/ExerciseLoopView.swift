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
            let item = AVPlayerItem(url: url)
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

    /// Precarga el siguiente ejercicio del entreno: al pasar a él, su vídeo ya tiene datos.
    func preload(_ url: URL) {
        let key = Self.key(url, hero: true)
        guard entries[key] == nil else { return }
        prepareAudio()
        entries[key] = Entry(url: url) // parado: AVFoundation va cargando el principio
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
        guard onScreen, player == nil else { return }
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
