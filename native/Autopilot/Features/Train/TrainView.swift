import SwiftUI

/// Entrenar, calcado de `WorkoutTracker.tsx` (antes de empezar): selector de días,
/// portada, título, «N ejercicios · M series», «Empezar entrenamiento» y la lista «Ejercicios».
struct TrainView: View {
    @EnvironmentObject private var session: SessionModel
    @StateObject private var model = PlanModel()
    @State private var active: ActiveWorkout?
    @State private var selectedDay: String = DayNames.today
    @State private var starting = false

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
                    if !model.days.isEmpty { dayPicker }
                    if let resumable = ActiveWorkout.restore(userId: session.userIdString ?? ""), resumable.day.day == selectedDay {
                        Button { active = ActiveWorkout(draft: resumable) } label: {
                            Label("Seguir entrenamiento", systemImage: "play.fill")
                        }
                        .buttonStyle(PillButtonStyle(kind: .primary, height: 56))
                    }
                    if let plan = currentPlan {
                        if plan.isGym { gymSummary(plan) } else { activityDay(plan) }
                    } else {
                        restDay
                    }
                }
            }
            .padding(16)
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
                    AsyncImage(url: url) { $0.resizable().scaledToFill() } placeholder: { Palette.card }
                        .frame(maxWidth: .infinity).frame(height: 192)
                        .overlay(LinearGradient(colors: [.black.opacity(0.7), .clear], startPoint: .bottom, endPoint: .center))
                        .clipShape(RoundedRectangle(cornerRadius: Radius.hero, style: .continuous))
                        .padding(.bottom, 14)
                        .accessibilityHidden(true)
                }
                Text(parts.first ?? "").font(.system(size: 32, weight: .bold, design: .rounded)).lineLimit(1)
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
                    Button { Task { await start(plan) } } label: {
                        if starting { ProgressView().tint(.black) } else { Label("Empezar entrenamiento", systemImage: "play.fill") }
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
        VStack(alignment: .leading, spacing: 10) {
            Image(systemName: "moon.fill").font(.system(size: 28)).foregroundStyle(Palette.gold).accessibilityHidden(true)
            Text("Día de descanso").font(.apTitle3)
            Text("Recupera, o elige otra sesión de tu semana").font(.apSubhead).foregroundStyle(Palette.muted)
            FlowRow {
                ForEach(model.days.filter { $0.type == "actividad" || !($0.exercises ?? []).isEmpty }) { p in
                    Button(p.day) { Haptics.selection(); selectedDay = p.day }
                        .font(.apSubhead.weight(.medium))
                        .padding(.horizontal, 16).frame(minHeight: 44)
                        .background(Color.white.opacity(0.1), in: Capsule())
                        .buttonStyle(.plain)
                }
            }
            .padding(.top, 6)
        }
        .padding(20)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Palette.card, in: RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
    }

    private func start(_ day: DayPlan, focus: Int = 0) async {
        guard let id = session.userId, let idString = session.userIdString else { return }
        Haptics.tap()
        starting = true
        defer { starting = false }
        let previous = await TrainingRepo.previousSets(userId: id, exercises: (day.exercises ?? []).map(\.name))
        let workout = ActiveWorkout(userId: idString, day: day, previous: previous)
        workout.previous = previous
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

    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 12, style: .continuous).fill(Palette.secondary)
            if let url, let u = URL(string: url) {
                AsyncImage(url: u) { $0.resizable().scaledToFill() } placeholder: { Color.clear }
            } else {
                Image(systemName: "dumbbell").foregroundStyle(Palette.muted)
            }
            if completed {
                Color.black.opacity(0.5)
                Image(systemName: "checkmark").font(.headline.weight(.bold)).foregroundStyle(Palette.gold)
            }
        }
        .frame(width: 52, height: 52)
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
