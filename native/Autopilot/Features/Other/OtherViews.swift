import SwiftUI
import Supabase

/// Nutrición, calcada de `MealsList.tsx`: resumen con anillo de comidas hechas y objetivos, y
/// «Comidas de hoy» marcables con la foto propia de cada plato (o «Sin comidas todavía»).
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
    /// Foto propia de cada plato (clave: el plato). Sin foto propia, la fila va sin foto.
    @State private var photos: [String: URL] = [:]
    /// Sin comidas: nil = comprobando, true = tiene Plus (se generan), false = aviso de Plus.
    @State private var hasAccess: Bool?
    @State private var generating = false
    @State private var generateFailed = false
    /// Confirmación de «Regenerar comidas» (como en la web).
    @State private var confirmingNew = false
    /// Plus sin preferencias de comidas: se le preguntan antes de prepararlas (como la web).
    @State private var needsSetup = false
    struct Macros: Codable { let calories: Double?; let protein: Double?; let carbs: Double?; let fats: Double? }
    /// Ingredientes con su peso (para pesarlos) y gramos de cada macro si la IA los dio; sin
    /// macros, la comida cuenta como una parte igual del día.
    struct Meal: Codable, Hashable {
        let name: String?; let description: String?
        var ingredients: [Ingredient]? = nil
        var protein: Double? = nil; var carbs: Double? = nil; var fats: Double? = nil
        /// Ingredientes válidos con su cantidad lista para pintar («80 g», «200 ml»), como `mealIngredients`.
        var weighed: [(food: String, amount: String)] {
            (ingredients ?? []).compactMap { i in
                guard let food = i.food?.trimmingCharacters(in: .whitespaces), !food.isEmpty, let g = i.grams, g > 0 else { return nil }
                return (food, "\(Int(g.rounded())) \(i.unit == "ml" ? "ml" : "g")")
            }
        }
    }
    /// Todo opcional: un ingrediente incompleto se descarta sin romper la carga del plan.
    struct Ingredient: Codable, Hashable { let food: String?; let grams: Double?; var unit: String? = nil }
    /// Macros de una comida ya cuadrados con el objetivo del día (enteros).
    struct MealMacros: Equatable { var kcal = 0; var protein = 0; var carbs = 0; var fats = 0 }
    struct Row: Codable { let macros_json: Macros?; let meals_json: [Meal]? }
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
        } else {
            // Escritorio (md/lg de la web): el resumen (portada, objetivos/macros y avisos) y las
            // comidas en dos columnas. En el iPhone la rejilla se queda en una y conserva el orden.
            LazyVGrid(columns: NutritionGrid.columns(singleColumn: singleColumn || !hasMeals), alignment: .leading, spacing: singleColumn ? 32 : 24) {
                VStack(alignment: .leading, spacing: singleColumn ? 32 : 24) {
                    if hasMeals || showTargets { summary(kcal: kcal, p: p, c: c, f: f, energy: energy, hasMeals: hasMeals, showTargets: showTargets) }
                    if hasMeals && macros == nil { macroNotice }
                }
                if hasMeals {
                    mealsSection
                } else {
                    if needsSetup, let id = session.userId {
                        NutritionSetupView(userId: id) {
                            needsSetup = false
                            Task { await generateMeals() }
                        }
                    } else if hasAccess == false {
                        // Como `MealsPlusCard` de la web; en iOS sin enlace a pagos externos.
                        EmptyCard(photo: Self.defaultDish, title: "Tus comidas, hechas para ti",
                                  message: "Con Plus te preguntamos qué te gusta y qué no comes, y Autopilot te prepara las comidas de cada día ajustadas a tus macros. Incluido en Plus.")
                    } else if generating || hasAccess == nil {
                        EmptyCard(photo: Self.defaultDish, title: "Preparando tus comidas…",
                                  message: "Autopilot está creando tus comidas con tus gustos y lo que no comes.")
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
                let split = perMeal
                ForEach(Array(meals.enumerated()), id: \.offset) { i, meal in
                    mealRow(meal, own: split.indices.contains(i) ? split[i] : nil, last: i == meals.count - 1)
                }
            }
            .background(Palette.card, in: RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
            // Comidas nuevas cuando quieras, como en la web: solo cambian las comidas, no el entreno.
            Button(generating ? "Regenerando comidas…" : "Regenerar comidas") { Haptics.tap(); confirmingNew = true }
                .buttonStyle(.pillSecondary).disabled(generating).padding(.top, 4)
            if generateFailed && !generating {
                Text("No se pudieron regenerar las comidas. Inténtalo de nuevo en unos minutos.")
                    .font(.apFootnote).foregroundStyle(Palette.muted)
            }
        }
        .alert("¿Regenerar tus comidas?", isPresented: $confirmingNew) {
            Button("Ahora no", role: .cancel) {}
            Button("Regenerar comidas") { Task { await generateMeals() } }
        } message: {
            Text("Recalcularemos el plan de comidas con tus datos actuales y sustituirá a las comidas guardadas cuando termine. El plan de entrenamiento no cambia.")
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
        let doneCount = meals.filter { done.contains($0.name ?? "Comida") }.count
        // Con comidas, lo marcado se suma al resumen; marcadas todas, da el objetivo exacto.
        let split = hasMeals && showTargets ? perMeal : []
        let eaten: MealMacros? = split.isEmpty ? nil : zip(meals, split)
            .filter { done.contains($0.0.name ?? "Comida") }
            .reduce(MealMacros()) { s, m in MealMacros(kcal: s.kcal + m.1.kcal, protein: s.protein + m.1.protein, carbs: s.carbs + m.1.carbs, fats: s.fats + m.1.fats) }
        return VStack(alignment: .leading, spacing: 0) {
            Group {
                if dynamicTypeSize.isAccessibilitySize {
                    VStack(alignment: .leading, spacing: 16) {
                        if hasMeals { mealsRing(doneCount: doneCount) } else if showTargets { macroRing(kcal: kcal, p: p, c: c, f: f) }
                        // Con el anillo de macros las kcal ya van dentro: aquí solo el rótulo.
                        if hasMeals || !showTargets { summaryNumbers(kcal: kcal, hasMeals: hasMeals, showTargets: showTargets, doneCount: doneCount, eatenKcal: eaten?.kcal) }
                        else { Text("Objetivo diario").font(.apTitle3) }
                    }
                } else {
                    HStack(alignment: .center, spacing: 20) {
                        if hasMeals { mealsRing(doneCount: doneCount) } else if showTargets { macroRing(kcal: kcal, p: p, c: c, f: f) }
                        // Con el anillo de macros las kcal ya van dentro: aquí solo el rótulo.
                        if hasMeals || !showTargets { summaryNumbers(kcal: kcal, hasMeals: hasMeals, showTargets: showTargets, doneCount: doneCount, eatenKcal: eaten?.kcal) }
                        else { Text("Objetivo diario").font(.apTitle3) }
                    }
                }
            }
            if showTargets {
                macroRow(p: p, c: c, f: f, energy: energy, eaten: eaten).padding(.top, 24)
                Text(eaten != nil ? "Al marcar una comida se suman sus macros del plan. Es una estimación: no se pesa lo que comes." : "Objetivos de tu plan para hoy.")
                    .font(.apFootnote).foregroundStyle(Palette.muted)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.top, 16)
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Palette.card, in: RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
    }

    /// Sin comidas: anillo con el reparto de macros (proteína, carbos, grasas) y las kcal dentro.
    private func macroRing(kcal: Double, p: Double, c: Double, f: Double) -> some View {
        let parts = [p * 4, c * 4, f * 9]
        let total = max(1, parts.reduce(0, +))
        let shades = [Palette.gold, Palette.gold.opacity(0.6), Palette.gold.opacity(0.32)]
        let gap = 0.012
        return ZStack {
            Circle().stroke(Palette.secondary, lineWidth: 14)
            ForEach(0..<3, id: \.self) { i in
                let start = parts[..<i].reduce(0, +) / total
                let end = start + parts[i] / total
                Circle().trim(from: start + gap, to: max(start + gap, end - gap))
                    .stroke(shades[i], style: StrokeStyle(lineWidth: 14, lineCap: .round)).rotationEffect(.degrees(-90))
            }
            VStack(spacing: 2) {
                Text(NumberText.integer(Int(kcal))).font(.figure(size: 40)).lineLimit(1).minimumScaleFactor(0.6)
                Text("kcal").font(.apFootnote).foregroundStyle(Palette.muted)
            }
        }
        .frame(width: 136, height: 136).padding(7)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Objetivo de \(Int(kcal)) kilocalorías: \(Int(p)) g de proteína, \(Int(c)) g de carbohidratos y \(Int(f)) g de grasas")
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
    private func summaryNumbers(kcal: Double, hasMeals: Bool, showTargets: Bool, doneCount: Int, eatenKcal: Int?) -> some View {
        let remaining = meals.count - doneCount
        return VStack(alignment: .leading, spacing: 6) {
            if showTargets {
                Text(NumberText.integer(eatenKcal ?? Int(kcal.rounded())))
                    .font(.inter(size: hasMeals ? 34 : 48, weight: .bold).monospacedDigit())
                    .lineLimit(1).minimumScaleFactor(0.6)
                    .contentTransition(.numericText())
                    .animation(reduceMotion ? nil : .snappy, value: eatenKcal)
                Text(eatenKcal != nil ? "de \(NumberText.integer(Int(kcal.rounded()))) kcal" : "kcal de objetivo diario").font(.apSubhead).foregroundStyle(Palette.muted)
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
    @ViewBuilder private func macroRow(p: Double, c: Double, f: Double, energy: Double, eaten: MealMacros?) -> some View {
        if dynamicTypeSize.isAccessibilitySize {
            VStack(alignment: .leading, spacing: 16) {
                macro("Proteína", p, energy > 0 ? p * 4 / energy : 0, eaten: eaten?.protein)
                macro("Carbos", c, energy > 0 ? c * 4 / energy : 0, eaten: eaten?.carbs)
                macro("Grasas", f, energy > 0 ? f * 9 / energy : 0, eaten: eaten?.fats)
            }
        } else {
            HStack(alignment: .top, spacing: 16) {
                macro("Proteína", p, energy > 0 ? p * 4 / energy : 0, eaten: eaten?.protein)
                macro("Carbos", c, energy > 0 ? c * 4 / energy : 0, eaten: eaten?.carbs)
                macro("Grasas", f, energy > 0 ? f * 9 / energy : 0, eaten: eaten?.fats)
            }
        }
    }

    private func mealRow(_ meal: Meal, own: MealMacros?, last: Bool) -> some View {
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
                        let weighed = meal.weighed
                        if !weighed.isEmpty {
                            // Peso de cada ingrediente para pesarlo en báscula.
                            VStack(alignment: .leading, spacing: 2) {
                                ForEach(Array(weighed.enumerated()), id: \.offset) { _, item in
                                    HStack(alignment: .firstTextBaseline, spacing: 12) {
                                        Text(item.food).fixedSize(horizontal: false, vertical: true)
                                        Spacer(minLength: 0)
                                        Text(item.amount).monospacedDigit()
                                    }
                                }
                            }
                            .font(.apFootnote).foregroundStyle(isDone ? Palette.muted.opacity(0.6) : Palette.foreground.opacity(0.8))
                            .padding(.top, 4)
                        }
                        if let own {
                            Text("\(NumberText.integer(own.kcal)) kcal · P \(own.protein) g · C \(own.carbs) g · G \(own.fats) g")
                                .font(.apFootnote.monospacedDigit()).foregroundStyle(Palette.muted.opacity(isDone ? 0.6 : 1))
                                .padding(.top, 2)
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    // Solo la foto propia del plato (56 · radio 12); sin ella, ninguna: nunca la misma repetida.
                    if let url = photos[Self.dish(meal)] {
                        MealPhoto(url: url).frame(width: 56, height: 56)
                            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous)).opacity(isDone ? 0.5 : 1)
                    }
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

        // La última copia del plan se pinta al instante; la red la sustituye después.
        if !loaded, let cached = Snapshots.load(Row.self, Self.cacheKey(id)) {
            macros = cached.macros_json
            meals = cached.meals_json ?? []
            photos = Self.cachedPhotos(meals)
            loaded = true
        }

        do {
            let row = try await fetchPlan(id)
            if let row { Snapshots.save(row, Self.cacheKey(id)) }
            // Sin Plus la RLS no deja leer el plan: los macros se calculan con el onboarding
            // (misma fórmula que `resolveNutritionPreview` de la web). Los macros son siempre gratis.
            macros = row?.macros_json
            if macros?.protein == nil && macros?.calories == nil { macros = await estimatedMacros(id) }
            meals = row?.meals_json ?? []
            // Las fotos ya guardadas se pintan en el primer frame: sin parpadeo ni salto.
            photos = Self.cachedPhotos(meals)
            loaded = true
            failed = false
            if !meals.isEmpty {
                // Fotos de todas las comidas en paralelo; la lista ya está pintada.
                await prefetchPhotos()
            } else if hasAccess == nil {
                // Sin comidas: con Plus se generan solas (el servidor vuelve a comprobar el acceso).
                // Lo decide el servidor: si responde «no_access», toca el aviso de Plus.
                await prepareMeals(id)
            }
        } catch {
            // Si la vista se cerró a mitad de la carga no hay error que enseñar.
            if Task.isCancelled { return }
            // Con datos ya cargados se mantienen; sin datos es un fallo de red real.
            if macros == nil && meals.isEmpty { failed = true } else { loaded = true }
        }
    }

    /// Copia en disco del plan por usuario (macros y comidas).
    static func cacheKey(_ id: UUID) -> String { "nutrition|\(id.uuidString.lowercased())" }

    /// Si nunca dijo qué le gusta comer, primero se comprueba el acceso (sin generar nada) y,
    /// con Plus, se le pregunta; si ya lo dijo, se preparan las comidas directamente.
    private func prepareMeals(_ id: UUID) async {
        struct Prefs: Decodable { let nutrition_preferences: String? }
        let prefs: Prefs? = try? await Backend.client.from("onboarding").select("nutrition_preferences")
            .eq("user_id", value: id).single().execute().value
        if let p = prefs?.nutrition_preferences, !p.trimmingCharacters(in: .whitespaces).isEmpty {
            await generateMeals()
            return
        }
        struct Result: Decodable { let reason: String? }
        let result: Result? = try? await Backend.client.functions.invoke("sync-nutrition-macros", options: FunctionInvokeOptions(body: [String: String]()))
        if result?.reason == "no_access" { hasAccess = false; return }
        hasAccess = true
        needsSetup = true
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
        photos = Self.cachedPhotos(meals)
        if !meals.isEmpty { await prefetchPhotos() }
    }

    /// Objetivo estimado con peso, sexo y objetivo del onboarding: kcal y proteína como la web;
    /// grasas al 25 % de las kcal y el resto en carbohidratos.
    private func estimatedMacros(_ id: UUID) async -> Macros? {
        guard let e = await MacroEstimate.load(userId: id) else { return nil }
        return Macros(calories: e.kcal, protein: e.p, carbs: e.c, fats: e.f)
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

    /// Plato de la comida: la clave de su foto.
    static func dish(_ meal: Meal) -> String { meal.description ?? meal.name ?? "Comida" }

    /// Fotos propias ya guardadas, sin red, para pintarlas en el primer frame.
    static func cachedPhotos(_ meals: [Meal]) -> [String: URL] {
        var found: [String: URL] = [:]
        for meal in meals {
            let dish = dish(meal)
            if let url = AiCover.cachedMeal(dish) { found[dish] = url }
        }
        return found
    }

    /// Fotos de las comidas a la vez; `CoverStore` garantiza una sola petición por plato.
    /// Solo se guardan las propias de cada plato: sin foto propia, la fila va sin foto.
    private func prefetchPhotos() async {
        let dishes = Set(meals.map(Self.dish).filter { photos[$0] == nil })
        guard !dishes.isEmpty else { return }
        let found = await withTaskGroup(of: (String, URL?).self, returning: [String: URL].self) { group in
            for dish in dishes {
                group.addTask { (dish, await AiCover.ownMeal(dish)) }
            }
            var found: [String: URL] = [:]
            for await (dish, url) in group { if let url { found[dish] = url } }
            return found
        }
        if !Task.isCancelled { photos.merge(found) { _, new in new } }
    }

    /// Macro del día. Con comidas (`eaten`), lo marcado sobre el objetivo; sin ellas, el objetivo
    /// y qué parte de la energía aporta.
    private func macro(_ label: String, _ grams: Double, _ share: Double, eaten: Int?) -> some View {
        let target = Int(grams.rounded())
        let fill = eaten.map { grams > 0 ? Double($0) / Double(max(1, target)) : 0 } ?? share
        return VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 8) {
                Text(label).font(.apFootnote).foregroundStyle(Palette.muted)
                    .lineLimit(1).minimumScaleFactor(0.7)
                Spacer(minLength: 4)
                if eaten == nil {
                    Text("\(Int((share * 100).rounded())) %").font(.apFootnote.monospacedDigit())
                        .foregroundStyle(Palette.muted).lineLimit(1)
                }
            }
            (Text(NumberText.integer(eaten ?? target)).font(.inter(size: 22, weight: .bold).monospacedDigit()) + Text(eaten != nil ? "/\(NumberText.integer(target)) g" : "g").font(.apSubhead.weight(.semibold)).foregroundColor(Palette.muted))
                .lineLimit(1).minimumScaleFactor(0.7)
                .padding(.top, 2)
            GeometryReader { geo in
                Capsule().fill(Palette.gold.opacity(0.2))
                    .overlay(alignment: .leading) {
                        Capsule().fill(Palette.gold).frame(width: geo.size.width * max(0, min(1, fill)))
                            .animation(reduceMotion ? nil : .snappy, value: fill)
                    }
            }
            .frame(height: 6).padding(.top, 8)
        }
        .frame(maxWidth: .infinity)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(eaten.map { "\(label): \($0) de \(target) gramos" } ?? "\(label): objetivo diario de \(Int(grams)) gramos, \(Int(share * 100)) % de las calorías")
    }

    /// Macros de cada comida cuadrados con el objetivo (como `mealMacros.ts`); vacío sin objetivo.
    private var perMeal: [MealMacros] {
        guard !meals.isEmpty, let m = macros else { return [] }
        let p = m.protein ?? 0, c = m.carbs ?? 0, f = m.fats ?? 0
        let kcal = (m.calories ?? 0) > 0 ? m.calories! : (p * 4 + c * 4 + f * 9).rounded()
        guard kcal > 0 else { return [] }
        return Self.mealMacros(meals, kcal: kcal, protein: p, carbs: c, fats: f)
    }

    /// Reparte proteína, carbos y grasas entre las comidas (en la proporción de la IA o a partes
    /// iguales) y las kcal según su energía: todo suma exactamente el objetivo del día.
    static func mealMacros(_ meals: [Meal], kcal: Double, protein: Double, carbs: Double, fats: Double) -> [MealMacros] {
        let p = splitExact(protein, weights(meals) { $0.protein })
        let c = splitExact(carbs, weights(meals) { $0.carbs })
        let f = splitExact(fats, weights(meals) { $0.fats })
        let k = splitExact(kcal, meals.indices.map { Double(p[$0] * 4 + c[$0] * 4 + f[$0] * 9) })
        return meals.indices.map { MealMacros(kcal: k[$0], protein: p[$0], carbs: c[$0], fats: f[$0]) }
    }

    private static func weights(_ meals: [Meal], _ value: (Meal) -> Double?) -> [Double] {
        let own = meals.allSatisfy { value($0).map { $0.isFinite && $0 >= 0 } ?? false }
        return meals.map { own ? value($0) ?? 1 : 1 }
    }

    /// Reparte `total` (redondeado) en enteros proporcionales a `weights` que suman exactamente `total`.
    static func splitExact(_ total: Double, _ weights: [Double]) -> [Int] {
        guard !weights.isEmpty else { return [] }
        let target = max(0, Int(total.rounded()))
        let sum = weights.reduce(0, +)
        let ws = sum > 0 ? weights : weights.map { _ in 1 }
        let wsum = sum > 0 ? sum : Double(ws.count)
        let raw = ws.map { Double(target) * $0 / wsum }
        var out = raw.map { Int($0.rounded(.down)) }
        var rest = target - out.reduce(0, +)
        // Mayor resto primero; a igualdad, la comida anterior (igual que la web).
        let order = raw.indices.sorted { a, b in
            let fa = raw[a] - raw[a].rounded(.down), fb = raw[b] - raw[b].rounded(.down)
            return fa != fb ? fa > fb : a < b
        }
        var k = 0
        while rest > 0 { out[order[k % order.count]] += 1; k += 1; rest -= 1 }
        return out
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
            summarySkeleton
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

/// Foto de la tarjeta vacía: el plato del propio paquete debajo y, cuando llega, la foto
/// buena encima. Así la tarjeta nunca se queda en blanco si la red o la IA fallan.
private struct EmptyCardPhoto: View {
    let url: URL?

    var body: some View {
        ZStack {
            Image("meal-dish").resizable().scaledToFill()
            if let url {
                CachedAsyncImage(url: url) { $0.resizable().scaledToFill() } placeholder: { Color.clear }
            }
        }
        .accessibilityHidden(true)
    }
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
                    // La foto se ajusta al hueco de la tarjeta (en Mac la tarjeta es ancha y, sin
                    // este marco, la imagen no se dibujaba). El plato va en el propio paquete:
                    // se ve al instante y, si la foto de la IA no llega, nunca queda en blanco.
                    Color.clear
                        .overlay { EmptyCardPhoto(url: url) }
                        .clipped()
                        .opacity(0.9)
                        .overlay { LinearGradient(colors: [Palette.card, Palette.card.opacity(0.7), .clear], startPoint: .bottom, endPoint: .top) }
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
            // Solo se usa una foto que de verdad descarga; si no, la del plato de referencia.
            let cached = AiCover.cachedMeal(photo)
            if let cached, await ImageCache.shared.load(cached) != nil { url = cached } else { url = AiCover.mealFallback }
            let resolved = await AiCover.meal(photo)
            guard !Task.isCancelled, let resolved, resolved != url, await ImageCache.shared.load(resolved) != nil else { return }
            withAnimation(reduceMotion ? nil : .easeInOut(duration: 0.2)) { url = resolved }
        }
    }
}

/// Foto propia del plato generada por `session-cover`; la fila solo la pinta si existe.
struct MealPhoto: View {
    let url: URL

    var body: some View {
        ZStack {
            Palette.secondary
            CachedAsyncImage(url: url) { $0.resizable().scaledToFill() } placeholder: { Color.clear }
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

    /// Tarjetas vacías, igual que la web: si la IA no da foto, la foto de respaldo.
    static func meal(_ dish: String) async -> URL? {
        await ownMeal(dish) ?? mealFallback
    }

    /// Foto propia del plato o nil: las filas de comidas nunca repiten el respaldo.
    /// La petición es única por plato (`CoverStore`) y se cachea en memoria y en disco.
    static func ownMeal(_ dish: String) async -> URL? {
        let text = normalized(dish)
        guard text.count >= 3 else { return nil }
        return await CoverStore.shared.cover(key: cacheKey(for: text), dish: text)
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
