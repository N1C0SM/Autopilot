import SwiftUI
import Supabase

extension ActiveWorkout: Identifiable { nonisolated var id: ObjectIdentifier { ObjectIdentifier(self) } }

/// Fila de ejercicio de la lista (miniatura, nombre, «N series · R reps · descanso»).
struct ExerciseListRow: View {
    let exercise: GymExercise
    let separator: Bool
    let done: Bool

    var body: some View {
        HStack(spacing: 12) {
            ExerciseThumb(url: exercise.image_url, completed: done)
            VStack(alignment: .leading, spacing: 2) {
                Text(exercise.name).font(.apHeadline).lineLimit(2).foregroundStyle(done ? Palette.muted : Palette.foreground)
                Text("\(exercise.series) series · \(exercise.reps) reps · \(exercise.rest)").font(.apFootnote.monospacedDigit())
                    .foregroundStyle(Palette.muted)
            }
            .frame(maxWidth: .infinity, minHeight: 68, alignment: .leading)
            .overlay(alignment: .top) { if separator { Rectangle().fill(Palette.separator).frame(height: 0.5) } }
        }
        .padding(.leading, 12)
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
    }
}

/// Miniatura única de ejercicio (como `ExerciseThumb` en la web).
struct ExerciseThumb: View {
    let url: String?
    var completed = false
    var size: CGFloat = 52

    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 12, style: .continuous).fill(Palette.secondary)
            if let url, let u = URL(string: url) {
                CachedAsyncImage(url: u, maxSide: max(140, size * 2)) { $0.resizable().scaledToFill() } placeholder: { Color.clear }
            } else {
                Image(systemName: "dumbbell").foregroundStyle(Palette.muted)
            }
            if completed {
                Color.black.opacity(0.5)
                Image(systemName: "checkmark").font(.inter(.headline).weight(.bold)).foregroundStyle(Palette.gold)
            }
        }
        .frame(width: size, height: size)
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        .accessibilityHidden(true)
    }
}

/// Fila que salta de línea (chips).
struct FlowRow: Layout {
    var spacing: CGFloat = 8
    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let width = proposal.width ?? 400
        var x: CGFloat = 0, y: CGFloat = 0, rowH: CGFloat = 0
        for v in subviews {
            let s = v.sizeThatFits(.unspecified)
            if x + s.width > width { x = 0; y += rowH + spacing; rowH = 0 }
            x += s.width + spacing; rowH = max(rowH, s.height)
        }
        return CGSize(width: width, height: y + rowH)
    }
    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var x = bounds.minX, y = bounds.minY, rowH: CGFloat = 0
        for v in subviews {
            let s = v.sizeThatFits(.unspecified)
            if x + s.width > bounds.maxX { x = bounds.minX; y += rowH + spacing; rowH = 0 }
            v.place(at: CGPoint(x: x, y: y), proposal: ProposedViewSize(s))
            x += s.width + spacing; rowH = max(rowH, s.height)
        }
    }
}


final class PlanModel: ObservableObject {
    @Published var days: [DayPlan] = []
    @Published var completions: [(day: String, date: String)] = []
    @Published var loading = false
    @Published var error: String?
    /// Ya hay una respuesta (red, memoria o disco). Hasta entonces nunca se pinta «sin rutina».
    @Published var loaded = false

    /// Siembra el plan y lo hecho desde la caché (memoria o disco) sin esperar a la red.
    init(userId: UUID? = nil) {
        guard let userId, let cached = TrainingRepo.instantPlan(userId: userId) else { return }
        days = cached
        completions = TrainingRepo.instantCompletions(userId: userId, since: LocalDate.daysAgo(6)) ?? []
        loaded = true
    }

    func load(userId: UUID?) async {
        guard let userId else { return }
        loading = true
        defer { loading = false; loaded = true }
        do {
            let fresh = try await TrainingRepo.plan(userId: userId)
            let rows = await TrainingRepo.completions(userId: userId, since: LocalDate.daysAgo(6))
            // Un único cambio, y solo si algo cambió: sin redibujos de más al refrescar.
            if fresh != days { days = fresh }
            if !rows.elementsEqual(completions, by: { $0.day == $1.day && $0.date == $1.date }) { completions = rows }
            TrainingRepo.saveCompletionsSnapshot(userId: userId, rows)
            error = nil
        } catch {
            self.error = "No se pudo cargar el plan."
        }
    }

