import SwiftUI
import Supabase

/// Perfil de cliente para las métricas de Admin.
struct AdminProfile: Decodable, Identifiable {
    let user_id: String
    let name: String?
    let email: String?
    let created_at: String
    let plan_status: String?
    let subscription_tier: String?
    var id: String { user_id }

    /// "training" = Plus; "full"/"transform"/"personal" = Coach (como en la web).
    var plan: String {
        switch subscription_tier {
        case "training", "plus": "Plus"
        case "full", "transform", "personal", "coach": "Coach"
        default: "Free"
        }
    }
}

/// Métricas de Admin: cifras clave y bloques en tarjetas.
struct AdminMetricsView: View {
    @State private var users: [AdminProfile] = []
    @State private var active7 = 0
    @State private var workouts7 = 0
    @State private var loading = true
    @State private var failed = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                if loading {
                    skeleton
                } else if failed && users.isEmpty {
                    AdminErrorCard(title: "No hemos podido cargar las métricas",
                                   message: "Revisa la conexión y vuelve a intentarlo.") {
                        Task { await load() }
                    }
                } else {
                    if failed { AdminKitRefreshWarning { Task { await load() } } }
                    content
                }
            }
            .padding(.horizontal, 20)
            .padding(.top, 4)
            .padding(.bottom, 28)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .screenBackground()
        .refreshable { await load() }
        .task { await load() }
    }

    private var content: some View {
        let total = users.count
        let paid = users.filter { $0.plan != "Free" }.count
        return VStack(alignment: .leading, spacing: 20) {
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 170), spacing: 12)], spacing: 12) {
                FigureTile(label: "Clientes", value: "\(total)", hint: "Sin entrenadores ni pruebas", accent: true)
                FigureTile(label: "Plus y Coach", value: "\(paid)", hint: "\(pct(paid, total))% del total")
                FigureTile(label: "Activos 7 días", value: "\(pct(active7, total))%", hint: "\(active7) entrenando")
                FigureTile(label: "Entrenos 7 días", value: "\(workouts7)")
            }
            if total == 0 {
                Card(padding: 8, radius: Radius.hero) {
                    EmptyStateView(symbol: "chart.bar", title: "Todavía no hay clientes",
                                   message: "En cuanto se registre alguien verás aquí el plan y la actividad.")
                }
            } else {
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 320), spacing: 12, alignment: .top)], spacing: 12) {
                    Card {
                        SectionTitle(title: "Clientes por plan")
                        ForEach(["Free", "Plus", "Coach"], id: \.self) { plan in
                            let n = users.filter { $0.plan == plan }.count
                            BarRowView(label: plan, value: n, percent: pct(n, total))
                        }
                    }
                    Card {
                        SectionTitle(title: "Embudo")
                        BarRowView(label: "Registrados", value: total, percent: 100)
                        let ready = users.filter { $0.plan_status == "plan_ready" }.count
                        BarRowView(label: "Plan listo", value: ready, percent: pct(ready, total))
                        BarRowView(label: "Plus y Coach", value: paid, percent: pct(paid, total))
                    }
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
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 320), spacing: 12)], spacing: 12) {
                    ForEach(0..<2, id: \.self) { _ in
                        AdminKitSkeletonBlock(height: 172, radius: Radius.card)
                    }
                }
            }
        }
    }

    private func pct(_ a: Int, _ b: Int) -> Int { b > 0 ? Int((Double(a) / Double(b) * 100).rounded()) : 0 }

    private func load() async {
        struct C: Decodable { let user_id: String }
        do {
            users = try await Backend.client.from("profiles")
                .select("user_id, name, email, created_at, plan_status, subscription_tier")
                .execute().value
            failed = false
        } catch {
            failed = true
        }
        let comps: [C] = (try? await Backend.client.from("day_completions").select("user_id")
            .gte("completed_at", value: LocalDate.daysAgo(6)).execute().value) ?? []
        workouts7 = comps.count
        active7 = Set(comps.map(\.user_id)).count
        loading = false
    }
}

