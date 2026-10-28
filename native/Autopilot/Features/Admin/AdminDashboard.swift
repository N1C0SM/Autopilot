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

// MARK: - Piezas compartidas del Admin

/// Cifra protagonista sobre negro (HeroFigure): etiqueta dorada, cifra enorme y contexto.
struct HeroFigure: View {
    let label: String; let value: String; var hint: String?
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label.uppercased())
                .font(.apCaption.weight(.semibold))
                .tracking(0.9)
                .foregroundStyle(Palette.gold)
            Text(value)
                .font(.inter(size: 48, weight: .bold).monospacedDigit())
                .tracking(-1)
                .lineLimit(1)
                .minimumScaleFactor(0.5)
            if let hint {
                Text(hint)
                    .font(.apFootnote)
                    .foregroundStyle(Palette.muted)
                    .lineLimit(2)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(label)
        .accessibilityValue([value, hint].compactMap { $0 }.joined(separator: ", "))
    }
}

/// Fila de cifras al estilo Salud, sin cajas y separadas por líneas finas (StatRow).
struct StatRow: View {
    let items: [(label: String, value: String, hint: String?)]

    var body: some View {
        HStack(alignment: .top, spacing: 0) {
            ForEach(Array(items.enumerated()), id: \.offset) { i, item in
                VStack(alignment: .leading, spacing: 2) {
                    Text(item.label)
                        .font(.apFootnote)
                        .foregroundStyle(Palette.muted)
                        .lineLimit(1)
                    Text(item.value)
                        .font(.apFigureSmall)
                        .lineLimit(1)
                        .minimumScaleFactor(0.55)
                    if let h = item.hint {
                        Text(h)
                            .font(.apFootnote)
                            .foregroundStyle(Palette.muted)
                            .lineLimit(1)
                            .minimumScaleFactor(0.8)
                    }
                }
                .padding(.vertical, 12)
                .padding(.leading, i > 0 ? 14 : 0)
                .padding(.trailing, 14)
                .frame(maxWidth: .infinity, alignment: .leading)
                .overlay(alignment: .leading) {
                    if i > 0 { Rectangle().fill(Palette.separator).frame(width: 0.5) }
                }
                .accessibilityElement(children: .ignore)
                .accessibilityLabel(item.label)
                .accessibilityValue([item.value, item.hint].compactMap { $0 }.joined(separator: ", "))
            }
        }
        .overlay(alignment: .top) { Rectangle().fill(Palette.separator).frame(height: 0.5) }
        .overlay(alignment: .bottom) { Rectangle().fill(Palette.separator).frame(height: 0.5) }
    }
}

/// Grupo de lista con cabecera (ListGroup): tarjeta del sistema con título pequeño en gris.
struct ListGroupView<Content: View>: View {
    let header: String
    @ViewBuilder var content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(header.uppercased())
                .font(.apFootnote.weight(.semibold))
                .tracking(0.6)
                .foregroundStyle(Palette.muted)
                .padding(.horizontal, 16)
                .accessibilityAddTraits(.isHeader)
            VStack(spacing: 0) { content }
                .background(Palette.card, in: RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
        }
    }
}

/// Aviso compacto cuando falla una actualización pero ya había datos en pantalla.
struct AdminKitRefreshWarning: View {
    var message = "No se han podido actualizar los datos."
    let retry: () -> Void

    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: "wifi.exclamationmark")
                .font(.inter(size: 15, weight: .semibold))
                .foregroundStyle(Palette.gold)
                .accessibilityHidden(true)
            Text(message)
                .font(.apFootnote)
                .foregroundStyle(Palette.muted)
                .fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: 8)
            Button {
                Haptics.tap()
                retry()
            } label: {
                Text("Reintentar")
                    .font(.apFootnote.weight(.semibold))
                    .foregroundStyle(Palette.gold)
                    .padding(.horizontal, 8)
                    .frame(minHeight: 44)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityHint("Vuelve a pedir los datos del panel")
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 6)
        .background(Palette.card, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
    }
}

/// Un solo pulso de opacidad por esqueleto (barato) y respeto por «Reducir movimiento».
struct AdminKitSkeletonPulse<Content: View>: View {
    @ViewBuilder var content: Content
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var dimmed = false

