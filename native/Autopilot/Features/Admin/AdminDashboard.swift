import SwiftUI
import Charts
import Supabase

/// Datos comunes de Admin, con las mismas reglas que la web: clientes = perfiles sin
/// administradores, entrenadores ni cuentas de prueba (`adminMetrics.ts`), y plan por
/// `getConsumerPlan` (`supabase/functions/_shared/entitlements.ts`).
@MainActor
final class AdminData: ObservableObject {
    struct Profile: Decodable, Identifiable {
        let user_id: String; let name: String?; let email: String?; let created_at: String
        let plan_status: String?; let payment_status: String?; let subscription_tier: String?
        let subscription_status: String?; let subscription_end: String?; let stripe_payment_id: String?
        let travel_mode_until: String?; let avatar_url: String?
        var id: String { user_id }
        var display: String { (name?.trimmingCharacters(in: .whitespaces)).flatMap { $0.isEmpty ? nil : $0 } ?? email ?? "?" }
        var createdDate: Date? { DateFormatter.ymd.date(from: String(created_at.prefix(10))) }
        var traveling: Bool {
            guard let t = travel_mode_until, let d = DateFormatter.ymd.date(from: String(t.prefix(10))) else { return false }
            return d >= Calendar.current.startOfDay(for: Date())
        }
        /// free / plus / coach.
        var plan: String {
            let plus = ["training", "plus"], coach = ["full", "transform", "personal", "coach"]
            let tier = subscription_tier ?? ""
            guard payment_status == "paid", (plus + coach).contains(tier) else { return "free" }
            if stripe_payment_id == nil {
                guard ["active", "trialing"].contains(subscription_status ?? "") else { return "free" }
                if let end = subscription_end, let d = ISO8601DateFormatter().date(from: end) ?? DateFormatter.ymd.date(from: String(end.prefix(10))), d <= Date() { return "free" }
            }
            return coach.contains(tier) ? "coach" : "plus"
        }
    }

    static let testEmails: Set<String> = ["nikosanmarcos4@gmail.com", "nicolassanmarcos4@gmail.com", "nicolasmr2026@gmail.com"]
    static let price = (plus: 14.99, coach: 49.0)
    static let estimateNote = "Estimación por tarifas de los planes activos, incluidas pruebas y accesos manuales. No representa cobros ni ingresos confirmados de Stripe. Solo se cuentan clientes; se excluyen administradores, entrenadores y tus cuentas de prueba."

    @Published var profiles: [Profile] = []
    @Published var clients: [Profile] = []
    @Published var loaded = false
    @Published var failed = false

    func load() async {
        struct R: Decodable { let user_id: String; let role: String }
        struct T: Decodable { let user_id: String }
        do {
            profiles = try await Backend.client.from("profiles")
                .select("user_id, name, email, created_at, plan_status, payment_status, subscription_tier, subscription_status, subscription_end, stripe_payment_id, travel_mode_until, avatar_url")
                .execute().value
            let roles: [R] = (try? await Backend.client.from("user_roles").select("user_id, role").in("role", values: ["admin", "trainer"]).execute().value) ?? []
            let tests: [T] = (try? await Backend.client.from("metrics_excluded_users").select("user_id").execute().value) ?? []
            let staff = Set(roles.map(\.user_id)).union(tests.map(\.user_id))
            clients = profiles.filter { !staff.contains($0.user_id) && !Self.testEmails.contains(($0.email ?? "").lowercased()) }
            failed = false
        } catch { failed = true }
        loaded = true
    }

    var counts: (free: Int, plus: Int, coach: Int) {
        var c = (free: 0, plus: 0, coach: 0)
        for p in clients { switch p.plan { case "plus": c.plus += 1; case "coach": c.coach += 1; default: c.free += 1 } }
        return c
    }
    var activePlans: Int { counts.plus + counts.coach }
    var estimatedMonthly: Double { Double(counts.plus) * Self.price.plus + Double(counts.coach) * Self.price.coach }
}

enum Euro {
    static func format(_ value: Double) -> String {
        value.formatted(.number.precision(.fractionLength(0...2)).locale(Locale(identifier: "es_ES"))) + " €"
    }
}

