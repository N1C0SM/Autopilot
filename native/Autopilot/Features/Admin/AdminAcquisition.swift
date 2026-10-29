import SwiftUI
import Supabase

/// Admin → Crecimiento: Captación (de dónde vienen y dónde se pierden) y Negocio
/// (planes, ingresos y actividad) en una sola sección, igual que la web.
struct AdminGrowthView: View {
    @State private var tab = 0

    var body: some View {
        VStack(spacing: 12) {
            SegmentedPill(options: ["Captación", "Negocio"], selection: $tab)
                .padding(.horizontal, 20)
                .padding(.top, 4)
            if tab == 0 { AdminAcquisitionView() } else { AdminMetricsWebView() }
        }
        .screenBackground()
    }
}

/// Admin → Captación: de qué red llega cada usuario y hasta dónde avanza.
/// Mismo cálculo que la web: todo sale agregado de `admin_acquisition_funnel` (solo admins).
struct AdminAcquisitionView: View {
    private struct Channel: Decodable, Identifiable {
        let channel: String
        let visits: Int
        let scans: Int
        let signups: Int
        let first_workout: Int?
        let week2_eligible: Int
        let active_week2: Int
        let plus: Int
        var id: String { channel }
        var firstWorkoutCount: Int { first_workout ?? 0 }
    }

    private struct Funnel: Decodable {
        let tracking_since: String?
        let channels: [Channel]
    }

    /// Una cuenta del rango con su origen y el paso del embudo en el que se quedó.
    private struct Person: Decodable, Identifiable {
        let user_id: String
        let name: String?
        let email: String?
        let signup_at: String
        let channel: String
        let medium: String?
        let campaign: String?
        let landing_path: String?
        let stage: String
        let last_workout: String?
        var id: String { user_id }
    }

    private struct People: Decodable {
        let total: Int
        let users: [Person]
    }

    /// Los opcionales vacíos no se envían y SQL usa su valor por defecto (sin filtro).
    private struct PeopleParams: Encodable {
        let _from: String
        let _to: String
        let _channel: String?
        let _stage: String?
        let _limit: Int
        let _offset: Int
    }

    private static let channelOrder = ["tiktok", "instagram", "youtube", "threads", "facebook", "otros", "directo"]
    private static let stages: [(key: String, label: String)] = [
        ("cuenta", "Solo creó la cuenta"), ("scan", "Hizo el scan"), ("entreno", "Entrenó al menos una vez"),
        ("activo", "Activo la 2ª semana"), ("plus", "Plus"),
    ]
    private static let pageSize = 50

    /// Cada publicación (red + dónde estaba el enlace + pieza) y lo que trajo.
    private struct Campaign: Decodable, Identifiable {
        let channel: String
        let medium: String?
        let campaign: String?
        let visits: Int
        let scans: Int
        let signups: Int
        let first_workout: Int
        let active_week2: Int
        let plus: Int
        var id: String { "\(channel)-\(medium ?? "")-\(campaign ?? "")" }
    }

    private static let campaignLabels = [
        "como_funciona": "Reel «Cómo funciona»", "reel_scan": "Reel del scan", "reel_pov": "Reel POV",
        "carrusel_senales": "Carrusel «3 señales»", "carrusel_scan": "Carrusel del scan", "carrusel_plan": "Carrusel del plan",
        "destacadas": "Historias / destacadas",
    ]
    private static let mediumLabels = ["bio": "Bio", "post": "Publicación", "story": "Historia", "dm": "Mensaje", "referral": "Enlace"]

    private static let ranges: [(label: String, days: Int?)] = [("7 días", 7), ("30 días", 30), ("90 días", 90), ("Todo", nil)]
    private static let labels = [
        "tiktok": "TikTok", "instagram": "Instagram", "youtube": "YouTube", "threads": "Threads",
        "facebook": "Facebook", "otros": "Otras webs", "directo": "Directo / sin origen",
    ]

