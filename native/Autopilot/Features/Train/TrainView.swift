import SwiftUI

/// Entrenar: el día de hoy y la semana. Recupera el entreno a medias si lo hay.
struct TrainView: View {
    @EnvironmentObject private var session: SessionModel
    @StateObject private var model = PlanModel()
    @State private var active: ActiveWorkout?
    @State private var selectedDay: String = DayNames.today
    @State private var starting = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                if model.loading && model.days.isEmpty {
                    ProgressView().frame(maxWidth: .infinity).padding(.top, 60)
                } else if model.days.isEmpty {
                    EmptyStateView(symbol: "calendar.badge.plus", title: "Aún no tienes plan",
                                   message: "Créalo desde la web o la app para empezar a entrenar.")
                } else {
                    if let resumable = ActiveWorkout.restore(userId: session.userIdString ?? "") {
                        Card {
                            Text("Entreno a medias").font(.apHeadline)
                            Text("\(resumable.day.title) · empezado \(resumable.startedAt.formatted(.relative(presentation: .named)))")
                                .font(.apSubhead).foregroundStyle(Palette.muted)
                            Button("Seguir") { active = ActiveWorkout(draft: resumable) }.buttonStyle(.pill)
                        }
                    }
                    dayPicker
                    if let day = model.days.first(where: { $0.day == selectedDay }) {
                        DayDetail(day: day, completed: model.completedToday(day.day), starting: starting) { await start(day) }
                    } else {
                        Card { Text("Descanso").font(.apTitle3); Text("Hoy no hay entreno en tu plan.").font(.apSubhead).foregroundStyle(Palette.muted) }
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
        .sheet(item: $active) { workout in workoutStack(workout).frame(minWidth: 720, minHeight: 640) }
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

    private var dayPicker: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(DayNames.all, id: \.self) { day in
                    let has = model.days.contains { $0.day == day }
                    Button { selectedDay = day; Haptics.selection() } label: {
                        VStack(spacing: 4) {
                            Text(String(day.prefix(3))).font(.apSubhead.weight(.semibold))
                            Circle().fill(has ? Palette.gold : Palette.separator).frame(width: 6, height: 6)
                        }
                        .frame(width: 56, height: 56)
                        .background(selectedDay == day ? Palette.gold.opacity(0.18) : Palette.secondary,
                                    in: RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
                        .foregroundStyle(selectedDay == day ? Palette.foreground : Palette.muted)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(day + (has ? ", con entreno" : ", descanso"))
                    .accessibilityAddTraits(selectedDay == day ? .isSelected : [])
                }
            }
        }
    }

    private func start(_ day: DayPlan) async {
        guard let id = session.userId, let idString = session.userIdString else { return }
        starting = true
        defer { starting = false }
        let previous = await TrainingRepo.previousSets(userId: id, exercises: (day.exercises ?? []).map(\.name))
        active = ActiveWorkout(userId: idString, day: day, previous: previous)
    }
}

extension ActiveWorkout: Identifiable { nonisolated var id: ObjectIdentifier { ObjectIdentifier(self) } }

struct DayDetail: View {
    let day: DayPlan
    let completed: Bool
    let starting: Bool
    let start: () async -> Void

    var body: some View {
        Card(radius: Radius.hero) {
            Text(day.day).font(.apFootnote).foregroundStyle(Palette.muted)
            Text(day.title).font(.apTitle1).accessibilityAddTraits(.isHeader)
            if let focus = day.muscle_focus, day.isGym { Text(focus).font(.apSubhead).foregroundStyle(Palette.muted) }
            if day.isGym {
                VStack(alignment: .leading, spacing: 10) {
                    ForEach(day.exercises ?? []) { ex in
                        HStack {
                            Text(ex.name).font(.apBody)
                            Spacer()
                            Text("\(ex.series) × \(ex.reps)").font(.apSubhead.monospacedDigit()).foregroundStyle(Palette.muted)
                        }
                        .accessibilityElement(children: .combine)
                    }
                }
                .padding(.vertical, 4)
                if completed {
                    Label("Hecho hoy", systemImage: "checkmark.circle.fill").font(.apHeadline).foregroundStyle(Palette.gold)
                } else {
                    Button { Task { await start() } } label: {
                        if starting { ProgressView().tint(.black) } else { Text("Empezar entreno") }
                    }
                    .buttonStyle(.pill)
                    .disabled(starting)
                }
            } else {
                Text([day.intensity, day.duration].compactMap { $0 }.joined(separator: " · ")).font(.apSubhead).foregroundStyle(Palette.muted)
            }
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
