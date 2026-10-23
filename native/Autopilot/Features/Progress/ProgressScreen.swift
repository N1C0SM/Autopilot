import SwiftUI
import Charts
import Supabase

/// Progreso, calcado de la web: pestañas Fuerza · Físico · Récords · Scan.
/// Fuerza: «Últimas 4 semanas», kg levantados, entrenos, racha, kg esta semana, barras de 8 semanas y «Por ejercicio».
struct ProgressScreen: View {
    @EnvironmentObject private var session: SessionModel
    @StateObject private var model = ProgressModel()
    @State private var tab = 0

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                SegmentedPill(options: ["Fuerza", "Físico", "Récords", "Scan"], selection: $tab)
                switch tab {
                case 0: strength
                case 1: physique
                case 2: records
                default: ScanView().frame(minHeight: 400)
                }
            }
            .padding(.horizontal, 16).padding(.top, 8).padding(.bottom, 16)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .screenBackground()
        .refreshable { await model.load(userId: session.userId) }
        .task { await model.load(userId: session.userId) }
        .onReceive(NotificationCenter.default.publisher(for: .refreshSection)) { _ in Task { await model.load(userId: session.userId) } }
    }

    // MARK: Fuerza

    private var strength: some View {
        VStack(alignment: .leading, spacing: 16) {
            VStack(alignment: .leading, spacing: 0) {
                Text("Últimas 4 semanas").font(.apSubhead.weight(.semibold)).foregroundStyle(Palette.gold)
                HStack(alignment: .firstTextBaseline, spacing: 6) {
                    Text(NumberText.integer(model.kg4w)).font(.system(size: 56, weight: .bold, design: .rounded).monospacedDigit())
                    Text("kg levantados").font(.apTitle3).foregroundStyle(Palette.muted)
                }
                HStack(spacing: 20) {
                    stat("\(model.workouts4w)", model.workouts4w == 1 ? "entreno" : "entrenos")
                    stat("\(model.streakWeeks)", model.streakWeeks == 1 ? "semana de racha" : "semanas de racha")
                    stat(NumberText.integer(model.kgThisWeek), "kg esta semana")
                }
                .padding(.top, 8)
                Chart(model.weekly, id: \.label) { w in
                    BarMark(x: .value("Semana", w.label), y: .value("kg", max(w.kg, model.maxWeekly * 0.02)))
                        .foregroundStyle(w.kg > 0 ? Palette.gold : Palette.gold.opacity(0.25))
                        .cornerRadius(8)
                }
                .chartYAxis(.hidden)
                .chartXAxis { AxisMarks { _ in AxisValueLabel().font(.caption2).foregroundStyle(Palette.muted) } }
                .frame(height: 180)
                .padding(.top, 24)
                .accessibilityLabel("Kilos levantados por semana")
            }
            .padding(20)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(alignment: .topTrailing) {
                RadialGradient(colors: [Palette.gold.opacity(0.18), .clear], center: .topTrailing, startRadius: 0, endRadius: 260)
            }
            .background(Palette.card)
            .clipShape(RoundedRectangle(cornerRadius: Radius.hero, style: .continuous))

            if !model.byExercise.isEmpty {
                Text("Por ejercicio").font(.apTitle3).padding(.top, 8)
                ForEach(model.byExercise, id: \.name) { ex in
                    VStack(alignment: .leading, spacing: 4) {
                        Text(ex.name).font(.apTitle3)
                        Text("\(ex.sessions) \(ex.sessions == 1 ? "sesión" : "sesiones")").font(.apFootnote).foregroundStyle(Palette.muted)
                        Text("\(NumberText.integer(Int(ex.bestVolume))) kg").font(.system(size: 34, weight: .bold, design: .rounded).monospacedDigit()).padding(.top, 6)
                        if ex.sessions < 2 {
                            Text("Registra otra sesión de este ejercicio y aquí verás tu línea de progreso.")
                                .font(.apFootnote).foregroundStyle(Palette.muted)
                        }
                    }
                    .padding(20)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Palette.card, in: RoundedRectangle(cornerRadius: Radius.hero, style: .continuous))
                }
            }
        }
    }

    private func stat(_ value: String, _ label: String) -> some View {
        (Text(value).font(.system(.title3, design: .rounded).weight(.bold)) + Text(" " + label).font(.apSubhead).foregroundColor(Palette.muted))
    }

    // MARK: Físico

    private var physique: some View {
        VStack(alignment: .leading, spacing: 16) {
            if model.weights.count > 1 {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Peso corporal").font(.apSubhead.weight(.semibold)).foregroundStyle(Palette.gold)
                    if let w = model.weights.last {
                        (Text(NumberText.decimal(w.kg)).font(.system(size: 48, weight: .bold, design: .rounded)) + Text(" kg").font(.apTitle3).foregroundColor(Palette.muted))
                    }
                    Chart(model.weights, id: \.date) { w in
                        LineMark(x: .value("Fecha", w.date), y: .value("Kg", w.kg)).foregroundStyle(Palette.gold)
                    }
                    .chartYScale(domain: .automatic(includesZero: false))
                    .frame(height: 180)
                }
                .padding(20)
                .background(Palette.card, in: RoundedRectangle(cornerRadius: Radius.hero, style: .continuous))
            } else {
                EmptyStateView(symbol: "scalemass", title: "Sin registros de peso", message: "Registra tu peso para ver tu evolución.")
                    .background(Palette.card, in: RoundedRectangle(cornerRadius: Radius.hero, style: .continuous))
            }
        }
    }

    // MARK: Récords

    private var records: some View {
        VStack(spacing: 0) {
            if model.records.isEmpty {
                EmptyStateView(symbol: "trophy", title: "Sin récords aún", message: "Aparecen al superar tus mejores marcas.")
            } else {
                ForEach(Array(model.records.enumerated()), id: \.element.name) { i, pr in
                    HStack {
                        Image(systemName: "trophy.fill").foregroundStyle(Palette.gold).accessibilityHidden(true)
                        Text(pr.name).font(.apBody)
                        Spacer()
                        Text("\(NumberText.decimal(pr.weight)) kg × \(pr.reps)").font(.apHeadline.monospacedDigit())
                    }
                    .padding(.horizontal, 16).frame(minHeight: 56)
                    .overlay(alignment: .top) { if i > 0 { Rectangle().fill(Palette.separator).frame(height: 0.5).padding(.leading, 16) } }
                    .accessibilityElement(children: .combine)
                }
            }
        }
        .background(Palette.card, in: RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
    }
}

