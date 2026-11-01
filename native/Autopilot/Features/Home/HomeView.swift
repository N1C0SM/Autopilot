import SwiftUI
import Supabase

/// Inicio, solo con lo de hoy: el saludo, la sesión de hoy (o el descanso que toque) y, si el
/// entreno ya está completado, sus resultados. La tarjeta es el resumen y, al tocarla, abre el
/// detalle en una hoja (ejercicios con foto y acción). La semana vive en Entrenar.
struct HomeView: View {
    @EnvironmentObject private var session: SessionModel
    #if !os(macOS)
    @Environment(\.horizontalSizeClass) private var sizeClass
    #endif
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @StateObject private var model = PlanModel()
    /// Todo lo de hoy en un único valor: se publica de golpe y se cachea por usuario y día.
    @State private var todayState: TodaySnapshot?
    @State private var sheetOpen = false
    /// Confeti de «día completado»: se enciende una sola vez al día (ver `celebrateIfNeeded`).
    @State private var celebrating = false
    /// Instante de inicio del confeti: se guarda aquí para que un redibujado de Inicio no
    /// reinicie las partículas a mitad de la caída.
    @State private var confettiStart = Date()
    var onNavigate: (AppSection) -> Void = { _ in }

    /// Altura reservada de la tarjeta de hoy: el esqueleto de carga y la tarjeta de empezar miden
    /// exactamente lo mismo (los bloques del esqueleto son el fantasma de los de la tarjeta).
    private static let cardMinHeight: CGFloat = 240

    /// Paridad con la web de escritorio: en iPhone (y ventanas estrechas) la columna del móvil; en
    /// iPad horizontal y Mac, la misma columna del móvil pero a todo el ancho, con la foto héroe
    /// grande y el resumen en dos tarjetas (`HomeOverview.tsx`).
    /// En Mac manda el ancho de la ventana (la disposición no se acota a un máximo fijo).
    private var wideLayout: Bool {
        #if os(macOS)
        return true
        #else
        return sizeClass == .regular
        #endif
    }

    /// En Mac el lienzo y su padding los pone `SectionView` (como `<main>` con `lg:p-10`); así no
    /// se suma dos veces. En iPad el lienzo es de la propia pantalla, como antes.
    private var horizontalPadding: CGFloat {
        #if os(macOS)
        return 0
        #else
        return wideLayout ? 32 : 16
        #endif
    }

    private var todayIndex: Int { DayNames.all.firstIndex(of: DayNames.today) ?? 0 }