/// Cifra protagonista sobre negro (HeroFigure).
struct HeroFigure: View {
    let label: String; let value: String; var hint: String?
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label).font(.apSubhead).foregroundStyle(Palette.muted)
            Text(value).font(.system(size: 48, weight: .bold).monospacedDigit())
            if let hint { Text(hint).font(.apFootnote).foregroundStyle(Palette.muted) }
        }
        .accessibilityElement(children: .combine)
    }
}

/// Fila de cifras al estilo Salud, sin cajas y separadas por líneas finas (StatRow).
struct StatRow: View {
    let items: [(label: String, value: String, hint: String?)]
    var body: some View {
        HStack(spacing: 0) {
            ForEach(Array(items.enumerated()), id: \.offset) { i, item in
                VStack(alignment: .leading, spacing: 0) {
                    Text(item.label).font(.apFootnote).foregroundStyle(Palette.muted).lineLimit(1)
                    Text(item.value).font(.system(size: 28, weight: .bold).monospacedDigit()).lineLimit(1).minimumScaleFactor(0.6)
                    if let h = item.hint { Text(h).font(.apFootnote).foregroundStyle(Palette.muted).lineLimit(1) }
                }
                .padding(.vertical, 12).padding(.leading, i > 0 ? 12 : 0).padding(.trailing, 12)
                .frame(maxWidth: .infinity, alignment: .leading)
                .overlay(alignment: .leading) { if i > 0 { Rectangle().fill(Palette.separator).frame(width: 0.5) } }
                .accessibilityElement(children: .combine)
            }
        }
        .overlay(alignment: .top) { Rectangle().fill(Palette.separator).frame(height: 0.5) }
        .overlay(alignment: .bottom) { Rectangle().fill(Palette.separator).frame(height: 0.5) }
    }
}

/// Grupo de lista con cabecera (ListGroup).
struct ListGroupView<Content: View>: View {
    let header: String
    @ViewBuilder var content: Content
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(header.uppercased()).font(.apFootnote).foregroundStyle(Palette.muted).padding(.horizontal, 16)
            VStack(spacing: 0) { content }
                .background(Palette.card, in: RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
        }
    }
}

