import SwiftUI

/// «Nueva rutina» y «Editar rutina» (`RoutineEditor.tsx` en la web): nombre, ejercicios con el
/// selector compartido y cada fila con el mismo editor que «Editar mi rutina» (series, reps
/// «Fijo | Rango», descanso rápido u «Otro»). Una sola acción dorada: «Guardar rutina».
struct RoutineEditorView: View {
    @Environment(\.dismiss) private var dismiss
    let routines: [DayPlan]
    var limitReached = false
    var existingRoutines: [DayPlan] = []
    var onSave: (String, [RoutineDay], String?) async -> Bool

    private struct EditableDay: Identifiable, Equatable {
        let id = UUID()
        var weekday: String
        var title: String
        var exercises: [GymExercise]
    }

    @State private var name: String
    @State private var days: [EditableDay]
    @State private var pickingFor: UUID? = nil
    @State private var saving = false
    @State private var failed = false
    @State private var confirmDiscard = false
    @State private var routineId: String?

    init(routines: [DayPlan] = [], limitReached: Bool = false, existingRoutines: [DayPlan] = [],
         onSave: @escaping (String, [RoutineDay], String?) async -> Bool) {
        self.routines = routines
        self.limitReached = limitReached
        self.existingRoutines = existingRoutines
        self.onSave = onSave
        let first = routines.first
        _name = State(initialValue: first?.routine_name ?? "")
        if !routines.isEmpty {
            _days = State(initialValue: routines.map { EditableDay(weekday: $0.day, title: $0.day_title ?? "", exercises: $0.exercises ?? []) })
            _routineId = State(initialValue: first?.routine_id)
        } else {
            _days = State(initialValue: [])
            _routineId = State(initialValue: nil)
        }
    }

