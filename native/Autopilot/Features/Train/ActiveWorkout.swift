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
    /// Esfuerzo de la sesión anterior (la sugerencia no sube carga tras un RPE ≥ 9).
    var previousRpe: Int?
    /// Ejercicio original → ejercicio que el usuario ha puesto en su lugar.
    @Published var swaps: [String: String] = [:]
    /// Récords batidos al terminar.
    @Published var records: [String] = []

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
    var doneSets: Int { draft.logs.values.flatMap { $0 }.filter { $0.done && $0.isWarmup != true }.count }
    var totalSets: Int { draft.logs.values.flatMap { $0 }.filter { $0.isWarmup != true }.count }
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
            // Descanso elegido en Ajustes → Tu forma de entrenar; si no hay, el del ejercicio.
            let chosen = UserDefaults.standard.integer(forKey: "rest-seconds")
            startRest(seconds: chosen > 0 ? chosen : exercise.restSeconds)
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

    // MARK: Sobrecarga, bajadas y calentamiento (como la web)

    func applyProgression(_ exercise: String, _ s: ProgressionSuggestion) {
        guard var sets = draft.logs[exercise] else { return }
        for i in sets.indices where !sets[i].done {
            if s.label == .addRep { sets[i].reps += 1 } else if !s.weight.isEmpty { sets[i].weight = s.weight }
        }
        draft.logs[exercise] = sets
        persist()
        Haptics.success()
    }

    func addDrop(_ exercise: String, set index: Int) {
        update(exercise, set: index) { set in
            var drops = set.drops ?? []
            let base = drops.last.map { Progression.weight($0.weight) } ?? Progression.weight(set.weight)
            let next = base.map { w in let v = (w * 0.8 * 2).rounded() / 2; return v.truncatingRemainder(dividingBy: 1) == 0 ? String(Int(v)) : String(v) } ?? ""
            drops.append(.init(reps: set.reps, weight: next))
            set.drops = drops
        }
        Haptics.tap()
    }

    func updateDrop(_ exercise: String, set index: Int, drop: Int, _ change: (inout SetLog.Drop) -> Void) {
        update(exercise, set: index) { set in
            guard var drops = set.drops, drops.indices.contains(drop) else { return }
            change(&drops[drop]); set.drops = drops
        }
    }

    func removeDrop(_ exercise: String, set index: Int, drop: Int) {
        update(exercise, set: index) { set in
            guard var drops = set.drops, drops.indices.contains(drop) else { return }
            drops.remove(at: drop); set.drops = drops.isEmpty ? nil : drops
        }
    }

    func toggleWarmup(_ exercise: String, set index: Int) {
        update(exercise, set: index) { $0.isWarmup = $0.isWarmup == true ? nil : true }
        Haptics.selection()
    }

    func swap(_ original: String, to replacement: String?, userId: UUID) {
        if let r = replacement { swaps[original] = r } else { swaps[original] = nil }
        struct Pref: Encodable { let user_id: UUID; let original_exercise_name: String; let preferred_exercise_name: String?; let last_used_at: String }
        Task {
            _ = try? await Backend.client.from("exercise_user_preferences")
                .upsert(Pref(user_id: userId, original_exercise_name: original, preferred_exercise_name: replacement, last_used_at: ISO8601DateFormatter().string(from: Date())),
                        onConflict: "user_id,original_exercise_name").execute()
        }
    }

    /// Mejor serie por 1RM estimado (Epley) frente al récord guardado; las de calentamiento nunca cuentan.
    private func detectRecords(userId: UUID) async -> [String] {
        struct PR: Encodable { let user_id: UUID; let exercise_name: String; let weight: Double; let reps: Int; let estimated_1rm: Double; let achieved_at: String }
        struct Best: Decodable { let estimated_1rm: Double? }
        var inserts: [PR] = []
        for (name, sets) in draft.logs {
            let done = sets.compactMap { s -> (Double, Int)? in
                guard s.done, s.isWarmup != true, s.reps > 0, let w = Progression.weight(s.weight) else { return nil }
                return (w, s.reps)
            }
            guard let best = done.max(by: { $0.0 * (1 + Double($0.1) / 30) < $1.0 * (1 + Double($1.1) / 30) }) else { continue }
            let e1rm = best.0 * (1 + Double(best.1) / 30)
            let existing: [Best] = (try? await Backend.client.from("personal_records").select("estimated_1rm")
                .eq("user_id", value: userId).eq("exercise_name", value: name).order("estimated_1rm", ascending: false).limit(1).execute().value) ?? []
            if e1rm > (existing.first?.estimated_1rm ?? 0) {
                inserts.append(PR(user_id: userId, exercise_name: name, weight: best.0, reps: best.1, estimated_1rm: (e1rm * 10).rounded() / 10, achieved_at: draft.date))
            }
        }
        if !inserts.isEmpty { _ = try? await Backend.client.from("personal_records").upsert(inserts, onConflict: "user_id,exercise_name,weight,reps").execute() }
        return inserts.map(\.exercise_name)
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
            records = await detectRecords(userId: userId)
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
