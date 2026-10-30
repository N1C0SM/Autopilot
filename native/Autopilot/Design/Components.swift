import SwiftUI
import ImageIO

/// Tarjeta de descanso de la web (`EmptyState rest`): luna dorada con halo, estrellas, título y acción.
struct RestCard<Action: View>: View {
    let title: String
    let message: String
    @ViewBuilder var action: Action

    /// EmptyState `rest` de la web: halo, luna creciente de 96 pt con resplandor y cinco estrellas.
    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Spacer(minLength: 144)
            Text(title).font(.apTitle1).tracking(-0.7).padding(.top, 8).accessibilityAddTraits(.isHeader)
            Text(message).font(.apSubhead).foregroundStyle(Palette.muted).padding(.top, 4).fixedSize(horizontal: false, vertical: true)
            action.padding(.top, 20)
        }
        .padding(20)
        .frame(maxWidth: .infinity, minHeight: 288, alignment: .bottomLeading)
        .background {
            GeometryReader { geo in
                ZStack(alignment: .topLeading) {
                    Circle().fill(RadialGradient(colors: [Palette.gold.opacity(0.22), .clear], center: .center, startRadius: 0, endRadius: 144))
                        .frame(width: 288, height: 288).offset(x: geo.size.width - 288 + 64, y: -80)
                    Circle().fill(Palette.gold.opacity(0.9))
                        .frame(width: 96, height: 96)
                        .mask {
                            Rectangle().overlay {
                                Circle().frame(width: 77, height: 77).position(x: 28.8, y: 33.6).blendMode(.destinationOut)
                            }
                            .compositingGroup()
                        }
                        .shadow(color: Palette.gold.opacity(0.45), radius: 30)
                        .offset(x: geo.size.width - 96 - 32, y: 32)
                    ForEach([(0.18, 0.22), (0.34, 0.58), (0.12, 0.72), (0.46, 0.30), (0.26, 0.44)], id: \.0) { t, l in
                        Circle().fill(Color.white.opacity(0.5)).frame(width: 4, height: 4)
                            .offset(x: l * geo.size.width, y: t * geo.size.height)
                    }
                }
            }
            .accessibilityHidden(true)
        }
        .background(Palette.card)
        .clipShape(RoundedRectangle(cornerRadius: Radius.hero, style: .continuous))
    }
}

/// Sin rutina todavía (web `Dashboard.tsx`, `!hasPlan`): la misma invitación y el mismo botón,
/// que la prepara con generate-plan. Nunca una pantalla vacía sin salida.
struct StarterRoutineCard: View {
    @EnvironmentObject private var session: SessionModel
    var onReady: () async -> Void
    @State private var preparing = false
    @State private var failed = false

    var body: some View {
        VStack(spacing: 16) {
            EmptyStateView(symbol: "dumbbell", title: "Prepara tu rutina inicial gratis",
                           message: "Te la preparamos en unos segundos.")
            Button { Task { await prepare() } } label: {
                if preparing { BrandLoader().tint(.black).accessibilityHidden(true) } else { Text("Preparar mi rutina gratis") }
            }
            .buttonStyle(.pill)
            .disabled(preparing)
            .accessibilityLabel(preparing ? "Preparando…" : "Preparar mi rutina gratis")
            if failed {
                Text("No se ha podido preparar la rutina. Vuelve a intentarlo.")
                    .font(.apFootnote).foregroundStyle(Palette.destructive).multilineTextAlignment(.center)
            }
        }
    }

    private func prepare() async {
        guard !preparing, let userId = session.userId else { return }
        Haptics.tap()
        preparing = true
        failed = false
        defer { preparing = false }
        if await TrainingRepo.generateStarterPlan(userId: userId) {
            Haptics.success()
            await onReady()
        } else {
            failed = true
            Haptics.error()
            A11y.announce("No se ha podido preparar la rutina. Vuelve a intentarlo.")
        }
    }
}