    private var editing: Bool { !routines.isEmpty }
    private var trimmedName: String { name.trimmingCharacters(in: .whitespacesAndNewlines) }
    private var dirty: Bool {
        if editing { return trimmedName != (routines.first?.routine_name ?? "").trimmingCharacters(in: .whitespacesAndNewlines) || days != routines.map { EditableDay(weekday: $0.day, title: $0.day_title ?? "", exercises: $0.exercises ?? []) } }
        return !trimmedName.isEmpty || !days.isEmpty
    }
    private var ready: Bool { !trimmedName.isEmpty && !days.isEmpty && days.allSatisfy { !$0.exercises.isEmpty } && !blocked }
    private var blocked: Bool { !editing && limitReached && days.count >= 7 }
    private var totalSets: Int { days.reduce(0) { $0 + $1.exercises.reduce(0) { $0 + $1.series } } }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    Text("Ponle nombre, añade los días y los ejercicios de cada uno.")
                        .font(.apSubhead).foregroundStyle(Palette.muted)
                        .fixedSize(horizontal: false, vertical: true)
                    if !editing && limitReached { RoutineLimitNote() }
                    // Nombre
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Nombre").font(.apFootnote.weight(.semibold)).foregroundStyle(Palette.muted)
                            .padding(.leading, 4).accessibilityHidden(true)
                        TextField("Ej.: Safety", text: $name)
                            .font(.apBody).textFieldStyle(.plain)
                            .padding(.horizontal, 20).frame(minHeight: 52)
                            .background(Palette.secondary, in: Capsule())
                            .accessibilityLabel("Nombre")
                    }
                    // Rutina padre (solo al crear)
                    if !editing {
                        let groups = Dictionary(grouping: existingRoutines.filter { $0.custom == true }, by: { CustomRoutines.routineKey($0) })
                            .sorted { $0.key < $1.key }
                        if !groups.isEmpty {
                            VStack(alignment: .leading, spacing: 8) {
                                Text("Añadir a rutina existente").font(.apFootnote.weight(.semibold)).foregroundStyle(Palette.muted)
                                    .padding(.leading, 4).accessibilityHidden(true)
                                ScrollView(.horizontal, showsIndicators: false) {
                                    HStack(spacing: 8) {
                                        Button { Haptics.selection(); routineId = nil } label: {
                                            Text("Nueva rutina").font(.apSubhead.weight(.semibold))
                                                .foregroundStyle(routineId == nil ? Palette.background : Palette.foreground)
                                                .padding(.horizontal, 14).frame(height: 36)
                                                .background(routineId == nil ? Palette.gold : Palette.secondary, in: Capsule())
                                        }
                                        .buttonStyle(.plain)
                                        ForEach(groups, id: \.key) { g in
                                            let rid = g.value.first?.routine_id ?? g.key
                                            let rname = g.value.first.map { CustomRoutines.name($0) } ?? g.key
                                            Button { Haptics.selection(); routineId = rid } label: {
                                                Text(rname).font(.apSubhead.weight(.semibold))
                                                    .foregroundStyle(routineId == rid ? Palette.background : Palette.foreground)
                                                    .padding(.horizontal, 14).frame(height: 36)
                                                    .background(routineId == rid ? Palette.gold : Palette.secondary, in: Capsule())
                                            }
                                            .buttonStyle(.plain)
                                        }
                                    }
                                }
                            }
                        }
                    }
                    // Días
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Días").font(.apTitle3).accessibilityAddTraits(.isHeader)
                        if days.isEmpty {
                            Text("Añade al menos un día con sus ejercicios.").font(.apFootnote).foregroundStyle(Palette.muted)
                        }
                        ForEach($days) { $day in
                            VStack(alignment: .leading, spacing: 8) {
                                HStack {
                                    // Selector de día de la semana
                                    Menu {
                                        ForEach(DayNames.all, id: \.self) { d in
                                            Button(d) { day.weekday = d }
                                        }
                                    } label: {
                                        Text(day.weekday).font(.apHeadline)
                                            .padding(.horizontal, 14).frame(height: 40)
                                            .background(Palette.secondary, in: Capsule())
                                    }
                                    Spacer()
                                    Button(role: .destructive) { days.removeAll { $0.id == day.id } } label: {
                                        Image(systemName: "trash").foregroundStyle(Palette.destructive)
                                            .frame(width: 40, height: 40)
                                    }
                                    .buttonStyle(.plain)
                                }
                                TextField("Título del día (ej. Push)", text: $day.title)
                                    .font(.apBody).textFieldStyle(.plain)
                                    .padding(.horizontal, 14).frame(minHeight: 44)
                                    .background(Palette.secondary, in: Capsule())
                                    .accessibilityLabel("Título del día")
                                if day.exercises.isEmpty {
                                    Button { Haptics.selection(); pickingFor = day.id } label: {
                                        VStack(spacing: 6) {
                                            Image(systemName: "plus").font(.system(size: 20, weight: .bold)).foregroundStyle(Palette.gold)
                                                .frame(width: 40, height: 40).background(Palette.gold.opacity(0.15), in: Circle())
                                            Text("Añadir ejercicios").font(.apHeadline)
                                            Text("Busca por nombre o filtra por músculo").font(.apFootnote).foregroundStyle(Palette.muted)
                                        }
                                        .frame(maxWidth: .infinity, minHeight: 120).surface(Radius.hero)
                                    }
                                    .buttonStyle(.pressableCard)
                                } else {
                                    VStack(spacing: 8) {
                                        ForEach(Array(day.exercises.enumerated()), id: \.offset) { idx, ex in
                                            HStack {
                                                Text(ex.name).font(.apSubhead).lineLimit(1)
                                                Spacer()
                                                Text("\(ex.series)×\(ex.reps)").font(.apFootnote.monospacedDigit()).foregroundStyle(Palette.muted)
                                                Button { day.exercises.remove(at: idx) } label: {
                                                    Image(systemName: "xmark").font(.system(size: 12, weight: .bold)).foregroundStyle(Palette.muted)
                                                        .frame(width: 28, height: 28)
                                                }
                                                .buttonStyle(.plain)
                                            }
                                            .padding(.horizontal, 12).padding(.vertical, 8)
                                            .background(Palette.secondary, in: RoundedRectangle(cornerRadius: Radius.chip, style: .continuous))
                                        }
                                    }
                                    Button { Haptics.selection(); pickingFor = day.id } label: { Label("Añadir ejercicios", systemImage: "plus") }
                                        .buttonStyle(.pillSecondary)
                                }
                            }
                            .padding(12).surface()
                        }
                        Button { Haptics.tap(); days.append(EditableDay(weekday: "Lunes", title: "", exercises: [])) } label: {
                            Label("Añadir día", systemImage: "plus")
                        }
                        .buttonStyle(.pillSecondary)
                    }
                }
                .padding(16)
                .frame(maxWidth: 680)
                .frame(maxWidth: .infinity)
            }
            .scrollDismissesKeyboard(.interactively)
            .screenBackground()
            .safeAreaInset(edge: .bottom) { footer }
            .navigationTitle(editing ? "Editar rutina" : "Nueva rutina")
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cerrar") { if dirty { confirmDiscard = true } else { dismiss() } }
                }
            }
            .confirmationDialog("Tienes cambios sin guardar.", isPresented: $confirmDiscard, titleVisibility: .visible) {
                Button("Descartar cambios", role: .destructive) { dismiss() }
                Button("Seguir editando", role: .cancel) {}
            }
            .sheet(isPresented: Binding(get: { pickingFor != nil }, set: { if !$0 { pickingFor = nil } })) {
                if let dayId = pickingFor, let day = days.first(where: { $0.id == dayId }) {
                    ExercisePickerView(existing: Set(day.exercises.map(\.name))) { picked in
                        if let idx = days.firstIndex(where: { $0.id == dayId }) {
                            days[idx].exercises += picked
                        }
                    }
                    .presentationBackground(Palette.background)
                }
            }
        }
        .interactiveDismissDisabled(dirty)
        #if os(macOS)
        .frame(minWidth: 560, minHeight: 680)
        #endif
    }

    private var footer: some View {
        VStack(spacing: 8) {
            if failed {
                Text("No se pudo guardar la rutina. Inténtalo de nuevo.").font(.apFootnote).foregroundStyle(Palette.destructive)
                    .multilineTextAlignment(.center)
            }
            Button(saving ? "Guardando…" : "Guardar rutina") { Task { await save() } }
                .buttonStyle(.pill)
                .disabled(!ready || saving)
            if totalSets > 0 {
                Text("\(days.count) días · \(totalSets) series")
                    .font(.apFootnote.monospacedDigit()).foregroundStyle(Palette.muted)
            }
        }
        .padding(.horizontal, 16).padding(.top, 12).padding(.bottom, 8)
        .frame(maxWidth: 680)
        .frame(maxWidth: .infinity)
        .background(alignment: .top) {
            Palette.background.opacity(0.92).ignoresSafeArea(edges: .bottom)
                .overlay(alignment: .top) { Rectangle().fill(Palette.separator).frame(height: 0.5) }
        }
    }

    private func save() async {
        guard ready, !saving else { return }
        saving = true
        failed = false
        let routineDays = days.map { RoutineDay(day: $0.weekday, title: $0.title, exercises: $0.exercises) }
        let ok = await onSave(trimmedName, routineDays, routineId)
        saving = false
        if ok { Haptics.success(); dismiss() } else { failed = true; Haptics.error(); A11y.announce("No se pudo guardar la rutina") }
    }
}

