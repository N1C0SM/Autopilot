import SwiftUI

/// Rejilla y piezas de las historias para compartir (entreno y scan), gemelas de `STORY`
/// (`shareStory.ts`) y de `storyCanvas.ts` en la web: lienzo de 360 × 640 pt (1080 × 1920 a ×3),
/// los mismos márgenes seguros (nada importante en las franjas que tapa Instagram) y la misma
/// firma (el AP y autopilotplan.com). Cada medida es la de la web dividida entre `scale`; las
/// verticales son el centro de cada línea, salvo `hero` (línea base de la cifra).
enum ShareStory {
    static let scale: CGFloat = 3
    static let width: CGFloat = 1080 / scale
    static let height: CGFloat = 1920 / scale
    static let side: CGFloat = 96 / scale
    static let visualEnd: CGFloat = 980 / scale
    static let fadeFrom: CGFloat = 400 / scale
    static let figureTop: CGFloat = 240 / scale
    static let figureHeight: CGFloat = 440 / scale
    static let figureGap: CGFloat = 48 / scale
    static let ringCenter: CGFloat = 480 / scale
    static let ringSize: CGFloat = 420 / scale
    static let ringStroke: CGFloat = 20 / scale
    static let eyebrow: CGFloat = 750 / scale
    static let title: CGFloat = 818 / scale
    static let subtitle: CGFloat = 880 / scale
    static let heroLabel: CGFloat = 972 / scale
    static let hero: CGFloat = 1170 / scale
    static let heroSize: CGFloat = 200 / scale
    static let highlight: CGFloat = 1262 / scale
    static let stats: CGFloat = 1392 / scale
    static let statLabel: CGFloat = 1452 / scale
    static let mark: CGFloat = 1588 / scale
    static let markSize: CGFloat = 72 / scale
    static let url: CGFloat = 1660 / scale

    /// La web, al pie de todo lo que sale de Autopilot (sin la palabra «Autopilot»).
    static let urlText = "autopilotplan.com"

    /// Texto sobre el lienzo (`INK_TEXT` de la web): blanco, cuerpo y gris secundario.
    static let ink = Color.white
    static let body = Color(red: 0.961, green: 0.961, blue: 0.969)
    static let secondary = Color(red: 0.659, green: 0.659, blue: 0.682)

    /// Inter a tamaño fijo: la imagen no crece con el tamaño de letra del sistema.
    static func font(_ size: CGFloat, _ weight: Font.Weight = .regular) -> Font {
        Font.custom(InterFont.name, fixedSize: size).weight(weight)
    }

    /// Cifras en Big Shoulders 800 a tamaño fijo, con dígitos tabulares.
    static func figure(_ size: CGFloat) -> Font {
        Font.custom(FigureFont.name, fixedSize: size).weight(.heavy).monospacedDigit()
    }

    /// Las dos o tres cifras de apoyo del entreno (`workoutStoryStats` en la web): Series (si la
    /// protagonista es el volumen), Ejercicios y Minutos (u Horas) o, sin duración, Músculos.
    static func workoutStats(volumeKg: Double, sets: Int, exercises: Int, muscles: Int, durationSeconds: TimeInterval?) -> [(value: String, label: String)] {
        var stats: [(value: String, label: String)] = []
        if volumeKg > 0 { stats.append((NumberText.grouped(Double(sets)), sets == 1 ? "Serie" : "Series")) }
        stats.append((NumberText.grouped(Double(exercises)), exercises == 1 ? "Ejercicio" : "Ejercicios"))
        if let seconds = durationSeconds, seconds > 0 {
            let minutes = max(1, Int((seconds / 60).rounded()))
            if minutes < 60 {
                stats.append(("\(minutes)", minutes == 1 ? "Minuto" : "Minutos"))
            } else {
                stats.append(("\(minutes / 60):\(String(format: "%02d", minutes % 60))", "Horas"))
            }
        } else if muscles > 0 {
            stats.append((NumberText.grouped(Double(muscles)), muscles == 1 ? "Músculo" : "Músculos"))
        }
        return Array(stats.prefix(3))
    }
}

/// Fondo de las historias: negro de la marca con un halo dorado muy tenue arriba (≈12 %).
struct ShareStoryBackdrop: View {
    var body: some View {
        ZStack {
            Color.black
            RadialGradient(colors: [Palette.gold.opacity(0.12), .clear],
                           center: UnitPoint(x: 0.5, y: 470 / 1920), startRadius: 0, endRadius: 640 / ShareStory.scale)
        }
        .frame(width: ShareStory.width, height: ShareStory.height)
    }
}

/// Foto real a sangre arriba, con el sujeto un poco por encima del centro, tratamiento de marca
/// (saturación contenida) y fundida a negro desde `fadeFrom` hasta `visualEnd` (`drawPhoto` en la web).
struct ShareStoryPhoto: View {
    let image: PlatformImage

    var body: some View {
        let box = CGSize(width: ShareStory.width, height: ShareStory.visualEnd)
        let size = image.size
        let k = max(box.width / max(size.width, 1), box.height / max(size.height, 1))
        let drawn = CGSize(width: size.width * k, height: size.height * k)
        ZStack(alignment: .topLeading) {
            platformImage
                .resizable()
                .frame(width: drawn.width, height: drawn.height)
                .saturation(0.85).contrast(1.04)
                .offset(x: (box.width - drawn.width) / 2, y: (box.height - drawn.height) * 0.35)
            LinearGradient(stops: [
                .init(color: .clear, location: 0),
                .init(color: .black.opacity(0.62), location: 0.55),
                .init(color: .black, location: 1),
            ], startPoint: .top, endPoint: .bottom)
            .frame(width: box.width, height: box.height - ShareStory.fadeFrom)
            .offset(y: ShareStory.fadeFrom)
        }
        .frame(width: box.width, height: box.height, alignment: .topLeading)
        .clipped()
    }