    var body: some View {
        content
            .opacity(dimmed ? 0.55 : 1)
            .animation(reduceMotion ? nil : .easeInOut(duration: 0.9).repeatForever(autoreverses: true), value: dimmed)
            .onAppear { if !reduceMotion { dimmed = true } }
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("Cargando")
    }
}

/// Bloque gris del esqueleto de carga.
struct AdminKitSkeletonBlock: View {
    var height: CGFloat
    var radius: CGFloat = 12
    var width: CGFloat? = nil

    var body: some View {
        RoundedRectangle(cornerRadius: radius, style: .continuous)
            .fill(Palette.secondary)
            .frame(width: width, height: height)
    }
}

/// Fila "Ver todos…" que cierra un grupo (texto dorado y chevron, 50 pt).
struct AdminKitMoreRow: View {
    let title: String
    var separator: Bool = true
    let action: () -> Void

    var body: some View {
        Button {
            Haptics.tap()
            action()
        } label: {
            HStack(spacing: 8) {
                Text(title).font(.apSubhead.weight(.semibold))
                Spacer(minLength: 8)
                Image(systemName: "chevron.right")
                    .font(.inter(size: 12, weight: .semibold))
            }
            .foregroundStyle(Palette.gold)
            .padding(.horizontal, 16)
            .frame(minHeight: 50)
            .overlay(alignment: .top) {
                if separator { Rectangle().fill(Palette.separator).frame(height: 0.5).padding(.leading, 16) }
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(title)
    }
}

// MARK: - Dashboard

/// Dashboard de Admin, calcado de la web: estimación mensual, Clientes/Plus/Coach,
/// «Requiere atención», «Usuarios recientes» y accesos al resto del panel.
struct AdminDashboardView: View {
    @StateObject private var data = AdminData()
    var onNavigate: (AppSection) -> Void = { _ in }

    private var recentUsers: [AdminData.Profile] {
        Array(data.clients.sorted { $0.created_at > $1.created_at }.prefix(5))
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                if !data.loaded {
                    skeleton
                } else if data.failed && data.clients.isEmpty {
                    AdminErrorCard(title: "No hemos podido cargar el panel",
                                   message: "Revisa la conexión y vuelve a intentarlo.") {
                        Task { await data.load() }
                    }
                } else {
                    if data.failed {
                        AdminKitRefreshWarning { Task { await data.load() } }
                    }
                    hero
                    Text(AdminData.estimateNote)
                        .font(.apFootnote)
                        .foregroundStyle(Palette.muted)
                        .fixedSize(horizontal: false, vertical: true)
                        .padding(.horizontal, 4)
                    if !data.clients.isEmpty { attention }
                    recent
                }
            }
            .padding(.horizontal, 20)
            .padding(.top, 4)
            .padding(.bottom, 28)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .screenBackground()
        .refreshable { await data.load() }
        .task { await data.load() }
        .onReceive(NotificationCenter.default.publisher(for: .refreshSection)) { _ in Task { await data.load() } }
    }

    // MARK: Cifras clave

    private var hero: some View {
        Card(padding: 20, radius: Radius.hero) {
            HStack(alignment: .top, spacing: 12) {
                HeroFigure(label: "Estimación mensual",
                           value: Euro.format(data.estimatedMonthly),
                           hint: "\(data.counts.plus) Plus · \(data.counts.coach) Coach activos")
                IconTile(symbol: "chart.line.uptrend.xyaxis", size: 40, tint: Palette.gold)
            }
            StatRow(items: [
                ("Clientes", "\(data.clients.count)", nil),
                ("Plus", "\(data.counts.plus)", nil),
                ("Coach", "\(data.counts.coach)", nil),
            ])
        }
    }

    // MARK: Requiere atención

    private var attention: some View {
        ListGroupView(header: "Requiere atención") {
            attentionRow("Planes pendientes", data.clients.filter { $0.plan_status == "plan_pending" }.count,
                         systemImage: "clock.badge.exclamationmark", tint: Palette.gold, first: true)
            attentionRow("Sin pagar", data.clients.filter { $0.payment_status == "unpaid" }.count,
                         systemImage: "creditcard.trianglebadge.exclamationmark", tint: Palette.destructive, danger: true)
            attentionRow("En viaje", data.clients.filter(\.traveling).count,
                         systemImage: "airplane", tint: Palette.gold)
            attentionRow("Nuevos (hoy)", data.clients.filter { $0.createdDate.map(Calendar.current.isDateInToday) ?? false }.count,
                         systemImage: "person.badge.plus", tint: Palette.gold)
        }
    }

    private func attentionRow(_ label: String, _ value: Int, systemImage: String,
                              tint: Color, danger: Bool = false, first: Bool = false) -> some View {
        Button {
            Haptics.selection()
            onNavigate(.adminUsers)
        } label: {
            HStack(spacing: 12) {
                IconTile(symbol: systemImage, size: 28, tint: value > 0 ? tint : Palette.muted)
                Text(label)
                    .font(.apBody)
                    .lineLimit(2)
                    .minimumScaleFactor(0.9)
                Spacer(minLength: 8)
                Text("\(value)")
                    .font(.inter(.body).weight(.semibold).monospacedDigit())
                    .foregroundStyle(value == 0 ? Palette.muted : (danger ? Palette.destructive : Palette.foreground))
                Image(systemName: "chevron.right")
                    .font(.inter(.footnote).weight(.semibold))
                    .foregroundStyle(Palette.muted)
            }
            .padding(.horizontal, 16)
            .frame(minHeight: 52)
            .overlay(alignment: .top) {
                if !first {
                    Rectangle().fill(Palette.separator).frame(height: 0.5).padding(.leading, 16 + 28 + 12)
                }
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
        .accessibilityValue("\(value)")
        .accessibilityHint("Abre la lista de usuarios")
    }

    // MARK: Usuarios recientes

    private var recent: some View {
        ListGroupView(header: "Usuarios recientes") {
            if recentUsers.isEmpty {
                EmptyStateView(symbol: "person.2", title: "Todavía no hay usuarios",
                               message: "Cuando alguien se registre aparecerá aquí.")
            } else {
                ForEach(Array(recentUsers.enumerated()), id: \.element.id) { i, u in
                    Button {
                        Haptics.tap()
                        onNavigate(.adminUsers)
                    } label: {
                        HStack(spacing: 12) {
                            AvatarView(name: u.display, url: u.avatar_url, size: 36)
                            VStack(alignment: .leading, spacing: 1) {
                                Text(u.display).font(.apBody).lineLimit(1).minimumScaleFactor(0.85)
                                Text(recentSubtitle(u))
                                    .font(.apFootnote)
                                    .foregroundStyle(Palette.muted)
                                    .lineLimit(1)
                            }
                            Spacer(minLength: 8)
                            PlanBadge(planStatus: u.plan_status, traveling: u.traveling)
                            PaymentDot(paid: u.payment_status == "paid")
                            Image(systemName: "chevron.right")
                                .font(.inter(.footnote).weight(.semibold))
                                .foregroundStyle(Palette.muted)
                        }
                        .padding(.horizontal, 16)
                        .frame(minHeight: 60)
                        .overlay(alignment: .top) {
                            if i > 0 { Rectangle().fill(Palette.separator).frame(height: 0.5).padding(.leading, 64) }
                        }
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityElement(children: .combine)
                    .accessibilityHint("Abre la lista de usuarios")
                }
                AdminKitMoreRow(title: "Ver todos los usuarios", separator: true) { onNavigate(.adminUsers) }
            }
        }
    }

    private func recentSubtitle(_ u: AdminData.Profile) -> String {
        let plan = switch u.plan {
        case "plus": "Plus"
        case "coach": "Coach"
        default: "Free"
        }
        let date = u.createdDate?.formatted(.dateTime.day().month(.abbreviated).locale(Locale(identifier: "es_ES"))) ?? ""
        return date.isEmpty ? plan : "\(plan) · Alta \(date)"
    }

    // MARK: Carga

    private var skeleton: some View {
        AdminKitSkeletonPulse {
            VStack(alignment: .leading, spacing: 24) {
                VStack(alignment: .leading, spacing: 12) {
                    AdminKitSkeletonBlock(height: 12, radius: 6, width: 156)
                    AdminKitSkeletonBlock(height: 50, radius: 10, width: 236)
                    HStack(spacing: 12) {
                        ForEach(0..<3, id: \.self) { _ in
                            AdminKitSkeletonBlock(height: 54, radius: 10).frame(maxWidth: .infinity)
                        }
                    }
                    AdminKitSkeletonBlock(height: 12, radius: 6, width: 268)
                }
                .padding(20)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Palette.card, in: RoundedRectangle(cornerRadius: Radius.hero, style: .continuous))
                AdminKitSkeletonBlock(height: 12, radius: 6, width: 132).padding(.horizontal, 16)
                AdminKitSkeletonBlock(height: 218, radius: Radius.card)
                AdminKitSkeletonBlock(height: 12, radius: 6, width: 160).padding(.horizontal, 16)
                AdminKitSkeletonBlock(height: 300, radius: Radius.card)
            }
        }
    }
}

struct PlanBadge: View {
    let planStatus: String?; let traveling: Bool
    var body: some View {
        let (label, color): (String, Color) = traveling ? ("En viaje", Palette.gold)
            : planStatus == "plan_ready" ? ("Plan listo", Palette.success)
            : planStatus == "plan_pending" ? ("Pendiente", Palette.gold) : ("Onboarding", Palette.muted)
        AdminStatusPill(text: label, tint: color)
    }
}

struct PaymentDot: View {
    let paid: Bool
    var body: some View {
        Circle()
            .fill(paid ? Palette.success : Palette.destructive)
            .frame(width: 8, height: 8)
            .accessibilityLabel(paid ? "pagado" : "sin pagar")
    }
}

// MARK: - Métricas (web)

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

    private var total: Int { data.clients.count }
    private var newUsers7: Int {
        let limit = Calendar.current.date(byAdding: .day, value: -6, to: Calendar.current.startOfDay(for: Date())) ?? .distantPast
        return data.clients.filter { ($0.createdDate ?? .distantPast) >= limit }.count
    }
    private var onboarded: Int { data.clients.filter { $0.plan_status == "plan_ready" }.count }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                header
                if !data.loaded {
                    skeleton
                } else if data.failed && data.clients.isEmpty {
                    AdminErrorCard(title: "No hemos podido cargar las métricas",
                                   message: "Revisa la conexión y vuelve a intentarlo.") {
                        Task { await load() }
                    }
                } else {
                    if data.failed {
                        AdminKitRefreshWarning { Task { await load() } }
                    }
                    figures
                    if total == 0 {
                        Card(padding: 8, radius: Radius.hero) {
                            EmptyStateView(symbol: "person.2", title: "Todavía no hay clientes",
                                           message: "En cuanto se registre alguien verás aquí el plan, el pago y la actividad.")
                        }
                    } else {
                        Text(AdminData.estimateNote)
                            .font(.apFootnote)
                            .foregroundStyle(Palette.muted)
                            .fixedSize(horizontal: false, vertical: true)
                            .padding(.horizontal, 4)
                    }
                    if emailsFailed > 0 { emailsCard }
                    breakdown
                }
            }
            .padding(.horizontal, 20)
            .padding(.top, 4)
            .padding(.bottom, 28)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .screenBackground()
        .task { await load() }
        .onReceive(NotificationCenter.default.publisher(for: .refreshSection)) { _ in Task { await load() } }
        .confirmationDialog("¿Resetear todas las métricas?", isPresented: $confirmReset, titleVisibility: .visible) {
            Button("Resetear", role: .destructive) {
                Task {
                    _ = try? await Backend.client.functions.invoke("admin-reset-metrics")
                    await load()
                }
            }
            Button("Cancelar", role: .cancel) {}
        } message: {
            Text("Se borran scans, leads, logs de emails, entrenos, pesos, PRs, fotos, chat, notificaciones y recordatorios. Las cuentas no se borran. No se puede deshacer.")
        }
    }

