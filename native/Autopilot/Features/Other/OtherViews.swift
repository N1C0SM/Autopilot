import SwiftUI
import Supabase

/// Nutrición, calcada de la web: tarjeta con kcal de objetivo diario y macros con su porcentaje,
/// y la lista de comidas (o «Sin comidas todavía»).
struct NutritionView: View {
    @EnvironmentObject private var session: SessionModel
    @State private var macros: Macros?
    @State private var meals: [Meal] = []
    @State private var loaded = false
    struct Macros: Decodable { let calories: Double?; let protein: Double?; let carbs: Double?; let fats: Double? }
    struct Meal: Decodable, Hashable { let name: String?; let description: String?; let calories: Double? }
    struct Row: Decodable { let macros_json: Macros?; let meals_json: [Meal]? }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                if let m = macros, m.protein != nil || m.calories != nil {
                    let p = m.protein ?? 0, c = m.carbs ?? 0, f = m.fats ?? 0
                    let kcal = m.calories ?? (p * 4 + c * 4 + f * 9)
                    let total = max(p * 4 + c * 4 + f * 9, 1)
                    VStack(alignment: .leading, spacing: 0) {
                        Text("\(Int(kcal.rounded()))").font(.system(size: 56, weight: .bold, design: .rounded).monospacedDigit())
                        Text("kcal de objetivo diario").font(.apSubhead).foregroundStyle(Palette.muted).padding(.top, 4)
                        HStack(alignment: .top, spacing: 16) {
                            macro("Proteína", p, p * 4 / total)
                            macro("Carbos", c, c * 4 / total)
                            macro("Grasas", f, f * 9 / total)
                        }
                        .padding(.top, 20)
                        Text("Objetivos de tu plan para hoy. Marcar comidas no mide las calorías consumidas.")
                            .font(.apFootnote).foregroundStyle(Palette.muted).padding(.top, 16)
                    }
                    .padding(20)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Palette.card, in: RoundedRectangle(cornerRadius: Radius.hero, style: .continuous))
                }
                if meals.isEmpty {
                    if loaded {
                        VStack(spacing: 12) {
                            Image(systemName: "clock").font(.system(size: 26, weight: .semibold)).foregroundStyle(Palette.gold)
                                .frame(width: 60, height: 60).background(Palette.gold.opacity(0.15), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                            Text("Sin comidas todavía").font(.apTitle3)
                            Text("Guarda tus datos en Ajustes y podrás generarlas con tus macros.")
                                .font(.apSubhead).foregroundStyle(Palette.muted).multilineTextAlignment(.center)
                        }
                        .padding(.vertical, 40).padding(.horizontal, 24)
                        .frame(maxWidth: .infinity)
                        .background(Palette.card, in: RoundedRectangle(cornerRadius: Radius.hero, style: .continuous))
                    }
                } else {
                    Text("Comidas").font(.apTitle3)
                    VStack(spacing: 0) {
                        ForEach(Array(meals.enumerated()), id: \.offset) { i, meal in
                            VStack(alignment: .leading, spacing: 2) {
                                HStack {
                                    Text(meal.name ?? "Comida").font(.apHeadline)
                                    Spacer()
                                    if let k = meal.calories { Text("\(Int(k)) kcal").font(.apSubhead.monospacedDigit()).foregroundStyle(Palette.muted) }
                                }
                                if let d = meal.description { Text(d).font(.apFootnote).foregroundStyle(Palette.muted) }
                            }
                            .padding(16)
                            .overlay(alignment: .top) { if i > 0 { Rectangle().fill(Palette.separator).frame(height: 0.5).padding(.leading, 16) } }
                        }
                    }
                    .background(Palette.card, in: RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
                }
            }
            .padding(.horizontal, 16).padding(.top, 8).padding(.bottom, 110)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .screenBackground()
        .task {
            guard let id = session.userId else { return }
            let rows: [Row] = (try? await Backend.client.from("nutrition_plan").select("macros_json, meals_json")
                .eq("user_id", value: id).limit(1).execute().value) ?? []
            macros = rows.first?.macros_json
            meals = rows.first?.meals_json ?? []
            loaded = true
        }
    }

    private func macro(_ label: String, _ grams: Double, _ share: Double) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(label).font(.apFootnote).foregroundStyle(Palette.muted)
                Spacer()
                Text("\(Int((share * 100).rounded())) %").font(.apFootnote.monospacedDigit()).foregroundStyle(Palette.muted)
            }
            (Text("\(Int(grams.rounded()))").font(.system(.title2, design: .rounded).weight(.bold)) + Text("g").font(.apSubhead).foregroundColor(Palette.muted))
            GeometryReader { geo in
                Capsule().fill(Palette.gold.opacity(0.2))
                    .overlay(alignment: .leading) { Capsule().fill(Palette.gold).frame(width: geo.size.width * share) }
            }
            .frame(height: 6)
        }
        .frame(maxWidth: .infinity)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(label): \(Int(grams)) gramos, \(Int(share * 100)) por ciento")
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
