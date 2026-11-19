import SwiftUI
import Supabase
import PhotosUI

/// Entrenar (`TrainingPlanView` + la sección «training» de la web): la cabecera de la rutina, las
/// sesiones en orden («Sesión 1, 2…», la siguiente destacada) y «Mis rutinas». No es una pestaña,
/// como en la web: se llega desde Hoy («Ver todas» en «Mis rutinas»). En iPad y Mac, la misma
/// columna centrada de 680 que Hoy y Nutrición.
struct TrainView: View {
    /// «Empezar entreno de hoy» (menú del Mac) con Entrenar delante: lo abre aquí, sin cambiar de pantalla.
    static var pendingStart = false
    /// «Ver todas» en «Mis rutinas» de Hoy: Entrenar se abre con «Mis rutinas» arriba.
    static var focusRoutines = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @EnvironmentObject private var session: SessionModel
    #if !os(macOS)
    @Environment(\.horizontalSizeClass) private var sizeClass
    #endif
    @StateObject private var model: PlanModel
    @State private var active: ActiveWorkout?
    @State private var starting = false
    /// Sesión con un entreno a medias guardado (su acción pasa a ser «Continuar entreno»).
    @State private var resumableDay: String?
    @State private var editing = false
    @State private var library = false
    @State private var pickingEmpty = false
    /// «Nueva rutina» (`day == nil`) o «Editar» de una rutina de «Mis rutinas».
    @State private var routineEditor: RoutineEditorTarget?
    /// Tus días de entreno, contados como generate-plan; nil hasta leerlos (sin ellos no se ofrece
    /// «Completar con el autopiloto»).
    @State private var trainingDays: Int?
    var onNavigate: (AppSection) -> Void = { _ in }

    struct RoutineEditorTarget: Identifiable { let day: String?; var id: String { day ?? "nueva" } }

    private var wideLayout: Bool {
        #if os(macOS)
        return true
        #else
        return sizeClass == .regular
        #endif
    }

    /// Márgenes laterales como `p-4 md:p-8` de la web. En Mac el padding lo pone `SectionView`.
    private var pagePadding: CGFloat {
        #if os(macOS)
        return 0
        #else
        return wideLayout ? 32 : 16
        #endif
    }

    /// La rutina, lo hecho y el entreno a medias salen de la caché ya en el init: el primer
    /// fotograma es la pantalla final, nunca la tarjeta de «sin rutina» un instante.
    init(userId: UUID? = nil, onNavigate: @escaping (AppSection) -> Void = { _ in }) {
        _model = StateObject(wrappedValue: PlanModel(userId: userId))
        _resumableDay = State(initialValue: userId.flatMap { ActiveWorkout.restore(userId: $0.uuidString.lowercased())?.day.day })
        self.onNavigate = onNavigate
    }

    private var routines: [DayPlan] { CustomRoutines.mine(model.days) }
    private var limitReached: Bool { !CustomRoutines.canAdd(model.days) }