/// Dashboard de Admin, calcado de la web: estimación mensual, Clientes/Plus/Coach,
/// «Requiere atención» y «Usuarios recientes».
struct AdminDashboardView: View {
    @StateObject private var data = AdminData()
    var onNavigate: (AppSection) -> Void = { _ in }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 32) {
                VStack(alignment: .leading, spacing: 20) {
                    HeroFigure(label: "Estimación mensual", value: Euro.format(data.estimatedMonthly))
                    StatRow(items: [("Clientes", "\(data.clients.count)", nil), ("Plus", "\(data.counts.plus)", nil), ("Coach", "\(data.counts.coach)", nil)])
                        .frame(maxWidth: 672)
                    Text(AdminData.estimateNote).font(.apFootnote).foregroundStyle(Palette.muted)
                }
                ListGroupView(header: "Requiere atención") {
                    quick("Planes pendientes", data.clients.filter { $0.plan_status == "plan_pending" }.count, first: true)
                    quick("Sin pagar", data.clients.filter { $0.payment_status == "unpaid" }.count, danger: true)
                    quick("En viaje", data.clients.filter(\.traveling).count)
                    quick("Nuevos (hoy)", data.clients.filter { $0.createdDate.map(Calendar.current.isDateInToday) ?? false }.count)
                }
                if data.loaded && data.clients.isEmpty {
                    EmptyStateView(symbol: "person.2", title: "Todavía no hay usuarios", message: "Cuando alguien se registre aparecerá aquí.")
                } else {
                    ListGroupView(header: "Usuarios recientes") {
                        ForEach(Array(data.clients.sorted { $0.created_at > $1.created_at }.prefix(5).enumerated()), id: \.element.id) { i, u in
                            Button { onNavigate(.adminUsers) } label: {
                                HStack(spacing: 12) {
                                    Text(String(u.display.prefix(1)).uppercased()).font(.apSubhead.weight(.semibold)).foregroundStyle(Palette.muted)
                                        .frame(width: 36, height: 36).background(Palette.secondary, in: Circle())
                                    VStack(alignment: .leading, spacing: 1) {
                                        Text(u.display).font(.apBody).lineLimit(1)
                                        Text(u.createdDate?.formatted(.dateTime.day().month(.abbreviated).locale(Locale(identifier: "es_ES"))) ?? "")
                                            .font(.apFootnote).foregroundStyle(Palette.muted)
                                    }
                                    Spacer()
                                    PlanBadge(planStatus: u.plan_status, traveling: u.traveling)
                                    PaymentDot(paid: u.payment_status == "paid")
                                    Image(systemName: "chevron.right").font(.footnote.weight(.semibold)).foregroundStyle(Palette.muted)
                                }
                                .padding(.horizontal, 16).frame(minHeight: 56)
                                .overlay(alignment: .top) { if i > 0 { Rectangle().fill(Palette.separator).frame(height: 0.5).padding(.leading, 64) } }
                                .contentShape(Rectangle())
                            }
                            .buttonStyle(.plain)
                            .accessibilityElement(children: .combine)
                        }
                    }
                }
            }
            .padding(20)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .screenBackground()
        .task { await data.load() }
        .refreshable { await data.load() }
        .onReceive(NotificationCenter.default.publisher(for: .refreshSection)) { _ in Task { await data.load() } }
    }

    private func quick(_ label: String, _ value: Int, danger: Bool = false, first: Bool = false) -> some View {
        Button { onNavigate(.adminUsers) } label: {
            HStack {
                Text(label).font(.apBody)
                Spacer()
                Text("\(value)").font(.system(.body).weight(.semibold).monospacedDigit())
                    .foregroundStyle(danger && value > 0 ? Palette.destructive : Palette.foreground)
                Image(systemName: "chevron.right").font(.footnote.weight(.semibold)).foregroundStyle(Palette.muted)
            }
            .padding(.horizontal, 16).frame(minHeight: 50)
            .overlay(alignment: .top) { if !first { Rectangle().fill(Palette.separator).frame(height: 0.5).padding(.leading, 16) } }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}

struct PlanBadge: View {
    let planStatus: String?; let traveling: Bool
    var body: some View {
        let (label, color): (String, Color) = traveling ? ("En viaje", Palette.gold)
            : planStatus == "plan_ready" ? ("Plan listo", .green)
            : planStatus == "plan_pending" ? ("Pendiente", Palette.gold) : ("Onboarding", Palette.muted)
        Text(label).font(.caption.weight(.medium)).padding(.horizontal, 8).padding(.vertical, 2)
            .foregroundStyle(color).background(color.opacity(0.15), in: Capsule())
    }
}

struct PaymentDot: View {
    let paid: Bool
    var body: some View {
        Circle().fill(paid ? Color.green : Palette.destructive).frame(width: 8, height: 8)
            .accessibilityLabel(paid ? "pagado" : "sin pagar")
    }
}

/// Métricas de Admin, calcadas de `AdminMetrics.tsx`: cuatro cifras clave, nota, emails fallidos,
/// Clientes por plan, Embudo, Actividad y Últimos 30 días.
struct AdminMetricsWebView: View {
    @StateObject private var data = AdminData()
    @State private var active7 = 0
    @State private var active30 = 0
    @State private var workoutsToday = 0
    @State private var workouts7 = 0
    @State private var sets7 = 0
    @State private var prs7 = 0
    @State private var emailsFailed = 0
    @State private var daily: [(d: String, entrenos: Int, registros: Int)] = []
    @State private var confirmReset = false

    var body: some View {
        let total = data.clients.count
        let newUsers7 = data.clients.filter { ($0.createdDate ?? .distantPast) >= Calendar.current.date(byAdding: .day, value: -6, to: Calendar.current.startOfDay(for: Date()))! }.count
        let onboarded = data.clients.filter { $0.plan_status == "plan_ready" }.count
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                HStack {
                    Text("Planes y actividad de los clientes.").font(.apSubhead).foregroundStyle(Palette.muted)
                    Spacer()
                    Button { Task { await load() } } label: { Image(systemName: "arrow.clockwise").font(.title3).foregroundStyle(Palette.gold) }
                        .buttonStyle(.plain).frame(width: 44, height: 44).accessibilityLabel("Actualizar")
                    Button { Haptics.warning(); confirmReset = true } label: { Image(systemName: "trash").font(.title3).foregroundStyle(Palette.destructive) }
                        .buttonStyle(.plain).frame(width: 44, height: 44).accessibilityLabel("Resetear métricas")
                }
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 170), spacing: 12)], spacing: 12) {
                    FigureTile(label: "Estimación mensual", value: Euro.format(data.estimatedMonthly),
                               hint: "\(Euro.format(data.activePlans > 0 ? (data.estimatedMonthly / Double(data.activePlans)).rounded() : 0)) por plan", accent: true)
                    FigureTile(label: "Plus y Coach", value: "\(data.activePlans)", hint: "\(pct(data.activePlans, total))% del total")
                    FigureTile(label: "Clientes", value: "\(total)", hint: "+\(newUsers7) esta semana")
                    FigureTile(label: "Activos 7 días", value: "\(pct(active7, total))%", hint: "\(active7) entrenando")
                }
                Text(AdminData.estimateNote).font(.apFootnote).foregroundStyle(Palette.muted).padding(.horizontal, 4)
                if emailsFailed > 0 {
                    Card {
                        HStack(alignment: .top, spacing: 14) {
                            Image(systemName: "exclamationmark.circle").font(.title2).foregroundStyle(Palette.destructive)
                            VStack(alignment: .leading) {
                                Text("\(emailsFailed) emails fallidos").font(.apHeadline)
                                Text("En los últimos 30 días.").font(.apSubhead).foregroundStyle(Palette.muted)
                            }
                        }
                    }
                }
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 340), spacing: 12, alignment: .top)], spacing: 12) {
                    Card {
                        Text("Clientes por plan").font(.apHeadline)
                        BarRowView(label: "Free · 0 €", value: data.counts.free, percent: pct(data.counts.free, total))
                        BarRowView(label: "Plus · \(Euro.format(AdminData.price.plus))", value: data.counts.plus, percent: pct(data.counts.plus, total))
                        BarRowView(label: "Coach · \(Euro.format(AdminData.price.coach))", value: data.counts.coach, percent: pct(data.counts.coach, total))
                    }
                    Card {
                        Text("Embudo").font(.apHeadline)
                        BarRowView(label: "Registrados", value: total, percent: pct(total, total))
                        BarRowView(label: "Plan listo", value: onboarded, percent: pct(onboarded, total))
                        BarRowView(label: "Activos 30 días", value: active30, percent: pct(active30, total))
                        BarRowView(label: "Plus y Coach", value: data.activePlans, percent: pct(data.activePlans, total))
                    }
                    Card {
                        Text("Actividad").font(.apHeadline)
                        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], alignment: .leading, spacing: 18) {
                            mini("Entrenos hoy", workoutsToday); mini("Entrenos 7 días", workouts7)
                            mini("Series 7 días", sets7); mini("Récords 7 días", prs7)
                        }
                    }
                    Card {
                        HStack {
                            Text("Últimos 30 días").font(.apHeadline)
                            Spacer()
                            Label("Entrenos", systemImage: "circle.fill").font(.apFootnote).foregroundStyle(Palette.gold)
                            Label("Registros", systemImage: "circle.fill").font(.apFootnote).foregroundStyle(Palette.muted)
                        }
                        .labelStyle(DotLabel())
                        if daily.contains(where: { $0.entrenos > 0 || $0.registros > 0 }) {
                            Chart {
                                ForEach(daily, id: \.d) { day in
                                    AreaMark(x: .value("Día", day.d), y: .value("Entrenos", day.entrenos)).foregroundStyle(Palette.gold.opacity(0.15))
                                    LineMark(x: .value("Día", day.d), y: .value("Entrenos", day.entrenos), series: .value("s", "e")).foregroundStyle(Palette.gold)
                                    LineMark(x: .value("Día", day.d), y: .value("Registros", day.registros), series: .value("s", "r")).foregroundStyle(Palette.muted)
                                }
                            }
                            .chartYAxis(.hidden)
                            .chartXAxis { AxisMarks(values: .stride(by: 7)) { _ in AxisValueLabel().font(.caption2) } }
                            .frame(height: 160)
                        } else {
                            EmptyStateView(symbol: "chart.bar", title: "Sin actividad", message: "No hay entrenos ni registros en los últimos 30 días.")
                        }
                    }
                }
            }
            .padding(20)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .screenBackground()
        .task { await load() }
        .onReceive(NotificationCenter.default.publisher(for: .refreshSection)) { _ in Task { await load() } }
        .confirmationDialog("¿Resetear todas las métricas?", isPresented: $confirmReset, titleVisibility: .visible) {
            Button("Resetear", role: .destructive) { Task { _ = try? await Backend.client.functions.invoke("admin-reset-metrics"); await load() } }
            Button("Cancelar", role: .cancel) {}
        } message: {
            Text("Se borran scans, leads, logs de emails, entrenos, pesos, PRs, fotos, chat, notificaciones y recordatorios. Las cuentas no se borran. No se puede deshacer.")
        }
    }

    private func pct(_ a: Int, _ b: Int) -> Int { b > 0 ? Int((Double(a) / Double(b) * 100).rounded()) : 0 }

    private func mini(_ label: String, _ value: Int) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label).font(.apFootnote).foregroundStyle(Palette.muted).lineLimit(1)
            Text("\(value)").font(.system(size: 28, weight: .bold).monospacedDigit())
        }
        .accessibilityElement(children: .combine)
    }

    private func load() async {
        await data.load()
        let clientIds = Set(data.clients.map(\.user_id))
        struct C: Decodable { let user_id: String; let completed_at: String }
        struct L: Decodable { let user_id: String; let sets_completed: [SetLog]? }
        struct P: Decodable { let user_id: String }
        struct E: Decodable { let status: String?; let message_id: String?; let created_at: String }
        let today = LocalDate.string(), d7 = LocalDate.daysAgo(6), d30 = LocalDate.daysAgo(29)
        let comps: [C] = ((try? await Backend.client.from("day_completions").select("user_id, completed_at").gte("completed_at", value: d30).execute().value) ?? [])
            .filter { clientIds.contains($0.user_id) }
        let logs: [L] = ((try? await Backend.client.from("workout_logs").select("user_id, sets_completed").gte("logged_at", value: d7).execute().value) ?? [])
            .filter { clientIds.contains($0.user_id) }
        let prs: [P] = ((try? await Backend.client.from("personal_records").select("user_id").gte("achieved_at", value: d7).execute().value) ?? [])
            .filter { clientIds.contains($0.user_id) }
        let emails: [E] = (try? await Backend.client.from("email_send_log").select("status, message_id, created_at")
            .gte("created_at", value: ISO8601DateFormatter().string(from: Calendar.current.date(byAdding: .day, value: -30, to: Date())!)).execute().value) ?? []
        active7 = Set(comps.filter { $0.completed_at >= d7 }.map(\.user_id)).count
        active30 = Set(comps.map(\.user_id)).count
        workoutsToday = comps.filter { $0.completed_at == today }.count
        workouts7 = comps.filter { $0.completed_at >= d7 }.count
        sets7 = logs.reduce(0) { $0 + ($1.sets_completed ?? []).filter { $0.done && $0.isWarmup != true }.count }
        prs7 = prs.count
        var latest: [String: E] = [:]
        for e in emails { guard let id = e.message_id else { continue }; if (latest[id]?.created_at ?? "") < e.created_at { latest[id] = e } }
        emailsFailed = latest.values.filter { $0.status == "dlq" || $0.status == "failed" }.count
        daily = (0..<30).reversed().map { i in
            let k = LocalDate.daysAgo(i)
            return (String(k.suffix(2)), comps.filter { $0.completed_at == k }.count, data.clients.filter { String($0.created_at.prefix(10)) == k }.count)
        }
    }
}

struct DotLabel: LabelStyle {
    func makeBody(configuration: Configuration) -> some View {
        HStack(spacing: 5) { configuration.icon.font(.system(size: 7)); configuration.title.foregroundStyle(Palette.muted) }
    }
}