    func completedToday(_ day: String) -> Bool {
        completions.contains { $0.day == day && $0.date == LocalDate.string() }
    }

    /// Sesiones de la rutina en orden (sin días de la semana).
    var sessions: [DayPlan] { RoutineOrder.sessions(days) }
    /// Sesiones hechas esta semana (desde el lunes).
    var doneThisWeek: Set<String> { RoutineOrder.doneThisWeek(completions) }
    /// Sesiones hechas hoy: su acción pasa a «completado».
    var doneTodayKeys: Set<String> { Set(completions.filter { $0.date == LocalDate.string() }.map(\.day)) }
}


/// `TrainingPlanView` de la web, igual en iPhone, iPad y Mac: lo hecho esta semana arriba y las
/// sesiones de la rutina en orden («Sesión 1, 2…»), con la siguiente destacada. La elegida se abre
/// bajo su fila. Sin días de la semana ni descansos: cualquier sesión se hace cualquier día.
struct RoutineListView: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    let days: [DayPlan]
    /// Sesiones hechas esta semana (su clave `day`).
    var doneThisWeek: Set<String> = []
    /// Sesiones hechas hoy: su acción pasa a ser «completado».
    var doneToday: Set<String> = []
    /// Sesión con un entreno a medias: su acción pasa a ser «Continuar entreno».
    var resumableDay: String? = nil
    /// Cabecera de la rutina (modo, Ejercicios, Editar): va arriba, como en la web.
    var routineBar: AnyView? = nil
    /// Guarda el nombre y el icono de una sesión; false si no se pudo.
    var onPersonalize: ((String, String, String?) async -> Bool)? = nil
    var onOpen: (String) -> Void
    @State private var expanded: String?
    /// Sesión que se está personalizando (nombre e icono).
    @State private var personalizing: DayPlan?
    /// Todas plegadas a propósito (se tocó la abierta): no se vuelve a abrir sola la siguiente.
    @State private var collapsedAll = false
    @State private var detail: GymExercise?

    private var sessions: [DayPlan] { RoutineOrder.sessions(days) }
    private var next: DayPlan? { RoutineOrder.nextPending(sessions, done: doneThisWeek) }
    /// La abierta: la elegida si sigue en el plan; si no, la siguiente que falta o la primera.
    private var openKey: String? {
        if collapsedAll { return nil }
        if let expanded, sessions.contains(where: { $0.day == expanded }) { return expanded }
        return (next ?? sessions.first)?.day
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            if let routineBar { routineBar }
            if sessions.isEmpty {
                emptyCard(icon: "lu-calendar", title: "Tu plan aún no tiene sesiones",
                          message: "Edita tu rutina para añadir tus sesiones.")
            } else {
                weekProgress
                VStack(spacing: 12) {
                    ForEach(Array(sessions.enumerated()), id: \.element.day) { index, plan in
                        sessionRow(index + 1, plan)
                        if openKey == plan.day { session(plan) }
                    }
                }
            }
            (Text("Análisis asistido por IA · tu plan se adapta a ti · ") + Text("[no sustituye consejo médico](https://autopilotplan.app/legal/disclaimer-medico)"))
                .tint(Palette.gold)
                .font(.apFootnote).foregroundStyle(Palette.muted).multilineTextAlignment(.center)
                .frame(maxWidth: .infinity).padding(.horizontal, 16)
        }
        .sheet(item: $detail) { TechniqueSheet(exercise: $0).presentationBackground(Palette.card) }
        .sheet(item: $personalizing) { plan in
            SessionIdentitySheet(plan: plan, number: (sessions.firstIndex { $0.day == plan.day } ?? 0) + 1) { name, icon in
                await onPersonalize?(plan.day, name, icon) ?? false
            }
            .presentationBackground(Palette.card)
        }
    }

    /// Lo hecho esta semana: un tramo por sesión, dorado si ya está hecha (como la web).
    private var weekProgress: some View {
        let done = sessions.filter { doneThisWeek.contains($0.day) }.count
        return HStack(spacing: 12) {
            HStack(spacing: 6) {
                ForEach(sessions, id: \.day) { plan in
                    Capsule().fill(doneThisWeek.contains(plan.day) ? Palette.gold : Palette.secondary).frame(height: 6)
                }
            }
            Text("\(done) de \(sessions.count) esta semana").font(.apFootnote.monospacedDigit())
                .foregroundStyle(Palette.muted).fixedSize()
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Esta semana: \(done) de \(sessions.count) sesiones")
    }

    /// Fila de la rutina: foto, «Sesión N» (con «Siguiente» o «Hecha»), nombre y detalle, con chevron.
    private func sessionRow(_ number: Int, _ plan: DayPlan) -> some View {
        let isExpanded = openKey == plan.day
        let done = doneThisWeek.contains(plan.day)
        let isNext = next?.day == plan.day
        let shape = RoundedRectangle(cornerRadius: Radius.card, style: .continuous)
        return Button {
            Haptics.selection()
            // Tocar la abierta la pliega; tocar otra la abre.
            withAnimation(reduceMotion ? nil : .snappy) {
                if isExpanded { collapsedAll = true; expanded = nil } else { collapsedAll = false; expanded = plan.day }
            }
        } label: {
            HStack(spacing: 14) {
                rowThumb(plan)
                VStack(alignment: .leading, spacing: 2) {
                    HStack(spacing: 4) {
                        Text("Sesión \(number)").foregroundStyle(Palette.muted)
                        if done {
                            Text("·").foregroundStyle(Palette.muted)
                            Image(systemName: "checkmark").font(.system(size: 11, weight: .bold)).foregroundStyle(Palette.success)
                            Text("Hecha").foregroundStyle(Palette.success)
                        } else if isNext {
                            Text("· Siguiente").foregroundStyle(Palette.gold)
                        }
                    }
                    .font(.apFootnote.weight(.medium))
                    Text(plan.title).font(.apHeadline).foregroundStyle(Palette.foreground)
                        .lineLimit(2).fixedSize(horizontal: false, vertical: true)
                    Text(meta(plan)).font(.apFootnote.monospacedDigit()).foregroundStyle(Palette.muted).lineLimit(1)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                Image(systemName: "chevron.right").font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(isExpanded ? Palette.gold : Palette.muted)
                    .rotationEffect(.degrees(isExpanded ? 90 : 0))
                    .accessibilityHidden(true)
            }
            .padding(.leading, 12).padding(.trailing, 16).padding(.vertical, 12)
            .frame(maxWidth: .infinity, minHeight: 88, alignment: .leading)
            .background(Palette.card, in: shape)
            .overlay(shape.strokeBorder(isExpanded ? Palette.gold.opacity(0.6) : Color.white.opacity(0.08), lineWidth: 1))
            .contentShape(shape)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Sesión \(number): \(plan.title)\(done ? ", hecha esta semana" : isNext ? ", siguiente" : "")")
        .accessibilityAddTraits(isExpanded ? .isSelected : [])
    }

    /// Detalle corto de la fila: ejercicios y series del gimnasio, intensidad y duración de la actividad.
    private func meta(_ plan: DayPlan) -> String {
        if plan.isGym {
            let exercises = plan.exercises ?? []
            let sets = exercises.reduce(0) { $0 + $1.series }
            guard !exercises.isEmpty else { return "Sin ejercicios todavía" }
            return ["\(exercises.count) \(exercises.count == 1 ? "ejercicio" : "ejercicios")", sets > 0 ? "\(sets) \(sets == 1 ? "serie" : "series")" : nil].compactMap { $0 }.joined(separator: " · ")
        }
        let parts = [plan.intensity.map { "Intensidad \($0.lowercased())" }, plan.duration].compactMap { $0 }.filter { !$0.isEmpty }
        return parts.isEmpty ? "Actividad" : parts.joined(separator: " · ")
    }

    /// Foto de la fila: la del primer ejercicio o la de marca; la actividad, su llama.
    @ViewBuilder private func rowThumb(_ plan: DayPlan) -> some View {
        let shape = RoundedRectangle(cornerRadius: 16, style: .continuous)
        if let emoji = SessionIdentity.clean(plan.session_icon) {
            Text(emoji).font(.system(size: 32))
                .frame(width: 64, height: 64)
                .background(Palette.secondary, in: shape)
                .accessibilityHidden(true)
        } else if plan.isGym {
            let source = (plan.exercises ?? []).compactMap(\.image_url).first { !$0.isEmpty } ?? Self.brandGymPhoto
            CachedAsyncImage(url: URL(string: source), maxSide: 300) {
                $0.resizable().scaledToFill()
            } placeholder: {
                Palette.secondary
            }
            .frame(width: 64, height: 64)
            .clipShape(shape)
            .accessibilityHidden(true)
        } else {
            Image(systemName: "flame").font(.system(size: 22, weight: .medium))
                .foregroundStyle(Palette.gold)
                .frame(width: 64, height: 64)
                .background(Palette.secondary, in: shape)
                .accessibilityHidden(true)
        }
    }

    @ViewBuilder private func session(_ plan: DayPlan) -> some View {
        let exercises = plan.exercises ?? []
        VStack(alignment: .leading, spacing: 12) {
            // La foto y el nombre ya están en la fila: aquí solo la acción y los ejercicios.
            action(plan)
            if plan.isGym {
                if !exercises.isEmpty {
                    VStack(spacing: 0) {
                        ForEach(Array(exercises.enumerated()), id: \.offset) { i, ex in
                            Button { detail = ex } label: {
                                HStack(spacing: 12) {
                                    // Miniaturas uniformes (44) y mismo padding en todas las filas.
                                    ExerciseThumb(url: ex.image_url, size: 44)
                                    VStack(alignment: .leading, spacing: 3) {
                                        Text(ex.name).font(.apHeadline).lineLimit(2)
                                            .fixedSize(horizontal: false, vertical: true)
                                        let info = [ex.rest, ex.muscle_group].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: " · ")
                                        if !info.isEmpty {
                                            Text(info).font(.apFootnote).foregroundStyle(Palette.muted).lineLimit(1)
                                        }
                                    }
                                    .frame(maxWidth: .infinity, alignment: .leading)
                                    // Ancho propio y números tabulares: la columna queda alineada
                                    // a la derecha en todas las filas y no se parte nunca.
                                    Text("\(ex.series) × \(ex.reps)").font(.apSubhead.monospacedDigit())
                                        .foregroundStyle(Palette.muted)
                                        .lineLimit(1).fixedSize(horizontal: true, vertical: false)
                                    Image("lu-chevron-left").renderingMode(.template).resizable().frame(width: 16, height: 16)
                                        .rotationEffect(.degrees(180)).foregroundStyle(Palette.muted.opacity(0.6))
                                        .accessibilityHidden(true)
                                }
                                .padding(.horizontal, 16).padding(.vertical, 10)
                                .frame(minHeight: 64)
                                .overlay(alignment: .bottom) {
                                    // 16 + 44 (foto) + 12: el separador empieza donde el texto.
                                    if i < exercises.count - 1 {
                                        Rectangle().fill(Palette.separator).frame(height: 0.5)
                                            .padding(.leading, 72).padding(.trailing, 16)
                                    }
                                }
                                .contentShape(Rectangle())
                            }
                            .buttonStyle(.plain)
                            .contextMenu {
                                Button { Haptics.tap(); detail = ex } label: {
                                    Label("Ficha de técnica", systemImage: "info.circle")
                                }
                            }
                            .accessibilityHint("Abre la ficha de técnica del ejercicio")
                        }
                    }
                    .background(Palette.card, in: RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
                    .clipShape(RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
                }
            } else {
                VStack(spacing: 0) {
                    infoRow("lu-flame", "Intensidad", plan.intensity ?? "", last: false)
                    infoRow("lu-clock", "Duración", planDurations(plan), last: true)
                }
                .background(Palette.card, in: RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
            }
            if onPersonalize != nil {
                Button { Haptics.selection(); personalizing = plan } label: {
                    Label("Nombre e icono", systemImage: "pencil")
                }
                .buttonStyle(.pillSecondary)
                .accessibilityHint("Cambia el nombre y el icono de esta sesión")
            }
        }
    }

    /// Acción de la sesión elegida: empezar o continuar el entreno, marcar la actividad o el estado hecho.
    @ViewBuilder private func action(_ plan: DayPlan) -> some View {
        let exercises = plan.exercises ?? []
        let done = doneToday.contains(plan.day)
        if plan.isGym {
            if done {
                completedLabel("Entrenamiento completado")
            } else if exercises.isEmpty {
                Text("Esta sesión no tiene ejercicios todavía.")
                    .font(.apSubhead).foregroundStyle(Palette.muted)
            } else {
                Button(resumableDay == plan.day ? "Continuar entreno" : "Empezar sesión") { Haptics.tap(); onOpen(plan.day) }
                    .buttonStyle(.pill)
            }
        } else if done {
            completedLabel("Actividad completada")
        } else {
            Button("Marcar actividad como hecha") { Haptics.tap(); onOpen(plan.day) }.buttonStyle(.pill)
        }
    }

    /// Estado «hecho» de la sesión: misma forma y alto que la píldora de acción, en dorado y sin acción.
    private func completedLabel(_ title: String) -> some View {
        Label(title, systemImage: "checkmark.circle.fill")
            .font(.apHeadline).foregroundStyle(Palette.gold)
            .frame(maxWidth: .infinity, minHeight: 50)
            .background(Palette.gold.opacity(0.14), in: Capsule())
            .accessibilityElement(children: .combine)
    }

    /// Duración del plan; si el campo viene vacío, se estima por series y descansos.
    private func planDurations(_ plan: DayPlan) -> String {
        if let d = plan.duration?.trimmingCharacters(in: .whitespaces), !d.isEmpty { return d }
        let exercises = plan.exercises ?? []
        guard !exercises.isEmpty else { return "—" }
        let seconds = exercises.reduce(0.0) { total, e in
            let rest = Double(e.rest.filter { $0.isNumber }) ?? 60
            return total + Double(max(e.series, 1)) * (rest + 40)
        }
        return "≈ \(Int((seconds / 60).rounded())) min"
    }

    private func infoRow(_ icon: String, _ title: String, _ value: String, last: Bool) -> some View {
        HStack(spacing: 12) {
            Image(icon).renderingMode(.template).resizable().frame(width: 20, height: 20)
                .foregroundStyle(Palette.muted).frame(width: 28)
            Text(title).font(.apBody)
            Spacer(minLength: 8)
            Text(value).font(.apBody).foregroundStyle(Palette.muted)
                .lineLimit(1).fixedSize(horizontal: true, vertical: false)
        }
        .frame(minHeight: 48)
        .padding(.horizontal, 16)
        .overlay(alignment: .bottom) {
            // 16 + 28 (icono) + 12: el separador empieza donde empieza el texto.
            if !last {
                Rectangle().fill(Palette.separator).frame(height: 0.5)
                    .padding(.leading, 56).padding(.trailing, 16)
            }
        }
        .accessibilityElement(children: .combine)
    }

    /// Foto de marca de la web (`BRAND_PHOTOS.gym`): respaldo de la portada cuando la sesión no
    /// tiene ninguna foto de ejercicio, igual que `TrainingPlanView.tsx`.
    private static let brandGymPhoto = "https://enebrcdrdnfkyduzyrzm.supabase.co/storage/v1/object/public/site-assets/exercise-images/a31c7206-d2a4-4b31-856a-f5dec09b890e-1791475829849.png"

    /// Plan sin sesiones: tarjeta vacía con su icono y el siguiente paso.
    private func emptyCard(icon: String, title: String, message: String) -> some View {
        VStack(spacing: 0) {
            ZStack {
                Circle().fill(Palette.gold.opacity(0.15)).frame(width: 64, height: 64)
                Image(icon).renderingMode(.template).resizable().frame(width: 26, height: 26).foregroundStyle(Palette.gold)
            }
            .accessibilityHidden(true)
            Text(title).font(.apHeadline).padding(.top, 16)
            Text(message).font(.apSubhead).foregroundStyle(Palette.muted)
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 6)
        }
        .padding(.horizontal, 20).padding(.vertical, 24)
        .frame(maxWidth: .infinity, minHeight: 288)
        .background(Palette.card, in: RoundedRectangle(cornerRadius: Radius.hero, style: .continuous))
    }

}

/// «Personalizar sesión» (`SessionIdentitySheet.tsx`): nombre propio o sugerido y un icono
/// (la foto de la sesión, un emoji propio o el sugerido según sus ejercicios).
struct SessionIdentitySheet: View {
    let plan: DayPlan
    let number: Int
    let onSave: (String, String?) async -> Bool
    @Environment(\.dismiss) private var dismiss
    @State private var name: String
    @State private var icon: String?
    @State private var saving = false
    @State private var failed = false

    init(plan: DayPlan, number: Int, onSave: @escaping (String, String?) async -> Bool) {
        self.plan = plan
        self.number = number
        self.onSave = onSave
        _name = State(initialValue: plan.routine_name ?? "")
        _icon = State(initialValue: SessionIdentity.clean(plan.session_icon))
    }

    private var suggestedName: String { SessionIdentity.suggestedName(plan) }
    private var suggestedIcon: String { SessionIdentity.suggestedIcon(plan) }
    private var options: [String] { [suggestedIcon] + SessionIdentity.emojis.filter { $0 != suggestedIcon } }
    private let columns = [GridItem(.adaptive(minimum: 48, maximum: 56), spacing: 10)]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Sesión \(number)").font(.apFootnote.weight(.medium)).foregroundStyle(Palette.muted)
                    Text("Personalizar sesión").font(.inter(size: 22, weight: .bold)).tracking(-0.4)
                        .accessibilityAddTraits(.isHeader)
                }

                if plan.isGym {
                    VStack(alignment: .leading, spacing: 10) {
                        Text("Nombre").font(.apSubhead.weight(.semibold))
                        PillField(label: suggestedName, text: $name)
                        if name.trimmingCharacters(in: .whitespaces) != suggestedName {
                            Button { Haptics.selection(); name = suggestedName } label: {
                                (Text("Sugerido: ").foregroundColor(Palette.muted) + Text(suggestedName).foregroundColor(Palette.foreground))
                                    .font(.apSubhead)
                                    .padding(.horizontal, 16).frame(minHeight: 44)
                                    .background(Palette.secondary, in: Capsule())
                            }
                            .buttonStyle(.plain)
                            .accessibilityLabel("Usar el nombre sugerido: \(suggestedName)")
                        }
                    }
                }

                VStack(alignment: .leading, spacing: 10) {
                    Text("Icono").font(.apSubhead.weight(.semibold))
                    Text(plan.isGym ? "La foto de la sesión o un emoji. El sugerido, con el punto dorado, sale de sus ejercicios."
                                    : "El icono de la actividad o un emoji. El sugerido lleva el punto dorado.")
                        .font(.apFootnote).foregroundStyle(Palette.muted)
                    LazyVGrid(columns: columns, alignment: .leading, spacing: 10) {
                        iconOption(nil)
                        ForEach(options, id: \.self) { iconOption($0) }
                    }
                }

                if failed {
                    Text("No se pudo guardar. Inténtalo de nuevo.").font(.apFootnote).foregroundStyle(Palette.destructive)
                        .accessibilityAddTraits(.updatesFrequently)
                }

                Button(saving ? "Guardando…" : "Guardar") {
                    Task {
                        saving = true
                        failed = false
                        let ok = await onSave(name, icon)
                        saving = false
                        if ok { dismiss() } else { failed = true; A11y.announce("No se pudo guardar") }
                    }
                }
                .buttonStyle(.pill)
                .disabled(saving || (plan.isGym && name.trimmingCharacters(in: .whitespaces).isEmpty))
            }
            .padding(24)
        }
        .presentationDetents([.large])
        #if os(macOS)
        .frame(minWidth: 420, minHeight: 560)
        #endif
    }

    /// Una opción del icono: `nil` es la foto de la sesión (o la llama de la actividad).
    private func iconOption(_ value: String?) -> some View {
        let selected = icon == value
        let shape = RoundedRectangle(cornerRadius: 16, style: .continuous)
        return Button { Haptics.selection(); icon = value } label: {
            Group {
                if let value {
                    Text(value).font(.system(size: 24))
                } else {
                    Image(systemName: plan.isGym ? "photo" : "flame")
                        .font(.system(size: 18, weight: .medium))
                        .foregroundStyle(plan.isGym ? Palette.muted : Palette.gold)
                }
            }
            .frame(width: 48, height: 48)
            .background(Palette.secondary, in: shape)
            .overlay(shape.strokeBorder(selected ? Palette.gold : .clear, lineWidth: 2))
            .overlay(alignment: .topTrailing) {
                if value == suggestedIcon {
                    Circle().fill(Palette.gold).frame(width: 10, height: 10)
                        .overlay(Circle().stroke(Palette.card, lineWidth: 2)).offset(x: 2, y: -2)
                }
            }
        }
        .buttonStyle(.plain)
        .accessibilityLabel(value.map { $0 == suggestedIcon ? "\($0), sugerido" : $0 } ?? (plan.isGym ? "Foto de la sesión" : "Icono de actividad"))
        .accessibilityAddTraits(selected ? [.isButton, .isSelected] : .isButton)
    }
}