    var body: some View {
        ScrollViewReader { proxy in
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                // Sin respuesta todavía (ni caché): cargando con el AP, nunca «sin rutina».
                if model.days.isEmpty && model.error == nil && (model.loading || !model.loaded) {
                    VStack(spacing: 12) {
                        BrandLoader()
                        Text("Cargando tu rutina…").font(.apSubhead).foregroundStyle(Palette.muted)
                    }
                    .frame(maxWidth: .infinity, minHeight: 300)
                    .accessibilityElement(children: .combine)
                } else if let error = model.error, model.days.isEmpty {
                    EmptyStateView(symbol: "wifi.exclamationmark", title: error,
                                   message: "Desliza hacia abajo para volver a intentarlo.")
                } else if model.days.isEmpty {
                    // Sin rutina: la misma invitación que Inicio y la web, con su botón, y la tuya desde cero.
                    VStack(spacing: 12) {
                        StarterRoutineCard { await load() }
                        Button { Haptics.tap(); routineEditor = RoutineEditorTarget(day: nil) } label: { Text("Nueva rutina") }
                            .buttonStyle(.pillSecondary)
                    }
                    .padding(20)
                    .surface(Radius.hero)
                } else {
                    // Bajo el título grande «Entrenar»; en Mac la barra ya lleva su pista.
                    if !wideLayout {
                        Text("Tus sesiones en orden. Hazlas el día que te venga bien.").font(.apSubhead).foregroundStyle(Palette.muted)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    RoutineListView(days: model.days,
                                    doneThisWeek: model.doneThisWeek,
                                    doneToday: model.doneTodayKeys,
                                    resumableDay: resumableDay,
                                    routineBar: AnyView(routineBar),
                                    routines: AnyView(routinesSection),
                                    onPersonalize: { day, name, icon, _ in await personalize(day: day, name: name, icon: icon) }) { day in
                        Task { await open(day) }
                    }
                }
            }
            .frame(maxWidth: 680, alignment: .leading)
            .padding(.horizontal, pagePadding)
            .padding(.top, wideLayout ? 24 : 8)
            .frame(maxWidth: .infinity)
            .padding(.bottom, 40)
        }
        .screenBackground()
        .refreshable { await load() }
        .task {
            if Self.pendingStart {
                Self.pendingStart = false
                await openToday()
            }
            if Self.focusRoutines, !model.days.isEmpty { scrollToRoutines(proxy) }
            await load()
            if Self.focusRoutines { scrollToRoutines(proxy) }
        }
        }
        .onReceive(NotificationCenter.default.publisher(for: .refreshSection)) { _ in Task { await load() } }
        .onReceive(NotificationCenter.default.publisher(for: .startTodayWorkout)) { _ in
            // RootView marca `pendingStart` en este mismo aviso: se lee al terminar de repartirlo.
            Task { @MainActor in
                await Task.yield()
                guard Self.pendingStart else { return }
                Self.pendingStart = false
                await openToday()
            }
        }
        .sheet(isPresented: $editing) {
            PlanEditorView(original: model.days) { saved in model.days = saved; Task { await loadTrainingDays() } }
                .presentationBackground(Palette.background)
        }
        .sheet(isPresented: $library) {
            ExerciseLibraryView(userId: session.userId)
                .presentationBackground(Palette.background)
                #if os(macOS)
                .frame(minWidth: 680, minHeight: 720)
                #endif
        }
        .sheet(isPresented: $pickingEmpty) {
            ExercisePickerView(existing: []) { picked in Task { await startEmpty(picked) } }
                .presentationBackground(Palette.background)
        }
        .sheet(item: $routineEditor) { target in
            RoutineEditorView(routine: target.day.flatMap { day in model.days.first { $0.day == day } },
                              limitReached: limitReached) { name, exercises in
                if let day = target.day {
                    return await commit("Rutina guardada") { CustomRoutines.update($0, day: day, name: name, exercises: exercises) }
                }
                return await commit("Rutina creada en Mis rutinas") { CustomRoutines.add($0, name: name, exercises: exercises) }
            }
            .presentationBackground(Palette.background)
        }
        .fullScreenCoverCompat(item: $active) { workout in
            NavigationStack {
                WorkoutView(workout: workout, userId: session.userId ?? UUID()) { finished in
                    active = nil
                    if finished { Task { await load() } }
                }
            }
        }
    }

    /// Cabecera de la rutina (como la web): el modo y de dónde sale con «Editar» a la derecha y,
    /// debajo, «Entreno vacío» y «Ejercicios» con su nombre.
    private var routineBar: some View {
        let mode = CustomRoutines.mode(model.days)
        return VStack(alignment: .leading, spacing: 16) {
            HStack(alignment: .top, spacing: 12) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(mode.title).font(.apFootnote.weight(.semibold)).foregroundStyle(Palette.gold)
                    Text(mode.detail).font(.apSubhead).foregroundStyle(Palette.muted)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .accessibilityElement(children: .combine)
                Button { Haptics.tap(); editing = true } label: {
                    Text("Editar").font(.apSubhead.weight(.semibold)).foregroundStyle(Palette.gold)
                        .frame(minHeight: 44).contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .padding(.vertical, -8)
                .accessibilityLabel("Editar rutina")
            }
            // Lado a lado si caben enteros; si no (estrecho o letra grande), uno bajo otro, sin cortar.
            ViewThatFits(in: .horizontal) {
                HStack(spacing: 8) { emptyBarButton; libraryBarButton }
                VStack(spacing: 8) { emptyBarButton; libraryBarButton }
            }
        }
        .padding(20)
        .frame(maxWidth: .infinity, alignment: .leading)
        .surface()
    }

    private var emptyBarButton: some View {
        barButton("Entreno vacío", icon: "play.fill") {
            // Con un entreno a medias se continúa ese: empezar otro borraría sus series.
            if let id = session.userIdString, let draft = ActiveWorkout.restore(userId: id) {
                active = ActiveWorkout(draft: draft)
            } else {
                pickingEmpty = true
            }
        }
    }

    private var libraryBarButton: some View { barButton("Ejercicios", icon: "book") { library = true } }

    private func barButton(_ title: String, icon: String, action: @escaping () -> Void) -> some View {
        Button { Haptics.tap(); action() } label: {
            Label { Text(title) } icon: { Image(systemName: icon).foregroundStyle(Palette.gold) }
                .font(.apSubhead.weight(.semibold))
        }
        .buttonStyle(PillButtonStyle(kind: .secondary, height: 44))
    }

    /// Lleva «Mis rutinas» arriba (una sola vez por llegada desde Hoy).
    private func scrollToRoutines(_ proxy: ScrollViewProxy) {
        Self.focusRoutines = false
        withAnimation(reduceMotion ? nil : .snappy) { proxy.scrollTo("mis-rutinas", anchor: .top) }
    }

    /// «Completar con el autopiloto»: solo con un plan todo tuyo que no llega a tus días de entreno.
    private var autopilotOffer: MyRoutinesSection.Autopilot? {
        guard CustomRoutines.canCompleteWithAutopilot(model.days, frequency: trainingDays), let trainingDays else { return nil }
        return MyRoutinesSection.Autopilot(own: model.sessions.count, frequency: trainingDays) { await completeWithAutopilot() }
    }

    private var routinesSection: some View {
        MyRoutinesSection(routines: routines, limitReached: limitReached, resumableDay: resumableDay,
                          doneToday: model.doneTodayKeys, autopilot: autopilotOffer,
                          onNew: { routineEditor = RoutineEditorTarget(day: nil) },
                          onStart: { day in Task { await open(day) } },
                          onEdit: { day in routineEditor = RoutineEditorTarget(day: day) },
                          onDuplicate: { day in await commit("Rutina duplicada") { CustomRoutines.duplicate($0, day: day) } },
                          onDelete: { day in await commit("Rutina borrada") { CustomRoutines.delete($0, day: day) } })
            .id("mis-rutinas")
    }

    // MARK: Cargar, guardar y abrir

    private func load() async {
        await model.load(userId: session.userId)
        // Entreno a medias guardado: la rutina lo ofrece como «Continuar entreno».
        resumableDay = session.userIdString.flatMap { ActiveWorkout.restore(userId: $0)?.day.day }
        await loadTrainingDays()
        let urls = model.days.flatMap { ($0.exercises ?? []).compactMap(\.image_url) }.compactMap(URL.init(string:))
        ImageCache.shared.prefetch(urls, maxSide: 140)
    }

    /// Tus días de entreno (`trainingDays`) mientras el plan no tenga sesiones del piloto automático
    /// (vacío o todo tuyo): así, al crear tu primera rutina o al dejar el plan todo tuyo en el editor,
    /// «Completar con el autopiloto» ya sabe si ofrecerse, como en la web.
    private func loadTrainingDays() async {
        guard let userId = session.userId, model.sessions.allSatisfy({ $0.custom == true }) else { return }
        trainingDays = await TrainingRepo.trainingFrequency(userId: userId)
    }

    /// «Completar con el autopiloto» (web `Dashboard.tsx`, `generatePlanGuarded`): generate-plan prepara
    /// las sesiones que faltan alrededor de tus rutinas (nunca las toca) y el plan se vuelve a leer.
    /// Devuelve cuántas rutinas respetó, o nil si no se pudo.
    private func completeWithAutopilot() async -> Int? {
        guard let userId = session.userId, let kept = await TrainingRepo.generateStarterPlan(userId: userId) else { return nil }
        await load()
        return kept
    }

    /// Rutinas propias: el cambio se guarda sobre el plan guardado y la pantalla se pone al día.
    /// Lo que no cabe se dice (anuncio y nota en «Mis rutinas»); nunca falla en silencio.
    private func commit(_ done: String, _ change: @escaping ([DayPlan]) -> CustomRoutines.Change) async -> Bool {
        guard let userId = session.userId else { return false }
        switch await TrainingRepo.commitRoutine(userId: userId, change) {
        case .ok(let plans, _):
            model.days = plans
            Haptics.success()
            A11y.announce(done)
            return true
        case .limit:
            Haptics.warning()
            A11y.announce(CustomRoutines.limitMessage)
            return false
        case .missing, .failed:
            Haptics.error()
            A11y.announce("No se pudo guardar. Comprueba la conexión e inténtalo de nuevo.")
            return false
        }
    }

    private func personalize(day: String, name: String, icon: String?) async -> Bool {
        guard let userId = session.userId else { return false }
        do {
            model.days = try await TrainingRepo.saveSessionIdentity(userId: userId, plans: model.days, day: day, name: name, icon: icon)
            Haptics.success()
            return true
        } catch {
            Haptics.error()
            return false
        }
    }

    /// Abre la sesión o la rutina elegida: reanuda el entreno a medias, empieza uno nuevo (el mismo
    /// entreno que en Hoy: `ActiveWorkout` y su borrador) o, si es una actividad, la marca como hecha.
    private func open(_ day: String) async {
        guard let plan = model.days.first(where: { $0.day == day }) else { return }
        if let idString = session.userIdString,
           let draft = ActiveWorkout.restore(userId: idString), draft.day.day == plan.day {
            Haptics.tap()
            starting = false
            active = ActiveWorkout(draft: draft)
            return
        }
        guard !starting, !model.completedToday(plan.day) else { return }
        if plan.isGym {
            guard !(plan.exercises ?? []).isEmpty else { return }
            await start(plan)
        } else {
            guard let id = session.userId else { return }
            starting = true
            defer { starting = false }
            Haptics.success()
            try? await TrainingRepo.complete(userId: id, day: plan.day, date: LocalDate.string(), rpe: nil)
            await load()
        }
    }

    /// «Empezar entreno de hoy»: la siguiente sesión que falta esta semana, la misma que propone Hoy.
    private func openToday() async {
        guard active == nil else { return }
        if model.days.isEmpty { await load() }
        guard let next = RoutineOrder.nextPending(model.sessions, done: model.doneThisWeek), next.isGym,
              !model.completedToday(next.day) else { return }
        await open(next.day)
    }

    private func start(_ day: DayPlan) async {
        guard let id = session.userId, let idString = session.userIdString else { return }
        Haptics.tap()
        starting = true
        defer { starting = false }
        let names = (day.exercises ?? []).map(\.name)
        let previous = await TrainingRepo.previousSets(userId: id, exercises: names)
        let workout = ActiveWorkout(userId: idString, day: day, previous: previous)
        workout.previous = previous
        workout.previousRpe = await TrainingRepo.previousRpe(userId: id, exercises: names)
        struct Pref: Decodable { let original_exercise_name: String; let preferred_exercise_name: String? }
        let prefs: [Pref] = (try? await Backend.client.from("exercise_user_preferences").select("original_exercise_name, preferred_exercise_name")
            .eq("user_id", value: id).execute().value) ?? []
        for p in prefs { if let r = p.preferred_exercise_name, names.contains(p.original_exercise_name) { workout.swaps[p.original_exercise_name] = r } }
        workout.draft.currentExercise = 0
        workout.openExercises = [0]
        active = workout
    }

    /// Entreno vacío desde la cabecera: el mismo que en Hoy (`routine_name` «Entrenamiento libre»).
    private func startEmpty(_ exercises: [GymExercise]) async {
        guard !exercises.isEmpty, let id = session.userId, let idString = session.userIdString else { return }
        let day = DayPlan(day: DayNames.today, type: "gimnasio", routine_name: CustomRoutines.freeWorkoutName, muscle_focus: "", exercises: exercises)
        let previous = await TrainingRepo.previousSets(userId: id, exercises: exercises.map(\.name))
        let workout = ActiveWorkout(userId: idString, day: day, previous: previous)
        workout.previous = previous
        workout.previousRpe = await TrainingRepo.previousRpe(userId: id, exercises: exercises.map(\.name))
        workout.draft.currentExercise = 0
        workout.openExercises = [0]
        // La hoja del selector se cierra antes de abrir el entreno a pantalla completa.
        try? await Task.sleep(for: .milliseconds(350))
        active = workout
    }
}

