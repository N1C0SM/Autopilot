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
            .padding(16).frame(maxWidth: 1100).frame(maxWidth: .infinity)
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

/// Usuarios: búsqueda y plan de cada uno.
struct AdminUsersView: View {
    @State private var users: [AdminProfile] = []
    @State private var query = ""

    private var filtered: [AdminProfile] {
        guard !query.isEmpty else { return users }
        return users.filter { ($0.name ?? "").localizedCaseInsensitiveContains(query) || ($0.email ?? "").localizedCaseInsensitiveContains(query) }
    }

    var body: some View {
        List(filtered) { u in
            HStack(spacing: 12) {
                AvatarView(name: u.name ?? u.email ?? "?", url: nil, size: 36)
                VStack(alignment: .leading) {
                    Text(u.name ?? "Sin nombre").font(.apBody)
                    Text(u.email ?? "").font(.apFootnote).foregroundStyle(Palette.muted)
                }
                Spacer()
                Text(u.plan).font(.apSubhead).foregroundStyle(u.plan == "Free" ? Palette.muted : Palette.gold)
            }
            .frame(minHeight: 44)
            .accessibilityElement(children: .combine)
        }
        .searchable(text: $query, prompt: "Buscar por nombre o correo")
        .scrollContentBackground(.hidden)
        .screenBackground()
        .task {
            users = (try? await Backend.client.from("profiles").select("user_id, name, email, created_at, plan_status, subscription_tier")
                .order("created_at", ascending: false).execute().value) ?? []
        }
    }
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