struct RoutineLimitNote: View {
    var body: some View {
        Text("\(CustomRoutines.limitMessage).")
            .font(.apSubhead).foregroundStyle(Palette.foreground)
            .fixedSize(horizontal: false, vertical: true)
            .padding(.horizontal, 16).padding(.vertical, 12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Palette.gold.opacity(0.10), in: RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
            .accessibilityAddTraits(.updatesFrequently)
    }
}

/// «Mis rutinas» en Entrenar (`MyRoutines.tsx`): «Nueva rutina» como píldora tranquila junto al título
/// y cada rutina en una tarjeta compacta (nombre, cuántos ejercicios y qué músculos, tres miniaturas con
/// «+N» y una sola acción, «Empezar»); en «···», «Editar», «Duplicar» y «Borrar» (con hoja de
/// confirmación). Debajo, si tus rutinas no llegan a tus días de entreno, «Completar con el autopiloto».
struct MyRoutinesSection: View {
    /// «Completar con el autopiloto» (`AutopilotOffer` en la web): lo ofrece Entrenar cuando
    /// `CustomRoutines.canCompleteWithAutopilot` (plan todo tuyo y menos sesiones que tus días).
    struct Autopilot {
        /// Sesiones tuyas y tus días de entreno: «Tus rutinas cubren 2 de tus 4 días de entreno».
        let own: Int
        let frequency: Int
        /// generate-plan alrededor de tus rutinas y el plan se vuelve a leer: cuántas respetó, o nil si falló.
        let onComplete: () async -> Int?
    }

