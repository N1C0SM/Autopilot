import Foundation
import UserNotifications

/// Borrador del entreno en curso, guardado por usuario (como `activeWorkout.ts`):
/// incluye el día, las series y el fin del descanso como hora absoluta, así se
/// recupera aunque la app se cierre y el descanso no depende de un contador.
struct WorkoutDraft: Codable {
    var userId: String
    var day: DayPlan
    var date: String
    var logs: [String: [SetLog]]
    var startedAt: Date
    var restEndsAt: Date?
    var currentExercise: Int
}

@MainActor
final class ActiveWorkout: ObservableObject {
    @Published var draft: WorkoutDraft
    @Published var saving = false
    @Published var saveError: String?
    /// Ejercicios abiertos en la vista de lista (como `openExercises` en la web).
    @Published var openExercises: Set<Int> = [0]
    /// Series de la sesión anterior (columna «Previa»).
    var previous: [String: [SetLog]] = [:]
    /// Duración objetivo del descanso actual, para la barra de progreso.
    @Published var restTarget: Int = 60

    private static func key(_ userId: String) -> String { "active-workout.\(userId)" }

    static func restore(userId: String) -> WorkoutDraft? {
        guard let data = UserDefaults.standard.data(forKey: key(userId)) else { return nil }
        return try? JSONDecoder().decode(WorkoutDraft.self, from: data)
    }

    static func clear(userId: String) { UserDefaults.standard.removeObject(forKey: key(userId)) }

    init(draft: WorkoutDraft) { self.draft = draft }

    convenience init(userId: String, day: DayPlan, previous: [String: [SetLog]]) {
        var logs: [String: [SetLog]] = [:]
        for ex in day.exercises ?? [] {
            let last = previous[ex.name]?.filter { $0.isWarmup != true } ?? []
            logs[ex.name] = (0..<max(ex.series, 1)).map { i in
                let prev = i < last.count ? last[i] : last.last
                return SetLog(reps: prev?.reps ?? ex.repsTarget, weight: prev?.weight ?? ex.weight, done: false, isWarmup: nil)
            }
        }
        self.init(draft: WorkoutDraft(userId: userId, day: day, date: LocalDate.string(), logs: logs,
                                      startedAt: Date(), restEndsAt: nil, currentExercise: 0))
        persist()
    }

    var exercises: [GymExercise] { draft.day.exercises ?? [] }
    var doneSets: Int { draft.logs.values.flatMap { $0 }.filter(\.done).count }
    var totalSets: Int { draft.logs.values.reduce(0) { $0 + $1.count } }
    var volumeKg: Double {
        var total = 0.0
        for set in draft.logs.values.joined() where set.done && set.isWarmup != true {
            let kg = Double(set.weight.replacingOccurrences(of: ",", with: ".")) ?? 0
            total += Double(set.reps) * kg
        }
        return total
    }

    func persist() {
        if let data = try? JSONEncoder().encode(draft) { UserDefaults.standard.set(data, forKey: Self.key(draft.userId)) }
    }

    func update(_ exercise: String, set index: Int, _ change: (inout SetLog) -> Void) {
        guard var sets = draft.logs[exercise], sets.indices.contains(index) else { return }
        change(&sets[index])
        draft.logs[exercise] = sets
        persist()
    }

    func toggleDone(_ exercise: GymExercise, set index: Int) {
        var nowDone = false
        update(exercise.name, set: index) { $0.done.toggle(); nowDone = $0.done }
        if nowDone {
            Haptics.success()
            startRest(seconds: exercise.restSeconds)
        } else {
            Haptics.tap()
        }
    }

    func addSet(_ exercise: String) {
        var sets = draft.logs[exercise] ?? []
        let last = sets.last
        sets.append(SetLog(reps: last?.reps ?? 10, weight: last?.weight ?? "", done: false, isWarmup: nil))
        draft.logs[exercise] = sets
        persist()
        Haptics.tap()
    }

    func removeSet(_ exercise: String, at index: Int) {
        guard var sets = draft.logs[exercise], sets.indices.contains(index), sets.count > 1 else { return }
        sets.remove(at: index)
        draft.logs[exercise] = sets
        persist()
    }

    // MARK: Descanso

    func startRest(seconds: Int) {
        restTarget = seconds
        let end = Date().addingTimeInterval(TimeInterval(seconds))
        draft.restEndsAt = end
        persist()
        scheduleRestNotification(at: end)
    }

    func adjustRest(by seconds: Int) {
        guard let end = draft.restEndsAt else { return }
        let newEnd = max(Date(), end.addingTimeInterval(TimeInterval(seconds)))
        draft.restEndsAt = newEnd
        persist()
        scheduleRestNotification(at: newEnd)
    }

    func skipRest() {
        draft.restEndsAt = nil
        persist()
        UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: ["rest"])
    }

    private func scheduleRestNotification(at date: Date) {
        let center = UNUserNotificationCenter.current()
        center.requestAuthorization(options: [.alert, .sound]) { _, _ in }
        center.removePendingNotificationRequests(withIdentifiers: ["rest"])
        let content = UNMutableNotificationContent()
        content.title = "Descanso terminado"
        content.body = "Toca la siguiente serie."
        content.sound = .default
        let interval = max(1, date.timeIntervalSinceNow)
        center.add(UNNotificationRequest(identifier: "rest", content: content,
                                         trigger: UNTimeIntervalNotificationTrigger(timeInterval: interval, repeats: false)))
    }

    // MARK: Terminar

    /// Guarda las series y marca el día como completado. Las series sin hacer no se guardan.
    func finish(userId: UUID, rpe: Int?) async -> Bool {
        saving = true
        saveError = nil
        defer { saving = false }
        let done = draft.logs.compactMapValues { sets -> [SetLog]? in
            let d = sets.filter(\.done)
            return d.isEmpty ? nil : d
        }
        do {
            try await TrainingRepo.saveLogs(userId: userId, day: draft.day.day, date: draft.date, logs: done, rpe: rpe)
            try await TrainingRepo.complete(userId: userId, day: draft.day.day, date: draft.date, rpe: rpe)
            skipRest()
            Self.clear(userId: draft.userId)
            Haptics.success()
            return true
        } catch {
            // El borrador sigue guardado: se puede reintentar sin perder nada.
            saveError = "No se pudo guardar. Tus series siguen aquí; inténtalo de nuevo."
            Haptics.error()
            return false
        }
    }
}