/// Cabecera de la web (MobileHeader): campana y avatar en círculos de 30 pt dentro de 44 pt.
struct HeaderButtons: View {
    let initial: String
    var avatar: String? = nil
    var onProfile: () -> Void

    var body: some View {
        HStack(spacing: 0) {
            // La campana era un botón sin acción (no hay notificaciones todavía): fuera hasta 1.1.
            Button(action: onProfile) {
                ZStack {
                    Circle().fill(Palette.secondary)
                    Text(initial).font(.apFootnote.weight(.semibold))
                    if let a = avatar, let u = URL(string: a) {
                        CachedAsyncImage(url: u) { $0.resizable().scaledToFill() } placeholder: { Color.clear }
                    }
                }
                .frame(width: 30, height: 30).clipShape(Circle())
                    .frame(width: 44, height: 44)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Perfil y ajustes")
        }
        .foregroundStyle(Palette.foreground)
    }
}

/// Barra flotante de la web (FloatingMobileNav + MobileTabBar): iconos Phosphor (normal / relleno),
/// 68 pt de alto, píldora activa dorada al 90 % y texto negro, inactivas en gris.
struct FloatingTabBar: View {
    let tabs: [AppSection]
    @Binding var selection: AppSection
    @Namespace private var pill
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        HStack(spacing: 2) {
            ForEach(tabs) { tab in
                let active = tab == selection
                Button {
                    if active { Haptics.tap() } else { Haptics.selection() }
                    // Con «Reducir movimiento» la píldora cambia de sitio al instante (sin spring).
                    withAnimation(reduceMotion ? nil : .spring(response: 0.3, dampingFraction: 0.85)) { selection = tab }
                } label: {
                    VStack(spacing: 2) {
                        Image(tab.phosphor + (active ? "-fill" : "")).renderingMode(.template).resizable().frame(width: 24, height: 24)
                            .frame(height: 28)
                        Text(tab.tabTitle).font(.inter(size: 11, weight: .medium)).lineLimit(1)
                    }
                    .foregroundStyle(active ? Color.black : Palette.muted)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background {
                        if active {
                            Capsule().fill(Palette.gold.opacity(0.9))
                                .shadow(color: Palette.gold.opacity(0.35), radius: 6, y: 6)
                                .matchedGeometryEffect(id: "pill", in: pill)
                        }
                    }
                    .contentShape(Capsule())
                }
                .buttonStyle(.plain)
                .accessibilityLabel(tab.tabTitle)
                .accessibilityAddTraits(active ? .isSelected : [])
            }
        }
        .padding(4)
        .frame(height: 68)
        .frame(maxWidth: 480)
        .background(Palette.card, in: Capsule())
        .shadow(color: .black.opacity(0.5), radius: 12, y: 8)
        .padding(.horizontal, 12)
        // La barra se lee como un grupo de pestañas (VoiceOver anuncia «pestaña, seleccionada»).
        .accessibilityElement(children: .contain)
        .dynamicTypeSize(...DynamicTypeSize.accessibility2)
    }
}

