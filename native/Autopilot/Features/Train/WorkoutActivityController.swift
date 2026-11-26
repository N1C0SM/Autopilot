import Foundation
#if os(iOS)
import ActivityKit
import Combine
#endif

/// Live Activity del entreno en curso (pantalla de bloqueo e isla dinámica del iPhone, pintada por
/// `WorkoutLiveActivity` en la extensión de widgets). Empieza con la sesión, se actualiza con cada
/// serie, ejercicio, descanso y pausa, y se termina al finalizar (se queda unos minutos en la
/// pantalla de bloqueo con el resumen) o al descartar (desaparece al momento). El tiempo y el
/// descanso los cuenta el sistema, así que no hace falta actualizarla cada segundo. Al salir del
/// entreno sin terminarlo sigue viva: la sesión sigue guardada y en marcha. En el Mac no existe y
/// todo es una llamada vacía.
@MainActor
final class WorkoutActivityController {
    static let shared = WorkoutActivityController()

    /// Al terminar, el resumen se queda este tiempo en la pantalla de bloqueo.
    static let finishedDismissal: TimeInterval = 15 * 60

    #if os(iOS)
    private var activity: Activity<WorkoutActivityAttributes>?
    private var subscription: AnyCancellable?
    private var lastState: WorkoutActivityAttributes.ContentState?
    #endif

    private init() {}

    /// Identidad de la sesión (usuario, día y fecha): volver a la misma reutiliza su actividad.
    static func sessionID(_ draft: WorkoutDraft) -> String {
        "\(draft.userId)|\(draft.day.day)|\(draft.date)"
    }

    /// Empieza (o retoma) la actividad de este entreno y la mantiene al día mientras está abierto.
    func track(_ workout: ActiveWorkout, title: String) {
        #if os(iOS)
        // Un entreno ya guardado no vuelve a empezar otra (la suya sigue con «Entreno completado»).
        guard workout.finishedAt == nil, ActivityAuthorizationInfo().areActivitiesEnabled else { return }
        let id = Self.sessionID(workout.draft)
        // Solo una a la vez: la de otra sesión (un borrador sustituido) se cierra sin dejar rastro.
        for running in Activity<WorkoutActivityAttributes>.activities where running.attributes.sessionID != id {
            Task { await running.end(nil, dismissalPolicy: .immediate) }
        }
        let state = Self.state(for: workout)
        if let existing = Activity<WorkoutActivityAttributes>.activities.first(where: { $0.attributes.sessionID == id }) {
            activity = existing
            lastState = nil
            push(state)
        } else {
            activity = try? Activity.request(
                attributes: WorkoutActivityAttributes(sessionTitle: title, sessionID: id),
                content: ActivityContent(state: state, staleDate: Self.staleDate(state)),
                pushType: nil)
            lastState = state
        }
        // Cada cambio del entreno (series, ejercicio, descanso, pausa) se lee ya asentado y solo se
        // publica si cambia lo que se ve: teclear kilos o repeticiones no la toca.
        subscription = workout.objectWillChange
            .debounce(for: .milliseconds(250), scheduler: RunLoop.main)
            .sink { [weak self, weak workout] _ in
                guard let self, let workout else { return }
                self.push(Self.state(for: workout))
            }
        #endif
    }

    /// Se cierra la pantalla del entreno sin terminarlo: la actividad sigue (el tiempo corre solo).
    func stopTracking() {
        #if os(iOS)
        subscription = nil
        #endif
    }

    /// Entreno guardado: el resumen («Entreno completado», el tiempo quieto y las series) se queda
    /// unos minutos en la pantalla de bloqueo y luego se va solo.
    func finish(_ workout: ActiveWorkout) {
        #if os(iOS)
        subscription = nil
        var state = Self.state(for: workout)
        state.finishedAt = workout.finishedAt ?? Date()
        state.restStartedAt = nil
        state.restEndsAt = nil
        let ending = activity
        activity = nil
        lastState = nil
        let dismissal = Date().addingTimeInterval(Self.finishedDismissal)
        Task {
            for running in Self.matching(ending) {
                await running.end(ActivityContent(state: state, staleDate: nil), dismissalPolicy: .after(dismissal))
            }
        }
        #endif
    }

    /// Entreno descartado: la actividad desaparece al momento.
    func discard() {
        #if os(iOS)
        subscription = nil
        let ending = activity
        activity = nil
        lastState = nil
        Task {
            for running in Self.matching(ending) {
                await running.end(nil, dismissalPolicy: .immediate)
            }
        }
        #endif
    }

    #if os(iOS)
    /// La actividad de esta sesión o, si no la tenemos a mano (p. ej. tras reabrir la app), todas.
    private static func matching(_ activity: Activity<WorkoutActivityAttributes>?) -> [Activity<WorkoutActivityAttributes>] {
        if let activity { return [activity] }
        return Activity<WorkoutActivityAttributes>.activities
    }

    private func push(_ state: WorkoutActivityAttributes.ContentState) {
        guard let activity, state != lastState else { return }
        lastState = state
        let content = ActivityContent(state: state, staleDate: Self.staleDate(state))
        Task { await activity.update(content) }
    }

    /// Al acabar el descanso la actividad pasa a «Siguiente serie» sin que la app tenga que despertar.
    private static func staleDate(_ state: WorkoutActivityAttributes.ContentState) -> Date? {
        state.pausedAt == nil && state.finishedAt == nil ? state.restEndsAt : nil
    }

    /// Lo que enseña la actividad, leído del entreno: el ejercicio en el que estás (o el primero con
    /// series pendientes), «Serie X de Y» sin calentamientos, el descanso y los tiempos.
    static func state(for workout: ActiveWorkout) -> WorkoutActivityAttributes.ContentState {
        let draft = workout.draft
        let exercises = workout.exercises
        let pending: (Int) -> Bool = { i in
            guard exercises.indices.contains(i) else { return false }
            return (draft.logs[exercises[i].name] ?? []).contains { !$0.done && $0.isWarmup != true }
        }
        let viewing = min(max(draft.currentExercise, 0), max(exercises.count - 1, 0))
        let index = pending(viewing) ? viewing : (exercises.indices.first(where: pending) ?? viewing)
        let exercise = exercises.indices.contains(index) ? exercises[index] : nil
        let sets = exercise.map { (draft.logs[$0.name] ?? []).filter { $0.isWarmup != true } } ?? []
        let setCount = max(sets.count, 1)
        let doneInExercise = sets.filter(\.done).count
        let name = exercise.map { workout.swaps[$0.name] ?? $0.name } ?? draft.day.title
        let restEnd = draft.restEndsAt
        return WorkoutActivityAttributes.ContentState(
            exerciseName: name,
            exerciseNumber: exercises.isEmpty ? 1 : index + 1,
            exerciseCount: max(exercises.count, 1),
            setNumber: min(doneInExercise + 1, setCount),
            setCount: setCount,
            doneSets: workout.doneSets,
            totalSets: workout.totalSets,
            restStartedAt: restEnd.map { $0.addingTimeInterval(-TimeInterval(max(workout.restTarget, 1))) },
            restEndsAt: restEnd,
            startedAt: draft.startedAt,
            pausedAt: draft.pausedAt,
            finishedAt: nil)
    }
    #endif
}
