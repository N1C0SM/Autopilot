#if os(iOS)
import ActivityKit
import Foundation

/// Live Activity del entreno (pantalla de bloqueo e isla dinámica del iPhone). Este archivo se
/// compila igual en la app (que la empieza, la actualiza y la termina: `WorkoutActivityController`)
/// y en la extensión de widgets (que la pinta: `WorkoutLiveActivity`). Solo iPhone: en el Mac no existe.
public struct WorkoutActivityAttributes: ActivityAttributes {
    public typealias ContentState = WorkoutState

    /// Nombre de la sesión: «Full Body A», «Pecho y tríceps»…
    public let sessionTitle: String
    /// Identidad del borrador (usuario, día y fecha): al volver a la misma sesión se reutiliza su actividad.
    public let sessionID: String

    /// Lo que cambia mientras entrenas. Los tiempos son fechas absolutas: el sistema cuenta el
    /// cronómetro y el descanso solo (`Text(timerInterval:)`), sin una actualización por segundo.
    public struct WorkoutState: Codable, Hashable {
        /// Ejercicio actual y su posición en la sesión (1…).
        public var exerciseName: String
        public var exerciseNumber: Int
        public var exerciseCount: Int
        /// Serie que toca en ese ejercicio (1…) y sus series (sin calentamiento).
        public var setNumber: Int
        public var setCount: Int
        /// Series hechas y totales de la sesión (sin calentamiento).
        public var doneSets: Int
        public var totalSets: Int
        /// Descanso en curso: inicio y fin (nil sin descanso).
        public var restStartedAt: Date?
        public var restEndsAt: Date?
        /// Inicio del cronómetro (al reanudar una pausa se desplaza, como en la app).
        public var startedAt: Date
        /// En pausa: el cronómetro y el descanso se quedan quietos en este instante.
        public var pausedAt: Date?
        /// Entreno terminado: el tiempo se queda fijo en este instante.
        public var finishedAt: Date?

        public init(exerciseName: String, exerciseNumber: Int, exerciseCount: Int, setNumber: Int, setCount: Int,
                    doneSets: Int, totalSets: Int, restStartedAt: Date?, restEndsAt: Date?, startedAt: Date,
                    pausedAt: Date?, finishedAt: Date?) {
            self.exerciseName = exerciseName
            self.exerciseNumber = exerciseNumber
            self.exerciseCount = exerciseCount
            self.setNumber = setNumber
            self.setCount = setCount
            self.doneSets = doneSets
            self.totalSets = totalSets
            self.restStartedAt = restStartedAt
            self.restEndsAt = restEndsAt
            self.startedAt = startedAt
            self.pausedAt = pausedAt
            self.finishedAt = finishedAt
        }
    }

    public init(sessionTitle: String, sessionID: String) {
        self.sessionTitle = sessionTitle
        self.sessionID = sessionID
    }
}

/// Textos de la Live Activity, los mismos en la app y en la extensión (y con su plural).
public enum WorkoutActivityText {
    public static let paused = "En pausa"
    public static let rest = "Descanso"
    public static let finished = "Entreno completado"
    public static let nextSet = "Siguiente serie"

    /// «Serie 2 de 4».
    public static func setLine(_ s: WorkoutActivityAttributes.WorkoutState) -> String {
        "Serie \(s.setNumber) de \(s.setCount)"
    }

    /// «Ejercicio 1 de 6».
    public static func exerciseLine(_ s: WorkoutActivityAttributes.WorkoutState) -> String {
        "Ejercicio \(s.exerciseNumber) de \(s.exerciseCount)"
    }

    /// «3 de 12 series» / «1 de 1 serie», como el avance de la barra del entreno.
    public static func progress(_ s: WorkoutActivityAttributes.WorkoutState) -> String {
        "\(s.doneSets) de \(s.totalSets) \(s.totalSets == 1 ? "serie" : "series")"
    }
}

public extension WorkoutActivityAttributes.WorkoutState {
    /// Hay un descanso abierto (corriendo o quieto en pausa) y el entreno no ha terminado.
    var isResting: Bool { restEndsAt != nil && finishedAt == nil }

    /// Rango del cronómetro: desde el inicio, con techo de 12 h (lo máximo que vive una Live Activity).
    var elapsedRange: ClosedRange<Date> { startedAt...startedAt.addingTimeInterval(12 * 3600) }

    /// Instante en el que el cronómetro se queda quieto: al terminar o en pausa.
    var elapsedFrozenAt: Date? { finishedAt ?? pausedAt }

    /// Rango de la cuenta atrás del descanso (nil sin descanso).
    var restRange: ClosedRange<Date>? {
        guard let end = restEndsAt else { return nil }
        let start = min(restStartedAt ?? end, end)
        return start...end
    }

    /// Lo descansado ya, de 0 a 1, para la barra quieta en pausa.
    var restFraction: Double {
        guard let range = restRange else { return 0 }
        let total = range.upperBound.timeIntervalSince(range.lowerBound)
        guard total > 0 else { return 1 }
        let now = pausedAt ?? Date()
        return max(0, min(1, now.timeIntervalSince(range.lowerBound) / total))
    }
}
#endif
