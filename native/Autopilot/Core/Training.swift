import Foundation
import Supabase

/// Mismo formato que `supabase/functions/_shared/training-types.ts`.
struct GymExercise: Codable, Hashable, Identifiable {
    var exercise_id: String
    var name: String
    var series: Int
    /// Texto como en la web: «10», «4-6», «30 s».
    var reps: String
    var weight: String
    var rest: String
    var image_url: String?
    var muscle_group: String?
    var id: String { exercise_id + name }

    /// Primer número de las repeticiones, para proponer la serie.
    var repsTarget: Int { reps.split(whereSeparator: { !$0.isNumber }).compactMap { Int($0) }.first ?? 10 }

    enum CodingKeys: String, CodingKey { case exercise_id, name, series, reps, weight, rest, image_url, muscle_group }

    init(exercise_id: String, name: String, series: Int, reps: String, weight: String, rest: String,
         image_url: String? = nil, muscle_group: String? = nil) {
        self.exercise_id = exercise_id; self.name = name; self.series = series; self.reps = reps
        self.weight = weight; self.rest = rest; self.image_url = image_url; self.muscle_group = muscle_group
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        exercise_id = (try? c.decode(String.self, forKey: .exercise_id)) ?? ""
        name = (try? c.decode(String.self, forKey: .name)) ?? ""
        series = FlexibleValue.int(c, .series) ?? 3
        reps = FlexibleValue.string(c, .reps) ?? "10"
        weight = FlexibleValue.string(c, .weight) ?? ""
        rest = FlexibleValue.string(c, .rest) ?? "90s"
        image_url = try? c.decodeIfPresent(String.self, forKey: .image_url)
        muscle_group = try? c.decodeIfPresent(String.self, forKey: .muscle_group)
    }

    /// «90 s», «2 min», «60-90 s» → segundos (como `parseRestSeconds` en la web).
    var restSeconds: Int {
        let numbers = rest.split(whereSeparator: { !$0.isNumber }).compactMap { Int($0) }
        guard let value = numbers.last else { return 60 }
        return rest.lowercased().contains("min") ? value * 60 : value
    }
}

struct DayPlan: Codable, Hashable, Identifiable {
    var day: String
    var type: String
    var sport: String?
    var intensity: String?
    var duration: String?
    var routine_name: String?
    var muscle_focus: String?
    var exercises: [GymExercise]?
    var custom: Bool?
    /// Emoji elegido para la sesión (si no hay, se ve su foto). `session_icon` en la web.
    var session_icon: String?
    /// Portada generada con IA (session-cover) para esta sesión, opcional.
    var cover_url: String? = nil
    var id: String { day }

    init(day: String, type: String, sport: String? = nil, intensity: String? = nil, duration: String? = nil,
         routine_name: String? = nil, muscle_focus: String? = nil, exercises: [GymExercise]? = nil,
         custom: Bool? = nil, session_icon: String? = nil, cover_url: String? = nil) {
        self.day = day; self.type = type; self.sport = sport; self.intensity = intensity; self.duration = duration
        self.routine_name = routine_name; self.muscle_focus = muscle_focus; self.exercises = exercises
        self.custom = custom; self.session_icon = session_icon; self.cover_url = cover_url
    }

    var isGym: Bool { type == "gimnasio" }
    /// Igual que `formatTrainingTitle` de la web: «Full Body A · Pecho, espalda, piernas y core».
    var title: String {
        guard isGym else { return sport ?? "Actividad" }
        let routine = routine_name?.trimmingCharacters(in: .whitespaces) ?? ""
        let focus = muscle_focus?.trimmingCharacters(in: .whitespaces) ?? ""
        if routine.isEmpty { return focus.isEmpty ? "Entreno" : DayPlan.formatFocus(focus) }
        if focus.isEmpty || routine.lowercased().contains(focus.lowercased()) { return routine }
        return "\(routine) · \(DayPlan.formatFocus(focus))"
    }

    static func formatFocus(_ focus: String) -> String {
        // «Cuádriceps, femoral y glúteo» ya trae su «y»: se parte también por ella para no repetirla.
        let parts = focus.replacingOccurrences(of: " y ", with: ",")
            .split(whereSeparator: { "·,;".contains($0) }).map { $0.trimmingCharacters(in: .whitespaces).lowercased() }.filter { !$0.isEmpty }
        guard parts.count >= 2 else { return focus }
        let first = parts[0].prefix(1).uppercased() + parts[0].dropFirst()
        let middle = parts.dropFirst().dropLast()
        return first + (middle.isEmpty ? "" : ", " + middle.joined(separator: ", ")) + " y " + parts.last!
    }
}

