import ActivityKit
import WidgetKit
import SwiftUI

// MARK: - Paleta mínima para la extensión (no puede importar el módulo principal)

private let gold = Color(red: 0.93, green: 0.78, blue: 0.33)
private let cardBg = Color(white: 0.10)

// MARK: - Widget bundle

@main
struct AutopilotWidgetBundle: WidgetBundle {
    var body: some Widget {
        WorkoutLiveActivity()
    }
}

// MARK: - Live Activity

struct WorkoutLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: WorkoutActivityAttributes.self) { context in
            // ── Lock Screen / StandBy ──────────────────────────────────────
            LockScreenView(attributes: context.attributes, state: context.state)
        } dynamicIsland: { context in
            // ── Dynamic Island ─────────────────────────────────────────────
            DynamicIsland {
                // Expanded: aparece al pulsar la pastilla
                DynamicIslandExpandedRegion(.leading) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(context.attributes.sessionTitle)
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(gold)
                            .lineLimit(1)
                        Text(context.state.exerciseName)
                            .font(.subheadline.weight(.bold))
                            .foregroundStyle(.white)
                            .lineLimit(1)
                    }
                    .padding(.leading, 4)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    VStack(alignment: .trailing, spacing: 2) {
                        // Cronómetro de duración
                        if context.state.isPaused {
                            Label("Pausa", systemImage: "pause.fill")
                                .font(.caption2.weight(.medium))
                                .foregroundStyle(.white.opacity(0.6))
                        } else {
                            Text(context.state.startedAt, style: .timer)
                                .font(.caption.monospacedDigit())
                                .foregroundStyle(.white.opacity(0.75))
                                .multilineTextAlignment(.trailing)
                        }
                        // Series
                        Text("\(context.state.doneSets)/\(context.state.totalSets) series")
                            .font(.caption2.monospacedDigit())
                            .foregroundStyle(.white.opacity(0.55))
                    }
                    .padding(.trailing, 4)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    if let end = context.state.restEndsAt, end > Date() {
                        // Barra de descanso
                        RestBarExpanded(endsAt: end)
                    } else {
                        // Volumen acumulado
                        HStack {
                            Image(systemName: "chart.bar.fill")
                                .foregroundStyle(gold)
                            Text("\(context.state.volumeKg) kg levantados")
                                .font(.caption.weight(.medium))
                                .foregroundStyle(.white.opacity(0.75))
                        }
                    }
                }
            } compactLeading: {
                // Píldora izquierda: icono de mancuerna
                Image(systemName: "dumbbell.fill")
                    .foregroundStyle(gold)
                    .font(.system(size: 13, weight: .semibold))
            } compactTrailing: {
                // Píldora derecha: descanso o cronómetro
                if let end = context.state.restEndsAt, end > Date() {
                    Text(end, style: .timer)
                        .font(.caption2.monospacedDigit().weight(.semibold))
                        .foregroundStyle(gold)
                        .multilineTextAlignment(.trailing)
                } else if context.state.isPaused {
                    Image(systemName: "pause.fill")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundStyle(.white.opacity(0.6))
                } else {
                    Text(context.state.startedAt, style: .timer)
                        .font(.caption2.monospacedDigit().weight(.semibold))
                        .foregroundStyle(.white.opacity(0.75))
                        .multilineTextAlignment(.trailing)
                }
            } minimal: {
                // Solo el icono cuando hay muchas activities
                Image(systemName: "dumbbell.fill")
                    .foregroundStyle(gold)
            }
        }
    }
}

// MARK: - Lock Screen / StandBy view

private struct LockScreenView: View {
    let attributes: WorkoutActivityAttributes
    let state: WorkoutActivityAttributes.WorkoutState

    var body: some View {
        HStack(spacing: 14) {
            // Icono
            ZStack {
                Circle().fill(gold.opacity(0.15))
                Image(systemName: "dumbbell.fill")
                    .font(.system(size: 18, weight: .semibold))
                    .foregroundStyle(gold)
            }
            .frame(width: 44, height: 44)

            // Info central
            VStack(alignment: .leading, spacing: 3) {
                Text(attributes.sessionTitle)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(gold)
                    .lineLimit(1)
                Text(state.exerciseName)
                    .font(.subheadline.weight(.bold))
                    .foregroundStyle(.white)
                    .lineLimit(1)

                // Descanso o progreso
                if let end = state.restEndsAt, end > Date() {
                    HStack(spacing: 6) {
                        Image(systemName: "timer")
                            .font(.caption2)
                            .foregroundStyle(gold)
                        Text(end, style: .timer)
                            .font(.caption.monospacedDigit().weight(.medium))
                            .foregroundStyle(gold)
                        Text("descanso")
                            .font(.caption2)
                            .foregroundStyle(.white.opacity(0.5))
                    }
                } else {
                    HStack(spacing: 6) {
                        Text("\(state.doneSets)/\(state.totalSets)")
                            .font(.caption.monospacedDigit().weight(.semibold))
                            .foregroundStyle(.white)
                        Text("series")
                            .font(.caption2)
                            .foregroundStyle(.white.opacity(0.5))
                        Text("·")
                            .foregroundStyle(.white.opacity(0.3))
                        Text("\(state.volumeKg) kg")
                            .font(.caption.monospacedDigit().weight(.semibold))
                            .foregroundStyle(.white)
                    }
                }
            }

            Spacer(minLength: 0)

            // Cronómetro derecha
            VStack(alignment: .trailing, spacing: 2) {
                if state.isPaused {
                    Image(systemName: "pause.circle.fill")
                        .font(.title3)
                        .foregroundStyle(.white.opacity(0.5))
                } else {
                    Text(state.startedAt, style: .timer)
                        .font(.callout.monospacedDigit().weight(.semibold))
                        .foregroundStyle(.white)
                        .multilineTextAlignment(.trailing)
                    Text("duración")
                        .font(.caption2)
                        .foregroundStyle(.white.opacity(0.4))
                }
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .background(cardBg)
    }
}

// MARK: - Barra de descanso expandida

private struct RestBarExpanded: View {
    let endsAt: Date

    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: "timer")
                .foregroundStyle(gold)
                .font(.caption.weight(.semibold))
            Text("Descansa")
                .font(.caption.weight(.medium))
                .foregroundStyle(.white.opacity(0.65))
            Text(endsAt, style: .timer)
                .font(.caption.monospacedDigit().weight(.bold))
                .foregroundStyle(gold)
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 16)
        .padding(.bottom, 8)
    }
}
