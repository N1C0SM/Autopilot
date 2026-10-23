import SwiftUI
import Charts
import Supabase

/// Progreso: entrenos de las últimas semanas, peso corporal y récords.
struct ProgressScreen: View {
    @EnvironmentObject private var session: SessionModel
    @StateObject private var model = ProgressModel()

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 150), spacing: 12)], spacing: 12) {
                    FigureTile(label: "Entrenos 30 días", value: "\(model.workouts30)", accent: true)
                    FigureTile(label: "Récords", value: "\(model.records.count)")
                    if let w = model.weights.last {
                        FigureTile(label: "Peso", value: "\(NumberText.decimal(w.kg)) kg")
                    }
                }

                // Una columna en iPhone; dos o tres en Mac y iPad.
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 380), spacing: 16, alignment: .top)], spacing: 16) {
                    VStack(alignment: .leading, spacing: 12) {
                        SectionTitle(title: "Entrenos por semana")
                        Card {
                            if model.weekly.allSatisfy({ $0.count == 0 }) {
                                EmptyStateView(symbol: "chart.bar", title: "Sin entrenos todavía")
                            } else {
                                Chart(model.weekly, id: \.label) { week in
                                    BarMark(x: .value("Semana", week.label), y: .value("Entrenos", week.count))
                                        .foregroundStyle(Palette.gold)
                                        .cornerRadius(6)
                                }
                                .frame(height: 220)
                                .chartYAxis { AxisMarks(position: .leading) }
                                .accessibilityLabel("Entrenos por semana")
                            }
                        }
                    }
                    if model.weights.count > 1 {
                        VStack(alignment: .leading, spacing: 12) {
                            SectionTitle(title: "Peso corporal")
                            Card {
                                Chart(model.weights, id: \.date) { w in
                                    LineMark(x: .value("Fecha", w.date), y: .value("Kg", w.kg)).foregroundStyle(Palette.gold)
                                    PointMark(x: .value("Fecha", w.date), y: .value("Kg", w.kg)).foregroundStyle(Palette.gold)
                                }
                                .chartYScale(domain: .automatic(includesZero: false))
                                .frame(height: 220)
                            }
                        }
                    }
                    VStack(alignment: .leading, spacing: 12) {
                        SectionTitle(title: "Récords personales")
                        Card {
                            if model.records.isEmpty {
                                EmptyStateView(symbol: "trophy", title: "Sin récords aún", message: "Aparecen al superar tus mejores marcas.")
                            } else {
                                ForEach(model.records, id: \.name) { pr in
                                    HStack {
                                        Text(pr.name).font(.apBody)
                                        Spacer()
                                        Text("\(NumberText.decimal(pr.weight)) kg × \(pr.reps)").font(.apSubhead.monospacedDigit()).foregroundStyle(Palette.muted)
                                    }
                                    .frame(minHeight: 32)
                                    .accessibilityElement(children: .combine)
                                }
                            }
                        }
                    }
                }
            }
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .screenBackground()
        .refreshable { await model.load(userId: session.userId) }
        .task { await model.load(userId: session.userId) }
        .onReceive(NotificationCenter.default.publisher(for: .refreshSection)) { _ in Task { await model.load(userId: session.userId) } }
    }
}

@MainActor
final class ProgressModel: ObservableObject {
    struct Week { let label: String; let count: Int }
    struct Weight { let date: Date; let kg: Double }
    struct Record { let name: String; let weight: Double; let reps: Int }

    @Published var weekly: [Week] = []
    @Published var weights: [Weight] = []
    @Published var records: [Record] = []
    @Published var workouts30 = 0

    func load(userId: UUID?) async {
        guard let userId else { return }
        let comps = await TrainingRepo.completions(userId: userId, since: LocalDate.daysAgo(55))
        let cutoff30 = LocalDate.daysAgo(29)
        workouts30 = comps.filter { $0.date >= cutoff30 }.count
        weekly = (0..<8).reversed().map { w in
            let from = LocalDate.daysAgo(w * 7 + 6), to = LocalDate.daysAgo(w * 7)
            return Week(label: w == 0 ? "Esta" : "−\(w)", count: comps.filter { $0.date >= from && $0.date <= to }.count)
        }

        struct WRow: Decodable { let weight: Double?; let logged_at: String? ; let created_at: String? }
        if let rows: [WRow] = try? await Backend.client.from("weight_logs").select("weight, logged_at, created_at")
            .eq("user_id", value: userId).order("created_at", ascending: true).limit(120).execute().value {
            let f = ISO8601DateFormatter()
            let d = DateFormatter(); d.dateFormat = "yyyy-MM-dd"
            weights = rows.compactMap { r in
                guard let kg = r.weight else { return nil }
                let raw = r.logged_at ?? r.created_at ?? ""
                guard let date = d.date(from: String(raw.prefix(10))) ?? f.date(from: raw) else { return nil }
                return Weight(date: date, kg: kg)
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