/// Barra de proporción con etiqueta, valor y porcentaje (como las barras de la web).
struct BarRowView: View {
    let label: String
    let value: Int
    let percent: Int

    private var clamped: Double { Double(max(0, min(100, percent))) / 100 }

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Text(label)
                    .font(.apSubhead)
                    .lineLimit(1)
                    .minimumScaleFactor(0.85)
                Spacer(minLength: 8)
                Text("\(value)")
                    .font(.apSubhead.weight(.semibold).monospacedDigit())
                    .lineLimit(1)
                Text("\(percent)%")
                    .font(.apFootnote.monospacedDigit())
                    .foregroundStyle(Palette.muted)
                    .frame(minWidth: 40, alignment: .trailing)
            }
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Capsule().fill(Palette.secondary)
                    Capsule()
                        .fill(Palette.gold)
                        .frame(width: max(geo.size.width * clamped, clamped > 0 ? 4 : 0))
                }
            }
            .frame(height: 6)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(label)
        .accessibilityValue("\(value), \(percent) por ciento")
    }
}

/// Usuarios, calcado de `UserList.tsx`: recuento, buscador, filtros en chips y grupos
/// Clientes · Entrenadores · Administradores con estado del plan y punto de pago.
struct AdminUsersView: View {
    struct Row: Decodable, Identifiable {
        let user_id: String; let name: String?; let email: String?; let created_at: String
        let plan_status: String?; let payment_status: String?; let avatar_url: String?
        let travel_mode_until: String?; let subscription_tier: String?
        var id: String { user_id }
        var display: String { (name?.trimmingCharacters(in: .whitespaces)).flatMap { $0.isEmpty ? nil : $0 } ?? email ?? "?" }
        var traveling: Bool {
            guard let t = travel_mode_until, let d = ISO8601DateFormatter().date(from: t) ?? DateFormatter.ymd.date(from: String(t.prefix(10))) else { return false }
            return d >= Date()
        }
        /// free / plus / coach, con las mismas reglas que el resto del Admin.
        var plan: String {
            switch subscription_tier {
            case "training", "plus": "Plus"
            case "full", "transform", "personal", "coach": "Coach"
            default: "Free"
            }
        }
    }
    struct RoleRow: Decodable { let user_id: String; let role: String }

    @State private var users: [Row] = []
    @State private var admins: Set<String> = []
    @State private var trainers: Set<String> = []
    @State private var query = ""
    @State private var filter = "all"
    @State private var loaded = false
    @State private var failed = false
    @State private var rolesFailed = false

    private static let filters = [("all", "Todos"), ("paid", "Pagados"), ("unpaid", "Sin pagar"), ("plan_pending", "Plan pendiente"), ("plan_ready", "Plan listo"), ("traveling", "En viaje")]

    private var filtering: Bool {
        filter != "all" || !query.trimmingCharacters(in: .whitespaces).isEmpty
    }

    private func matches(_ u: Row) -> Bool {
        let fold = { (s: String) in s.folding(options: [.diacriticInsensitive, .caseInsensitive], locale: Locale(identifier: "es")) }
        let hay = fold("\(u.name ?? "") \(u.email ?? "") \(u.created_at.prefix(10))")
        let ok = fold(query).split(separator: " ").allSatisfy { hay.contains($0) }
        switch filter {
        case "all": return ok
        case "paid": return ok && u.payment_status == "paid"
        case "unpaid": return ok && u.payment_status == "unpaid"
        case "traveling": return ok && u.traveling
        default: return ok && u.plan_status == filter
        }
    }