    private enum Fill: Equatable { case idle, running(own: Int, frequency: Int), done(kept: Int), failed }

    let routines: [DayPlan]
    let limitReached: Bool
    var userId: String? = nil
    var resumableDay: String? = nil
    var doneToday: Set<String> = []
    /// Fila secundaria bajo tus rutinas; nil si no se ofrece.
    var autopilot: Autopilot? = nil
    var onNew: () -> Void
    var onStart: (String) -> Void
    var onEdit: (String) -> Void
    var onDuplicate: (String) async -> Bool
    var onDelete: (String) async -> Bool
    var onApply: ((String) -> Void)? = nil

    @State private var deleting: DayPlan?
    @State private var busy = false
    @State private var appliedKey: String? = nil
    /// El plan nuevo ya no pide la fila: el aviso de cómo fue (y la carga) se queda en su sitio.
    @State private var fill: Fill = .idle
    /// Miniaturas que se enseñan por rutina (en la fila de «Empezar»); el resto, «+N».
    private let thumbs = 3

    /// Letra del día de la semana (L, M, X, J, V, S, D), como la tira de Hoy.
    private func shortDay(_ day: String) -> String {
        switch day {
        case "Lunes": return "L"
        case "Martes": return "M"
        case "Miércoles": return "X"
        case "Jueves": return "J"
        case "Viernes": return "V"
        case "Sábado": return "S"
        case "Domingo": return "D"
        default: return String(day.prefix(1))
        }
    }