/// Lee números o texto indistintamente (el JSON del plan mezcla ambos).
enum FlexibleValue {
    static func string<K: CodingKey>(_ c: KeyedDecodingContainer<K>, _ key: K) -> String? {
        if let s = try? c.decode(String.self, forKey: key) { return s }
        if let i = try? c.decode(Int.self, forKey: key) { return String(i) }
        if let d = try? c.decode(Double.self, forKey: key) { return NumberText.decimal(d, digits: d.truncatingRemainder(dividingBy: 1) == 0 ? 0 : 1) }
        return nil
    }
    static func int<K: CodingKey>(_ c: KeyedDecodingContainer<K>, _ key: K) -> Int? {
        if let i = try? c.decode(Int.self, forKey: key) { return i }
        if let d = try? c.decode(Double.self, forKey: key) { return Int(d) }
        if let s = try? c.decode(String.self, forKey: key) { return s.split(whereSeparator: { !$0.isNumber }).compactMap { Int($0) }.first }
        return nil
    }
}

/// Serie registrada (mismo JSON que `workout_logs.sets_completed`).
struct SetLog: Codable, Hashable {
    var reps: Int
    var weight: String
    var done: Bool
    var isWarmup: Bool?
    /// Bajadas del dropset (opcional, como en la web).
    var drops: [Drop]?
    /// Esfuerzo percibido de la serie (6–10), como el RPE por serie de Hevy. Opcional.
    var rpe: Int?
    /// Serie llevada al fallo (como el marcador de Hevy). Opcional.
    var failure: Bool?

    struct Drop: Codable, Hashable { var reps: Int; var weight: String }

    init(reps: Int, weight: String, done: Bool, isWarmup: Bool?, drops: [Drop]? = nil, rpe: Int? = nil, failure: Bool? = nil) {
        self.reps = reps; self.weight = weight; self.done = done; self.isWarmup = isWarmup; self.drops = drops; self.rpe = rpe; self.failure = failure
    }

    enum CodingKeys: String, CodingKey { case reps, weight, done, isWarmup, drops }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        reps = FlexibleValue.int(c, .reps) ?? 0
        weight = FlexibleValue.string(c, .weight) ?? ""
        done = (try? c.decode(Bool.self, forKey: .done)) ?? false
        isWarmup = try? c.decodeIfPresent(Bool.self, forKey: .isWarmup)
        drops = try? c.decodeIfPresent([Drop].self, forKey: .drops)
    }
}

enum DayNames {
    static let all = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]
    /// Día de hoy en español con lunes primero.
    static var today: String {
        let weekday = Calendar(identifier: .gregorian).component(.weekday, from: Date()) // 1 = domingo
        return all[(weekday + 5) % 7]
    }
}

/// Orden de la rutina (como `routineOrder.ts` de la web). La clave `day` de cada sesión solo fija
/// el ORDEN: cualquier sesión se hace cualquier día. `day_completions` guarda la sesión hecha
/// (`day_label`) y el día real (`completed_at`), así que la siguiente sale de lo hecho esta semana.
/// Nombre e icono de cada sesión: `sessionIdentity.ts` de la web. El nombre es `routine_name`
/// y el icono `session_icon`; la sugerencia sale de los músculos de sus ejercicios (sin IA ni red).
enum SessionIdentity {
    static let emojis = ["💪", "🏋️", "🦵", "🔥", "⚡", "🎯", "🧱", "🦍", "🏃", "🚴", "🏊", "🧘", "🥊", "⛰️", "🏆", "⭐"]

    private static let groups: [(String, String)] = [
        ("full body", "full"), ("cuerpo completo", "full"), ("pecho", "chest"), ("espalda", "back"), ("dorsal", "back"), ("hombro", "shoulders"),
        ("cuadriceps", "legs"), ("cuádriceps", "legs"), ("femoral", "legs"), ("isquio", "legs"), ("pierna", "legs"), ("gemelo", "legs"),
        ("gluteo", "glutes"), ("glúteo", "glutes"), ("biceps", "arms"), ("bíceps", "arms"), ("triceps", "arms"), ("tríceps", "arms"),
        ("brazo", "arms"), ("antebrazo", "arms"), ("core", "core"), ("abdom", "core"), ("lumbar", "core"),
    ]
    private static let order = ["chest", "back", "shoulders", "legs", "glutes", "arms", "core"]
    private static let label = ["chest": "Pecho", "back": "Espalda", "shoulders": "Hombros", "legs": "Piernas", "glutes": "Glúteos", "arms": "Brazos", "core": "Core"]
    private static let sports: [(String, String)] = [
        ("corr", "🏃"), ("run", "🏃"), ("bici", "🚴"), ("cicl", "🚴"), ("spin", "🚴"), ("nata", "🏊"), ("swim", "🏊"),
        ("yoga", "🧘"), ("pilates", "🧘"), ("movil", "🧘"), ("box", "🥊"), ("artes", "🥊"), ("hike", "⛰️"), ("sender", "⛰️"), ("montañ", "⛰️"),
    ]

