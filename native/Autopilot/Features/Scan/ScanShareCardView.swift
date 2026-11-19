import SwiftUI

/// Imagen del scan para compartir (historia 9:16, 360 × 640 a ×3 = 1080 × 1920), espejo de
/// `drawScanStory` en la web (ScanShareCard.tsx) y con la firma del entreno (`WorkoutShareCard`):
/// la fecha arriba, «Mi análisis físico», la nota de físico en Big Shoulders, el foco en dorado,
/// la frase del diagnóstico, tres cifras y el AP con autopilotplan.com al pie. Nunca lleva tus fotos.
struct ScanShareCardView: View {
    let result: ScanResult
    var date = Date()

    private let secondary = Color(red: 0.659, green: 0.659, blue: 0.682)
    private let ink = Color(red: 0.961, green: 0.961, blue: 0.969)

    var body: some View {
        ZStack(alignment: .top) {
            Color.black
            RadialGradient(colors: [Palette.gold.opacity(0.14), .clear], center: UnitPoint(x: 0.5, y: 0.052), startRadius: 0, endRadius: 217)
            VStack(spacing: 0) {
                Text(ScanFormat.shareDate(date))
                    .font(.inter(size: 13, weight: .medium)).foregroundStyle(secondary)
                    .padding(.top, 36)
                VStack(spacing: 4) {
                    Text(ScanFormat.shareTitle)
                        .font(.inter(size: 28, weight: .heavy)).foregroundStyle(.white)
                        .lineLimit(1).minimumScaleFactor(0.5)
                    Text(ScanFormat.shareSubtitle)
                        .font(.inter(size: 15, weight: .medium)).foregroundStyle(secondary)
                        .lineLimit(1).minimumScaleFactor(0.7)
                }
                .padding(.top, 96)
                Text(ScanFormat.shareHero)
                    .font(.inter(size: 11.5, weight: .semibold)).foregroundStyle(secondary)
                    .padding(.top, 52)
                // La nota y su «/10» siempre en una línea.
                HStack(alignment: .firstTextBaseline, spacing: 6) {
                    Text(ScanFormat.score(result.physique)).font(.figure(size: 80)).foregroundStyle(.white)
                    if result.physique != nil {
                        Text("/10").font(.inter(size: 21.6, weight: .semibold)).foregroundStyle(secondary)
                    }
                }
                .lineLimit(1).minimumScaleFactor(0.5)
                if let focus = ScanFormat.shareFocus(result) {
                    Text("\(ScanFormat.shareFocus) · \(focus)")
                        .font(.inter(size: 11.5, weight: .semibold)).foregroundStyle(Palette.gold)
                        .lineLimit(1).minimumScaleFactor(0.65).truncationMode(.tail)
                        .padding(.horizontal, 12).frame(height: 23)
                        .background(Palette.gold.opacity(0.14), in: Capsule())
                        .padding(.top, 8)
                }
                if let headline = ScanFormat.shareHeadline(result) {
                    Text(headline)
                        .font(.inter(size: 14, weight: .medium)).foregroundStyle(ink)
                        .multilineTextAlignment(.center).lineLimit(3).lineSpacing(2.5)
                        .padding(.top, 24)
                }
                Spacer(minLength: 0)
                let stats = ScanFormat.shareStats(result)
                if !stats.isEmpty {
                    HStack(spacing: 0) {
                        ForEach(Array(stats.enumerated()), id: \.offset) { index, stat in
                            if index > 0 { Rectangle().fill(.white.opacity(0.12)).frame(width: 0.7, height: 43) }
                            VStack(spacing: 4) {
                                Text(stat.1).font(.figure(size: 32))
                                    .foregroundStyle(index == 0 ? Palette.gold : .white)
                                    .lineLimit(1).minimumScaleFactor(0.5)
                                Text(stat.0).font(.inter(size: 13, weight: .medium)).foregroundStyle(secondary)
                                    .lineLimit(1).minimumScaleFactor(0.8)
                            }
                            .frame(maxWidth: .infinity)
                        }
                    }
                }
                BrandMark(size: 24)
                    .padding(.top, 24)
                Text("autopilotplan.com")
                    .font(.inter(size: 13, weight: .medium)).foregroundStyle(secondary)
                    .padding(.top, 10).padding(.bottom, 34)
            }
            .padding(.horizontal, 25)
        }
        .frame(width: 360, height: 640)
        .environment(\.colorScheme, .dark)
    }
}
