import SwiftUI
import Supabase

/// Nutrición, calcada de `MealsList.tsx`: portada del primer plato, resumen con anillo de comidas
/// hechas y objetivos, y «Comidas de hoy» marcables con su foto (o «Sin comidas todavía»).
struct NutritionView: View {
    @EnvironmentObject private var session: SessionModel
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    /// Ancho de la ventana: el iPhone sigue en una columna y iPad/Mac pasan a la rejilla de escritorio.
    @Environment(\.horizontalSizeClass) private var sizeClass
    @State private var macros: Macros?
    @State private var meals: [Meal] = []
    @State private var loaded = false
    /// La red ha fallado en todos los intentos: se ofrece reintentar en vez de un vacío falso.
    @State private var failed = false
    /// En Mac el padding horizontal lo pone `RootView` (el `<main>` de la web): aquí 0.
    private var pagePadding: CGFloat {
        #if os(macOS)
        return 0
        #else
        return singleColumn ? 16 : 32
        #endif
    }

    /// Evita dos cargas simultáneas (`.task` + botón de reintentar).
    @State private var loading = false
    @State private var done: Set<String> = []
    @State private var cover: URL?
    /// Sin comidas: nil = comprobando, true = tiene Plus (se generan), false = aviso de Plus.
    @State private var hasAccess: Bool?
    @State private var generating = false
    @State private var generateFailed = false
    struct Macros: Decodable { let calories: Double?; let protein: Double?; let carbs: Double?; let fats: Double? }
    struct Meal: Decodable, Hashable { let name: String?; let description: String? }
    struct Row: Decodable { let macros_json: Macros?; let meals_json: [Meal]? }
    static let defaultDish = "Pollo a la plancha con arroz integral y verduras asadas"
    /// Intentos totales al cargar el plan: el primero más dos reintentos automáticos.
    private static let loadAttempts = 3
    /// Espera entre reintentos (backoff creciente) para dejar pasar fallos transitorios.
    private static let retryBackoff: [Duration] = [.milliseconds(400), .milliseconds(1600)]

    private var doneKey: String {
        let c = Calendar.current.dateComponents([.year, .month, .day], from: Date())
        return "meals_done_\(session.userIdString ?? "")_\(c.year!)-\(c.month!)-\(c.day!)"
    }