    /// Grupos musculares en orden fijo; «full» si son cuatro o más (o lo dice el foco).
    static func muscleGroups(_ plan: DayPlan) -> [String] {
        var found = Set<String>()
        let sources = [plan.muscle_focus] + (plan.exercises ?? []).map(\.muscle_group)
        for source in sources {
            let text = (source ?? "").lowercased()
            for (key, group) in groups where text.contains(key) { found.insert(group) }
        }
        if found.contains("full") { return ["full"] }
        let list = order.filter { found.contains($0) }
        return list.count >= 4 ? ["full"] : list
    }

    /// Nombre sugerido: Empuje, Tirón, Pierna, Torso, Cuerpo completo o los dos grupos principales.
    static func suggestedName(_ plan: DayPlan) -> String {
        guard plan.isGym else { return plan.sport?.trimmingCharacters(in: .whitespaces).nilIfEmpty ?? "Actividad" }
        let g = muscleGroups(plan)
        let within = { (allowed: [String]) in g.allSatisfy { allowed.contains($0) } }
        if g.isEmpty { return "Entreno" }
        if g[0] == "full" { return "Cuerpo completo" }
        if g.contains("chest") && within(["chest", "shoulders", "arms"]) { return g.count > 1 ? "Empuje" : "Pecho" }
        if g.contains("back") && within(["back", "arms"]) { return g.count > 1 ? "Tirón" : "Espalda" }
        if (g.contains("legs") || g.contains("glutes")) && within(["legs", "glutes", "core"]) { return "Pierna" }
        if g.contains("chest") && g.contains("back") && within(["chest", "back", "shoulders", "arms"]) { return "Torso" }
        let names = g.prefix(2).compactMap { label[$0] }
        return names.count == 2 ? "\(names[0]) y \(names[1].lowercased())" : names[0]
    }

    /// Icono sugerido, a juego con el nombre sugerido.
    static func suggestedIcon(_ plan: DayPlan) -> String {
        guard plan.isGym else {
            let sport = (plan.sport ?? "").lowercased()
            return sports.first { sport.contains($0.0) }?.1 ?? "🔥"
        }
        switch suggestedName(plan) {
        case "Cuerpo completo": return "⚡"
        case "Pierna", "Piernas", "Glúteos": return "🦵"
        case "Core": return "🎯"
        case "Tirón", "Espalda": return "🦍"
        case "Empuje", "Pecho", "Hombros": return "🏋️"
        default: return "💪"
        }
    }

    /// Solo un emoji corto; cualquier otro texto se ignora (igual que `cleanSessionIcon`).
    static func clean(_ icon: String?) -> String? {
        let value = icon?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        guard !value.isEmpty, value.utf16.count <= 8,
              !value.unicodeScalars.contains(where: { CharacterSet.letters.contains($0) || CharacterSet.decimalDigits.contains($0) })
        else { return nil }
        return value
    }

    /// Plan con el nombre y el icono de una sesión cambiados; el resto, intacto.
    static func applying(_ plans: [DayPlan], day: String, name: String, icon: String?) -> [DayPlan] {
        plans.map { plan in
            guard plan.day == day else { return plan }
            var next = plan
            if plan.isGym { next.routine_name = name.trimmingCharacters(in: .whitespaces) }
            next.session_icon = clean(icon)
            return next
        }
    }
}

enum RoutineOrder {
    /// Sesiones del plan (gimnasio o actividad) en el orden de la rutina, sin días vacíos.
    static func sessions(_ days: [DayPlan]) -> [DayPlan] {
        DayNames.all.compactMap { key in days.first { $0.day == key && ($0.type == "gimnasio" || $0.type == "actividad") } }
    }

    /// La siguiente: la primera de la rutina que aún no se ha hecho esta semana (nil si están todas).
    static func nextPending(_ sessions: [DayPlan], done: Set<String>) -> DayPlan? {
        sessions.first { !done.contains($0.day) }
    }

    /// Lunes de esta semana (yyyy-MM-dd): desde ahí cuenta lo hecho «esta semana».
    static var weekStart: String {
        LocalDate.daysAgo(DayNames.all.firstIndex(of: DayNames.today) ?? 0)
    }