@MainActor
final class ProgressModel: ObservableObject {
    struct Week { let label: String; let kg: Double }
    struct Weight { let date: Date; let kg: Double }
    struct Record { let name: String; let weight: Double; let reps: Int }
    struct ExerciseStat { let name: String; let sessions: Int; let bestVolume: Double }

    @Published var weekly: [Week] = []
    @Published var weights: [Weight] = []
    @Published var records: [Record] = []
    @Published var byExercise: [ExerciseStat] = []
    @Published var kg4w = 0
    @Published var kgThisWeek = 0
    @Published var workouts4w = 0
    @Published var streakWeeks = 0

    var maxWeekly: Double { weekly.map(\.kg).max() ?? 1 }

    private static func volume(_ sets: [SetLog]?) -> Double {
        var total = 0.0
        for s in sets ?? [] where s.done && s.isWarmup != true {
            total += Double(s.reps) * (Double(s.weight.replacingOccurrences(of: ",", with: ".")) ?? 0)
        }
        return total
    }

    func load(userId: UUID?) async {
        guard let userId else { return }
        let cal = Calendar(identifier: .iso8601)
        let thisMonday = cal.dateInterval(of: .weekOfYear, for: Date())?.start ?? Date()
        let start = cal.date(byAdding: .weekOfYear, value: -7, to: thisMonday) ?? thisMonday

        struct Log: Decodable { let exercise_name: String; let sets_completed: [SetLog]?; let logged_at: String }
        let logs: [Log] = (try? await Backend.client.from("workout_logs").select("exercise_name, sets_completed, logged_at")
            .eq("user_id", value: userId).gte("logged_at", value: LocalDate.string(start)).execute().value) ?? []
        let fmt = DateFormatter(); fmt.dateFormat = "yyyy-MM-dd"
        let labelFmt = DateFormatter(); labelFmt.locale = Locale(identifier: "es_ES"); labelFmt.dateFormat = "d MMM"
        var weeks: [Week] = []
        for i in 0..<8 {
            let ws = cal.date(byAdding: .weekOfYear, value: i - 7, to: thisMonday)!
            let we = cal.date(byAdding: .day, value: 7, to: ws)!
            var kg = 0.0
            for l in logs {
                guard let d = fmt.date(from: String(l.logged_at.prefix(10))), d >= ws, d < we else { continue }
                kg += Self.volume(l.sets_completed)
            }
            weeks.append(Week(label: labelFmt.string(from: ws).replacingOccurrences(of: ".", with: ""), kg: kg))
        }
        weekly = weeks
        kg4w = Int(weeks.suffix(4).reduce(0) { $0 + $1.kg })
        kgThisWeek = Int(weeks.last?.kg ?? 0)
        var streak = 0
        for w in weeks.reversed() { if w.kg > 0 { streak += 1 } else { break } }
        streakWeeks = streak

        workouts4w = await TrainingRepo.completions(userId: userId, since: LocalDate.daysAgo(27)).count

        var stats: [String: (dates: Set<String>, best: Double)] = [:]
        for l in logs {
            let v = Self.volume(l.sets_completed)
            guard v > 0 else { continue }
            var e = stats[l.exercise_name] ?? (dates: [], best: 0)
            e.dates.insert(String(l.logged_at.prefix(10)))
            e.best = max(e.best, v)
            stats[l.exercise_name] = e
        }
        byExercise = stats.map { ExerciseStat(name: $0.key, sessions: $0.value.dates.count, bestVolume: $0.value.best) }
            .sorted { $0.bestVolume > $1.bestVolume }

        struct WRow: Decodable { let weight: Double?; let logged_at: String? }
        if let rows: [WRow] = try? await Backend.client.from("weight_logs").select("weight, logged_at")
            .eq("user_id", value: userId).order("logged_at", ascending: true).limit(120).execute().value {
            weights = rows.compactMap { r in
                guard let kg = r.weight, let d = fmt.date(from: String((r.logged_at ?? "").prefix(10))) else { return nil }
                return Weight(date: d, kg: kg)
            }
        }

        struct PRow: Decodable { let exercise_name: String; let weight: Double?; let reps: Int? }
        if let rows: [PRow] = try? await Backend.client.from("personal_records").select("exercise_name, weight, reps")
            .eq("user_id", value: userId).order("weight", ascending: false).limit(50).execute().value {
            var seen = Set<String>()
            records = rows.compactMap { r in
                guard !seen.contains(r.exercise_name), let w = r.weight else { return nil }
                seen.insert(r.exercise_name)
                return Record(name: r.exercise_name, weight: w, reps: r.reps ?? 1)
            }
        }
    }
}