    /// iPhone: una columna. iPad/Mac: rejilla de escritorio (ver `NutritionGrid`). Con texto
    /// muy grande también una columna, para que las cifras y las comidas no se compriman.
    private var singleColumn: Bool { sizeClass == .compact || dynamicTypeSize.isAccessibilitySize }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 32) {
                if failed {
                    retryCard
                } else if loaded {
                    content
                } else {
                    // Skeleton en vez de una pantalla vacía mientras llega la red.
                    NutritionSkeleton()
                }
            }
            .padding(.horizontal, pagePadding).padding(.top, 8).padding(.bottom, 24)
            // Móvil: la misma columna de siempre; iPad/Mac: el ancho de la rejilla de escritorio.
            .frame(maxWidth: NutritionGrid.contentWidth(singleColumn: singleColumn))
            .frame(maxWidth: .infinity)
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
        if !hasMeals && kcal <= 0 && hasAccess == false {
            // Sin Plus (la RLS no deja leer el plan): el aviso de Plus, no un «no hay plan».
            EmptyCard(photo: Self.defaultDish, title: "Tus comidas, hechas para ti",
                      message: "Con Plus, Autopilot te prepara las comidas de cada día con tus gustos, alergias y objetivo del onboarding, ajustadas a tus macros. Incluido en Plus.")
        } else if !hasMeals && kcal <= 0 {
            EmptyCard(photo: Self.defaultDish, title: "Aún no hay plan de comidas", message: "En cuanto tengamos tus macros, verás aquí tus calorías y las comidas del día.")
                .frame(maxWidth: 560)
        } else {
            // Escritorio (md/lg de la web): el resumen (portada, objetivos/macros y avisos) y las
            // comidas en dos columnas. En el iPhone la rejilla se queda en una y conserva el orden.
            LazyVGrid(columns: NutritionGrid.columns(singleColumn: singleColumn), alignment: .leading, spacing: singleColumn ? 32 : 24) {
                VStack(alignment: .leading, spacing: singleColumn ? 32 : 24) {
                    if hasMeals { coverCard }
                    if hasMeals || showTargets { summary(kcal: kcal, p: p, c: c, f: f, energy: energy, hasMeals: hasMeals, showTargets: showTargets) }
                    if hasMeals && macros == nil { macroNotice }
                }
                if hasMeals {
                    mealsSection
                } else {
                    if hasAccess == false {
                        // Como `MealsPlusCard` de la web; en iOS sin enlace a pagos externos.
                        EmptyCard(photo: Self.defaultDish, title: "Tus comidas, hechas para ti",
                                  message: "Con Plus, Autopilot te prepara las comidas de cada día con tus gustos, alergias y objetivo del onboarding, ajustadas a tus macros. Incluido en Plus.")
                    } else if generating || hasAccess == nil {
                        EmptyCard(photo: Self.defaultDish, title: "Preparando tus comidas…",
                                  message: "Autopilot está creando tus comidas con tus gustos y alergias del onboarding.")
                    } else {
                        VStack(alignment: .leading, spacing: 12) {
                            EmptyCard(photo: Self.defaultDish, title: "Sin comidas todavía",
                                      message: "No hemos podido prepararlas. Revisa tus datos en Ajustes o vuelve a intentarlo.")
                            if generateFailed {
                                Button("Volver a intentarlo") { Task { await generateMeals() } }.buttonStyle(.pillSecondary)
                            }
                        }
                    }
                }
            }
        }
    }

    /// Portada del primer plato (héroe de la web): 176 pt, radio 28 y degradado hacia negro.
    @ViewBuilder private var coverCard: some View {
        if let cover {
            Color.clear.frame(height: 176)
                .overlay { CachedAsyncImage(url: cover, maxSide: 420) { $0.resizable().scaledToFill() } placeholder: { Palette.card } }
                .overlay { LinearGradient(colors: [.clear, .black.opacity(0.6)], startPoint: .center, endPoint: .bottom) }
                .clipShape(RoundedRectangle(cornerRadius: Radius.hero, style: .continuous))
                .accessibilityHidden(true)
        }
    }

    /// Aviso de macros sin personalizar: las comidas de abajo siguen siendo orientativas.
    private var macroNotice: some View {
        HStack(alignment: .top, spacing: 16) {
            Image(systemName: "person").font(.inter(size: 24)).foregroundStyle(Palette.gold).frame(width: 40)
            VStack(alignment: .leading, spacing: 4) {
                Text("Tus macros aún no están personalizados").font(.apHeadline)
                Text("Añade tu peso actual para calcularlos. Mientras tanto, las comidas de abajo son orientativas.").font(.apSubhead).foregroundStyle(Palette.muted)
            }
        }
    }

    /// «Comidas de hoy»: cabecera y filas marcables con su foto.
    private var mealsSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            // Alineado con el borde de la tarjeta (sin sangría): todas las secciones de la
            // pantalla comparten el mismo eje vertical.
            Text("COMIDAS DE HOY")
                .font(.apFootnote.weight(.semibold)).tracking(0.6)
                .foregroundStyle(Palette.muted)
            VStack(spacing: 0) {
                ForEach(Array(meals.enumerated()), id: \.offset) { i, meal in mealRow(meal, last: i == meals.count - 1) }
            }
            .background(Palette.card, in: RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
        }
    }

    /// Error de red: un vacío aquí parecería «no tienes plan», así que se explica y se reintenta.
    private var retryCard: some View {
        Card(padding: 20) {
            // Icono alineado con la primera línea del título (no con el centro del bloque).
            HStack(alignment: .firstTextBaseline, spacing: 10) {
                Image(systemName: "wifi.exclamationmark").font(.inter(size: 20)).foregroundStyle(Palette.gold)
                Text("No hemos podido cargar tu plan").font(.apTitle3)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Text("Revisa tu conexión y vuelve a intentarlo. Tus macros y comidas siguen guardados.")
                .font(.apSubhead).foregroundStyle(Palette.muted).fixedSize(horizontal: false, vertical: true)
            Button {
                // Mientras se repite la petición vuelve el skeleton.
                failed = false
                Task { await load() }
            } label: { Text("Reintentar") }
                .buttonStyle(.pill)
                .padding(.top, 6)
                .accessibilityHint("Vuelve a pedir tu plan de comidas")
        }
        // En iPad/Mac el error no se estira a todo el ancho: se queda como una tarjeta de columna.
        .frame(maxWidth: 560)
    }

    /// Resumen del día: anillo de comidas hechas y objetivos. Con texto grande el anillo pasa
    /// encima del texto para que nada se comprima ni se salga de la tarjeta.
    private func summary(kcal: Double, p: Double, c: Double, f: Double, energy: Double, hasMeals: Bool, showTargets: Bool) -> some View {
        let doneCount = meals.filter { done.contains($0.name ?? "") }.count
        return VStack(alignment: .leading, spacing: 0) {
            Group {
                if dynamicTypeSize.isAccessibilitySize {
                    VStack(alignment: .leading, spacing: 16) {
                        if hasMeals { mealsRing(doneCount: doneCount) }
                        summaryNumbers(kcal: kcal, hasMeals: hasMeals, showTargets: showTargets, doneCount: doneCount)
                    }
                } else {
                    HStack(alignment: .center, spacing: 20) {
                        if hasMeals { mealsRing(doneCount: doneCount) }
                        summaryNumbers(kcal: kcal, hasMeals: hasMeals, showTargets: showTargets, doneCount: doneCount)
                    }
                }
            }
            if showTargets {
                macroRow(p: p, c: c, f: f, energy: energy).padding(.top, 24)
                Text("Objetivos de tu plan para hoy. Marcar comidas no mide las calorías consumidas.")
                    .font(.apFootnote).foregroundStyle(Palette.muted)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.top, 16)
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Palette.card, in: RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
    }

    /// Anillo de comidas hechas (mismo tamaño que el hueco del esqueleto).
    private func mealsRing(doneCount: Int) -> some View {
        ZStack {
            Circle().stroke(Palette.gold.opacity(0.2), lineWidth: 14)
            Circle().trim(from: 0, to: Double(doneCount) / Double(max(meals.count, 1)))
                .stroke(Palette.gold, style: StrokeStyle(lineWidth: 14, lineCap: .round)).rotationEffect(.degrees(-90))
                .animation(reduceMotion ? nil : .snappy, value: doneCount)
            VStack(spacing: 4) {
                Text("\(doneCount)").font(.figure(size: 44))
                    .lineLimit(1).minimumScaleFactor(0.6)
                    .contentTransition(.numericText())
                    .animation(reduceMotion ? nil : .snappy, value: doneCount)
                Text("de \(meals.count) \(meals.count == 1 ? "comida" : "comidas")")
                    .font(.apFootnote).foregroundStyle(Palette.muted)
                    .lineLimit(1).minimumScaleFactor(0.7)
            }
        }
        .frame(width: 136, height: 136).padding(7)
        .accessibilityElement(children: .ignore).accessibilityLabel("\(doneCount) de \(meals.count) comidas hechas hoy")
    }

    /// Objetivo en kcal o, sin macros todavía, cuántas comidas quedan.
    private func summaryNumbers(kcal: Double, hasMeals: Bool, showTargets: Bool, doneCount: Int) -> some View {
        let remaining = meals.count - doneCount
        return VStack(alignment: .leading, spacing: 6) {
            if showTargets {
                Text(NumberText.integer(Int(kcal)))
                    .font(.inter(size: hasMeals ? 34 : 48, weight: .bold).monospacedDigit())
                    .lineLimit(1).minimumScaleFactor(0.6)
                Text("kcal de objetivo diario").font(.apSubhead).foregroundStyle(Palette.muted)
                    .fixedSize(horizontal: false, vertical: true)
            } else {
                Text(remaining == 0 ? "Día completo" : "Te \(remaining == 1 ? "queda" : "quedan") \(remaining) \(remaining == 1 ? "comida" : "comidas")")
                    .font(.apHeadline).fixedSize(horizontal: false, vertical: true)
                Text(remaining == 0 ? "Has marcado todas las comidas de hoy." : "Márcalas según las vayas haciendo.")
                    .font(.apSubhead).foregroundStyle(Palette.muted)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    /// Los tres macros: tres columnas en horizontal y apilados con texto grande (cada fila
    /// conserva su barra a todo el ancho, así el porcentaje y los gramos no se parten).
    @ViewBuilder private func macroRow(p: Double, c: Double, f: Double, energy: Double) -> some View {
        if dynamicTypeSize.isAccessibilitySize {
            VStack(alignment: .leading, spacing: 16) {
                macro("Proteína", p, energy > 0 ? p * 4 / energy : 0)
                macro("Carbos", c, energy > 0 ? c * 4 / energy : 0)
                macro("Grasas", f, energy > 0 ? f * 9 / energy : 0)
            }
        } else {
            HStack(alignment: .top, spacing: 16) {
                macro("Proteína", p, energy > 0 ? p * 4 / energy : 0)
                macro("Carbos", c, energy > 0 ? c * 4 / energy : 0)
                macro("Grasas", f, energy > 0 ? f * 9 / energy : 0)
            }
        }
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
                        Text(name).font(.apHeadline).foregroundStyle(isDone ? Palette.muted : Palette.foreground)
                            .fixedSize(horizontal: false, vertical: true)
                        if let d = meal.description { Text(d).font(.apSubhead).foregroundStyle(Palette.muted.opacity(isDone ? 0.6 : 1)).lineLimit(2) }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    // La foto ocupa lo mismo en todas las filas (56 · radio 12), como en el esqueleto.
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
        .accessibilityValue(isDone ? "hecha" : "pendiente")
        .accessibilityHint(isDone ? "Desmarca esta comida" : "Marca esta comida como hecha")
    }

    private func toggle(_ name: String) {
        let wasDone = done.contains(name)
        if wasDone {
            done.remove(name)
            Haptics.selection()
        } else {
            done.insert(name)
            // Al completar todas las comidas del día, un éxito claro (como el checklist del entreno).
            if !meals.isEmpty && done.count == meals.count { Haptics.success() } else { Haptics.tap() }
        }
        if let data = try? JSONEncoder().encode(Array(done)) { UserDefaults.standard.set(data, forKey: doneKey) }
    }

    private func load() async {
        guard !loading else { return }
        loading = true
        defer { loading = false }

        // Lo marcado del día es local: se pinta de inmediato y no depende de la red.
        if let data = UserDefaults.standard.data(forKey: doneKey), let arr = try? JSONDecoder().decode([String].self, from: data) { done = Set(arr) }
        guard let id = session.userId else { loaded = true; failed = false; return }

        do {
            let row = try await fetchPlan(id)
            // Sin Plus la RLS no deja leer el plan: los macros se calculan con el onboarding
            // (misma fórmula que `resolveNutritionPreview` de la web). Los macros son siempre gratis.
            macros = row?.macros_json
            if macros?.protein == nil && macros?.calories == nil { macros = await estimatedMacros(id) }
            meals = row?.meals_json ?? []
            // La portada se resuelve desde caché antes de pintar: sin parpadeo ni salto.
            let coverDish = meals.first?.description ?? Self.defaultDish
            if !meals.isEmpty {
                cover = AiCover.cachedMeal(coverDish) ?? AiCover.mealFallback
            }
            loaded = true
            failed = false
            if !meals.isEmpty {
                // Portada y fotos de todas las comidas en paralelo; la lista ya está pintada.
                await prefetchCovers(coverDish: coverDish)
            } else if hasAccess == nil {
                // Sin comidas: con Plus se generan solas (el servidor vuelve a comprobar el acceso).
                // Lo decide el servidor: si responde «no_access», toca el aviso de Plus.
                await generateMeals()
            }
        } catch {
            // Si la vista se cerró a mitad de la carga no hay error que enseñar.
            if Task.isCancelled { return }
            // Con datos ya cargados se mantienen; sin datos es un fallo de red real.
            if macros == nil && meals.isEmpty { failed = true } else { loaded = true }
        }
    }

    /// Comidas del día con las preferencias del onboarding (`sync-nutrition-macros`, igual que la web).
    private func generateMeals() async {
        struct Body: Encodable { let regenerate_meals = true }
        struct Result: Decodable { let meals_updated: Bool?; let reason: String? }
        generating = true; generateFailed = false
        let result: Result? = try? await Backend.client.functions.invoke("sync-nutrition-macros", options: FunctionInvokeOptions(body: Body()))
        generating = false
        if result?.reason == "no_access" { hasAccess = false; return }
        hasAccess = true
        guard result?.meals_updated == true, let id = session.userId, let row = (try? await fetchPlan(id)) ?? nil else { generateFailed = true; return }
        macros = row.macros_json
        meals = row.meals_json ?? []
        if !meals.isEmpty { await prefetchCovers(coverDish: meals.first?.description ?? Self.defaultDish) }
    }

    /// Objetivo estimado con peso, sexo y objetivo del onboarding: kcal y proteína como la web;
    /// grasas al 25 % de las kcal y el resto en carbohidratos.
    private func estimatedMacros(_ id: UUID) async -> Macros? {
        struct O: Decodable { let weight: Double?; let sex: String?; let goal: String? }
        guard let o: O = try? await Backend.client.from("onboarding").select("weight, sex, goal").eq("user_id", value: id).single().execute().value,
              let w = o.weight, w > 30, w <= 300 else { return nil }
        let base = o.sex == "female" ? w * 28 : w * 32
        let kcal = max(1200, (o.goal == "lose_weight" ? base - 350 : o.goal == "gain_muscle" ? base + 300 : base).rounded())
        let protein = (w * 2).rounded()
        let fats = (kcal * 0.25 / 9).rounded()
        let carbs = max(0, ((kcal - protein * 4 - fats * 9) / 4).rounded())
        return Macros(calories: kcal, protein: protein, carbs: carbs, fats: fats)
    }

    /// Plan con reintentos y backoff: un fallo transitorio de red no debe dejar macros
    /// ni comidas vacíos para siempre.
    private func fetchPlan(_ id: UUID) async throws -> Row? {
        var lastError: Error?
        for attempt in 0..<Self.loadAttempts {
            if attempt > 0 {
                try? await Task.sleep(for: Self.retryBackoff[min(attempt - 1, Self.retryBackoff.count - 1)])
                if Task.isCancelled { throw CancellationError() }
            }
            do {
                let rows: [Row] = try await Backend.client.from("nutrition_plan").select("macros_json, meals_json")
                    .eq("user_id", value: id).limit(1).execute().value
                return rows.first
            } catch {
                lastError = error
            }
        }
        throw lastError ?? URLError(.unknown)
    }

    /// Precarga en paralelo la portada y la foto de cada plato. `MealPhoto` encontrará
    /// después la URL en caché, así que no se repiten las llamadas lentas a `session-cover`.
    private func prefetchCovers(coverDish: String) async {
        let dishes = Set(meals.map { $0.description ?? $0.name ?? "" }.filter { !$0.isEmpty && $0 != coverDish })
        async let coverURL = AiCover.meal(coverDish)
        async let photos: Void = prefetchPhotos(dishes)
        let resolved = await coverURL
        if !Task.isCancelled { cover = resolved }
        _ = await photos
    }

    /// Fotos de las comidas a la vez; `CoverStore` garantiza una sola petición por plato.
    private func prefetchPhotos(_ dishes: Set<String>) async {
        await withTaskGroup(of: Void.self) { group in
            for dish in dishes {
                group.addTask { _ = await AiCover.meal(dish) }
            }
        }
    }

    private func macro(_ label: String, _ grams: Double, _ share: Double) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 8) {
                Text(label).font(.apFootnote).foregroundStyle(Palette.muted)
                    .lineLimit(1).minimumScaleFactor(0.7)
                Spacer(minLength: 4)
                Text("\(Int((share * 100).rounded())) %").font(.apFootnote.monospacedDigit())
                    .foregroundStyle(Palette.muted).lineLimit(1)
            }
            (Text(NumberText.integer(Int(grams.rounded()))).font(.inter(size: 22, weight: .bold).monospacedDigit()) + Text("g").font(.apSubhead.weight(.semibold)).foregroundColor(Palette.muted))
                .lineLimit(1).minimumScaleFactor(0.7)
                .padding(.top, 2)
            GeometryReader { geo in
                Capsule().fill(Palette.gold.opacity(0.2))
                    .overlay(alignment: .leading) {
                        Capsule().fill(Palette.gold).frame(width: geo.size.width * max(0, min(1, share)))
                    }
            }
            .frame(height: 6).padding(.top, 8)
        }
        .frame(maxWidth: .infinity)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(label): objetivo diario de \(Int(grams)) gramos, \(Int(share * 100)) % de las calorías")
    }
}

/// Esqueleto de Nutrición mientras llega la red: portada, resumen y comidas como bloques
/// que laten suavemente, para que la pantalla no aparezca vacía ni dé un salto al cargar.
private struct NutritionSkeleton: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.horizontalSizeClass) private var sizeClass
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    @State private var pulsing = false

    var body: some View {
        let singleColumn = sizeClass == .compact || dynamicTypeSize.isAccessibilitySize
        // La misma rejilla que el contenido real: esqueleto de resumen y de comidas en dos
        // columnas en iPad/Mac y en una en el iPhone, para que al llegar los datos nada salte.
        LazyVGrid(columns: NutritionGrid.columns(singleColumn: singleColumn), alignment: .leading, spacing: singleColumn ? 32 : 24) {
            VStack(alignment: .leading, spacing: singleColumn ? 32 : 24) {
                RoundedRectangle(cornerRadius: Radius.hero, style: .continuous)
                    .fill(Palette.card)
                    .frame(height: 176)
                summarySkeleton
            }
            mealsSkeleton
        }
        .opacity(pulsing ? 0.5 : 1)
        .task {
            guard !reduceMotion else { return }
            withAnimation(.easeInOut(duration: 0.9).repeatForever(autoreverses: true)) { pulsing = true }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Cargando tu plan de comidas")
    }

    /// Fantasma del resumen: anillo y cifras arriba, macros debajo.
    private var summarySkeleton: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .top, spacing: 20) {
                Circle().stroke(Palette.secondary, lineWidth: 14).frame(width: 136, height: 136).padding(7)
                VStack(alignment: .leading, spacing: 10) {
                    bar(width: 132, height: 34)
                    bar(width: 104, height: 12)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.top, 8)
            }
            HStack(alignment: .top, spacing: 16) {
                bar(height: 44)
                bar(height: 44)
                bar(height: 44)
            }
            .padding(.top, 24)
            bar(width: 220, height: 11).padding(.top, 16)
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Palette.card, in: RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
    }

    /// Fantasma de «Comidas de hoy»: tres filas con check, textos y foto.
    private var mealsSkeleton: some View {
        VStack(alignment: .leading, spacing: 8) {
            // Mismo eje que las tarjetas (sin sangría).
            bar(width: 110, height: 11)
            VStack(spacing: 0) {
                ForEach(0..<3, id: \.self) { i in
                    HStack(spacing: 12) {
                        Circle().fill(Palette.secondary).frame(width: 24, height: 24)
                        VStack(alignment: .leading, spacing: 6) {
                            bar(height: 12)
                            bar(width: 140, height: 10)
                        }
                        Spacer(minLength: 0)
                        RoundedRectangle(cornerRadius: 12, style: .continuous).fill(Palette.secondary).frame(width: 56, height: 56)
                    }
                    .padding(.horizontal, 16)
                    .frame(minHeight: 72)
                    .overlay(alignment: .bottom) {
                        // 16 + 24 (check) + 12: el separador arranca donde el texto.
                        if i < 2 { Rectangle().fill(Palette.separator).frame(height: 0.5).padding(.leading, 52).padding(.trailing, 16) }
                    }
                }
            }
            .background(Palette.card, in: RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
        }
    }

    /// Bloque gris del esqueleto; sin ancho se estira a lo disponible.
    private func bar(width: CGFloat? = nil, height: CGFloat) -> some View {
        RoundedRectangle(cornerRadius: height / 2, style: .continuous)
            .fill(Palette.secondary)
            .frame(width: width, height: height)
            .frame(maxWidth: width == nil ? .infinity : nil, alignment: .leading)
    }
}

