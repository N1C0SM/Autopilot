import ActivityKit
import WidgetKit
import SwiftUI
import UIKit

// MARK: - Marca (la extensión no puede importar el módulo de la app)

/// Tokens de la app para la extensión: el dorado de la marca (`Palette.gold` oscuro, #D8B25E), el
/// gris secundario (#A8A8AE), Inter y Big Shoulders para las cifras (fuentes en `UIAppFonts`).
private enum LA {
    static let gold = Color(red: 0.847, green: 0.698, blue: 0.369)
    static let ink = Color.white
    static let secondary = Color(red: 0.659, green: 0.659, blue: 0.682)
    static let background = Color.black

    static func inter(_ size: CGFloat, _ weight: Font.Weight = .regular, relativeTo style: Font.TextStyle = .body) -> Font {
        .custom("Inter", size: size, relativeTo: style).weight(weight)
    }

    /// Cifras en Big Shoulders 800 con dígitos tabulares, como `Font.figure` en la app.
    static func figure(_ size: CGFloat, relativeTo style: Font.TextStyle = .title) -> Font {
        .custom("BigShoulders-Bold", size: size, relativeTo: style).weight(.heavy).monospacedDigit()
    }
}

/// El AP dorado de la marca (misma geometría que `BrandMark`, de `Shared/BrandShape.swift`).
private struct APMark: View {
    var width: CGFloat

    var body: some View {
        ZStack {
            BrandShape(part: .a).fill(LA.gold)
            BrandShape(part: .p).fill(LA.gold)
        }
        .frame(width: width, height: width * 500 / 916)
        .accessibilityHidden(true)
    }
}

/// Miniatura estática del ejercicio actual, leída del contenedor compartido con una sola llamada
/// síncrona a disco (nunca `AsyncImage`: no funciona en una extensión de widget). Es un extra: sin
/// archivo (aún no ha llegado o el App Group no está disponible) se enseña `fallback` y el layout
/// no se rompe ni el texto se tapa.
private struct ActivityThumbnail<Fallback: View>: View {
    let size: CGFloat
    @ViewBuilder var fallback: () -> Fallback

    private var image: UIImage? {
        guard let path = WorkoutActivityThumbnail.fileURL?.path else { return nil }
        return UIImage(contentsOfFile: path)
    }

    var body: some View {
        Group {
            if let image {
                Image(uiImage: image)
                    .resizable()
                    .scaledToFill()
                    .frame(width: size, height: size)
                    .clipShape(RoundedRectangle(cornerRadius: size * 0.28, style: .continuous))
            } else {
                fallback()
            }
        }
        .frame(width: size, height: size)
        .accessibilityHidden(true)
    }
}

// MARK: - Widget bundle

@main
struct AutopilotWidgetBundle: WidgetBundle {
    var body: some Widget {
        WorkoutLiveActivity()
    }
}

// MARK: - Live Activity