    private var platformImage: Image {
        #if os(iOS)
        Image(uiImage: image)
        #else
        Image(nsImage: image)
        #endif
    }
}

/// Línea de texto centrada en `y` que se encoge hasta caber en una línea (`centerText` en la web).
struct ShareStoryLine: View {
    let text: String
    let y: CGFloat
    let size: CGFloat
    var weight: Font.Weight = .regular
    var color: Color = ShareStory.ink

    var body: some View {
        Text(text)
            .font(ShareStory.font(size, weight)).foregroundStyle(color)
            .lineLimit(1).minimumScaleFactor(0.62).truncationMode(.tail)
            .frame(width: ShareStory.width - ShareStory.side * 2)
            .position(x: ShareStory.width / 2, y: y)
    }
}

/// Cifra protagonista con su unidad al lado, centrada y con la línea base en `baseline`
/// (`drawHeroFigure` en la web).
struct ShareStoryFigure: View {
    let value: String
    let unit: String
    let baseline: CGFloat
    let size: CGFloat

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: unit.isEmpty ? 0 : size * 0.08) {
            Text(value).font(ShareStory.figure(size)).foregroundStyle(ShareStory.ink)
            if !unit.isEmpty {
                Text(unit).font(ShareStory.font(size * 0.27, .semibold)).foregroundStyle(ShareStory.secondary)
            }
        }
        .lineLimit(1).minimumScaleFactor(0.4)
        .frame(width: ShareStory.width - ShareStory.side * 2)
        .alignmentGuide(.top) { d in d[.firstTextBaseline] }
        .offset(y: baseline)
        .frame(width: ShareStory.width, height: ShareStory.height, alignment: .top)
    }
}

/// Cápsula dorada tenue centrada en `y` (el logro o el foco): el único acento junto al AP.
struct ShareStoryCapsule: View {
    let label: String
    let y: CGFloat

    var body: some View {
        Text(label)
            .font(ShareStory.font(32 / ShareStory.scale, .semibold)).foregroundStyle(Palette.gold)
            .lineLimit(1).minimumScaleFactor(0.75).truncationMode(.tail)
            .padding(.horizontal, 36 / ShareStory.scale)
            .frame(height: 64 / ShareStory.scale)
            .background(Palette.gold.opacity(0.14), in: Capsule())
            .frame(maxWidth: ShareStory.width - ShareStory.side * 2)
            .position(x: ShareStory.width / 2, y: y)
    }
}

/// Dos o tres cifras de apoyo en columnas, sin cajas y separadas por líneas finas (`drawStats`).
struct ShareStoryStats: View {
    let stats: [(value: String, label: String)]

    var body: some View {
        let inner = ShareStory.width - ShareStory.side * 2
        let column = inner / CGFloat(max(stats.count, 1))
        ZStack {
            ForEach(Array(stats.enumerated()), id: \.offset) { i, stat in
                let cx = ShareStory.side + column * CGFloat(i) + column / 2
                if i > 0 {
                    Rectangle().fill(.white.opacity(0.12))
                        .frame(width: 2 / ShareStory.scale, height: (ShareStory.statLabel - ShareStory.stats) + 74 / ShareStory.scale)
                        .position(x: ShareStory.side + column * CGFloat(i),
                                  y: (ShareStory.stats - 52 / ShareStory.scale) + ((ShareStory.statLabel - ShareStory.stats) + 74 / ShareStory.scale) / 2)
                }
                // La caja de línea de Big Shoulders deja las cifras 7 px más abajo que el `middle` del
                // lienzo de la web: se suben para que caigan igual (y la coma de «8,5» no toque la etiqueta).
                Text(stat.value).font(ShareStory.figure(88 / ShareStory.scale)).foregroundStyle(ShareStory.ink)
                    .lineLimit(1).minimumScaleFactor(0.55)
                    .frame(width: column - 24 / ShareStory.scale)
                    .position(x: cx, y: ShareStory.stats - 7 / ShareStory.scale)
                Text(stat.label).font(ShareStory.font(34 / ShareStory.scale, .medium)).foregroundStyle(ShareStory.secondary)
                    .lineLimit(1).minimumScaleFactor(0.8)
                    .frame(width: column)
                    .position(x: cx, y: ShareStory.statLabel)
            }
        }
        .frame(width: ShareStory.width, height: ShareStory.height)
    }
}

/// Firma común a todo lo que sale de Autopilot: el AP y autopilotplan.com al pie (`drawSignature`).
struct ShareStorySignature: View {
    var body: some View {
        ZStack {
            BrandMark(size: ShareStory.markSize)
                .position(x: ShareStory.width / 2, y: ShareStory.mark)
            Text(ShareStory.urlText)
                .font(ShareStory.font(34 / ShareStory.scale, .medium)).foregroundStyle(ShareStory.secondary)
                .position(x: ShareStory.width / 2, y: ShareStory.url)
        }
        .frame(width: ShareStory.width, height: ShareStory.height)
    }
}