    /// Foto de hoy: la recién cargada o, si aún no hay, la cacheada en memoria para este usuario.
    /// Así Inicio pinta al instante al volver a la pestaña, sin esperar a la red.
    private var snapshot: TodaySnapshot? {
        if let todayState { return todayState }
        guard let id = session.userId else { return nil }
        return TodayCache.shared.snapshot(userId: id)
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                // Saludo siempre a todo el ancho (en la web el titular tampoco se parte en columnas).
                heading(wide: wideLayout)
                if wideLayout {
                    // Escritorio como `HomeOverview.tsx`: una sola columna ancha.
                    wideToday
                    widgets.padding(.top, 32)
                } else {
                    // iPhone: la acción de hoy y, debajo, los widgets (como `HomeOverview.tsx`).
                    VStack(alignment: .leading, spacing: 28) {
                        mainAction
                        widgets
                    }
                    .padding(.top, 24)
                }
            }
            .padding(.horizontal, horizontalPadding)
            .padding(.top, wideLayout ? 24 : 8)
            .padding(.bottom, 96)
        }
        .screenBackground()
        .refreshable { await load() }
        .task {
            await load()
            // Si se entra con el día ya completado (o se completó en otra pestaña), se celebra igual.
            if snapshot?.completedToday == true { celebrateIfNeeded() }
        }
        .onReceive(NotificationCenter.default.publisher(for: .refreshSection)) { _ in Task { await load() } }
        .onChange(of: snapshot?.completedToday ?? false) { _, done in
            if done { celebrateIfNeeded() }
        }
        .sheet(isPresented: $sheetOpen) { sheetView }
        // Celebración ligera: confeti SwiftUI puro, una vez al día y nunca con «Reducir
        // movimiento» (ahí el premio es el propio cambio de estado, sin animación).
        .overlay(alignment: .top) {
            if celebrating {
                ConfettiView(start: confettiStart)
                    .frame(height: 560)
                    .transition(.opacity)
                    .allowsHitTesting(false)
                    .accessibilityHidden(true)
            }
        }
    }

    // MARK: Cabecera

    private func heading(wide: Bool) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(Date().formatted(.dateTime.weekday(.wide).day().month(.wide).locale(Locale(identifier: "es_ES"))).capitalizedFirst)
                .font(.apSubhead.weight(.semibold)).foregroundStyle(Palette.muted)
            (Text(greeting) + Text("\n") + Text(stateLine).foregroundColor(Palette.muted))
                // Título de portada con la escala de la app y el mismo apriete de letra que los
                // títulos grandes del sistema (el resto de titulares usa `tracking` negativo).
                .font(wide ? .inter(size: 44, weight: .bold) : .apLargeTitle)
                .tracking(wide ? -0.9 : -0.7)
                .padding(.top, 2)
                .accessibilityAddTraits(.isHeader)
        }
    }

    private var greeting: String {
        let name = snapshot?.firstName ?? ""
        return name.isEmpty ? "Hola." : "Hola, \(name)."
    }

    private var stateLine: String {
        guard let s = snapshot else { return "Preparando tu día." }
        if s.completedToday { return "Buen trabajo." }
        if s.noPlan == true { return "Empecemos." }
        if s.plan?.isGym == true { return "A entrenar." }
        if let p = s.plan, p.type == "actividad" { return "A \(p.sport ?? "moverte")." }
        return "Hoy, a recuperar."
    }

    // MARK: Escritorio (web `HomeOverview.tsx`: una columna ancha con foto héroe)

    /// Lo de hoy en iPad/Mac: foto héroe a todo el ancho y, debajo, el texto y la acción.
    @ViewBuilder private var wideToday: some View {
        if let s = snapshot {
            VStack(alignment: .leading, spacing: 0) {
                // La web pinta la portada de la sesión de hoy antes que nada (`lg:h-[340px]`).
                if s.plan?.isGym == true, let cover = todayCover {
                    heroPhoto(cover)
                }
                if let plan = s.plan, !s.completedToday {
                    wideStart(plan).padding(.top, 24)
                } else {
                    mainAction.padding(.top, 24)
                }
            }
        } else {
            mainAction
        }
    }

    /// Primera foto de la sesión de hoy (la portada que usa la web).
    private var todayCover: URL? {
        (snapshot?.plan?.exercises ?? []).compactMap { $0.image_url }.first.flatMap(URL.init(string:))
    }

    /// Foto héroe a todo el ancho (la web: `lg:h-[340px]`), con degradado y radio de héroe.
    private func heroPhoto(_ url: URL) -> some View {
        CachedAsyncImage(url: url) { $0.resizable().scaledToFill() } placeholder: { Palette.card }
            .frame(maxWidth: .infinity)
            .frame(height: 340)
            .clipped()
            .overlay {
                LinearGradient(colors: [.clear, .black.opacity(0.55)], startPoint: .center, endPoint: .bottom)
            }
            .clipShape(RoundedRectangle(cornerRadius: Radius.hero, style: .continuous))
            .padding(.top, 32)
            .accessibilityHidden(true)
    }

    /// Texto y CTA de la sesión de hoy, sin tarjeta y con ancho de lectura (web: `lg:max-w-md`).
    private func wideStart(_ plan: DayPlan) -> some View {
        let parts = plan.title.components(separatedBy: " · ")
        let summary = detail(plan)
        return VStack(alignment: .leading, spacing: 0) {
            Text(plan.isGym ? "Hoy · entreno" : "Hoy · actividad")
                .font(.apCaption.weight(.semibold)).textCase(.uppercase).tracking(0.6)
                .foregroundStyle(Palette.gold)
            Text(parts[0]).font(.apTitle1).lineLimit(2)
                .fixedSize(horizontal: false, vertical: true).padding(.top, 6)
            if parts.count > 1 {
                Text(parts.dropFirst().joined(separator: " · "))
                    .font(.apSubhead).foregroundStyle(Palette.muted)
                    .lineLimit(2).fixedSize(horizontal: false, vertical: true).padding(.top, 2)
            }
            if !summary.isEmpty {
                Text(summary).font(.apSubhead.monospacedDigit())
                    .foregroundStyle(Palette.muted).padding(.top, 4)
            }
            Button { openSheet() } label: { Text("Ver la sesión") }
                .buttonStyle(.pill)
                .frame(maxWidth: 224)
                .padding(.top, 20)
        }
        .frame(maxWidth: 448, alignment: .leading)
    }

    /// Widgets de Inicio, como la web: dos cuadrados lado a lado, Nutrición y Último récord.
    private var widgets: some View {
        HStack(alignment: .top, spacing: 12) {
            let kcal = snapshot?.calories
            widgetTile(symbol: kcal == nil ? "lu-lock" : "lu-apple", ring: kcal == nil ? nil : mealsRing,
                       value: kcal.map { NumberText.integer($0) }, unit: kcal == nil ? nil : "kcal", title: "Nutrición",
                       detail: kcal == nil ? "Sin plan de nutrición todavía" : "Objetivo diario",
                       macros: snapshot?.macros) { onNavigate(.nutrition) }
            let pr = snapshot?.lastPr
            widgetTile(symbol: "lu-trophy", ring: nil,
                       value: pr.map { $0.weight.rounded() == $0.weight ? NumberText.integer(Int($0.weight)) : NumberText.decimal($0.weight) },
                       unit: pr == nil ? nil : "kg",
                       title: pr?.exercise ?? "Récords",
                       detail: pr.map { "\($0.reps) reps · \($0.dateLabel)" } ?? "Tu primer récord llegará entrenando") { onNavigate(.progress) }
        }
    }

    /// Anillo de Nutrición: comidas marcadas hoy; sin comidas, el objetivo del día completo.
    private var mealsRing: Double {
        let total = snapshot?.mealCount ?? 0
        guard total > 0 else { return 1 }
        let c = Calendar.current.dateComponents([.year, .month, .day], from: Date())
        let key = "meals_done_\(session.userIdString ?? "")_\(c.year!)-\(c.month!)-\(c.day!)"
        let done = UserDefaults.standard.data(forKey: key).flatMap { try? JSONDecoder().decode([String].self, from: $0) }?.count ?? 0
        return min(1, Double(done) / Double(total))
    }

    /// Widget compacto (Semana, Récord): icono arriba, cifra grande, título y una línea gris.
    private func widgetTile(symbol: String, ring: Double?, value: String?, unit: String?, title: String,
                            detail: String, macros: MacroSum? = nil, action: @escaping () -> Void) -> some View {
        Button { Haptics.tap(); action() } label: {
            VStack(alignment: .leading, spacing: 0) {
                Group {
                    if let m = macros { MacroRingSmall(p: m.p, c: m.c, f: m.f) }
                    else { ProgressRing(value: (ring ?? 0) * 100, symbol: symbol) }
                }
                // En Mac/iPad las tarjetas son más anchas: el icono crece para no quedarse diminuto.
                .scaleEffect(wideLayout ? 1.4 : 1, anchor: .topLeading)
                .frame(width: wideLayout ? 45 : 32, height: wideLayout ? 45 : 32, alignment: .topLeading)
                Spacer(minLength: 16)
                if let value {
                    HStack(alignment: .firstTextBaseline, spacing: 4) {
                        Text(value).font(.figure(size: 40)).minimumScaleFactor(0.6).lineLimit(1)
                        if let unit { Text(unit).font(.apSubhead.weight(.semibold)).foregroundStyle(Palette.muted) }
                    }
                    .padding(.bottom, 8)
                }
                Text(title).font(.apHeadline).lineLimit(1)
                Text(detail).font(.apFootnote).foregroundStyle(Palette.muted).lineLimit(2)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
            // Cuadrados en el iPhone; en Mac/iPad, altura fija (si no, ocupan media pantalla).
            .squareTile(!wideLayout, height: 200)
            .background(Palette.card, in: RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
        }
        .buttonStyle(.pressableCard)
        .accessibilityElement(children: .combine)
    }

    // MARK: Lo único de hoy (empezar, resultados o descanso)

    @ViewBuilder private var mainAction: some View {
        if let s = snapshot {
            // Siempre lo que toca HOY (como la web): hecho, descanso o la sesión de hoy.
            if s.completedToday {
                doneCard(s.plan)
            } else if s.noPlan == true {
                // Sin rutina todavía (web `!hasPlan`): invitación con botón, nunca «descansa».
                StarterRoutineCard { await load() }
            } else if s.plan == nil {
                RestCard(title: "Hoy toca descansar", message: nextSession(s.scheduled) ?? "Tu plan aún no tiene sesiones.") {
                    Button("Entrenar igualmente") { Haptics.tap(); onNavigate(.train) }
                        .buttonStyle(.pillSecondary)
                }
            } else if let plan = s.plan {
                startCard(plan)
            }
        } else {
            todaySkeleton
        }
    }

    /// Hecho hoy: la misma portada grande con foto, marcada como hecha, y debajo la siguiente
    /// sesión en una línea. Se toca y abre el resumen del entreno de hoy.
    private func doneCard(_ plan: DayPlan?) -> some View {
        let exercises = plan?.exercises ?? []
        // Sin foto de la sesión (p. ej. entreno libre en día de descanso): la foto de marca del gimnasio.
        let cover = URL(string: exercises.compactMap { $0.image_url }.first { !$0.isEmpty }
            ?? "https://enebrcdrdnfkyduzyrzm.supabase.co/storage/v1/object/public/site-assets/exercise-images/a31c7206-d2a4-4b31-856a-f5dec09b890e-1791475829849.png")
        let title = plan.map { $0.title.components(separatedBy: " · ")[0] } ?? "Sesión completada"
        let next = nextPlan.map { "Siguiente: \($0.day.lowercased()) · \($0.plan.title.components(separatedBy: " · ")[0])" }
        return Button { Haptics.tap(); openSheet() } label: {
            VStack(alignment: .leading, spacing: 0) {
                ZStack(alignment: .bottomLeading) {
                    CachedAsyncImage(url: cover) { $0.resizable().scaledToFill() } placeholder: { Palette.secondary }
                        .frame(maxWidth: .infinity).frame(height: 210).clipped()
                        .overlay { LinearGradient(colors: [.clear, .black.opacity(0.82)], startPoint: .center, endPoint: .bottom) }
                    HStack(spacing: 6) {
                        Image("lu-check").renderingMode(.template).resizable().frame(width: 12, height: 12)
                        Text("HECHO HOY").font(.apCaption.weight(.bold)).tracking(0.8)
                    }
                    .foregroundStyle(Palette.success)
                    .shadow(color: .black.opacity(0.55), radius: 6)
                    .padding(18)
                }
                HStack(alignment: .center, spacing: 12) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(title).font(.apTitle2).lineLimit(2).fixedSize(horizontal: false, vertical: true)
                        Text(next ?? "Buen trabajo. Hoy toca recuperar.").font(.apFootnote).foregroundStyle(Palette.muted).lineLimit(2)
                    }
                    Spacer(minLength: 8)
                    Text("Resumen").font(.apSubhead.weight(.semibold)).foregroundStyle(Palette.gold)
                }
                .padding(18)
            }
            .background(Palette.card)
            .clipShape(RoundedRectangle(cornerRadius: Radius.hero, style: .continuous))
        }
        .buttonStyle(.pressableCard)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Hecho hoy: \(title). \(next ?? "")")
        .accessibilityHint("Abre el resumen del entreno de hoy")
    }

    /// Esqueleto con la misma altura que la tarjeta final: Inicio no salta al terminar de cargar.
    /// Cada bloque mide lo mismo que el texto real al que sustituye (eyebrow, título, detalle,
    /// resumen y acción), así el salto es cero y la pantalla no «baila».
    private var todaySkeleton: some View {
        VStack(alignment: .leading, spacing: 0) {
            RoundedRectangle(cornerRadius: 4, style: .continuous).fill(Palette.secondary).frame(width: 92, height: 13)
            RoundedRectangle(cornerRadius: 8, style: .continuous).fill(Palette.secondary).frame(width: 196, height: 34).padding(.top, 6)
            RoundedRectangle(cornerRadius: 4, style: .continuous).fill(Palette.secondary).frame(width: 132, height: 18).padding(.top, 2)
            RoundedRectangle(cornerRadius: 4, style: .continuous).fill(Palette.secondary).frame(width: 160, height: 18).padding(.top, 4)
            RoundedRectangle(cornerRadius: 25, style: .continuous).fill(Palette.secondary).frame(height: 50).padding(.top, 24)
        }
        .padding(18)
        .frame(maxWidth: .infinity, minHeight: Self.cardMinHeight, alignment: .topLeading)
        .background(Palette.card, in: RoundedRectangle(cornerRadius: Radius.hero, style: .continuous))
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Cargando tu sesión de hoy")
        .accessibilityAddTraits(.updatesFrequently)
    }

    /// Resumen de la sesión de hoy (entreno o actividad). Se toca y abre el detalle en la hoja.
    private func startCard(_ plan: DayPlan) -> some View {
        let parts = plan.title.components(separatedBy: " · ")
        let summary = detail(plan)
        return Button { openSheet() } label: {
            VStack(alignment: .leading, spacing: 0) {
                HStack {
                    Text(plan.isGym ? "Hoy · entreno" : "Hoy · actividad")
                        .font(.apCaption.weight(.semibold)).textCase(.uppercase).tracking(0.6)
                        .foregroundStyle(Palette.gold)
                    Spacer(minLength: 8)
                    Image(systemName: "chevron.up").font(.inter(size: 12, weight: .semibold))
                        .foregroundStyle(Palette.muted.opacity(0.7))
                }
                Text(parts[0]).font(.apTitle1).lineLimit(2).fixedSize(horizontal: false, vertical: true).padding(.top, 6)
                if parts.count > 1 {
                    Text(parts.dropFirst().joined(separator: " · ")).font(.apSubhead).foregroundStyle(Palette.muted)
                        .lineLimit(2).padding(.top, 2)
                }
                if !summary.isEmpty {
                    Text(summary).font(.apSubhead.monospacedDigit()).foregroundStyle(Palette.muted).padding(.top, 4)
                }
                // Píldora dorada, igual que la acción principal de la hoja y el resto de la app
                // (`PillButtonStyle`): una sola forma de «botón» en toda la app.
                Text("Ver la sesión")
                    .font(.apHeadline).foregroundStyle(.black)
                    .frame(maxWidth: .infinity, minHeight: 50)
                    .background(Palette.gold, in: Capsule())
                    .padding(.top, 24)
            }
            .padding(18)
            .frame(maxWidth: .infinity, minHeight: Self.cardMinHeight, alignment: .topLeading)
            .background(Palette.card, in: RoundedRectangle(cornerRadius: Radius.hero, style: .continuous))
        }
        .buttonStyle(.pressableCard)
        .accessibilityLabel([plan.title, summary, "Abrir el detalle de la sesión"].filter { !$0.isEmpty }.joined(separator: ". "))
        .accessibilityHint("Abre el detalle de la sesión de hoy")
        .accessibilityAddTraits(.isButton)
        // Gesto nativo: mantener pulsada la tarjeta ofrece atajos sin quitar el toque principal.
        .contextMenu {
            Button { openSheet() } label: { Label("Ver el detalle", systemImage: "list.bullet.rectangle") }
            Button { Haptics.tap(); onNavigate(.train) } label: { Label("Ir a Entrenar", systemImage: "calendar") }
        }
    }

    // MARK: Hoja con el detalle de la sesión (estilo Hevy, con nuestra identidad)

    @ViewBuilder private var sheetView: some View {
        if let s = snapshot {
            let content = TodaySessionSheet(plan: s.plan, completed: s.completedToday, result: nil,
                                            resumable: s.resumable,
                                            onStart: startToday,
                                            onActivityDone: markActivityDone,
                                            onProgress: openProgress,
                                            onClose: closeSheet)
            #if os(iOS)
            content
                .presentationDetents([.medium, .large])
                .presentationDragIndicator(.visible)
                .presentationBackground(Palette.background)
                .presentationCornerRadius(Radius.hero)
            #else
            content.frame(minWidth: 470, minHeight: 620)
            #endif
        }
    }

    private func openSheet() {
        guard snapshot != nil else { return }
        Haptics.tap()
        sheetOpen = true
    }

    private func closeSheet() { sheetOpen = false }

    /// El aviso lo recoge Entrenar: cambia de pestaña y abre (o reanuda) el entreno de hoy.
    private func startToday() {
        Haptics.tap()
        sheetOpen = false
        Task {
            try? await Task.sleep(for: .milliseconds(450))
            NotificationCenter.default.post(name: .startTodayWorkout, object: nil)
        }
    }

    /// Actividad del día: se marca como hecha y la propia hoja pasa a mostrar el estado hecho.
    private func markActivityDone() {
        guard let id = session.userId, let plan = snapshot?.plan else { return }
        Haptics.success()
        Task {
            try? await TrainingRepo.complete(userId: id, day: plan.day, date: LocalDate.string(), rpe: nil)
            await load()
        }
    }

    private func openProgress() {
        Haptics.tap()
        sheetOpen = false
        onNavigate(.progress)
    }

    // MARK: Celebración

    /// Confeti de un solo uso al completar el día: como máximo una vez por usuario y día, para
    /// que no se repita al cambiar de pestaña ni al volver a abrir la app. Con «Reducir
    /// movimiento» no se lanza y VoiceOver recibe el premio como anuncio de texto.
    private func celebrateIfNeeded() {
        let key = "celebrated-\(session.userIdString ?? "anon")-\(LocalDate.string())"
        guard !UserDefaults.standard.bool(forKey: key) else { return }
        UserDefaults.standard.set(true, forKey: key)
        A11y.announce("Sesión completada. ¡Buen trabajo!")
        guard !reduceMotion else { return }
        Haptics.tap()
        confettiStart = Date()
        withAnimation(.easeOut(duration: 0.2)) { celebrating = true }
        Task {
            try? await Task.sleep(for: .seconds(2.6))
            withAnimation(.easeOut(duration: 0.35)) { celebrating = false }
        }
    }

    // MARK: Accesos: Nutrición y Progreso

    /// Tarjeta-fila de acceso: icono en círculo, título, subtítulo y chevron. Nutrición y Progreso
    /// comparten exactamente el mismo estilo para que Inicio quede coherente.
    private func linkRow(symbol: String, title: String, detail: String,
                         label: String, action: @escaping () -> Void) -> some View {
        Button { Haptics.tap(); action() } label: {
            HStack(spacing: 14) {
                ProgressRing(value: 0, symbol: symbol)
                VStack(alignment: .leading, spacing: 2) {
                    Text(title).font(.apHeadline)
                    // Dos líneas y sin truncar: con texto grande el subtítulo crece hacia abajo
                    // en vez de partirse con puntos suspensivos.
                    Text(detail).font(.apFootnote).foregroundStyle(Palette.muted)
                        .lineLimit(2).fixedSize(horizontal: false, vertical: true)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                Image("lu-chevron-left").renderingMode(.template).resizable().frame(width: 16, height: 16)
                    .rotationEffect(.degrees(180)).foregroundStyle(Palette.muted.opacity(0.6))
                    .accessibilityHidden(true)
            }
            // Mismo padding interior que la tarjeta de hoy (`Card`): los tres bloques de Inicio
            // respiran igual y las filas de Nutrición y Progreso miden lo mismo.
            .padding(18)
            .frame(maxWidth: .infinity, minHeight: 68, alignment: .leading)
            .background(Palette.card, in: RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
        }
        .buttonStyle(.pressableCard)
        .accessibilityLabel(label)
    }

    // MARK: Próxima sesión

    /// Siguiente día con entreno (nunca hoy): mantiene el gancho de «qué toca después».
    private var nextPlan: (plan: DayPlan, day: String)? {
        let scheduled = snapshot?.scheduled ?? []
        guard !scheduled.isEmpty else { return nil }
        for offset in 1...7 {
            let day = DayNames.all[(todayIndex + offset) % 7]
            if let plan = scheduled.first(where: { $0.day == day }) { return (plan, day) }
        }
        return nil
    }

    /// Gran tarjeta de la próxima sesión: la foto manda, con día, título y datos.
    private func nextSessionCard(_ n: (plan: DayPlan, day: String)) -> some View {
        let exercises = n.plan.exercises ?? []
        let totalSets = exercises.reduce(0) { $0 + max($1.series, 1) }
        let cover = exercises.compactMap { $0.image_url }.first.flatMap(URL.init(string:))
        let meta = exercises.isEmpty
            ? (n.plan.intensity.map { "\($0)" } ?? "Actividad")
            : "\(exercises.count) ejercicios · \(totalSets) series"
        return Button { Haptics.tap(); onNavigate(.train) } label: {
            VStack(alignment: .leading, spacing: 0) {
                ZStack(alignment: .bottomLeading) {
                    CachedAsyncImage(url: cover) { $0.resizable().scaledToFill() } placeholder: { Palette.secondary }
                        .frame(maxWidth: .infinity)
                        .frame(height: 210)
                        .clipped()
                        .overlay {
                            // Velo más denso: el dorado del pie necesita contraste garantizado sobre
                            // cualquier foto (las portadas son claras a menudo).
                            LinearGradient(colors: [.clear, .black.opacity(0.82)], startPoint: .center, endPoint: .bottom)
                        }
                    Text("PRÓXIMA SESIÓN · \(n.day.uppercased())")
                        .font(.apCaption.weight(.bold))
                        .tracking(0.8)
                        .foregroundStyle(Palette.gold)
                        .lineLimit(1).minimumScaleFactor(0.6)
                        .shadow(color: .black.opacity(0.55), radius: 6)
                        .padding(18)
                }
                HStack(alignment: .center, spacing: 12) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(n.plan.title.components(separatedBy: " · ")[0])
                            .font(.apTitle2)
                            // Dos líneas con texto grande en lugar de truncar un nombre largo.
                            .lineLimit(2)
                            .fixedSize(horizontal: false, vertical: true)
                        Text(meta)
                            .font(.apFootnote.monospacedDigit())
                            .foregroundStyle(Palette.muted)
                            .lineLimit(2)
                    }
                    Spacer(minLength: 8)
                    Image("lu-chevron-left")
                        .renderingMode(.template)
                        .resizable().frame(width: 16, height: 16)
                        .rotationEffect(.degrees(180))
                        .foregroundStyle(Palette.muted.opacity(0.6))
                        .accessibilityHidden(true)
                }
                .padding(18)
            }
            .background(Palette.card)
            .clipShape(RoundedRectangle(cornerRadius: Radius.hero, style: .continuous))
        }
        .buttonStyle(.pressableCard)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Próxima sesión el \(n.day): \(n.plan.title). \(meta)")
        .accessibilityHint("Abre la rutina de la semana")
    }


    // MARK: Datos

    private func nextSession(_ scheduled: [DayPlan]) -> String? {
        for offset in 1...7 {
            let day = DayNames.all[(todayIndex + offset) % 7]
            if let plan = scheduled.first(where: { $0.day == day }) {
                let name = day.lowercased()
                let when = offset == 1 ? "mañana" : offset == 7 ? "el próximo \(name)" : "el \(name)"
                return "Tu próxima sesión es \(when): \(plan.title)."
            }
        }
        return nil
    }

    private func detail(_ plan: DayPlan) -> String {
        guard plan.isGym else { return [plan.intensity, plan.duration].compactMap { $0 }.joined(separator: " · ") }
        let ex = plan.exercises ?? []
        let series = ex.reduce(0) { $0 + $1.series }
        var parts: [String] = []
        if !ex.isEmpty { parts.append("\(ex.count) \(ex.count == 1 ? "ejercicio" : "ejercicios")") }
        if series > 0 { parts.append("\(series) \(series == 1 ? "serie" : "series")") }
        return parts.joined(separator: " · ")
    }

    private func load() async {
        guard let id = session.userId else { return }
        // Lo de la última visita se pinta al instante y la red lo sustituye sin parpadeo.
        if todayState == nil { todayState = Snapshots.load(TodaySnapshot.self, Self.cacheKey(id)) }
        // Plan (sesiones y días hechos), perfil, nutrición y resultado de hoy, todo a la vez.
        async let planLoad: Void = model.load(userId: id)
        async let name = fetchFirstName(userId: id)
        async let kcal = fetchCalories(userId: id)
        async let pr = fetchLastPr(userId: id)
        let (firstName, nutrition, lastPr) = await (name, kcal, pr)
        await planLoad
        // Un único estado (y a la caché) al terminar la fase: sin redibujados en cadena.
        var snap = makeSnapshot(firstName: firstName, calories: nutrition.kcal)
        snap.macros = nutrition.macros
        snap.mealCount = nutrition.meals
        snap.lastPr = lastPr
        todayState = snap
        TodayCache.shared.save(snap, userId: id)
        Snapshots.save(snap, Self.cacheKey(id))
    }

    private func makeSnapshot(firstName: String, calories: Int?) -> TodaySnapshot {
        let scheduled = model.days.filter { $0.type == "actividad" || !($0.exercises ?? []).isEmpty }
        let plan = model.days.first { $0.day == DayNames.today && ($0.isGym ? !($0.exercises ?? []).isEmpty : $0.type == "actividad") }
        let completed = model.completions.contains { $0.date == LocalDate.string() }
        let draftDay = session.userIdString.flatMap { ActiveWorkout.restore(userId: $0)?.day.day }
        return TodaySnapshot(plan: plan,
                             scheduled: scheduled,
                             completedToday: completed,
                             resumable: plan != nil && draftDay == plan?.day,
                             firstName: firstName,
                             calories: calories,
                             noPlan: model.error == nil && model.days.isEmpty)
    }

    /// Clave de la copia en disco: por usuario y día (lo de hoy caduca al cambiar el día).
    static func cacheKey(_ id: UUID) -> String {
        "home|\(id.uuidString.lowercased())|\(LocalDate.string())"
    }

    private func fetchFirstName(userId: UUID) async -> String {
        struct P: Decodable { let name: String? }
        guard let p: P = try? await Backend.client.from("profiles").select("name").eq("user_id", value: userId).single().execute().value else {
            return snapshot?.firstName ?? ""
        }
        return (p.name ?? "").components(separatedBy: " ").first ?? ""
    }

    private func fetchCalories(userId: UUID) async -> (kcal: Int?, macros: MacroSum?, meals: Int) {
        struct M: Decodable { let calories: Double?; let protein: Double?; let carbs: Double?; let fats: Double? }
        struct N: Decodable { let macros_json: M?; let meals_json: [Meal]? ; struct Meal: Decodable { let name: String? } }
        let rows: [N] = (try? await Backend.client.from("nutrition_plan").select("macros_json, meals_json").eq("user_id", value: userId).limit(1).execute().value) ?? []
        guard let m = rows.first?.macros_json, m.protein != nil || m.calories != nil else {
            // Sin Plus no se puede leer el plan: los macros se estiman con el onboarding (siempre gratis).
            if let e = await MacroEstimate.load(userId: userId) { return (Int(e.kcal), MacroSum(p: e.p, c: e.c, f: e.f), 0) }
            return (snapshot?.calories, snapshot?.macros, snapshot?.mealCount ?? 0)
        }
        let kcal = Int((m.calories ?? ((m.protein ?? 0) * 4 + (m.carbs ?? 0) * 4 + (m.fats ?? 0) * 9)).rounded())
        let macros = m.protein.map { MacroSum(p: $0, c: m.carbs ?? 0, f: m.fats ?? 0) }
        return (kcal, macros, rows.first?.meals_json?.count ?? 0)
    }

    private func fetchLastPr(userId: UUID) async -> LastPR? {
        struct R: Decodable { let exercise_name: String; let weight: Double; let reps: Int; let achieved_at: String }
        let rows: [R] = (try? await Backend.client.from("personal_records").select("exercise_name, weight, reps, achieved_at")
            .eq("user_id", value: userId).order("achieved_at", ascending: false).limit(1).execute().value) ?? []
        guard let r = rows.first else { return snapshot?.lastPr }
        // Fecha como texto: Postgres devuelve microsegundos que el decodificador de fechas no acepta.
        let iso = ISO8601DateFormatter(); iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let date = iso.date(from: r.achieved_at) ?? ISO8601DateFormatter().date(from: r.achieved_at) ?? Date()
        return LastPR(exercise: r.exercise_name, weight: r.weight, reps: r.reps, achievedAt: date)
    }

}