/// Control segmentado de la web (`TabsList`): fondo oscuro y la opción activa en gris claro.
/// La píldora visible mide 32 pt, pero cada opción tiene 44 pt de área táctil (mínimo de Apple).
struct SegmentedPill: View {
    let options: [String]
    @Binding var selection: Int
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        HStack(spacing: 0) {
            ForEach(options.indices, id: \.self) { i in
                Button {
                    Haptics.selection()
                    withAnimation(reduceMotion ? nil : .snappy(duration: 0.2)) { selection = i }
                } label: {
                    Text(options[i]).font(.inter(size: 13, weight: i == selection ? .semibold : .medium))
                        .lineLimit(1).minimumScaleFactor(0.7)
                        .foregroundStyle(i == selection ? Palette.foreground : Palette.muted)
                        .frame(maxWidth: .infinity)
                        .frame(minHeight: 44)
                        .background {
                            // La píldora activa conserva sus 32 pt visuales dentro del área de 44.
                            if i == selection {
                                RoundedRectangle(cornerRadius: 9, style: .continuous).fill(Palette.accent)
                                    .frame(height: 32)
                                    .shadow(color: .black.opacity(0.25), radius: 2, y: 1)
                            }
                        }
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel(options[i])
                .accessibilityAddTraits(i == selection ? .isSelected : [])
            }
        }
        .padding(4)
        .background(Palette.card, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
        .frame(maxWidth: 448)
        .frame(maxWidth: .infinity)
        // Control de geometría fija: se limita el crecimiento del texto para que no se trunque.
        .dynamicTypeSize(...DynamicTypeSize.accessibility1)
        .accessibilityElement(children: .contain)
    }
}

/// Anillo de progreso con icono dentro (ProgressRing).
struct ProgressRing: View {
    let value: Double
    let symbol: String
    var muted = false

    var body: some View {
        ZStack {
            Circle().stroke(Palette.secondary, lineWidth: 3.5)
            Circle().trim(from: 0, to: max(0, min(1, value / 100)))
                .stroke(muted ? Palette.muted : Palette.gold, style: StrokeStyle(lineWidth: 3.5, lineCap: .round))
                .rotationEffect(.degrees(-90))
            Group {
                if symbol.hasPrefix("lu-") || symbol.hasPrefix("ph-") { Image(symbol).renderingMode(.template).resizable().frame(width: 14, height: 14) }
                else { Image(systemName: symbol).font(.inter(size: 13, weight: .semibold)) }
            }
            .foregroundStyle(muted ? Palette.muted : Palette.gold)
        }
        .frame(width: 32, height: 32)
        .accessibilityHidden(true)
    }
}

extension AppSection {
    /// Icono Phosphor de la pestaña (los mismos de MobileTabBar).
    var phosphor: String {
        switch self {
        case .home: "ph-house"
        case .train: "ph-barbell"
        case .nutrition: "ph-fork-knife"
        case .progress: "ph-chart-line-up"
        default: "ph-house"
        }
    }
    func tabSymbol(active: Bool) -> String {
        switch self {
        case .home: active ? "house.fill" : "house"
        case .train: "dumbbell.fill"
        case .nutrition: "fork.knife"
        case .progress: "chart.line.uptrend.xyaxis"
        default: symbol
        }
    }
}

/// Imagen remota con caché en memoria y disco: no se vuelve a descargar ni decodificar en cada
/// redibujado (AsyncImage lo hace y frena los toques en listas con fotos).
@MainActor
final class ImageCache {
    static let shared = ImageCache()
    private let memory = NSCache<NSString, PlatformImage>()
    /// Una sola descarga en vuelo por URL: varias vistas con la misma foto comparten la petición.
    private var inflight: [URL: Task<PlatformImage?, Never>] = [:]
    private let session: URLSession = {
        let c = URLSessionConfiguration.default
        c.urlCache = URLCache(memoryCapacity: 60_000_000, diskCapacity: 500_000_000)
        c.requestCachePolicy = .returnCacheDataElseLoad
        return URLSession(configuration: c)
    }()

    /// La clave incluye el tamaño: una miniatura de 200 px no compite con la foto grande.
    private func key(_ url: URL, _ maxSide: CGFloat) -> NSString {
        "\(url.absoluteString)|#\(Int(maxSide))" as NSString
    }

    func cached(_ url: URL, maxSide: CGFloat = 900) -> PlatformImage? {
        memory.object(forKey: key(url, maxSide))
    }

    func load(_ url: URL, maxSide: CGFloat = 900) async -> PlatformImage? {
        let k = key(url, maxSide)
        if let hit = memory.object(forKey: k) { return hit }
        if let running = inflight[url] { return await running.value }
        let task = Task { [weak self] () -> PlatformImage? in
            guard let self else { return nil }
            return await self.download(url, maxSide: maxSide)
        }
        inflight[url] = task
        let image = await task.value
        inflight[url] = nil
        if let image { memory.setObject(image, forKey: k) }
        return image
    }

