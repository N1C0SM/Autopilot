import Foundation
import Supabase

/// Mismo formato que `supabase/functions/_shared/training-types.ts`.
struct GymExercise: Codable, Hashable, Identifiable {
    var exercise_id: String
    var name: String
    var series: Int
    var reps: Int
    var weight: String
    var rest: String
    var image_url: String?
    var muscle_group: String?
    var id: String { exercise_id + name }

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
    var id: String { day }

    var isGym: Bool { type == "gimnasio" }
    var title: String {
        if isGym { return routine_name ?? muscle_focus ?? "Entreno" }
        return sport ?? "Actividad"
    }
}

/// Serie registrada (mismo JSON que `workout_logs.sets_completed`).
struct SetLog: Codable, Hashable {
    var reps: Int
    var weight: String
    var done: Bool
    var isWarmup: Bool?
}

enum DayNames {
    static let all = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]
    /// Día de hoy en español con lunes primero.
    static var today: String {
        let weekday = Calendar(identifier: .gregorian).component(.weekday, from: Date()) // 1 = domingo
        return all[(weekday + 5) % 7]
    }
}

enum LocalDate {
    static func string(_ date: Date = Date()) -> String {
        let f = DateFormatter()
        f.calendar = Calendar(identifier: .gregorian)
        f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = "yyyy-MM-dd"
        return f.string(from: date)
    }
    static func daysAgo(_ n: Int) -> String {
        string(Calendar.current.date(byAdding: .day, value: -n, to: Date()) ?? Date())
    }
}

/// Lecturas y escrituras de entrenamiento contra las mismas tablas que la web.
enum TrainingRepo {
    static func plan(userId: UUID) async throws -> [DayPlan] {
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
    static func previousSets(userId: UUID, exercises: [String]) async -> [String: [SetLog]] {
        struct Row: Decodable { let exercise_name: String; let sets_completed: [SetLog]?; let logged_at: String }
        guard !exercises.isEmpty, let rows: [Row] = try? await Backend.client.from("workout_logs")
            .select("exercise_name, sets_completed, logged_at").eq("user_id", value: userId)
            .in("exercise_name", values: exercises).order("logged_at", ascending: false).limit(200)
            .execute().value else { return [:] }
        var out: [String: [SetLog]] = [:]
        for row in rows where out[row.exercise_name] == nil { out[row.exercise_name] = row.sets_completed ?? [] }
        return out
    }

    static func saveLogs(userId: UUID, day: String, date: String, logs: [String: [SetLog]], rpe: Int?) async throws {
        struct Insert: Encodable {
            let user_id: UUID; let day_label: String; let exercise_name: String
            let sets_completed: [SetLog]; let logged_at: String; let rpe: Int?
        }
        let rows = logs.map { Insert(user_id: userId, day_label: day, exercise_name: $0.key, sets_completed: $0.value, logged_at: date, rpe: rpe) }
        guard !rows.isEmpty else { return }
        try await Backend.client.from("workout_logs")
            .upsert(rows, onConflict: "user_id,day_label,logged_at,exercise_name").execute()
    }

    static func complete(userId: UUID, day: String, date: String, rpe: Int?) async throws {
        struct Insert: Encodable { let user_id: UUID; let day_label: String; let completed_at: String; let rpe: Int? }
        try await Backend.client.from("day_completions")
            .upsert(Insert(user_id: userId, day_label: day, completed_at: date, rpe: rpe)).execute()
    }

    static func completions(userId: UUID, since: String) async -> [(day: String, date: String)] {
        struct Row: Decodable { let day_label: String; let completed_at: String }
        let rows: [Row] = (try? await Backend.client.from("day_completions").select("day_label, completed_at")
            .eq("user_id", value: userId).gte("completed_at", value: since).execute().value) ?? []
        return rows.map { ($0.day_label, $0.completed_at) }
    }
}
