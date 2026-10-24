import SwiftUI
import Supabase
/// y la lista de comidas (o «Sin comidas todavía»).
/// Nutrición, calcada de `MealsList.tsx`: portada del primer plato, resumen con anillo de comidas
/// hechas y objetivos, y «Comidas de hoy» marcables con su foto.
struct NutritionView: View {
    @EnvironmentObject private var session: SessionModel
    @State private var macros: Macros?
    @State private var meals: [Meal] = []
    @State private var loaded = false
    @State private var done: Set<String> = []
    @State private var cover: URL?
    struct Macros: Decodable { let calories: Double?; let protein: Double?; let carbs: Double?; let fats: Double? }
    struct Meal: Decodable, Hashable { let name: String?; let description: String? }
    struct Row: Decodable { let macros_json: Macros?; let meals_json: [Meal]? }
    static let defaultDish = "Pollo a la plancha con arroz integral y verduras asadas"

    private var doneKey: String {
        let c = Calendar.current.dateComponents([.year, .month, .day], from: Date())
        return "meals_done_\(session.userIdString ?? "")_\(c.year!)-\(c.month!)-\(c.day!)"
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 32) {
                if loaded { content }
            }
            .padding(.horizontal, 16).padding(.top, 8).padding(.bottom, 24)
            .frame(maxWidth: 720).frame(maxWidth: .infinity)
        }
        .screenBackground()
        .task { await load() }
    }

    @ViewBuilder private var content: some View {
        let p = macros?.protein ?? 0, c = macros?.carbs ?? 0, f = macros?.fats ?? 0
        let energy = p * 4 + c * 4 + f * 9
        let kcal = (macros?.calories ?? 0) > 0 ? macros!.calories! : energy.rounded()
        let hasMeals = !meals.isEmpty
        let showTargets = macros != nil && kcal > 0
        if !hasMeals && kcal <= 0 {
            EmptyCard(photo: nil, title: "Aún no hay plan de comidas", message: "En cuanto tengamos tus macros, verás aquí tus calorías y las comidas del día.")
        } else {
            if hasMeals, let cover {
                Color.clear.frame(height: 176)
                    .overlay { CachedAsyncImage(url: cover) { $0.resizable().scaledToFill() } placeholder: { Palette.card } }
                    .overlay { LinearGradient(colors: [.clear, .black.opacity(0.6)], startPoint: .center, endPoint: .bottom) }
                    .clipShape(RoundedRectangle(cornerRadius: 28, style: .continuous))
                    .accessibilityHidden(true)
            }
            if hasMeals || showTargets { summary(kcal: kcal, p: p, c: c, f: f, energy: energy, hasMeals: hasMeals, showTargets: showTargets) }
            if hasMeals && macros == nil {
                HStack(alignment: .top, spacing: 16) {
                    Image(systemName: "person").font(.system(size: 24)).foregroundStyle(Palette.gold).frame(width: 40)
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Tus macros aún no están personalizados").font(.apHeadline)
                        Text("Añade tu peso actual para calcularlos. Mientras tanto, las comidas de abajo son orientativas.").font(.apSubhead).foregroundStyle(Palette.muted)
                    }
                }
            }
            if !hasMeals {
                EmptyCard(photo: Self.defaultDish, title: "Sin comidas todavía", message: "Guarda tus datos en Ajustes y podrás generarlas con tus macros.")
            } else {
                VStack(alignment: .leading, spacing: 8) {
                    Text("COMIDAS DE HOY").font(.apFootnote).foregroundStyle(Palette.muted).padding(.leading, 16)
                    VStack(spacing: 0) {
                        ForEach(Array(meals.enumerated()), id: \.offset) { i, meal in mealRow(meal, last: i == meals.count - 1) }
                    }
                    .background(Palette.card, in: RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
                }
            }
        }
    }

    private func summary(kcal: Double, p: Double, c: Double, f: Double, energy: Double, hasMeals: Bool, showTargets: Bool) -> some View {
        let doneCount = meals.filter { done.contains($0.name ?? "") }.count
        let remaining = meals.count - doneCount
        return VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 20) {
                if hasMeals {
                    ZStack {
                        Circle().stroke(Palette.gold.opacity(0.2), lineWidth: 14)
                        Circle().trim(from: 0, to: Double(doneCount) / Double(max(meals.count, 1)))
                            .stroke(Palette.gold, style: StrokeStyle(lineWidth: 14, lineCap: .round)).rotationEffect(.degrees(-90))
                            .animation(.snappy, value: doneCount)
                        VStack(spacing: 4) {
                            Text("\(doneCount)").font(.system(size: 44, weight: .bold).monospacedDigit())
                            Text("de \(meals.count) \(meals.count == 1 ? "comida" : "comidas")").font(.apFootnote).foregroundStyle(Palette.muted)
                        }
                    }
                    .frame(width: 136, height: 136).padding(7)
                    .accessibilityElement(children: .ignore).accessibilityLabel("\(doneCount) de \(meals.count) comidas hechas hoy")
                }
                VStack(alignment: .leading, spacing: 6) {
                    if showTargets {
                        Text(NumberText.integer(Int(kcal))).font(.system(size: hasMeals ? 34 : 48, weight: .bold).monospacedDigit())
                        Text("kcal de objetivo diario").font(.apSubhead).foregroundStyle(Palette.muted)
                    } else {
                        Text(remaining == 0 ? "Día completo" : "Te \(remaining == 1 ? "queda" : "quedan") \(remaining) \(remaining == 1 ? "comida" : "comidas")").font(.apHeadline)
                        Text(remaining == 0 ? "Has marcado todas las comidas de hoy." : "Márcalas según las vayas haciendo.").font(.apSubhead).foregroundStyle(Palette.muted)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            if showTargets {
                HStack(alignment: .top, spacing: 16) {
                    macro("Proteína", p, energy > 0 ? p * 4 / energy : 0)
                    macro("Carbos", c, energy > 0 ? c * 4 / energy : 0)
                    macro("Grasas", f, energy > 0 ? f * 9 / energy : 0)
                }
                .padding(.top, 24)
                Text("Objetivos de tu plan para hoy. Marcar comidas no mide las calorías consumidas.")
                    .font(.apFootnote).foregroundStyle(Palette.muted).padding(.top, 16)
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Palette.card, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
    }

    private func mealRow(_ meal: Meal, last: Bool) -> some View {
        let name = meal.name ?? "Comida"
        let isDone = done.contains(name)
        return Button { toggle(name) } label: {
            HStack(spacing: 12) {
                ZStack {
                    if isDone { Circle().fill(Palette.gold); Image("lu-check").renderingMode(.template).resizable().frame(width: 14, height: 14).foregroundStyle(.black) }
                    else { Circle().strokeBorder(Palette.muted.opacity(0.5), lineWidth: 1.5) }
                }
                .frame(width: 24, height: 24)
                HStack(spacing: 12) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(name).font(.apHeadline).foregroundStyle(isDone ? Palette.muted : .white)
                        if let d = meal.description { Text(d).font(.apSubhead).foregroundStyle(Palette.muted.opacity(isDone ? 0.6 : 1)).lineLimit(2) }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    MealPhoto(dish: meal.description ?? name).frame(width: 56, height: 56)
                        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous)).opacity(isDone ? 0.5 : 1)
                }
                .padding(.vertical, 8)
                .overlay(alignment: .bottom) { if !last { Rectangle().fill(Palette.separator).frame(height: 0.5) } }
            }
            .padding(.horizontal, 16)
            .frame(minHeight: 44)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(isDone ? .isSelected : [])
    }

    private func toggle(_ name: String) {
        Haptics.tap()
        if done.contains(name) { done.remove(name) } else { done.insert(name) }
        if let data = try? JSONEncoder().encode(Array(done)) { UserDefaults.standard.set(data, forKey: doneKey) }
    }

    private func load() async {
        if let data = UserDefaults.standard.data(forKey: doneKey), let arr = try? JSONDecoder().decode([String].self, from: data) { done = Set(arr) }
        guard let id = session.userId else { loaded = true; return }
        let rows: [Row] = (try? await Backend.client.from("nutrition_plan").select("macros_json, meals_json")
            .eq("user_id", value: id).limit(1).execute().value) ?? []
        macros = rows.first?.macros_json
        meals = rows.first?.meals_json ?? []
        loaded = true
        cover = await AiCover.meal(meals.first?.description ?? Self.defaultDish)
    }

    private func macro(_ label: String, _ grams: Double, _ share: Double) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                Text(label).font(.apFootnote).foregroundStyle(Palette.muted)
                Spacer()
                Text("\(Int((share * 100).rounded())) %").font(.apFootnote.monospacedDigit()).foregroundStyle(Palette.muted)
            }
            (Text(NumberText.integer(Int(grams.rounded()))).font(.system(size: 22, weight: .bold).monospacedDigit()) + Text("g").font(.apSubhead.weight(.semibold)).foregroundColor(Palette.muted))
                .padding(.top, 2)
            GeometryReader { geo in
                Capsule().fill(Palette.gold.opacity(0.2))
                    .overlay(alignment: .leading) { Capsule().fill(Palette.gold).frame(width: geo.size.width * share) }
            }
            .frame(height: 6).padding(.top, 8)
        }
        .frame(maxWidth: .infinity)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(label): objetivo diario de \(Int(grams)) gramos, \(Int(share * 100)) % de las calorías")
    }
}

