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
    /// Grupos de superset (nombres de ejercicio). Opcional por compatibilidad.
    var supersets: [[String]]? = nil
    /// Marca de pausa (como `pausedAt` en la web). Al reanudar, inicio y descanso se desplazan.
    var pausedAt: Date? = nil
}

@MainActor
final class ActiveWorkout: ObservableObject {
    @Published var draft: WorkoutDraft
    @Published var saving = false
    @Published var saveError: String?
    /// Ejercicios abiertos en la vista de lista (como `openExercises` en la web).
    @Published var openExercises: Set<Int> = [0]
    /// En la lista todos nacen abiertos; se guardan los que el usuario pliega (como `closedExercises`).
    @Published var closedExercises: Set<Int> = []
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
    /// Récord en directo al marcar una serie («Ejercicio#índice» → «+2,5 kg»), como `livePRs` en la web.
    @Published var livePRs: [String: String] = [:]

    private nonisolated static func key(_ userId: String) -> String { "active-workout.\(userId)" }

    static func restore(userId: String) -> WorkoutDraft? {
        guard let data = UserDefaults.standard.data(forKey: key(userId)) else { return nil }
        return try? JSONDecoder().decode(WorkoutDraft.self, from: data)
    }

    static func clear(userId: String) { UserDefaults.standard.removeObject(forKey: key(userId)) }

    init(draft: WorkoutDraft) { self.draft = draft }

    convenience init(userId: String, day: DayPlan, previous: [String: [SetLog]]) {
        var logs: [String: [SetLog]] = [:]
        for ex in day.exercises ?? [] {
            let last = previous[ex.name]?.filter { $0.isWarmup != true && $0.done } ?? []
            logs[ex.name] = (0..<max(ex.series, 1)).map { i in
                let prev = i < last.count ? last[i] : last.last
                return SetLog(reps: prev?.reps ?? ex.repsTarget, weight: prev?.weight ?? ex.weight, done: false, isWarmup: nil)
            }
        }
        self.init(draft: WorkoutDraft(userId: userId, day: day, date: LocalDate.string(), logs: logs,
                                      startedAt: Date(), restEndsAt: nil, currentExercise: 0))
        // Un entreno recién empezado se guarda ya: si la app se cierra, «Continuar entreno» existe.
        persistNow()
    }

    var exercises: [GymExercise] { draft.day.exercises ?? [] }

    // Contadores con bucles directos: se leen en el pie y en la barra (que se redibuja cada
    // segundo con el cronómetro) y antes creaban arrays intermedios en cada lectura.
    var doneSets: Int {
        var count = 0
        for sets in draft.logs.values {
            for set in sets where set.done && set.isWarmup != true { count += 1 }
        }
        return count
    }

    var totalSets: Int {
        var count = 0
        for sets in draft.logs.values {
            for set in sets where set.isWarmup != true { count += 1 }
        }
        return count
    }

    var volumeKg: Double {
        var total = 0.0
        for sets in draft.logs.values {
            for set in sets where set.done && set.isWarmup != true {
                let kg = Double(set.weight.replacingOccurrences(of: ",", with: ".")) ?? 0
                total += Double(set.reps) * kg
            }
        }
        return total
    }

    // MARK: Supersets

    /// Posición en el superset («A», «B»…) y miembros, si el ejercicio pertenece a uno.
    func supersetPosition(of name: String) -> (letter: String, members: [String])? {
        guard let groups = draft.supersets else { return nil }
        for group in groups {
            if let i = group.firstIndex(of: name) {
                return (String(UnicodeScalar(65 + min(i, 25))!), group)
            }
        }
        return nil
    }

    /// Compañero de superset (el otro ejercicio del grupo).
    func supersetPartner(of name: String) -> String? {
        supersetPosition(of: name)?.members.first { $0 != name }
    }

    /// Crea un superset con el siguiente ejercicio de la sesión, o saca el ejercicio del suyo.
    func toggleSuperset(_ name: String) {
        var groups = draft.supersets ?? []
        if let gi = groups.firstIndex(where: { $0.contains(name) }) {
            groups[gi].removeAll { $0 == name }
            if groups[gi].count < 2 { groups.remove(at: gi) }
        } else {
            guard let i = exercises.firstIndex(where: { $0.name == name }), i + 1 < exercises.count else { return }
            let next = exercises[i + 1].name
            if let gi = groups.firstIndex(where: { $0.contains(next) }) {
                groups[gi].append(name)
            } else {
                groups.append([name, next])
            }
        }
        draft.supersets = groups.isEmpty ? nil : groups
        persist()
    }

    // MARK: Guardado del borrador

