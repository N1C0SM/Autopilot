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
        case "training": "Plus"
        case "full", "transform", "personal": "Coach"
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

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                if loading {
                    ProgressView().frame(maxWidth: .infinity).padding(.top, 60)
                } else {
                    let total = users.count
                    let paid = users.filter { $0.plan != "Free" }.count
                    LazyVGrid(columns: [GridItem(.adaptive(minimum: 170), spacing: 12)], spacing: 12) {
                        FigureTile(label: "Clientes", value: "\(total)", accent: true)
                        FigureTile(label: "Plus y Coach", value: "\(paid)", hint: "\(pct(paid, total))% del total")
                        FigureTile(label: "Activos 7 días", value: "\(pct(active7, total))%", hint: "\(active7) entrenando")
                        FigureTile(label: "Entrenos 7 días", value: "\(workouts7)")
                    }
                    LazyVGrid(columns: [GridItem(.adaptive(minimum: 320), spacing: 12)], spacing: 12) {
                        Card {
                            Text("Clientes por plan").font(.apHeadline)
                            ForEach(["Free", "Plus", "Coach"], id: \.self) { plan in
                                let n = users.filter { $0.plan == plan }.count
                                BarRowView(label: plan, value: n, percent: pct(n, total))
                            }
                        }
                        Card {
                            Text("Embudo").font(.apHeadline)
                            BarRowView(label: "Registrados", value: total, percent: 100)
                            let ready = users.filter { $0.plan_status == "plan_ready" }.count
                            BarRowView(label: "Plan listo", value: ready, percent: pct(ready, total))
                            BarRowView(label: "Plus y Coach", value: paid, percent: pct(paid, total))
                        }
                    }
                }
            }
            .padding(16).frame(maxWidth: .infinity, alignment: .leading)
        }
        .screenBackground()
        .refreshable { await load() }
        .task { await load() }
    }

    private func pct(_ a: Int, _ b: Int) -> Int { b > 0 ? Int((Double(a) / Double(b) * 100).rounded()) : 0 }

    private func load() async {
        users = (try? await Backend.client.from("profiles").select("user_id, name, email, created_at, plan_status, subscription_tier")
            .execute().value) ?? []
        struct C: Decodable { let user_id: String }
        let comps: [C] = (try? await Backend.client.from("day_completions").select("user_id")
            .gte("completed_at", value: LocalDate.daysAgo(6)).execute().value) ?? []
        workouts7 = comps.count
        active7 = Set(comps.map(\.user_id)).count
        loading = false
    }
}

struct BarRowView: View {
    let label: String
    let value: Int
    let percent: Int

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(label).font(.apBody)
                Spacer()
                Text("\(value)").font(.apHeadline.monospacedDigit())
                Text("\(percent)%").font(.apFootnote.monospacedDigit()).foregroundStyle(Palette.muted)
            }
            GeometryReader { geo in
                Capsule().fill(Palette.secondary)
                    .overlay(alignment: .leading) { Capsule().fill(Palette.gold).frame(width: geo.size.width * CGFloat(percent) / 100) }
            }
            .frame(height: 6)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(label): \(value), \(percent) por ciento")
    }
}

/// Usuarios, calcado de `UserList.tsx`: recuento, buscador, filtros en chips y grupos
/// Clientes · Entrenadores · Administradores con estado del plan y punto de pago.
struct AdminUsersView: View {
    struct Row: Decodable, Identifiable {
        let user_id: String; let name: String?; let email: String?; let created_at: String
        let plan_status: String?; let payment_status: String?; let avatar_url: String?; let travel_mode_until: String?
        var id: String { user_id }
        var display: String { (name?.trimmingCharacters(in: .whitespaces)).flatMap { $0.isEmpty ? nil : $0 } ?? email ?? "?" }
        var traveling: Bool {
            guard let t = travel_mode_until, let d = ISO8601DateFormatter().date(from: t) ?? DateFormatter.ymd.date(from: String(t.prefix(10))) else { return false }
            return d >= Date()
        }
    }
    struct RoleRow: Decodable { let user_id: String; let role: String }

