import AppIntents
import Foundation

// Atajos de Siri y de la app Atajos. Cada intent abre la app en su pestaña con el
// esquema autopilot://, que NativeDeepLinks.tsx lleva a /dashboard?section=…
// (sin tocar datos: abrir la app es lo único que hacen).

@available(iOS 18.0, *)
private func openSection(_ section: String) -> OpenURLIntent {
    OpenURLIntent(URL(string: "autopilot://open?next=/dashboard?section=\(section)")!)
}

@available(iOS 18.0, *)
struct StartTodayWorkoutIntent: AppIntent {
    static let title: LocalizedStringResource = "Entrenar hoy"
    static let description = IntentDescription("Abre Autopilot en el entrenamiento de hoy.")
    func perform() async throws -> some IntentResult & OpensIntent {
        .result(opensIntent: openSection("training"))
    }
}

@available(iOS 18.0, *)
struct ShowProgressIntent: AppIntent {
    static let title: LocalizedStringResource = "Ver mi progreso"
    static let description = IntentDescription("Abre tu progreso, récords e historial.")
    func perform() async throws -> some IntentResult & OpensIntent {
        .result(opensIntent: openSection("progress"))
    }
}

@available(iOS 18.0, *)
struct ShowNutritionIntent: AppIntent {
    static let title: LocalizedStringResource = "Ver mi nutrición"
    static let description = IntentDescription("Abre tus calorías, macros y comidas de hoy.")
    func perform() async throws -> some IntentResult & OpensIntent {
        .result(opensIntent: openSection("nutrition"))
    }
}

@available(iOS 18.0, *)
struct AutopilotShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: StartTodayWorkoutIntent(),
            phrases: ["Entrenar con \(.applicationName)", "Empieza mi entreno en \(.applicationName)", "Qué toca hoy en \(.applicationName)"],
            shortTitle: "Entrenar hoy",
            systemImageName: "dumbbell.fill"
        )
        AppShortcut(
            intent: ShowProgressIntent(),
            phrases: ["Mi progreso en \(.applicationName)", "Ver mis récords en \(.applicationName)"],
            shortTitle: "Mi progreso",
            systemImageName: "chart.line.uptrend.xyaxis"
        )
        AppShortcut(
            intent: ShowNutritionIntent(),
            phrases: ["Mi nutrición en \(.applicationName)", "Qué como hoy en \(.applicationName)"],
            shortTitle: "Mi nutrición",
            systemImageName: "fork.knife"
        )
    }
}