    var body: some View {
        let clients = users.filter { !admins.contains($0.user_id) && !trainers.contains($0.user_id) && matches($0) }
        let trainerRows = users.filter { trainers.contains($0.user_id) && !admins.contains($0.user_id) && matches($0) }
        let adminRows = users.filter { admins.contains($0.user_id) && matches($0) }
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                summary
                searchField
                filterChips
                if !loaded {
                    skeleton
                } else if failed && users.isEmpty {
                    AdminErrorCard(title: "No hemos podido cargar los usuarios",
                                   message: "Revisa la conexión y vuelve a intentarlo.") {
                        Task { await load() }
                    }
                } else if clients.isEmpty && trainerRows.isEmpty && adminRows.isEmpty {
                    Card(padding: 8, radius: Radius.hero) {
                        EmptyStateView(symbol: filtering ? "line.3.horizontal.decrease.circle" : "person.2",
                                       title: filtering ? "Sin resultados" : "Todavía no hay usuarios",
                                       message: filtering ? "Prueba con otro nombre o quita los filtros." : "Cuando alguien se registre aparecerá aquí.")
                    }
                } else {
                    if failed { AdminKitRefreshWarning { Task { await load() } } }
                    if rolesFailed {
                        AdminKitRefreshWarning(message: "No hemos podido cargar los roles; puede que falten entrenadores o administradores.") {
                            Task { await load() }
                        }
                    }
                    if !clients.isEmpty { group("Clientes (\(clients.count))", clients, kind: "user") }
                    if !trainerRows.isEmpty { group("Entrenadores (\(trainerRows.count))", trainerRows, kind: "trainer") }
                    if !adminRows.isEmpty { group("Administradores (\(adminRows.count))", adminRows, kind: "admin") }
                }
            }
            .padding(.horizontal, 20)
            .padding(.top, 4)
            .padding(.bottom, 28)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .scrollDismissesKeyboard(.interactively)
        .screenBackground()
        .task { await load() }
        .refreshable { await load() }
    }

    // MARK: Cabecera y filtros

    private var summary: some View {
        (Text("\(users.count)").fontWeight(.semibold).foregroundColor(Palette.foreground)
         + Text(" personas · ").foregroundColor(Palette.muted)
         + Text("\(trainers.count)").fontWeight(.semibold).foregroundColor(Palette.foreground)
         + Text(" entrenadores · ").foregroundColor(Palette.muted)
         + Text("\(admins.count)").fontWeight(.semibold).foregroundColor(Palette.foreground)
         + Text(" admin").foregroundColor(Palette.muted))
        .font(.apSubhead.monospacedDigit())
        .fixedSize(horizontal: false, vertical: true)
        .accessibilityLabel("\(users.count) personas, \(trainers.count) entrenadores y \(admins.count) administradores")
    }

    private var searchField: some View {
        HStack(spacing: 10) {
            Image(systemName: "magnifyingglass")
                .font(.inter(size: 15, weight: .semibold))
                .foregroundStyle(Palette.muted)
                .accessibilityHidden(true)
            TextField("Buscar por nombre o email…", text: $query)
                .textFieldStyle(.plain)
                .font(.apBody)
                .submitLabel(.search)
                .autocorrectionDisabled()
                .accessibilityLabel("Buscar usuario")
            if !query.isEmpty {
                Button {
                    Haptics.tap()
                    query = ""
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .font(.inter(size: 16))
                        .foregroundStyle(Palette.muted)
                        .frame(width: 44, height: 44)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Borrar búsqueda")
            }
        }
        .padding(.leading, 20)
        .padding(.trailing, query.isEmpty ? 20 : 8)
        .frame(minHeight: 52)
        .background(Palette.secondary, in: Capsule())
        .frame(maxWidth: 420)
    }

    private var filterChips: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(Self.filters, id: \.0) { key, label in
                    Button {
                        Haptics.selection()
                        filter = key
                    } label: {
                        Text(label)
                            .font(.apSubhead.weight(.medium))
                            .lineLimit(1)
                            .padding(.horizontal, 14)
                            .frame(minHeight: 44)
                            .foregroundStyle(filter == key ? Color.black : Palette.foreground)
                            .background(filter == key ? Palette.gold : Palette.secondary, in: Capsule())
                    }
                    .buttonStyle(.plain)
                    .accessibilityAddTraits(filter == key ? .isSelected : [])
                    .accessibilityHint("Filtra la lista de usuarios")
                }
            }
            .padding(.vertical, 2)
        }
        .accessibilityLabel("Filtros de usuarios")
    }

    // MARK: Grupos

    private func group(_ title: String, _ rows: [Row], kind: String) -> some View {
        ListGroupView(header: title) {
            ForEach(Array(rows.enumerated()), id: \.element.id) { i, u in
                NavigationLink {
                    AdminUserFullDetail(userId: u.user_id, display: u.display, email: u.email ?? "")
                        .navigationTitle(u.display)
                } label: {
                    rowLabel(u, kind: kind, first: i == 0)
                }
                .buttonStyle(.plain)
                .accessibilityElement(children: .combine)
                .accessibilityHint("Abre la ficha de \(u.display)")
            }
        }
    }

    private func rowLabel(_ u: Row, kind: String, first: Bool) -> some View {
        HStack(spacing: 12) {
            AvatarView(name: u.display, url: u.avatar_url, size: 36)
            VStack(alignment: .leading, spacing: 1) {
                Text(u.display).font(.apBody).lineLimit(1).minimumScaleFactor(0.85)
                Text(meta(u, kind))
                    .font(.apFootnote)
                    .foregroundStyle(Palette.muted)
                    .lineLimit(1)
            }
            Spacer(minLength: 8)
            if kind == "user" {
                PlanBadge(planStatus: u.plan_status, traveling: u.traveling)
                PaymentDot(paid: u.payment_status == "paid")
            }
            Image(systemName: "chevron.right")
                .font(.inter(.footnote).weight(.semibold))
                .foregroundStyle(Palette.muted)
        }
        .padding(.horizontal, 16)
        .frame(minHeight: 64)
        .overlay(alignment: .top) {
            if !first { Rectangle().fill(Palette.separator).frame(height: 0.5).padding(.leading, 64) }
        }
        .contentShape(Rectangle())
    }

    private func meta(_ u: Row, _ kind: String) -> String {
        if kind == "admin" || kind == "trainer" {
            let base = kind == "admin" ? "Administrador" : "Entrenador"
            let hasName = !(u.name ?? "").trimmingCharacters(in: .whitespaces).isEmpty
            if hasName, let email = u.email, !email.isEmpty { return "\(base) · \(email)" }
            return base
        }
        let hasName = !(u.name ?? "").trimmingCharacters(in: .whitespaces).isEmpty
        if hasName, let email = u.email, !email.isEmpty { return "\(u.plan) · \(email)" }
        let date = DateFormatter.ymd.date(from: String(u.created_at.prefix(10)))
            .map { $0.formatted(.dateTime.day().month(.abbreviated).year().locale(Locale(identifier: "es_ES"))) } ?? ""
        return date.isEmpty ? u.plan : "\(u.plan) · Alta \(date)"
    }

    private var skeleton: some View {
        AdminKitSkeletonPulse {
            VStack(alignment: .leading, spacing: 14) {
                AdminKitSkeletonBlock(height: 12, radius: 6, width: 240).padding(.horizontal, 16)
                ForEach(0..<3, id: \.self) { groupIndex in
                    VStack(spacing: 0) {
                        ForEach(0..<4, id: \.self) { i in
                            HStack(spacing: 12) {
                                AdminKitSkeletonBlock(height: 36, radius: 18, width: 36)
                                VStack(alignment: .leading, spacing: 5) {
                                    AdminKitSkeletonBlock(height: 12, radius: 6, width: 132)
                                    AdminKitSkeletonBlock(height: 10, radius: 5, width: 188)
                                }
                                Spacer(minLength: 8)
                                AdminKitSkeletonBlock(height: 16, radius: 8, width: 56)
                            }
                            .padding(.horizontal, 16)
                            .frame(minHeight: 64)
                            .overlay(alignment: .top) {
                                if i > 0 { Rectangle().fill(Palette.separator).frame(height: 0.5).padding(.leading, 64) }
                            }
                        }
                    }
                    .background(Palette.card, in: RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
                    if groupIndex < 2 { Spacer().frame(height: 2) }
                }
            }
        }
    }

    private func load() async {
        do {
            users = try await Backend.client.from("profiles")
                .select("user_id, name, email, created_at, plan_status, payment_status, avatar_url, travel_mode_until, subscription_tier")
                .order("created_at", ascending: false).execute().value
            failed = false
        } catch {
            failed = true
        }
        do {
            let roles: [RoleRow] = try await Backend.client.from("user_roles").select("user_id, role").in("role", values: ["admin", "trainer"]).execute().value
            admins = Set(roles.filter { $0.role == "admin" }.map(\.user_id))
            trainers = Set(roles.filter { $0.role == "trainer" }.map(\.user_id))
            rolesFailed = false
        } catch {
            rolesFailed = true
        }
        loaded = true
    }
}