    private var persistTask: Task<Void, Never>?

    /// Guardado diferido: teclear kg/reps o marcar series no puede serializar y escribir el JSON
    /// entero en el hilo principal en cada pulsación (era el principal tirón de la sesión).
    /// Se escribe 0,4 s después del último cambio y, si hace falta, al salir/ir a segundo plano.
    func persist() {
        persistTask?.cancel()
        let snapshot = draft
        persistTask = Task { [weak self] in
            try? await Task.sleep(nanoseconds: 400_000_000)
            guard !Task.isCancelled else { return }
            await Self.write(snapshot)
            self?.persistTask = nil
        }
    }

    /// Escritura inmediata (síncrona): al empezar, al salir de la sesión y al ir a segundo plano.
    /// Aquí interesa no perder los últimos cambios aunque la app se suspenda justo después.
    func persistNow() {
        persistTask?.cancel()
        persistTask = nil
        Self.writeNow(draft)
    }

    /// Cancela el guardado pendiente (evita resucitar un borrador ya borrado).
    func cancelPersist() {
        persistTask?.cancel()
        persistTask = nil
    }

    /// Descarta la sesión: borra el borrador y cancela cualquier guardado pendiente.
    func discard() {
        cancelPersist()
        Self.clear(userId: draft.userId)
    }

    /// Codificar y escribir fuera del MainActor (`UserDefaults` es seguro entre hilos).
    private nonisolated static func write(_ draft: WorkoutDraft) async {
        writeNow(draft)
    }

    private nonisolated static func writeNow(_ draft: WorkoutDraft) {
        guard let data = try? JSONEncoder().encode(draft) else { return }
        UserDefaults.standard.set(data, forKey: key(draft.userId))
    }

    func update(_ exercise: String, set index: Int, _ change: (inout SetLog) -> Void) {
        guard var sets = draft.logs[exercise], sets.indices.contains(index) else { return }
        let before = sets[index]
        change(&sets[index])
        // Sin cambios no hay publicación ni guardado: evita redibujados inútiles al teclear.
        guard sets[index] != before else { return }
        draft.logs[exercise] = sets
        persist()
    }

    func toggleDone(_ exercise: GymExercise, set index: Int) {
        var nowDone = false
        update(exercise.name, set: index) { $0.done.toggle(); nowDone = $0.done }
        if nowDone {
            Haptics.signature()
            checkLiveRecord(exercise.name, set: index)
            startRest(seconds: restSeconds(for: exercise))
        } else {
            Haptics.tap()
            livePRs["\(exercise.name)#\(index)"] = nil
        }
    }

    /// Récord en directo (como la web): más peso que la mejor serie de trabajo de la sesión anterior.
    /// Las de calentamiento no cuentan, ni la que se marca ni las previas.
    private func checkLiveRecord(_ exercise: String, set index: Int) {
        guard let set = draft.logs[exercise]?[safe: index], set.isWarmup != true,
              let weight = Progression.weight(set.weight), weight > 0 else { return }
        let best = (previous[exercise] ?? [])
            .filter { $0.done && $0.isWarmup != true }
            .compactMap { Progression.weight($0.weight) }
            .max() ?? 0
        guard best > 0, weight > best else { return }
        let diff = ((weight - best) * 10).rounded() / 10
        livePRs["\(exercise)#\(index)"] = "+\(NumberText.decimal(diff, digits: diff.rounded() == diff ? 0 : 1)) kg"
        Haptics.success()
    }

    /// Copia «Previa» (kg y reps de la sesión anterior) en la serie, como al tocarla en Hevy.
    func copyPrevious(_ exercise: String, set index: Int) {
        guard let prev = previous[exercise]?[safe: index], prev.done,
              draft.logs[exercise]?[safe: index]?.done == false else { return }
        update(exercise, set: index) { $0.weight = prev.weight; if prev.reps > 0 { $0.reps = prev.reps } }
        Haptics.tap()
    }

    // MARK: Descanso por ejercicio

    /// Descanso elegido para un ejercicio desde su tarjeta (por usuario, como en la web).
    private var restKey: String { "rest-by-exercise.\(draft.userId)" }

    func restChoice(for exercise: String) -> Int? {
        let value = (UserDefaults.standard.dictionary(forKey: restKey) as? [String: Int])?[exercise]
        return value.flatMap { (15...600).contains($0) ? $0 : nil }
    }

    /// El del ejercicio manda; si no hay, el de Ajustes → Tu forma de entrenar; si no, el del plan.
    func restSeconds(for exercise: GymExercise) -> Int {
        if let chosen = restChoice(for: exercise.name) { return chosen }
        let global = UserDefaults.standard.integer(forKey: "rest-seconds")
        return global > 0 ? global : exercise.restSeconds
    }