    @State private var users: [Row] = []
    @State private var admins: Set<String> = []
    @State private var trainers: Set<String> = []
    @State private var query = ""
    @State private var filter = "all"
    @State private var loaded = false

    private static let filters = [("all", "Todos"), ("paid", "Pagados"), ("unpaid", "Sin pagar"), ("plan_pending", "Plan pendiente"), ("plan_ready", "Plan listo"), ("traveling", "En viaje")]

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
                Text("\(clients.count) usuarios · \(trainers.count) entrenadores · \(admins.count) admin")
                    .font(.apSubhead).foregroundStyle(Palette.muted)
                HStack {
                    Image(systemName: "magnifyingglass").foregroundStyle(Palette.muted)
                    TextField("Buscar por nombre o email…", text: $query).textFieldStyle(.plain)
                }
                .padding(.horizontal, 16).frame(minHeight: 44)
                .background(Palette.secondary, in: Capsule())
                .frame(maxWidth: 360)
                .accessibilityLabel("Buscar usuario")
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(Self.filters, id: \.0) { key, label in
                            Button(label) { filter = key; Haptics.selection() }
                                .font(.apSubhead.weight(.medium))
                                .padding(.horizontal, 14).frame(minHeight: 36)
                                .foregroundStyle(filter == key ? Color.black : Palette.foreground)
                                .background(filter == key ? Palette.gold : Palette.secondary, in: Capsule())
                                .buttonStyle(.plain)
                        }
                    }
                }
                if loaded && clients.isEmpty && trainerRows.isEmpty && adminRows.isEmpty {
                    EmptyStateView(symbol: "magnifyingglass", title: "Sin usuarios", message: "Ajusta la búsqueda o los filtros para ver resultados.")
                }
                if !clients.isEmpty { group("Clientes (\(clients.count))", clients, kind: "user") }
                if !trainerRows.isEmpty { group("Entrenadores (\(trainerRows.count))", trainerRows, kind: "trainer") }
                if !adminRows.isEmpty { group("Administradores (\(adminRows.count))", adminRows, kind: "admin") }
            }
            .padding(20)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .screenBackground()
        .task { await load() }
        .refreshable { await load() }
    }

    private func group(_ title: String, _ rows: [Row], kind: String) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title.uppercased()).font(.apFootnote).foregroundStyle(Palette.muted).padding(.horizontal, 16)
            VStack(spacing: 0) {
                ForEach(Array(rows.enumerated()), id: \.element.id) { i, u in
                    NavigationLink { AdminUserFullDetail(userId: u.user_id, display: u.display, email: u.email ?? "").navigationTitle(u.display) } label: {
                        HStack(spacing: 12) {
                            AvatarView(name: u.display, url: u.avatar_url, size: 36)
                            VStack(alignment: .leading, spacing: 1) {
                                Text(u.display).font(.apBody).lineLimit(1)
                                Text(meta(u, kind)).font(.apFootnote).foregroundStyle(Palette.muted).lineLimit(1)
                            }
                            Spacer(minLength: 8)
                            if kind == "user" {
                                let badge = planBadge(u)
                                Text(badge.0).font(.caption.weight(.medium)).padding(.horizontal, 8).padding(.vertical, 2)
                                    .foregroundStyle(badge.1).background(badge.1.opacity(0.15), in: Capsule())
                                Circle().fill(u.payment_status == "paid" ? Color.green : Palette.muted.opacity(0.5)).frame(width: 8, height: 8)
                                    .accessibilityLabel(u.payment_status == "paid" ? "pagado" : "sin pagar")
                            }
                            Image(systemName: "chevron.right").font(.footnote.weight(.semibold)).foregroundStyle(Palette.muted)
                        }
                        .padding(.horizontal, 16).frame(minHeight: 60)
                        .overlay(alignment: .top) { if i > 0 { Rectangle().fill(Palette.separator).frame(height: 0.5).padding(.leading, 64) } }
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityElement(children: .combine)
                }
            }
            .background(Palette.card, in: RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
        }
    }

    private func meta(_ u: Row, _ kind: String) -> String {
        if kind == "admin" { return "Administrador" }
        if kind == "trainer" { return "Entrenador" }
        let date = DateFormatter.ymd.date(from: String(u.created_at.prefix(10)))
            .map { $0.formatted(.dateTime.day().month(.abbreviated).year().locale(Locale(identifier: "es_ES"))) } ?? ""
        let hasName = !(u.name ?? "").trimmingCharacters(in: .whitespaces).isEmpty
        return "\(hasName ? "\(u.email ?? "") · " : "")Alta \(date)"
    }

    private func planBadge(_ u: Row) -> (String, Color) {
        if u.traveling { return ("En viaje", Palette.gold) }
        switch u.plan_status {
        case "plan_ready": return ("Plan listo", .green)
        case "plan_pending": return ("Pendiente", Palette.gold)
        default: return ("Onboarding", Palette.muted)
        }
    }

    private func load() async {
        users = (try? await Backend.client.from("profiles")
            .select("user_id, name, email, created_at, plan_status, payment_status, avatar_url, travel_mode_until")
            .order("created_at", ascending: false).execute().value) ?? []
        let roles: [RoleRow] = (try? await Backend.client.from("user_roles").select("user_id, role").in("role", values: ["admin", "trainer"]).execute().value) ?? []
        admins = Set(roles.filter { $0.role == "admin" }.map(\.user_id))
        trainers = Set(roles.filter { $0.role == "trainer" }.map(\.user_id))
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
                    VStack(alignment: .leading, spacing: 2) {
                        Text(user.display).font(.apTitle2)
                        Text(user.email ?? "").font(.apSubhead).foregroundStyle(Palette.muted)
                    }
                }
                VStack(spacing: 0) {
                    detailRow("Estado del plan", ["plan_ready": "Plan listo", "plan_pending": "Pendiente"][user.plan_status ?? ""] ?? "Onboarding")
                    detailRow("Pago", user.payment_status == "paid" ? "Pagado" : "Sin pagar", separator: true)
                    detailRow("Alta", String(user.created_at.prefix(10)), separator: true)
                }
                .background(Palette.card, in: RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
            }
            .padding(20)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .screenBackground()
    }

    private func detailRow(_ label: String, _ value: String, separator: Bool = false) -> some View {
        HStack {
            Text(label).font(.apBody)
            Spacer()
            Text(value).font(.apBody).foregroundStyle(Palette.muted)
        }
        .padding(.horizontal, 16).frame(minHeight: 50)
        .overlay(alignment: .top) { if separator { Rectangle().fill(Palette.separator).frame(height: 0.5).padding(.leading, 16) } }
    }
}

extension DateFormatter {
    static let ymd: DateFormatter = { let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"; f.locale = Locale(identifier: "en_US_POSIX"); return f }()
}

/// Secciones de edición de Admin que aún no son nativas: se abren en la web de Admin.
struct AdminWebSectionView: View {
    let section: AppSection

    private var webSection: String {
        String(section.rawValue.dropFirst(5)).lowercased()
    }

    var body: some View {
        VStack(spacing: 18) {
            Image(systemName: section.symbol).font(.system(size: 40, weight: .semibold)).foregroundStyle(Palette.gold)
                .accessibilityHidden(true)
            Text(section.title).font(.apTitle2)
            Text("Esta sección se edita en el panel web de Admin.").font(.apSubhead).foregroundStyle(Palette.muted)
                .multilineTextAlignment(.center)
            Link(destination: URL(string: "https://autopilotplan.app/admin?section=\(webSection)")!) {
                Text("Abrir en la web").frame(maxWidth: 280)
            }
            .buttonStyle(.pill)
        }
        .padding(24)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .screenBackground()
    }
}