/// Ficha de usuario (resumen): datos, plan y pago.
struct AdminUserDetail: View {
    let user: AdminUsersView.Row

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                HStack(spacing: 16) {
                    AvatarView(name: user.display, url: user.avatar_url, size: 64)
                    VStack(alignment: .leading, spacing: 3) {
                        Text(user.display).font(.apTitle2).lineLimit(2).minimumScaleFactor(0.8)
                        if let email = user.email, !email.isEmpty {
                            Text(email).font(.apSubhead).foregroundStyle(Palette.muted).lineLimit(1).truncationMode(.middle)
                        }
                        PlanBadge(planStatus: user.plan_status, traveling: user.traveling)
                    }
                    Spacer(minLength: 0)
                }
                .accessibilityElement(children: .combine)

                ListGroupView(header: "Detalle") {
                    detailRow("Estado del plan", planStatusText, first: true)
                    detailRow("Pago", user.payment_status == "paid" ? "Pagado" : "Sin pagar")
                    detailRow("Plan", user.plan)
                    detailRow("Alta", String(user.created_at.prefix(10)))
                }
            }
            .padding(.horizontal, 20)
            .padding(.top, 4)
            .padding(.bottom, 28)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .screenBackground()
    }

    private var planStatusText: String {
        ["plan_ready": "Plan listo", "plan_pending": "Pendiente"][user.plan_status ?? ""] ?? "Onboarding"
    }

    private func detailRow(_ label: String, _ value: String, first: Bool = false) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 12) {
            Text(label).font(.apBody)
            Spacer(minLength: 12)
            Text(value)
                .font(.apBody)
                .foregroundStyle(Palette.muted)
                .multilineTextAlignment(.trailing)
                .lineLimit(2)
                .minimumScaleFactor(0.85)
        }
        .padding(.horizontal, 16)
        .frame(minHeight: 50)
        .overlay(alignment: .top) {
            if !first { Rectangle().fill(Palette.separator).frame(height: 0.5).padding(.leading, 16) }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(label)
        .accessibilityValue(value)
    }
}

