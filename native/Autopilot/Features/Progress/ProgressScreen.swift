import SwiftUI
import Charts
import Supabase

/// Progreso, calcado de la web: pestañas Fuerza · Físico · Récords · Scan.
/// Fuerza: «Últimas 4 semanas», kg levantados, entrenos, racha, kg esta semana, barras de 8 semanas y «Por ejercicio».
struct ProgressScreen: View {
    @EnvironmentObject private var session: SessionModel
    @StateObject private var model = ProgressModel()
    @State private var tab = 0
    @State private var viewing: ProgressModel.Photo?

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
                    Text(NumberText.integer(model.kg4w)).font(.system(size: 56, weight: .bold).monospacedDigit())
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
                .frame(height: 160)
                .padding(.top, 20)
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
                        Text("\(NumberText.integer(Int(ex.bestVolume))) kg").font(.system(size: 34, weight: .bold).monospacedDigit()).padding(.top, 6)
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
        (Text(value).font(.system(.title3).weight(.bold)) + Text(" " + label).font(.apSubhead).foregroundColor(Palette.muted))
    }

    // MARK: Físico (ProgressPhotos de la web)

    private var physique: some View {
        VStack(alignment: .leading, spacing: 24) {
            if model.photos.count < 2 {
                HStack(alignment: .top, spacing: 14) {
                    IconTile(symbol: "rectangle.split.2x1")
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Compara tu evolución").font(.apHeadline)
                        Text("Con dos scans del mismo ángulo verás el antes y el después lado a lado.").font(.apSubhead).foregroundStyle(Palette.muted)
                        Button("Hacer un scan") { Haptics.tap(); tab = 3 }
                            .font(.apHeadline).foregroundStyle(Palette.gold).buttonStyle(.plain).frame(minHeight: 44)
                    }
                }
                .padding(16)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Palette.card, in: RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
            } else if let before = model.photos.last, let after = model.photos.first {
                VStack(spacing: 16) {
                    HStack(spacing: 8) { photoTile(before, label: "Antes"); photoTile(after, label: "Ahora") }
                    Button("Comparar antes y después") { viewing = after }.buttonStyle(.pill)
                }
            }
            ForEach(model.photoMonths, id: \.self) { month in
                VStack(alignment: .leading, spacing: 12) {
                    Text(month).font(.apHeadline)
                    LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 8), count: 3), spacing: 8) {
                        ForEach(model.photos.filter { $0.month == month }) { p in
                            Button { viewing = p } label: { photoTile(p, label: p.shortDate) }
                                .buttonStyle(.plain)
                                .accessibilityLabel("Progreso: ver foto del \(p.shortDate)")
                        }
                    }
                }
            }
        }
        .fullScreenCoverCompat(item: $viewing) { p in
            ZStack {
                Color.black.ignoresSafeArea()
                CachedAsyncImage(url: p.url) { $0.resizable().scaledToFit() } placeholder: { ProgressView() }
            }
            .onTapGesture { viewing = nil }
            .accessibilityLabel("Foto de progreso del \(p.shortDate). Toca para cerrar")
        }
    }

    private func photoTile(_ p: ProgressModel.Photo, label: String) -> some View {
        Color.clear.aspectRatio(3/4, contentMode: .fit)
            .overlay { CachedAsyncImage(url: p.url) { $0.resizable().scaledToFill() } placeholder: { Palette.secondary } }
            .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
            .overlay(alignment: .bottomLeading) {
                Text(label).font(.caption2.weight(.medium).monospacedDigit()).foregroundStyle(.white)
                    .padding(.horizontal, 6).padding(.vertical, 2).background(.black.opacity(0.55), in: Capsule()).padding(6)
            }
    }

    // MARK: Récords (como la web: tarjeta «Tu mejor marca» y lista «Tus récords personales»)

    private var records: some View {
        VStack(alignment: .leading, spacing: 16) {
            if model.records.isEmpty {
                EmptyStateView(symbol: "trophy", title: "Sin récords aún", message: "Registra tus entrenos con peso y rompe tu primer récord personal.")
                    .background(Palette.card, in: RoundedRectangle(cornerRadius: Radius.hero, style: .continuous))
            } else if let best = model.records.max(by: { $0.e1rm < $1.e1rm }) {
                ZStack(alignment: .bottomLeading) {
                    Color.clear.frame(maxWidth: .infinity).frame(height: 256)
                        .overlay { CachedAsyncImage(url: best.image.flatMap(URL.init(string:))) { $0.resizable().scaledToFill() } placeholder: { Palette.card } }
                        .clipped()
                    LinearGradient(colors: [.black.opacity(0.9), .black.opacity(0.45), .black.opacity(0.1)], startPoint: .bottom, endPoint: .top)
                    VStack(alignment: .leading, spacing: 4) {
                        Label("Tu mejor marca", systemImage: "trophy").font(.apSubhead.weight(.semibold)).foregroundStyle(Palette.gold)
                        HStack(alignment: .firstTextBaseline, spacing: 4) {
                            Text(Progression.kgText(best.e1rm)).font(.system(size: 64, weight: .bold))
                            Text("kg").font(.apTitle3).foregroundStyle(.white.opacity(0.7))
                        }
                        Text("1RM estimado en \(best.name)").font(.apSubhead).foregroundStyle(.white.opacity(0.75))
                    }
                    .padding(20)
                }
                .clipShape(RoundedRectangle(cornerRadius: Radius.hero, style: .continuous))
                .accessibilityElement(children: .combine)

                Text("TUS RÉCORDS PERSONALES").font(.apFootnote).foregroundStyle(Palette.muted).padding(.horizontal, 16).padding(.top, 12)
                VStack(spacing: 0) {
                    ForEach(Array(model.records.enumerated()), id: \.element.name) { i, pr in
                        HStack(spacing: 14) {
                            ExerciseThumb(url: pr.image, size: 44)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(pr.name).font(.apBody)
                                Text(pr.dateText).font(.apFootnote).foregroundStyle(Palette.muted)
                            }
                            Spacer(minLength: 8)
                            VStack(alignment: .trailing, spacing: 4) {
                                Text("\(Progression.kgText(pr.weight)) kg × \(pr.reps)").font(.apBody.weight(.semibold).monospacedDigit())
                                Text("1RM ~\(Progression.kgText(pr.e1rm)) kg").font(.apFootnote.monospacedDigit()).foregroundStyle(Palette.muted)
                            }
                        }
                        .padding(.horizontal, 16).padding(.vertical, 14)
                        .overlay(alignment: .top) { if i > 0 { Rectangle().fill(Palette.separator).frame(height: 0.5).padding(.leading, 82) } }
                        .accessibilityElement(children: .combine)
                    }
                }
                .background(Palette.card, in: RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
            }
        }
    }
}