/// Rejilla de Nutrición: una columna en el iPhone y rejilla adaptativa en iPad/Mac, como el paso
/// a varias columnas (`md:`/`lg:`) de la web. El tope de 1000 pt evita tres columnas en una Mac
/// muy ancha y el máximo de 560 pt que las columnas se estiren feas.
private enum NutritionGrid {
    static func columns(singleColumn: Bool) -> [GridItem] {
        if singleColumn { return [GridItem(.flexible(), spacing: 24, alignment: .top)] }
        return [GridItem(.adaptive(minimum: 320, maximum: 560), spacing: 24, alignment: .top)]
    }

    /// Ancho máximo del contenido: la columna de siempre en el iPhone y hasta 1000 pt en iPad/Mac.
    static func contentWidth(singleColumn: Bool) -> CGFloat { singleColumn ? 720 : 1000 }
}

/// Tarjeta vacía de la web (EmptyState card), con foto opcional arriba.
private struct EmptyCard: View {
    let photo: String?
    let title: String
    let message: String
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var url: URL?

    init(photo: String?, title: String, message: String) {
        self.photo = photo
        self.title = title
        self.message = message
        // Caché sincrónica: si el plato ya tiene portada, se pinta en el primer frame.
        _url = State(initialValue: photo.flatMap { AiCover.cachedMeal($0) ?? AiCover.mealFallback })
    }

