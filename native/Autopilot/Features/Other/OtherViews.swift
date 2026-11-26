import SwiftUI
import Supabase

/// Nutrición minimalista, calcada de `MealsList.tsx` y `BasicNutrition.tsx`: el anillo de calorías
/// con las barras de macros como única protagonista y «Comidas de hoy» como una lista limpia (foto,
/// nombre, plato y kcal con macros en una línea tranquila, y el check). «Regenerar comidas» y
/// «Actualizar mis datos» van en «···»; en Gratis, lo de Plus en una sola fila tranquila.
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
    /// Ingredientes con su peso y gramos de cada macro si la IA los dio; sin macros, la comida
    /// cuenta como una parte igual del día.
    struct Meal: Codable, Hashable {
        let name: String?; let description: String?
        var ingredients: [Ingredient]? = nil
        var protein: Double? = nil; var carbs: Double? = nil; var fats: Double? = nil
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
                    // Sin subtítulo: el título grande y el anillo bastan (como Hoy y Entrenar).
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

    /// Lo que Plus añade a Nutrición, en una sola fila (`NUTRITION_PLUS_ROW` de la web): solo funciones reales.
    static let plusRowTitle = "Comidas de cada día"
    static let plusRowDetail = "Ajustadas a tus macros y a lo que te gusta."
    /// Aviso de los objetivos estimados, bajo el anillo (`NUTRITION_ESTIMATE_NOTE` de la web).
    static let estimateNote = "Estimación según tus datos y objetivo. No sustituye una valoración nutricional individual."
    /// Error de red (`NUTRITION_LOAD_ERROR` de la web).
    static let loadErrorTitle = "No hemos podido cargar tu plan"
    static let loadErrorMessage = "Revisa tu conexión y vuelve a intentarlo. Tus datos siguen guardados."
    /// Textos de Plus sin comidas y de las filas (`MEALS_COPY` de la web).
    static let preparingTitle = "Preparando tus comidas…"
    static let preparingDetail = "Con tus macros, tus gustos y lo que no comes."
    static let readyTitle = "Tus comidas de hoy"
    static let readyDetail = "Te las preparamos con tus macros y lo que te gusta."
    static let readyAction = "Preparar mis comidas"
    static let regenerateFailed = "Tus comidas siguen aquí. Prueba a regenerarlas en unos minutos."
    static let weightTitle = "Añade tu peso"
    static let weightDetail = "Con tu peso calculamos tus macros. Hasta entonces, las comidas son orientativas."

    /// Ajustes, para revisar peso y objetivo (como `onOpenProfile` / `onEdit` en la web).
    private func openSettings() {
        Haptics.tap()
        NotificationCenter.default.post(name: .goToSection, object: AppSection.settings)
    }

    /// Nutrición en Gratis: lo de Plus en una sola fila tranquila bajo el anillo (icono en su losa,
    /// título, una línea y la insignia Plus), como `NutritionPlusSection` en la web. En la app no
    /// enlaza a pagos externos (normas de la App Store).
    private var plusRow: some View {
        HStack(spacing: 14) {
            Image(systemName: "fork.knife").font(.system(size: 15, weight: .medium)).foregroundStyle(Palette.muted)
                .frame(width: 32, height: 32)
                .background(Palette.secondary, in: RoundedRectangle(cornerRadius: 9, style: .continuous))
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 2) {
                Text(Self.plusRowTitle).font(.apHeadline)
                Text(Self.plusRowDetail).font(.apFootnote).foregroundStyle(Palette.muted)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            PlusBadge()
        }
        .padding(.horizontal, 16).padding(.vertical, 12)
        .frame(maxWidth: .infinity, minHeight: 72, alignment: .leading)
        .surface()
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(Self.plusRowTitle), incluido en Plus. \(Self.plusRowDetail)")
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
                    // Sin Plus (la RLS no deja leer el plan): la fila de Plus debajo, como la web.
                    plusRow
                }
            }
        } else {
            // Una sola columna, como la web (también en Mac): el anillo arriba y las comidas debajo.
            VStack(alignment: .leading, spacing: 32) {
                if showTargets {
                    VStack(alignment: .leading, spacing: 12) {
                        // Anillo de calorías y barras de macros, la única protagonista; con comidas suman lo marcado.
                        nutritionHero(kcal: kcal, p: p, c: c, f: f, eaten: hasMeals ? eatenToday : nil)
                        // Sin comidas que marcar, los objetivos son una estimación: el aviso va bajo el anillo.
                        if !hasMeals { estimateNoteView }
                    }
                } else if hasMeals {
                    mealsSummary
                }
                if hasMeals && macros == nil { macroNotice }
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
                        plusRow
                    } else if generating {
                        MealsStateCard(title: Self.preparingTitle, message: Self.preparingDetail, loading: true)
                    } else if hasAccess == nil || preparing {
                        // Aún no se sabe si hay Plus: nada de «preparando» ni foto de plato (eso es de Plus).
                        EmptyView()
                    } else {
                        MealsStateCard(title: Self.readyTitle, message: Self.readyDetail, loading: false,
                                       action: (Self.readyAction, { Haptics.tap(); Task { await generateMeals() } }))
                    }
                }
            }
        }
    }

    /// Pie de los objetivos estimados (sin comidas): el aviso en una línea tranquila y «Actualizar mis
    /// datos» como acción de texto, como `NutritionEstimateNote` en la web.
    private var estimateNoteView: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(Self.estimateNote).font(.apFootnote).foregroundStyle(Palette.muted)
                .fixedSize(horizontal: false, vertical: true)
            Button { openSettings() } label: {
                Text("Actualizar mis datos").font(.apFootnote.weight(.semibold)).foregroundStyle(Palette.foreground)
                    .frame(minHeight: 44).contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityHint("Abre Ajustes para revisar tu peso y tu objetivo")
        }
        .padding(.horizontal, 4)
    }

    /// Comidas sin macros personalizados: aviso tranquilo con «Añadir peso» (como `QuietNotice` en la web).
    private var macroNotice: some View {
        HStack(alignment: .top, spacing: 14) {
            Image(systemName: "person").font(.system(size: 15, weight: .medium)).foregroundStyle(Palette.muted)
                .frame(width: 32, height: 32)
                .background(Palette.secondary, in: RoundedRectangle(cornerRadius: 9, style: .continuous))
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 2) {
                Text(Self.weightTitle).font(.apHeadline)
                Text(Self.weightDetail).font(.apFootnote).foregroundStyle(Palette.muted)
                    .fixedSize(horizontal: false, vertical: true)
                Button("Añadir peso") { openSettings() }
                    .buttonStyle(PillButtonStyle(kind: .secondary, height: 44))
                    .fixedSize()
                    .padding(.top, 10)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .surface()
    }

    /// «Comidas de hoy»: título en Title 3, «···» con «Regenerar comidas» y «Actualizar mis datos», y
    /// las filas en un grupo sin borde (foto, nombre, plato, kcal con macros y el check).
    private var mealsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .center) {
                Text("Comidas de hoy").font(.apTitle3)
                    .accessibilityAddTraits(.isHeader)
                Spacer(minLength: 8)
                if generating {
                    HStack(spacing: 8) {
                        BrandLoader(size: 16)
                        Text("Regenerando…").font(.apFootnote).foregroundStyle(Palette.muted)
                    }
                    .frame(minHeight: 44)
                    .accessibilityElement(children: .combine)
                } else {
                    Menu {
                        Button { Haptics.selection(); confirmingNew = true } label: {
                            Label("Regenerar comidas", systemImage: "arrow.triangle.2.circlepath")
                        }
                        Button { openSettings() } label: {
                            Label("Actualizar mis datos", systemImage: "person")
                        }
                    } label: {
                        Image(systemName: "ellipsis").font(.system(size: 17, weight: .semibold)).foregroundStyle(Palette.muted)
                            .frame(width: 44, height: 44).contentShape(Circle())
                    }
                    #if os(macOS)
                    .menuStyle(.borderlessButton).menuIndicator(.hidden).fixedSize()
                    #endif
                    .padding(.trailing, -10)
                    .accessibilityLabel("Más opciones de las comidas")
                }
            }
            VStack(spacing: 0) {
                let split = perMeal
                ForEach(Array(meals.enumerated()), id: \.offset) { i, meal in
                    mealRow(meal, own: split.indices.contains(i) ? split[i] : nil, last: i == meals.count - 1)
                }
            }
            .surface()
            if generateFailed && !generating {
                Text(Self.regenerateFailed)
                    .font(.apFootnote).foregroundStyle(Palette.muted)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.horizontal, 4)
            }
        }
        .alert("¿Regenerar tus comidas?", isPresented: $confirmingNew) {
            Button("Ahora no", role: .cancel) {}
            Button("Regenerar comidas") { Task { await generateMeals() } }
        } message: {
            Text("Recalcularemos el plan de comidas con tus datos actuales y sustituirá a las comidas guardadas cuando termine. El plan de entrenamiento no cambia.")
        }
    }

    /// Error de red: un vacío aquí parecería «no tienes plan», así que se dice con calma y se reintenta.
    private var retryCard: some View {
        VStack(spacing: 0) {
            EmptyStateView(symbol: "wifi.exclamationmark", title: Self.loadErrorTitle, message: Self.loadErrorMessage)
            Button {
                // Mientras se repite la petición vuelve el skeleton.
                Haptics.tap()
                failed = false
                Task { await load() }
            } label: { Text("Reintentar") }
                .buttonStyle(.pillSecondary)
                .frame(maxWidth: 320)
                .accessibilityHint("Vuelve a pedir tu plan de comidas")
        }
        .frame(maxWidth: .infinity)
    }

    /// Cabecera de Nutrición (`NutritionHero.tsx`), la única protagonista: el anillo de calorías y a su
    /// lado las tres barras de macros, en una tarjeta de 28 sin textos de relleno. Con comidas
    /// marcables suman lo marcado; sin ellas, el anillo reparte la energía del día entre proteína,
    /// hidratos y grasas. Con letra muy grande, el anillo arriba y las barras debajo.
    private func nutritionHero(kcal: Double, p: Double, c: Double, f: Double, eaten: MealMacros?) -> some View {
        let energy = p * 4 + c * 4 + f * 9
        let share = { (e: Double) in energy > 0 ? e / energy : 0 }
        let layout = dynamicTypeSize.isAccessibilitySize
            ? AnyLayout(VStackLayout(alignment: .leading, spacing: 20))
            : AnyLayout(HStackLayout(alignment: .center, spacing: 20))
        return layout {
            if let eaten { kcalRing(target: kcal, eaten: eaten.kcal) } else { macroRing(kcal: kcal, p: p, c: c, f: f) }
            VStack(alignment: .leading, spacing: 14) {
                heroMacro("Proteína", grams: p, eaten: eaten?.protein, share: share(p * 4), shade: Self.splitShades[0])
                heroMacro("Hidratos", grams: c, eaten: eaten?.carbs, share: share(c * 4), shade: Self.splitShades[1])
                heroMacro("Grasas", grams: f, eaten: eaten?.fats, share: share(f * 9), shade: Self.splitShades[2])
            }
            .frame(maxWidth: .infinity, alignment: .leading)
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
            Text(NumberText.grouped(Double(value))).font(.figure(size: 32)).lineLimit(1).minimumScaleFactor(0.6)
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
            ringCenter(value: eaten, caption: "de \(NumberText.grouped(target)) kcal")
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
        let figure = eaten.map { Text(NumberText.grouped(Double($0))) + Text("/\(NumberText.grouped(Double(target))) g").foregroundColor(Palette.muted) }
            ?? Text("\(NumberText.grouped(Double(target))) g")
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
            Text(remaining == 0 ? "Día completo" : "Te \(remaining == 1 ? "queda" : "quedan") \(remaining) \(remaining == 1 ? "comida" : "comidas")")
                .font(.apHeadline).fixedSize(horizontal: false, vertical: true)
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

    /// Línea tranquila de cada comida, detrás de sus kcal: «P 40 g · H 62 g · G 14 g» (`mealMacroDetail` en la web).
    static func macroDetail(_ m: MealMacros) -> String {
        "P \(m.protein) g · H \(m.carbs) g · G \(m.fats) g"
    }

    /// Lo mismo para VoiceOver (`mealMacroLabel` en la web).
    static func macroLabel(_ m: MealMacros) -> String {
        "\(NumberText.grouped(Double(m.kcal))) kcal: \(m.protein) g de proteína, \(m.carbs) g de hidratos y \(m.fats) g de grasas"
    }

    /// Fila de «Comidas de hoy», como la web: la foto propia del plato (48, radio 14) si la hay, el
    /// nombre, el plato en dos líneas como mucho, las kcal con sus macros en una línea tranquila y el
    /// check a la derecha. El separador nace donde empieza el texto.
    private func mealRow(_ meal: Meal, own: MealMacros?, last: Bool) -> some View {
        let name = meal.name ?? "Comida"
        let isDone = done.contains(name)
        let photoURL = photos[Self.dish(meal)]
        return Button { toggle(name) } label: {
            HStack(spacing: 12) {
                if let url = photoURL {
                    MealPhoto(url: url).frame(width: 48, height: 48)
                        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                        .opacity(isDone ? 0.5 : 1)
                        .accessibilityHidden(true)
                }
                VStack(alignment: .leading, spacing: 2) {
                    Text(name).font(.apHeadline).foregroundStyle(isDone ? Palette.muted : Palette.foreground)
                        .fixedSize(horizontal: false, vertical: true)
                    if let d = meal.description, !d.isEmpty {
                        Text(d).font(.apFootnote).foregroundStyle(Palette.muted).lineLimit(2)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    if let own {
                        (Text("\(NumberText.grouped(Double(own.kcal))) kcal").fontWeight(.semibold)
                            .foregroundColor(isDone ? Palette.muted : Palette.foreground)
                         + Text(" · \(Self.macroDetail(own))"))
                            .font(.apFootnote.monospacedDigit()).foregroundStyle(Palette.muted)
                            .fixedSize(horizontal: false, vertical: true)
                            .padding(.top, 2)
                            .accessibilityLabel(Self.macroLabel(own))
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                ZStack {
                    if isDone {
                        Circle().fill(Palette.gold)
                        Image("lu-check").renderingMode(.template).resizable().frame(width: 14, height: 14)
                            .foregroundStyle(Palette.background)
                    } else {
                        Circle().strokeBorder(Palette.muted.opacity(0.5), lineWidth: 1.5)
                    }
                }
                .frame(width: 26, height: 26)
                .accessibilityHidden(true)
            }
            .padding(.leading, 16).padding(.trailing, 16)
            .padding(.vertical, 12)
            .frame(minHeight: 72)
            .contentShape(Rectangle())
            .overlay(alignment: .bottom) {
                if !last {
                    // 16 + 48 (foto) + 12: el separador arranca donde el texto.
                    Rectangle().fill(Palette.separator).frame(height: 0.5)
                        .padding(.leading, photoURL == nil ? 16 : 76)
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
        guard hasPrefs else { needsSetup = true; return }
        // Una vez al día como mucho: si ya se intentó hoy, queda «Volver a intentarlo».
        if Self.claimAutoGenerate(id) { await generateMeals() } else { generateFailed = true }
    }

    /// Las comidas con IA cuestan dinero: la preparación automática se intenta como mucho una vez
    /// al día por cuenta (como `claimMealsAutoGenerate` en la web). Los botones no pasan por aquí.
    private static func claimAutoGenerate(_ id: UUID) -> Bool {
        let key = "meals-autogen.\(id.uuidString.lowercased())"
        let today = LocalDate.string()
        if UserDefaults.standard.string(forKey: key) == today { return false }
        UserDefaults.standard.set(today, forKey: key)
        return true
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

    /// Fantasma de «Comidas de hoy»: el título y tres filas con foto, textos y check (como las reales).
    private var mealsSkeleton: some View {
        VStack(alignment: .leading, spacing: 12) {
            // Mismo eje que las tarjetas (sin sangría).
            bar(width: 132, height: 16)
            VStack(spacing: 0) {
                ForEach(0..<3, id: \.self) { i in
                    HStack(spacing: 12) {
                        RoundedRectangle(cornerRadius: 14, style: .continuous).fill(Palette.secondary).frame(width: 48, height: 48)
                        VStack(alignment: .leading, spacing: 6) {
                            bar(width: 110, height: 12)
                            bar(height: 10)
                            bar(width: 160, height: 10)
                        }
                        Circle().strokeBorder(Palette.secondary, lineWidth: 1.5).frame(width: 26, height: 26)
                    }
                    .padding(.horizontal, 16)
                    .frame(minHeight: 72)
                    .overlay(alignment: .bottom) {
                        // 16 + 48 (foto) + 12: el separador arranca donde el texto.
                        if i < 2 { Rectangle().fill(Palette.separator).frame(height: 0.5).padding(.leading, 76) }
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

    /// Mismos textos que `MACROS_WEIGHT_COPY` en la web.
    static let title = "Calcula tus macros"
    static let message = "Con tu peso calculamos tus calorías y tus macros del día. Gratis."

    /// Tarjeta de 28 sin borde: título, una línea, el campo y la acción dorada (sin icono suelto).
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            VStack(alignment: .leading, spacing: 4) {
                Text(Self.title).font(.apTitle2).accessibilityAddTraits(.isHeader)
                Text(Self.message)
                    .font(.apSubhead).foregroundStyle(Palette.muted)
                    .fixedSize(horizontal: false, vertical: true)
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

/// Plus sin comidas todavía (EmptyState con foto de la web): la foto del plato de referencia fundida
/// a la tarjeta y el texto abajo. Mientras se preparan, el AP latiendo; si no salieron, la acción
/// para prepararlas. Sin adornos ni iconos sueltos.
private struct MealsStateCard: View {
    let title: String
    let message: String
    let loading: Bool
    var action: (label: String, run: () -> Void)? = nil
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var url: URL?

    init(title: String, message: String, loading: Bool, action: (label: String, run: () -> Void)? = nil) {
        self.title = title
        self.message = message
        self.loading = loading
        self.action = action
        // Caché sincrónica: si el plato ya tiene portada, se pinta en el primer frame.
        _url = State(initialValue: AiCover.cachedMeal(NutritionView.defaultDish) ?? AiCover.mealFallback)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(title).font(.inter(size: 26, weight: .semibold)).tracking(-0.5)
                .fixedSize(horizontal: false, vertical: true)
                .accessibilityAddTraits(.isHeader)
            Text(message).font(.apSubhead).foregroundStyle(Palette.muted).padding(.top, 4)
                .fixedSize(horizontal: false, vertical: true)
            if loading {
                BrandLoader(size: 28).padding(.top, 20)
            } else if let action {
                Button(action.label, action: action.run)
                    .buttonStyle(.pillSecondary)
                    .padding(.top, 20)
            }
        }
        .padding(20)
        .frame(maxWidth: .infinity, minHeight: 288, alignment: .bottomLeading)
        .background {
            // La foto se ajusta al hueco de la tarjeta (en Mac la tarjeta es ancha y, sin este marco,
            // la imagen no se dibujaba). El plato va en el propio paquete: se ve al instante y, si la
            // foto de la IA no llega, nunca queda en blanco.
            Color.clear
                .overlay { EmptyCardPhoto(url: url) }
                .clipped()
                .opacity(0.9)
                .overlay { LinearGradient(colors: [Palette.card, Palette.card.opacity(0.7), .clear], startPoint: .bottom, endPoint: .top) }
        }
        .background(Palette.card)
        .clipShape(RoundedRectangle(cornerRadius: Radius.hero, style: .continuous))
        .task {
            // Solo se usa una foto que de verdad descarga; si no, la del plato de referencia.
            let cached = AiCover.cachedMeal(NutritionView.defaultDish)
            if let cached, await ImageCache.shared.load(cached) != nil { url = cached } else { url = AiCover.mealFallback }
            let resolved = await AiCover.meal(NutritionView.defaultDish)
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
            // Miniatura de 60 pt: 192 px, no la foto grande de la tarjeta.
            CachedAsyncImage(url: url, maxSide: MediaSizing.thumb) { $0.resizable().scaledToFill() } placeholder: { Color.clear }
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