extension DateFormatter {
    static let ymd: DateFormatter = { let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"; f.locale = Locale(identifier: "en_US_POSIX"); return f }()
}

/// Secciones de edición de Admin que aún no son nativas: se abren en la web de Admin.
struct AdminWebSectionView: View {
    let section: AppSection
    @Environment(\.openURL) private var openURL

    private var webURL: URL? {
        let webSection = String(section.rawValue.dropFirst(5)).lowercased()
        return URL(string: "https://autopilotplan.app/admin?section=\(webSection)")
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 0) {
                Spacer(minLength: 24)
                Card(padding: 12, radius: Radius.hero) {
                    EmptyStateView(symbol: section.symbol, title: section.title,
                                   message: "Esta sección se edita en el panel web de Admin.")
                    Button {
                        Haptics.tap()
                        if let webURL { openURL(webURL) }
                    } label: {
                        Text("Abrir en la web")
                    }
                    .buttonStyle(.pill)
                    .frame(maxWidth: 320, alignment: .center)
                    .frame(maxWidth: .infinity)
                    .padding(.horizontal, 12)
                    .accessibilityHint("Abre el panel de administración en el navegador")
                }
                .frame(maxWidth: 520)
                .padding(20)
                .frame(maxWidth: .infinity)
                Spacer(minLength: 24)
            }
            .frame(minHeight: 480)
        }
        .screenBackground()
    }
}
