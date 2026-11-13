import SwiftUI
import Supabase

/// Nutrición, calcada de `MealsList.tsx`: resumen con anillo de comidas hechas y objetivos, y
/// «Comidas de hoy» marcables con la foto propia de cada plato (o «Sin comidas todavía»).
struct NutritionView: View {
    @EnvironmentObject private var session: SessionModel
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    /// Ancho de la ventana: márgenes de móvil en el iPhone y de escritorio en iPad.
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
    /// Se recuerda por usuario: al volver a abrir no aparece el estado de «preparando» de Plus.
    @State private var hasAccess: Bool?
    /// El acceso guardado se vuelve a confirmar una vez por apertura (por si cambió el plan).
    @State private var accessChecked = false
    /// Mientras el servidor confirma el acceso no se enseña ninguna tarjeta (ni «Preparando…» ni «Sin comidas»).
    @State private var preparing = false
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

    /// iPhone (o texto muy grande): márgenes de móvil. Nutrición va siempre en una columna.
    private var singleColumn: Bool { sizeClass == .compact || dynamicTypeSize.isAccessibilitySize }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 32) {
                if failed {
                    retryCard
                } else if loaded {
                    // Subtítulo de la maqueta, bajo el título grande (en Mac la barra lleva su pista).
                    #if os(iOS)
                    if singleColumn {
                        Text("Controla tu alimentación y alcanza tu objetivo.")
                            .font(.apSubhead).foregroundStyle(Palette.muted)
                            .fixedSize(horizontal: false, vertical: true)
                            .padding(.bottom, -16)
                    }
                    #endif
                    content
                } else {
                    // Skeleton en vez de una pantalla vacía mientras llega la red.
                    NutritionSkeleton()
                }
            }
            .padding(.horizontal, pagePadding).padding(.top, 8).padding(.bottom, 24)
            // Una columna en todas partes, como la web: en iPad/Mac no se estira de lado a lado.
            .frame(maxWidth: 680)
            .frame(maxWidth: .infinity)
        }
        .screenBackground()
        .task {
            #if DEBUG
            if ProcessInfo.processInfo.arguments.contains("-previewNutrition") {
                macros = Macros(calories: 2700, protein: 170, carbs: 330, fats: 90)
                meals = [
                    Meal(name: "Desayuno", description: "Avena con yogur griego, arándanos y almendras", protein: 40, carbs: 62, fats: 14),
                    Meal(name: "Comida", description: "Pollo a la plancha con arroz integral y verduras", protein: 52, carbs: 78, fats: 20),
                    Meal(name: "Merienda", description: "Tostada con pavo y aguacate", protein: 22, carbs: 28, fats: 12),
                    Meal(name: "Cena", description: "Salmón al horno con patata y ensalada", protein: 42, carbs: 60, fats: 26),
                ]
                done = ["Desayuno", "Comida"]
                hasAccess = true
                loaded = true
                return
            }
            #endif
            await load()
        }
    }

    /// Lo que Plus añade a Nutrición (`NUTRITION_PLUS_ROWS` de la web): solo funciones reales.
    struct PlusRow: Hashable { let symbol: String; let title: String; let detail: String }
    static let plusRows = [
        PlusRow(symbol: "fork.knife", title: "Comidas de cada día", detail: "Ajustadas a tus macros y a lo que te gusta."),
        PlusRow(symbol: "chart.bar", title: "Seguimiento de macros", detail: "Marca cada comida y se suman sus macros."),
        PlusRow(symbol: "arrow.triangle.2.circlepath", title: "Menú a tu gusto", detail: "Regenera tus comidas cuando quieras."),
    ]

    /// «Más en Plus» (maqueta de ChatGPT): filas con candado; sin enlace a pagos externos en la app.
    private var plusSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            VStack(alignment: .leading, spacing: 2) {
                Text("Registra tus comidas").font(.apTitle2)
                Text("Disponible en Plus.").font(.apSubhead).foregroundStyle(Palette.muted)
            }
            // Un solo grupo sin bordes (menos tarjetas, como la maqueta): filas separadas por una línea fina.
            VStack(spacing: 0) {
                ForEach(Array(Self.plusRows.enumerated()), id: \.offset) { i, row in
                    HStack(spacing: 14) {
                        Image(systemName: row.symbol).font(.system(size: 16)).foregroundStyle(Palette.muted)
                            .frame(width: 36, height: 36)
                            .background(Palette.secondary, in: RoundedRectangle(cornerRadius: 11, style: .continuous))
                            .accessibilityHidden(true)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(row.title).font(.apHeadline)
                            Text(row.detail).font(.apFootnote).foregroundStyle(Palette.muted)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        Image(systemName: "lock.fill").font(.system(size: 13, weight: .semibold)).foregroundStyle(Palette.gold)
                            .accessibilityLabel("Incluido en Plus")
                    }
                    .padding(.horizontal, 16).padding(.vertical, 12)
                    .frame(maxWidth: .infinity, minHeight: 72, alignment: .leading)
                    .overlay(alignment: .bottom) {
                        if i < Self.plusRows.count - 1 {
                            Rectangle().fill(Palette.separator).frame(height: 0.5).padding(.leading, 66)
                        }
                    }
                }
            }
            .surface()
            Text("Incluido en Plus").font(.apFootnote.weight(.semibold)).foregroundStyle(Palette.gold)
        }
    }

    @ViewBuilder private var content: some View {
        let p = macros?.protein ?? 0, c = macros?.carbs ?? 0, f = macros?.fats ?? 0
        let energy = p * 4 + c * 4 + f * 9
        let kcal = (macros?.calories ?? 0) > 0 ? macros!.calories! : energy.rounded()
        let hasMeals = !meals.isEmpty
        let showTargets = macros != nil && kcal > 0
        if !hasMeals && kcal <= 0 {
            // Sin peso no hay macros: se pide aquí mismo (gratis), nunca una pantalla sin salida.
            VStack(alignment: .leading, spacing: 32) {
                if let id = session.userId { MacrosWeightCard(userId: id) { await load() } }
                if hasAccess == false {
                    // Sin Plus (la RLS no deja leer el plan): «Más en Plus» debajo, como la web.
                    plusSection
                }
            }
        } else {
            // Una sola columna, como la web (también en Mac): el resumen arriba y las comidas debajo.
            VStack(alignment: .leading, spacing: 32) {
                VStack(alignment: .leading, spacing: 32) {
                    // Sin comidas, la tarjeta de calorías de la maqueta; con comidas, el resumen con su anillo.
                    // Anillo de calorías y barras de macros (maqueta de ChatGPT); con comidas suman lo marcado.
                    if showTargets {
                        nutritionHero(kcal: kcal, p: p, c: c, f: f, eaten: hasMeals ? eatenToday : nil,
                                      note: hasMeals ? "Al marcar una comida se suman sus macros del plan. Es una estimación: no se pesa lo que comes."
                                        : "Estimación inicial según tus datos y objetivo. No sustituye una valoración nutricional individual.")
                    } else if hasMeals {
                        mealsSummary
                    }
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
                        // Como `NutritionPlusSection` de la web; en iOS sin enlace a pagos externos.
                        plusSection
                    } else if generating {
                        EmptyCard(photo: Self.defaultDish, title: "Preparando tus comidas…",
                                  message: "Autopilot está creando tus comidas con tus gustos y lo que no comes.")
                    } else if hasAccess == nil || preparing {
                        // Aún no se sabe si hay Plus: nada de «preparando» ni foto de plato (eso es de Plus).
                        EmptyView()
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

    /// «Comidas de hoy»: cabecera con la acción de regenerar (como «Editar» de la maqueta) y filas
    /// marcables con su foto, sus kcal y sus macros.
    private var mealsSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .firstTextBaseline) {
                Text("Comidas de hoy").font(.apTitle3)
                    .accessibilityAddTraits(.isHeader)
                Spacer(minLength: 8)
                Button(generating ? "Regenerando…" : "Regenerar") { Haptics.tap(); confirmingNew = true }
                    .font(.apSubhead.weight(.semibold))
                    .foregroundStyle(generating ? Palette.muted : Palette.gold)
                    .frame(minHeight: 44)
                    .disabled(generating)
                    .accessibilityHint("Cambia las comidas de hoy por otras nuevas")
            }
            VStack(spacing: 0) {
                let split = perMeal
                ForEach(Array(meals.enumerated()), id: \.offset) { i, meal in
                    mealRow(meal, own: split.indices.contains(i) ? split[i] : nil, last: i == meals.count - 1)
                }
            }
            .surface()
            if generateFailed && !generating {
                HStack(spacing: 10) {
                    Image(systemName: "exclamationmark.triangle").foregroundStyle(Palette.muted)
                    Text("No se pudieron regenerar las comidas. Inténtalo de nuevo en unos minutos.")
                        .font(.apFootnote).foregroundStyle(Palette.muted)
                }
                .padding(.top, 2)
                .accessibilityElement(children: .combine)
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

    /// Cabecera de la maqueta de ChatGPT (`NutritionHero.tsx`): el anillo de calorías manda y a su
    /// lado las tres barras de macros. Con comidas marcables suman lo marcado; sin ellas, el anillo
    /// reparte la energía del día entre proteína, hidratos y grasas.
    private func nutritionHero(kcal: Double, p: Double, c: Double, f: Double, eaten: MealMacros?, note: String) -> some View {
        let energy = p * 4 + c * 4 + f * 9
        let share = { (e: Double) in energy > 0 ? e / energy : 0 }
        let layout = dynamicTypeSize.isAccessibilitySize
            ? AnyLayout(VStackLayout(alignment: .leading, spacing: 20))
            : AnyLayout(HStackLayout(alignment: .center, spacing: 20))
        return VStack(alignment: .leading, spacing: 16) {
            layout {
                if let eaten { kcalRing(target: kcal, eaten: eaten.kcal) } else { macroRing(kcal: kcal, p: p, c: c, f: f) }
                VStack(alignment: .leading, spacing: 14) {
                    heroMacro("Proteína", grams: p, eaten: eaten?.protein, share: share(p * 4), shade: Self.splitShades[0])
                    heroMacro("Hidratos", grams: c, eaten: eaten?.carbs, share: share(c * 4), shade: Self.splitShades[1])
                    heroMacro("Grasas", grams: f, eaten: eaten?.fats, share: share(f * 9), shade: Self.splitShades[2])
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            Text(note).font(.apFootnote).foregroundStyle(Palette.muted)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(20)
        .frame(maxWidth: .infinity, alignment: .leading)
        .surface(Radius.hero)
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Resumen de hoy")
    }

    /// Lo marcado hoy, con el reparto exacto del plan (nil sin objetivos).
    private var eatenToday: MealMacros? {
        let split = perMeal
        guard !split.isEmpty else { return nil }
        return zip(meals, split)
            .filter { done.contains($0.0.name ?? "Comida") }
            .reduce(MealMacros()) { s, m in MealMacros(kcal: s.kcal + m.1.kcal, protein: s.protein + m.1.protein, carbs: s.carbs + m.1.carbs, fats: s.fats + m.1.fats) }
    }

    /// Oro, oro 60 % y oro 32 %: el mismo reparto en el anillo y en las barras (como la web).
    static let splitShades = [Palette.gold, Palette.gold.opacity(0.6), Palette.gold.opacity(0.32)]

    /// Cifra del centro del anillo y su pie.
    private func ringCenter(value: Int, caption: String) -> some View {
        VStack(spacing: 2) {
            Text(NumberText.integer(value)).font(.figure(size: 32)).lineLimit(1).minimumScaleFactor(0.6)
                .contentTransition(.numericText())
                .animation(reduceMotion ? nil : .snappy, value: value)
            Text(caption).font(.apFootnote).foregroundStyle(Palette.muted).lineLimit(1).minimumScaleFactor(0.7)
        }
        .padding(.horizontal, 16)
    }

    /// Con comidas: kcal marcadas sobre el objetivo.
    private func kcalRing(target: Double, eaten: Int) -> some View {
        let ratio = target > 0 ? max(0, min(1, Double(eaten) / target)) : 0
        return ZStack {
            Circle().stroke(Palette.gold.opacity(0.2), lineWidth: 12)
            Circle().trim(from: 0, to: ratio)
                .stroke(Palette.gold, style: StrokeStyle(lineWidth: 12, lineCap: .round)).rotationEffect(.degrees(-90))
                .animation(reduceMotion ? nil : .snappy, value: ratio)
            ringCenter(value: eaten, caption: "de \(NumberText.integer(Int(target.rounded()))) kcal")
        }
        .frame(width: 136, height: 136)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(eaten) de \(Int(target.rounded())) kilocalorías")
    }

    /// Sin comidas: anillo con el reparto de macros (proteína, hidratos, grasas) y las kcal dentro.
    private func macroRing(kcal: Double, p: Double, c: Double, f: Double) -> some View {
        let parts = [p * 4, c * 4, f * 9]
        let total = max(1, parts.reduce(0, +))
        let gap = 0.012
        return ZStack {
            Circle().stroke(Palette.secondary, lineWidth: 12)
            ForEach(0..<3, id: \.self) { i in
                let start = parts[..<i].reduce(0, +) / total
                let end = start + parts[i] / total
                Circle().trim(from: start + gap, to: max(start + gap, end - gap))
                    .stroke(Self.splitShades[i], style: StrokeStyle(lineWidth: 12, lineCap: .round)).rotationEffect(.degrees(-90))
                    .animation(reduceMotion ? nil : .snappy, value: end)
            }
            ringCenter(value: Int(kcal.rounded()), caption: "kcal al día")
        }
        .frame(width: 136, height: 136)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Objetivo de \(Int(kcal.rounded())) kilocalorías: \(Int(p)) g de proteína, \(Int(c)) g de hidratos y \(Int(f)) g de grasas")
    }

    /// Macro del día junto al anillo. Con comidas (`eaten`), lo marcado sobre el objetivo; sin
    /// ellas, el objetivo y una barra con la parte de la energía que aporta.
    private func heroMacro(_ label: String, grams: Double, eaten: Int?, share: Double, shade: Color) -> some View {
        let target = Int(grams.rounded())
        let fill = eaten.map { target > 0 ? Double($0) / Double(target) : 0 } ?? share
        let figure = eaten.map { Text(NumberText.integer($0)) + Text("/\(NumberText.integer(target)) g").foregroundColor(Palette.muted) }
            ?? Text("\(NumberText.integer(target)) g")
        return VStack(alignment: .leading, spacing: 6) {
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                HStack(spacing: 6) {
                    if eaten == nil { Circle().fill(shade).frame(width: 8, height: 8) }
                    Text(label).font(.apFootnote).foregroundStyle(Palette.muted).lineLimit(1)
                }
                Spacer(minLength: 4)
                figure.font(.apSubhead.weight(.semibold).monospacedDigit()).lineLimit(1).minimumScaleFactor(0.7)
            }
            GeometryReader { geo in
                Capsule().fill(Palette.gold.opacity(0.2))
                    .overlay(alignment: .leading) {
                        Capsule().fill(eaten == nil ? shade : Palette.gold)
                            .frame(width: geo.size.width * max(0, min(1, fill)))
                            .animation(reduceMotion ? nil : .snappy, value: fill)
                    }
            }
            .frame(height: 6)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(eaten.map { "\(label): \($0) de \(target) gramos" }
            ?? "\(label): objetivo diario de \(target) gramos, \(Int((share * 100).rounded())) % de las calorías")
    }

    /// Comidas sin objetivos todavía: anillo de comidas hechas y cuántas quedan.
    private var mealsSummary: some View {
        let doneCount = meals.filter { done.contains($0.name ?? "Comida") }.count
        let remaining = meals.count - doneCount
        let layout = dynamicTypeSize.isAccessibilitySize
            ? AnyLayout(VStackLayout(alignment: .leading, spacing: 16))
            : AnyLayout(HStackLayout(alignment: .center, spacing: 20))
        return layout {
            mealsRing(doneCount: doneCount)
            VStack(alignment: .leading, spacing: 6) {
                Text(remaining == 0 ? "Día completo" : "Te \(remaining == 1 ? "queda" : "quedan") \(remaining) \(remaining == 1 ? "comida" : "comidas")")
                    .font(.apHeadline).fixedSize(horizontal: false, vertical: true)
                Text(remaining == 0 ? "Has marcado todas las comidas de hoy." : "Márcalas según las vayas haciendo.")
                    .font(.apSubhead).foregroundStyle(Palette.muted)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(20)
        .frame(maxWidth: .infinity, alignment: .leading)
        .surface(Radius.hero)
    }

    /// Anillo de comidas hechas (mismo tamaño que el del resumen).
    private func mealsRing(doneCount: Int) -> some View {
        ZStack {
            Circle().stroke(Palette.gold.opacity(0.2), lineWidth: 12)
            Circle().trim(from: 0, to: Double(doneCount) / Double(max(meals.count, 1)))
                .stroke(Palette.gold, style: StrokeStyle(lineWidth: 12, lineCap: .round)).rotationEffect(.degrees(-90))
                .animation(reduceMotion ? nil : .snappy, value: doneCount)
            VStack(spacing: 4) {
                Text("\(doneCount)").font(.figure(size: 40))
                    .lineLimit(1).minimumScaleFactor(0.6)
                    .contentTransition(.numericText())
                    .animation(reduceMotion ? nil : .snappy, value: doneCount)
                Text("de \(meals.count) \(meals.count == 1 ? "comida" : "comidas")")
                    .font(.apFootnote).foregroundStyle(Palette.muted)
                    .lineLimit(1).minimumScaleFactor(0.7)
            }
        }
        .frame(width: 136, height: 136)
        .accessibilityElement(children: .ignore).accessibilityLabel("\(doneCount) de \(meals.count) comidas hechas hoy")
    }

    private func mealRow(_ meal: Meal, own: MealMacros?, last: Bool) -> some View {
        let name = meal.name ?? "Comida"
        let isDone = done.contains(name)
        let photoURL = photos[Self.dish(meal)]
        return Button { toggle(name) } label: {
            HStack(spacing: 14) {
                // Foto del plato a la izquierda (maqueta): la fila se reconoce de un vistazo.
                if let url = photoURL {
                    MealPhoto(url: url).frame(width: 60, height: 60)
                        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                        .opacity(isDone ? 0.5 : 1)
                        .accessibilityHidden(true)
                }
                VStack(alignment: .leading, spacing: 3) {
                    Text(name).font(.apHeadline).foregroundStyle(isDone ? Palette.muted : Palette.foreground)
                        .fixedSize(horizontal: false, vertical: true)
                    if let own {
                        Text("\(NumberText.integer(own.kcal)) kcal")
                            .font(.apSubhead.weight(.semibold).monospacedDigit())
                            .foregroundStyle(isDone ? Palette.muted : Palette.gold)
                    }
                    if let d = meal.description {
                        Text(d).font(.apFootnote).foregroundStyle(Palette.muted.opacity(isDone ? 0.6 : 1)).lineLimit(2)
                    }
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
                        Text("P \(own.protein) g · C \(own.carbs) g · G \(own.fats) g")
                            .font(.apFootnote.monospacedDigit()).foregroundStyle(Palette.muted.opacity(isDone ? 0.6 : 1))
                            .padding(.top, 1)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                ZStack {
                    if isDone {
                        Circle().fill(Palette.gold)
                        Image("lu-check").renderingMode(.template).resizable().frame(width: 14, height: 14)
                            .foregroundStyle(Palette.background)
                    } else {
                        Circle().strokeBorder(Palette.muted.opacity(0.45), lineWidth: 1.5)
                    }
                }
                .frame(width: 26, height: 26)
                .accessibilityHidden(true)
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 10)
            .frame(minHeight: 68)
            .contentShape(Rectangle())
            .overlay(alignment: .bottom) {
                if !last {
                    Rectangle().fill(Palette.foreground.opacity(0.06)).frame(height: 1)
                        .padding(.leading, photoURL == nil ? 14 : 88)
                }
            }
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .combine)
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
        if hasAccess == nil { hasAccess = UserDefaults.standard.object(forKey: Self.accessKey(id)) as? Bool }

        // La última copia del plan se pinta al instante; la red la sustituye después.
        if !loaded, let cached = Snapshots.load(Row.self, Self.cacheKey(id)) {
            macros = cached.macros_json
            // Comidas guardadas solo si lo último que dijo el servidor fue Plus: sin saberlo
            // (primera apertura tras actualizar) o sin Plus, nunca asoman comidas de otra época.
            meals = hasAccess == true ? (cached.meals_json ?? []) : []
            photos = Self.cachedPhotos(meals)
            loaded = true
        }

        do {
            let row = try await fetchPlan(id)
            // Sin Plus la RLS no deja leer el plan: los macros se calculan con el onboarding
            // (misma fórmula que `resolveNutritionPreview` de la web). Los macros son siempre gratis.
            // Se calcula aparte y se publica una vez: sin un instante de «Calcula tus macros».
            var fresh = row?.macros_json
            if fresh?.protein == nil && fresh?.calories == nil { fresh = await estimatedMacros(id) }
            macros = fresh
            meals = row?.meals_json ?? []
            // La copia en disco es lo que se ve ahora, también sin fila: así no reaparecen al
            // abrir comidas viejas (de cuando había Plus) que el servidor ya no devuelve.
            Snapshots.save(Row(macros_json: macros, meals_json: meals), Self.cacheKey(id))
            // Las fotos ya guardadas se pintan en el primer frame: sin parpadeo ni salto.
            photos = Self.cachedPhotos(meals)
            loaded = true
            failed = false
            if !meals.isEmpty {
                // Fotos de todas las comidas en paralelo; la lista ya está pintada.
                await prefetchPhotos()
            } else if !accessChecked {
                // Sin comidas: con Plus se generan solas (el servidor vuelve a comprobar el acceso).
                // Lo decide el servidor: si responde «no_access», toca el aviso de Plus.
                accessChecked = true
                preparing = true
                await prepareMeals(id)
                preparing = false
                // Si se cerró a mitad (p. ej. al abrir Ajustes), se vuelve a comprobar al volver.
                if Task.isCancelled { accessChecked = false }
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
    private static func accessKey(_ id: UUID) -> String { "nutrition-access.\(id.uuidString.lowercased())" }

    /// Guarda la última respuesta del servidor sobre Plus (solo respuestas reales, nunca un fallo de red).
    private func setAccess(_ value: Bool) {
        hasAccess = value
        if let id = session.userId { UserDefaults.standard.set(value, forKey: Self.accessKey(id)) }
    }

    /// Primero el servidor confirma el acceso (sin generar nada): con Plus, si nunca dijo qué le
    /// gusta comer se le pregunta y, si ya lo dijo, se preparan las comidas.
    private func prepareMeals(_ id: UUID) async {
        struct Prefs: Decodable { let nutrition_preferences: String? }
        let prefs: Prefs? = try? await Backend.client.from("onboarding").select("nutrition_preferences")
            .eq("user_id", value: id).single().execute().value
        let hasPrefs = !(prefs?.nutrition_preferences ?? "").trimmingCharacters(in: .whitespaces).isEmpty
        // Siempre se confirma antes de generar: quien tuvo Plus y ya no lo tiene no ve «Preparando…».
        struct Result: Decodable { let reason: String? }
        let result: Result? = try? await Backend.client.functions.invoke("sync-nutrition-macros", options: FunctionInvokeOptions(body: [String: String]()))
        // Sin respuesta (red) no se decide nada: nunca se enseña lo de Plus a quien no lo tiene.
        guard let result else { return }
        if result.reason == "no_access" { setAccess(false); return }
        setAccess(true)
        if hasPrefs { await generateMeals() } else { needsSetup = true }
    }

    /// Comidas del día con las preferencias del onboarding (`sync-nutrition-macros`, igual que la web).
    private func generateMeals() async {
        struct Body: Encodable { let regenerate_meals = true }
        struct Result: Decodable { let meals_updated: Bool?; let reason: String? }
        generating = true; generateFailed = false
        let result: Result? = try? await Backend.client.functions.invoke("sync-nutrition-macros", options: FunctionInvokeOptions(body: Body()))
        generating = false
        if result?.reason == "no_access" { setAccess(false); return }
        if result != nil { setAccess(true) }
        guard result?.meals_updated == true, let id = session.userId, let row = (try? await fetchPlan(id)) ?? nil else { generateFailed = true; return }
        // Copia en disco al día, como `load()`: sin red se abren las comidas nuevas, no las viejas.
        Snapshots.save(row, Self.cacheKey(id))
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

/// Esqueleto de Nutrición mientras llega la red: resumen y comidas como bloques que laten
/// suavemente, para que la pantalla no aparezca vacía ni dé un salto al cargar.
private struct NutritionSkeleton: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var pulsing = false

    var body: some View {
        // La misma columna que el contenido real (resumen arriba, comidas debajo): nada salta al cargar.
        VStack(alignment: .leading, spacing: 32) {
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

    /// Fantasma del resumen: el anillo y, a su lado, las tres barras de macros.
    private var summarySkeleton: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack(alignment: .center, spacing: 20) {
                Circle().stroke(Palette.secondary, lineWidth: 12).frame(width: 124, height: 124).padding(6)
                VStack(alignment: .leading, spacing: 22) {
                    bar(height: 12)
                    bar(height: 12)
                    bar(height: 12)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            bar(width: 220, height: 11)
        }
        .padding(20)
        .frame(maxWidth: .infinity, alignment: .leading)
        .surface(Radius.hero)
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
            .surface()
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

/// Sin peso todavía (web `BasicNutrition.tsx`): se pide aquí mismo y los macros salen al momento.
private struct MacrosWeightCard: View {
    let userId: UUID
    var onSaved: () async -> Void
    @State private var weight = ""
    @State private var saving = false
    @State private var failed = false

    private var value: Double? {
        Double(weight.replacingOccurrences(of: ",", with: ".")).flatMap { $0 > 30 && $0 <= 300 ? $0 : nil }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Image(systemName: "flame.fill").font(.system(size: 28, weight: .semibold)).foregroundStyle(Palette.gold).accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 4) {
                Text("Calcula tus macros").font(.apTitle2).accessibilityAddTraits(.isHeader)
                Text("Dinos tu peso y te damos tus calorías y tu proteína del día. Gratis.")
                    .font(.apSubhead).foregroundStyle(Palette.muted)
            }
            PillField(label: "Tu peso en kg", text: $weight).decimalKeyboard()
            Button { Task { await save() } } label: {
                if saving { BrandLoader().tint(.black).accessibilityHidden(true) } else { Text("Calcular mis macros") }
            }
            .buttonStyle(.pill)
            .disabled(saving || value == nil)
            .accessibilityLabel(saving ? "Calculando" : "Calcular mis macros")
            if failed {
                Text("No se pudo guardar tu peso. Vuelve a intentarlo.").font(.apFootnote).foregroundStyle(Palette.destructive)
            }
        }
        .padding(20)
        .frame(maxWidth: .infinity, alignment: .leading)
        .surface(Radius.hero)
    }

    private func save() async {
        guard let value, !saving else { return }
        Haptics.tap()
        saving = true
        failed = false
        defer { saving = false }
        struct Row: Encodable { let user_id: UUID; let weight: Double }
        do {
            try await Backend.client.from("onboarding").upsert(Row(user_id: userId, weight: value), onConflict: "user_id").execute()
            // Con Plus el plan recalcula sus macros con el peso nuevo (sin Plus no hace nada).
            _ = try? await Backend.client.functions.invoke("sync-nutrition-macros", options: FunctionInvokeOptions(body: [String: String]()))
            Haptics.success()
            await onSaved()
        } catch {
            failed = true
            Haptics.error()
            A11y.announce("No se pudo guardar tu peso. Vuelve a intentarlo.")
        }
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