    /// Calienta la caché con las fotos que se van a ver (rutina, sesión, próximas comidas).
    func prefetch(_ urls: [URL], maxSide: CGFloat = 900) {
        guard !urls.isEmpty else { return }
        Task { [weak self] in
            for url in urls.prefix(24) {
                guard let self else { return }
                _ = await self.load(url, maxSide: maxSide)
            }
        }
    }

    private func download(_ url: URL, maxSide: CGFloat) async -> PlatformImage? {
        // Ya descargada en otra sesión: no se vuelve a pedir a la red.
        if let disk = await Self.fromDisk(url, maxSide: maxSide) { return disk }
        // 3 intentos con espera corta: una red mala no debe dejar el hueco para siempre.
        for attempt in 0..<3 {
            if let (data, response) = try? await session.data(from: url),
               (response as? HTTPURLResponse)?.statusCode ?? 200 < 400,
               let image = await Self.decode(data, maxSide: maxSide) {
                Self.toDisk(image, url, maxSide: maxSide)
                return image
            }
            if attempt < 2 { try? await Task.sleep(nanoseconds: 250_000_000) }
        }
        return nil
    }

    /// Copia en disco de la miniatura ya reducida: al reabrir la app las fotos salen de aquí,
    /// no de la red (y ocupa poco: se guarda en JPEG, no el original).
    private static func diskURL(_ url: URL, maxSide: CGFloat) -> URL? {
        guard let base = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first else { return nil }
        let dir = base.appendingPathComponent("images", isDirectory: true)
        if !FileManager.default.fileExists(atPath: dir.path) {
            try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        }
        var hash: UInt64 = 0xcbf2_9ce4_8422_2325
        for byte in "\(url.absoluteString)|#\(Int(maxSide))".utf8 {
            hash ^= UInt64(byte)
            hash = hash &* 0x0000_0100_0000_01b3
        }
        return dir.appendingPathComponent("\(String(hash, radix: 16)).jpg")
    }

    private static func fromDisk(_ url: URL, maxSide: CGFloat) async -> PlatformImage? {
        guard let file = diskURL(url, maxSide: maxSide) else { return nil }
        return await Task.detached(priority: .userInitiated) { () -> PlatformImage? in
            guard let data = try? Data(contentsOf: file) else { return nil }
            guard let source = CGImageSourceCreateWithData(data as CFData, nil),
                  let cg = CGImageSourceCreateImageAtIndex(source, 0, nil) else { return nil }
            #if os(iOS)
            return UIImage(cgImage: cg)
            #else
            return NSImage(cgImage: cg, size: .zero)
            #endif
        }.value
    }

    private static func toDisk(_ image: PlatformImage, _ url: URL, maxSide: CGFloat) {
        guard let file = diskURL(url, maxSide: maxSide) else { return }
        Task.detached(priority: .utility) {
            #if os(iOS)
            guard let data = image.jpegData(compressionQuality: 0.82) else { return }
            #else
            var rect = CGRect(origin: .zero, size: image.size)
            guard let cg = image.cgImage(forProposedRect: &rect, context: nil, hints: nil) else { return }
            let rep = NSBitmapImageRep(cgImage: cg)
            guard let data = rep.representation(using: .jpeg, properties: [.compressionFactor: 0.82]) else { return }
            #endif
            try? data.write(to: file, options: .atomic)
        }
    }