// MARK: - Estado y caché de «hoy»

/// Lo de hoy, en un único valor: se publica de golpe y se cachea por usuario y día.
/// Gramos de proteína, carbos y grasas del plan (Codable para poder guardarlos en disco).
struct MacroSum: Codable, Equatable {
    var p: Double
    var c: Double
    var f: Double
}

private struct TodaySnapshot: Codable {
    /// Sesión de hoy (entreno o actividad); nil si hoy toca descansar.
    var plan: DayPlan?
    /// Sesiones de la semana (para contar la próxima sesión).
    var scheduled: [DayPlan] = []
    var completedToday = false
    /// Hay un entreno a medias de hoy: la acción pasa a ser «Continuar entreno».
    var resumable = false
    var firstName = ""
    var calories: Int?
    /// Aún no hay rutina (ni sesiones ni descansos): Inicio invita a prepararla.
    var noPlan: Bool?
    /// Gramos de proteína, carbos y grasas del plan (widget de Nutrición).
    var macros: MacroSum?
    /// Última mejor marca (widget de Récord).
    var lastPr: LastPR?
    /// Número de comidas del plan (anillo del widget de Nutrición).
    var mealCount = 0
}

struct LastPR: Codable {
    let exercise: String
    let weight: Double
    let reps: Int
    let achievedAt: Date
    var dateLabel: String { achievedAt.formatted(.dateTime.day().month(.abbreviated).locale(Locale(identifier: "es_ES"))) }
}

