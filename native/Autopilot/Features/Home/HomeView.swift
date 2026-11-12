import SwiftUI
import Supabase

/// Inicio reúne el saludo, la sesión de hoy, el plan semanal y los resúmenes de nutrición y récords.
/// La tarjeta de hoy abre el detalle en una hoja con los ejercicios y sus acciones.
struct HomeView: View {
    /// Menú de la app (macOS): «Empezar entreno de hoy» cambia a Inicio y abre el entreno aquí.
    static var pendingStartToday = false
    @EnvironmentObject private var session: SessionModel
    #if !os(macOS)
    @Environment(\.horizontalSizeClass) private var sizeClass
    #endif
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @StateObject private var model = PlanModel()
    /// «Empezar» en la hoja de hoy: el entreno se abre al terminar de cerrarse la hoja.
    @State private var startAfterDismiss = false
    /// Todo lo de hoy en un único valor: se publica de golpe y se cachea por usuario y día.
    @State private var todayState: TodaySnapshot?
    @State private var sheetOpen = false
    /// Rutina que se está viendo/editando desde Inicio.
    @State private var editingDay: DayPlan? = nil
    /// Entreno en curso abierto directamente desde Inicio (sin pasar por Entrenar).
    @State private var activeWorkout: ActiveWorkout? = nil
    /// Rutina desplegada en «Tus rutinas» (ver/editar sin salir de Inicio).
    @State private var expandedRoutine: String? = nil
    /// Editor de la rutina («Editar» en «Tu programa») y selector del entreno vacío.
    @State private var planEditorOpen = false
    @State private var pickingEmpty = false
    /// Confeti de «día completado»: se enciende una sola vez al día (ver `celebrateIfNeeded`).
    @State private var celebrating = false
    /// Instante de inicio del confeti: se guarda aquí para que un redibujado de Inicio no
    /// reinicie las partículas a mitad de la caída.
    @State private var confettiStart = Date()
    var onNavigate: (AppSection) -> Void = { _ in }

    /// Altura reservada de la tarjeta de hoy: el esqueleto de carga y la tarjeta de empezar miden
    /// exactamente lo mismo (los bloques del esqueleto son el fantasma de los de la tarjeta).
    private static let cardMinHeight: CGFloat = 156

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


    /// Foto de hoy: la recién cargada o, si aún no hay, la cacheada en memoria para este usuario.
    /// Así Inicio pinta al instante al volver a la pestaña, sin esperar a la red.
    private var snapshot: TodaySnapshot? {
        if let todayState { return todayState }
        guard let id = session.userId else { return nil }
        return TodayCache.shared.snapshot(userId: id)
    }

    // MARK: Hoy (diseño de ChatGPT, igual que `HomeOverview.tsx`)