    /// Reduce fuera del hilo principal: las fotos originales son muy grandes.
    private static func decode(_ data: Data, maxSide: CGFloat) async -> PlatformImage? {
        await Task.detached(priority: .userInitiated) { () -> PlatformImage? in
            guard let source = CGImageSourceCreateWithData(data as CFData, nil) else { return nil }
            let opts: [CFString: Any] = [kCGImageSourceCreateThumbnailFromImageAlways: true, kCGImageSourceThumbnailMaxPixelSize: maxSide * 3, kCGImageSourceCreateThumbnailWithTransform: true]
            guard let cg = CGImageSourceCreateThumbnailAtIndex(source, 0, opts as CFDictionary) else { return nil }
            #if os(iOS)
            return UIImage(cgImage: cg)
            #else
            return NSImage(cgImage: cg, size: .zero)
            #endif
        }.value
    }
}

struct CachedAsyncImage<Content: View, Placeholder: View>: View {
    let url: URL?
    /// Tamaño máximo de decodificación (px en pantalla × 3). Las miniaturas usan menos.
    let maxSide: CGFloat
    @ViewBuilder var content: (Image) -> Content
    @ViewBuilder var placeholder: () -> Placeholder
    @State private var image: PlatformImage?
    /// URL de la imagen que hay ahora mismo en `image`: al cambiar de URL no se queda la anterior.
    @State private var imageURL: URL?

    init(url: URL?, maxSide: CGFloat = 900,
         @ViewBuilder content: @escaping (Image) -> Content,
         @ViewBuilder placeholder: @escaping () -> Placeholder) {
        self.url = url; self.maxSide = maxSide
        self.content = content; self.placeholder = placeholder
        let cached = url.flatMap { u in MainActor.assumeIsolated { ImageCache.shared.cached(u, maxSide: maxSide) } }
        _image = State(initialValue: cached)
        _imageURL = State(initialValue: cached != nil ? url : nil)
    }

    var body: some View {
        Group {
            if let image { content(Image(platformImage: image)) } else { placeholder() }
        }
        .task(id: "\(url?.absoluteString ?? "")|\(Int(maxSide))") {
            guard let url else { image = nil; imageURL = nil; return }
            // Misma URL ya resuelta (normalmente leída de caché): no hay nada que hacer.
            guard imageURL != url else { return }
            // La URL cambió (p. ej. del respaldo a la portada de la IA): se descarta la imagen vieja.
            if let hit = ImageCache.shared.cached(url, maxSide: maxSide) {
                image = hit; imageURL = url
                return
            }
            image = nil; imageURL = nil
            guard let loaded = await ImageCache.shared.load(url, maxSide: maxSide), !Task.isCancelled else { return }
            image = loaded; imageURL = url
        }
    }
}

/// Icono sobre cuadrado redondeado tintado (`IconTile` de la web): sm 32 pt, md 40, lg 64.
struct IconTile: View {
    let symbol: String
    var size: CGFloat = 32
    var tint: Color = Palette.gold
    var body: some View {
        Group {
            if symbol.hasPrefix("lu-") || symbol.hasPrefix("ph-") {
                Image(symbol).renderingMode(.template).resizable().frame(width: size * 0.5, height: size * 0.5)
            } else {
                Image(systemName: symbol).font(.inter(size: size * 0.5625, weight: .semibold))
            }
        }
            .foregroundStyle(tint)
            .frame(width: size, height: size)
            .background(tint.opacity(0.15), in: RoundedRectangle(cornerRadius: size * 0.28, style: .continuous))
            .accessibilityHidden(true)
    }
}

extension View {
    /// Pantalla completa en iPhone; hoja en Mac.
    @ViewBuilder func fullScreenCoverCompat<Item: Identifiable, C: View>(item: Binding<Item?>, @ViewBuilder content: @escaping (Item) -> C) -> some View {
        #if os(iOS)
        fullScreenCover(item: item, content: content)
        #else
        sheet(item: item) { content($0).frame(minWidth: 600, minHeight: 700) }
        #endif
    }
}

/// Firma de Autopilot: la «A» con rayo (misma geometría que `BRAND_A`/`BRAND_BOLT` en la web).
/// Logo, marca de agua y loader. Con `beat` el rayo late, salvo con «Reducir movimiento».
struct BrandMark: View {
    var size: CGFloat = 24
    var beat = false
    var color: Color = Palette.gold
    @State private var low = false

