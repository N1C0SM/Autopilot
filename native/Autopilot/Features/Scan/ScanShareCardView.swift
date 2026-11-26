import SwiftUI

/// Imagen del scan para compartir (historia 9:16, 360 × 640 a ×3 = 1080 × 1920), espejo de
/// `drawScanStory` en la web (ScanShareCard.tsx) con la rejilla y la firma de `ShareStory` (las del
/// entreno): arriba la nota de físico en Big Shoulders dentro de su anillo dorado; debajo la fecha,
/// «Mi análisis físico», el foco en dorado, la frase del diagnóstico, tres cifras y el AP con
/// autopilotplan.com al pie. Nunca lleva tus fotos.
struct ScanShareCardView: View {
    let result: ScanResult
    var date = Date()

    /// Primera línea de la frase del diagnóstico (`HEADLINE_Y` en la web: 40 px, hasta tres líneas de 56).
    private static let headlineY: CGFloat = 1090 / ShareStory.scale

    var body: some View {
        ZStack(alignment: .topLeading) {
            ShareStoryBackdrop()
            scoreRing
            ShareStoryLine(text: ScanFormat.shareDate(date), y: ShareStory.eyebrow, size: 36 / ShareStory.scale, weight: .medium, color: ShareStory.secondary)
            ShareStoryLine(text: ScanFormat.shareTitle, y: ShareStory.title, size: 76 / ShareStory.scale, weight: .heavy)
            ShareStoryLine(text: ScanFormat.shareSubtitle, y: ShareStory.subtitle, size: 38 / ShareStory.scale, weight: .medium, color: ShareStory.secondary)
            if let focus = ScanFormat.shareFocus(result) {
                ShareStoryCapsule(label: "\(ScanFormat.shareFocus) · \(focus)", y: ShareStory.heroLabel)
            }
            if let headline = ScanFormat.shareHeadline(result) {
                // Hasta tres líneas centradas; la primera, centrada en `headlineY`.
                Text(headline)
                    .font(ShareStory.font(40 / ShareStory.scale, .medium)).foregroundStyle(ShareStory.body)
                    .multilineTextAlignment(.center).lineLimit(3).truncationMode(.tail)
                    .lineSpacing((56 - 40 * 1.21) / ShareStory.scale)
                    .frame(width: ShareStory.width - ShareStory.side * 2)
                    .offset(x: ShareStory.side, y: Self.headlineY - 28 / ShareStory.scale)
            }
            ShareStoryStats(stats: ScanFormat.shareStats(result).map { (value: $0.1, label: $0.0) })
            ShareStorySignature()
        }
        .frame(width: ShareStory.width, height: ShareStory.height)
        .environment(\.colorScheme, .dark)
        .environment(\.dynamicTypeSize, .large)
    }

    /// La nota de físico sobre 10 en su anillo: dorado hasta la nota, pista blanca tenue el resto.
    private var scoreRing: some View {
        let diameter = ShareStory.ringSize - ShareStory.ringStroke
        let fraction = result.physique.map { max(0, min(1, $0 / 10)) } ?? 0
        return ZStack {
            Circle().stroke(.white.opacity(0.1), lineWidth: ShareStory.ringStroke)
                .frame(width: diameter, height: diameter)
                .position(x: ShareStory.width / 2, y: ShareStory.ringCenter)
            Circle().trim(from: 0, to: fraction)
                .stroke(Palette.gold, style: StrokeStyle(lineWidth: ShareStory.ringStroke, lineCap: .round))
                .rotationEffect(.degrees(-90))
                .frame(width: diameter, height: diameter)
                .position(x: ShareStory.width / 2, y: ShareStory.ringCenter)
            ShareStoryLine(text: ScanFormat.shareHero, y: ShareStory.ringCenter - 110 / ShareStory.scale,
                           size: 32 / ShareStory.scale, weight: .semibold, color: ShareStory.secondary)
            // La nota y su «/10» siempre en una línea.
            ShareStoryFigure(value: ScanFormat.score(result.physique), unit: result.physique != nil ? "/10" : "",
                             baseline: ShareStory.ringCenter + 62 / ShareStory.scale, size: 170 / ShareStory.scale)
        }
        .frame(width: ShareStory.width, height: ShareStory.height)
    }
}
