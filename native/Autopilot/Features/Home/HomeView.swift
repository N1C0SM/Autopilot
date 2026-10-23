import SwiftUI

/// Inicio: saludo, entreno de hoy y la semana en cifras.
struct HomeView: View {
    @EnvironmentObject private var session: SessionModel
    @EnvironmentObject private var accounts: AccountStore
    @StateObject private var model = PlanModel()

    private var name: String {
        accounts.accounts.first { $0.id == session.userIdString }?.name ?? ""
    }

    private var today: DayPlan? { model.days.first { $0.day == DayNames.today } }
    private var weekDone: Int { Set(model.completions.map(\.date)).count }
    private var weekPlanned: Int { model.days.count }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(greeting).font(.apSubhead).foregroundStyle(Palette.muted)
                    Text(name.isEmpty ? "Hola" : name).font(.apLargeTitle).accessibilityAddTraits(.isHeader)
                }
                .padding(.top, 4)

                LazyVGrid(columns: [GridItem(.adaptive(minimum: 150), spacing: 12)], spacing: 12) {
                    FigureTile(label: "Esta semana", value: "\(weekDone)/\(max(weekPlanned, weekDone))", hint: "entrenos hechos", accent: true)
                    FigureTile(label: "Hoy", value: today.map { $0.isGym ? "\($0.exercises?.count ?? 0)" : "1" } ?? "—",
                               hint: today == nil ? "descanso" : (today!.isGym ? "ejercicios" : "actividad"))
                }

                if let today {
                    NavigationLink { TrainView().navigationTitle("Entrenar") } label: {
                        Card(radius: Radius.hero) {
                            Text("Hoy").font(.apFootnote).foregroundStyle(Palette.muted)
                            Text(today.title).font(.apTitle1)
                            if let focus = today.muscle_focus { Text(focus).font(.apSubhead).foregroundStyle(Palette.muted) }
                            HStack {
                                Text(model.completedToday(today.day) ? "Hecho" : "Ir a entrenar").font(.apHeadline).foregroundStyle(Palette.gold)
                                Image(systemName: "chevron.right").font(.footnote.weight(.semibold)).foregroundStyle(Palette.gold)
                            }
                        }
                    }
                    .buttonStyle(.plain)
                    .accessibilityHint("Abre el entreno de hoy")
                } else if !model.loading {
                    Card { Text("Hoy toca descanso").font(.apTitle3); Text("Recuperar también es entrenar.").font(.apSubhead).foregroundStyle(Palette.muted) }
                }

                SectionTitle(title: "Tu semana").padding(.top, 8)
                Card {
                    ForEach(DayNames.all, id: \.self) { day in
                        let plan = model.days.first { $0.day == day }
                        let done = model.completions.contains { $0.day == day }
                        HStack {
                            Text(day).font(.apBody).foregroundStyle(day == DayNames.today ? Palette.gold : Palette.foreground)
                            Spacer()
                            Text(plan?.title ?? "Descanso").font(.apSubhead).foregroundStyle(Palette.muted).lineLimit(1)
                            if done { Image(systemName: "checkmark.circle.fill").foregroundStyle(Palette.gold).accessibilityLabel("hecho") }
                        }
                        .frame(minHeight: 32)
                        .accessibilityElement(children: .combine)
                    }
                }
            }
            .padding(16)
            .frame(maxWidth: 900)
            .frame(maxWidth: .infinity)
        }
        .screenBackground()
        .refreshable { await model.load(userId: session.userId) }
        .task { await model.load(userId: session.userId) }
    }

    private var greeting: String {
        switch Calendar.current.component(.hour, from: Date()) {
        case 6..<13: "Buenos días"
        case 13..<21: "Buenas tardes"
        default: "Buenas noches"
        }
    }
}