    /// Sesiones hechas esta semana a partir de las filas de `day_completions`.
    static func doneThisWeek(_ completions: [(day: String, date: String)]) -> Set<String> {
        let start = weekStart
        return Set(completions.filter { $0.date >= start }.map(\.day))
    }
}

enum LocalDate {
    /// Formateador compartido: `LocalDate.string()` se llama desde cuerpos de vista (Inicio,
    /// Entrenar…) y crear un `DateFormatter` en cada llamada era una fuente de tirones.
    private static let ymd: DateFormatter = {
        let f = DateFormatter()
        f.calendar = Calendar(identifier: .gregorian)
        f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = "yyyy-MM-dd"
        return f
    }()

    static func string(_ date: Date = Date()) -> String {
        ymd.string(from: date)
    }
    static func daysAgo(_ n: Int) -> String {
        string(Calendar.current.date(byAdding: .day, value: -n, to: Date()) ?? Date())
    }
}

/// Filas de `day_completions` tal y como las usa la app: (día, fecha).
private typealias CompletionRows = [(day: String, date: String)]

/// Caché en memoria compartida de `TrainingRepo`.
/// Inicio y Entrenar piden el plan y las completions cada vez que aparecen: sin caché eran varias
/// idas y vueltas por visita (con el modelo en esqueleto). Con caché la primera pintada es
/// inmediata y la red solo refresca. Las escrituras invalidan lo que cambian.
private final class TrainingCache: @unchecked Sendable {
    static let shared = TrainingCache()

    struct PlanEntry { let days: [DayPlan]; let at: Date }
    struct CompletionsEntry { let since: String; let rows: CompletionRows; let at: Date }
    struct PreviousKey: Hashable { let userId: UUID; let names: [String] }

    private let lock = NSLock()
    private var plans: [UUID: PlanEntry] = [:]
    private var completions: [UUID: CompletionsEntry] = [:]
    private var completionsInflight: [UUID: (since: String, task: Task<CompletionRows?, Never>)] = [:]
    private var previousSetsCache: [PreviousKey: (value: [String: [SetLog]], at: Date)] = [:]
    private var previousRpeCache: [PreviousKey: (value: Int?, at: Date)] = [:]
    /// Sube con cada cambio local (sesión hecha, rutina guardada): las cachés de pantalla se rehacen.
    private var revisions: [UUID: Int] = [:]

    func bump(userId: UUID) {
        lock.lock(); defer { lock.unlock() }
        revisions[userId, default: 0] += 1
    }

    func revision(userId: UUID) -> Int {
        lock.lock(); defer { lock.unlock() }
        return revisions[userId] ?? 0
    }

    /// Topes para que la caché no crezca sin límite al cambiar de cuenta.
    private let maxUsers = 10
    private let maxPrevious = 24

    // MARK: Plan

    func plan(userId: UUID, maxAge: TimeInterval) -> [DayPlan]? {
        lock.lock(); defer { lock.unlock() }
        guard let entry = plans[userId] else { return nil }
        // Un plan vacío casi siempre es «aún no generado»: caduca antes para no ocultar durante
        // dos minutos un plan recién creado (por ejemplo desde la web).
        let ttl = entry.days.isEmpty ? min(maxAge, 10) : maxAge
        guard Date().timeIntervalSince(entry.at) < ttl else { return nil }
        return entry.days
    }

    func storePlan(_ days: [DayPlan], userId: UUID) {
        lock.lock(); defer { lock.unlock() }
        plans[userId] = PlanEntry(days: days, at: Date())
        if plans.count > maxUsers { plans.removeAll() }
    }

    // MARK: Completions

    func completions(userId: UUID, since: String, maxAge: TimeInterval) -> CompletionRows? {
        lock.lock(); defer { lock.unlock() }
        guard let entry = completions[userId], entry.since <= since,
              Date().timeIntervalSince(entry.at) < maxAge else { return nil }
        return entry.rows.filter { $0.date >= since }
    }

    /// Devuelve la consulta en vuelo que ya cubre `since` o arranca una nueva. Así Inicio, Entrenar,
    /// Progreso y el prefetch del plan comparten la misma petición en vez de duplicarla.
    func inflightOrStart(userId: UUID, since: String,
                         start: () -> Task<CompletionRows?, Never>) -> (since: String, task: Task<CompletionRows?, Never>, owner: Bool) {
        lock.lock(); defer { lock.unlock() }
        if let item = completionsInflight[userId], item.since <= since { return (item.since, item.task, false) }
        let task = start()
        completionsInflight[userId] = (since, task)
        return (since, task, true)
    }

