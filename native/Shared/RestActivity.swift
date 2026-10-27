import Foundation
#if os(iOS)
import ActivityKit

/// Descanso entre series en la isla dinámica y la pantalla de bloqueo.
struct RestActivityAttributes: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        var endsAt: Date
        var exercise: String
        var nextSet: String
        var doneSets: Int
        var totalSets: Int
    }
    var workoutTitle: String
}
#endif

/// Datos que la app deja para los widgets (mismo grupo de apps).
enum WidgetStore {
    static let group = "group.app.autopilotplan"
    struct Snapshot: Codable {
        var title: String          // «Full Body A» o «Descanso»
        var detail: String         // «7 ejercicios · 18 series»
        var isRest: Bool
        var doneToday: Bool
        var weekDone: Int
        var weekPlanned: Int
        var weekDays: [Int]        // 0 = nada, 1 = con sesión, 2 = hecho (L…D)
        var todayIndex: Int
        var updated: Date
    }
    static func save(_ s: Snapshot) {
        guard let d = try? JSONEncoder().encode(s) else { return }
        UserDefaults(suiteName: group)?.set(d, forKey: "snapshot")
    }
    static func load() -> Snapshot? {
        guard let d = UserDefaults(suiteName: group)?.data(forKey: "snapshot") else { return nil }
        return try? JSONDecoder().decode(Snapshot.self, from: d)
    }
}
