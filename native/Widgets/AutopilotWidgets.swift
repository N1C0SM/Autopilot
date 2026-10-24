import WidgetKit
import SwiftUI
import ActivityKit

private let gold = Color(red: 0.844, green: 0.706, blue: 0.356)
private let card = Color(red: 0.107, green: 0.107, blue: 0.113)
private let muted = Color(red: 0.67, green: 0.67, blue: 0.69)

@main
struct AutopilotWidgetBundle: WidgetBundle {
    var body: some Widget {
        TodayWidget()
        RestLiveActivity()
    }
}

// MARK: Descanso en la isla dinámica y la pantalla de bloqueo

struct RestLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: RestActivityAttributes.self) { ctx in
            HStack(spacing: 14) {
                Image(systemName: "timer").font(.inter(.title2).weight(.semibold)).foregroundStyle(gold)
                VStack(alignment: .leading, spacing: 2) {
                    Text("Descanso").font(.inter(.caption)).foregroundStyle(muted)
                    Text(timerInterval: Date()...max(Date(), ctx.state.endsAt), countsDown: true)
                        .font(.inter(size: 34, weight: .bold, design: .default)).monospacedDigit().foregroundStyle(.white)
                }
                Spacer()
                VStack(alignment: .trailing, spacing: 2) {
                    Text(ctx.state.exercise).font(.inter(.subheadline).weight(.semibold)).foregroundStyle(.white).lineLimit(1)
                    Text("Siguiente: \(ctx.state.nextSet)").font(.inter(.caption)).foregroundStyle(muted).lineLimit(1)
                    Text("\(ctx.state.doneSets) de \(ctx.state.totalSets) series").font(.inter(.caption)).foregroundStyle(gold)
                }
            }
            .padding(16)
            .activityBackgroundTint(.black)
            .activitySystemActionForegroundColor(gold)
        } dynamicIsland: { ctx in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Label("Descanso", systemImage: "timer").font(.inter(.caption).weight(.semibold)).foregroundStyle(gold)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Text("\(ctx.state.doneSets)/\(ctx.state.totalSets)").font(.inter(.caption).monospacedDigit()).foregroundStyle(muted)
                }
                DynamicIslandExpandedRegion(.center) {
                    Text(timerInterval: Date()...max(Date(), ctx.state.endsAt), countsDown: true)
                        .font(.inter(size: 40, weight: .bold, design: .default)).monospacedDigit().multilineTextAlignment(.center)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    Text("\(ctx.state.exercise) · siguiente \(ctx.state.nextSet)").font(.inter(.caption)).foregroundStyle(muted).lineLimit(1)
                }
            } compactLeading: {
                Image(systemName: "timer").foregroundStyle(gold)
            } compactTrailing: {
                Text(timerInterval: Date()...max(Date(), ctx.state.endsAt), countsDown: true)
                    .monospacedDigit().frame(width: 44).foregroundStyle(gold)
            } minimal: {
                Image(systemName: "timer").foregroundStyle(gold)
            }
            .keylineTint(gold)
        }
    }
}

// MARK: Widget «Hoy»

struct TodayEntry: TimelineEntry { let date: Date; let snap: WidgetStore.Snapshot? }

struct TodayProvider: TimelineProvider {
    func placeholder(in context: Context) -> TodayEntry { TodayEntry(date: .now, snap: .init(title: "Full Body A", detail: "7 ejercicios · 18 series", isRest: false, doneToday: false, weekDone: 2, weekPlanned: 3, weekDays: [2,2,0,1,0,0,0], todayIndex: 3, updated: .now)) }
    func getSnapshot(in context: Context, completion: @escaping (TodayEntry) -> Void) { completion(TodayEntry(date: .now, snap: WidgetStore.load() ?? placeholder(in: context).snap)) }
    func getTimeline(in context: Context, completion: @escaping (Timeline<TodayEntry>) -> Void) {
        let next = Calendar.current.startOfDay(for: .now.addingTimeInterval(86_400))
        completion(Timeline(entries: [TodayEntry(date: .now, snap: WidgetStore.load())], policy: .after(next)))
    }
}

struct TodayWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "today", provider: TodayProvider()) { e in
            TodayView(entry: e).containerBackground(.black, for: .widget)
        }
        .configurationDisplayName("Hoy")
        .description("Tu sesión de hoy y la semana.")
        .supportedFamilies([.systemSmall, .systemMedium, .accessoryRectangular, .accessoryCircular])
    }
}

struct TodayView: View {
    let entry: TodayEntry
    @Environment(\.widgetFamily) private var family
    private static let letters = ["L","M","X","J","V","S","D"]

    var body: some View {
        let s = entry.snap
        switch family {
        case .accessoryCircular:
            Gauge(value: Double(s?.weekDone ?? 0), in: 0...Double(max(s?.weekPlanned ?? 1, 1))) {
                Image(systemName: "dumbbell.fill")
            } currentValueLabel: { Text("\(s?.weekDone ?? 0)") }
            .gaugeStyle(.accessoryCircularCapacity)
        case .accessoryRectangular:
            VStack(alignment: .leading, spacing: 1) {
                Text(s?.doneToday == true ? "Hecho hoy" : (s?.isRest == true ? "Descanso" : "Hoy")).font(.inter(.caption2))
                Text(s?.title ?? "Autopilot").font(.inter(.headline)).lineLimit(1)
                Text("\(s?.weekDone ?? 0) de \(s?.weekPlanned ?? 0) esta semana").font(.inter(.caption2))
            }
        default:
            VStack(alignment: .leading, spacing: 6) {
                Text(s?.doneToday == true ? "HECHO HOY" : (s?.isRest == true ? "DESCANSO" : "HOY"))
                    .font(.inter(.caption2).weight(.bold)).foregroundStyle(gold)
                Text(s?.title ?? "Abre Autopilot").font(.inter(.headline, design: .default).weight(.bold)).foregroundStyle(.white).lineLimit(2)
                if let d = s?.detail, !d.isEmpty, family == .systemMedium { Text(d).font(.inter(.caption)).foregroundStyle(muted) }
                Spacer(minLength: 0)
                HStack(spacing: family == .systemMedium ? 8 : 3) {
                    ForEach(0..<7, id: \.self) { i in
                        let v = s?.weekDays[safe: i] ?? 0
                        ZStack {
                            Circle().fill(v == 2 ? gold : (i == s?.todayIndex ? gold.opacity(0.18) : card))
                            if v == 2 { Image(systemName: "checkmark").font(.inter(size: 8, weight: .heavy)).foregroundStyle(.black) }
                            else { Text(Self.letters[i]).font(.inter(size: 8, weight: .semibold)).foregroundStyle(v == 1 ? .white : muted) }
                        }
                        .frame(width: family == .systemMedium ? 24 : 16, height: family == .systemMedium ? 24 : 16)
                    }
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}

extension Array { subscript(safe i: Int) -> Element? { indices.contains(i) ? self[i] : nil } }
