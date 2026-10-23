import SwiftUI
import Supabase
import WidgetKit

/// Hoy, calcado de `HomeOverview.tsx`: fecha, «Hola, Nombre.» + estado del día, la semana
/// en círculos, la acción principal (empezar, hecho o descanso) y el «Resumen» con Nutrición y Progreso.
struct HomeView: View {
    @EnvironmentObject private var session: SessionModel
    @StateObject private var model = PlanModel()
    @State private var firstName = ""
    @State private var calories: Int?
    var onNavigate: (AppSection) -> Void = { _ in }

    private static let letters = ["L", "M", "X", "J", "V", "S", "D"]
    private var todayIndex: Int { DayNames.all.firstIndex(of: DayNames.today) ?? 0 }
    private var todayPlan: DayPlan? {
        model.days.first { $0.day == DayNames.today && ($0.isGym ? !($0.exercises ?? []).isEmpty : $0.type == "actividad") }
    }
    private var scheduled: [DayPlan] { model.days.filter { $0.type == "actividad" || !($0.exercises ?? []).isEmpty } }
    /// Hecho hoy si hay cualquier entreno registrado con la fecha de hoy (aunque sea de otro día del plan).
    private var completedToday: Bool { model.completions.contains { $0.date == LocalDate.string() } }
    /// Como la web: días del plan hechos esta semana (por su nombre) y hoy si ya se ha entrenado.
    private var doneDays: Set<String> {
        let monday = LocalDate.daysAgo(todayIndex)
        var out = Set(model.completions.filter { $0.date >= monday }.map(\.day))
        if completedToday { out.insert(DayNames.today) }
        return out
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                Text(Date().formatted(.dateTime.weekday(.wide).day().month(.wide).locale(Locale(identifier: "es_ES"))).capitalizedFirst)
                    .font(.apSubhead.weight(.semibold)).foregroundStyle(Palette.muted)
                (Text(firstName.isEmpty ? "Hola." : "Hola, \(firstName).") + Text("\n") + Text(stateLine).foregroundColor(Palette.muted))
                    .font(.system(.largeTitle, design: .default).weight(.bold))
                    .padding(.top, 2)
                    .accessibilityAddTraits(.isHeader)

                if !scheduled.isEmpty { weekStrip.padding(.top, 24) }

                mainAction.padding(.vertical, 32)

                Text("Resumen").font(.apTitle3).padding(.bottom, 12)
                HStack(spacing: 12) {
                    overview(title: "Nutrición",
                             value: calories.map { Text(NumberText.integer($0)) + Text(" kcal").font(.apSubhead.weight(.semibold)).foregroundColor(Palette.muted) },
                             ring: ProgressRing(value: 0, symbol: "apple.logo", muted: calories == nil),
                             detail: calories == nil ? "Plan de nutrición" : "Objetivo diario") { onNavigate(.nutrition) }
                    overview(title: "Progreso",
                             value: scheduled.isEmpty ? nil : Text("\(min(doneDays.count, scheduled.count))") + Text("/\(scheduled.count)").font(.apTitle3).foregroundColor(Palette.muted),
                             ring: ProgressRing(value: scheduled.isEmpty ? 0 : Double(min(doneDays.count, scheduled.count)) / Double(scheduled.count) * 100, symbol: "sparkles"),
                             detail: scheduled.isEmpty ? "Sin sesiones esta semana" : "\(min(doneDays.count, scheduled.count)) de \(scheduled.count) \(scheduled.count == 1 ? "sesión" : "sesiones") esta semana") { onNavigate(.progress) }
                }
            }
            .padding(.horizontal, 16).padding(.top, 8).padding(.bottom, 16)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .screenBackground()
        .refreshable { await load() }
        .task { await load() }
        .onReceive(NotificationCenter.default.publisher(for: .refreshSection)) { _ in Task { await load() } }
    }

    private var stateLine: String {
        if completedToday { return "Buen trabajo." }
        if todayPlan?.isGym == true { return "A entrenar." }
        if let p = todayPlan, p.type == "actividad" { return "A \(p.sport ?? "moverte")." }
        return "Hoy, a recuperar."
    }

    private var weekStrip: some View {
        HStack(spacing: 0) {
            ForEach(0..<7, id: \.self) { i in
                let day = DayNames.all[i]
                let isToday = i == todayIndex
                let trains = scheduled.contains { $0.day == day }
                let done = doneDays.contains(day) || (isToday && completedToday)
                Button { Haptics.tap(); onNavigate(.train) } label: {
                    VStack(spacing: 4) {
                        ZStack {
                            Circle().fill(done ? Palette.gold : (isToday ? Palette.gold.opacity(0.15) : .clear))
                            if done {
                                Image(systemName: "checkmark").font(.system(size: 15, weight: .bold)).foregroundStyle(.black)
                            } else {
                                Text(Self.letters[i]).font(.apSubhead.weight(isToday ? .semibold : .regular))
                                    .foregroundStyle(isToday ? Palette.gold : (trains ? Palette.foreground : Palette.muted))
                            }
                        }
                        .frame(width: 36, height: 36)
                        Circle().fill(trains && !done ? Palette.gold : .clear).frame(width: 5, height: 5)
                    }
                    .frame(maxWidth: .infinity, minHeight: 44)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("\(day)\(isToday ? ", hoy" : ""): \(done ? "completado" : trains ? "con sesión" : "descanso") — ver entrenamiento")
            }
        }
        .padding(.horizontal, 8).padding(.vertical, 12)
        .background(Palette.card, in: RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
    }

    @ViewBuilder private var mainAction: some View {
        if let plan = todayPlan, !completedToday {
            let parts = plan.title.components(separatedBy: " · ")
            Button { Haptics.tap(); onNavigate(.train) } label: {
                VStack(alignment: .leading, spacing: 2) {
                    Text(parts[0]).font(.apTitle1).lineLimit(1)
                    if parts.count > 1 { Text(parts.dropFirst().joined(separator: " · ")).font(.apSubhead).foregroundStyle(Palette.muted) }
                    Text(detail(plan)).font(.apSubhead.monospacedDigit()).foregroundStyle(Palette.muted).padding(.top, 2)
                    Text("Empezar entreno").font(.apHeadline).foregroundStyle(.black)
                        .frame(maxWidth: .infinity, minHeight: 50)
                        .background(Palette.gold, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                        .padding(.top, 24)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Empezar \(plan.title)")
        } else if completedToday {
            Button { Haptics.tap(); onNavigate(.train) } label: {
                HStack(spacing: 14) {
                    Image(systemName: "checkmark").font(.system(size: 18, weight: .heavy)).foregroundStyle(.green)
                        .frame(width: 40, height: 40).background(Color.green.opacity(0.15), in: Circle())
                    VStack(alignment: .leading, spacing: 0) {
                        Text("Hecho hoy").font(.apFootnote.weight(.semibold)).foregroundStyle(.green)
                        Text(todayPlan.map { $0.title.components(separatedBy: " · ")[0] } ?? "Sesión completada").font(.apHeadline).lineLimit(1)
                    }
                    Spacer()
                    Text("Resumen").font(.apSubhead).foregroundStyle(Palette.gold)
                }
                .padding(16)
                .background(Palette.card, in: RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Ver el resumen de la sesión de hoy")
        } else {
            RestCard(title: "Hoy toca descansar", message: nextSession ?? "Tu plan aún no tiene sesiones esta semana.") {
                Button("Entrenar igualmente") { Haptics.tap(); onNavigate(.train) }
                    .buttonStyle(.pillSecondary)
            }
        }
    }

    private var nextSession: String? {
        for offset in 1...7 {
            let day = DayNames.all[(todayIndex + offset) % 7]
            if let plan = scheduled.first(where: { $0.day == day }) {
                let name = day.lowercased()
                let when = offset == 1 ? "mañana" : offset == 7 ? "el próximo \(name)" : "el \(name)"
                return "Tu próxima sesión es \(when): \(plan.title)."
            }
        }
        return nil
    }

    private func detail(_ plan: DayPlan) -> String {
        guard plan.isGym else { return [plan.intensity, plan.duration].compactMap { $0 }.joined(separator: " · ") }
        let ex = plan.exercises ?? []
        let series = ex.reduce(0) { $0 + $1.series }
        var parts: [String] = []
        if !ex.isEmpty { parts.append("\(ex.count) \(ex.count == 1 ? "ejercicio" : "ejercicios")") }
        if series > 0 { parts.append("\(series) \(series == 1 ? "serie" : "series")") }
        return parts.joined(separator: " · ")
    }

    private func overview<V: View>(title: String, value: Text?, ring: V, detail: String, action: @escaping () -> Void) -> some View {
        Button { Haptics.tap(); action() } label: {
            VStack(alignment: .leading, spacing: 6) {
                HStack {
                    Text(title).font(.apHeadline)
                    Spacer()
                    ring
                }
                if let value { value.font(.system(.title, design: .rounded).weight(.bold).monospacedDigit()) }
                Text(detail).font(.apFootnote).foregroundStyle(Palette.muted).lineLimit(2)
            }
            .padding(16)
            .frame(maxWidth: .infinity, minHeight: 130, alignment: .topLeading)
            .background(Palette.card, in: RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .combine)
    }

    /// Deja la sesión de hoy y la semana para los widgets.
    private func publishWidget() {
        let days = (0..<7).map { i -> Int in
            let d = DayNames.all[i]
            return doneDays.contains(d) ? 2 : (scheduled.contains { $0.day == d } ? 1 : 0)
        }
        WidgetStore.save(.init(title: todayPlan.map { $0.title.components(separatedBy: " · ")[0] } ?? "Descanso",
                               detail: todayPlan.map(detail) ?? (nextSession ?? ""), isRest: todayPlan == nil,
                               doneToday: completedToday, weekDone: min(doneDays.count, max(scheduled.count, doneDays.count)),
                               weekPlanned: scheduled.count, weekDays: days, todayIndex: todayIndex, updated: Date()))
        WidgetCenter.shared.reloadAllTimelines()
    }

    private func load() async {
        await model.load(userId: session.userId)
        publishWidget()
        guard let id = session.userId else { return }
        struct P: Decodable { let name: String? }
        if let p: P = try? await Backend.client.from("profiles").select("name").eq("user_id", value: id).single().execute().value {
            firstName = (p.name ?? "").components(separatedBy: " ").first ?? ""
        }
        struct M: Decodable { let calories: Double?; let protein: Double?; let carbs: Double?; let fats: Double? }
        struct N: Decodable { let macros_json: M? }
        let rows: [N] = (try? await Backend.client.from("nutrition_plan").select("macros_json").eq("user_id", value: id).limit(1).execute().value) ?? []
        if let m = rows.first?.macros_json, m.protein != nil || m.calories != nil {
            calories = Int((m.calories ?? ((m.protein ?? 0) * 4 + (m.carbs ?? 0) * 4 + (m.fats ?? 0) * 9)).rounded())
        }
    }
}

extension String {
    var capitalizedFirst: String { prefix(1).uppercased() + dropFirst() }
}
