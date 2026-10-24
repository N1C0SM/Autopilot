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
                    Text(NumberText.integer(model.kg4w)).font(.inter(size: 56, weight: .bold).monospacedDigit())
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
                .chartXAxis { AxisMarks { _ in AxisValueLabel().font(.inter(.caption2)).foregroundStyle(Palette.muted) } }
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

            if !model.history.isEmpty {
                Text("Por ejercicio").font(.apTitle3).padding(.top, 8)
                ExerciseProgressSection(history: model.history, images: model.exerciseImages)
            }
        }
    }

    private func stat(_ value: String, _ label: String) -> some View {
        (Text(value).font(.inter(.title3).weight(.bold)) + Text(" " + label).font(.apSubhead).foregroundColor(Palette.muted))
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
                Text(label).font(.inter(.caption2).weight(.medium).monospacedDigit()).foregroundStyle(.white)
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
                            Text(Progression.kgText(best.e1rm)).font(.inter(size: 64, weight: .bold))
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

    /// Historial por ejercicio como `buildExerciseHistory` de la web: una entrada por día.
    @Published var history: [String: [ExerciseEntry]] = [:]
    @Published var exerciseImages: [String: String] = [:]

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

        struct AllLog: Decodable {
            let exercise_name: String; let sets_completed: [SetLog]?; let logged_at: String
            enum K: String, CodingKey { case exercise_name, sets_completed, logged_at }
            init(from d: Decoder) throws {
                let c = try d.container(keyedBy: K.self)
                exercise_name = try c.decode(String.self, forKey: .exercise_name)
                logged_at = try c.decode(String.self, forKey: .logged_at)
                sets_completed = try? c.decode([SetLog].self, forKey: .sets_completed)
            }
        }
        let all: [AllLog] = (try? await Backend.client.from("workout_logs").select("exercise_name, sets_completed, logged_at")
            .eq("user_id", value: userId).order("logged_at", ascending: true).limit(2000).execute().value) ?? []
        var hist: [String: [String: ExerciseEntry]] = [:]
        for l in all {
            let day = String(l.logged_at.prefix(10))
            guard let date = fmt.date(from: day) else { continue }
            let sets = (l.sets_completed ?? []).filter { $0.done && $0.isWarmup != true && $0.reps > 0 }
            guard !sets.isEmpty else { continue }
            let weighted = sets.compactMap { s -> (Double, Int)? in
                guard let w = Double(s.weight.replacingOccurrences(of: ",", with: ".")), w > 0 else { return nil }
                return (w, s.reps)
            }
            let e1rm = weighted.map { $0.0 * (1 + Double($0.1) / 30) }.max().map { ($0 * 10).rounded() / 10 }
            var e = hist[l.exercise_name]?[day] ?? ExerciseEntry(date: date, label: labelFmt.string(from: date).replacingOccurrences(of: ".", with: ""), volumeKg: 0, reps: 0, loadedSets: 0, best1Rm: nil)
            e.volumeKg += weighted.reduce(0) { $0 + $1.0 * Double($1.1) }
            e.reps += sets.reduce(0) { $0 + $1.reps }
            e.loadedSets += weighted.count
            if let v = e1rm, v > (e.best1Rm ?? 0) { e.best1Rm = v }
            hist[l.exercise_name, default: [:]][day] = e
        }
        history = hist.mapValues { $0.values.sorted { $0.date < $1.date } }
        let names = Array(history.keys)
        if !names.isEmpty {
            struct E: Decodable { let name: String; let image_url: String? }
            let imgs: [E] = (try? await Backend.client.from("exercises").select("name, image_url").in("name", values: names).execute().value) ?? []
            exerciseImages = Dictionary(imgs.compactMap { e in e.image_url.map { (e.name, $0) } }, uniquingKeysWith: { a, _ in a })
        }

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


struct ExerciseEntry: Hashable { let date: Date; let label: String; var volumeKg: Double; var reps: Int; var loadedSets: Int; var best1Rm: Double? }

/// «Por ejercicio» de `WorkoutProgress.tsx` + `ExerciseProgressChart.tsx`: portada con la foto del ejercicio
/// (tocable para cambiar) y la gráfica con 1RM / Volumen / Reps.
struct ExerciseProgressSection: View {
    let history: [String: [ExerciseEntry]]
    let images: [String: String]
    @State private var selected = ""
    @State private var metric = 0

    private var names: [String] { history.keys.sorted { (history[$0]?.count ?? 0, $1) > (history[$1]?.count ?? 0, $0) } }
    private func value(_ e: ExerciseEntry) -> Double? {
        switch metric { case 1: e.loadedSets > 0 ? e.volumeKg.rounded() : nil; case 2: Double(e.reps); default: e.best1Rm }
    }
    private func r(_ v: Double) -> String { NumberText.decimal(v, digits: (v * 10).rounded().truncatingRemainder(dividingBy: 10) == 0 ? 0 : 1) }

    var body: some View {
        let name = selected.isEmpty ? (names.first ?? "") : selected
        let entries = history[name] ?? []
        VStack(alignment: .leading, spacing: 12) {
            Menu {
                Picker("Ejercicio", selection: Binding(get: { name }, set: { Haptics.selection(); selected = $0 })) {
                    ForEach(names, id: \.self) { n in Text("\(n) · \(history[n]?.count ?? 0) \(history[n]?.count == 1 ? "sesión" : "sesiones")").tag(n) }
                }
            } label: { cover(name, count: entries.count) }
            .menuStyle(.button).buttonStyle(.plain)
            chart(name, entries).padding(16)
                .background(Palette.card, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        }
    }

    private func cover(_ name: String, count: Int) -> some View {
        let img = images[name].flatMap(URL.init(string:))
        return HStack(alignment: .bottom, spacing: 8) {
            VStack(alignment: .leading, spacing: 2) {
                Text("\(count) \(count == 1 ? "sesión" : "sesiones")").font(.apFootnote.weight(.semibold)).foregroundStyle(Palette.gold)
                Text(name).font(.inter(size: 26, weight: .bold)).foregroundStyle(.white).multilineTextAlignment(.leading)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            Image(systemName: "chevron.up.chevron.down").font(.inter(size: 16, weight: .semibold)).foregroundStyle(.white.opacity(0.7)).padding(.bottom, 4)
        }
        .padding(20)
        .frame(maxWidth: .infinity, minHeight: img == nil ? 0 : 176, alignment: .bottomLeading)
        .background {
            if let img {
                Color.clear.overlay {
                    CachedAsyncImage(url: img) { $0.resizable().scaledToFill() } placeholder: { Palette.card }
                }
                .overlay { LinearGradient(colors: [.black.opacity(0.85), .black.opacity(0.3), .clear], startPoint: .bottom, endPoint: .top) }
                .clipped()
            } else { Palette.card }
        }
        .clipShape(RoundedRectangle(cornerRadius: 28, style: .continuous))
        .contentShape(Rectangle())
    }

    @ViewBuilder private func chart(_ name: String, _ history: [ExerciseEntry]) -> some View {
        let data = Array(history.suffix(16))
        let values = data.compactMap(value)
        let latest = history.last.flatMap(value)
        let first = values.first
        let best = values.max()
        let change = (latest != nil && (first ?? 0) > 0) ? (latest! - first!) / first! * 100 : nil
        let unit = metric == 2 ? "reps" : "kg"
        let hasLine = values.count > 1
        let sessions = "\(history.count) \(history.count == 1 ? "sesión" : "sesiones")"
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .firstTextBaseline, spacing: 12) {
                VStack(alignment: .leading, spacing: 6) {
                    (Text(latest.map(r) ?? "—").font(.inter(size: 32, weight: .bold).monospacedDigit()) + Text(" \(unit)").font(.apSubhead).foregroundColor(Palette.muted))
                    HStack(spacing: 0) {
                        if hasLine, let change {
                            Text("\(change > 0 ? "+" : "")\(r(change))%").fontWeight(.medium).foregroundStyle(change >= 0 ? Palette.success : Palette.foreground)
                            Text(" · ")
                        }
                        if hasLine, let best { Text("\(r(best)) \(unit) · ") }
                        Text(sessions)
                    }
                    .font(.apFootnote.monospacedDigit()).foregroundStyle(Palette.muted)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                HStack(spacing: 0) {
                    ForEach(Array(["1RM", "Volumen", "Reps"].enumerated()), id: \.offset) { i, l in
                        Text(l).font(.apFootnote.weight(i == metric ? .semibold : .medium))
                            .padding(.horizontal, 10).frame(height: 26)
                            .background { if i == metric { RoundedRectangle(cornerRadius: 7, style: .continuous).fill(Palette.accent) } }
                            .contentShape(Rectangle())
                            .onTapGesture { Haptics.selection(); withAnimation(.snappy) { metric = i } }
                    }
                }
                .padding(3).background(Palette.secondary, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
            }
            if hasLine {
                let lo = values.min() ?? 0, pad = max(1, ((best ?? 0) - lo) * 0.15)
                Chart(Array(data.enumerated()), id: \.offset) { i, e in
                    if let v = value(e) {
                        AreaMark(x: .value("Sesión", i), yStart: .value("Base", lo - pad), yEnd: .value(unit, v))
                            .foregroundStyle(LinearGradient(colors: [Palette.gold.opacity(0.35), Palette.gold.opacity(0)], startPoint: .top, endPoint: .bottom))
                            .interpolationMethod(.monotone)
                        LineMark(x: .value("Sesión", i), y: .value(unit, v))
                            .foregroundStyle(Palette.gold).lineStyle(StrokeStyle(lineWidth: 2.5)).interpolationMethod(.monotone)
                    }
                }
                .chartYScale(domain: (lo - pad)...((best ?? 1) + pad))
                .chartXAxis {
                    AxisMarks(values: [0, data.count - 1]) { v in
                        AxisValueLabel { if let i = v.as(Int.self), data.indices.contains(i) { Text(data[i].label) } }
                            .font(.inter(.caption)).foregroundStyle(Palette.muted)
                    }
                }
                .chartYAxis { AxisMarks(position: .trailing) { _ in AxisGridLine().foregroundStyle(Palette.foreground.opacity(0.07)); AxisValueLabel().font(.inter(.caption)).foregroundStyle(Palette.muted) } }
                .frame(height: 256)
                .accessibilityLabel("Gráfica de \(name)")
            } else if values.isEmpty && !history.isEmpty && metric != 2 {
                VStack(spacing: 6) {
                    Image(systemName: "dumbbell").font(.inter(size: 24)).foregroundStyle(Palette.muted)
                    Text("Sin carga registrada").font(.apHeadline)
                    Text("El 1RM y el volumen salen de las series con peso. En Reps ves tu evolución.").font(.apSubhead).foregroundStyle(Palette.muted).multilineTextAlignment(.center)
                }
                .frame(maxWidth: .infinity).padding(.vertical, 24)
            } else {
                VStack(alignment: .leading, spacing: 12) {
                    Canvas { ctx, size in
                        let sx = size.width / 300, sy = size.height / 120
                        for y in [30.0, 60, 90] { var p = Path(); p.move(to: CGPoint(x: 0, y: y * sy)); p.addLine(to: CGPoint(x: size.width, y: y * sy)); ctx.stroke(p, with: .color(.white.opacity(0.07)), lineWidth: 1) }
                        var c = Path(); c.move(to: CGPoint(x: 40 * sx, y: 80 * sy))
                        c.addCurve(to: CGPoint(x: 260 * sx, y: 34 * sy), control1: CGPoint(x: 110 * sx, y: 76 * sy), control2: CGPoint(x: 170 * sx, y: 58 * sy))
                        ctx.stroke(c, with: .color(Palette.gold.opacity(0.35)), style: StrokeStyle(lineWidth: 2.5, lineCap: .round, dash: [2, 7]))
                        let p0 = CGPoint(x: 40 * sx, y: 80 * sy)
                        ctx.fill(Path(ellipseIn: CGRect(x: p0.x - 11, y: p0.y - 11, width: 22, height: 22)), with: .color(Palette.gold.opacity(0.2)))
                        ctx.fill(Path(ellipseIn: CGRect(x: p0.x - 6, y: p0.y - 6, width: 12, height: 12)), with: .color(Palette.gold))
                        let p1 = CGPoint(x: 260 * sx, y: 34 * sy)
                        ctx.stroke(Path(ellipseIn: CGRect(x: p1.x - 6, y: p1.y - 6, width: 12, height: 12)), with: .color(Palette.gold.opacity(0.4)), style: StrokeStyle(lineWidth: 2, dash: [3, 3]))
                    }
                    .frame(height: 140).accessibilityHidden(true)
                    let start = (data.first { value($0) != nil } ?? history.last)?.label
                    Text(start.map { "Punto de partida · \($0)" } ?? "Punto de partida").font(.apHeadline)
                    Text(history.count < 2 ? "Registra otra sesión de este ejercicio y aquí verás tu línea de progreso." : "Registra otra sesión con peso y aquí verás tu línea de progreso.")
                        .font(.apSubhead).foregroundStyle(Palette.muted)
                }
            }
        }
    }
}