@MainActor
final class ProgressModel: ObservableObject {
    struct Week { let label: String; let kg: Double }
    struct Weight { let date: Date; let kg: Double }
    struct Record {
        let name: String; let weight: Double; let reps: Int; let e1rm: Double; let date: String; let image: String?
        var dateText: String { DateFormatter.ymd.date(from: String(date.prefix(10))).map { $0.formatted(.dateTime.day().month(.abbreviated).year().locale(Locale(identifier: "es_ES"))) } ?? "" }
    }
    struct Photo: Identifiable, Hashable {
        let id: String; let url: URL?; let takenAt: String
        var date: Date? { DateFormatter.ymd.date(from: String(takenAt.prefix(10))) }
        var month: String { (date?.formatted(.dateTime.month(.wide).year().locale(Locale(identifier: "es_ES"))) ?? "").capitalizedFirst }
        var shortDate: String { date?.formatted(.dateTime.day().month(.abbreviated).locale(Locale(identifier: "es_ES"))).replacingOccurrences(of: ".", with: "") ?? "" }
    }
    @Published var photos: [Photo] = []
    var photoMonths: [String] { var seen = Set<String>(); return photos.map(\.month).filter { seen.insert($0).inserted } }
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

        struct PP: Decodable { let id: String; let photo_url: String; let taken_at: String?; let created_at: String }
        let pp: [PP] = (try? await Backend.client.from("progress_photos").select("id, photo_url, taken_at, created_at")
            .eq("user_id", value: userId).order("taken_at", ascending: false).order("created_at", ascending: false).execute().value) ?? []
        var list: [Photo] = []
        for p in pp {
            let url = p.photo_url.hasPrefix("http") ? URL(string: p.photo_url) : (try? await Backend.client.storage.from("progress-photos").createSignedURL(path: p.photo_url, expiresIn: 3600))
            list.append(Photo(id: p.id, url: url, takenAt: p.taken_at ?? p.created_at))
        }
        photos = list

        struct PRow: Decodable { let exercise_name: String; let weight: Double?; let reps: Int?; let estimated_1rm: Double?; let achieved_at: String? }
        if let rows: [PRow] = try? await Backend.client.from("personal_records").select("exercise_name, weight, reps, estimated_1rm, achieved_at")
            .eq("user_id", value: userId).order("estimated_1rm", ascending: false).limit(50).execute().value {
            var seen = Set<String>()
            let best = rows.filter { seen.insert($0.exercise_name).inserted }
            struct E: Decodable { let name: String; let image_url: String? }
            let names = best.map(\.exercise_name)
            let imgs: [E] = names.isEmpty ? [] : ((try? await Backend.client.from("exercises").select("name, image_url").in("name", values: names).execute().value) ?? [])
            records = best.compactMap { r in
                guard let w = r.weight else { return nil }
                let reps = r.reps ?? 1
                return Record(name: r.exercise_name, weight: w, reps: reps, e1rm: r.estimated_1rm ?? w * (1 + Double(reps) / 30),
                              date: r.achieved_at ?? "", image: imgs.first { $0.name == r.exercise_name }?.image_url)
            }
        }
    }
}