    func clearInflight(userId: UUID, since: String) {
        lock.lock(); defer { lock.unlock() }
        if let item = completionsInflight[userId], item.since == since { completionsInflight[userId] = nil }
    }

    func storeCompletions(_ rows: CompletionRows, userId: UUID, since: String) {
        lock.lock(); defer { lock.unlock() }
        // Si ya hay una entrada más amplia y fresca (p. ej. Progreso pidió 27 días), se conserva.
        if let existing = completions[userId], existing.since <= since,
           Date().timeIntervalSince(existing.at) < cacheCompletionsTTL { return }
        completions[userId] = CompletionsEntry(since: since, rows: rows, at: Date())
        if completions.count > maxUsers { completions.removeAll() }
    }

    // MARK: «Previa» y RPE

    func previousSets(key: PreviousKey) -> [String: [SetLog]]? {
        lock.lock(); defer { lock.unlock() }
        guard let entry = previousSetsCache[key], Date().timeIntervalSince(entry.at) < cachePreviousTTL else { return nil }
        return entry.value
    }

    func storePreviousSets(_ value: [String: [SetLog]], key: PreviousKey) {
        lock.lock(); defer { lock.unlock() }
        previousSetsCache[key] = (value, Date())
        if previousSetsCache.count > maxPrevious { previousSetsCache.removeAll() }
    }

    /// `nil` = no hay entrada en caché; `.some(nil)` = sí hay y el valor es «sin RPE».
    func previousRpe(key: PreviousKey) -> Int?? {
        lock.lock(); defer { lock.unlock() }
        guard let entry = previousRpeCache[key], Date().timeIntervalSince(entry.at) < cachePreviousTTL else { return nil }
        return .some(entry.value)
    }

    func storePreviousRpe(_ value: Int?, key: PreviousKey) {
        lock.lock(); defer { lock.unlock() }
        previousRpeCache[key] = (value, Date())
        if previousRpeCache.count > maxPrevious { previousRpeCache.removeAll() }
    }

    // MARK: Invalidación

    func invalidateCompletions(userId: UUID) {
        lock.lock(); defer { lock.unlock() }
        completions[userId] = nil
        completionsInflight[userId] = nil
    }

    func invalidatePrevious(userId: UUID) {
        lock.lock(); defer { lock.unlock() }
        for key in previousSetsCache.keys.filter({ $0.userId == userId }) { previousSetsCache.removeValue(forKey: key) }
        for key in previousRpeCache.keys.filter({ $0.userId == userId }) { previousRpeCache.removeValue(forKey: key) }
    }

    func invalidate(userId: UUID) {
        lock.lock(); defer { lock.unlock() }
        plans[userId] = nil
        completions[userId] = nil
        completionsInflight[userId] = nil
        for key in previousSetsCache.keys.filter({ $0.userId == userId }) { previousSetsCache.removeValue(forKey: key) }
        for key in previousRpeCache.keys.filter({ $0.userId == userId }) { previousRpeCache.removeValue(forKey: key) }
    }

    func invalidateAll() {
        lock.lock(); defer { lock.unlock() }
        plans.removeAll()
        completions.removeAll()
        completionsInflight.removeAll()
        previousSetsCache.removeAll()
        previousRpeCache.removeAll()
    }
}

/// Lecturas y escrituras de entrenamiento contra las mismas tablas que la web.
enum TrainingRepo {
    /// «Actualizar» (menú) tira la caché entera para que la siguiente carga vaya a la red.
    private static let refreshObserver: NSObjectProtocol = NotificationCenter.default.addObserver(
        forName: .refreshSection, object: nil, queue: nil) { _ in
        TrainingCache.shared.invalidateAll()
    }

    static func plan(userId: UUID, force: Bool = false) async throws -> [DayPlan] {
        _ = refreshObserver
        if !force, let cached = TrainingCache.shared.plan(userId: userId, maxAge: cachePlanTTL) {
            prefetchCompletions(userId: userId)
            return cached
        }
        // La copia en disco ya pinta al abrir (`instantPlan`); aquí manda la red para que un cambio
        // hecho en la web o por el piloto automático llegue enseguida. Sin red, la copia en disco.
        let fetched: [DayPlan]
        do {
            fetched = try await fetchPlan(userId: userId)
        } catch {
            if !force, let disk = Snapshots.load([DayPlan].self, planKey(userId)) {
                TrainingCache.shared.storePlan(disk, userId: userId)
                return disk
            }
            throw error
        }
        let days = await withImages(fetched)
        TrainingCache.shared.storePlan(days, userId: userId)
        Snapshots.save(days, planKey(userId))
        // PlanModel pide el plan y *después* las completions, en serie: se adelanta la segunda
        // consulta aquí para que esa espera ya la encuentre hecha (o comparta la petición en vuelo).
        prefetchCompletions(userId: userId)
        return days
    }

