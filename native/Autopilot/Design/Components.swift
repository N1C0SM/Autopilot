import SwiftUI
import ImageIO

/// Tarjeta de descanso de la web (`EmptyState rest`): luna dorada con halo, estrellas, título y acción.
struct RestCard<Action: View>: View {
    /// Antetítulo dorado («SEMANA COMPLETA», «TU PLAN»…).
    var eyebrow = "DÍA DE DESCANSO"
    let title: String
    let message: String
    /// Foto real de marca, fundida a la derecha como en «Entrenamiento de hoy» (`BRAND_PHOTOS.gym` de la web).
    var photo = "https://enebrcdrdnfkyduzyrzm.supabase.co/storage/v1/object/public/site-assets/exercise-images/a31c7206-d2a4-4b31-856a-f5dec09b890e-1791475829849.png"
    @ViewBuilder var action: Action

    /// Semana completa (o descanso): la misma tarjeta que la sesión, con foto real y sin dibujos (la luna y
    /// las estrellas parecían infantiles). Igual que la tarjeta de `HomeOverview` en la web.
    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(eyebrow).font(.apCaption.weight(.semibold)).tracking(1.6).foregroundStyle(Palette.gold)
            Text(title).font(.inter(size: 22, weight: .bold)).tracking(-0.4)
                .padding(.top, 6).padding(.trailing, 96)
                .accessibilityAddTraits(.isHeader)
            Text(message).font(.apSubhead).foregroundStyle(Palette.muted)
                .padding(.top, 4).padding(.trailing, 96)
                .fixedSize(horizontal: false, vertical: true)
            action.padding(.top, 20)
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(alignment: .trailing) {
            CachedAsyncImage(url: URL(string: photo)) { $0.resizable().scaledToFill() } placeholder: { Palette.secondary }
                .frame(width: 210).frame(maxHeight: .infinity).clipped()
                .opacity(0.8)
                .overlay { LinearGradient(colors: [Palette.card, Palette.card.opacity(0.8), Palette.card.opacity(0.1)], startPoint: .leading, endPoint: .trailing) }
                .accessibilityHidden(true)
        }
        .background(Palette.card)
        .clipShape(RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: Radius.card, style: .continuous).strokeBorder(Color.white.opacity(0.08), lineWidth: 1))
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
            // Campana y avatar, como `MobileHeader` de la web.
            NotificationsBell()
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
/// 68 pt de alto, la pestaña activa con icono y texto en dorado (sin píldora) e inactivas en gris.
struct FloatingTabBar: View {
    let tabs: [AppSection]
    @Binding var selection: AppSection

    var body: some View {
        HStack(spacing: 2) {
            ForEach(tabs) { tab in
                let active = tab == selection
                Button {
                    if active { Haptics.tap() } else { Haptics.selection() }
                    // Sin animación: la pantalla nueva aparece entera en el mismo fotograma (como la
                    // barra de pestañas de iOS), sin fundido con la anterior.
                    selection = tab
                } label: {
                    VStack(spacing: 2) {
                        Image(tab.phosphor + (active ? "-fill" : "")).renderingMode(.template).resizable().frame(width: 24, height: 24)
                            .frame(height: 28)
                        Text(tab.tabTitle).font(.inter(size: 11, weight: .medium)).lineLimit(1)
                    }
                    .foregroundStyle(active ? Palette.gold : Palette.muted)
                    .padding(.horizontal, 14).padding(.vertical, 6)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel(tab.tabTitle)
                .accessibilityAddTraits(active ? .isSelected : [])
            }
        }
        .padding(4)
        .frame(height: 68)
        .frame(maxWidth: 480)
        .background(Palette.card.opacity(0.9), in: Capsule())
        .overlay(Capsule().strokeBorder(Palette.border, lineWidth: 1))
        .shadow(color: .black.opacity(0.5), radius: 12, y: 8)
        .padding(.horizontal, 12)
        // La barra se lee como un grupo de pestañas (VoiceOver anuncia «pestaña, seleccionada»).
        .accessibilityElement(children: .contain)
        .dynamicTypeSize(...DynamicTypeSize.accessibility2)
    }
}

/// Control segmentado de la web (`TabsList`): pista en cápsula y la opción activa en una cápsula que se desliza.
/// La cápsula visible mide 32 pt (36 en dorado, como `h-11` en Progreso), pero cada opción tiene 44 pt de área táctil (mínimo de Apple).
struct SegmentedPill: View {
    let options: [String]
    @Binding var selection: Int
    /// Sección activa en dorado (Progreso, como en la web); por defecto, gris.
    var gold = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Namespace private var pill