    /// EmptyState de la web: con foto, tarjeta alta con el texto abajo; sin foto, icono en su cuadrado tintado.
    var body: some View {
        Group {
            if let url {
                VStack(alignment: .leading, spacing: 0) {
                    Image("lu-clock").renderingMode(.template).resizable().frame(width: 24, height: 24).foregroundStyle(Palette.gold)
                    Text(title).font(.inter(size: 28, weight: .bold)).tracking(-0.7).padding(.top, 8)
                    Text(message).font(.apSubhead).foregroundStyle(Palette.muted).padding(.top, 4)
                }
                .padding(20)
                .frame(maxWidth: .infinity, minHeight: 288, alignment: .bottomLeading)
                .background {
                    CachedAsyncImage(url: url) { $0.resizable().scaledToFill() } placeholder: { Palette.card }
                        .opacity(0.9)
                        .overlay { LinearGradient(colors: [Palette.card, Palette.card.opacity(0.7), .clear], startPoint: .bottom, endPoint: .top) }
                        .clipped()
                }
                .background(Palette.card)
                .clipShape(RoundedRectangle(cornerRadius: 28, style: .continuous))
                .transition(.opacity)
            } else {
                VStack(alignment: .leading, spacing: 0) {
                    Spacer(minLength: 144)
                    Text(title).font(.inter(size: 28, weight: .bold)).tracking(-0.7).padding(.top, 8)
                    Text(message).font(.apSubhead).foregroundStyle(Palette.muted).padding(.top, 4)
                }
                .padding(20)
                .frame(maxWidth: .infinity, minHeight: 288, alignment: .bottomLeading)
                .background {
                    GeometryReader { geo in
                        ZStack(alignment: .topLeading) {
                            Circle().fill(RadialGradient(colors: [Palette.gold.opacity(0.25), .clear], center: .center, startRadius: 0, endRadius: 144))
                                .frame(width: 288, height: 288).offset(x: geo.size.width - 288 + 64, y: -80)
                            ZStack {
                                Circle().stroke(Palette.gold.opacity(0.2), lineWidth: 1.5).frame(width: 112, height: 112)
                                Circle().fill(Palette.gold.opacity(0.12)).frame(width: 112, height: 112)
                                Circle().stroke(Palette.gold.opacity(0.3), lineWidth: 1.5).frame(width: 80, height: 80)
                                Circle().fill(Palette.gold.opacity(0.18)).frame(width: 80, height: 80)
                                Circle().stroke(Palette.gold.opacity(0.5), lineWidth: 2).frame(width: 40, height: 40)
                            }
                            .shadow(color: Palette.gold.opacity(0.35), radius: 30)
                            .offset(x: geo.size.width - 112 - 32, y: 32)
                            ForEach([(0.22, 0.28), (0.38, 0.62), (0.16, 0.76), (0.50, 0.36), (0.30, 0.48)], id: \.0) { t, l in
                                Circle().fill(Palette.gold.opacity(0.4)).frame(width: 4, height: 4)
                                    .offset(x: l * geo.size.width, y: t * geo.size.height)
                            }
                        }
                    }
                    .accessibilityHidden(true)
                }
                .background(Palette.card)
                .clipShape(RoundedRectangle(cornerRadius: 28, style: .continuous))
            }
        }
        .task(id: photo) {
            guard let photo else { return }
            // Si cambia el plato se resuelve ya su foto (caché o respaldo), nunca la anterior.
            url = AiCover.cachedMeal(photo) ?? AiCover.mealFallback
            let resolved = await AiCover.meal(photo)
            guard !Task.isCancelled, let resolved, resolved != url else { return }
            withAnimation(reduceMotion ? nil : .easeInOut(duration: 0.2)) { url = resolved }
        }
    }
}