    /// Guarda el nombre y el icono de una sesión tocando solo esos campos del JSON guardado
    /// (no se pierde nada que la app no conozca) y actualiza la caché de memoria y disco.
    static func saveSessionIdentity(userId: UUID, plans: [DayPlan], day: String, name: String, icon: String?) async throws -> [DayPlan] {
        struct Row: Decodable { let workouts_json: AnyJSON }
        let rows: [Row] = try await Backend.client.from("training_plan").select("workouts_json")
            .eq("user_id", value: userId).limit(1).execute().value
        guard case .array(var list)? = rows.first?.workouts_json else { throw URLError(.cannotParseResponse) }
        let icon = SessionIdentity.clean(icon)
        for index in list.indices {
            guard case .object(var object) = list[index], case .string(let key)? = object["day"], key == day else { continue }
            if case .string("gimnasio")? = object["type"] { object["routine_name"] = .string(name.trimmingCharacters(in: .whitespaces)) }
            if let icon { object["session_icon"] = .string(icon) } else { object.removeValue(forKey: "session_icon") }
            list[index] = .object(object)
        }
        struct Update: Encodable { let workouts_json: AnyJSON; let updated_at: String }
        try await Backend.client.from("training_plan")
            .update(Update(workouts_json: .array(list), updated_at: ISO8601DateFormatter().string(from: Date())))
            .eq("user_id", value: userId).execute()
        let next = SessionIdentity.applying(plans, day: day, name: name, icon: icon)
        storePlanLocally(userId: userId, next)
        return next
    }

    private static func planKey(_ userId: UUID) -> String { "plan|\(userId.uuidString.lowercased())" }

    /// «Preparar mi rutina gratis» (web `Dashboard.tsx`): generate-plan sin `force`, así que una
    /// rutina manual nunca se sustituye. Al terminar, la rutina nueva queda en caché y en disco.
    static func generateStarterPlan(userId: UUID) async -> Bool {
        struct Result: Decodable { let success: Bool?; let protected: Bool? }
        guard let r: Result = try? await Backend.client.functions.invoke(
            "generate-plan", options: FunctionInvokeOptions(body: ["user_id": userId.uuidString.lowercased()])),
              r.success == true || r.protected == true else { return false }
        _ = try? await plan(userId: userId, force: true)
        return true
    }

    /// Rellena la foto de los ejercicios que no la traen en el plan (p. ej. rutinas creadas a
    /// mano o generadas antes de tener imagen) con la de la biblioteca, buscando por nombre.
    static func withImages(_ days: [DayPlan]) async -> [DayPlan] {
        let missing = Set(days.flatMap { $0.exercises ?? [] }.filter { ($0.image_url ?? "").isEmpty }.map(\.name))
        guard !missing.isEmpty else { return days }
        struct R: Decodable { let name: String; let image_url: String? }
        let rows: [R] = (try? await Backend.client.from("exercises").select("name, image_url")
            .in("name", values: Array(missing)).execute().value) ?? []
        var byName: [String: String] = [:]
        for r in rows { if let u = r.image_url, !u.isEmpty { byName[r.name] = u } }
        guard !byName.isEmpty else { return days }
        return days.map { d in
            var d = d
            d.exercises = d.exercises?.map { e in
                var e = e
                if (e.image_url ?? "").isEmpty { e.image_url = byName[e.name] }
                return e
            }
            return d
        }
    }

    /// Plan cacheado aunque esté algo viejo: permite pintar al instante antes de refrescar.
    static func cachedPlan(userId: UUID) -> [DayPlan]? {
        TrainingCache.shared.plan(userId: userId, maxAge: .infinity)
    }

    /// Plan para el primer fotograma, sin red: el de memoria o, si no, la copia en disco.
    static func instantPlan(userId: UUID) -> [DayPlan]? {
        if let cached = TrainingCache.shared.plan(userId: userId, maxAge: .infinity) { return cached }
        guard let disk = Snapshots.load([DayPlan].self, planKey(userId)) else { return nil }
        TrainingCache.shared.storePlan(disk, userId: userId)
        return disk
    }

    /// Completions para el primer fotograma, sin red: las de memoria o la copia en disco de Entrenar.
    static func instantCompletions(userId: UUID, since: String) -> [(day: String, date: String)]? {
        if let hit = cachedCompletions(userId: userId, since: since) { return hit }
        guard let rows = Snapshots.load([[String]].self, completionsKey(userId)) else { return nil }
        return rows.compactMap { row -> (day: String, date: String)? in
            row.count == 2 ? (day: row[0], date: row[1]) : nil
        }.filter { $0.date >= since }
    }

