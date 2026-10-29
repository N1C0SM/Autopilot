import SwiftUI
import Supabase

/// Admin → Captación: de qué red llega cada usuario y hasta dónde avanza.
/// Mismo cálculo que la web: todo sale agregado de `admin_acquisition_funnel` (solo admins).
struct AdminAcquisitionView: View {
    private struct Channel: Decodable, Identifiable {
        let channel: String
        let visits: Int
        let scans: Int
        let signups: Int
        let week2_eligible: Int
        let active_week2: Int
        let plus: Int
        var id: String { channel }
    }

    private struct Funnel: Decodable {
        let tracking_since: String?
        let channels: [Channel]
    }

    private static let ranges: [(label: String, days: Int?)] = [("7 días", 7), ("30 días", 30), ("90 días", 90), ("Todo", nil)]
    private static let labels = [
        "tiktok": "TikTok", "instagram": "Instagram", "youtube": "YouTube", "threads": "Threads",
        "facebook": "Facebook", "otros": "Otras webs", "directo": "Directo / sin origen",
    ]

    @State private var range = 1
    @State private var funnel: Funnel?
    @State private var loading = true
    @State private var failed = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                Text("De qué red llega cada usuario y hasta dónde avanza.")
                    .font(.apSubhead).foregroundStyle(Palette.muted)
                SegmentedPill(options: Self.ranges.map(\.label), selection: $range)
                if loading && funnel == nil {
                    AdminKitSkeletonPulse {
                        LazyVGrid(columns: [GridItem(.adaptive(minimum: 150), spacing: 12)], spacing: 12) {
                            ForEach(0..<5, id: \.self) { _ in AdminKitSkeletonBlock(height: 92, radius: Radius.card) }
                        }
                    }
                } else if let funnel {
                    if failed { AdminKitRefreshWarning { Task { await load() } } }
                    content(funnel)
                } else {
                    AdminErrorCard(title: "Captación no disponible",
                                   message: "No se pudo cargar el embudo. Comprueba la conexión y que la migración de captación está publicada.") {
                        Task { await load() }
                    }
                }
            }
            .padding(.horizontal, 20)
            .padding(.top, 4)
            .padding(.bottom, 28)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .screenBackground()
        .refreshable { await load() }
        .task(id: range) { await load() }
    }

    @ViewBuilder
    private func content(_ f: Funnel) -> some View {
        let tracking = f.tracking_since != nil
        let sum = { (key: KeyPath<Channel, Int>) in f.channels.reduce(0) { $0 + $1[keyPath: key] } }
        let visits = sum(\.visits), scans = sum(\.scans), signups = sum(\.signups)
        let eligible = sum(\.week2_eligible), active = sum(\.active_week2), plus = sum(\.plus)
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 150), spacing: 12)], spacing: 12) {
            FigureTile(label: "Visitantes nuevos", value: tracking ? "\(visits)" : "—", hint: tracking ? "Primer contacto" : "Aún sin medir")
            FigureTile(label: "Scans", value: tracking ? "\(scans)" : "—", hint: tracking ? "Hechos en la web" : "Aún sin medir")
            FigureTile(label: "Cuentas creadas", value: "\(signups)",
                       hint: tracking && visits > 0 ? "\(pct(signups, visits)) de las visitas" : "En el rango", accent: true)
            FigureTile(label: "Activos 2ª semana", value: eligible > 0 ? pct(active, eligible) : "—",
                       hint: eligible > 0 ? "\(active) de \(eligible)" : "Nadie cumple 14 días")
            FigureTile(label: "Plus", value: "\(plus)", hint: "\(pct(plus, signups)) de las cuentas")
        }
        Text((tracking
              ? "Midiendo el origen desde el \(dateText(f.tracking_since)). Las cuentas anteriores aparecen como «sin origen»."
              : "El origen se empieza a medir cuando se publique esta versión: hasta entonces todas las cuentas aparecen como «sin origen» y no hay visitas ni scans registrados.")
             + " Activo en 2ª semana: al menos un entreno entre los días 8 y 14 desde el alta. Sin cuentas de prueba ni del equipo.")
            .font(.apFootnote).foregroundStyle(Palette.muted)
            .fixedSize(horizontal: false, vertical: true)
        Card {
            SectionTitle(title: "Por red")
            ForEach(Array(f.channels.enumerated()), id: \.element.id) { index, c in
                if index > 0 { Rectangle().fill(Palette.separator).frame(height: 0.5).accessibilityHidden(true) }
                channelRow(c, tracking: tracking)
            }
        }
        .opacity(loading ? 0.6 : 1)
    }

    private func channelRow(_ c: Channel, tracking: Bool) -> some View {
        let stats: [(String, String)] = [
            ("Visitas", tracking ? "\(c.visits)" : "—"),
            ("Scans", tracking ? "\(c.scans)" : "—"),
            ("Activos 2ª sem.", c.week2_eligible > 0 ? "\(c.active_week2)/\(c.week2_eligible)" : "—"),
            ("Plus", "\(c.plus)"),
        ]
        return VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .firstTextBaseline) {
                Text(Self.labels[c.channel] ?? c.channel).font(.apHeadline).lineLimit(1)
                Spacer(minLength: 8)
                Text("\(c.signups)").font(.apFigureSmall)
                Text(c.signups == 1 ? "cuenta" : "cuentas").font(.apFootnote).foregroundStyle(Palette.muted)
            }
            HStack(alignment: .top, spacing: 8) {
                ForEach(stats, id: \.0) { stat in
                    VStack(alignment: .leading, spacing: 2) {
                        Text(stat.0).font(.apCaption).foregroundStyle(Palette.muted).lineLimit(1).minimumScaleFactor(0.8)
                        Text(stat.1).font(.apHeadline.monospacedDigit())
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
        }
        .padding(.vertical, 6)
        .opacity(c.visits + c.scans + c.signups == 0 ? 0.5 : 1)
        .accessibilityElement(children: .combine)
    }

    private func pct(_ a: Int, _ b: Int) -> String { b > 0 ? "\(Int((Double(a) / Double(b) * 100).rounded()))%" : "—" }

    private func dateText(_ iso: String?) -> String {
        guard let iso, let date = ISO8601DateFormatter.fractional.date(from: iso) ?? ISO8601DateFormatter().date(from: iso) else { return "inicio" }
        return date.formatted(.dateTime.day().month(.abbreviated).year().locale(Locale(identifier: "es_ES")))
    }

    private func load() async {
        loading = true
        defer { loading = false }
        let day = DateFormatter()
        day.calendar = Calendar(identifier: .gregorian)
        day.locale = Locale(identifier: "en_US_POSIX")
        day.dateFormat = "yyyy-MM-dd"
        let now = Date()
        let from: String
        if let days = Self.ranges[range].days,
           let start = Calendar.current.date(byAdding: .day, value: -(days - 1), to: now) {
            from = day.string(from: start)
        } else {
            from = "2024-01-01"
        }
        do {
            funnel = try await Backend.client
                .rpc("admin_acquisition_funnel", params: ["_from": from, "_to": day.string(from: now)])
                .execute().value
            failed = false
        } catch {
            failed = true
        }
    }
}

private extension ISO8601DateFormatter {
    static let fractional: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()
}