    private var header: some View {
        // Misma cabecera que el resto del Admin: contexto a la izquierda y acciones a la derecha.
        AdminPaneHeader("Planes y actividad de los clientes.") {
            HStack(spacing: 4) {
                Spacer(minLength: 0)
                AdminIconButton(symbol: "arrow.clockwise", label: "Actualizar métricas", tint: Palette.gold) {
                    Haptics.tap()
                    Task { await load() }
                }
                AdminIconButton(symbol: "trash", label: "Resetear métricas", tint: Palette.destructive) {
                    Haptics.warning()
                    confirmReset = true
                }
                .accessibilityHint("Borra los datos de prueba de la app; no borra las cuentas")
            }
        }
    }

    private var figures: some View {
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 170), spacing: 12)], spacing: 12) {
            FigureTile(label: "Estimación mensual", value: Euro.format(data.estimatedMonthly),
                       hint: "\(Euro.format(data.activePlans > 0 ? (data.estimatedMonthly / Double(data.activePlans)).rounded() : 0)) por plan", accent: true)
            FigureTile(label: "Plus y Coach", value: "\(data.activePlans)", hint: "\(pct(data.activePlans, total))% del total")
            FigureTile(label: "Clientes", value: "\(total)", hint: "+\(newUsers7) esta semana")
            FigureTile(label: "Activos 7 días", value: "\(pct(active7, total))%", hint: "\(active7) entrenando")
        }
    }

    private var emailsCard: some View {
        Card {
            HStack(alignment: .top, spacing: 14) {
                Image(systemName: "exclamationmark.circle")
                    .font(.inter(size: 22))
                    .foregroundStyle(Palette.destructive)
                    .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 2) {
                    Text("\(emailsFailed) emails fallidos").font(.apHeadline)
                    Text("En los últimos 30 días.").font(.apSubhead).foregroundStyle(Palette.muted)
                }
            }
            .accessibilityElement(children: .combine)
        }
    }

    private var breakdown: some View {
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 340), spacing: 12, alignment: .top)], spacing: 12) {
            Card {
                SectionTitle(title: "Clientes por plan")
                BarRowView(label: "Free · 0 €", value: data.counts.free, percent: pct(data.counts.free, total))
                BarRowView(label: "Plus · \(Euro.format(AdminData.price.plus))", value: data.counts.plus, percent: pct(data.counts.plus, total))
                BarRowView(label: "Coach · \(Euro.format(AdminData.price.coach))", value: data.counts.coach, percent: pct(data.counts.coach, total))
            }
            Card {
                SectionTitle(title: "Embudo")
                BarRowView(label: "Registrados", value: total, percent: pct(total, total))
                BarRowView(label: "Plan listo", value: onboarded, percent: pct(onboarded, total))
                BarRowView(label: "Activos 30 días", value: active30, percent: pct(active30, total))
                BarRowView(label: "Plus y Coach", value: data.activePlans, percent: pct(data.activePlans, total))
            }
            Card {
                SectionTitle(title: "Actividad")
                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], alignment: .leading, spacing: 18) {
                    mini("Entrenos hoy", workoutsToday); mini("Entrenos 7 días", workouts7)
                    mini("Series 7 días", sets7); mini("Récords 7 días", prs7)
                }
            }
            Card {
                HStack(alignment: .firstTextBaseline) {
                    SectionTitle(title: "Últimos 30 días")
                    Spacer(minLength: 8)
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
                    .chartXAxis { AxisMarks(values: .stride(by: 7)) { _ in AxisValueLabel().font(.inter(.caption2)) } }
                    .frame(height: 160)
                } else {
                    EmptyStateView(symbol: "chart.bar", title: "Sin actividad", message: "No hay entrenos ni registros en los últimos 30 días.")
                }
            }
        }
    }

    private var skeleton: some View {
        AdminKitSkeletonPulse {
            VStack(alignment: .leading, spacing: 20) {
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 170), spacing: 12)], spacing: 12) {
                    ForEach(0..<4, id: \.self) { _ in
                        AdminKitSkeletonBlock(height: 92, radius: Radius.card)
                    }
                }
                AdminKitSkeletonBlock(height: 12, radius: 6, width: 300)
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 340), spacing: 12)], spacing: 12) {
                    ForEach(0..<2, id: \.self) { _ in
                        AdminKitSkeletonBlock(height: 180, radius: Radius.card)
                    }
                }
            }
        }
    }

    private func pct(_ a: Int, _ b: Int) -> Int { b > 0 ? Int((Double(a) / Double(b) * 100).rounded()) : 0 }

    private func mini(_ label: String, _ value: Int) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label)
                .font(.apFootnote)
                .foregroundStyle(Palette.muted)
                .lineLimit(1)
                .minimumScaleFactor(0.8)
            Text("\(value)").font(.apFigureSmall)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(label)
        .accessibilityValue("\(value)")
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
        HStack(spacing: 5) {
            configuration.icon.font(.inter(size: 7))
            configuration.title.foregroundStyle(Palette.muted)
        }
    }
}