extension ActiveWorkout: Identifiable { nonisolated var id: ObjectIdentifier { ObjectIdentifier(self) } }

/// Fila de ejercicio de la lista (miniatura, nombre, «N series · R reps · descanso»).
struct ExerciseListRow: View {
    let exercise: GymExercise
    let separator: Bool
    let done: Bool

    var body: some View {
        HStack(spacing: 12) {
            ExerciseThumb(url: exercise.image_url, completed: done, name: exercise.name, muscleGroup: exercise.muscle_group, video: exercise.video_url)
            VStack(alignment: .leading, spacing: 2) {
                Text(exercise.name).font(.apHeadline).lineLimit(2).foregroundStyle(done ? Palette.muted : Palette.foreground)
                Text("\(exercise.series) series · \(exercise.reps) reps · \(exercise.rest)").font(.apFootnote.monospacedDigit())
                    .foregroundStyle(Palette.muted)
            }
            .frame(maxWidth: .infinity, minHeight: 68, alignment: .leading)
            .overlay(alignment: .top) { if separator { Rectangle().fill(Palette.separator).frame(height: 0.5) } }
        }
        .padding(.leading, 12)
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
    }
}

/// Miniatura única de ejercicio (como `ExerciseThumb` en la web): la foto y, sin foto (o mientras
/// carga), la huella del ejercicio, la de su patrón o la deducida del nombre y el grupo. Nunca un
/// cuadro gris vacío. Con clip de técnica, el ejercicio se mueve encima en bucle (`ExerciseLoopView`):
/// la foto y el clip salen de la biblioteca por su nombre (en tandas) y, mientras llegan, del plan.
struct ExerciseThumb: View {
    let url: String?
    var completed = false
    var size: CGFloat = 52
    /// Nombre y datos de la ficha para dibujar la huella. Sin nombre queda el hueco con la mancuerna.
    var name: String = ""
    var muscleGroup: String? = nil
    var pattern: String? = nil
    var stimulus: String? = nil
    var load: String? = nil
    /// Clip que guarda el plan (el de la biblioteca manda en cuanto llega).
    var video: String? = nil
    /// `false` deja la miniatura quieta (Progreso, donde la cifra es la protagonista).
    var moves = true
    /// La foto y el clip que se pasan ya están al día (Admin): no se buscan por nombre en la biblioteca.
    var fresh = false
    @ObservedObject private var loops = ExerciseLoops.shared