/// Cache en memoria (por usuario y día) de lo de hoy: Inicio pinta sin esperar a la red.
@MainActor
private final class TodayCache {
    static let shared = TodayCache()
    private var items: [String: TodaySnapshot] = [:]

    func snapshot(userId: UUID) -> TodaySnapshot? { items[key(userId)] }
    func save(_ snapshot: TodaySnapshot, userId: UUID) { items[key(userId)] = snapshot }

    private func key(_ userId: UUID) -> String {
        "\(userId.uuidString.lowercased())|\(LocalDate.string())"
    }
}

/// Cifras del entreno de hoy ya completado (mismo cálculo que el resumen de `WorkoutView`).
private struct TodayResult {
    var exercises: Int
    var sets: Int
    var volume: Double
    var records: [String]
}

// MARK: - Piezas compartidas de los resultados

/// Cifras del entrenamiento completado en filas equilibradas: 3 columnas iguales o 2, sin huecos.
private struct ResultMetrics: View {
    let result: TodayResult
    /// Dentro de una tarjeta (Inicio) el tile va en gris secundario: sobre `Palette.card` se
    /// fundiría con el fondo. Suelto sobre el negro de la hoja, va en el gris de tarjeta.
    var onCard = false
    /// Alto común de los tres tiles, escalado con el texto: las cifras quedan siempre alineadas,
    /// aunque una etiqueta ocupe dos líneas con Dynamic Type grande.
    @ScaledMetric(relativeTo: .footnote) private var tileHeight: CGFloat = 78