/// Foto del plato generada por `session-cover`.
struct MealPhoto: View {
    let dish: String
    @State private var url: URL?

    init(dish: String) {
        self.dish = dish
        // Caché sincrónica: el plato ya visto pinta su foto en el primer frame.
        _url = State(initialValue: AiCover.cachedMeal(dish) ?? AiCover.mealFallback)
    }

    var body: some View {
        ZStack {
            Palette.secondary
            if let url {
                CachedAsyncImage(url: url) { $0.resizable().scaledToFill() } placeholder: { Color.clear }
            }
        }
        .task(id: dish) {
            // Al cambiar el plato se descarta la foto anterior antes de resolver la nueva.
            url = AiCover.cachedMeal(dish) ?? AiCover.mealFallback
            let resolved = await AiCover.meal(dish)
            guard !Task.isCancelled, let resolved, resolved != url else { return }
            url = resolved
        }
        .accessibilityHidden(true)
    }
}

/// Portadas con IA de la edge function `session-cover` (como `useSessionCover.ts`): se guardan
/// por clave normalizada para que el mismo plato muestre siempre la misma foto entre recargas.
enum AiCover {
    /// Foto de plato de respaldo, la misma que usa la web (`BRAND_PHOTOS.meal`).
    static let mealFallback = URL(string: "https://autopilotplan.com/healthy_meal_plate.jpg")
    /// Antes era un único diccionario en UserDefaults; se conserva para migrar portadas ya guardadas.
    private static let legacyStore = "autopilot.aiCovers.v1"

