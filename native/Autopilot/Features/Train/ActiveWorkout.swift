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
    /// Nota libre por ejercicio (técnica, agarre, molestias). Solo de esta sesión.
    var notes: [String: String]? = nil
    /// Descanso elegido desde la tarjeta, en segundos, por ejercicio y solo esta sesión.
    var restOverrides: [String: Int]? = nil
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

    /// ±2,5 kg o ±1 rep sobre un campo, sin teclear. Lo usan la barra del teclado y la
    /// fila de ajustes de la serie; si el campo está vacío, parte de la carga sugerida
    /// (la que se ve en gris) para que el primer toque ya haga algo útil.
    func stepField(_ field: WorkoutField, by direction: Int) {
        guard let sets = draft.logs[field.exercise], sets.indices.contains(field.set) else { return }
        let set = sets[field.set]
        if let drop = field.drop {
            guard let drops = set.drops, drops.indices.contains(drop) else { return }
            if field.kind == .weight {
                let base = Progression.weight(drops[drop].weight) ?? Progression.weight(set.weight) ?? 0
                let next = max(0, base + Double(direction) * Self.weightStep)
                updateDrop(field.exercise, set: field.set, drop: drop) {
                    $0.weight = next > 0 ? Self.weightText(next) : ""
                }
            } else {
                let base = drops[drop].reps > 0 ? drops[drop].reps : max(set.reps, 1)
                updateDrop(field.exercise, set: field.set, drop: drop) { $0.reps = max(1, base + direction) }
            }
        } else if field.kind == .weight {
            let base = Progression.weight(set.weight)
                ?? previous[field.exercise]?[safe: field.set].flatMap { Progression.weight($0.weight) }
                ?? exercises.first { $0.name == field.exercise }.flatMap { Progression.weight($0.weight) }
                ?? 0
            let next = max(0, base + Double(direction) * Self.weightStep)
            update(field.exercise, set: field.set) {
                $0.weight = next > 0 ? Self.weightText(next) : ""
            }
        } else {
            let base = set.reps > 0 ? set.reps : (previous[field.exercise]?[safe: field.set]?.reps ?? 0)
            update(field.exercise, set: field.set) { $0.reps = max(1, base + direction) }
        }
        Haptics.tap()
    }

    static let weightStep = 2.5
    static func weightText(_ w: Double) -> String {
        w.truncatingRemainder(dividingBy: 1) == 0 ? String(Int(w)) : String(w)
    }

    func toggleDone(_ exercise: GymExercise, set index: Int) {
        var nowDone = false
        update(exercise.name, set: index) { $0.done.toggle(); nowDone = $0.done }
        if nowDone {
            Haptics.signature()
            startRest(seconds: restSeconds(for: exercise))
        } else {
            Haptics.tap()
        }
    }

    // MARK: Nota y descanso del ejercicio (solo esta sesión)

    /// Descanso que se aplica al marcar la serie: el elegido en la tarjeta, si no el de
    /// Ajustes → Tu forma de entrenar, y si no el que pide el ejercicio.
    func restSeconds(for exercise: GymExercise) -> Int {
        if let chosen = draft.restOverrides?[exercise.name], chosen > 0 { return chosen }
        let global = UserDefaults.standard.integer(forKey: "rest-seconds")
        return global > 0 ? global : exercise.restSeconds
    }

    func setRest(_ seconds: Int, for exercise: String) {
        var map = draft.restOverrides ?? [:]
        if seconds <= 0 { map[exercise] = nil } else { map[exercise] = seconds }
        draft.restOverrides = map.isEmpty ? nil : map
        persist()
        Haptics.selection()
    }

    func note(_ exercise: String) -> String { draft.notes?[exercise] ?? "" }

    func setNote(_ text: String, for exercise: String) {
        let clean = text.trimmingCharacters(in: .whitespacesAndNewlines)
        var map = draft.notes ?? [:]
        if clean.isEmpty { map[exercise] = nil } else { map[exercise] = clean }
        draft.notes = map.isEmpty ? nil : map
        persist()
    }

    // MARK: Añadir ejercicios y rampa de calentamiento

    /// Añade ejercicios a la sesión en curso sin salir de ella (como la web). Entran al final,
    /// con sus series vacías, y el plan guardado no se toca: es solo esta sesión.
    func addExercises(_ items: [GymExercise]) {
        var day = draft.day
        var list = day.exercises ?? []
        let existing = Set(list.map(\.name))
        let fresh = items.filter { !existing.contains($0.name) }
        guard !fresh.isEmpty else { return }
        list.append(contentsOf: fresh)
        day.exercises = list
        draft.day = day
        var logs = draft.logs
        for e in fresh where logs[e.name] == nil {
            logs[e.name] = (0..<max(e.series, 1)).map { _ in
                SetLog(reps: e.repsTarget, weight: "", done: false, isWarmup: nil)
            }
        }
        draft.logs = logs
        openExercises.insert(list.count - 1)
        persist()
        Haptics.success()
    }

    /// Rampa de calentamiento: tres series al 50 %, 70 % y 85 % de la carga de trabajo
    /// (8, 5 y 3 reps), marcadas como calentamiento para no contar en volumen ni récords.
    func addWarmupRamp(_ exercise: GymExercise) {
        guard var sets = draft.logs[exercise.name],
              !sets.contains(where: { $0.isWarmup == true }) else { return }
        let working = sets.first(where: { $0.isWarmup != true }).flatMap { Progression.weight($0.weight) }
            ?? Progression.weight(exercise.weight)
            ?? previous[exercise.name]?.first.flatMap { Progression.weight($0.weight) }
        let target = sets.first(where: { $0.isWarmup != true })?.reps ?? exercise.repsTarget
        let steps: [(percent: Double, reps: Int)] = [(0.5, 8), (0.7, 5), (0.85, 3)]
        let ramp = steps.map { step -> SetLog in
            let weight = working.map { Self.roundToPlate($0 * step.percent) }
            return SetLog(reps: max(1, min(step.reps, max(target, 1))),
                          weight: weight.map(Self.weightText) ?? "",
                          done: false, isWarmup: true)
        }
        sets.insert(contentsOf: ramp, at: 0)
        draft.logs[exercise.name] = sets
        persist()
        Haptics.success()
    }

    /// Redondea al disco más cercano de 2,5 kg (lo que se puede montar en la barra).
    static func roundToPlate(_ value: Double) -> Double {
        max(0, (value / 2.5).rounded() * 2.5)
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
