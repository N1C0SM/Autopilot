import SwiftUI
import Supabase

/// Entrenar, calcado de `WorkoutTracker.tsx` (antes de empezar): selector de días,
/// portada, título, «N ejercicios · M series», «Empezar entrenamiento» y la lista «Ejercicios».
struct TrainView: View {
    @EnvironmentObject private var session: SessionModel
    @StateObject private var model = PlanModel()
    @State private var active: ActiveWorkout?
    @State private var selectedDay: String = DayNames.today
    @State private var starting = false
    @State private var tab = 0

    private var currentPlan: DayPlan? {
        guard let plan = model.days.first(where: { $0.day == selectedDay }) else { return nil }
        return plan.isGym || plan.type == "actividad" ? plan : nil
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                if model.loading && model.days.isEmpty {
                    VStack(spacing: 12) {
                        ProgressView()
                        Text("Comprobando tu sesión…").font(.apSubhead).foregroundStyle(Palette.muted)
                    }
                    .frame(maxWidth: .infinity, minHeight: 300)
                } else {
                    SegmentedPill(options: ["Entrenar", "Rutina semanal"], selection: $tab)
                    if tab == 1 { weeklyRoutine } else {
                    if !model.days.isEmpty { dayPicker }
                    if let plan = currentPlan {
                        if plan.isGym { gymSummary(plan) } else { activityDay(plan) }
                    } else {
                        restDay
                    }
                    }
                }
            }
            .padding(.horizontal, 16).padding(.top, 8).padding(.bottom, 16)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .screenBackground()
        .refreshable { await model.load(userId: session.userId) }
        .task { await model.load(userId: session.userId) }
        .onReceive(NotificationCenter.default.publisher(for: .refreshSection)) { _ in Task { await model.load(userId: session.userId) } }
        .onReceive(NotificationCenter.default.publisher(for: .startTodayWorkout)) { _ in
            if active == nil, let day = model.days.first(where: { $0.day == DayNames.today }), day.isGym { Task { await start(day) } }
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
                if finished { Task { await model.load(userId: session.userId) } }
            }
        }
    }

    // MARK: Selector de día (tarjeta con 7 días; activo en dorado, hoy con texto dorado, punto si hay sesión)

    private var dayPicker: some View {
        HStack(spacing: 4) {
            ForEach(DayNames.all, id: \.self) { day in
                let plan = model.days.first { $0.day == day }
                let hasWork = plan?.isGym == true || plan?.type == "actividad"
                let isActive = day == selectedDay
                let isToday = day == DayNames.today
                Button {
                    guard day != selectedDay else { return }
                    Haptics.selection()
                    selectedDay = day
                } label: {
                    VStack(spacing: 4) {
                        Text(String(day.prefix(3))).font(.apFootnote.weight(isActive || isToday ? .semibold : .regular))
                        Circle()
                            .fill(hasWork ? (isActive ? Color.black : Palette.gold) : Color.clear)
                            .frame(width: 5, height: 5)
                    }
                    .frame(maxWidth: .infinity, minHeight: 50)
                    .foregroundStyle(isActive ? Color.black : (isToday ? Palette.gold : Palette.muted))
                    .background(isActive ? Palette.gold : Color.clear, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel(day + (hasWork ? "" : " · descanso") + (isToday ? " · hoy" : ""))
                .accessibilityAddTraits(isActive ? .isSelected : [])
            }
        }
        .padding(6)
        .background(Palette.card, in: RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
    }

    // MARK: Día de gimnasio

    private func gymSummary(_ plan: DayPlan) -> some View {
        let exercises = plan.exercises ?? []
        let totalSets = exercises.reduce(0) { $0 + max($1.series, 1) }
        let parts = (plan.routine_name ?? plan.muscle_focus ?? selectedDay).components(separatedBy: " · ")
        let completed = model.completedToday(plan.day)
        return VStack(alignment: .leading, spacing: 16) {
            VStack(alignment: .leading, spacing: 2) {
                if let cover = exercises.first?.image_url, let url = URL(string: cover) {
                    CachedAsyncImage(url: url) { $0.resizable().scaledToFill() } placeholder: { Palette.card }
                        .frame(maxWidth: .infinity).frame(height: 192)
                        .overlay(LinearGradient(colors: [.black.opacity(0.7), .clear], startPoint: .bottom, endPoint: .center))
                        .clipShape(RoundedRectangle(cornerRadius: Radius.hero, style: .continuous))
                        .padding(.bottom, 14)
                        .accessibilityHidden(true)
                }
                Text(parts.first ?? "").font(.system(size: 32, weight: .bold)).lineLimit(1)
                    .accessibilityAddTraits(.isHeader)
                if parts.count > 1 {
                    Text(parts.dropFirst().joined(separator: " · ")).font(.apSubhead).foregroundStyle(Palette.muted).lineLimit(1)
                }
                if !exercises.isEmpty {
                    Text("\(exercises.count) ejercicios · \(totalSets) series").font(.apFootnote.monospacedDigit())
                        .foregroundStyle(Palette.muted).padding(.top, 4)
                }
                if selectedDay != DayNames.today {
                    Text("Se registra hoy · \(Date().formatted(.dateTime.weekday(.wide).day().month(.wide).locale(Locale(identifier: "es_ES"))))")
                        .font(.apFootnote).foregroundStyle(Palette.muted).padding(.top, 4)
                }
                if completed {
                    Label("Entrenamiento completado", systemImage: "checkmark.circle.fill").font(.apHeadline)
                        .foregroundStyle(Palette.gold).padding(.top, 20)
                } else if exercises.isEmpty {
                    Text("Este día no tiene ejercicios asignados todavía.").font(.apSubhead).foregroundStyle(Palette.muted).padding(.top, 16)
                } else {
                    // Una sola acción dorada: si hay un entreno a medias de este día, la misma cápsula lo reanuda.
                    let resumable = ActiveWorkout.restore(userId: session.userIdString ?? "").flatMap { $0.day.day == plan.day ? $0 : nil }
                    Button {
                        if let r = resumable { Haptics.tap(); active = ActiveWorkout(draft: r) } else { Task { await start(plan) } }
                    } label: {
                        if starting { ProgressView().tint(.black) }
                        else { Label(resumable == nil ? "Empezar entrenamiento" : "Continuar entreno", systemImage: "play.fill") }
                    }
                    .buttonStyle(PillButtonStyle(kind: .primary, height: 56))
                    .disabled(starting)
                    .padding(.top, 24)
                }
            }

            if !exercises.isEmpty {
                VStack(alignment: .leading, spacing: 6) {
                    Text("Ejercicios").font(.apFootnote).textCase(.uppercase).foregroundStyle(Palette.muted).padding(.horizontal, 16)
                    VStack(spacing: 0) {
                        ForEach(Array(exercises.enumerated()), id: \.element.id) { i, ex in
                            Button { Task { await start(plan, focus: i) } } label: {
                                ExerciseListRow(exercise: ex, separator: i > 0, done: false)
                            }
                            .buttonStyle(.plain)
                            .disabled(completed || starting)
                        }
                    }
                    .background(Palette.card, in: RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
                    .clipShape(RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
                }
            }
        }
    }

    // MARK: Actividad y descanso

    private func activityDay(_ plan: DayPlan) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(plan.sport ?? "Actividad").font(.apTitle2).padding(.horizontal, 16)
            VStack(spacing: 0) {
                infoRow("flame", "Intensidad", plan.intensity)
                Divider().overlay(Palette.separator).padding(.leading, 52)
                infoRow("clock", "Duración", plan.duration)
            }
            .background(Palette.card, in: RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
            Button(model.completedToday(plan.day) ? "Actividad completada" : "Marcar actividad como hecha") {
                Task {
                    guard let id = session.userId else { return }
                    try? await TrainingRepo.complete(userId: id, day: plan.day, date: LocalDate.string(), rpe: nil)
                    Haptics.success()
                    await model.load(userId: id)
                }
            }
            .buttonStyle(.pill)
            .disabled(model.completedToday(plan.day))
        }
    }

    private func infoRow(_ symbol: String, _ title: String, _ value: String?) -> some View {
        HStack(spacing: 12) {
            Image(systemName: symbol).foregroundStyle(Palette.gold).frame(width: 24).accessibilityHidden(true)
            Text(title).font(.apBody)
            Spacer()
            Text(value ?? "—").font(.apBody).foregroundStyle(Palette.muted)
        }
        .padding(.horizontal, 16).frame(minHeight: 50)
        .accessibilityElement(children: .combine)
    }

    private var restDay: some View {
        RestCard(title: "Día de descanso", message: "Recupera, o elige otra sesión de tu semana") {
            FlowRow {
                ForEach(model.days.filter { $0.type == "actividad" || !($0.exercises ?? []).isEmpty }) { p in
                    Button(p.day) { Haptics.selection(); selectedDay = p.day }
                        .font(.apSubhead.weight(.medium))
                        .padding(.horizontal, 16).frame(minHeight: 44)
                        .background(Color.white.opacity(0.1), in: Capsule())
                        .buttonStyle(.plain)
                }
            }
        }
    }

    /// «Rutina semanal», calcada de `TrainingPlanView.tsx`.
    private var weeklyRoutine: some View {
        WeeklyRoutineView(days: model.days, initialDay: selectedDay) { day in
            selectedDay = day; tab = 0
        }
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
                CachedAsyncImage(url: u) { $0.resizable().scaledToFill() } placeholder: { Color.clear }
            } else {
                Image(systemName: "dumbbell").foregroundStyle(Palette.muted)
            }
            if completed {
                Color.black.opacity(0.5)
                Image(systemName: "checkmark").font(.headline.weight(.bold)).foregroundStyle(Palette.gold)
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


/// `TrainingPlanView` de la web: tira de días, la sesión elegida con su lista y las herramientas del plan.
struct WeeklyRoutineView: View {
    let days: [DayPlan]
    let initialDay: String
    var onOpen: (String) -> Void
    @State private var expanded: String?
    @State private var detail: GymExercise?
    @State private var copied = false

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

    private var dayStrip: some View {
        HStack(spacing: 4) {
            ForEach(DayNames.all, id: \.self) { day in
                let plan = workPlan(day)
                let isToday = day == DayNames.today
                let isExpanded = expanded == day
                Button {
                    Haptics.selection()
                    withAnimation(.snappy) { expanded = isExpanded ? nil : day }
                } label: {
                    Text(String(day.prefix(3))).font(.apSubhead.weight(.semibold))
                        .foregroundStyle(isExpanded || isToday ? Palette.gold : plan != nil ? Palette.foreground : Palette.muted.opacity(0.6))
                        .frame(width: 44, height: 44)
                        .background(Circle().fill(isExpanded ? Palette.gold.opacity(0.15) : (isToday || plan != nil) ? Palette.secondary : .clear))
                }
                .buttonStyle(.plain)
                .disabled(plan == nil)
                .frame(maxWidth: .infinity)
                .accessibilityLabel("\(day), \(plan?.title ?? "descanso")\(isToday ? ", hoy" : "")")
            }
        }
        .padding(6)
        .background(Palette.card, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
    }

    @ViewBuilder private func session(_ day: String, _ plan: DayPlan) -> some View {
        let exercises = plan.exercises ?? []
        let sets = exercises.reduce(0) { $0 + $1.series }
        let summary = exercises.isEmpty ? nil : ["\(exercises.count) \(exercises.count == 1 ? "ejercicio" : "ejercicios")", sets > 0 ? "\(sets) \(sets == 1 ? "serie" : "series")" : nil].compactMap { $0 }.joined(separator: " · ")
        VStack(alignment: .leading, spacing: 24) {
            VStack(alignment: .leading, spacing: 4) {
                Text(day == DayNames.today ? "\(day) · hoy" : day).font(.apSubhead).foregroundStyle(Palette.muted)
                Text(plan.title).font(.apTitle1)
                if plan.isGym, let summary { Text(summary).font(.apSubhead).foregroundStyle(Palette.muted).padding(.top, 2) }
            }
            if !plan.isGym || !exercises.isEmpty {
                Button("Abrir \(plan.isGym ? "sesión" : "actividad") del \(day.lowercased())") { Haptics.tap(); onOpen(day) }.buttonStyle(.pill)
            }
            if plan.isGym {
                if !exercises.isEmpty {
                    VStack(spacing: 0) {
                        ForEach(Array(exercises.enumerated()), id: \.offset) { i, ex in
                            Button { detail = ex } label: {
                                HStack(spacing: 12) {
                                    ExerciseThumb(url: ex.image_url, size: 44)
                                    HStack(spacing: 8) {
                                        VStack(alignment: .leading, spacing: 2) {
                                            Text(ex.name).font(.apBody).lineLimit(2)
                                            let info = [ex.rest, ex.muscle_group].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: " · ")
                                            if !info.isEmpty { Text(info).font(.apSubhead).foregroundStyle(Palette.muted).lineLimit(1) }
                                        }
                                        .frame(maxWidth: .infinity, alignment: .leading)
                                        Text("\(ex.series) × \(ex.reps)").font(.apBody.monospacedDigit()).foregroundStyle(Palette.muted)
                                        Image("lu-chevron-left").renderingMode(.template).resizable().frame(width: 16, height: 16)
                                            .rotationEffect(.degrees(180)).foregroundStyle(Palette.muted.opacity(0.6))
                                    }
                                    .padding(.vertical, 10).padding(.trailing, 16)
                                    .overlay(alignment: .bottom) { if i < exercises.count - 1 { Rectangle().fill(Palette.separator).frame(height: 0.5) } }
                                }
                                .padding(.leading, 16).frame(minHeight: 44).contentShape(Rectangle())
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .background(Palette.card, in: RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
                }
            } else {
                VStack(spacing: 0) {
                    infoRow("lu-flame", "Intensidad", plan.intensity ?? "", last: false)
                    infoRow("lu-clock", "Duración", plan.duration ?? "", last: true)
                }
                .background(Palette.card, in: RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
            }
        }
    }

    private func infoRow(_ icon: String, _ title: String, _ value: String, last: Bool) -> some View {
        HStack(spacing: 12) {
            Image(icon).renderingMode(.template).resizable().frame(width: 20, height: 20).foregroundStyle(Palette.muted).frame(width: 28)
            HStack { Text(title).font(.apBody); Spacer(); Text(value).font(.apBody).foregroundStyle(Palette.muted) }
                .frame(minHeight: 44)
                .overlay(alignment: .bottom) { if !last { Rectangle().fill(Palette.separator).frame(height: 0.5) } }
        }
        .padding(.horizontal, 16)
    }

    @ViewBuilder private func rest(_ day: String) -> some View {
        let i = DayNames.all.firstIndex(of: day) ?? 0
        let next = (1...7).map { DayNames.all[(i + $0) % 7] }.first { workPlan($0) != nil }
        VStack(spacing: 8) {
            Image("lu-moon").renderingMode(.template).resizable().frame(width: 28, height: 28).foregroundStyle(Palette.gold)
            Text(day == DayNames.today ? "Hoy es día de descanso" : "\(day) es día de descanso").font(.apHeadline)
            Text("Toca otro día para ver su sesión.").font(.apSubhead).foregroundStyle(Palette.muted)
            if let next {
                Button("Ver el \(next.lowercased())") { Haptics.selection(); withAnimation(.snappy) { expanded = next } }
                    .buttonStyle(.pillSecondary).fixedSize().padding(.top, 8)
            }
        }
        .frame(maxWidth: .infinity).padding(.vertical, 32)
    }

    private func emptyCard(icon: String, title: String, message: String) -> some View {
        VStack(spacing: 8) {
            Image(icon).renderingMode(.template).resizable().frame(width: 28, height: 28).foregroundStyle(Palette.gold)
            Text(title).font(.apHeadline)
            Text(message).font(.apSubhead).foregroundStyle(Palette.muted).multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity).padding(.vertical, 32).padding(.horizontal, 24)
        .background(Palette.card, in: RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
    }

    private var tools: some View {
        VStack(spacing: 0) {
            Button { copy() } label: { toolRow(copied ? "lu-check" : "lu-copy", copied ? "Plan copiado" : "Copiar plan", last: false) }.buttonStyle(.plain)
            ShareLink(item: PlanText.file(days)) { toolRow("lu-download", "Descargar plan", last: false) }.buttonStyle(.plain)
            ShareLink(item: PlanText.calendar(days)) { toolRow("lu-calendar", "Exportar plan al calendario", last: true) }.buttonStyle(.plain)
        }
        .background(Palette.card, in: RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
    }

    private func toolRow(_ icon: String, _ label: String, last: Bool) -> some View {
        HStack(spacing: 12) {
            Image(icon).renderingMode(.template).resizable().frame(width: 20, height: 20).foregroundStyle(Palette.muted).frame(width: 28)
            Text(label).font(.apBody).foregroundStyle(Palette.foreground).frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
                .overlay(alignment: .bottom) { if !last { Rectangle().fill(Palette.separator).frame(height: 0.5) } }
        }
        .padding(.leading, 16).contentShape(Rectangle())
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

/// Texto del plan como `planToText` de la web, y un .ics semanal para el calendario.
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
    static func calendar(_ days: [DayPlan]) -> URL {
        let codes = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"]
        let cal = Calendar(identifier: .iso8601)
        let monday = cal.date(from: cal.dateComponents([.yearForWeekOfYear, .weekOfYear], from: Date())) ?? Date()
        let f = DateFormatter(); f.dateFormat = "yyyyMMdd"
        var ics = "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Autopilot//Plan//ES\r\n"
        for d in days where d.type == "gimnasio" || d.type == "actividad" {
            guard let i = DayNames.all.firstIndex(of: d.day), let date = cal.date(byAdding: .day, value: i, to: monday) else { continue }
            ics += "BEGIN:VEVENT\r\nUID:autopilot-\(codes[i])@autopilotplan.app\r\nDTSTART:\(f.string(from: date))T180000\r\nDURATION:PT1H\r\nRRULE:FREQ=WEEKLY;BYDAY=\(codes[i])\r\nSUMMARY:\(d.title)\r\nEND:VEVENT\r\n"
        }
        ics += "END:VCALENDAR\r\n"
        let u = FileManager.default.temporaryDirectory.appendingPathComponent("plan-autopilot.ics")
        try? ics.write(to: u, atomically: true, encoding: .utf8)
        return u
    }
}