    private struct Item: Identifiable {
        let label: String
        let value: String
        var unit: String?
        var accent = false
        var id: String { label }
    }

    private var items: [Item] {
        var out: [Item] = []
        if result.volume > 0 {
            out.append(Item(label: "Volumen", value: NumberText.integer(Int(result.volume.rounded())), unit: "kg", accent: true))
        }
        out.append(Item(label: "Series", value: "\(result.sets)"))
        out.append(Item(label: "Ejercicios", value: "\(result.exercises)"))
        return out
    }

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            ForEach(items) { item in tile(item) }
        }
    }

    /// Cifra compacta, con el lenguaje de las tarjetas del resumen de `WorkoutView`.
    /// El valor va a 24 pt (no `apFigureSmall`) para que «12.345 kg» y «12» tengan el mismo
    /// tamaño en columnas estrechas y no salten escalados distintos en cada tile.
    private func tile(_ item: Item) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(item.label).font(.apFootnote.weight(.semibold))
                .foregroundStyle(item.accent ? Palette.gold : Palette.muted)
                .lineLimit(1).minimumScaleFactor(0.6)
            (Text(item.value).foregroundColor(item.accent ? Palette.gold : Palette.foreground)
                + Text(item.unit.map { " \($0)" } ?? "").font(.inter(size: 13, weight: .semibold)).foregroundColor(Palette.muted))
                .font(.inter(size: 24, weight: .bold).monospacedDigit())
                .lineLimit(1).minimumScaleFactor(0.6)
        }
        .padding(.horizontal, 12).padding(.vertical, 10)
        .frame(maxWidth: .infinity, alignment: .leading)
        // Alto común (escalado con el texto) y contenido centrado: los tres tiles quedan
        // perfectamente alineados y con el mismo aire arriba y abajo.
        .frame(height: tileHeight)
        .background(onCard ? Palette.secondary : Palette.card, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        .accessibilityElement(children: .combine)
    }
}