/// Tarjeta vacía de la web (EmptyState card), con foto opcional arriba.
private struct EmptyCard: View {
    let photo: String?
    let title: String
    let message: String
    @State private var url: URL?
    var body: some View {
        VStack(spacing: 0) {
            if let url {
                Color.clear.frame(height: 160)
                    .overlay { CachedAsyncImage(url: url) { $0.resizable().scaledToFill() } placeholder: { Palette.secondary } }
                    .clipped().transition(.opacity)
            }
            VStack(spacing: 8) {
                Image("lu-clock").renderingMode(.template).resizable().frame(width: 28, height: 28).foregroundStyle(Palette.gold)
                Text(title).font(.apHeadline)
                Text(message).font(.apSubhead).foregroundStyle(Palette.muted).multilineTextAlignment(.center)
            }
            .padding(.vertical, 32).padding(.horizontal, 24)
        }
        .frame(maxWidth: .infinity)
        .background(Palette.card)
        .clipShape(RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
        .task { if let photo { let u = await AiCover.meal(photo); withAnimation { url = u } } }
    }
}

/// Foto del plato generada por `session-cover`.
struct MealPhoto: View {
    let dish: String
    @State private var url: URL?
    var body: some View {
        ZStack {
            Palette.secondary
            if let url { CachedAsyncImage(url: url) { $0.resizable().scaledToFill() } placeholder: { Color.clear } }
        }
        .task(id: dish) { url = await AiCover.meal(dish) }
        .accessibilityHidden(true)
    }
}

/// Portadas con IA de la edge function `session-cover` (como `useSessionCover.ts`): se guardan por clave.
enum AiCover {
    private static let store = "autopilot.aiCovers.v1"
    static func meal(_ dish: String) async -> URL? {
        let text = String(dish.trimmingCharacters(in: .whitespaces).prefix(120))
        guard text.count >= 3 else { return nil }
        return await fetch(key: "m:\(text.lowercased())", body: ["meal": text])
    }
    private static func fetch(key: String, body: [String: String]) async -> URL? {
        var cache = UserDefaults.standard.dictionary(forKey: store) as? [String: String] ?? [:]
        if let u = cache[key] { return URL(string: u) }
        struct R: Decodable { let url: String? }
        guard let r: R = try? await Backend.client.functions.invoke("session-cover", options: FunctionInvokeOptions(body: body)), let u = r.url else { return nil }
        cache[key] = u
        UserDefaults.standard.set(cache, forKey: store)
        return URL(string: u)
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