    /// Saludo: «Hoy» pequeño, el nombre grande y una línea en gris.
    private var greetingHeader: some View {
        let name = snapshot?.firstName ?? ""
        return VStack(alignment: .leading, spacing: 2) {
            Text("Hoy").font(.apSubhead.weight(.medium)).foregroundStyle(Palette.muted)
                .accessibilityAddTraits(.isHeader)
            Text(name.isEmpty ? "Hola" : name)
                .font(.inter(size: 34, weight: .bold)).tracking(-0.7)
                .lineLimit(1).minimumScaleFactor(0.7)
            Text(headline).font(.apSubhead).foregroundStyle(Palette.muted)
                .fixedSize(horizontal: false, vertical: true).padding(.top, 2)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var headline: String {
        guard let s = snapshot else { return "La constancia crea el cambio." }
        if s.completedToday { return "Buen trabajo hoy." }
        if s.plan == nil && !s.scheduled.isEmpty { return "Semana completa." }
        return "La constancia crea el cambio."
    }

    private struct WeekDay { let letter: String; let name: String; let day: Int; let key: String; let isToday: Bool }

    private static let weekNames: [(String, String)] = [
        ("L", "lunes"), ("M", "martes"), ("X", "miércoles"), ("J", "jueves"), ("V", "viernes"), ("S", "sábado"), ("D", "domingo"),
    ]

    /// La semana en curso, de lunes a domingo (como `weekDays` en la web).
    private var weekDays: [WeekDay] {
        let calendar = Calendar(identifier: .gregorian)
        let now = Date()
        let offset = (calendar.component(.weekday, from: now) + 5) % 7 // domingo = 1 → 6; lunes = 2 → 0
        let monday = calendar.date(byAdding: .day, value: -offset, to: calendar.startOfDay(for: now)) ?? now
        let today = LocalDate.string(now)
        return Self.weekNames.enumerated().map { index, names in
            let date = calendar.date(byAdding: .day, value: index, to: monday) ?? monday
            let key = LocalDate.string(date)
            return WeekDay(letter: names.0, name: names.1, day: calendar.component(.day, from: date), key: key, isToday: key == today)
        }
    }

    /// La semana en píldoras: hoy con borde dorado y un punto dorado en los días entrenados.
    private var weekStrip: some View {
        let trained = Set(snapshot?.trainedDates ?? [])
        return HStack(spacing: 6) {
            ForEach(weekDays, id: \.key) { day in
                let done = trained.contains(day.key)
                VStack(spacing: 4) {
                    Text(day.letter).font(.inter(size: 11, weight: .medium)).foregroundStyle(Palette.muted)
                    Text("\(day.day)").font(.inter(size: 17, weight: .semibold)).monospacedDigit()
                        .foregroundStyle(day.isToday ? Palette.gold : Palette.foreground)
                    Circle().fill(done ? Palette.gold : Color.clear).frame(width: 4, height: 4)
                }
                .frame(maxWidth: .infinity, minHeight: 68)
                .background(SurfaceBackground(shape: Capsule()))
                .overlay { if day.isToday { Capsule().strokeBorder(Palette.gold, lineWidth: 1.5) } }
                .accessibilityElement(children: .ignore)
                .accessibilityLabel("\(day.name) \(day.day)\(day.isToday ? ", hoy" : "")\(done ? ", entrenaste" : "")")
            }
        }
        .dynamicTypeSize(...DynamicTypeSize.xxLarge)
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Esta semana")
    }

    /// Tu día en tres cifras con anillo: kcal y proteína del objetivo (anillo = comidas marcadas hoy)
    /// y las sesiones de la semana.
    private var dayFigures: some View {
        let sessions = snapshot?.scheduled ?? []
        let done = Set(snapshot?.doneDays ?? [])
        let doneCount = sessions.filter { done.contains($0.day) }.count
        let meals = mealsProgress
        return HStack(spacing: 12) {
            figureTile(icon: "lu-flame", progress: meals, value: snapshot?.calories.map { NumberText.integer($0) },
                       caption: "kcal", label: "Calorías") { onNavigate(.nutrition) }
            figureTile(icon: "lu-beef", progress: meals, value: snapshot?.macros.map { NumberText.integer(Int($0.p.rounded())) },
                       caption: "g proteína", label: "Proteína") { onNavigate(.nutrition) }
            figureTile(icon: "lu-dumbbell", progress: sessions.isEmpty ? 0 : Double(doneCount) / Double(sessions.count),
                       value: sessions.isEmpty ? nil : "\(doneCount)/\(sessions.count)", caption: "sesiones", label: "Sesiones") {
                // Como «training» sin día en la web: abre la siguiente sesión.
                if let next = sessions.first(where: { !done.contains($0.day) }) ?? sessions.first { editingDay = next }
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Tu día")
    }

    /// Comidas marcadas hoy sobre las del plan; sin plan de comidas, el anillo queda vacío.
    private var mealsProgress: Double {
        let total = snapshot?.mealCount ?? 0
        guard total > 0 else { return 0 }
        let c = Calendar.current.dateComponents([.year, .month, .day], from: Date())
        let key = "meals_done_\(session.userIdString ?? "")_\(c.year!)-\(c.month!)-\(c.day!)"
        let done = UserDefaults.standard.data(forKey: key).flatMap { try? JSONDecoder().decode([String].self, from: $0) }?.count ?? 0
        return min(1, Double(done) / Double(total))
    }

    /// Cifra del día: anillo dorado con su icono, la cifra grande y debajo su unidad («kcal», «g proteína»).
    /// Sin cifra, «Sin datos» y su nombre.
    private func figureTile(icon: String, progress: Double, value: String?, caption: String, label: String,
                            action: @escaping () -> Void) -> some View {
        Button { Haptics.tap(); action() } label: {
            VStack(alignment: .leading, spacing: 0) {
                ZStack {
                    Circle().stroke(Palette.secondary, lineWidth: 3.5)
                    if progress > 0 {
                        Circle().trim(from: 0, to: min(1, progress))
                            .stroke(Palette.gold, style: StrokeStyle(lineWidth: 3.5, lineCap: .round))
                            .rotationEffect(.degrees(-90))
                    }
                    Image(icon).renderingMode(.template).resizable().frame(width: 16, height: 16)
                        .foregroundStyle(Palette.gold)
                }
                .frame(width: 40, height: 40)
                if let value {
                    Text(value).font(.inter(size: wideLayout ? 30 : 24, weight: .bold)).monospacedDigit()
                        .lineLimit(1).minimumScaleFactor(0.6)
                        .padding(.top, 12)
                } else {
                    Text("Sin datos").font(.apFootnote).foregroundStyle(Palette.muted).padding(.top, 12)
                }
                Text(value == nil ? label : caption).font(.apFootnote).foregroundStyle(Palette.muted)
                    .lineLimit(1).minimumScaleFactor(0.8).padding(.top, 2)
            }
            .padding(wideLayout ? 20 : 14)
            .frame(maxWidth: .infinity, alignment: .leading)
            .surface()
        }
        .buttonStyle(.pressableCard)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(value.map { "\(label): \($0) \(caption)" } ?? "\(label): sin datos")
        .accessibilityAddTraits(.isButton)
    }

    /// «Entreno vacío» (como en Hevy y en la web): se eligen los ejercicios y se empieza, sin rutina.
    private var emptyWorkoutButton: some View {
        Button {
            Haptics.tap()
            // Con un entreno a medias se continúa ese: empezar otro borraría sus series.
            if let id = session.userIdString, let draft = ActiveWorkout.restore(userId: id) {
                activeWorkout = ActiveWorkout(draft: draft)
            } else {
                pickingEmpty = true
            }
        } label: {
            Label { Text("Entreno vacío") } icon: { Image(systemName: "plus").font(.inter(.body).weight(.semibold)) }
        }
        .buttonStyle(.pillSecondary)
        .accessibilityHint("Eliges los ejercicios y empiezas a entrenar")
    }

    /// «Tu plan»: lo hecho esta semana con su barra dorada y, debajo, una fila por sesión de la rutina
    /// (miniatura, foco muscular y check dorado si ya está hecha). Al tocar, el detalle de la sesión.
    @ViewBuilder private var planSection: some View {
        let sessions = snapshot?.scheduled ?? []
        let done = Set(snapshot?.doneDays ?? [])
        let doneCount = sessions.filter { done.contains($0.day) }.count
        if !sessions.isEmpty {
            VStack(alignment: .leading, spacing: 12) {
                HStack(alignment: .firstTextBaseline) {
                    Text("Tu plan").font(.apTitle3)
                        .accessibilityAddTraits(.isHeader)
                    Spacer(minLength: 8)
                    Button("Editar") { Haptics.tap(); planEditorOpen = true }
                        .font(.apSubhead.weight(.semibold)).foregroundStyle(Palette.gold)
                        .buttonStyle(.plain).frame(minHeight: 44).padding(.vertical, -12)
                        .accessibilityLabel("Editar rutina")
                }
                VStack(alignment: .leading, spacing: 0) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Esta semana").font(.apHeadline)
                        Text("\(doneCount) de \(sessions.count) \(sessions.count == 1 ? "sesión completada" : "sesiones completadas")")
                            .font(.apFootnote.monospacedDigit()).foregroundStyle(Palette.muted)
                        GeometryReader { geo in
                            ZStack(alignment: .leading) {
                                Capsule().fill(Palette.secondary)
                                Capsule().fill(Palette.gold)
                                    .frame(width: geo.size.width * CGFloat(doneCount) / CGFloat(sessions.count))
                            }
                        }
                        .frame(height: 6)
                        .padding(.top, 10)
                        .accessibilityHidden(true)
                    }
                    .padding(.horizontal, 18).padding(.top, 18).padding(.bottom, 16)
                    .accessibilityElement(children: .combine)
                    ForEach(sessions, id: \.day) { plan in
                        let isDone = done.contains(plan.day)
                        Button {
                            Haptics.selection()
                            editingDay = plan
                        } label: {
                            HStack(spacing: 14) {
                                routineThumb(plan)
                                VStack(alignment: .leading, spacing: 3) {
                                    Text(plan.title.components(separatedBy: " · ")[0])
                                        .font(.apHeadline).foregroundStyle(Palette.foreground)
                                        .lineLimit(1)
                                    Text(programSubtitle(plan))
                                        .font(.apFootnote).foregroundStyle(Palette.muted)
                                        .lineLimit(1)
                                }
                                .frame(maxWidth: .infinity, alignment: .leading)
                                if isDone {
                                    Image(systemName: "checkmark")
                                        .font(.system(size: 11, weight: .bold))
                                        .foregroundStyle(Palette.background)
                                        .frame(width: 24, height: 24)
                                        .background(Palette.gold, in: Circle())
                                        .accessibilityHidden(true)
                                } else {
                                    Image(systemName: "chevron.right")
                                        .font(.system(size: 13, weight: .semibold))
                                        .foregroundStyle(Palette.muted)
                                        .accessibilityHidden(true)
                                }
                            }
                            .padding(.horizontal, 14).padding(.vertical, 10)
                            .frame(maxWidth: .infinity, minHeight: 76, alignment: .leading)
                            .contentShape(Rectangle())
                            .overlay(alignment: .top) {
                                Rectangle().fill(Palette.foreground.opacity(0.06)).frame(height: 1)
                                    .padding(.horizontal, 14)
                            }
                        }
                        .buttonStyle(.plain)
                        .accessibilityElement(children: .combine)
                        .accessibilityLabel("Ver sesión \(plan.title)\(isDone ? ", hecha esta semana" : "")")
                        .accessibilityHint("Abre la sesión para ver y editar sus ejercicios")
                    }
                }
                .surface()
            }
        }
    }

    /// Miniatura de una sesión del programa: portada (foto propia o IA) y, sin ella, la foto de su
    /// primer ejercicio; como último recurso, su icono sobre el fondo de marca.
    @ViewBuilder private func routineThumb(_ plan: DayPlan) -> some View {
        let shape = RoundedRectangle(cornerRadius: 16, style: .continuous)
        let firstPhoto = (plan.exercises ?? []).compactMap { $0.image_url }.first.flatMap(URL.init(string:))
        ZStack {
            Palette.secondary
            if let cover = plan.cover_url, let url = URL(string: cover) {
                CachedAsyncImage(url: url) { $0.resizable().scaledToFill() } placeholder: { Palette.secondary }
            } else if let firstPhoto {
                CachedAsyncImage(url: firstPhoto) { $0.resizable().scaledToFill() } placeholder: { Palette.secondary }
            } else if let icon = SessionIdentity.clean(plan.session_icon) {
                Image(systemName: icon).font(.inter(size: 22, weight: .semibold)).foregroundStyle(Palette.gold)
            } else {
                Image(systemName: "dumbbell").font(.inter(size: 22, weight: .semibold)).foregroundStyle(Palette.gold)
            }
        }
        .frame(width: 56, height: 56)
        .clipShape(shape)
        .overlay(shape.strokeBorder(Palette.foreground.opacity(0.08), lineWidth: 1))
        .accessibilityHidden(true)
    }

    /// Línea gris de cada sesión: su foco muscular o, sin él, el resumen de ejercicios.
    private func programSubtitle(_ plan: DayPlan) -> String {
        if let focus = plan.muscle_focus, !focus.isEmpty { return focus }
        let parts = plan.title.components(separatedBy: " · ")
        if parts.count > 1 { return parts.dropFirst().joined(separator: " · ") }
        let detail = detail(plan)
        return detail.isEmpty ? "Sesión de entrenamiento" : detail
    }


    var body: some View {
        ScrollView {
            // Diseño de ChatGPT: la misma columna en el iPhone y, más grande y centrada, en iPad y Mac
            // (como la web ancha): saludo, semana, sesión, cifras del día y tu plan.
            VStack(alignment: .leading, spacing: 20) {
                greetingHeader
                weekStrip
                mainAction
                dayFigures
                planSection
                emptyWorkoutButton
            }
            .frame(maxWidth: 680, alignment: .leading)
            .padding(.horizontal, horizontalPadding)
            .padding(.top, wideLayout ? 24 : 8)
            .frame(maxWidth: .infinity)
            .padding(.bottom, 40)
        }
        .screenBackground()
        .refreshable { await load() }
        .task {
            #if DEBUG
            if ProcessInfo.processInfo.arguments.contains("-previewHome") {
                todayState = Self.mockSnapshot()
                return
            }
            #endif
            await load()
            if Self.pendingStartToday {
                Self.pendingStartToday = false
                if let plan = snapshot?.plan { await startRoutine(plan) }
            }
            if snapshot?.completedToday == true { celebrateIfNeeded() }
        }
        .onReceive(NotificationCenter.default.publisher(for: .refreshSection)) { _ in Task { await load() } }
        .onReceive(NotificationCenter.default.publisher(for: .startTodayWorkout)) { _ in
            if let plan = snapshot?.plan { Task { await startRoutine(plan) } }
        }
        .onChange(of: snapshot?.completedToday ?? false) { _, done in if done { celebrateIfNeeded() } }
        .sheet(isPresented: $sheetOpen, onDismiss: {
            guard startAfterDismiss else { return }
            startAfterDismiss = false
            if let plan = snapshot?.plan { Task { await startRoutine(plan) } }
        }) { sheetView }
        .sheet(isPresented: $pickingEmpty) {
            ExercisePickerView(existing: []) { picked in Task { await startEmptyWorkout(picked) } }
                .presentationBackground(Palette.background)
        }
        .sheet(isPresented: $planEditorOpen) {
            PlanEditorView(original: model.days) { saved in
                model.days = saved
                Task { await load() }
            }
            .presentationBackground(Palette.background)
        }
        .sheet(item: $editingDay) { day in
            RoutineDetailSheet(day: day, plans: snapshot?.scheduled ?? []) { updated in
                // Refresca el snapshot para que se vea el cambio al instante.
                if session.userId != nil { Task { await load() } }
            }
            .environmentObject(session)
        }
        .fullScreenCoverCompat(item: $activeWorkout) { workout in
            // NavigationStack para que la barra superior exista: «Finalizar» arriba a la derecha.
            NavigationStack {
                WorkoutView(workout: workout, userId: session.userId ?? UUID()) { finished in
                    activeWorkout = nil
                    if finished { Task { await load() } }
                }
            }
        }
        .overlay(alignment: .top) {
            if celebrating {
                ConfettiView(start: confettiStart)
                    .frame(height: 560).transition(.opacity)
                    .allowsHitTesting(false).accessibilityHidden(true)
            }
        }
    }

    /// Primera foto de la sesión de hoy (la portada que usa la web).
    private var todayCover: URL? {
        (snapshot?.plan?.exercises ?? []).compactMap { $0.image_url }.first.flatMap(URL.init(string:))
    }

    // MARK: Lo único de hoy (empezar, resultados o descanso)

    @ViewBuilder private var mainAction: some View {
        if let s = snapshot {
            // Como la web: hecho hoy, la siguiente sesión que falta (sea el día que sea) o, con la
            // semana completa, recuperar. Nunca «descansa» solo por el día de la semana.
            if s.completedToday {
                doneCard()
            } else if s.noPlan == true {
                // Sin rutina todavía (web `!hasPlan`): invitación con botón, nunca «descansa».
                StarterRoutineCard { await load() }
            } else if s.plan == nil {
                RestCard(eyebrow: s.scheduled.isEmpty ? "TU PLAN" : "SEMANA COMPLETA",
                         title: s.scheduled.isEmpty ? "Aún no tiene sesiones" : "Toca recuperar",
                         message: s.scheduled.isEmpty ? "Edita tu rutina para añadir tus sesiones."
                             : "\(weekDoneLine(s.scheduled.count)) El lunes empieza otra vuelta.") {
                    if let first = s.scheduled.first {
                        Button("Entrenar igualmente") { Haptics.tap(); Task { await startRoutine(first) } }
                            .buttonStyle(.pillSecondary)
                    }
                }
            } else if let plan = s.plan {
                startCard(plan)
            }
        } else {
            todaySkeleton
        }
    }

    /// Hecho hoy: la portada grande con la foto de marca, marcada como hecha, y debajo la siguiente
    /// sesión de la rutina en una línea. Se toca y abre el resumen del entreno de hoy.
    private func doneCard() -> some View {
        // `snapshot.plan` ya es la SIGUIENTE (la de hoy está hecha): la foto es la de marca del gimnasio.
        let cover = BrandPhotos.url(.gym)
        let title = "Sesión completada"
        let next: String? = snapshot.flatMap { s in
            if let plan = s.plan { return "Siguiente: \(plan.title.components(separatedBy: " · ")[0])." }
            return s.scheduled.isEmpty ? nil : weekDoneLine(s.scheduled.count)
        }
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
                    .foregroundStyle(Palette.gold)
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
        let shape = RoundedRectangle(cornerRadius: Radius.hero, style: .continuous)
        return VStack(alignment: .leading, spacing: 0) {
            VStack(alignment: .leading, spacing: 0) {
                RoundedRectangle(cornerRadius: 4, style: .continuous).fill(Palette.secondary).frame(width: 132, height: 12)
                RoundedRectangle(cornerRadius: 8, style: .continuous).fill(Palette.secondary).frame(width: 196, height: 26).padding(.top, 10)
                RoundedRectangle(cornerRadius: 4, style: .continuous).fill(Palette.secondary).frame(width: 210, height: 15).padding(.top, 8)
                RoundedRectangle(cornerRadius: 4, style: .continuous).fill(Palette.secondary).frame(width: 150, height: 13).padding(.top, 20)
            }
            .padding(wideLayout ? 28 : 20)
            .frame(maxWidth: .infinity, minHeight: wideLayout ? 240 : 188, alignment: .topLeading)
        }
        .background(SurfaceBackground(shape: shape))
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Cargando tu sesión de hoy")
        .accessibilityAddTraits(.updatesFrequently)
    }

    /// Sesión de hoy (diseño de ChatGPT): «Entrenamiento», el nombre grande, su foco y «60 min ·
    /// 6 ejercicios», con la foto de la sesión fundida a la derecha. La tarjeta abre el detalle y el
    /// botón redondo dorado empieza a un toque.
    private func startCard(_ plan: DayPlan) -> some View {
        let parts = plan.title.components(separatedBy: " · ")
        // El foco tal cual (como en «Tu plan»); sin él, lo que el título lleva tras el «·».
        let focus = plan.muscle_focus?.trimmingCharacters(in: .whitespaces) ?? ""
        let subtitle = !focus.isEmpty ? focus : (parts.count > 1 ? parts.dropFirst().joined(separator: " · ") : "")
        let cover = plan.isGym ? todayCover : nil
        let exerciseCount = plan.exercises?.count ?? 0
        let detailLine = plan.isGym
            ? [estimatedMinutes(plan).map { "\($0) min" },
               exerciseCount > 0 ? "\(exerciseCount) \(exerciseCount == 1 ? "ejercicio" : "ejercicios")" : nil]
                .compactMap { $0 }.joined(separator: " · ")
            : detail(plan)
        let shape = RoundedRectangle(cornerRadius: Radius.hero, style: .continuous)
        return ZStack(alignment: .bottomTrailing) {
            Button { Haptics.tap(); openSheet() } label: {
                VStack(alignment: .leading, spacing: 0) {
                    HStack(spacing: 6) {
                        Image("lu-dumbbell").renderingMode(.template).resizable().frame(width: 16, height: 16)
                            .foregroundStyle(Palette.gold)
                        Text(plan.isGym ? "Entrenamiento" : "Actividad")
                            .font(.apFootnote.weight(.semibold)).foregroundStyle(Palette.muted)
                    }
                    Text(parts[0])
                        .font(.inter(size: wideLayout ? 34 : 28, weight: .bold)).tracking(-0.5)
                        .lineLimit(2).minimumScaleFactor(0.8)
                        .fixedSize(horizontal: false, vertical: true).padding(.top, 8)
                    if !subtitle.isEmpty {
                        Text(subtitle)
                            .font(.apSubhead).foregroundStyle(Palette.muted)
                            .lineLimit(2).fixedSize(horizontal: false, vertical: true).padding(.top, 4)
                    }
                    Spacer(minLength: 16)
                    if !detailLine.isEmpty {
                        Text(detailLine).font(.apFootnote.monospacedDigit()).foregroundStyle(Palette.muted)
                    }
                }
                .padding(wideLayout ? 28 : 20)
                .padding(.trailing, cover == nil ? 64 : (wideLayout ? 240 : 128))
                .frame(maxWidth: .infinity, minHeight: wideLayout ? 240 : 188, alignment: .topLeading)
                .background(alignment: .trailing) {
                    if let cover {
                        CachedAsyncImage(url: cover) { $0.resizable().scaledToFill() } placeholder: { Palette.secondary }
                            .frame(width: wideLayout ? 390 : 210).frame(maxHeight: .infinity).clipped()
                            // Fundida con una máscara (no con el color de la tarjeta): sin corte sobre su luz.
                            .mask {
                                LinearGradient(colors: [.clear, .black], startPoint: .leading, endPoint: UnitPoint(x: 0.6, y: 0.5))
                            }
                            .allowsHitTesting(false)
                            .accessibilityHidden(true)
                    }
                }
                .clipShape(shape)
                .background(SurfaceBackground(shape: shape))
                .contentShape(shape)
            }
            .buttonStyle(.pressableCard)
            .accessibilityElement(children: .combine)
            .accessibilityLabel([plan.title, subtitle, detailLine].filter { !$0.isEmpty }.joined(separator: ". "))
            .accessibilityHint("Abre el detalle de la sesión de hoy")

            // Empezar a un toque: el botón redondo dorado de la maqueta.
            Button {
                Haptics.tap()
                if plan.isGym { Task { await startRoutine(plan) } } else { openSheet() }
            } label: {
                Image(systemName: "play.fill")
                    .font(.system(size: 22, weight: .bold))
                    .foregroundStyle(Palette.background)
                    .offset(x: 2)
                    .frame(width: 56, height: 56)
                    .background(GoldFill(shape: Circle()))
            }
            .buttonStyle(.pressableCard)
            .padding(wideLayout ? 24 : 16)
            .accessibilityLabel(plan.isGym ? "Empezar \(parts[0])" : "Ver la actividad \(parts[0])")
        }
        .contextMenu {
            Button { openSheet() } label: { Label("Ver el detalle", systemImage: "list.bullet.rectangle") }
            Button { Haptics.selection(); editingDay = plan } label: { Label("Editar sesión", systemImage: "pencil") }
        }
    }

    /// Duración estimada de la sesión: cada serie ocupa su descanso + ~45 s de trabajo.
    private func estimatedMinutes(_ plan: DayPlan) -> Int? {
        let exercises = plan.exercises ?? []
        guard !exercises.isEmpty else { return nil }
        let seconds = exercises.reduce(0.0) { total, exercise in
            let rest = Double(exercise.rest.split(whereSeparator: { !$0.isNumber }).compactMap { Int($0) }.first ?? 60)
            return total + Double(max(exercise.series, 1)) * (rest + 45)
        }
        return max(10, Int((seconds / 60).rounded(.up)))
    }

    @ViewBuilder private var sheetView: some View {
        if let s = snapshot {
            // Hecho hoy, `s.plan` ya es la siguiente: la hoja muestra solo lo registrado.
            let content = TodaySessionSheet(plan: s.completedToday ? nil : s.plan, completed: s.completedToday, result: nil,
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

    /// El aviso lo recoge Inicio: abre (o reanuda) el entreno de hoy sin pasar por Entrenar.
    private func startToday() {
        Haptics.tap()
        // Se avisa al cerrarse la hoja (onDismiss), sin esperas fijas: el entreno se abre en cuanto se puede.
        startAfterDismiss = true
        sheetOpen = false
    }

    private func startRoutine(_ day: DayPlan) async {
        guard day.isGym else { return }
        guard let id = session.userId, let idString = session.userIdString else { return }
        if let draft = ActiveWorkout.restore(userId: idString), draft.day.day == day.day {
            Haptics.tap()
            activeWorkout = ActiveWorkout(draft: draft)
            return
        }
        guard !(day.exercises ?? []).isEmpty else { return }
        Haptics.tap()
        let previous = await TrainingRepo.previousSets(userId: id, exercises: (day.exercises ?? []).map(\.name))
        let workout = ActiveWorkout(userId: idString, day: day, previous: previous)
        workout.previous = previous
        workout.previousRpe = await TrainingRepo.previousRpe(userId: id, exercises: (day.exercises ?? []).map(\.name))
        struct Pref: Decodable { let original_exercise_name: String; let preferred_exercise_name: String? }
        let prefs: [Pref] = (try? await Backend.client.from("exercise_user_preferences").select("original_exercise_name, preferred_exercise_name")
            .eq("user_id", value: id).execute().value) ?? []
        for p in prefs { if let r = p.preferred_exercise_name, (day.exercises ?? []).contains(where: { $0.name == p.original_exercise_name }) { workout.swaps[p.original_exercise_name] = r } }
        workout.draft.currentExercise = 0
        workout.openExercises = [0]
        activeWorkout = workout
    }

    /// Entreno vacío: sesión de hoy solo con los ejercicios elegidos (igual que «Entreno vacío» en
    /// la web, `routine_name` «Entrenamiento libre»). Se registra como cualquier entreno.
    private func startEmptyWorkout(_ exercises: [GymExercise]) async {
        guard !exercises.isEmpty, let id = session.userId, let idString = session.userIdString else { return }
        let day = DayPlan(day: DayNames.today, type: "gimnasio", routine_name: "Entrenamiento libre", muscle_focus: "", exercises: exercises)
        let previous = await TrainingRepo.previousSets(userId: id, exercises: exercises.map(\.name))
        let workout = ActiveWorkout(userId: idString, day: day, previous: previous)
        workout.previous = previous
        workout.previousRpe = await TrainingRepo.previousRpe(userId: id, exercises: exercises.map(\.name))
        workout.draft.currentExercise = 0
        workout.openExercises = [0]
        // La hoja del selector se cierra antes de abrir el entreno a pantalla completa.
        try? await Task.sleep(for: .milliseconds(350))
        activeWorkout = workout
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
            .surface()
        }
        .buttonStyle(.pressableCard)
        .accessibilityLabel(label)
    }

    // MARK: Siguiente sesión

    /// «Siguiente sesión · 2 de 3» (como la web): el puesto de la sesión en la rutina.
    private func sessionLabel(_ plan: DayPlan) -> String {
        let sessions = snapshot?.scheduled ?? []
        let number = (sessions.firstIndex { $0.day == plan.day } ?? 0) + 1
        return "\(plan.isGym ? "Siguiente sesión" : "Siguiente actividad") · \(number) de \(max(sessions.count, 1))"
    }

    /// Semana completa, en una frase (como la web).
    private func weekDoneLine(_ count: Int) -> String {
        count == 1 ? "Has hecho tu sesión de esta semana." : "Has hecho tus \(count) sesiones de esta semana."
    }

    // MARK: Datos

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
        // Lo de la última visita ya se pinta desde `TodayCache` (memoria o disco); la red lo sustituye sin parpadeo.
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
        Snapshots.save(snap, Self.latestKey(id))
    }

    private func makeSnapshot(firstName: String, calories: Int?) -> TodaySnapshot {
        Self.buildSnapshot(days: model.days, completions: model.completions, planFailed: model.error != nil,
                           draftDay: session.userIdString.flatMap { ActiveWorkout.restore(userId: $0)?.day.day },
                           firstName: firstName, calories: calories)
    }

    /// Lo de hoy a partir de la rutina y lo hecho (de la red o de la caché de Entrenar).
        #if DEBUG
    /// Vista previa para el simulador: datos de muestra, sin red ni cuenta.
    fileprivate static func mockSnapshot() -> TodaySnapshot {
        let day1 = DayPlan(day: "Lunes", type: "gimnasio", sport: nil, intensity: nil, duration: nil,
                          routine_name: "Full Body B",
                          muscle_focus: "Hombros, piernas, glúteos, isquiotibiales y core",
                          exercises: [
                            GymExercise(exercise_id: "1", name: "Press militar con barra de pie estricto", series: 4, reps: "4-6", weight: "40", rest: "180s", image_url: BrandPhotos.string(.gym), muscle_group: "Hombros"),
                            GymExercise(exercise_id: "2", name: "Sentadilla con barra", series: 4, reps: "6", weight: "60", rest: "180s", muscle_group: "Piernas"),
                            GymExercise(exercise_id: "3", name: "Remo con barra", series: 3, reps: "10", weight: "50", rest: "90s", muscle_group: "Espalda"),
                          ], custom: nil)
        let day2 = DayPlan(day: "Miércoles", type: "gimnasio", sport: nil, intensity: nil, duration: nil,
                          routine_name: "Upper Push",
                          muscle_focus: "Pecho, hombros y tríceps",
                          exercises: [
                            GymExercise(exercise_id: "4", name: "Press banca", series: 4, reps: "6-8", weight: "70", rest: "180s", muscle_group: "Pecho"),
                            GymExercise(exercise_id: "5", name: "Press inclinado", series: 3, reps: "8-10", weight: "50", rest: "120s", muscle_group: "Pecho"),
                            GymExercise(exercise_id: "6", name: "Elevaciones laterales", series: 3, reps: "12-15", weight: "10", rest: "60s", muscle_group: "Hombros"),
                          ], custom: nil)
        let day3 = DayPlan(day: "Viernes", type: "gimnasio", sport: nil, intensity: nil, duration: nil,
                          routine_name: "Lower Body",
                          muscle_focus: "Piernas y glúteos",
                          exercises: [
                            GymExercise(exercise_id: "7", name: "Peso muerto", series: 4, reps: "5", weight: "100", rest: "240s", muscle_group: "Piernas"),
                            GymExercise(exercise_id: "8", name: "Prensa", series: 3, reps: "10", weight: "120", rest: "120s", muscle_group: "Piernas"),
                          ], custom: nil)
        let scheduled = [day1, day2, day3]
        let completions: [(day: String, date: String)] = []
        var snap = buildSnapshot(days: scheduled, completions: completions, planFailed: false,
                            draftDay: nil, firstName: "Nico", calories: 2100)
        snap.lastPr = LastPR(exercise: "Press banca", weight: 80, reps: 5, achievedAt: Date())
        return snap
    }
    #endif

    fileprivate static func buildSnapshot(days: [DayPlan], completions: [(day: String, date: String)], planFailed: Bool,
                                          draftDay: String?, firstName: String, calories: Int?) -> TodaySnapshot {
        // La rutina en orden (sin sesiones vacías) y la siguiente que falta esta semana, sea el día que sea.
        let scheduled = RoutineOrder.sessions(days).filter { $0.type == "actividad" || !($0.exercises ?? []).isEmpty }
        let done = RoutineOrder.doneThisWeek(completions)
        let plan = RoutineOrder.nextPending(scheduled, done: done)
        let completed = completions.contains { $0.date == LocalDate.string() }
        let doneDays = Array(done)
        // Días de esta semana con algo hecho: el punto dorado de la tira de días.
        let weekStart = RoutineOrder.weekStart
        let trainedDates = Array(Set(completions.map(\.date).filter { $0 >= weekStart })).sorted()
        return TodaySnapshot(plan: plan,
                             scheduled: scheduled,
                             completedToday: completed,
                             doneDays: doneDays,
                             resumable: plan != nil && draftDay == plan?.day,
                             firstName: firstName,
                             calories: calories,
                             noPlan: !planFailed && days.isEmpty,
                             trainedDates: trainedDates)
    }

    /// Clave de la copia en disco: por usuario y día (lo de hoy caduca al cambiar el día).
    static func cacheKey(_ id: UUID) -> String {
        "home|\(id.uuidString.lowercased())|\(LocalDate.string())"
    }

    /// Última copia, sin fecha: la primera apertura de cada día pinta el nombre y la nutrición al instante.
    static func latestKey(_ id: UUID) -> String { "home|\(id.uuidString.lowercased())|latest" }

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
    /// Siguiente sesión de la rutina que falta esta semana (entreno o actividad); nil si están todas.
    var plan: DayPlan?
    /// Sesiones de la rutina en orden.
    var scheduled: [DayPlan] = []
    var completedToday = false
    /// Sesiones (su clave `day`) hechas esta semana, desde el lunes.
    var doneDays: [String]?
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
    /// Número de comidas del plan (anillo de las cifras de Calorías y Proteína).
    var mealCount = 0
    /// Fechas (yyyy-MM-dd) de esta semana con algún entreno o actividad hecha (tira de días).
    var trainedDates: [String]? = nil
}

struct LastPR: Codable {
    let exercise: String
    let weight: Double
    let reps: Int
    let achievedAt: Date
    var dateLabel: String { achievedAt.formatted(.dateTime.day().month(.abbreviated).locale(Locale(identifier: "es_ES"))) }
}

/// Cache (por usuario y día) de lo de hoy: Inicio pinta sin esperar a la red, también en frío.
/// Si falta en memoria, o hubo un cambio local (sesión hecha, rutina guardada), se rehace al momento
/// con la rutina y lo hecho de la caché de Entrenar y el nombre y la nutrición de la última copia.
@MainActor
private final class TodayCache {
    static let shared = TodayCache()
    private var items: [String: (snapshot: TodaySnapshot?, revision: Int)] = [:]

    func snapshot(userId: UUID) -> TodaySnapshot? {
        let k = key(userId)
        let revision = TrainingRepo.revision(userId: userId)
        if let hit = items[k], hit.revision == revision { return hit.snapshot }
        let rebuilt = rebuild(userId: userId)
        items[k] = (rebuilt, revision)
        return rebuilt
    }

    func save(_ snapshot: TodaySnapshot, userId: UUID) {
        items[key(userId)] = (snapshot, TrainingRepo.revision(userId: userId))
    }

    private func rebuild(userId: UUID) -> TodaySnapshot? {
        let today = Snapshots.load(TodaySnapshot.self, HomeView.cacheKey(userId))
        guard let base = today ?? Snapshots.load(TodaySnapshot.self, HomeView.latestKey(userId)),
              let days = TrainingRepo.instantPlan(userId: userId),
              let done = TrainingRepo.instantCompletions(userId: userId, since: LocalDate.daysAgo(6))
        else { return today }
        var snap = HomeView.buildSnapshot(days: days, completions: done, planFailed: false,
                                          draftDay: ActiveWorkout.restore(userId: userId.uuidString.lowercased())?.day.day,
                                          firstName: base.firstName, calories: base.calories)
        snap.macros = base.macros
        snap.mealCount = base.mealCount
        snap.lastPr = base.lastPr
        return snap
    }

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
                            Text("Esta sesión no tiene ejercicios todavía.")
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
                Text(completed ? "Completado hoy" : plan?.isGym == true ? "Siguiente sesión" : "Siguiente actividad")
                    .font(.apCaption.weight(.semibold)).textCase(.uppercase).tracking(0.6)
                    .foregroundStyle(Palette.gold)
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
        .surface()
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
        .surface()
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
    private static let colors: [Color] = [Palette.gold, .white, Palette.gold.opacity(0.65), Palette.gold.opacity(0.4)]
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