    @State private var range = 1
    @State private var funnel: Funnel?
    @State private var loading = true
    @State private var failed = false
    @State private var channelFilter: String?
    @State private var stageFilter: String?
    @State private var people: [Person] = []
    @State private var peopleTotal = 0
    @State private var peopleLoading = false
    @State private var peopleFailed = false
    @State private var campaigns: [Campaign]?

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
        .task(id: "\(range)-\(channelFilter ?? "")-\(stageFilter ?? "")") { await loadPeople(offset: 0) }
        .task(id: range) { await loadCampaigns() }
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
        funnelSteps(visits: tracking ? visits : nil, scans: tracking ? scans : nil, signups: signups,
                    firstWorkout: sum(\.firstWorkoutCount), active: active, plus: plus)
        Card {
            SectionTitle(title: "Por red")
            ForEach(Array(f.channels.enumerated()), id: \.element.id) { index, c in
                if index > 0 { Rectangle().fill(Palette.separator).frame(height: 0.5).accessibilityHidden(true) }
                channelRow(c, tracking: tracking)
            }
        }
        .opacity(loading ? 0.6 : 1)
        campaignsCard
        peopleCard
    }

    private var campaignsCard: some View {
        Card {
            SectionTitle(title: "Por publicación")
            Text("Qué trajo cada reel, carrusel, short, hilo o historia. Solo se sabe cuando el enlace es pulsable en la propia publicación (Facebook, YouTube, Threads, historias con enlace); en Instagram y TikTok cuenta como «Enlace de la bio».")
                .font(.apFootnote).foregroundStyle(Palette.muted)
                .fixedSize(horizontal: false, vertical: true)
            if let campaigns {
                if campaigns.isEmpty {
                    Text("Aún no hay visitas con enlace etiquetado en el rango.").font(.apSubhead).foregroundStyle(Palette.muted)
                        .frame(maxWidth: .infinity).padding(.vertical, 12)
                }
                ForEach(Array(campaigns.enumerated()), id: \.element.id) { index, c in
                    if index > 0 { Rectangle().fill(Palette.separator).frame(height: 0.5).accessibilityHidden(true) }
                    VStack(alignment: .leading, spacing: 4) {
                        HStack(alignment: .firstTextBaseline) {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(campaignTitle(c)).font(.apHeadline).lineLimit(1)
                                Text((Self.labels[c.channel] ?? c.channel) + (c.medium.map { " · " + (Self.mediumLabels[$0] ?? $0) } ?? ""))
                                    .font(.apFootnote).foregroundStyle(Palette.muted)
                            }
                            Spacer(minLength: 8)
                            Text("\(c.signups)").font(.apFigureSmall)
                            Text(c.signups == 1 ? "cuenta" : "cuentas").font(.apFootnote).foregroundStyle(Palette.muted)
                        }
                        Text("\(c.visits) visitas · \(c.scans) scans · \(c.first_workout) entrenaron · \(c.active_week2) activos 2ª sem. · \(c.plus) Plus")
                            .font(.apFootnote.monospacedDigit()).foregroundStyle(Palette.muted)
                    }
                    .padding(.vertical, 6)
                    .accessibilityElement(children: .combine)
                }
            } else {
                ProgressView().frame(maxWidth: .infinity).padding(.vertical, 8)
            }
        }
    }

    private func campaignTitle(_ c: Campaign) -> String {
        if let campaign = c.campaign { return Self.campaignLabels[campaign] ?? campaign }
        if c.medium == "bio" { return "Enlace de la bio" }
        return c.channel == "directo" ? "Sin enlace etiquetado" : "Sin publicación concreta"
    }

    private func loadCampaigns() async {
        let bounds = rangeBounds()
        campaigns = try? await Backend.client
            .rpc("admin_acquisition_campaigns", params: ["_from": bounds.from, "_to": bounds.to])
            .execute().value
    }

    /// Embudo completo con lo que se pierde entre cada paso.
    private func funnelSteps(visits: Int?, scans: Int?, signups: Int, firstWorkout: Int, active: Int, plus: Int) -> some View {
        let steps: [(String, Int?)] = [
            ("Visitas", visits), ("Scans", scans), ("Cuentas", signups),
            ("1er entreno", firstWorkout), ("Activos 2ª sem.", active), ("Plus", plus),
        ]
        return Card {
            SectionTitle(title: "Embudo")
            ForEach(Array(steps.enumerated()), id: \.offset) { index, step in
                if index > 0 { Rectangle().fill(Palette.separator).frame(height: 0.5).accessibilityHidden(true) }
                HStack(alignment: .firstTextBaseline) {
                    Text(step.0).font(.apBody)
                    Spacer(minLength: 8)
                    if index > 0, let value = step.1, let prev = steps[index - 1].1, prev > 0 {
                        let kept = Int((Double(value) / Double(prev) * 100).rounded())
                        Text("\(kept)% sigue · se pierde \(100 - kept)%")
                            .font(.apFootnote)
                            .foregroundStyle(kept < 30 ? Palette.destructive : Palette.muted)
                    }
                    Text(step.1.map(String.init) ?? "—").font(.apFigureSmall)
                }
                .padding(.vertical, 6)
                .accessibilityElement(children: .combine)
            }
            Text("Las visitas y los scans de quien no crea cuenta solo se cuentan: no se sigue a nadie sin cuenta. Persona a persona, abajo, solo cuentas.")
                .font(.apFootnote).foregroundStyle(Palette.muted)
                .fixedSize(horizontal: false, vertical: true)
        }
        .opacity(loading ? 0.6 : 1)
    }

    /// Cada cuenta del rango: de dónde vino y en qué paso se quedó.
    private var peopleCard: some View {
        Card {
            SectionTitle(title: "Personas")
            Text("De dónde vino cada cuenta y en qué paso del embudo se quedó.")
                .font(.apFootnote).foregroundStyle(Palette.muted)
            HStack(spacing: 8) {
                filterMenu(title: channelFilter.flatMap { Self.labels[$0] } ?? "Todas las redes",
                           options: Self.channelOrder.map { ($0, Self.labels[$0] ?? $0) }, allLabel: "Todas las redes",
                           selection: $channelFilter)
                filterMenu(title: Self.stages.first { $0.key == stageFilter }?.label ?? "Todos los pasos",
                           options: Self.stages.map { ($0.key, $0.label) }, allLabel: "Todos los pasos",
                           selection: $stageFilter)
            }
            if peopleFailed {
                Text("No se pudo cargar la lista.").font(.apFootnote).foregroundStyle(Palette.destructive)
            } else if !peopleLoading && people.isEmpty {
                Text("Nadie con estos filtros en el rango.").font(.apSubhead).foregroundStyle(Palette.muted)
                    .frame(maxWidth: .infinity).padding(.vertical, 12)
            }
            ForEach(Array(people.enumerated()), id: \.element.id) { index, p in
                if index > 0 { Rectangle().fill(Palette.separator).frame(height: 0.5).accessibilityHidden(true) }
                personRow(p)
            }
            if peopleLoading {
                ProgressView().frame(maxWidth: .infinity).padding(.vertical, 8)
            } else if people.count < peopleTotal {
                Button("Ver \(min(Self.pageSize, peopleTotal - people.count)) más de \(peopleTotal)") {
                    Task { await loadPeople(offset: people.count) }
                }
                .font(.apHeadline).foregroundStyle(Palette.gold)
                .frame(maxWidth: .infinity, minHeight: 44)
            }
        }
    }

    private func filterMenu(title: String, options: [(String, String)], allLabel: String, selection: Binding<String?>) -> some View {
        Menu {
            Button(allLabel) { selection.wrappedValue = nil }
            ForEach(options, id: \.0) { option in Button(option.1) { selection.wrappedValue = option.0 } }
        } label: {
            HStack(spacing: 6) {
                Text(title).font(.apSubhead).lineLimit(1)
                Image(systemName: "chevron.down").font(.apCaption)
            }
            .foregroundStyle(.white)
            .padding(.horizontal, 14).frame(minHeight: 44)
            .frame(maxWidth: .infinity)
            .background(Palette.secondary, in: Capsule())
        }
    }

    private func personRow(_ p: Person) -> some View {
        let stage = Self.stages.first { $0.key == p.stage }?.label ?? p.stage
        let reached = p.stage == "activo" || p.stage == "plus"
        var detail = Self.labels[p.channel] ?? p.channel
        if let m = p.medium { detail += " · \(m)" }
        if let c = p.campaign { detail += " · \(c)" }
        if let l = p.landing_path { detail += " · entró por \(l)" }
        detail += " · alta \(shortDay(p.signup_at))"
        if let w = p.last_workout { detail += " · último entreno \(shortDay(w))" }
        return VStack(alignment: .leading, spacing: 4) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(p.name ?? p.email ?? String(p.user_id.prefix(8))).font(.apHeadline).lineLimit(1)
                    if p.name != nil, let email = p.email { Text(email).font(.apFootnote).foregroundStyle(Palette.muted).lineLimit(1) }
                }
                Spacer(minLength: 8)
                Text(stage)
                    .font(.apCaption.weight(.medium))
                    .foregroundStyle(reached ? Palette.success : (p.stage == "entreno" ? Palette.gold : Palette.muted))
                    .padding(.horizontal, 8).padding(.vertical, 3)
                    .background((reached ? Palette.success : (p.stage == "entreno" ? Palette.gold : Palette.secondary)).opacity(reached || p.stage == "entreno" ? 0.15 : 1), in: Capsule())
            }
            Text(detail).font(.apFootnote).foregroundStyle(Palette.muted).fixedSize(horizontal: false, vertical: true)
        }
        .padding(.vertical, 6)
        .accessibilityElement(children: .combine)
    }

    private func shortDay(_ iso: String) -> String {
        let date = ISO8601DateFormatter.fractional.date(from: iso) ?? ISO8601DateFormatter().date(from: iso) ?? Self.dayFormatter.date(from: String(iso.prefix(10)))
        guard let date else { return "—" }
        return date.formatted(.dateTime.day().month(.abbreviated).locale(Locale(identifier: "es_ES")))
    }

    private static let dayFormatter: DateFormatter = {
        let day = DateFormatter()
        day.calendar = Calendar(identifier: .gregorian)
        day.locale = Locale(identifier: "en_US_POSIX")
        day.dateFormat = "yyyy-MM-dd"
        return day
    }()

    private func rangeBounds() -> (from: String, to: String) {
        let now = Date()
        if let days = Self.ranges[range].days,
           let start = Calendar.current.date(byAdding: .day, value: -(days - 1), to: now) {
            return (Self.dayFormatter.string(from: start), Self.dayFormatter.string(from: now))
        }
        return ("2024-01-01", Self.dayFormatter.string(from: now))
    }

    private func loadPeople(offset: Int) async {
        peopleLoading = true
        defer { peopleLoading = false }
        let bounds = rangeBounds()
        do {
            let page: People = try await Backend.client
                .rpc("admin_acquisition_users", params: PeopleParams(_from: bounds.from, _to: bounds.to, _channel: channelFilter,
                                                                     _stage: stageFilter, _limit: Self.pageSize, _offset: offset))
                .execute().value
            people = offset == 0 ? page.users : people + page.users
            peopleTotal = page.total
            peopleFailed = false
        } catch {
            peopleFailed = true
        }
    }

    private func channelRow(_ c: Channel, tracking: Bool) -> some View {
        let stats: [(String, String)] = [
            ("Visitas", tracking ? "\(c.visits)" : "—"),
            ("Scans", tracking ? "\(c.scans)" : "—"),
            ("1er entreno", "\(c.firstWorkoutCount)"),
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