    /// `nil` vuelve al descanso de siempre.
    func setRestChoice(_ seconds: Int?, for exercise: String) {
        var all = (UserDefaults.standard.dictionary(forKey: restKey) as? [String: Int]) ?? [:]
        all[exercise] = seconds.map { min(600, max(15, $0)) }
        UserDefaults.standard.set(all, forKey: restKey)
        objectWillChange.send()
        Haptics.selection()
    }

    // MARK: Ejercicios añadidos en la sesión

    /// Añade ejercicios solo a esta sesión (como «Añadir ejercicio a esta sesión» en la web):
    /// la rutina guardada no cambia. Trae antes su sesión anterior para «Previa» y la precarga.
    func addExercises(_ picked: [GymExercise], userId: UUID) async {
        let existing = Set(exercises.map(\.name))
        var seen = Set<String>()
        let fresh = picked.filter { !existing.contains($0.name) && seen.insert($0.name).inserted }
        guard !fresh.isEmpty else { return }
        let prev = await TrainingRepo.previousSets(userId: userId, exercises: fresh.map(\.name))
        for (name, sets) in prev where previous[name] == nil { previous[name] = sets }
        for ex in fresh {
            let last = previous[ex.name]?.filter { $0.isWarmup != true && $0.done } ?? []
            draft.logs[ex.name] = (0..<max(ex.series, 1)).map { i in
                let p = i < last.count ? last[i] : last.last
                return SetLog(reps: p?.reps ?? ex.repsTarget, weight: p?.weight ?? ex.weight, done: false, isWarmup: nil)
            }
        }
        draft.day.exercises = exercises + fresh
        persist()
        Haptics.success()
    }

    func addSet(_ exercise: String) {
        var sets = draft.logs[exercise] ?? []
        let last = sets.last
        sets.append(SetLog(reps: last?.reps ?? 10, weight: last?.weight ?? "", done: false, isWarmup: nil))
        draft.logs[exercise] = sets
        persist()
        Haptics.tap()
    }

    func canRemoveSet(_ exercise: String) -> Bool { (draft.logs[exercise]?.count ?? 0) > 1 }