    var body: some View {
        let pillHeight: CGFloat = gold ? 36 : 32
        HStack(spacing: 0) {
            ForEach(options.indices, id: \.self) { i in
                Button {
                    Haptics.selection()
                    // Solo la cápsula se desliza (abajo); el contenido cambia sin fundidos.
                    selection = i
                } label: {
                    Text(options[i]).font(.inter(size: 13, weight: i == selection ? .semibold : .medium))
                        .lineLimit(1).minimumScaleFactor(0.7)
                        .foregroundStyle(i == selection ? (gold ? Palette.background : Palette.foreground) : Palette.muted)
                        .frame(maxWidth: .infinity)
                        .frame(minHeight: 44)
                        .background {
                            // La cápsula activa se desliza a la opción tocada, sin sombra, como `rounded-full` en la web.
                            if i == selection {
                                Capsule().fill(gold ? Palette.gold : Palette.accent)
                                    .frame(height: pillHeight)
                                    .matchedGeometryEffect(id: "pill", in: pill)
                            }
                        }
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel(options[i])
                .accessibilityAddTraits(i == selection ? .isSelected : [])
            }
        }
        .animation(reduceMotion ? nil : .snappy(duration: 0.25), value: selection)
        .padding(.horizontal, 4)
        .background { Capsule().fill(Palette.card).frame(height: pillHeight + 8) }
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

    /// Las fotos públicas de Supabase son PNG de ~2 MB: su endpoint de render las da en WebP
    /// de ~5–15 KB al tamaño de pantalla. Igual que `fastImage` en la web (src/shared/lib/fastImage.ts).
    nonisolated static func fastURL(_ url: URL, maxSide: CGFloat) -> URLRequest? {
        let object = "/storage/v1/object/public/", render = "/storage/v1/render/image/public/"
        let text = url.absoluteString
        guard url.host?.hasSuffix(".supabase.co") == true,
              let base = text.components(separatedBy: "?").first,
              let path = base.components(separatedBy: object).dropFirst().first
                ?? base.components(separatedBy: render).dropFirst().first,
              let root = base.components(separatedBy: "/storage/v1/").first else { return nil }
        let side = Int(min(max(maxSide * 3, 64), 1000))
        guard let fast = URL(string: "\(root)\(render)\(path)?width=\(side)&height=\(side)&resize=contain&quality=55") else { return nil }
        var request = URLRequest(url: fast)
        // Sin esta cabecera Supabase devuelve PNG (~500 KB) en vez de WebP.
        request.setValue("image/webp,image/*", forHTTPHeaderField: "Accept")
        return request
    }

    private func download(_ url: URL, maxSide: CGFloat) async -> PlatformImage? {
        // Ya descargada en otra sesión: no se vuelve a pedir a la red.
        if let disk = await Self.fromDisk(url, maxSide: maxSide) { return disk }
        // Primero la versión reducida; si el render fallara, la original de siempre.
        if let fast = Self.fastURL(url, maxSide: maxSide),
           let (data, response) = try? await session.data(for: fast),
           (response as? HTTPURLResponse)?.statusCode ?? 200 < 400,
           let image = await Self.decode(data, maxSide: maxSide) {
            Self.toDisk(image, url, maxSide: maxSide)
            return image
        }
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

/// Insignia «Plus» con candado: marca una función bloqueada del plan gratis (como `PlusBadge` en la web).
struct PlusBadge: View {
    var body: some View {
        HStack(spacing: 4) {
            Image(systemName: "lock.fill").font(.system(size: 10, weight: .semibold))
            Text("Plus").font(.inter(size: 11, weight: .semibold))
        }
        .foregroundStyle(Palette.gold)
        .padding(.horizontal, 8).padding(.vertical, 5)
        .background(Palette.gold.opacity(0.15), in: Capsule())
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Incluido en Plus")
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
              let w = o.weight else { return nil }
        return estimate(weight: w, sex: o.sex, goal: o.goal)
    }

    /// Como `resolveNutritionPreview` de la web: nil si el peso no es válido.
    static func estimate(weight w: Double, sex: String?, goal: String?) -> (kcal: Double, p: Double, c: Double, f: Double)? {
        guard w > 30, w <= 300 else { return nil }
        let base = sex == "female" ? w * 28 : w * 32
        let kcal = max(1200, (goal == "lose_weight" ? base - 350 : goal == "gain_muscle" ? base + 300 : base).rounded())
        let p = (w * 2).rounded(), f = (kcal * 0.25 / 9).rounded()
        return (kcal, p, max(0, ((kcal - p * 4 - f * 9) / 4).rounded()), f)
    }
}
