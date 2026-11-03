import SwiftUI

/// Shareable scan summary. It deliberately omits the user's source photos.
struct ScanShareCardView: View {
    let result: ScanResult

    private var summary: String? {
        [result.headline_diagnosis, result.summary]
            .compactMap { $0?.trimmingCharacters(in: .whitespacesAndNewlines) }
            .first { !$0.isEmpty }
    }

    private var focus: String? {
        result.improvements?.compactMap(\.label).first { !$0.isEmpty }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 8) {
                BrandMark(size: 22)
                Text("Autopilot")
                    .font(.apHeadline)
                    .foregroundStyle(Palette.foreground)
                Spacer()
                Text(Date().formatted(.dateTime.day().month(.abbreviated).locale(Locale(identifier: "es_ES"))))
                    .font(.apFootnote)
                    .foregroundStyle(Palette.muted)
            }

            Spacer(minLength: 28)

            Text("Tu análisis corporal")
                .font(.apTitle1)
                .foregroundStyle(Palette.foreground)
                .fixedSize(horizontal: false, vertical: true)

            Text("Físico")
                .font(.apSubhead)
                .foregroundStyle(Palette.muted)
                .padding(.top, 24)

            HStack(alignment: .firstTextBaseline, spacing: 6) {
                Text(result.physique.map { NumberText.decimal($0) } ?? "—")
                    .font(.figure(size: 80))
                    .foregroundStyle(Palette.foreground)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
                Text("/ 10")
                    .font(.apTitle2)
                    .foregroundStyle(Palette.muted)
            }
            .padding(.top, 2)

            HStack(spacing: 10) {
                if let potential = result.potential {
                    metric("Potencial", NumberText.decimal(potential), accent: true)
                }
                if let bodyFat = result.body_composition?.body_fat_pct {
                    metric("Grasa est.", "\(NumberText.decimal(bodyFat))%")
                }
            }
            .padding(.top, 18)

            if let summary {
                Text(summary)
                    .font(.apBody)
                    .foregroundStyle(Palette.muted)
                    .lineLimit(5)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.top, 24)
            }

            if let focus {
                Text(focus)
                    .font(.apSubhead.weight(.semibold))
                    .foregroundStyle(Palette.gold)
                    .lineLimit(2)
                    .padding(.top, 16)
            }

            Spacer(minLength: 24)

            VStack(spacing: 8) {
                Text("Lectura orientativa con IA")
                    .font(.apFootnote)
                    .foregroundStyle(Palette.muted)
                Text("autopilotplan.com/scan")
                    .font(.apFootnote.weight(.medium))
                    .foregroundStyle(Palette.foreground)
            }
            .frame(maxWidth: .infinity)
        }
        .padding(28)
        .frame(width: 360, height: 640)
        .background(alignment: .topTrailing) {
            RadialGradient(
                colors: [Palette.gold.opacity(0.14), .clear],
                center: .topTrailing,
                startRadius: 0,
                endRadius: 260
            )
        }
        .background(Palette.background)
        .clipShape(RoundedRectangle(cornerRadius: Radius.hero, style: .continuous))
    }

    private func metric(_ title: String, _ value: String, accent: Bool = false) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title)
                .font(.apFootnote)
                .foregroundStyle(Palette.muted)
            Text(value)
                .font(.apFigureSmall)
                .foregroundStyle(accent ? Palette.gold : Palette.foreground)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .background(Palette.card, in: RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
    }
}