    private var photo: String? { fresh || name.isEmpty ? url : loops.images[name] ?? url }
    private var clip: URL? {
        guard moves, !name.isEmpty else { return nil }
        return fresh ? LoopRules.url(video) : loops.video(name, plan: video)
    }

    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 12, style: .continuous).fill(Palette.secondary)
            ExerciseLoopView(url: clip, paused: completed) {
                if let photo, let u = URL(string: photo) {
                    CachedAsyncImage(url: u, maxSide: max(140, size * 2)) { $0.resizable().scaledToFill() } placeholder: { glyph }
                } else if name.isEmpty {
                    Image(systemName: "dumbbell").foregroundStyle(Palette.muted)
                } else {
                    glyph
                }
            }
            if completed {
                Color.black.opacity(0.5)
                Image(systemName: "checkmark").font(.inter(.headline).weight(.bold)).foregroundStyle(Palette.gold)
            }
        }
        .frame(width: size, height: size)
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        .accessibilityHidden(true)
        .task(id: name) { if moves, !fresh { loops.want(name) } }
    }

    @ViewBuilder private var glyph: some View {
        if !name.isEmpty {
            ExerciseMotionGlyph(spec: ExerciseMotion.specFor(name: name, pattern: pattern, stimulus: stimulus, load: load, muscleGroup: muscleGroup))
                .padding(6).opacity(completed ? 0.6 : 1)
        }
    }
}

/// Fila que salta de línea (chips).
struct FlowRow: Layout {
    var spacing: CGFloat = 8
    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let width = proposal.width ?? 400
        var x: CGFloat = 0, y: CGFloat = 0, rowH: CGFloat = 0
        for v in subviews {
            let s = v.sizeThatFits(.unspecified)
            if x + s.width > width { x = 0; y += rowH + spacing; rowH = 0 }
            x += s.width + spacing; rowH = max(rowH, s.height)
        }
        return CGSize(width: width, height: y + rowH)
    }
    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var x = bounds.minX, y = bounds.minY, rowH: CGFloat = 0
        for v in subviews {
            let s = v.sizeThatFits(.unspecified)
            if x + s.width > bounds.maxX { x = bounds.minX; y += rowH + spacing; rowH = 0 }
            v.place(at: CGPoint(x: x, y: y), proposal: ProposedViewSize(s))
            x += s.width + spacing; rowH = max(rowH, s.height)
        }
    }
}


final class PlanModel: ObservableObject {
    @Published var days: [DayPlan] = []
    @Published var completions: [(day: String, date: String)] = []
    @Published var loading = false
    @Published var error: String?
    /// Ya hay una respuesta (red, memoria o disco). Hasta entonces nunca se pinta «sin rutina».
    @Published var loaded = false

    /// Siembra el plan y lo hecho desde la caché (memoria o disco) sin esperar a la red.
    init(userId: UUID? = nil) {
        guard let userId, let cached = TrainingRepo.instantPlan(userId: userId) else { return }
        days = cached
        completions = TrainingRepo.instantCompletions(userId: userId, since: LocalDate.daysAgo(6)) ?? []
        loaded = true
    }

    func load(userId: UUID?) async {
        guard let userId else { return }
        loading = true
        defer { loading = false; loaded = true }
        do {
            let fresh = try await TrainingRepo.plan(userId: userId)
            let rows = await TrainingRepo.completions(userId: userId, since: LocalDate.daysAgo(6))
            // Un único cambio, y solo si algo cambió: sin redibujos de más al refrescar.
            if fresh != days { days = fresh }
            if !rows.elementsEqual(completions, by: { $0.day == $1.day && $0.date == $1.date }) { completions = rows }
            TrainingRepo.saveCompletionsSnapshot(userId: userId, rows)
            error = nil
        } catch {
            self.error = "No se pudo cargar el plan."
        }
    }

    func completedToday(_ day: String) -> Bool {
        completions.contains { $0.day == day && $0.date == LocalDate.string() }
    }