    /// Guarda en disco las completions recientes (Entrenar las pinta al instante la próxima vez).
    static func saveCompletionsSnapshot(userId: UUID, _ rows: [(day: String, date: String)]) {
        Snapshots.save(rows.map { [$0.day, $0.date] }, completionsKey(userId))
    }

    private static func completionsKey(_ userId: UUID) -> String { "completions|\(userId.uuidString.lowercased())" }

    private static func fetchPlan(userId: UUID) async throws -> [DayPlan] {
        struct Row: Decodable { let workouts_json: AnyJSON }
        let rows: [Row] = try await Backend.client.from("training_plan").select("workouts_json")
            .eq("user_id", value: userId).limit(1).execute().value
        guard let json = rows.first?.workouts_json else { return [] }
        let data = try JSONEncoder().encode(json)
        if let days = try? JSONDecoder().decode([DayPlan].self, from: data) { return days }
        struct Wrapped: Decodable { let days: [DayPlan]? ; let workouts: [DayPlan]? }
        let wrapped = try? JSONDecoder().decode(Wrapped.self, from: data)
        return wrapped?.days ?? wrapped?.workouts ?? []
    }

    /// Últimas series de cada ejercicio, para proponer peso y repeticiones.
    static func previousSets(userId: UUID, exercises: [String], force: Bool = false) async -> [String: [SetLog]] {
        _ = refreshObserver
        guard !exercises.isEmpty else { return [:] }
        let key = TrainingCache.PreviousKey(userId: userId, names: exercises.sorted())
        if !force, let cached = TrainingCache.shared.previousSets(key: key) { return cached }
        guard let rows = await fetchPreviousSets(userId: userId, exercises: exercises) else { return [:] }
        TrainingCache.shared.storePreviousSets(rows, key: key)
        return rows
    }

    private static func fetchPreviousSets(userId: UUID, exercises: [String]) async -> [String: [SetLog]]? {
        struct Row: Decodable { let exercise_name: String; let sets_completed: [SetLog]?; let logged_at: String }
        guard let rows: [Row] = try? await Backend.client.from("workout_logs")
            .select("exercise_name, sets_completed, logged_at").eq("user_id", value: userId)
            .in("exercise_name", values: exercises).order("logged_at", ascending: false).limit(200)
            .execute().value else { return nil }
        var out: [String: [SetLog]] = [:]
        for row in rows where out[row.exercise_name] == nil { out[row.exercise_name] = row.sets_completed ?? [] }
        return out
    }

    /// Esfuerzo de la última sesión de estos ejercicios (para no subir carga tras un RPE ≥ 9).
    static func previousRpe(userId: UUID, exercises: [String], force: Bool = false) async -> Int? {
        _ = refreshObserver
        guard !exercises.isEmpty else { return nil }
        let key = TrainingCache.PreviousKey(userId: userId, names: exercises.sorted())
        if !force, let cached = TrainingCache.shared.previousRpe(key: key) { return cached }
        guard let value = await fetchPreviousRpe(userId: userId, exercises: exercises) else { return nil }
        TrainingCache.shared.storePreviousRpe(value, key: key)
        return value
    }

    private static func fetchPreviousRpe(userId: UUID, exercises: [String]) async -> Int?? {
        struct Row: Decodable { let rpe: Int? }
        guard let rows: [Row] = try? await Backend.client.from("workout_logs").select("rpe")
            .eq("user_id", value: userId).in("exercise_name", values: exercises).not("rpe", operator: .is, value: "null")
            .order("logged_at", ascending: false).limit(1).execute().value else { return nil }
        return .some(rows.first?.rpe)
    }

    static func saveLogs(userId: UUID, day: String, date: String, logs: [String: [SetLog]], rpe: Int?) async throws {
        struct Insert: Encodable {
            let user_id: UUID; let day_label: String; let exercise_name: String
            let sets_completed: [SetLog]; let logged_at: String; let rpe: Int?
        }
        let rows = logs.map { Insert(user_id: userId, day_label: day, exercise_name: $0.key, sets_completed: $0.value, logged_at: date, rpe: rpe) }
        guard !rows.isEmpty else { return }
        // Como la web: se borran las filas de ese día y se insertan limpias. Con `upsert` a secas,
        // reintentar el guardado chocaba con las filas ya escritas y fallaba.
        try await Backend.client.from("workout_logs")
            .delete().eq("user_id", value: userId).eq("day_label", value: day).eq("logged_at", value: date).execute()
        try await Backend.client.from("workout_logs").insert(rows).execute()
        // La «Previa» de la próxima sesión ya no es la misma.
        TrainingCache.shared.invalidatePrevious(userId: userId)
    }