/// Récords batidos hoy (como la tarjeta del resumen de `WorkoutView`).
private struct RecordsCard: View {
    let names: [String]
    /// Igual que en `ResultMetrics`: dentro de la tarjeta de resultados necesita el gris
    /// secundario para no desaparecer sobre `Palette.card`.
    var onCard = false

    var body: some View {
        HStack(spacing: 12) {
            Image("lu-trophy").renderingMode(.template).resizable().frame(width: 20, height: 20)
                .foregroundStyle(Palette.gold).accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 2) {
                Text(names.count == 1 ? "Nuevo récord" : "\(names.count) récords nuevos")
                    .font(.apFootnote.weight(.semibold)).foregroundStyle(Palette.gold)
                Text(names.joined(separator: " · ")).font(.apSubhead).lineLimit(2)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(onCard ? Palette.secondary : Palette.card, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        .accessibilityElement(children: .combine)
    }
}

// MARK: - Hoja de detalle de la sesión de hoy

/// Detalle de la sesión de hoy en una hoja (estilo Hevy, con nuestra identidad): cabecera,
/// ejercicios con sus fotos, los resultados si ya está hecho y la acción principal abajo.
private struct TodaySessionSheet: View {
    let plan: DayPlan?
    let completed: Bool
    let result: TodayResult?
    let resumable: Bool
    var onStart: () -> Void = {}
    var onActivityDone: () -> Void = {}
    var onProgress: () -> Void = {}
    var onClose: () -> Void = {}

    private var parts: [String] { (plan?.title ?? "Sesión completada").components(separatedBy: " · ") }
    private var exercises: [GymExercise] { plan?.exercises ?? [] }
    private var totalSets: Int { exercises.reduce(0) { $0 + max($1.series, 1) } }
    private var activityDetail: String {
        guard let plan, !plan.isGym else { return "" }
        return [plan.intensity, plan.duration].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: " · ")
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            header.padding(.horizontal, 20).padding(.top, 18).padding(.bottom, 12)
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    if completed {
                        resultsSection
                    } else if plan?.isGym == true {
                        if exercises.isEmpty {
                            Text("Este día no tiene ejercicios asignados todavía.")
                                .font(.apSubhead).foregroundStyle(Palette.muted)
                        } else {
                            exerciseList
                        }
                    } else {
                        activityRows
                    }
                }
                .padding(.horizontal, 20).padding(.top, 4).padding(.bottom, 16)
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            actionBar
        }
        .background(Palette.background)
    }

    private var header: some View {
        HStack(alignment: .top, spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                Text(completed ? "Completado hoy" : plan?.isGym == true ? "Hoy · entreno" : "Hoy · actividad")
                    .font(.apCaption.weight(.semibold)).textCase(.uppercase).tracking(0.6)
                    .foregroundStyle(completed ? Palette.success : Palette.gold)
                Text(parts[0]).font(.apTitle1).lineLimit(3).fixedSize(horizontal: false, vertical: true)
                    .accessibilityAddTraits(.isHeader)
                if parts.count > 1 {
                    Text(parts.dropFirst().joined(separator: " · ")).font(.apSubhead).foregroundStyle(Palette.muted).lineLimit(2)
                }
                if plan?.isGym == true, !exercises.isEmpty {
                    Text("\(exercises.count) ejercicios · \(totalSets) series")
                        .font(.apFootnote.monospacedDigit()).foregroundStyle(Palette.muted)
                } else if !activityDetail.isEmpty {
                    Text(activityDetail).font(.apFootnote.monospacedDigit()).foregroundStyle(Palette.muted)
                }
            }
            Spacer(minLength: 8)
            Button(action: onClose) {
                Image(systemName: "xmark").font(.inter(size: 12, weight: .bold))
                    .foregroundStyle(Palette.muted)
                    .frame(width: 32, height: 32)
                    .background(Palette.secondary, in: Circle())
                    // Área táctil de 44 pt (mínimo de Apple) alrededor del círculo visual de 32.
                    .frame(width: 44, height: 44)
                    .contentShape(Circle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Cerrar")
            .accessibilityHint("Cierra el detalle de la sesión")
        }
    }

    /// Lista de ejercicios con su foto y sus series × reps. Filas de altura y márgenes idénticos
    /// (miniatura de 48, padding 16 · 10) y separador alineado con el texto, no con la foto.
    private var exerciseList: some View {
        VStack(spacing: 0) {
            ForEach(Array(exercises.enumerated()), id: \.offset) { i, ex in
                HStack(spacing: 12) {
                    ExerciseThumb(url: ex.image_url, size: 48)
                    VStack(alignment: .leading, spacing: 3) {
                        Text(ex.name).font(.apHeadline).lineLimit(2)
                            .fixedSize(horizontal: false, vertical: true)
                        let info = [ex.rest, ex.muscle_group].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: " · ")
                        if !info.isEmpty {
                            Text(info).font(.apFootnote).foregroundStyle(Palette.muted).lineLimit(2)
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    // Columna de series × reps con ancho propio: los números quedan alineados a la
                    // derecha en todas las filas y nunca se parten.
                    Text("\(ex.series) × \(ex.reps)")
                        .font(.apSubhead.monospacedDigit()).foregroundStyle(Palette.muted)
                        .lineLimit(1).fixedSize(horizontal: true, vertical: false)
                }
                .padding(.horizontal, 16).padding(.vertical, 10)
                .frame(minHeight: 68)
                .overlay(alignment: .bottom) {
                    // 16 + 48 (foto) + 12: el separador arranca donde arranca el texto.
                    if i < exercises.count - 1 {
                        Rectangle().fill(Palette.separator).frame(height: 0.5)
                            .padding(.leading, 76).padding(.trailing, 16)
                    }
                }
                .accessibilityElement(children: .ignore)
                // Se lee como una ficha: nombre y, después, series × reps y descanso.
                .accessibilityLabel(accessibilityLabel(for: ex))
            }
        }
        .background(Palette.card, in: RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
        .clipShape(RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
    }

    /// Lectura de VoiceOver de una fila: «Press banca, 4 series de 10 repeticiones, 90s, Pecho».
    private func accessibilityLabel(for ex: GymExercise) -> String {
        var parts = ["\(ex.name), \(ex.series) series de \(ex.reps) repeticiones"]
        let info = [ex.rest, ex.muscle_group].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: ", ")
        if !info.isEmpty { parts.append(info) }
        return parts.joined(separator: ". ")
    }

    private var activityRows: some View {
        VStack(spacing: 0) {
            sheetInfoRow("lu-flame", "Intensidad", plan?.intensity ?? "—", last: false)
            sheetInfoRow("lu-clock", "Duración", planDuration, last: true)
        }
        .background(Palette.card, in: RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
    }

    /// Duración: la del plan o, si falta, estimada por series y descansos.
    private var planDuration: String {
        if let d = plan?.duration?.trimmingCharacters(in: .whitespaces), !d.isEmpty { return d }
        let exercises = plan?.exercises ?? []
        guard !exercises.isEmpty else { return "—" }
        let seconds = exercises.reduce(0.0) { total, e in
            let rest = Double(e.rest.filter { $0.isNumber }) ?? 60
            return total + Double(max(e.series, 1)) * (rest + 40)
        }
        return "≈ \(Int((seconds / 60).rounded())) min"
    }

    private func sheetInfoRow(_ icon: String, _ title: String, _ value: String, last: Bool) -> some View {
        HStack(spacing: 12) {
            Image(icon).renderingMode(.template).resizable().frame(width: 20, height: 20)
                .foregroundStyle(Palette.muted).frame(width: 28)
                .accessibilityHidden(true)
            Text(title).font(.apBody)
            Spacer(minLength: 8)
            Text(value).font(.apBody).foregroundStyle(Palette.muted)
                .lineLimit(1).fixedSize(horizontal: true, vertical: false)
        }
        .frame(minHeight: 48)
        .padding(.horizontal, 16)
        .overlay(alignment: .bottom) {
            // 16 + 28 (icono) + 12: el separador empieza donde empieza el texto.
            if !last {
                Rectangle().fill(Palette.separator).frame(height: 0.5)
                    .padding(.leading, 56).padding(.trailing, 16)
            }
        }
        .accessibilityElement(children: .combine)
    }

    @ViewBuilder private var resultsSection: some View {
        if let r = result, r.sets > 0 {
            ResultMetrics(result: r)
            if !r.records.isEmpty { RecordsCard(names: r.records) }
        } else {
            Text(completedNote).font(.apSubhead).foregroundStyle(Palette.muted)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    private var completedNote: String {
        guard let plan else { return "Tu sesión de hoy ya está registrada." }
        let summary = plan.isGym
            ? (exercises.isEmpty ? "" : "\(exercises.count) ejercicios · \(totalSets) series")
            : activityDetail
        let label = plan.isGym ? "Sesión completada" : "Actividad completada"
        return summary.isEmpty ? "\(label)." : "\(label) · \(summary)"
    }

    /// Barra inferior fija de la hoja: misma altura y mismos márgenes en los tres estados y con
    /// un filete superior, para que el contenido que se desplaza no se corte «a hueso».
    @ViewBuilder private var actionBar: some View {
        if completed || plan != nil {
            VStack(spacing: 0) {
                Rectangle().fill(Palette.separator).frame(height: 0.5)
                Group {
                    if completed {
                        Button("Ver mi progreso", action: onProgress)
                            .buttonStyle(PillButtonStyle(kind: .primary, height: 54))
                            .accessibilityHint("Abre el histórico de tus entrenamientos")
                    } else if plan?.isGym == true {
                        Button(action: onStart) {
                            Label(resumable ? "Continuar entreno" : "Empezar entrenamiento", systemImage: "play.fill")
                        }
                        .buttonStyle(PillButtonStyle(kind: .primary, height: 54))
                        .accessibilityHint(resumable ? "Retoma el entreno que dejaste a medias" : "Abre el entreno de hoy para registrar series")
                    } else {
                        Button("Marcar actividad como hecha", action: onActivityDone)
                            .buttonStyle(PillButtonStyle(kind: .primary, height: 54))
                            .accessibilityHint("Marca la actividad de hoy como completada")
                    }
                }
                .padding(.horizontal, 20).padding(.top, 14).padding(.bottom, 20)
            }
            .background(Palette.background)
        }
    }
}

extension String {
    var capitalizedFirst: String { prefix(1).uppercased() + dropFirst() }
}

// MARK: - Celebración

/// Confeti ligero de «día completado»: SwiftUI puro (`Canvas` + `TimelineView`), sin dependencias
/// ni archivos nuevos. Las partículas se calculan a partir de su índice con ruido determinista,
/// así que no hace falta `@State` por partícula ni `Random` (que daría valores distintos en cada
/// frame). El llamador lo retira de la jerarquía a los 2,6 s y nunca lo lanza con «Reducir
/// movimiento» activado.
private struct ConfettiView: View {
    /// Caída máxima de una partícula.
    private static let lifetime: Double = 2.2
    private static let pieceCount = 44
    private static let colors: [Color] = [Palette.gold, .white, Palette.success, Palette.gold.opacity(0.65)]
    /// Lo fija quien lo lanza: así los redibujados de la pantalla no reinician la caída.
    let start: Date

    /// Ruido determinista en 0…1 por partícula (hash entero): idéntico en cada frame.
    private static func noise(_ index: Int, _ salt: Int) -> Double {
        var h = UInt64(truncatingIfNeeded: index &* 2_654_435_761 &+ salt &* 40_503)
        h ^= h >> 33
        h = h &* 0xff51_afd7_ed55_8ccd
        h ^= h >> 33
        h = h &* 0xc4ce_b9fe_1a85_ec53
        h ^= h >> 33
        return Double(h % 10_000) / 10_000
    }

    var body: some View {
        TimelineView(.animation) { context in
            Canvas { ctx, size in
                let t = context.date.timeIntervalSince(start)
                guard t >= 0, t <= Self.lifetime else { return }
                for i in 0..<Self.pieceCount {
                    let delay = Self.noise(i, 1) * 0.45
                    let local = t - delay
                    guard local > 0 else { continue }
                    let fall = 1.25 + Self.noise(i, 2) * 0.75
                    let p = min(local / fall, 1)
                    // Cae acelerando y con una deriva lateral muy leve.
                    let x = size.width * (0.06 + 0.88 * Self.noise(i, 3))
                        + (Self.noise(i, 4) - 0.5) * 120 * p
                    let y = -18 + (size.height + 48) * (p * p * 0.82 + p * 0.18)
                    let w = 5 + Self.noise(i, 5) * 6
                    let h = w * (0.5 + Self.noise(i, 6) * 0.7)
                    let spin = Self.noise(i, 7) * 360 + p * 540
                    // Se desvanecen en el último cuarto del recorrido.
                    ctx.opacity = 1 - max(0, (p - 0.78) / 0.22)
                    let piece = Path(roundedRect: CGRect(x: -w / 2, y: -h / 2, width: w, height: h), cornerRadius: 1.5)
                        .applying(CGAffineTransform(rotationAngle: spin * .pi / 180))
                        .offsetBy(dx: x, dy: y)
                    ctx.fill(piece, with: .color(Self.colors[i % Self.colors.count]))
                }
            }
        }
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }
}


private extension View {
    /// Cuadrada (iPhone) o con altura fija (Mac/iPad), sin estirarse con el ancho.
    @ViewBuilder func squareTile(_ square: Bool, height: CGFloat) -> some View {
        if square { aspectRatio(1, contentMode: .fill) } else { frame(height: height) }
    }
}