    /// Sesiones de la rutina en orden (sin días de la semana).
    var sessions: [DayPlan] { RoutineOrder.sessions(days) }
    /// Sesiones hechas esta semana (desde el lunes).
    var doneThisWeek: Set<String> { RoutineOrder.doneThisWeek(completions) }
    /// Sesiones hechas hoy: su acción pasa a «completado».
    var doneTodayKeys: Set<String> { Set(completions.filter { $0.date == LocalDate.string() }.map(\.day)) }
}


/// `TrainingPlanView` de la web, igual en iPhone, iPad y Mac: lo hecho esta semana arriba y las
/// sesiones de la rutina en orden («Sesión 1, 2…»), con la siguiente destacada. La elegida se abre
/// bajo su fila. Sin días de la semana ni descansos: cualquier sesión se hace cualquier día.
struct RoutineListView: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    let days: [DayPlan]
    /// Sesiones hechas esta semana (su clave `day`).
    var doneThisWeek: Set<String> = []
    /// Sesiones hechas hoy: su acción pasa a ser «completado».
    var doneToday: Set<String> = []
    /// Sesión con un entreno a medias: su acción pasa a ser «Continuar entreno».
    var resumableDay: String? = nil
    /// Cabecera de la rutina (modo, Ejercicios, Editar): va arriba, como en la web.
    var routineBar: AnyView? = nil
    /// «Mis rutinas» (rutinas propias con Empezar, Editar, Duplicar y Borrar): va bajo las sesiones.
    var routines: AnyView? = nil
    /// Guarda el nombre y el icono de una sesión; false si no se pudo.
    var onPersonalize: ((String, String, String?, String?) async -> Bool)? = nil
    var onOpen: (String) -> Void
    @State private var expanded: String?
    /// Sesión que se está personalizando (nombre e icono).
    @State private var personalizing: DayPlan?
    /// Todas plegadas a propósito (se tocó la abierta): no se vuelve a abrir sola la siguiente.
    @State private var collapsedAll = false
    @State private var detail: GymExercise?

    private var sessions: [DayPlan] { RoutineOrder.sessions(days) }
    private var next: DayPlan? { RoutineOrder.nextPending(sessions, done: doneThisWeek) }
    /// La abierta: la elegida si sigue en el plan; si no, la siguiente que falta o la primera.
    private var openKey: String? {
        if collapsedAll { return nil }
        if let expanded, sessions.contains(where: { $0.day == expanded }) { return expanded }
        return (next ?? sessions.first)?.day
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            if let routineBar { routineBar }
            if sessions.isEmpty {
                emptyCard(icon: "lu-calendar", title: "Tu plan aún no tiene sesiones",
                          message: "Edita tu rutina para añadir tus sesiones.")
            } else {
                VStack(alignment: .leading, spacing: 12) {
                    Text("Tu plan").font(.apTitle3).accessibilityAddTraits(.isHeader)
                    weekProgress
                    VStack(spacing: 12) {
                        ForEach(Array(sessions.enumerated()), id: \.element.day) { index, plan in
                            sessionRow(index + 1, plan)
                            if openKey == plan.day { session(plan) }
                        }
                    }
                }
            }
            if let routines { routines }
            (Text("Análisis asistido por IA · tu plan se adapta a ti · ") + Text("[no sustituye consejo médico](https://autopilotplan.com/legal/disclaimer-medico)"))
                .tint(Palette.gold)
                .font(.apFootnote).foregroundStyle(Palette.muted).multilineTextAlignment(.center)
                .frame(maxWidth: .infinity).padding(.horizontal, 16)
        }
        .sheet(item: $detail) { ex in
            // Sin foto, la ficha abre con la huella del ejercicio (nunca un hueco).
            TechniqueSheet(exercise: ex, motion: ExerciseMotion.specFor(name: ex.name, pattern: nil, stimulus: nil, load: nil, muscleGroup: ex.muscle_group))
                .presentationBackground(Palette.card)
        }
        .sheet(item: $personalizing) { plan in
            SessionIdentitySheet(plan: plan, number: (sessions.firstIndex { $0.day == plan.day } ?? 0) + 1) { name, icon, image in
                await onPersonalize?(plan.day, name, icon, image) ?? false
            }
            .presentationBackground(Palette.card)
        }
    }

    /// Lo hecho esta semana: un tramo por sesión, dorado si ya está hecha (como la web).
    private var weekProgress: some View {
        let done = sessions.filter { doneThisWeek.contains($0.day) }.count
        return HStack(spacing: 12) {
            HStack(spacing: 6) {
                ForEach(sessions, id: \.day) { plan in
                    Capsule().fill(doneThisWeek.contains(plan.day) ? Palette.gold : Palette.secondary).frame(height: 6)
                }
            }
            Text("\(done) de \(sessions.count) esta semana").font(.apFootnote.monospacedDigit())
                .foregroundStyle(Palette.muted).fixedSize()
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Esta semana: \(done) de \(sessions.count) sesiones")
    }

    /// Fila de la rutina: foto, «Sesión N» (con «Siguiente» o «Hecha»), nombre y detalle, con chevron.
    private func sessionRow(_ number: Int, _ plan: DayPlan) -> some View {
        let isExpanded = openKey == plan.day
        let done = doneThisWeek.contains(plan.day)
        let isNext = next?.day == plan.day
        let shape = RoundedRectangle(cornerRadius: Radius.card, style: .continuous)
        return Button {
            Haptics.selection()
            // Tocar la abierta la pliega; tocar otra la abre.
            withAnimation(reduceMotion ? nil : .snappy) {
                if isExpanded { collapsedAll = true; expanded = nil } else { collapsedAll = false; expanded = plan.day }
            }
        } label: {
            HStack(spacing: 14) {
                rowThumb(plan)
                VStack(alignment: .leading, spacing: 2) {
                    HStack(spacing: 4) {
                        Text("Sesión \(number)").foregroundStyle(Palette.muted)
                        if done {
                            // El entrenamiento no usa verde: su estado «hecho» es dorado (tokens.md).
                            Text("·").foregroundStyle(Palette.muted)
                            Image(systemName: "checkmark").font(.system(size: 11, weight: .bold)).foregroundStyle(Palette.gold)
                            Text("Hecha").foregroundStyle(Palette.gold)
                        } else if isNext {
                            Text("· Siguiente").foregroundStyle(Palette.gold)
                        }
                    }
                    .font(.apFootnote.weight(.medium))
                    Text(plan.title).font(.apHeadline).foregroundStyle(Palette.foreground)
                        .lineLimit(2).fixedSize(horizontal: false, vertical: true)
                    Text(meta(plan)).font(.apFootnote.monospacedDigit()).foregroundStyle(Palette.muted).lineLimit(1)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                Image(systemName: "chevron.right").font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(isExpanded ? Palette.gold : Palette.muted)
                    .rotationEffect(.degrees(isExpanded ? 90 : 0))
                    .accessibilityHidden(true)
            }
            .padding(.leading, 12).padding(.trailing, 16).padding(.vertical, 12)
            .frame(maxWidth: .infinity, minHeight: 88, alignment: .leading)
            .background(SurfaceBackground(shape: shape))
            // Sin borde; la abierta, con el filo dorado tenue de «activo» (tokens.md).
            .overlay(shape.strokeBorder(Palette.gold.opacity(isExpanded ? 0.3 : 0), lineWidth: 1))
            .contentShape(shape)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Sesión \(number): \(plan.title)\(done ? ", hecha esta semana" : isNext ? ", siguiente" : "")")
        .accessibilityAddTraits(isExpanded ? .isSelected : [])
    }

    /// Detalle corto de la fila: ejercicios y series del gimnasio, intensidad y duración de la actividad.
    private func meta(_ plan: DayPlan) -> String {
        if plan.isGym {
            let exercises = plan.exercises ?? []
            let sets = exercises.reduce(0) { $0 + $1.series }
            guard !exercises.isEmpty else { return "Sin ejercicios todavía" }
            return ["\(exercises.count) \(exercises.count == 1 ? "ejercicio" : "ejercicios")", sets > 0 ? "\(sets) \(sets == 1 ? "serie" : "series")" : nil].compactMap { $0 }.joined(separator: " · ")
        }
        let parts = [plan.intensity.map { "Intensidad \($0.lowercased())" }, plan.duration].compactMap { $0 }.filter { !$0.isEmpty }
        return parts.isEmpty ? "Actividad" : parts.joined(separator: " · ")
    }

    /// Foto de la fila: la del primer ejercicio o la de marca; la actividad, su llama.
    @ViewBuilder private func rowThumb(_ plan: DayPlan) -> some View {
        let shape = RoundedRectangle(cornerRadius: 16, style: .continuous)
        if let emoji = SessionIdentity.clean(plan.session_icon) {
            Text(emoji).font(.system(size: 32))
                .frame(width: 64, height: 64)
                .background(Palette.secondary, in: shape)
                .accessibilityHidden(true)
        } else if let cover = plan.cover_url, !cover.isEmpty, let u = URL(string: cover) {
            CachedAsyncImage(url: u, maxSide: 300) {
                $0.resizable().scaledToFill()
            } placeholder: {
                Palette.secondary
            }
            .frame(width: 64, height: 64)
            .clipShape(shape)
            .accessibilityHidden(true)
        } else if plan.isGym {
            let source = (plan.exercises ?? []).compactMap(\.image_url).first { !$0.isEmpty } ?? Self.brandGymPhoto
            CachedAsyncImage(url: URL(string: source), maxSide: 300) {
                $0.resizable().scaledToFill()
            } placeholder: {
                Palette.secondary
            }
            .frame(width: 64, height: 64)
            .clipShape(shape)
            .accessibilityHidden(true)
        } else {
            Image(systemName: "flame").font(.system(size: 22, weight: .medium))
                .foregroundStyle(Palette.gold)
                .frame(width: 64, height: 64)
                .background(Palette.secondary, in: shape)
                .accessibilityHidden(true)
        }
    }

    @ViewBuilder private func session(_ plan: DayPlan) -> some View {
        let exercises = plan.exercises ?? []
        VStack(alignment: .leading, spacing: 12) {
            // La foto y el nombre ya están en la fila: aquí solo la acción y los ejercicios.
            action(plan)
            if plan.isGym {
                if !exercises.isEmpty {
                    VStack(spacing: 0) {
                        ForEach(Array(exercises.enumerated()), id: \.offset) { i, ex in
                            Button { detail = ex } label: {
                                HStack(spacing: 12) {
                                    // Miniaturas uniformes (44) y mismo padding en todas las filas.
                                    ExerciseThumb(url: ex.image_url, size: 44, name: ex.name, muscleGroup: ex.muscle_group, video: ex.video_url)
                                    VStack(alignment: .leading, spacing: 3) {
                                        Text(ex.name).font(.apHeadline).lineLimit(2)
                                            .fixedSize(horizontal: false, vertical: true)
                                        // Descanso con su unidad («90 s», «2 min»), como la web.
                                        let rest = ex.rest.trimmingCharacters(in: .whitespaces).isEmpty ? nil : PlanEditorValues.restLabel(ex.rest)
                                        let info = [rest, ex.muscle_group, ex.exercise_type].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: " · ")
                                        if !info.isEmpty {
                                            Text(info).font(.apFootnote).foregroundStyle(Palette.muted).lineLimit(1)
                                        }
                                    }
                                    .frame(maxWidth: .infinity, alignment: .leading)
                                    // Ancho propio y números tabulares: la columna queda alineada
                                    // a la derecha en todas las filas y no se parte nunca.
                                    Text("\(ex.series) × \(ex.reps)").font(.apSubhead.monospacedDigit())
                                        .foregroundStyle(Palette.muted)
                                        .lineLimit(1).fixedSize(horizontal: true, vertical: false)
                                    Image("lu-chevron-left").renderingMode(.template).resizable().frame(width: 16, height: 16)
                                        .rotationEffect(.degrees(180)).foregroundStyle(Palette.muted.opacity(0.6))
                                        .accessibilityHidden(true)
                                }
                                .padding(.horizontal, 16).padding(.vertical, 10)
                                .frame(minHeight: 64)
                                .overlay(alignment: .bottom) {
                                    // 16 + 44 (foto) + 12: el separador empieza donde el texto.
                                    if i < exercises.count - 1 {
                                        Rectangle().fill(Palette.separator).frame(height: 0.5)
                                            .padding(.leading, 72).padding(.trailing, 16)
                                    }
                                }
                                .contentShape(Rectangle())
                            }
                            .buttonStyle(.plain)
                            .contextMenu {
                                Button { Haptics.tap(); detail = ex } label: {
                                    Label("Ficha de técnica", systemImage: "info.circle")
                                }
                            }
                            .accessibilityHint("Abre la ficha de técnica del ejercicio")
                        }
                    }
                    .surface()
                    .clipShape(RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
                }
            } else {
                VStack(spacing: 0) {
                    infoRow("lu-flame", "Intensidad", plan.intensity ?? "", last: false)
                    infoRow("lu-clock", "Duración", planDurations(plan), last: true)
                }
                .surface()
            }
            if onPersonalize != nil {
                Button { Haptics.selection(); personalizing = plan } label: {
                    Label("Nombre e icono", systemImage: "pencil")
                }
                .buttonStyle(.pillSecondary)
                .accessibilityHint("Cambia el nombre y el icono de esta sesión")
            }
        }
    }

    /// Acción de la sesión elegida: empezar o continuar el entreno, marcar la actividad o el estado hecho.
    @ViewBuilder private func action(_ plan: DayPlan) -> some View {
        let exercises = plan.exercises ?? []
        let done = doneToday.contains(plan.day)
        if plan.isGym {
            if done {
                completedLabel("Entrenamiento completado")
            } else if exercises.isEmpty {
                Text("Esta sesión no tiene ejercicios todavía.")
                    .font(.apSubhead).foregroundStyle(Palette.muted)
            } else {
                Button(resumableDay == plan.day ? "Continuar entreno" : "Empezar sesión") { Haptics.tap(); onOpen(plan.day) }
                    .buttonStyle(.pill)
            }
        } else if done {
            completedLabel("Actividad completada")
        } else {
            Button("Marcar actividad como hecha") { Haptics.tap(); onOpen(plan.day) }.buttonStyle(.pill)
        }
    }

    /// Estado «hecho» de la sesión: misma forma y alto que la píldora de acción, en dorado y sin acción.
    private func completedLabel(_ title: String) -> some View {
        Label(title, systemImage: "checkmark.circle.fill")
            .font(.apHeadline).foregroundStyle(Palette.gold)
            .frame(maxWidth: .infinity, minHeight: 50)
            .background(Palette.gold.opacity(0.14), in: Capsule())
            .accessibilityElement(children: .combine)
    }

    /// Duración del plan; si el campo viene vacío, se estima por series y descansos.
    private func planDurations(_ plan: DayPlan) -> String {
        if let d = plan.duration?.trimmingCharacters(in: .whitespaces), !d.isEmpty { return d }
        let exercises = plan.exercises ?? []
        guard !exercises.isEmpty else { return "—" }
        let seconds = exercises.reduce(0.0) { total, e in
            let rest = Double(e.rest.filter { $0.isNumber }) ?? 60
            return total + Double(max(e.series, 1)) * (rest + 40)
        }
        return "≈ \(Int((seconds / 60).rounded())) min"
    }

    private func infoRow(_ icon: String, _ title: String, _ value: String, last: Bool) -> some View {
        HStack(spacing: 12) {
            Image(icon).renderingMode(.template).resizable().frame(width: 20, height: 20)
                .foregroundStyle(Palette.muted).frame(width: 28)
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

    /// Foto de marca de la web (`BRAND_PHOTOS.gym`): respaldo de la portada cuando la sesión no
    /// tiene ninguna foto de ejercicio, igual que `TrainingPlanView.tsx`.
    private static var brandGymPhoto: String { BrandPhotos.string(.gym) }

    /// Plan sin sesiones: tarjeta vacía con su icono y el siguiente paso.
    private func emptyCard(icon: String, title: String, message: String) -> some View {
        VStack(spacing: 0) {
            ZStack {
                Circle().fill(Palette.gold.opacity(0.15)).frame(width: 64, height: 64)
                Image(icon).renderingMode(.template).resizable().frame(width: 26, height: 26).foregroundStyle(Palette.gold)
            }
            .accessibilityHidden(true)
            Text(title).font(.apHeadline).padding(.top, 16)
            Text(message).font(.apSubhead).foregroundStyle(Palette.muted)
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 6)
        }
        .padding(.horizontal, 20).padding(.vertical, 24)
        .frame(maxWidth: .infinity, minHeight: 288)
        .surface(Radius.hero)
    }

}

/// «Personalizar sesión» (`SessionIdentitySheet.tsx`): nombre propio o sugerido y un icono
/// (la foto de la sesión, un emoji propio o el sugerido según sus ejercicios).
struct SessionIdentitySheet: View {
    let plan: DayPlan
    let number: Int
    let onSave: (String, String?, String?) async -> Bool
    @Environment(\.dismiss) private var dismiss
    @State private var name: String
    @State private var icon: String?
    @State private var photoItem: PhotosPickerItem?
    @State private var customImage: String?
    @State private var saving = false
    @State private var failed = false

    init(plan: DayPlan, number: Int, onSave: @escaping (String, String?, String?) async -> Bool) {
        self.plan = plan
        self.number = number
        self.onSave = onSave
        _name = State(initialValue: plan.routine_name ?? "")
        _icon = State(initialValue: SessionIdentity.clean(plan.session_icon))
        _customImage = State(initialValue: plan.cover_url)
    }

    private var suggestedName: String { SessionIdentity.suggestedName(plan) }
    private var suggestedIcon: String { SessionIdentity.suggestedIcon(plan) }
    private var options: [String] { [suggestedIcon] + SessionIdentity.emojis.filter { $0 != suggestedIcon } }
    private let columns = [GridItem(.adaptive(minimum: 48, maximum: 56), spacing: 10)]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Sesión \(number)").font(.apFootnote.weight(.medium)).foregroundStyle(Palette.muted)
                    Text("Personalizar sesión").font(.inter(size: 22, weight: .bold)).tracking(-0.4)
                        .accessibilityAddTraits(.isHeader)
                }

                if plan.isGym {
                    VStack(alignment: .leading, spacing: 10) {
                        Text("Nombre").font(.apSubhead.weight(.semibold))
                        PillField(label: suggestedName, text: $name)
                        if name.trimmingCharacters(in: .whitespaces) != suggestedName {
                            Button { Haptics.selection(); name = suggestedName } label: {
                                (Text("Sugerido: ").foregroundColor(Palette.muted) + Text(suggestedName).foregroundColor(Palette.foreground))
                                    .font(.apSubhead)
                                    .padding(.horizontal, 16).frame(minHeight: 44)
                                    .background(Palette.secondary, in: Capsule())
                            }
                            .buttonStyle(.plain)
                            .accessibilityLabel("Usar el nombre sugerido: \(suggestedName)")
                        }
                    }
                }

                VStack(alignment: .leading, spacing: 10) {
                    Text("Icono").font(.apSubhead.weight(.semibold))
                    Text(plan.isGym ? "La foto de la sesión o un emoji. El sugerido, con el punto dorado, sale de sus ejercicios."
                                    : "El icono de la actividad o un emoji. El sugerido lleva el punto dorado.")
                        .font(.apFootnote).foregroundStyle(Palette.muted)
                    LazyVGrid(columns: columns, alignment: .leading, spacing: 10) {
                        iconOption(nil)
                        ForEach(options, id: \.self) { iconOption($0) }
                    }
                }

                VStack(alignment: .leading, spacing: 10) {
                    Text("Imagen de portada").font(.apSubhead.weight(.semibold))
                    PhotosPicker(selection: $photoItem, matching: .images) {
                        HStack {
                            if let customImage, let url = URL(string: customImage), url.isFileURL, let img = PlatformImage(contentsOfFile: url.path) {
                                Image(platformImage: img).resizable().scaledToFill().frame(width: 48, height: 48).clipShape(RoundedRectangle(cornerRadius: 12))
                            } else if let customImage, !customImage.isEmpty {
                                Text("Imagen elegida").font(.apBody)
                            } else {
                                Label("Elegir foto de la galería", systemImage: "photo")
                            }
                        }
                        .frame(maxWidth: .infinity, minHeight: 44)
                        .background(Palette.secondary, in: Capsule())
                    }
                    .buttonStyle(.plain)
                    .onChange(of: photoItem) { _, item in
                        Task { await savePickedImage(item) }
                    }
                }

                if failed {
                    Text("No se pudo guardar. Inténtalo de nuevo.").font(.apFootnote).foregroundStyle(Palette.destructive)
                        .accessibilityAddTraits(.updatesFrequently)
                }

                Button(saving ? "Guardando…" : "Guardar") {
                    Task {
                        saving = true
                        failed = false
                        let ok = await onSave(name, icon, customImage)
                        saving = false
                        if ok { dismiss() } else { failed = true; A11y.announce("No se pudo guardar") }
                    }
                }
                .buttonStyle(.pill)
                .disabled(saving || (plan.isGym && name.trimmingCharacters(in: .whitespaces).isEmpty))
            }
            .padding(24)
        }
        .presentationDetents([.large])
        #if os(macOS)
        .frame(minWidth: 420, minHeight: 560)
        #endif
    }

    private func savePickedImage(_ item: PhotosPickerItem?) async {
        guard let item else { return }
        guard let data = try? await item.loadTransferable(type: Data.self) else { return }
        let dir = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first!
        let url = dir.appendingPathComponent("session-cover-\(plan.day).jpg")
        try? data.write(to: url)
        await MainActor.run { customImage = url.absoluteString }
    }

    /// Una opción del icono: `nil` es la foto de la sesión (o la llama de la actividad).
    private func iconOption(_ value: String?) -> some View {
        let selected = icon == value
        let shape = RoundedRectangle(cornerRadius: 16, style: .continuous)
        return Button { Haptics.selection(); icon = value } label: {
            Group {
                if let value {
                    Text(value).font(.system(size: 24))
                } else {
                    Image(systemName: plan.isGym ? "photo" : "flame")
                        .font(.system(size: 18, weight: .medium))
                        .foregroundStyle(plan.isGym ? Palette.muted : Palette.gold)
                }
            }
            .frame(width: 48, height: 48)
            .background(Palette.secondary, in: shape)
            .overlay(shape.strokeBorder(selected ? Palette.gold : .clear, lineWidth: 2))
            .overlay(alignment: .topTrailing) {
                if value == suggestedIcon {
                    Circle().fill(Palette.gold).frame(width: 10, height: 10)
                        .overlay(Circle().stroke(Palette.card, lineWidth: 2)).offset(x: 2, y: -2)
                }
            }
        }
        .buttonStyle(.plain)
        .accessibilityLabel(value.map { $0 == suggestedIcon ? "\($0), sugerido" : $0 } ?? (plan.isGym ? "Foto de la sesión" : "Icono de actividad"))
        .accessibilityAddTraits(selected ? [.isButton, .isSelected] : .isButton)
    }
}