    /// Igual que la web: si la IA no da foto, se muestra siempre la foto de respaldo.
    /// La petición es única por plato (`CoverStore`) y se cachea en memoria y en disco.
    static func meal(_ dish: String) async -> URL? {
        let text = normalized(dish)
        guard text.count >= 3 else { return mealFallback }
        return await CoverStore.shared.cover(key: cacheKey(for: text), dish: text) ?? mealFallback
    }

    /// URL ya guardada para el plato, sin `await` ni red: así la vista pinta la foto correcta
    /// en el primer frame (lectura sincrónica de caché, sin parpadeo).
    static func cachedMeal(_ dish: String) -> URL? {
        let text = normalized(dish)
        guard text.count >= 3 else { return nil }
        let key = cacheKey(for: text)
        if let stored = UserDefaults.standard.string(forKey: key) { return URL(string: stored) }
        return migrateLegacy(text: text, key: key)
    }

    // MARK: - Claves

    /// Normaliza el nombre del plato: sin espacios sobrantes, con espacios simples y 120 caracteres.
    private static func normalized(_ dish: String) -> String {
        let text = dish.split(whereSeparator: \.isWhitespace).joined(separator: " ")
        return String(text.prefix(120))
    }

    /// Clave estable y corta por plato (FNV-1a de 64 bits del texto en minúsculas).
    private static func cacheKey(for text: String) -> String {
        var hash: UInt64 = 0xcbf2_9ce4_8422_2325
        for byte in text.lowercased().utf8 {
            hash ^= UInt64(byte)
            hash = hash &* 0x0000_0100_0000_01b3
        }
        return "autopilot.aiCover.v2.\(String(hash, radix: 16))"
    }