    func removeSet(_ exercise: String, at index: Int) {
        guard var sets = draft.logs[exercise], sets.indices.contains(index), sets.count > 1 else { return }
        sets.remove(at: index)
        draft.logs[exercise] = sets
        // Los récords en directo van por índice: los de detrás suben una posición.
        var prs: [String: String] = [:]
        for (key, value) in livePRs {
            guard key.hasPrefix("\(exercise)#"), let i = Int(key.dropFirst(exercise.count + 1)) else { prs[key] = value; continue }
            if i < index { prs[key] = value } else if i > index { prs["\(exercise)#\(i - 1)"] = value }
        }
        livePRs = prs
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
        // El récord en directo de esa serie deja de valer al pasar a calentamiento.
        livePRs["\(exercise)#\(index)"] = nil
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
    /// Antes se hacía una consulta por ejercicio (en serie): ahora es una sola consulta para todos los
    /// ejercicios de la sesión y un único upsert.
    private func detectRecords(userId: UUID) async -> [String] {
        struct PR: Encodable { let user_id: UUID; let exercise_name: String; let weight: Double; let reps: Int; let estimated_1rm: Double; let achieved_at: String }
        struct Best: Decodable { let exercise_name: String; let estimated_1rm: Double? }

        // 1) Mejor serie hecha de la sesión, por ejercicio.
        var sessionBest: [(name: String, weight: Double, reps: Int, e1rm: Double)] = []
        for (name, sets) in draft.logs {
            let done = sets.compactMap { s -> (Double, Int)? in
                guard s.done, s.isWarmup != true, s.reps > 0, let w = Progression.weight(s.weight) else { return nil }
                return (w, s.reps)
            }
            guard let best = done.max(by: { $0.0 * (1 + Double($0.1) / 30) < $1.0 * (1 + Double($1.1) / 30) }) else { continue }
            sessionBest.append((name, best.0, best.1, best.0 * (1 + Double(best.1) / 30)))
        }
        guard !sessionBest.isEmpty else { return [] }

        // 2) Récords ya guardados: una única consulta para todos los nombres de la sesión.
        let names = sessionBest.map(\.name)
        let existing: [Best] = (try? await Backend.client.from("personal_records")
            .select("exercise_name, estimated_1rm")
            .eq("user_id", value: userId)
            .in("exercise_name", values: names)
            .execute().value) ?? []
        var bestByExercise: [String: Double] = [:]
        for row in existing {
            bestByExercise[row.exercise_name] = max(bestByExercise[row.exercise_name] ?? 0, row.estimated_1rm ?? 0)
        }

        // 3) Solo se guardan los que superan el récord anterior.
        let inserts: [PR] = sessionBest.compactMap { item in
            guard item.e1rm > (bestByExercise[item.name] ?? 0) else { return nil }
            return PR(user_id: userId, exercise_name: item.name, weight: item.weight, reps: item.reps,
                      estimated_1rm: (item.e1rm * 10).rounded() / 10, achieved_at: draft.date)
        }
        if !inserts.isEmpty {
            _ = try? await Backend.client.from("personal_records").upsert(inserts, onConflict: "user_id,exercise_name,weight,reps").execute()
        }
        return inserts.map(\.exercise_name)
    }

    func toggleCollapsed(_ index: Int) {
        if closedExercises.contains(index) { closedExercises.remove(index) } else { closedExercises.insert(index) }
    }

    // MARK: Pausa

    var isPaused: Bool { draft.pausedAt != nil }

    /// Pausar congela el tiempo y el descanso; reanudar los desplaza lo que duró la pausa.
    func togglePause() {
        if let paused = draft.pausedAt {
            let shift = Date().timeIntervalSince(paused)
            draft.startedAt = draft.startedAt.addingTimeInterval(shift)
            if let end = draft.restEndsAt {
                let newEnd = end.addingTimeInterval(shift)
                draft.restEndsAt = newEnd
                scheduleRestNotification(at: newEnd)
            }
            draft.pausedAt = nil
        } else {
            draft.pausedAt = Date()
            UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: ["rest"])
        }
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

    /// Solo se pide autorización la primera vez (las siguientes llamadas son trabajo inútil).
    private static var didRequestNotificationAuth = false

    private func scheduleRestNotification(at date: Date) {
        let center = UNUserNotificationCenter.current()
        if !Self.didRequestNotificationAuth {
            Self.didRequestNotificationAuth = true
            center.requestAuthorization(options: [.alert, .sound]) { _, _ in }
        }
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
            // El borrador ya no hace falta: se cancela el guardado diferido y se borra el de disco.
            cancelPersist()
            Self.clear(userId: draft.userId)
            
            // Integración Apple Health (v1.0 Roadmap): registrar HKWorkout en Apple Salud
            let durationHours = max(0.1, Date().timeIntervalSince(draft.startedAt) / 3600.0)
            let estimatedCalories = (volumeKg > 0 ? (volumeKg * 0.05) : 250.0) + (durationHours * 200.0)
            Task {
                _ = await HealthKitManager.shared.saveWorkout(
                    title: draft.day.title,
                    startedAt: draft.startedAt,
                    endedAt: Date(),
                    calories: estimatedCalories
                )
            }

            Haptics.success()
            return true
        } catch {
            #if DEBUG
            // Deja el error real en Documents para poder leerlo desde el Mac.
            if let docs = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first {
                let line = "\(Date()) \(String(describing: error))\n"
                let url = docs.appendingPathComponent("save-error.log")
                if let data = line.data(using: .utf8) {
                    if let handle = try? FileHandle(forWritingTo: url) {
                        handle.seekToEndOfFile(); handle.write(data); try? handle.close()
                    } else {
                        try? data.write(to: url)
                    }
                }
            }
            #endif
            // El borrador sigue guardado: se puede reintentar sin perder nada.
            saveError = "No se pudo guardar. Tus series siguen aquí; inténtalo de nuevo."
            Haptics.error()
            return false
        }
    }
}

/// Descansos que se eligen desde la tarjeta (como `REST_PRESETS` y `formatRestLabel` en la web).
enum RestFormat {
    static let presets = [45, 60, 90, 120, 180]

    /// 45 → «45 s», 60 → «1 min», 90 → «1:30».
    static func label(_ seconds: Int) -> String {
        if seconds < 60 { return "\(seconds) s" }
        let m = seconds / 60, s = seconds % 60
        return s == 0 ? "\(m) min" : "\(m):\(String(format: "%02d", s))"
    }

    /// Para VoiceOver: «1 minuto 30 segundos».
    static func spoken(_ seconds: Int) -> String {
        let m = seconds / 60, s = seconds % 60
        let parts = [m > 0 ? "\(m) \(m == 1 ? "minuto" : "minutos")" : nil, s > 0 ? "\(s) segundos" : nil].compactMap { $0 }
        return parts.joined(separator: " ")
    }
}
