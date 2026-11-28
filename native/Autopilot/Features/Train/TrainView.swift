import SwiftUI
import Supabase
import PhotosUI

/// Entrenar (`TrainingPlanView` + la sección «training» de la web): el modo del plan en una frase con
/// «Entreno vacío» y «Ejercicios» en píldoras tranquilas, «Esta semana» (las sesiones en una sola lista,
/// con «Hoy» y «Hecha») y «Mis rutinas». No es una pestaña, como en la web: se llega desde el «+» de Hoy.
/// En iPad y Mac, la misma columna centrada de 680 que Hoy y Nutrición.
struct TrainView: View {
    /// «Empezar entreno de hoy» (menú del Mac) con Entrenar delante: lo abre aquí, sin cambiar de pantalla.
    static var pendingStart = false
    /// «Ver todas» en «Mis rutinas» de Hoy: Entrenar se abre con «Mis rutinas» arriba.
    static var focusRoutines = false
    static var routinesOnly = false
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
    @State private var templates: [RoutineTemplate] = []
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

    @State private var routines: [DayPlan] = []
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
                    // Sin conexión: el aviso común con «Reintentar» (en Mac no hay «deslizar para recargar»).
                    VStack(spacing: 0) {
                        EmptyStateView(symbol: "wifi.exclamationmark", title: error,
                                       message: "Revisa tu conexión y vuelve a intentarlo.")
                        Button("Reintentar") { Haptics.tap(); Task { await load() } }
                            .buttonStyle(PillButtonStyle(kind: .secondary, height: 44)).fixedSize()
                    }
                    .frame(maxWidth: .infinity)
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
                    RoutineListView(days: model.days,
                                    doneThisWeek: model.doneThisWeek,
                                    doneToday: model.doneTodayKeys,
                                    resumableDay: resumableDay,
                                    header: AnyView(trainHeader),
                                    routines: AnyView(routinesSection),
                                    onEditPlan: { editing = true },
                                    onPersonalize: { day, name, icon, _ in await personalize(day: day, name: name, icon: icon) }) { day in
                        Task { await open(day) }
                    }
                }
                if !templates.isEmpty {
                    VStack(alignment: .leading, spacing: 12) {
                    Text("Rutinas de la comunidad").font(.apTitle3).accessibilityAddTraits(.isHeader)
                    ForEach(templates) { t in
                        VStack(alignment: .leading, spacing: 8) {
                            HStack(alignment: .center, spacing: 8) {
                                Text(t.name).font(.apHeadline).lineLimit(1)
                                    .frame(maxWidth: .infinity, alignment: .leading)
                                Menu {
                                    Button {
                                        Haptics.selection()
                                        Task { await applyTemplate(t) }
                                    } label: { Label("Aplicar al plan", systemImage: "checkmark.circle") }
                                    Button {
                                        Haptics.selection()
                                        Task { await addToOwnRoutines(t) }
                                    } label: { Label("Marcar como propia", systemImage: "plus.circle") }
                                    Button { Haptics.selection(); routineEditor = RoutineEditorTarget(day: nil) } label: { Label("Editar", systemImage: "pencil") }
                                    Divider()
                                    Button(role: .destructive) {
                                        Haptics.warning()
                                        var hidden = UserDefaults.standard.stringArray(forKey: "hidden_templates") ?? []
                                        hidden.append(t.id.uuidString)
                                        UserDefaults.standard.set(hidden, forKey: "hidden_templates")
                                        templates.removeAll { $0.id == t.id }
                                    } label: { Label("Borrar", systemImage: "trash") }
                                } label: {
                                    Image(systemName: "ellipsis").font(.system(size: 15, weight: .semibold)).foregroundStyle(Palette.muted)
                                        .frame(width: 32, height: 32).contentShape(Circle())
                                }
                                #if os(macOS)
                                .menuStyle(.borderlessButton).menuIndicator(.hidden).fixedSize()
                                #endif
                            }
                            if let d = t.description {
                                Text(d).font(.apFootnote).foregroundStyle(Palette.muted).fixedSize(horizontal: false, vertical: true)
                            }
                            FlowRow(spacing: 6) {
                                ForEach(t.days, id: \.day) { d in
                                    VStack(spacing: 2) {
                                        Text(String(d.day.prefix(1)))
                                            .font(.apFootnote.weight(.semibold))
                                            .foregroundStyle(Palette.foreground)
                                            .frame(width: 28, height: 28)
                                            .background(Palette.secondary, in: Circle())
                                        if let title = d.day_title, !title.isEmpty {
                                            Text(title).font(.apCaption).foregroundStyle(Palette.muted).lineLimit(1)
                                        }
                                    }
                                }
                            }
                            .accessibilityHidden(true)
                        }
                        .padding(12).surface()
                    }
                }
            }
            }
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
            RoutineEditorView(routines: {
                guard let day = target.day, let uid = session.userIdString else { return [] }
                let all = CustomRoutines.mine(userId: uid)
                let base = all.first(where: { $0.day == day })
                let rid = base?.routine_id ?? base.map { CustomRoutines.routineKey($0) }
                return rid.map { r in all.filter { ($0.routine_id ?? CustomRoutines.routineKey($0)) == r } } ?? []
            }(),
                              limitReached: false,
                              existingRoutines: session.userIdString.map { CustomRoutines.mine(userId: $0) } ?? []) { name, routineDays, rid in
                guard let uid = session.userIdString else { return false }
                if target.day != nil {
                    let base = CustomRoutines.mine(userId: uid).first(where: { $0.day == target.day! })
                    let oldDay = base?.day ?? target.day!
                    _ = CustomRoutines.updateRoutine(userId: uid, oldDay: oldDay, name: name, days: routineDays)
                    routines = CustomRoutines.mine(userId: uid)
                    Haptics.success(); A11y.announce("Rutina guardada")
                    return true
                }
                _ = CustomRoutines.addRoutine(userId: uid, name: name, days: routineDays, routine_id: rid)
                routines = CustomRoutines.mine(userId: uid)
                Haptics.success(); A11y.announce("Rutina creada en Mis rutinas")
                return true
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

    /// Cabecera de Entrenar (como la web): el modo del plan en una sola frase y, debajo, «Entreno vacío» y
    /// «Ejercicios» como píldoras tranquilas. «Editar» va junto a «Esta semana».
    private var trainHeader: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text(CustomRoutines.modeLine(model.days)).font(.apSubhead).foregroundStyle(Palette.muted)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var emptyBarButton: some View {
        quietPill("Entreno vacío", icon: "play") {
            // Con un entreno a medias se continúa ese: empezar otro borraría sus series.
            if let id = session.userIdString, let draft = ActiveWorkout.restore(userId: id) {
                active = ActiveWorkout(draft: draft)
            } else {
                pickingEmpty = true
            }
        }
    }

    private var libraryBarButton: some View { quietPill("Ejercicios", icon: "book") { library = true } }

    /// Píldora tranquila (secundaria, con relieve y a su medida), como `QuietPill` en la web.
    private func quietPill(_ title: String, icon: String, action: @escaping () -> Void) -> some View {
        Button { Haptics.tap(); action() } label: {
            HStack(spacing: 8) {
                Image(systemName: icon).font(.system(size: 14, weight: .semibold)).foregroundStyle(Palette.muted)
                Text(title).font(.apSubhead.weight(.semibold)).foregroundStyle(Palette.foreground)
            }
            .lineLimit(1)
            .padding(.horizontal, 16)
            .frame(height: 44)
            .background(RaisedFill(shape: Capsule()))
            .contentShape(Capsule())
        }
        .buttonStyle(.pressableCard(scale: 0.97))
        .fixedSize()
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
        MyRoutinesSection(routines: routines, limitReached: limitReached, userId: session.userIdString, resumableDay: resumableDay,
                          doneToday: model.doneTodayKeys, autopilot: autopilotOffer,
                          onNew: { routineEditor = RoutineEditorTarget(day: nil) },
                          onStart: { day in Task { await open(day) } },
                          onEdit: { day in routineEditor = RoutineEditorTarget(day: day) },
                          onDuplicate: { day in
                              guard let uid = session.userIdString else { return false }
                              let ok = CustomRoutines.duplicate(userId: uid, day: day)
                              if ok { routines = CustomRoutines.mine(userId: uid); Haptics.success(); A11y.announce("Rutina duplicada") }
                              return ok
                          },
                          onDelete: { day in
                              guard let uid = session.userIdString else { return false }
                              let ok = CustomRoutines.delete(userId: uid, day: day)
                              if ok { routines = CustomRoutines.mine(userId: uid); Haptics.success(); A11y.announce("Rutina borrada") }
                              return ok
                          },
                          onApply: { rid in Task { await applyRoutine(rid) } })
            .id("mis-rutinas")
    }

    // MARK: Cargar, guardar y abrir

    private func load() async {
        await model.load(userId: session.userId)
        // Entreno a medias guardado: la rutina lo ofrece como «Continuar entreno».
        resumableDay = session.userIdString.flatMap { ActiveWorkout.restore(userId: $0)?.day.day }
        await loadTrainingDays()
        let hidden = UserDefaults.standard.stringArray(forKey: "hidden_templates") ?? []
        templates = await TrainingRepo.routineTemplates().filter { !hidden.contains($0.id.uuidString) }
        if let uid = session.userIdString { routines = CustomRoutines.mine(userId: uid) }
        // Entrenar y Mis rutinas: las miniaturas de todas las sesiones, por detrás (al abrir una ya están).
        let urls = model.days.flatMap { ($0.exercises ?? []).compactMap(\.image_url) }.compactMap(URL.init(string:))
        MediaPrefetch.thumbnails(urls)
    }

    /// Tus días de entreno (`trainingDays`) mientras el plan no tenga sesiones del piloto automático
    /// (vacío o todo tuyo): así, al crear tu primera rutina o al dejar el plan todo tuyo en el editor,
    /// «Completar con el autopiloto» ya sabe si ofrecerse, como en la web.
    /// Copia una plantilla a las rutinas propias (añade sus días a los días libres, sin reemplazar el plan).
    private func addToOwnRoutines(_ t: RoutineTemplate) async {
        guard let uid = session.userIdString else { return }
        Haptics.tap()
        let rid = UUID().uuidString
        let days = t.days.map { RoutineDay(day: $0.day, title: $0.day_title ?? "", exercises: $0.exercises ?? []) }
        _ = CustomRoutines.addRoutine(userId: uid, name: t.name, days: days, routine_id: rid)
        routines = CustomRoutines.mine(userId: uid)
        A11y.announce("Rutina \(t.name) añadida a tus rutinas")
        Haptics.success()
    }

    private func applyTemplate(_ t: RoutineTemplate) async {
        guard let userId = session.userId else { return }
        Haptics.tap()
        do {
            let rid = UUID().uuidString
            let current = model.days
            // Eliminar rutinas custom existentes y añadir las del template.
            var plans = current.filter { $0.custom != true }
            for d in t.days {
                var day = d.day
                if plans.contains(where: { $0.day == day }) {
                    if let free = CustomRoutines.nextFreeKey(plans) { day = free } else { continue }
                }
                var copy = d
                copy.day = day
                copy.custom = true
                copy.routine_id = rid
                copy.routine_name = copy.routine_name ?? t.name
                plans.append(copy)
            }
            struct Row: Encodable { let user_id: UUID; let workouts_json: [DayPlan]; let updated_at: String }
            try await Backend.client.from("training_plan")
                .upsert(Row(user_id: userId, workouts_json: plans, updated_at: ISO8601DateFormatter().string(from: Date())), onConflict: "user_id")
                .execute()
            let withPhotos = await TrainingRepo.withImages(plans)
            TrainingRepo.storePlanLocally(userId: userId, withPhotos)
            await load()
            if let uid = session.userIdString { UserDefaults.standard.set(rid, forKey: "applied_routine_\\(uid)") }
            NotificationCenter.default.post(name: .routineApplied, object: rid)
            A11y.announce("Rutina \\(t.name) aplicada: \\(plans.count) sesiones")
            Haptics.success()
        } catch {
            A11y.announce("Error: \\(error.localizedDescription)")
            Haptics.error()
        }
    }

    private func loadTrainingDays() async {
        guard let userId = session.userId, model.sessions.allSatisfy({ $0.custom == true }) else { return }
        trainingDays = await TrainingRepo.trainingFrequency(userId: userId)
    }

    /// Aplica una rutina (por `routine_id`) al plan: copia sus días al plan activo (añadiendo los que
    /// falten con claves libres) y persiste. Así «Aplicar al plan» hace algo real, no solo anuncia.
    private func applyRoutine(_ rid: String) async {
        // Aplicar = marcar esta rutina como la activa (no modifica el plan: las rutinas siguen siendo
        // una biblioteca; el plan mantiene todas). El efecto visible es el badge "Predeterminada" y el
        // selector de Inicio.
        Haptics.tap()
        if let uid = session.userIdString { UserDefaults.standard.set(rid, forKey: "applied_routine_\(uid)") }
        NotificationCenter.default.post(name: .routineApplied, object: rid)
        A11y.announce("Rutina aplicada")
        Haptics.success()
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

/// Miniatura única de ejercicio (como `ExerciseThumb` en la web): la foto (192 px, la misma petición
/// en toda la app) y, sin foto, la silueta con su músculo en dorado. Nunca un cuadro gris vacío. Con
/// clip de técnica, el ejercicio se mueve encima en bucle (`ExerciseLoopView`): la foto y el clip
/// salen de la biblioteca por su nombre (en tandas) y, mientras llegan, del plan.
struct ExerciseThumb: View {
    let url: String?
    var completed = false
    var size: CGFloat = 52
    /// Nombre (busca la foto y el clip en la biblioteca) y grupo muscular (la silueta sin foto).
    /// `pattern`, `stimulus` y `load` se aceptan por compatibilidad: la huella dibujada se retiró.
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
            RoundedRectangle(cornerRadius: Radius.chip, style: .continuous).fill(Palette.secondary)
            ExerciseLoopView(url: clip, paused: completed) {
                if let photo, !photo.isEmpty, let u = URL(string: photo) {
                    CachedAsyncImage(url: u, maxSide: MediaSizing.thumbSide(size)) { $0.resizable().scaledToFill() } placeholder: { Color.clear }
                } else {
                    silhouette
                }
            }
            if completed {
                Color.black.opacity(0.5)
                Image(systemName: "checkmark").font(.inter(.headline).weight(.bold)).foregroundStyle(Palette.gold)
            }
        }
        .frame(width: size, height: size)
        .clipShape(RoundedRectangle(cornerRadius: Radius.chip, style: .continuous))
        .accessibilityHidden(true)
        .task(id: name) { if moves, !fresh { loops.want(name) } }
    }

    private var silhouette: some View {
        ExerciseSilhouette(muscleGroup: muscleGroup)
            .padding(.vertical, size * 0.1)
            .opacity(completed ? 0.6 : 1)
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


@MainActor
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


/// `TrainingPlanView` de la web, igual en iPhone, iPad y Mac: la cabecera (el modo en una frase y las
/// píldoras tranquilas), «Esta semana» con «Editar», lo hecho en tramos y las sesiones en una sola lista
/// (nombre, músculos, «6 ejercicios · ≈ 45 min» y su estado: «Hoy», «Hecha» o «Siguiente»). La elegida
/// se abre bajo su fila, dentro de la misma tarjeta. Sin días de la semana ni descansos: cualquier
/// sesión se hace cualquier día.
struct RoutineListView: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    let days: [DayPlan]
    /// Sesiones hechas esta semana (su clave `day`).
    var doneThisWeek: Set<String> = []
    /// Sesiones hechas hoy: su acción pasa a ser «completado».
    var doneToday: Set<String> = []
    /// Sesión con un entreno a medias: su acción pasa a ser «Continuar entreno».
    var resumableDay: String? = nil
    /// Cabecera de Entrenar (el modo en una frase, «Entreno vacío» y «Ejercicios»): va arriba, como en la web.
    var header: AnyView? = nil
    /// «Mis rutinas» (rutinas propias con «Empezar» y, en «···», Editar, Duplicar y Borrar): va bajo las sesiones.
    var routines: AnyView? = nil
    /// «Editar» junto a «Esta semana» (y en el plan sin sesiones): el editor del plan.
    var onEditPlan: (() -> Void)? = nil
    /// Guarda el nombre y el icono de una sesión; false si no se pudo.
    var onPersonalize: ((String, String, String?, String?) async -> Bool)? = nil
    var onOpen: (String) -> Void
    @State private var expanded: String?
    /// Sesión que se está personalizando (nombre e icono).
    @State private var personalizing: DayPlan?
    /// Todas plegadas a propósito (se tocó la abierta): no se vuelve a abrir sola la siguiente.
    @State private var collapsedAll = false
    @State private var detail: GymExercise?

    /// Estado de la sesión en la lista (como `SessionState` en la web).
    private enum RowState { case done, today, next }

    private var sessions: [DayPlan] { RoutineOrder.sessions(days) }
    private var next: DayPlan? { RoutineOrder.nextPending(sessions, done: doneThisWeek) }
    /// La abierta: la elegida si sigue en el plan; si no, la siguiente que falta o la primera.
    private var openKey: String? {
        if collapsedAll { return nil }
        if let expanded, sessions.contains(where: { $0.day == expanded }) { return expanded }
        return (next ?? sessions.first)?.day
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 32) {
            if let routines { routines }
        }
        .sheet(item: $detail) { ex in
            // Sin foto, la ficha abre con la silueta de su músculo (nunca un hueco).
            TechniqueSheet(exercise: ex)
                .presentationBackground(Palette.card)
        }
        .sheet(item: $personalizing) { plan in
            SessionIdentitySheet(plan: plan, number: (sessions.firstIndex { $0.day == plan.day } ?? 0) + 1) { name, icon, image in
                await onPersonalize?(plan.day, name, icon, image) ?? false
            }
            .presentationBackground(Palette.card)
        }
        .onDisappear { TrainView.routinesOnly = false }
    }

    /// Lo hecho esta semana: un tramo por sesión, dorado si ya está hecha, y la cuenta corta al lado (como la web).
    private var weekProgress: some View {
        let done = sessions.filter { doneThisWeek.contains($0.day) }.count
        return HStack(spacing: 12) {
            HStack(spacing: 6) {
                ForEach(sessions, id: \.day) { plan in
                    Capsule().fill(doneThisWeek.contains(plan.day) ? Palette.gold : Palette.secondary).frame(height: 6)
                }
            }
            Text("\(done) de \(sessions.count)").font(.apFootnote.monospacedDigit())
                .foregroundStyle(Palette.muted).fixedSize()
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Esta semana: \(done) de \(sessions.count) sesiones")
    }

    /// «Hoy» es la siguiente sesión mientras hoy no se haya entrenado (la misma que propone Hoy).
    private func state(of plan: DayPlan) -> RowState? {
        if doneThisWeek.contains(plan.day) { return .done }
        if next?.day == plan.day { return doneToday.isEmpty ? .today : .next }
        return nil
    }

    private func spoken(_ state: RowState?) -> String {
        switch state {
        case .done: return ", hecha esta semana"
        case .today: return ", para hoy"
        case .next: return ", siguiente"
        case nil: return ""
        }
    }

    /// Fila de la lista: miniatura, nombre, músculos y «6 ejercicios · ≈ 45 min», con su estado a la derecha.
    private func sessionRow(_ number: Int, _ plan: DayPlan) -> some View {
        let isExpanded = openKey == plan.day
        let state = state(of: plan)
        let muscles = plan.sessionMuscles
        let line = plan.summaryLine
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
                    Text(plan.sessionName).font(.apHeadline).foregroundStyle(Palette.foreground)
                        .lineLimit(2).fixedSize(horizontal: false, vertical: true)
                    // Con letra grande bajan de línea (hasta dos), nunca se corta una cifra con su unidad.
                    if !muscles.isEmpty {
                        Text(muscles).font(.apSubhead).foregroundStyle(Palette.muted).lineLimit(2)
                    }
                    Text(line).font(.apFootnote.monospacedDigit()).foregroundStyle(Palette.muted).lineLimit(2)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                stateBadge(state)
                Image(systemName: "chevron.right").font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(isExpanded ? Palette.gold : Palette.muted.opacity(0.6))
                    .rotationEffect(.degrees(isExpanded ? 90 : 0))
                    .accessibilityHidden(true)
            }
            .padding(.horizontal, 16).padding(.vertical, 12)
            .frame(maxWidth: .infinity, minHeight: 80, alignment: .leading)
            .contentShape(Rectangle())
        }
        .buttonStyle(SessionRowStyle())
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Sesión \(number): \(plan.sessionName)\(muscles.isEmpty ? "" : ", \(muscles)"), \(line)\(spoken(state))")
        .accessibilityAddTraits(isExpanded ? [.isButton, .isSelected] : .isButton)
        .accessibilityHint(isExpanded ? "Pliega la sesión" : "Abre la sesión y sus ejercicios")
    }

    /// «Hoy» en una píldora dorada tenue, «Hecha» con su check dorado y «Siguiente» en gris.
    @ViewBuilder private func stateBadge(_ state: RowState?) -> some View {
        switch state {
        case .done:
            // El entrenamiento no usa verde: su estado «hecho» es dorado (tokens.md).
            HStack(spacing: 4) {
                Image(systemName: "checkmark").font(.system(size: 12, weight: .bold))
                Text("Hecha")
            }
            .font(.apFootnote.weight(.semibold)).foregroundStyle(Palette.gold)
            .fixedSize()
            .accessibilityHidden(true)
        case .today:
            Text("Hoy").font(.apFootnote.weight(.semibold)).foregroundStyle(Palette.gold)
                .padding(.horizontal, 10).padding(.vertical, 4)
                .background(Palette.gold.opacity(0.15), in: Capsule())
                .fixedSize()
                .accessibilityHidden(true)
        case .next:
            Text("Siguiente").font(.apFootnote.weight(.medium)).foregroundStyle(Palette.muted)
                .fixedSize()
                .accessibilityHidden(true)
        case nil:
            EmptyView()
        }
    }

    /// Foto de la fila: su icono, su portada, la del primer ejercicio o la de marca; la actividad, su llama.
    @ViewBuilder private func rowThumb(_ plan: DayPlan) -> some View {
        let shape = RoundedRectangle(cornerRadius: Radius.chip, style: .continuous)
        if let emoji = SessionIdentity.clean(plan.session_icon) {
            Text(emoji).font(.system(size: 28))
                .frame(width: 56, height: 56)
                .background(Palette.secondary, in: shape)
                .accessibilityHidden(true)
        } else if let cover = plan.cover_url, !cover.isEmpty, let u = URL(string: cover) {
            CachedAsyncImage(url: u, maxSide: MediaSizing.thumb) {
                $0.resizable().scaledToFill()
            } placeholder: {
                Palette.secondary
            }
            .frame(width: 56, height: 56)
            .clipShape(shape)
            .accessibilityHidden(true)
        } else if plan.isGym {
            let source = (plan.exercises ?? []).compactMap(\.image_url).first { !$0.isEmpty } ?? Self.brandGymPhoto
            CachedAsyncImage(url: URL(string: source), maxSide: 300) {
                $0.resizable().scaledToFill()
            } placeholder: {
                Palette.secondary
            }
            .frame(width: 56, height: 56)
            .clipShape(shape)
            .accessibilityHidden(true)
        } else {
            Image(systemName: "flame").font(.system(size: 22, weight: .medium))
                .foregroundStyle(Palette.gold)
                .frame(width: 56, height: 56)
                .background(Palette.secondary, in: shape)
                .accessibilityHidden(true)
        }
    }

    /// Lo que se abre bajo la fila elegida, dentro de la misma tarjeta: la acción, los ejercicios y
    /// «Nombre e icono» (lo secundario, tranquilo y al final).
    @ViewBuilder private func session(_ plan: DayPlan) -> some View {
        let exercises = plan.exercises ?? []
        VStack(alignment: .leading, spacing: 0) {
            if hasAction(plan) {
                action(plan).padding(.horizontal, 16).padding(.bottom, 8)
            }
            if plan.isGym {
                if exercises.isEmpty {
                    Text("Añade sus ejercicios con «Editar» y empiézala cuando quieras.")
                        .font(.apSubhead).foregroundStyle(Palette.muted)
                        .fixedSize(horizontal: false, vertical: true)
                        .padding(.horizontal, 16).padding(.bottom, 8)
                } else {
                    ForEach(Array(exercises.enumerated()), id: \.offset) { i, ex in
                        exerciseRow(ex, last: i == exercises.count - 1)
                    }
                }
            } else {
                infoRow("lu-flame", "Intensidad", plan.intensity.flatMap { $0.isEmpty ? nil : $0 } ?? "Libre", last: false)
                infoRow("lu-clock", "Duración", planDurations(plan), last: true)
            }
            if onPersonalize != nil {
                Button { Haptics.selection(); personalizing = plan } label: {
                    Label("Nombre e icono", systemImage: "pencil")
                        .font(.apSubhead.weight(.semibold)).foregroundStyle(Palette.muted)
                        .padding(.horizontal, 16).frame(minHeight: 44).contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .frame(maxWidth: .infinity)
                .padding(.top, 4)
                .accessibilityHint("Cambia el nombre y el icono de esta sesión")
            }
        }
        .padding(.bottom, 8)
    }

    /// Ejercicio de la sesión abierta: miniatura (con su clip), nombre, su músculo y el descanso, y «3 × 8».
    private func exerciseRow(_ ex: GymExercise, last: Bool) -> some View {
        Button { detail = ex } label: {
            HStack(spacing: 12) {
                // Miniaturas uniformes (40, como `size="sm"` en la web) y mismo padding en todas las filas.
                ExerciseThumb(url: ex.image_url, size: 40, name: ex.name, muscleGroup: ex.muscle_group, video: ex.video_url)
                VStack(alignment: .leading, spacing: 2) {
                    Text(ex.name).font(.apBody).foregroundStyle(Palette.foreground).lineLimit(2)
                        .fixedSize(horizontal: false, vertical: true)
                    // Su músculo y el descanso con su unidad («90 s», «2 min»), sin partir; el tipo, en la ficha.
                    let rest = ex.rest.trimmingCharacters(in: .whitespaces).isEmpty ? nil
                        : "Descanso\u{00A0}\(PlanEditorValues.restLabel(ex.rest).replacingOccurrences(of: " ", with: "\u{00A0}"))"
                    let info = [ex.muscle_group, rest].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: " · ")
                    if !info.isEmpty {
                        Text(info).font(.apFootnote).foregroundStyle(Palette.muted).lineLimit(2)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                // Ancho propio y números tabulares: la columna queda alineada a la derecha y no se parte nunca.
                Text("\(ex.series)\u{00A0}×\u{00A0}\(ex.reps)").font(.apBody.monospacedDigit())
                    .foregroundStyle(Palette.muted)
                    .lineLimit(1).fixedSize(horizontal: true, vertical: false)
                Image(systemName: "chevron.right").font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Palette.muted.opacity(0.5))
                    .accessibilityHidden(true)
            }
            .padding(.horizontal, 16).padding(.vertical, 8)
            .frame(minHeight: 56)
            .overlay(alignment: .bottom) {
                // 16 + 40 (foto) + 12: el separador empieza donde el texto.
                if !last {
                    Rectangle().fill(Palette.separator).frame(height: 0.5)
                        .padding(.leading, 68).padding(.trailing, 16)
                }
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(SessionRowStyle())
        .contextMenu {
            Button { Haptics.tap(); detail = ex } label: {
                Label("Ficha de técnica", systemImage: "info.circle")
            }
        }
        .accessibilityHint("Abre la ficha de técnica del ejercicio")
    }

    /// Hay acción que enseñar arriba: empezar, continuar, marcar la actividad o el estado «hecho».
    private func hasAction(_ plan: DayPlan) -> Bool {
        !plan.isGym || doneToday.contains(plan.day) || !(plan.exercises ?? []).isEmpty
    }

    /// Acción de la sesión elegida: empezar o continuar el entreno, marcar la actividad o el estado hecho.
    @ViewBuilder private func action(_ plan: DayPlan) -> some View {
        let done = doneToday.contains(plan.day)
        if plan.isGym {
            if done {
                completedLabel("Entrenamiento completado")
            } else {
                Button { Haptics.tap(); onOpen(plan.day) } label: {
                    Label(resumableDay == plan.day ? "Continuar entreno" : "Empezar sesión", systemImage: "play.fill")
                }
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

    /// Duración del plan; si el campo viene vacío, se estima por series y descansos (o «Libre», como la web).
    private func planDurations(_ plan: DayPlan) -> String {
        if let d = plan.duration?.trimmingCharacters(in: .whitespaces), !d.isEmpty { return d }
        guard let minutes = plan.estimatedMinutes else { return "Libre" }
        return "≈\u{00A0}\(minutes)\u{00A0}min"
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

    /// Plan sin sesiones: tarjeta vacía con su icono, el siguiente paso y «Editar plan».
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
            if let onEditPlan {
                Button("Editar plan") { Haptics.tap(); onEditPlan() }
                    .buttonStyle(PillButtonStyle(kind: .secondary, height: 44))
                    .fixedSize()
                    .padding(.top, 20)
            }
        }
        .padding(.horizontal, 20).padding(.vertical, 24)
        .frame(maxWidth: .infinity, minHeight: 260)
        .surface(Radius.hero)
    }

}

/// Fila de una lista dentro de una tarjeta: al pulsarla se ilumina con `Palette.accent` (como
/// `active:bg-accent` en la web), sin hundirse.
private struct SessionRowStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .background(configuration.isPressed ? Palette.accent : Color.clear)
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
                                Image(platformImage: img).resizable().scaledToFill().frame(width: 48, height: 48).clipShape(RoundedRectangle(cornerRadius: Radius.chip))
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
        let shape = RoundedRectangle(cornerRadius: Radius.chip, style: .continuous)
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