    /// Rutinas agrupadas por nombre: una rutina (push/pull/pierna…) se divide en varios días,
    /// y aquí se pintan juntas en una sola tarjeta en vez de N tarjetas iguales.
    private var grouped: [(name: String, days: [DayPlan])] {
        var order: [String] = []
        var dict: [String: [DayPlan]] = [:]
        for r in routines {
            let n = CustomRoutines.routineKey(r)
            if dict[n] == nil { order.append(n) }
            dict[n, default: []].append(r)
        }
        return order.map { key in
            let days = (dict[key] ?? []).sorted { (DayNames.all.firstIndex(of: $0.day) ?? 7) < (DayNames.all.firstIndex(of: $1.day) ?? 7) }
            let display = days.first.map { CustomRoutines.name($0) } ?? CustomRoutines.defaultName
            return (name: display, days: days)
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .center, spacing: 12) {
                Text("Rutinas propias").font(.apTitle3).accessibilityAddTraits(.isHeader)
                    .frame(maxWidth: .infinity, alignment: .leading)
                // Con rutinas, «Nueva rutina» es una píldora tranquila; sin ninguna, la tarjeta de abajo ya la ofrece.
                if !routines.isEmpty {
                    Button { Haptics.tap(); onNew() } label: {
                        HStack(spacing: 6) {
                            Image(systemName: "plus").font(.system(size: 13, weight: .bold))
                            Text("Nueva rutina").font(.apSubhead.weight(.semibold))
                        }
                        .foregroundStyle(Palette.foreground)
                        .lineLimit(1)
                        .padding(.horizontal, 14)
                        .frame(height: 36)
                        .background(RaisedFill(shape: Capsule()))
                        // Se ve compacta (36) pero su zona táctil mide 44, como `.btn-sm` en la web.
                        .padding(.vertical, 4)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.pressableCard(scale: 0.97))
                    .fixedSize()
                    .accessibilityHint(limitReached ? CustomRoutines.limitMessage : "Crea una rutina con tus ejercicios")
                }
            }
            .frame(minHeight: 44)
            if limitReached {
                Text("\(CustomRoutines.limitMessage).").font(.apFootnote).foregroundStyle(Palette.muted)
                    .fixedSize(horizontal: false, vertical: true).padding(.horizontal, 4)
            }
            if routines.isEmpty {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Crea tu primera rutina").font(.apHeadline)
                    Text("Elige tus ejercicios, series y descansos, y empiézala cuando quieras.")
                        .font(.apSubhead).foregroundStyle(Palette.muted).fixedSize(horizontal: false, vertical: true)
                    Button { Haptics.tap(); onNew() } label: { Label("Nueva rutina", systemImage: "plus") }
                        .buttonStyle(PillButtonStyle(kind: .secondary, height: 44)).fixedSize().padding(.top, 12)
                        .accessibilityHint(limitReached ? CustomRoutines.limitMessage : "Crea una rutina con tus ejercicios")
                }
                .padding(20)
                .frame(maxWidth: .infinity, alignment: .leading)
                .surface()
            } else {
                VStack(spacing: 8) {
                    ForEach(grouped, id: \.name) { group in card(name: group.name, days: group.days) }
                }
            }
            if showFill { autopilotCard }
        }
        .onAppear {
            if let uid = userId {
                appliedKey = UserDefaults.standard.string(forKey: "applied_routine_\\(uid)")
            }
        }
        .onReceive(NotificationCenter.default.publisher(for: .routineApplied)) { note in
            if let rid = note.object as? String { appliedKey = rid }
            else if let uid = userId { appliedKey = UserDefaults.standard.string(forKey: "applied_routine_\\(uid)") }
        }
        .sheet(item: $deleting) { routine in
            // Borrar: hoja de confirmación, como «¿Descartar entrenamiento?».
            ChoiceSheet(title: "¿Borrar «\(CustomRoutines.name(routine))»?",
                        message: "Se quita de tu plan. Tu historial y tus récords se quedan como están.",
                        primary: busy ? "Borrando…" : "Borrar rutina", destructive: true, cancel: "Cancelar") {
                guard !busy else { return }
                Task {
                    busy = true
                    let rid = routine.routine_id ?? CustomRoutines.routineKey(routine)
                    let daysToDelete = routines.filter { ($0.routine_id ?? CustomRoutines.routineKey($0)) == rid }.map(\.day)
                    var allOk = true
                    for d in daysToDelete {
                        let ok = await onDelete(d)
                        if !ok { allOk = false; break }
                    }
                    busy = false
                    if allOk { deleting = nil }
                }
            } onCancel: { deleting = nil }
        }
    }

    private var showFill: Bool {
        switch fill {
        case .running, .done: return true
        case .idle, .failed: return autopilot != nil
        }
    }

    /// Tarjeta compacta bajo tus rutinas (secundaria: la acción dorada de la pantalla es «Empezar sesión»):
    /// cuánto cubren tus rutinas y «Completar con el autopiloto»; mientras trabaja, el AP latiendo; al
    /// terminar, «Hemos respetado tus N rutinas»; si falla, el aviso de error con «Reintentar». Igual que
    /// `AutopilotFillCard` en la web.
    private var autopilotCard: some View {
        VStack(alignment: .leading, spacing: 0) {
            switch fill {
            case .done(let kept):
                HStack(alignment: .top, spacing: 12) {
                    IconTile(symbol: "checkmark", size: 40)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(PlanShield.keptTitle(kept)).font(.apHeadline)
                        Text(PlanShield.description).font(.apFootnote).foregroundStyle(Palette.muted)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
                .accessibilityElement(children: .combine)
            case .failed:
                HStack(alignment: .top, spacing: 12) {
                    IconTile(symbol: "exclamationmark.triangle", size: 40, tint: Palette.destructive)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(CustomRoutines.fillErrorTitle).font(.apHeadline)
                            .fixedSize(horizontal: false, vertical: true)
                        Text(CustomRoutines.fillErrorDetail).font(.apFootnote).foregroundStyle(Palette.muted)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
                .accessibilityElement(children: .combine)
                Button(CustomRoutines.fillRetry) { Task { await completeWithAutopilot() } }
                    .buttonStyle(PillButtonStyle(kind: .secondary, height: 44))
                    .padding(.top, 12)
            case .idle, .running:
                let running = fill != .idle
                let own: Int = { if case .running(let own, _) = fill { return own }; return autopilot?.own ?? 0 }()
                let frequency: Int = { if case .running(_, let frequency) = fill { return frequency }; return autopilot?.frequency ?? 0 }()
                Text(CustomRoutines.fillSummary(own: own, frequency: frequency))
                    .font(.apHeadline.monospacedDigit()).fixedSize(horizontal: false, vertical: true)
                Text(CustomRoutines.fillDetail).font(.apFootnote).foregroundStyle(Palette.muted)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.top, 2)
                // Sin `.disabled` mientras trabaja: el AP se ve entero, no apagado; un segundo toque no hace nada.
                Button { Task { await completeWithAutopilot() } } label: {
                    // Con letra grande, el texto baja de línea centrado y con aire (`py-2.5` en la web).
                    Group {
                        if running {
                            HStack(spacing: 10) {
                                BrandLoader(size: 18).accessibilityHidden(true)
                                Text(CustomRoutines.fillRunning)
                            }
                        } else {
                            Text(CustomRoutines.fillAction)
                        }
                    }
                    .multilineTextAlignment(.center)
                    .padding(.vertical, 10)
                }
                .buttonStyle(PillButtonStyle(kind: .secondary, height: 44))
                .allowsHitTesting(!running)
                .padding(.top, 12)
                .accessibilityLabel(running ? CustomRoutines.fillRunning : CustomRoutines.fillAction)
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .surface()
    }

    private func completeWithAutopilot() async {
        guard let autopilot else { return }
        if case .running = fill { return }
        Haptics.tap()
        fill = .running(own: autopilot.own, frequency: autopilot.frequency)
        A11y.announce(CustomRoutines.fillRunning)
        guard let kept = await autopilot.onComplete() else {
            fill = .failed
            Haptics.error()
            A11y.announce(CustomRoutines.fillErrorTitle)
            return
        }
        let shown = kept > 0 ? kept : autopilot.own
        fill = .done(kept: shown)
        Haptics.success()
        A11y.announce("\(PlanShield.keptTitle(shown)). \(PlanShield.description)")
    }

    private func card(name: String, days: [DayPlan]) -> some View {
        let first = days.first
        let isApplied = first.map { appliedKey == CustomRoutines.routineKey($0) } ?? false
        return VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .center, spacing: 8) {
                Text(name).font(.apHeadline).lineLimit(1)
                    .frame(maxWidth: .infinity, alignment: .leading)
                if isApplied {
                    Text("Predeterminada")
                        .font(.apFootnote.weight(.semibold)).foregroundStyle(Palette.gold)
                        .padding(.horizontal, 10).frame(height: 24)
                        .background(Palette.gold.opacity(0.12), in: Capsule())
                }
                Menu {
                    Button { Haptics.selection(); onEdit(first!.day) } label: { Label("Editar", systemImage: "pencil") }
                    if let apply = onApply, let rid = first.flatMap({ $0.routine_id ?? CustomRoutines.routineKey($0) }) {
                        Button {
                            Haptics.selection()
                            if let uid = userId { UserDefaults.standard.set(rid, forKey: "applied_routine_\(uid)") }
                            apply(rid)
                        } label: { Label("Aplicar al plan", systemImage: "checkmark.circle") }
                    }
                    Divider()
                    Button(role: .destructive) { Haptics.warning(); deleting = first } label: { Label("Borrar", systemImage: "trash") }
                } label: {
                    Image(systemName: "ellipsis").font(.system(size: 15, weight: .semibold)).foregroundStyle(Palette.muted)
                        .frame(width: 32, height: 32).contentShape(Circle())
                }
                #if os(macOS)
                .menuStyle(.borderlessButton).menuIndicator(.hidden).fixedSize()
                #endif
            }
            FlowRow(spacing: 6) {
                ForEach(days, id: \.day) { d in
                    VStack(spacing: 2) {
                        Text(shortDay(d.day))
                            .font(.apFootnote.weight(.semibold))
                            .foregroundStyle(Palette.foreground)
                            .frame(width: 28, height: 28)
                            .background(Palette.secondary, in: Circle())
                        if let t = d.day_title, !t.isEmpty {
                            Text(t).font(.apCaption).foregroundStyle(Palette.muted).lineLimit(1)
                        }
                    }
                }
            }
            .accessibilityHidden(true)
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .surface()
    }
}

/// «Mis rutinas» en Hoy (`RoutinesPreview` en la web): hasta tres filas (miniatura, nombre y
/// resumen) que llevan a Entrenar, con «Ver todas» en la cabecera.
struct RoutinesPreview: View {
    let routines: [DayPlan]
    var onOpen: () -> Void

    var body: some View {
        if !routines.isEmpty {
            VStack(alignment: .leading, spacing: 12) {
                HStack(alignment: .firstTextBaseline) {
                    Text("Rutinas propias").font(.apTitle3).accessibilityAddTraits(.isHeader)
                    Spacer(minLength: 8)
                    Button("Ver todas") { Haptics.tap(); onOpen() }
                        .font(.apSubhead.weight(.semibold)).foregroundStyle(Palette.gold)
                        .buttonStyle(.plain).frame(minHeight: 44).padding(.vertical, -12)
                }
                VStack(spacing: 0) {
                    ForEach(Array(routines.prefix(3).enumerated()), id: \.element.day) { index, routine in
                        let first = routine.exercises?.first
                        Button { Haptics.tap(); onOpen() } label: {
                            HStack(spacing: 14) {
                                ExerciseThumb(url: first?.image_url, size: 48, name: first?.name ?? CustomRoutines.name(routine),
                                              muscleGroup: first?.muscle_group, video: first?.video_url)
                                VStack(alignment: .leading, spacing: 3) {
                                    Text(CustomRoutines.name(routine)).font(.apHeadline).foregroundStyle(Palette.foreground).lineLimit(1)
                                    Text(CustomRoutines.meta(routine)).font(.apFootnote.monospacedDigit()).foregroundStyle(Palette.muted).lineLimit(1)
                                }
                                .frame(maxWidth: .infinity, alignment: .leading)
                                Image(systemName: "chevron.right").font(.system(size: 13, weight: .semibold))
                                    .foregroundStyle(Palette.muted).accessibilityHidden(true)
                            }
                            .padding(.horizontal, 14).padding(.vertical, 10)
                            .frame(maxWidth: .infinity, minHeight: 76, alignment: .leading)
                            .contentShape(Rectangle())
                            .overlay(alignment: .top) {
                                if index > 0 { Rectangle().fill(Palette.separator).frame(height: 0.5).padding(.horizontal, 14) }
                            }
                        }
                        .buttonStyle(.plain)
                        .accessibilityElement(children: .combine)
                        .accessibilityLabel("\(CustomRoutines.name(routine)): \(CustomRoutines.meta(routine))")
                        .accessibilityHint("Abre Mis rutinas en Entrenar")
                    }
                }
                .surface()
            }
        }
    }
}

/// «Guardar como rutina» al terminar un entreno vacío (`SaveRoutineSheet.tsx`): el botón y, al
/// tocarlo, una hoja que pide el nombre y guarda los ejercicios y las series hechas.
struct SaveRoutineButton: View {
    let exercises: [GymExercise]
    let suggestedName: String
    let limitReached: Bool
    var onSave: (String, [GymExercise]) async -> TrainingRepo.RoutineCommit
    @State private var open = false
    @State private var saved = false

    var body: some View {
        Group {
            if saved {
                Label("Guardada en Mis rutinas", systemImage: "checkmark")
                    .font(.apHeadline).foregroundStyle(Palette.gold)
                    .frame(maxWidth: .infinity, minHeight: 50)
                    .background(Palette.gold.opacity(0.14), in: Capsule())
                    .accessibilityElement(children: .combine)
            } else {
                Button { Haptics.tap(); open = true } label: { Label("Guardar como rutina", systemImage: "plus") }
                    .buttonStyle(.pillSecondary)
            }
        }
        .sheet(isPresented: $open) {
            SaveRoutineSheet(exercises: exercises, suggestedName: suggestedName, limitReached: limitReached, onSave: onSave) {
                saved = true
            }
        }
    }
}

struct SaveRoutineSheet: View {
    @Environment(\.dismiss) private var dismiss
    let exercises: [GymExercise]
    let suggestedName: String
    let limitReached: Bool
    var onSave: (String, [GymExercise]) async -> TrainingRepo.RoutineCommit
    var onSaved: () -> Void
    @State private var name = ""
    @State private var saving = false
    @State private var failed = false
    @State private var full = false

    private var sets: Int { exercises.reduce(0) { $0 + $1.series } }
    private var trimmed: String { name.trimmingCharacters(in: .whitespacesAndNewlines) }

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            VStack(alignment: .leading, spacing: 4) {
                Text("Guardar como rutina").font(.apTitle3).accessibilityAddTraits(.isHeader)
                Text("\(ExerciseLibraryCatalog.count(exercises.count)) · \(sets) \(sets == 1 ? "serie" : "series"), tal como las has hecho.")
                    .font(.apSubhead.monospacedDigit()).foregroundStyle(Palette.muted)
                    .fixedSize(horizontal: false, vertical: true)
            }
            if limitReached || full { RoutineLimitNote() }
            VStack(alignment: .leading, spacing: 8) {
                Text("Nombre").font(.apFootnote.weight(.semibold)).foregroundStyle(Palette.muted)
                    .padding(.leading, 4).accessibilityHidden(true)
                TextField("Ej.: Pierna pesada", text: $name)
                    .font(.apBody).textFieldStyle(.plain)
                    .padding(.horizontal, 20).frame(minHeight: 52)
                    .background(Palette.secondary, in: Capsule())
                    .accessibilityLabel("Nombre")
                if failed {
                    Text("No se pudo guardar la rutina. Inténtalo de nuevo.").font(.apFootnote).foregroundStyle(Palette.destructive)
                }
            }
            Spacer(minLength: 0)
            Button(saving ? "Guardando…" : "Guardar rutina") { Task { await save() } }
                .buttonStyle(.pill)
                .disabled(saving || trimmed.isEmpty || limitReached || full)
            Button("Cancelar") { Haptics.selection(); dismiss() }
                .font(.apHeadline).foregroundStyle(Palette.foreground)
                .frame(maxWidth: .infinity, minHeight: 50).buttonStyle(.plain)
        }
        .padding(.horizontal, 24).padding(.top, 28).padding(.bottom, 12)
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
        .presentationBackground(Palette.card)
        #if os(macOS)
        .frame(minWidth: 420, minHeight: 380)
        #endif
        .onAppear { if name.isEmpty { name = suggestedName } }
    }

    private func save() async {
        guard !saving, !trimmed.isEmpty else { return }
        saving = true
        failed = false
        let result = await onSave(trimmed, exercises)
        saving = false
        switch result {
        case .ok:
            Haptics.success()
            onSaved()
            dismiss()
        case .limit:
            full = true
            A11y.announce(CustomRoutines.limitMessage)
        case .missing, .failed:
            failed = true
            Haptics.error()
        }
    }
}
