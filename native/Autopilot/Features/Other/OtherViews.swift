import SwiftUI
import Supabase

/// Nutrición básica: objetivo de calorías y macros del perfil.
struct NutritionView: View {
    @EnvironmentObject private var session: SessionModel
    @State private var macros: Macros?
    @State private var loaded = false
    struct Macros: Decodable { let calories: Double?; let protein: Double?; let carbs: Double?; let fats: Double? }
    struct Row: Decodable { let macros_json: Macros? }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                if let m = macros, m.protein != nil || m.calories != nil {
                    let kcal = m.calories ?? ((m.protein ?? 0) * 4 + (m.carbs ?? 0) * 4 + (m.fats ?? 0) * 9)
                    FigureTile(label: "Objetivo diario", value: "\(NumberText.integer(Int(kcal.rounded()))) kcal", accent: true)
                    LazyVGrid(columns: [GridItem(.adaptive(minimum: 110), spacing: 12)], spacing: 12) {
                        FigureTile(label: "Proteína", value: "\(Int((m.protein ?? 0).rounded())) g")
                        FigureTile(label: "Carbohidratos", value: "\(Int((m.carbs ?? 0).rounded())) g")
                        FigureTile(label: "Grasas", value: "\(Int((m.fats ?? 0).rounded())) g")
                    }
                } else if loaded {
                    EmptyStateView(symbol: "fork.knife", title: "Sin objetivo de nutrición",
                                   message: "Completa tu perfil para calcular calorías y macros.")
                }
            }
            .padding(16).frame(maxWidth: 900).frame(maxWidth: .infinity)
        }
        .screenBackground()
        .task {
            guard let id = session.userId else { return }
            let rows: [Row] = (try? await Backend.client.from("nutrition_plan").select("macros_json")
                .eq("user_id", value: id).limit(1).execute().value) ?? []
            macros = rows.first?.macros_json
            loaded = true
        }
    }
}

/// Escáner: historial de escaneos con sus puntuaciones.
struct ScanView: View {
    @EnvironmentObject private var session: SessionModel
    @State private var scans: [Row] = []
    @State private var loaded = false
    struct Row: Decodable, Identifiable { let id: String; let created_at: String; let physique: Double?; let potential: Double? }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                if let last = scans.first {
                    LazyVGrid(columns: [GridItem(.adaptive(minimum: 150), spacing: 12)], spacing: 12) {
                        FigureTile(label: "Físico", value: NumberText.decimal(last.physique ?? 0), hint: "último escaneo", accent: true)
                        FigureTile(label: "Potencial", value: NumberText.decimal(last.potential ?? 0), hint: "sobre 10")
                    }
                    SectionTitle(title: "Historial")
                    Card {
                        ForEach(scans) { s in
                            HStack {
                                Text(String(s.created_at.prefix(10))).font(.apBody.monospacedDigit())
                                Spacer()
                                Text(NumberText.decimal(s.physique ?? 0)).font(.apHeadline.monospacedDigit())
                            }
                            .frame(minHeight: 32).accessibilityElement(children: .combine)
                        }
                    }
                } else if loaded {
                    EmptyStateView(symbol: "figure.stand", title: "Sin escaneos", message: "Haz tu primer escaneo para ver tu físico y tu potencial.")
                }
                Link(destination: URL(string: "https://autopilotplan.app/scan")!) {
                    Text("Hacer un escaneo").frame(maxWidth: .infinity)
                }
                .buttonStyle(.pill)
            }
            .padding(16).frame(maxWidth: 900).frame(maxWidth: .infinity)
        }
        .screenBackground()
        .task {
            guard let id = session.userId else { return }
            scans = (try? await Backend.client.from("scan_history").select("id, created_at, physique, potential")
                .eq("user_id", value: id).order("created_at", ascending: false).limit(30).execute().value) ?? []
            loaded = true
        }
    }
}

/// Entrenador: lista de clientes.
struct TrainerClientsView: View {
    @EnvironmentObject private var session: SessionModel
    @State private var clients: [Row] = []
    @State private var loaded = false
    struct Row: Decodable, Identifiable { let user_id: String; let name: String?; var id: String { user_id } }

    var body: some View {
        List(clients) { c in
            HStack(spacing: 12) {
                AvatarView(name: c.name ?? "?", url: nil, size: 36)
                Text(c.name ?? "Cliente").font(.apBody)
            }
            .frame(minHeight: 44)
        }
        .overlay { if loaded && clients.isEmpty { EmptyStateView(symbol: "person.2", title: "Sin clientes todavía") } }
        .scrollContentBackground(.hidden)
        .screenBackground()
        .task {
            clients = (try? await Backend.client.rpc("get_trainer_assigned_profiles").execute().value) ?? []
            loaded = true
        }
    }
}

struct TrainerProfileView: View {
    var body: some View { AccountView() }
}