    var body: some View {
        ZStack {
            BrandShape(points: [(50, 10), (88, 86), (70, 86), (50, 44), (30, 86), (12, 86)]).fill(color)
            BrandShape(points: [(52, 55), (44, 70), (49.5, 70), (47, 81), (56, 65), (50.5, 65)]).fill(color)
                .opacity(low ? 0.35 : 1)
                .animation(beat ? .spring(response: 0.6, dampingFraction: 0.55).repeatForever() : nil, value: low)
        }
        .frame(width: size, height: size)
        .accessibilityHidden(true)
        .onAppear { if beat && !A11y.reduceMotion { low = true } }
    }
}

/// Polígono en coordenadas 0–100 recortado al cuadro 10…90 × 8…88 (igual que el viewBox web).
private struct BrandShape: Shape {
    let points: [(CGFloat, CGFloat)]
    func path(in rect: CGRect) -> Path {
        var p = Path()
        let map = { (pt: (CGFloat, CGFloat)) in CGPoint(x: rect.minX + (pt.0 - 10) / 80 * rect.width, y: rect.minY + (pt.1 - 8) / 80 * rect.height) }
        p.move(to: map(points[0]))
        points.dropFirst().forEach { p.addLine(to: map($0)) }
        p.closeSubpath()
        return p
    }
}

/// Carga con la firma de marca en lugar del `ProgressView` genérico.
struct BrandLoader: View {
    var size: CGFloat = 20
    var body: some View {
        BrandMark(size: size, beat: true, color: Palette.muted)
            .accessibilityElement()
            .accessibilityLabel("Cargando")
    }
}


/// Anillo pequeño con el reparto de macros (proteína, carbos, grasas) en tres tonos de dorado.
struct MacroRingSmall: View {
    let p: Double, c: Double, f: Double
    var size: CGFloat = 32
    var body: some View {
        let parts = [p * 4, c * 4, f * 9]
        let total = max(1, parts.reduce(0, +))
        let shades = [Palette.gold, Palette.gold.opacity(0.6), Palette.gold.opacity(0.32)]
        ZStack {
            Circle().stroke(Palette.secondary, lineWidth: 3.5)
            ForEach(0..<3, id: \.self) { i in
                let start = parts[..<i].reduce(0, +) / total
                Circle().trim(from: start + 0.02, to: max(start + 0.02, start + parts[i] / total - 0.02))
                    .stroke(shades[i], style: StrokeStyle(lineWidth: 3.5, lineCap: .round)).rotationEffect(.degrees(-90))
            }
            Image("lu-apple").renderingMode(.template).resizable().frame(width: 14, height: 14).foregroundStyle(Palette.gold)
        }
        .frame(width: size, height: size)
        .accessibilityHidden(true)
    }
}

/// Macros estimados con el onboarding cuando no se puede leer el plan (sin Plus): misma fórmula
/// que `resolveNutritionPreview` de la web; grasas al 25 % de las kcal y el resto en carbohidratos.
enum MacroEstimate {
    static func load(userId: UUID) async -> (kcal: Double, p: Double, c: Double, f: Double)? {
        struct O: Decodable { let weight: Double?; let sex: String?; let goal: String? }
        guard let o: O = try? await Backend.client.from("onboarding").select("weight, sex, goal").eq("user_id", value: userId).single().execute().value,
              let w = o.weight, w > 30, w <= 300 else { return nil }
        let base = o.sex == "female" ? w * 28 : w * 32
        let kcal = max(1200, (o.goal == "lose_weight" ? base - 350 : o.goal == "gain_muscle" ? base + 300 : base).rounded())
        let p = (w * 2).rounded(), f = (kcal * 0.25 / 9).rounded()
        return (kcal, p, max(0, ((kcal - p * 4 - f * 9) / 4).rounded()), f)
    }
}