/// Live Activity del entreno: el AP, el ejercicio, «Serie X de Y», la cuenta atrás del descanso y
/// el tiempo de sesión, en la pantalla de bloqueo y en la isla dinámica (compacta, mínima y
/// expandida). Solo el dorado de la marca como acento. Los tiempos los cuenta el sistema con
/// `Text(timerInterval:)`: avanzan sin actualizaciones y se quedan quietos en pausa o al terminar.
struct WorkoutLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: WorkoutActivityAttributes.self) { context in
            LockScreenView(attributes: context.attributes, state: context.state, isStale: context.isStale)
                .activityBackgroundTint(LA.background)
                .activitySystemActionForegroundColor(LA.gold)
        } dynamicIsland: { context in
            let state = context.state
            let display = Display(state: state, isStale: context.isStale)
            return DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    APMark(width: 30)
                        .frame(maxHeight: .infinity, alignment: .center)
                        .padding(.leading, 6)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    ElapsedTimer(state: state)
                        .font(LA.figure(24))
                        .foregroundStyle(state.elapsedFrozenAt == nil ? LA.ink : LA.secondary)
                        .frame(maxWidth: 86, maxHeight: .infinity, alignment: .trailing)
                        .padding(.trailing, 6)
                }
                DynamicIslandExpandedRegion(.center) {
                    VStack(spacing: 1) {
                        Text(display.title).font(LA.inter(15, .semibold)).foregroundStyle(LA.ink).lineLimit(1)
                        Text(display.status).font(LA.inter(12)).foregroundStyle(display.statusColor).lineLimit(1)
                    }
                }
                DynamicIslandExpandedRegion(.bottom) {
                    BottomRow(state: state, display: display, figureSize: 28)
                        .padding(.horizontal, 6)
                        .padding(.top, 4)
                }
            } compactLeading: {
                // La miniatura del ejercicio (de un vistazo, sin expandir); sin foto, el AP de siempre.
                ActivityThumbnail(size: 22) { APMark(width: 22) }
                    .padding(.leading, 2)
            } compactTrailing: {
                Group {
                    if display.showsRest, let range = state.restRange {
                        Text(timerInterval: range, pauseTime: state.pausedAt, countsDown: true, showsHours: false)
                            .foregroundStyle(LA.gold)
                    } else {
                        ElapsedTimer(state: state)
                            .foregroundStyle(state.elapsedFrozenAt == nil ? LA.ink : LA.secondary)
                    }
                }
                .font(LA.figure(16))
                .multilineTextAlignment(.trailing)
                .frame(maxWidth: 52, alignment: .trailing)
            } minimal: {
                APMark(width: 20)
            }
            .keylineTint(LA.gold)
        }
    }
}

// MARK: - Lo que se enseña

/// Título, línea de estado y si hay descanso a la vista, decidido igual en todas las presentaciones.
private struct Display {
    let state: WorkoutActivityAttributes.WorkoutState
    let isStale: Bool

    /// El sistema marca la actividad como pasada al acabar el descanso (`staleDate`): ya toca la serie.
    var restOver: Bool { isStale && state.pausedAt == nil && state.restEndsAt != nil }
    var showsRest: Bool { state.isResting && !restOver }
    var finished: Bool { state.finishedAt != nil }

    var title: String { finished ? WorkoutActivityText.finished : state.exerciseName }

    /// «Serie 2 de 4 · Ejercicio 1 de 6», «En pausa · Serie 2 de 4» o, al terminar, «12 de 12 series».
    /// Al acabar el descanso, «Siguiente serie» sale abajo en dorado, donde estaba la cuenta atrás
    /// (sin repetirlo aquí).
    var isSuperset: Bool { state.supersetPartner != nil }

    var status: String {
        if finished { return WorkoutActivityText.progress(state) }
        let base = state.pausedAt != nil
            ? "\(WorkoutActivityText.paused) · \(WorkoutActivityText.setLine(state))"
            : "\(WorkoutActivityText.setLine(state)) · \(WorkoutActivityText.exerciseLine(state))"
        return isSuperset ? "\(base) · Superserie" : base
    }

    var statusColor: Color { state.pausedAt != nil ? LA.ink : LA.secondary }
}

/// Tiempo de sesión: corre solo y se queda quieto en pausa o al terminar.
private struct ElapsedTimer: View {
    let state: WorkoutActivityAttributes.WorkoutState

    var body: some View {
        Text(timerInterval: state.elapsedRange, pauseTime: state.elapsedFrozenAt, countsDown: false, showsHours: true)
            .multilineTextAlignment(.trailing)
    }
}