    /// Formato anterior: si el plato ya tenía portada, se guarda con la clave nueva para no
    /// repetir la llamada lenta a la IA tras actualizar la app.
    private static func migrateLegacy(text: String, key: String) -> URL? {
        guard let legacy = UserDefaults.standard.dictionary(forKey: legacyStore) as? [String: String],
              let stored = legacy["m:\(text.lowercased())"], let url = URL(string: stored) else { return nil }
        UserDefaults.standard.set(url.absoluteString, forKey: key)
        return url
    }

    /// Llamada real a la edge function. Devuelve nil si falla para poder mostrar `mealFallback`.
    fileprivate static func request(_ dish: String) async -> URL? {
        struct Response: Decodable { let url: String? }
        guard let response: Response = try? await Backend.client.functions.invoke(
            "session-cover", options: FunctionInvokeOptions(body: ["meal": dish])),
            let stored = response.url, let url = URL(string: stored) else { return nil }
        return url
    }
}

/// Caché de portadas compartida: memoria + persistencia por clave y una sola petición en vuelo
/// por plato, así varias `MealPhoto` del mismo plato no lanzan llamadas lentas duplicadas.
private actor CoverStore {
    static let shared = CoverStore()
    private var memory: [String: URL] = [:]
    private var inflight: [String: Task<URL?, Never>] = [:]
    /// Instante del último fallo por plato: no se reintenta durante un minuto para no castigar
    /// a la edge function (lenta) en cada redibujado.
    private var failedAt: [String: Date] = [:]

    func cover(key: String, dish: String) async -> URL? {
        if let hit = memory[key] { return hit }
        if let hit = AiCover.cachedMeal(dish) { memory[key] = hit; return hit }
        if let running = inflight[key] { return await running.value }
        if let at = failedAt[key], Date().timeIntervalSince(at) < 60 { return nil }
        let task = Task.detached(priority: .utility) { await AiCover.request(dish) }
        inflight[key] = task
        let result = await task.value
        inflight[key] = nil
        if let result {
            memory[key] = result
            failedAt[key] = nil
            UserDefaults.standard.set(result.absoluteString, forKey: key)
        } else {
            failedAt[key] = Date()
        }
        return result
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
            .accessibilityElement(children: .combine)
            .accessibilityLabel("Cliente: \(c.name ?? "sin nombre")")
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
