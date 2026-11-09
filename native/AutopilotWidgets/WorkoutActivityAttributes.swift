import ActivityKit
import Foundation

/// Atributos estáticos y estado dinámico de la Live Activity del tracker.
/// Estáticos: título de la sesión (no cambia mientras entrenas).
/// Dinámicos: ejercicio actual, series, descanso y duración.
public struct WorkoutActivityAttributes: ActivityAttributes {
    public typealias ContentState = WorkoutState

    /// Nombre de la sesión: «Pecho y tríceps», «Full Body A»…
    public let sessionTitle: String

    /// Estado que se actualiza en tiempo real.
    public struct WorkoutState: Codable, Hashable {
        /// Nombre del ejercicio actual.
        public var exerciseName: String
        /// Series completadas / totales (no calentamiento).
        public var doneSets: Int
        public var totalSets: Int
        /// Fin del descanso en curso (nil si no hay).
        public var restEndsAt: Date?
        /// Inicio del entrenamiento para el cronómetro.
        public var startedAt: Date
        /// En pausa (el cronómetro se congela).
        public var isPaused: Bool
        /// Volumen acumulado redondeado al entero.
        public var volumeKg: Int
    }

    public init(sessionTitle: String) {
        self.sessionTitle = sessionTitle
    }
}