/// Abajo: el descanso (etiqueta, cuenta atrás en dorado y su barra) o el avance de la sesión. Lo
/// que ya dice la línea de estado («En pausa», el avance al terminar) no se repite aquí.
private struct BottomRow: View {
    let state: WorkoutActivityAttributes.WorkoutState
    let display: Display
    let figureSize: CGFloat

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            if display.showsRest, let range = state.restRange {
                HStack(alignment: .lastTextBaseline) {
                    Text(WorkoutActivityText.rest)
                        .font(LA.inter(13, .medium)).foregroundStyle(LA.secondary)
                    Spacer(minLength: 8)
                    Text(timerInterval: range, pauseTime: state.pausedAt, countsDown: true, showsHours: false)
                        .font(LA.figure(figureSize)).foregroundStyle(LA.gold)
                        .multilineTextAlignment(.trailing)
                        .frame(maxWidth: 110, alignment: .trailing)
                }
                RestBar(state: state, range: range)
            } else {
                // Al terminar, el avance ya es la línea de estado: aquí solo queda la barra.
                if !display.finished {
                    HStack(alignment: .lastTextBaseline) {
                        Text(WorkoutActivityText.progress(state))
                            .font(LA.inter(13, .medium)).foregroundStyle(LA.secondary)
                        Spacer(minLength: 8)
                        if display.restOver {
                            Text(WorkoutActivityText.nextSet).font(LA.inter(13, .semibold)).foregroundStyle(LA.gold)
                        } else if let next = state.nextExerciseName {
                            Text("Siguiente: \(next)").font(LA.inter(12, .medium)).foregroundStyle(LA.secondary).lineLimit(1)
                        }
                    }
                }
                ProgressView(value: Double(state.doneSets), total: Double(max(state.totalSets, 1)))
                    .progressViewStyle(.linear)
                    .tint(LA.gold)
                    .accessibilityHidden(true)
            }
        }
    }
}

/// Barra del descanso: se vacía sola mientras corre; en pausa, quieta en lo que queda.
private struct RestBar: View {
    let state: WorkoutActivityAttributes.WorkoutState
    let range: ClosedRange<Date>

    var body: some View {
        Group {
            if state.pausedAt == nil {
                ProgressView(timerInterval: range, countsDown: true) { EmptyView() } currentValueLabel: { EmptyView() }
            } else {
                ProgressView(value: 1 - state.restFraction)
            }
        }
        .progressViewStyle(.linear)
        .tint(LA.gold)
        .accessibilityHidden(true)
    }
}

// MARK: - Pantalla de bloqueo / StandBy

private struct LockScreenView: View {
    let attributes: WorkoutActivityAttributes
    let state: WorkoutActivityAttributes.WorkoutState
    let isStale: Bool

    var body: some View {
        let display = Display(state: state, isStale: isStale)
        VStack(alignment: .leading, spacing: 12) {
            // El AP, la sesión y el tiempo de sesión.
            HStack(alignment: .center, spacing: 8) {
                APMark(width: 26)
                Text(attributes.sessionTitle)
                    .font(LA.inter(13, .semibold)).foregroundStyle(LA.secondary)
                    .lineLimit(1)
                Spacer(minLength: 8)
                ElapsedTimer(state: state)
                    .font(LA.figure(22))
                    .foregroundStyle(state.elapsedFrozenAt == nil ? LA.ink : LA.secondary)
                    .frame(maxWidth: 96, alignment: .trailing)
            }
            // El ejercicio y su serie, con su miniatura (más peso visual que el texto solo).
            HStack(alignment: .center, spacing: 12) {
                ActivityThumbnail(size: 44) {
                    RoundedRectangle(cornerRadius: 44 * 0.28, style: .continuous).fill(LA.secondary.opacity(0.18))
                }
                VStack(alignment: .leading, spacing: 2) {
                    Text(display.title)
                        .font(LA.inter(20, .bold, relativeTo: .title3)).foregroundStyle(LA.ink)
                        .lineLimit(1).minimumScaleFactor(0.8)
                    Text(display.status)
                        .font(LA.inter(13, display.statusColor == LA.ink ? .semibold : .regular))
                        .foregroundStyle(display.statusColor)
                        .lineLimit(1)
                    if let next = state.nextExerciseName, !display.finished {
                        Text("Siguiente: \(next)")
                            .font(LA.inter(12, .medium)).foregroundStyle(LA.secondary)
                            .lineLimit(1)
                    }
                    if let partner = state.supersetPartner, !display.finished {
                        Text("Superserie con \(partner)")
                            .font(LA.inter(12, .semibold)).foregroundStyle(LA.gold)
                            .lineLimit(1)
                    }
                }
            }
            BottomRow(state: state, display: display, figureSize: 30)
        }
        .padding(.horizontal, 18)
        .padding(.vertical, 16)
        // Letra grande sí, pero sin romper la tarjeta del sistema (máximo 160 pt de alto).
        .dynamicTypeSize(...DynamicTypeSize.xLarge)
        .accessibilityElement(children: .combine)
    }
}
