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
            Text(title).font(.inter(size: 28, weight: .bold)).tracking(-0.7).padding(.top, 8).accessibilityAddTraits(.isHeader)
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

/// Cabecera de la web (MobileHeader): campana y avatar en círculos de 30 pt dentro de 44 pt.
struct HeaderButtons: View {
    let initial: String
    var avatar: String? = nil
    var onProfile: () -> Void

    var body: some View {
        HStack(spacing: 0) {
            Button {} label: {
                Image("lu-bell").renderingMode(.template).resizable().frame(width: 17, height: 17)
                    .frame(width: 30, height: 30).background(Palette.secondary, in: Circle())
                    .frame(width: 44, height: 44)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Notificaciones")
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

    var body: some View {
        HStack(spacing: 2) {
            ForEach(tabs) { tab in
                let active = tab == selection
                Button { if active { Haptics.tap() } else { Haptics.selection() }; withAnimation(.spring(response: 0.3, dampingFraction: 0.85)) { selection = tab } } label: {
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
    }
}

/// Control segmentado de la web (`TabsList`): fondo oscuro y la opción activa en gris claro.
struct SegmentedPill: View {
    let options: [String]
    @Binding var selection: Int

    var body: some View {
        HStack(spacing: 0) {
            ForEach(options.indices, id: \.self) { i in
                Button { Haptics.selection(); selection = i } label: {
                    Text(options[i]).font(.inter(size: 13, weight: i == selection ? .semibold : .medium))
                        .lineLimit(1).minimumScaleFactor(0.7)
                        .foregroundStyle(i == selection ? Palette.foreground : Palette.muted)
                        .frame(maxWidth: .infinity, minHeight: 32)
                        .background { if i == selection { RoundedRectangle(cornerRadius: 9, style: .continuous).fill(Palette.accent).shadow(color: .black.opacity(0.25), radius: 2, y: 1) } }
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityAddTraits(i == selection ? .isSelected : [])
            }
        }
        .padding(4)
        .background(Palette.card, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
        .frame(maxWidth: 448)
        .frame(maxWidth: .infinity)
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
    private let memory = NSCache<NSURL, PlatformImage>()
    private let session: URLSession = {
        let c = URLSessionConfiguration.default
        c.urlCache = URLCache(memoryCapacity: 30_000_000, diskCapacity: 300_000_000)
        c.requestCachePolicy = .returnCacheDataElseLoad
        return URLSession(configuration: c)
    }()

    func cached(_ url: URL) -> PlatformImage? { memory.object(forKey: url as NSURL) }

    func load(_ url: URL, maxSide: CGFloat = 900) async -> PlatformImage? {
        if let hit = memory.object(forKey: url as NSURL) { return hit }
        guard let (data, _) = try? await session.data(from: url) else { return nil }
        // Se reduce fuera del hilo principal: las fotos originales son muy grandes.
        let image = await Task.detached(priority: .userInitiated) { () -> PlatformImage? in
            guard let source = CGImageSourceCreateWithData(data as CFData, nil) else { return nil }
            let opts: [CFString: Any] = [kCGImageSourceCreateThumbnailFromImageAlways: true, kCGImageSourceThumbnailMaxPixelSize: maxSide * 3, kCGImageSourceCreateThumbnailWithTransform: true]
            guard let cg = CGImageSourceCreateThumbnailAtIndex(source, 0, opts as CFDictionary) else { return nil }
            #if os(iOS)
            return UIImage(cgImage: cg)
            #else
            return NSImage(cgImage: cg, size: .zero)
            #endif
        }.value
        if let image { memory.setObject(image, forKey: url as NSURL) }
        return image
    }
}

struct CachedAsyncImage<Content: View, Placeholder: View>: View {
    let url: URL?
    @ViewBuilder var content: (Image) -> Content
    @ViewBuilder var placeholder: () -> Placeholder
    @State private var image: PlatformImage?

    init(url: URL?, @ViewBuilder content: @escaping (Image) -> Content, @ViewBuilder placeholder: @escaping () -> Placeholder) {
        self.url = url; self.content = content; self.placeholder = placeholder
        _image = State(initialValue: url.flatMap { u in MainActor.assumeIsolated { ImageCache.shared.cached(u) } })
    }

    var body: some View {
        Group {
            if let image { content(Image(platformImage: image)) } else { placeholder() }
        }
        .task(id: url) {
            guard image == nil, let url else { return }
            image = await ImageCache.shared.load(url)
        }
    }
}

/// Icono sobre cuadrado redondeado tintado (`IconTile` de la web): sm 32 pt, md 40, lg 64.
struct IconTile: View {
    let symbol: String
    var size: CGFloat = 32
    var tint: Color = Palette.gold
    var body: some View {
        Image(systemName: symbol)
            .font(.inter(size: size * 0.5625, weight: .semibold))
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
