import SwiftUI
import Supabase

/// Entrenar: la rutina semanal con las fotos de cada ejercicio y el descanso del día que toque.
/// El detalle de la sesión de hoy vive en Inicio; aquí solo el plan de la semana.
struct TrainView: View {
    @EnvironmentObject private var session: SessionModel
    @Environment(\.horizontalSizeClass) private var sizeClass
    @StateObject private var model = PlanModel()
    @State private var active: ActiveWorkout?
    @State private var starting = false
    /// Día con un entreno a medias guardado (su acción pasa a ser «Continuar entreno»).
    @State private var resumableDay: String?
    @State private var editing = false
    @State private var library = false

    /// Paridad con la web responsive: la misma pantalla en todas partes, con más aire y una
    /// portada de sesión a todo el ancho en iPad/Mac. El iPhone se queda exactamente igual.
    private var wideLayout: Bool {
        #if os(macOS)
        return true
        #else
        return sizeClass == .regular
        #endif
    }

    /// Márgenes laterales como `p-4 md:p-8 lg:p-10` de la web. En Mac el padding lo pone
    /// `RootView` (como el `<main>` de la web), así que aquí es 0 para no duplicarlo.
    private var pagePadding: CGFloat {
        #if os(macOS)
        return 0
        #else
        return wideLayout ? 32 : 16
        #endif
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                if model.loading && model.days.isEmpty {
                    VStack(spacing: 12) {
                        BrandLoader()
                        Text("Cargando tu semana…").font(.apSubhead).foregroundStyle(Palette.muted)
                    }
                    .frame(maxWidth: .infinity, minHeight: 300)
                } else if let error = model.error, model.days.isEmpty {
                    EmptyStateView(symbol: "dumbbell", title: error,
                                   message: "Desliza hacia abajo para volver a intentarlo.")
                } else if model.days.isEmpty {
                    // Sin rutina: la misma invitación que Inicio y la web, con su botón.
                    StarterRoutineCard { await load() }
                } else {
                    routineBar
                    WeeklyRoutineView(days: model.days,
                                      initialDay: DayNames.today,
                                      doneToday: model.completedToday(DayNames.today),
                                      resumableDay: resumableDay) { day in
                        Task { await open(day) }
                    }
                }
            }
            // Sin tope de ancho: la pantalla aprovecha toda la ventana, como la web en `lg:`.
            .padding(.horizontal, pagePadding)
            .padding(.top, wideLayout ? 32 : 8)
            .padding(.bottom, wideLayout ? 32 : 16)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .screenBackground()
        .refreshable { await load() }
        .task {
            await load()
            #if DEBUG
            // QA: `-resumeDraft` reanuda el entreno a medias al abrir Entrenar.
            if ProcessInfo.processInfo.arguments.contains("-resumeDraft"), active == nil,
               let idString = session.userIdString, let draft = ActiveWorkout.restore(userId: idString) {
                await open(draft.day.day)
            }
            #endif
        }
        .onReceive(NotificationCenter.default.publisher(for: .refreshSection)) { _ in Task { await load() } }
        .onReceive(NotificationCenter.default.publisher(for: .startTodayWorkout)) { _ in Task { await openToday() } }
        .sheet(isPresented: $editing) {
            PlanEditorView(original: model.days) { saved in model.days = saved }
                .presentationBackground(Palette.background)
        }
        .sheet(isPresented: $library) {
            ExerciseLibraryView(userId: session.userId)
                .presentationBackground(Palette.background)
                #if os(macOS)
                .frame(minWidth: 680, minHeight: 720)
                #endif
        }
        #if os(iOS)
        .fullScreenCover(item: $active) { workout in workoutStack(workout) }
        #else
        .sheet(item: $active) { workout in workoutStack(workout).frame(minWidth: 820, minHeight: 720) }
        #endif
    }

    private func workoutStack(_ workout: ActiveWorkout) -> some View {
        NavigationStack {
            WorkoutView(workout: workout, userId: session.userId ?? UUID()) { finished in
                active = nil
                if finished { Task { await load() } }
            }
        }
    }

    // MARK: Cargar y abrir la sesión de la rutina

    /// Barra de la rutina (como la web): modo del plan, «Ejercicios» (biblioteca) y «Editar» para crear o cambiar tu rutina.
    private var routineBar: some View {
        HStack(spacing: 8) {
            Text(model.days.contains { $0.custom == true } ? "Rutina personalizada" : "Piloto automático")
                .font(.apSubhead.weight(.medium)).frame(maxWidth: .infinity, alignment: .leading)
            Button { Haptics.tap(); library = true } label: {
                Label("Ejercicios", image: "lu-book-open")
                    #if os(iOS)
                    .labelStyle(.iconOnly).frame(width: 36)
                    #else
                    .labelStyle(.titleOnly).padding(.horizontal, 14)
                    #endif
                    .font(.apFootnote.weight(.semibold)).foregroundStyle(Palette.gold)
                    .frame(height: 36)
                    .background(Palette.secondary, in: Capsule())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Ejercicios")
            Button { Haptics.tap(); editing = true } label: {
                Label("Editar", image: "lu-settings").labelStyle(.titleOnly)
                    .font(.apFootnote.weight(.semibold)).foregroundStyle(Palette.gold)
                    .padding(.horizontal, 14).frame(height: 36)
                    .background(Palette.secondary, in: Capsule())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Editar rutina")
        }
        .padding(.leading, 16).padding(.trailing, 8).padding(.vertical, 8)
        .background(Palette.card, in: RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
    }

    private func load() async {
        await model.load(userId: session.userId)
        // Entreno a medias guardado: la rutina lo ofrece como «Continuar entreno».
        resumableDay = session.userIdString.flatMap { ActiveWorkout.restore(userId: $0)?.day.day }
        // Calienta las fotos de la semana: al entrar en la rutina ya están listas.
        let urls = model.days.flatMap { ($0.exercises ?? []).compactMap(\.image_url) }.compactMap(URL.init(string:))
        ImageCache.shared.prefetch(urls, maxSide: 140)
    }

    /// Abre el día elegido en la rutina: reanuda el entreno a medias, empieza uno nuevo
    /// o, si es una actividad, la marca como hecha hoy.
    private func open(_ day: String) async {
        guard let plan = model.days.first(where: { $0.day == day }) else { return }

        // Un borrador guardado se reanuda SIEMPRE, antes de cualquier otro guard: es un entreno
        // en curso. Antes podía quedar bloqueado por «ya completado» o por `starting` colgado.
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

    /// Aviso «Empezar entreno de hoy» (menú del Mac): abre la sesión de hoy si toca.
    private func openToday() async {
        guard active == nil else { return }
        // Si hay un borrador de hoy, se reanuda aunque el plan aún no haya cargado.
        if let idString = session.userIdString,
           let draft = ActiveWorkout.restore(userId: idString), draft.day.day == DayNames.today {
            Haptics.tap()
            starting = false
            active = ActiveWorkout(draft: draft)
            return
        }
        if model.days.isEmpty { await load() }
        guard let day = model.days.first(where: { $0.day == DayNames.today }), day.isGym,
              !model.completedToday(day.day) else { return }
        await open(day.day)
    }

    private func start(_ day: DayPlan, focus: Int = 0) async {
        guard let id = session.userId, let idString = session.userIdString else { return }
        Haptics.tap()
        starting = true
        defer { starting = false }
        let previous = await TrainingRepo.previousSets(userId: id, exercises: (day.exercises ?? []).map(\.name))
        let workout = ActiveWorkout(userId: idString, day: day, previous: previous)
        workout.previous = previous
        workout.previousRpe = await TrainingRepo.previousRpe(userId: id, exercises: (day.exercises ?? []).map(\.name))
        struct Pref: Decodable { let original_exercise_name: String; let preferred_exercise_name: String? }
        let prefs: [Pref] = (try? await Backend.client.from("exercise_user_preferences").select("original_exercise_name, preferred_exercise_name")
            .eq("user_id", value: id).execute().value) ?? []
        for p in prefs { if let r = p.preferred_exercise_name, (day.exercises ?? []).contains(where: { $0.name == p.original_exercise_name }) { workout.swaps[p.original_exercise_name] = r } }
        workout.draft.currentExercise = focus
        workout.openExercises = [focus]
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
            ExerciseThumb(url: exercise.image_url, completed: done)
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

/// Miniatura única de ejercicio (como `ExerciseThumb` en la web).
struct ExerciseThumb: View {
    let url: String?
    var completed = false
    var size: CGFloat = 52

    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 12, style: .continuous).fill(Palette.secondary)
            if let url, let u = URL(string: url) {
                CachedAsyncImage(url: u, maxSide: max(140, size * 2)) { $0.resizable().scaledToFill() } placeholder: { Color.clear }
            } else {
                Image(systemName: "dumbbell").foregroundStyle(Palette.muted)
            }
            if completed {
                Color.black.opacity(0.5)
                Image(systemName: "checkmark").font(.inter(.headline).weight(.bold)).foregroundStyle(Palette.gold)
            }
        }
        .frame(width: size, height: size)
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        .accessibilityHidden(true)
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

    func load(userId: UUID?) async {
        guard let userId else { return }
        loading = true
        defer { loading = false }
        do {
            days = try await TrainingRepo.plan(userId: userId)
            completions = await TrainingRepo.completions(userId: userId, since: LocalDate.daysAgo(6))
            error = nil
        } catch {
            self.error = "No se pudo cargar el plan."
        }
    }

    func completedToday(_ day: String) -> Bool {
        completions.contains { $0.day == day && $0.date == LocalDate.string() }
    }
}


/// `TrainingPlanView` de la web, igual en iPhone, iPad y Mac: la tira compacta de 7 días arriba y
/// debajo la sesión elegida (o su descanso). En iPad/Mac la portada de la sesión va a todo el
/// ancho, que es lo que hace la web de escritorio.
struct WeeklyRoutineView: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.horizontalSizeClass) private var sizeClass
    let days: [DayPlan]
    let initialDay: String
    /// El entreno de hoy ya está hecho: su acción pasa a ser «completado».
    var doneToday = false
    /// Día con un entreno a medias: su acción pasa a ser «Continuar entreno».
    var resumableDay: String? = nil
    var onOpen: (String) -> Void
    @State private var expanded: String?
    @State private var detail: GymExercise?
    @State private var copied = false

    /// En iPad/Mac hay ancho para la portada de la sesión; el iPhone mantiene su diseño actual.
    private var wideLayout: Bool {
        #if os(macOS)
        return true
        #else
        return sizeClass == .regular
        #endif
    }

    private func workPlan(_ day: String) -> DayPlan? {
        guard let p = days.first(where: { $0.day == day }), p.type == "gimnasio" || p.type == "actividad" else { return nil }
        return p
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 24) {
            dayStrip
            if let day = expanded, let plan = workPlan(day) { session(day, plan) }
            else if let day = expanded { rest(day) }
            else { emptyCard(icon: "lu-calendar", title: "Elige un día", message: "Toca un día de la semana para ver su sesión.") }
            tools
            (Text("Análisis asistido por IA · tu plan se adapta a ti · ") + Text("[no sustituye consejo médico](https://autopilotplan.app/legal/disclaimer-medico)"))
                .tint(Palette.gold)
                .font(.apFootnote).foregroundStyle(Palette.muted).multilineTextAlignment(.center)
                .frame(maxWidth: .infinity).padding(.horizontal, 16)
        }
        .onAppear { if expanded == nil { expanded = workPlan(initialDay) != nil ? initialDay : DayNames.today } }
        .sheet(item: $detail) { TechniqueSheet(exercise: $0).presentationBackground(Palette.card) }
    }

    /// Tira de días con una sola selección visible: el día elegido va en píldora dorada y texto
    /// negro; el día de hoy, si no está elegido, solo se insinúa con un punto dorado. Así HOY y
    /// SELECCIONADO nunca compiten ni se confunden.
    private var dayStrip: some View {
        // Mismos círculos en las tres plataformas; en escritorio crecen a 48 como `lg:h-12` de la web.
        dayStrip(circle: wideLayout ? 48 : 44)
    }

    private func dayStrip(circle: CGFloat) -> some View {
        HStack(spacing: 4) {
            ForEach(DayNames.all, id: \.self) { day in
                let plan = workPlan(day)
                let isToday = day == DayNames.today
                let isExpanded = expanded == day
                // Los 7 días se pueden tocar: los que no tienen sesión muestran su descanso.
                Button {
                    Haptics.selection()
                    withAnimation(reduceMotion ? nil : .snappy) { expanded = day }
                } label: {
                    VStack(spacing: 3) {
                        Text(String(day.prefix(3))).font(.apSubhead.weight(isExpanded ? .semibold : .medium))
                            .lineLimit(1).minimumScaleFactor(0.6)
                        // El punto ocupa su hueco siempre: las iniciales de los 7 días comparten
                        // línea base, haya punto o no.
                        Circle()
                            .fill(isToday ? (isExpanded ? Color.black : Palette.gold) : Color.clear)
                            .frame(width: 4, height: 4)
                    }
                    .foregroundStyle(isExpanded ? Color.black
                                     : (isToday || plan != nil) ? Palette.foreground : Palette.muted)
                    .frame(width: circle, height: circle)
                    .background {
                        if isExpanded { Circle().fill(Palette.gold) }
                        else if plan != nil { Circle().fill(Palette.secondary) }
                    }
                    .contentShape(Circle())
                }
                .buttonStyle(.plain)
                .frame(maxWidth: .infinity)
                .accessibilityLabel("\(day)\(isToday ? ", hoy" : ""), \(plan.map { "sesión: \($0.title)" } ?? "descanso")")
                .accessibilityAddTraits(isExpanded ? .isSelected : [])
                .accessibilityValue(isToday ? "hoy" : "")
            }
        }
        .padding(6)
        .background(Palette.card, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        // Control compacto de 7 columnas fijas: se limita el crecimiento del texto para que las
        // iniciales nunca se trunquen con Dynamic Type. El nombre completo del día lo lee VoiceOver.
        .dynamicTypeSize(...DynamicTypeSize.accessibility1)
        .accessibilityElement(children: .contain)
        .sensoryFeedback(.selection, trigger: expanded)
    }

    @ViewBuilder private func session(_ day: String, _ plan: DayPlan) -> some View {
        let exercises = plan.exercises ?? []
        let sets = exercises.reduce(0) { $0 + $1.series }
        let summary = exercises.isEmpty ? nil : ["\(exercises.count) \(exercises.count == 1 ? "ejercicio" : "ejercicios")", sets > 0 ? "\(sets) \(sets == 1 ? "serie" : "series")" : nil].compactMap { $0 }.joined(separator: " · ")
        VStack(alignment: .leading, spacing: 24) {
            // Portada de la sesión (`h-44` ≈ 176 pt) a todo el ancho, en iPhone y Mac como en la web.
            if plan.isGym {
                sessionCover(plan)
            }
            VStack(alignment: .leading, spacing: 4) {
                Text(day == DayNames.today ? "\(day) · hoy" : day).font(.apSubhead).foregroundStyle(Palette.muted)
                Text(plan.title).font(.apTitle1)
                if plan.isGym, let summary { Text(summary).font(.apSubhead).foregroundStyle(Palette.muted).padding(.top, 2) }
            }
            action(day, plan)
            if plan.isGym {
                if !exercises.isEmpty {
                    VStack(spacing: 0) {
                        ForEach(Array(exercises.enumerated()), id: \.offset) { i, ex in
                            Button { detail = ex } label: {
                                HStack(spacing: 12) {
                                    // Miniaturas uniformes (44) y mismo padding en todas las filas.
                                    ExerciseThumb(url: ex.image_url, size: 44)
                                    VStack(alignment: .leading, spacing: 3) {
                                        Text(ex.name).font(.apHeadline).lineLimit(2)
                                            .fixedSize(horizontal: false, vertical: true)
                                        let info = [ex.rest, ex.muscle_group].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: " · ")
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
                    .background(Palette.card, in: RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
                    .clipShape(RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
                }
            } else {
                VStack(spacing: 0) {
                    infoRow("lu-flame", "Intensidad", plan.intensity ?? "", last: false)
                    infoRow("lu-clock", "Duración", planDurations(plan), last: true)
                }
                .background(Palette.card, in: RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
            }
        }
    }

    /// Acción del día elegido: empezar o continuar el entreno, marcar la actividad o el estado hecho.
    @ViewBuilder private func action(_ day: String, _ plan: DayPlan) -> some View {
        let exercises = plan.exercises ?? []
        let done = day == DayNames.today && doneToday
        if plan.isGym {
            if done {
                completedLabel("Entrenamiento completado")
            } else if exercises.isEmpty {
                Text("Este día no tiene ejercicios asignados todavía.")
                    .font(.apSubhead).foregroundStyle(Palette.muted)
            } else {
                Button(resumableDay == day ? "Continuar entreno" : "Empezar entrenamiento") { Haptics.tap(); onOpen(day) }
                    .buttonStyle(.pill)
            }
        } else if done {
            completedLabel("Actividad completada")
        } else {
            Button("Marcar actividad como hecha") { Haptics.tap(); onOpen(day) }.buttonStyle(.pill)
        }
    }

    /// Estado «hecho» del día: misma forma y alto que la píldora de acción, en verde y sin acción.
    private func completedLabel(_ title: String) -> some View {
        Label(title, systemImage: "checkmark.circle.fill")
            .font(.apHeadline).foregroundStyle(Palette.success)
            .frame(maxWidth: .infinity, minHeight: 50)
            .background(Palette.success.opacity(0.14), in: Capsule())
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

    /// Descanso del día elegido: luna, eyebrow, título, subtexto y acción en el mismo eje, con el
    /// radio hero y la misma altura reservada que la tarjeta de descanso de Inicio.
    /// Día de descanso con la misma tarjeta de la luna que Inicio (`RestCard`).
    @ViewBuilder private func rest(_ day: String) -> some View {
        let i = DayNames.all.firstIndex(of: day) ?? 0
        let nextDay = (1...7).map { DayNames.all[(i + $0) % 7] }.first { workPlan($0) != nil }
        let message = nextDay.flatMap { d in workPlan(d).map { "Tu próxima sesión es el \(d.lowercased()): \($0.title)." } }
            ?? "Recupera; toca otro día para ver su sesión."
        RestCard(title: day == DayNames.today ? "Hoy es día de descanso" : "El \(day.lowercased()) es día de descanso", message: message) {
            if let nextDay {
                Button("Ver el \(nextDay.lowercased())") { Haptics.selection(); expanded = nextDay }
                    .buttonStyle(.pillSecondary)
            }
        }
    }

    /// Fondo elegante cuando la sesión aún no tiene foto: degradado de tarjeta y halo dorado.
    /// Se usa de respaldo en la portada del descanso y en la de la sesión.
    private var coverBackdrop: some View {
        LinearGradient(colors: [Palette.secondary, Palette.card], startPoint: .topLeading, endPoint: .bottomTrailing)
            .overlay(alignment: .topTrailing) {
                Circle()
                    .fill(RadialGradient(colors: [Palette.gold.opacity(0.20), .clear], center: .center, startRadius: 0, endRadius: 150))
                    .frame(width: 300, height: 300)
                    .offset(x: 90, y: -120)
            }
    }

    /// Portada de la sesión a todo el ancho, como `TrainingPlanView.tsx` (`h-44` + radio 28):
    /// la primera foto de sus ejercicios o, si no tiene, la foto de marca del gimnasio.
    private func sessionCover(_ plan: DayPlan) -> some View {
        let exercises = plan.exercises ?? []
        let source = exercises.compactMap(\.image_url).first { !$0.isEmpty } ?? Self.brandGymPhoto
        return CachedAsyncImage(url: URL(string: source), maxSide: 1200) {
            $0.resizable().scaledToFill()
        } placeholder: {
            coverBackdrop
        }
        .frame(maxWidth: .infinity)
        .frame(height: 176)
        .clipped()
        .overlay {
            // Degradado inferior (`from-black/60` en la web): la foto nunca compite con el texto.
            LinearGradient(stops: [
                .init(color: .clear, location: 0.35),
                .init(color: .black.opacity(0.30), location: 0.72),
                .init(color: .black.opacity(0.60), location: 1),
            ], startPoint: .top, endPoint: .bottom)
        }
        .clipShape(RoundedRectangle(cornerRadius: Radius.hero, style: .continuous))
        .accessibilityHidden(true)
    }

    /// Foto de marca de la web (`BRAND_PHOTOS.gym`): respaldo de la portada cuando la sesión no
    /// tiene ninguna foto de ejercicio, igual que `TrainingPlanView.tsx`.
    private static let brandGymPhoto = "https://enebrcdrdnfkyduzyrzm.supabase.co/storage/v1/object/public/site-assets/exercise-images/a31c7206-d2a4-4b31-856a-f5dec09b890e-1791475829849.png"

    /// Estado sin día elegido: misma tarjeta, mismo radio y misma altura que el descanso, para que
    /// pasar de un día a otro no cambie el tamaño del bloque.
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
        .background(Palette.card, in: RoundedRectangle(cornerRadius: Radius.hero, style: .continuous))
    }

    private var tools: some View {
        VStack(spacing: 0) {
            Button { copy() } label: { toolRow(copied ? "lu-check" : "lu-copy", copied ? "Plan copiado" : "Copiar plan", last: false) }.buttonStyle(.plain)
            ShareLink(item: PlanText.file(days)) { toolRow("lu-download", "Descargar plan", last: true) }.buttonStyle(.plain)
        }
        .background(Palette.card, in: RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
    }

    private func toolRow(_ icon: String, _ label: String, last: Bool) -> some View {
        HStack(spacing: 12) {
            Image(icon).renderingMode(.template).resizable().frame(width: 20, height: 20)
                .foregroundStyle(Palette.muted).frame(width: 28)
            Text(label).font(.apBody).foregroundStyle(Palette.foreground)
                .frame(maxWidth: .infinity, minHeight: 48, alignment: .leading)
        }
        .padding(.horizontal, 16)
        .overlay(alignment: .bottom) {
            if !last {
                Rectangle().fill(Palette.separator).frame(height: 0.5)
                    .padding(.leading, 56).padding(.trailing, 16)
            }
        }
        .contentShape(Rectangle())
    }

    private func copy() {
        Haptics.tap()
        #if os(iOS)
        UIPasteboard.general.string = PlanText.text(days)
        #else
        NSPasteboard.general.clearContents(); NSPasteboard.general.setString(PlanText.text(days), forType: .string)
        #endif
        copied = true
        Task { try? await Task.sleep(for: .seconds(2)); copied = false }
    }
}

/// Texto del plan como `planToText` de la web (copiar y descargar).
enum PlanText {
    static func text(_ days: [DayPlan]) -> String {
        var t = "MI PLAN DE ENTRENAMIENTO\n" + String(repeating: "═", count: 40) + "\n\n"
        for d in days {
            t += "📅 \(d.day.uppercased())"
            if d.isGym {
                t += " — \(d.routine_name ?? "Gimnasio")\n   Músculos: \(d.muscle_focus ?? "")\n\n"
                for e in d.exercises ?? [] { t += "   • \(e.name)\n     \(e.series) series × \(e.reps) reps | Descanso: \(e.rest)\n" }
            } else {
                t += " — \(d.sport ?? "Actividad")\n   Intensidad: \(d.intensity ?? "") | Duración: \(d.duration ?? "")\n"
            }
            t += "\n" + String(repeating: "─", count: 40) + "\n\n"
        }
        return t
    }
    static func file(_ days: [DayPlan]) -> URL {
        let u = FileManager.default.temporaryDirectory.appendingPathComponent("mi-plan-entrenamiento.txt")
        try? text(days).write(to: u, atomically: true, encoding: .utf8)
        return u
    }

}