    static func complete(userId: UUID, day: String, date: String, rpe: Int?) async throws {
        struct Insert: Encodable { let user_id: UUID; let day_label: String; let completed_at: String; let rpe: Int? }
        // Igual que la web: borrar la marca de ese día y volver a crearla (idempotente al reintentar).
        try await Backend.client.from("day_completions")
            .delete().eq("user_id", value: userId).eq("day_label", value: day).eq("completed_at", value: date).execute()
        try await Backend.client.from("day_completions").insert(Insert(user_id: userId, day_label: day, completed_at: date, rpe: rpe)).execute()
        // Inicio, Entrenar, Progreso y la racha leen esto: se invalida para que la siguiente
        // carga sea fresca (y para que la caché nunca oculte el entreno recién terminado).
        TrainingCache.shared.invalidateCompletions(userId: userId)
        // La copia en disco ya la incluye: Inicio y Entrenar la pintan hecha sin esperar a la red.
        var rows = (Snapshots.load([[String]].self, completionsKey(userId)) ?? []).filter { $0 != [day, date] }
        rows.append([day, date])
        Snapshots.save(rows, completionsKey(userId))
        TrainingCache.shared.bump(userId: userId)
    }

    /// Versión de lo guardado en este dispositivo para el usuario (cambia al terminar o editar).
    static func revision(userId: UUID) -> Int { TrainingCache.shared.revision(userId: userId) }

    /// Rutina recién guardada desde la app: memoria y disco al día, sin esperar a la red.
    static func storePlanLocally(userId: UUID, _ plans: [DayPlan]) {
        TrainingCache.shared.storePlan(plans, userId: userId)
        Snapshots.save(plans, planKey(userId))
        TrainingCache.shared.bump(userId: userId)
    }

    static func completions(userId: UUID, since: String, force: Bool = false) async -> [(day: String, date: String)] {
        _ = refreshObserver
        let cache = TrainingCache.shared
        if !force, let hit = cache.completions(userId: userId, since: since, maxAge: cacheCompletionsTTL) { return hit }

        let flight = cache.inflightOrStart(userId: userId, since: since) {
            Task { await fetchCompletions(userId: userId, since: since) }
        }
        let rows = await flight.task.value
        if flight.owner { cache.clearInflight(userId: userId, since: flight.since) }
        guard let rows else { return [] }
        cache.storeCompletions(rows, userId: userId, since: flight.since)
        return rows.filter { $0.date >= since }
    }

    /// Completions cacheadas aunque estén algo viejas (para pintar antes de refrescar).
    static func cachedCompletions(userId: UUID, since: String) -> [(day: String, date: String)]? {
        TrainingCache.shared.completions(userId: userId, since: since, maxAge: .infinity)
    }

    private static func fetchCompletions(userId: UUID, since: String) async -> CompletionRows? {
        struct Row: Decodable { let day_label: String; let completed_at: String }
        do {
            let rows: [Row] = try await Backend.client.from("day_completions").select("day_label, completed_at")
                .eq("user_id", value: userId).gte("completed_at", value: since).execute().value
            return rows.map { ($0.day_label, $0.completed_at) }
        } catch { return nil }
    }

    /// Arranca (o comparte) la consulta de completions de la ventana que usan Inicio y Entrenar.
    private static func prefetchCompletions(userId: UUID) {
        let since = LocalDate.daysAgo(6)
        guard TrainingCache.shared.completions(userId: userId, since: since, maxAge: cacheCompletionsTTL) == nil else { return }
        Task { _ = await completions(userId: userId, since: since) }
    }

    /// Invalida la caché de un usuario (cambio de cuenta, datos editados fuera…).
    static func invalidate(userId: UUID) { TrainingCache.shared.invalidate(userId: userId) }
    /// Invalida toda la caché de entrenamiento.
    static func invalidateAll() { TrainingCache.shared.invalidateAll() }
}

/// Edad máxima de cada dato cacheado (ver `TrainingCache`).
private let cachePlanTTL: TimeInterval = 120
/// Las completions se invalidan al terminar un entreno; el TTL es solo la red de seguridad.
private let cacheCompletionsTTL: TimeInterval = 60
/// «Previa» y RPE de la última sesión: se invalidan al guardar un entreno.
private let cachePreviousTTL: TimeInterval = 120
