import SwiftUI

/// «Editar mi rutina» de la web (`PlanEditor.tsx`): días de la semana, nombre de la sesión,
/// ejercicios con series/reps/peso/descanso y «Añadir ejercicios». Al guardar, solo los días que
/// cambiaron quedan marcados `custom: true`: el piloto automático nunca pisa lo que hizo el usuario.
struct PlanEditorView: View {
    @EnvironmentObject private var session: SessionModel
    @Environment(\.dismiss) private var dismiss
    let original: [DayPlan]
    var onSaved: ([DayPlan]) -> Void

    @State private var draft: [DayPlan] = []
    @State private var day = DayNames.today
    @State private var picking = false
    @State private var saving = false
    @State private var error: String?
    @State private var confirmDiscard = false

    private var plan: DayPlan? { draft.first { $0.day == day } }
    private var exercises: [GymExercise] { plan?.isGym == true ? plan?.exercises ?? [] : [] }
    private var dirty: Bool { Self.normalized(draft) != Self.normalized(original) }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    dayChips
                    if plan?.type == "actividad" {
                        VStack(alignment: .leading, spacing: 12) {
                            // «Lunes: Pádel · 60 min» (sin deporte, «Actividad»), como en la web.
                            Text(["\(day): \(plan?.sport.flatMap { $0.isEmpty ? nil : $0 } ?? "Actividad")", plan?.duration].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: " · "))
                                .font(.apSubhead).foregroundStyle(Palette.muted)
                            Button("Convertir en día de fuerza") { setDay { _ in DayPlan(day: day, type: "gimnasio", routine_name: "", exercises: []) } }
                                .buttonStyle(.pillSecondary)
                        }
                        .padding(18).frame(maxWidth: .infinity, alignment: .leading)
                        .surface()
                    } else {
                        TextField("Nombre del \(day.lowercased()) (p. ej. Torso A)", text: Binding(
                            get: { plan?.routine_name ?? "" },
                            set: { name in setDay { var p = $0; p.routine_name = name; return p } }))
                            .font(.apBody).padding(.horizontal, 18).frame(height: 44)
                            .background(Palette.card, in: Capsule())
                            .accessibilityLabel("Nombre de la sesión")
                        if exercises.isEmpty {
                            // Día sin ejercicios: una tarjeta grande que invita a añadirlos (como la web).
                            Button { picking = true } label: {
                                VStack(spacing: 8) {
                                    Image("lu-plus").renderingMode(.template).resizable().frame(width: 24, height: 24).foregroundStyle(Palette.gold)
                                        .frame(width: 48, height: 48).background(Palette.gold.opacity(0.15), in: Circle())
                                        .padding(.bottom, 4)
                                    Text("Día de descanso").font(.apHeadline)
                                    Text("Añade ejercicios para entrenar el \(day.lowercased())").font(.apFootnote).foregroundStyle(Palette.muted)
                                        .multilineTextAlignment(.center)
                                }
                                .padding(.horizontal, 24)
                                .frame(maxWidth: .infinity, minHeight: 200)
                                .surface(Radius.hero)
                            }
                            .buttonStyle(.pressableCard)
                        } else {
                            VStack(spacing: 12) {
                                // Clave por ejercicio, no por posición: al subir o bajar una fila abierta, sigue abierta.
                                ForEach(PlanEditorValues.keyed(exercises)) { row in
                                    let index = row.index, ex = row.exercise
                                    PlanExerciseRow(exercise: ex, index: index, total: exercises.count,
                                                    onChange: { new in editExercises { $0[index] = new } },
                                                    onMove: { dir in editExercises { list in
                                                        let j = index + dir
                                                        if list.indices.contains(j) { list.swapAt(index, j) }
                                                    } },
                                                    onRemove: { editExercises { $0.remove(at: index) } })
                                }
                            }
                            Button { picking = true } label: { Label("Añadir ejercicios", systemImage: "plus") }
                                .buttonStyle(.pillSecondary)
                        }
                    }
                    if let error { Text(error).font(.apFootnote).foregroundStyle(Palette.destructive) }
                }
                .padding(16)
                .frame(maxWidth: 680)
                .frame(maxWidth: .infinity)
            }
            .scrollDismissesKeyboard(.interactively)
            .screenBackground()
            .navigationTitle("Editar mi rutina")
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cerrar") { if dirty { confirmDiscard = true } else { dismiss() } }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(saving ? "Guardando…" : "Guardar") { Task { await save() } }
                        .disabled(saving || !dirty).fontWeight(.semibold)
                }
            }
            .confirmationDialog("Tienes cambios sin guardar en tu rutina.", isPresented: $confirmDiscard, titleVisibility: .visible) {
                Button("Descartar cambios", role: .destructive) { dismiss() }
                Button("Seguir editando", role: .cancel) {}
            }
            .sheet(isPresented: $picking) {
                ExercisePickerView(existing: Set(exercises.map(\.name))) { picked in editExercises { $0 += picked } }
            }
        }
        .interactiveDismissDisabled(dirty)
        .onAppear { if draft.isEmpty { draft = original } }
    }

    private var dayChips: some View {
        HStack(spacing: 6) {
            ForEach(DayNames.all, id: \.self) { d in
                let p = draft.first { $0.day == d }
                let has = p != nil && (p?.type == "actividad" || !(p?.exercises ?? []).isEmpty)
                Button { Haptics.selection(); day = d } label: {
                    VStack(spacing: 4) {
                        Text(String(d.prefix(3))).font(.apFootnote.weight(.semibold))
                        Circle().fill(has ? Palette.gold : Palette.border).frame(width: 6, height: 6)
                    }
                    .frame(maxWidth: .infinity, minHeight: 44).padding(.vertical, 4)
                    .foregroundStyle(day == d ? Palette.foreground : Palette.muted)
                    .background(day == d ? Palette.gold.opacity(0.15) : Palette.secondary, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
                }
                .buttonStyle(.plain)
                .accessibilityLabel(has ? "\(d): \(Self.daySummary(p))" : "\(d), sin sesión")
                .accessibilityAddTraits(day == d ? .isSelected : [])
            }
        }
    }

    private func setDay(_ fn: (DayPlan) -> DayPlan) {
        let base = DayPlan(day: day, type: "gimnasio", routine_name: "", exercises: [])
        if let i = draft.firstIndex(where: { $0.day == day }) { draft[i] = fn(draft[i]) } else { draft.append(fn(base)) }
    }

    private func editExercises(_ fn: (inout [GymExercise]) -> Void) {
        setDay { p in
            var p = p
            var list = p.isGym ? p.exercises ?? [] : []
            fn(&list)
            p.type = "gimnasio"; p.exercises = list
            return p
        }
    }

    /// «4 ejercicios · 12 series», la actividad o «Descanso» (`daySummary` en la web).
    static func daySummary(_ p: DayPlan?) -> String {
        guard let p else { return "Descanso" }
        if p.type == "actividad" { return p.sport ?? "Actividad" }
        let list = p.exercises ?? []
        guard !list.isEmpty else { return "Descanso" }
        let sets = list.reduce(0) { $0 + $1.series }
        return "\(ExerciseLibraryCatalog.count(list.count)) · \(sets) \(sets == 1 ? "serie" : "series")"
    }

    /// Igual que `normalizePlan` de la web (el marcado lo hace `CustomRoutines.markEdited`).
    static func normalized(_ plans: [DayPlan]) -> [DayPlan] {
        plans.filter { $0.type == "actividad" || !($0.exercises ?? []).isEmpty }
            .sorted { (DayNames.all.firstIndex(of: $0.day) ?? 0) < (DayNames.all.firstIndex(of: $1.day) ?? 0) }
    }

    private func save() async {
        guard let userId = session.userId else { return }
        saving = true; defer { saving = false }
        // Solo los días que cambiaste pasan a ser tuyos (`markEditedDays` en la web): las sesiones del
        // piloto automático que no tocas siguen siendo suyas y se pueden seguir adaptando.
        let clean = CustomRoutines.markEdited(original: Self.normalized(original), next: Self.normalized(draft))
        struct Row: Encodable { let user_id: UUID; let workouts_json: [DayPlan]; let updated_at: String }
        do {
            try await Backend.client.from("training_plan")
                .upsert(Row(user_id: userId, workouts_json: clean, updated_at: ISO8601DateFormatter().string(from: Date())), onConflict: "user_id")
                .execute()
            // Inicio y Entrenar leen la caché: se pone al día para que no vuelva la rutina vieja.
            TrainingRepo.storePlanLocally(userId: userId, clean)
            Haptics.success()
            onSaved(clean)
            dismiss()
        } catch {
            Haptics.error()
            self.error = "No se pudo guardar tu rutina. Inténtalo de nuevo."
        }
    }
}

/// Fila de la rutina en una tarjeta sin borde (`ExerciseRowEditor.tsx`): plegada enseña la miniatura,
/// el nombre y «3 series · 8-12 reps · 90 s»; al tocarla se abren series y peso, las repeticiones
/// («Fijo» o «Rango», con mínimo y máximo), el descanso (rápidos u «Otro» libre) y «Subir», «Bajar»
/// y «Quitar». La usan «Editar mi rutina» y «Editar sesión».
struct PlanExerciseRow: View {
    let exercise: GymExercise
    let index: Int
    let total: Int
    var onChange: (GymExercise) -> Void
    var onMove: (Int) -> Void
    var onRemove: () -> Void
    @State private var open = false
    /// «Otro» elegido a mano aunque el descanso coincida con uno rápido (se escribe en su contador).
    @State private var customRest = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    /// Descansos rápidos en segundos («60 s», «90 s», «2 min», «3 min»), los mismos que `RESTS` en la web.
    static let rests = [60, 90, 120, 180]

    var body: some View {
        let shape = RoundedRectangle(cornerRadius: Radius.card, style: .continuous)
        VStack(alignment: .leading, spacing: 0) {
            Button {
                Haptics.selection()
                customRest = false
                withAnimation(reduceMotion ? nil : .snappy) { open.toggle() }
            } label: {
                HStack(spacing: 12) {
                    ExerciseThumb(url: exercise.image_url, size: 48, name: exercise.name, muscleGroup: exercise.muscle_group)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(exercise.name).font(.apHeadline).lineLimit(2).fixedSize(horizontal: false, vertical: true)
                        Text(PlanEditorValues.summary(exercise)).font(.apFootnote.monospacedDigit()).foregroundStyle(Palette.muted).lineLimit(1)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    Image(systemName: "chevron.down").font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(open ? Palette.gold : Palette.muted)
                        .rotationEffect(.degrees(open ? 180 : 0))
                        .accessibilityHidden(true)
                }
                .padding(.leading, 12).padding(.trailing, 16).padding(.vertical, 12)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel(PlanEditorValues.spoken(exercise))
            .accessibilityAddTraits(open ? .isSelected : [])
            if open { editor }
        }
        .clipShape(shape)
        .surface()
        // Abierta: el filo dorado tenue de «activo» (tokens.md).
        .overlay(shape.strokeBorder(Palette.gold.opacity(open ? 0.3 : 0), lineWidth: 1))
    }

    private var editor: some View {
        VStack(alignment: .leading, spacing: 20) {
            HStack(alignment: .top, spacing: 8) {
                PlanStepper(label: "Series", name: "Series", value: exercise.series, range: 1...10) { n in var e = exercise; e.series = n; onChange(e) }
                weightField
            }
            repsSection
            restSection
            HStack(spacing: 4) {
                moveButton("arrow.up", label: "Subir \(exercise.name)", disabled: index == 0) { onMove(-1) }
                moveButton("arrow.down", label: "Bajar \(exercise.name)", disabled: index == total - 1) { onMove(1) }
                Spacer(minLength: 8)
                Button { Haptics.tap(); onRemove() } label: {
                    Label("Quitar", systemImage: "trash").font(.apSubhead.weight(.semibold))
                        .foregroundStyle(Palette.destructive)
                        .padding(.horizontal, 16).frame(minHeight: 44)
                        .contentShape(Capsule())
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Quitar \(exercise.name)")
            }
            .padding(.top, 8)
            .overlay(alignment: .top) { Rectangle().fill(Palette.separator).frame(height: 0.5) }
        }
        .padding(.horizontal, 12).padding(.bottom, 12).padding(.top, 4)
    }

    /// Etiqueta pequeña sobre cada control (Footnote gris, nunca en mayúsculas).
    private func fieldLabel(_ text: String) -> some View {
        Text(text).font(.apFootnote).foregroundStyle(Palette.muted).padding(.leading, 4).accessibilityHidden(true)
    }

    /// Peso con coma decimal en pantalla y punto al guardarlo («62,5» ↔ «62.5»).
    private var weightField: some View {
        VStack(alignment: .leading, spacing: 6) {
            fieldLabel("Peso")
            HStack(spacing: 4) {
                TextField("—", text: Binding(
                    get: { exercise.weight.replacingOccurrences(of: ".", with: ",") },
                    set: { v in
                        // Al salir del campo el Mac puede reescribir el mismo texto: eso no es un cambio.
                        guard v != exercise.weight.replacingOccurrences(of: ".", with: ",") else { return }
                        var e = exercise
                        e.weight = PlanEditorValues.typedWeight(v)
                        onChange(e)
                    }))
                    .font(.apHeadline.monospacedDigit()).textFieldStyle(.plain)
                    #if os(iOS)
                    .keyboardType(.decimalPad)
                    #endif
                    .accessibilityLabel("Peso en kilos")
                Text("kg").font(.apSubhead).foregroundStyle(Palette.muted).accessibilityHidden(true)
            }
            .padding(.horizontal, 16).frame(height: 44)
            .background(Palette.secondary, in: Capsule())
        }
        .frame(maxWidth: .infinity)
    }

    /// Repeticiones: «Fijo» (− 10 +) o «Rango» (mínimo y máximo, «8-12»). Los isométricos, en segundos.
    private var repsSection: some View {
        let reps = PlanEditorValues.parseReps(exercise.reps)
        let unit = reps.unit
        let seconds = unit == "s"
        let limits = PlanEditorValues.repsLimits(unit)
        let noun = seconds ? "segundos" : "repeticiones"
        return VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 12) {
                fieldLabel(seconds ? "Tiempo" : "Repeticiones")
                Spacer(minLength: 8)
                SegmentedPill(options: ["Fijo", "Rango"], selection: Binding(
                    get: { reps.isRange ? 1 : 0 },
                    set: { mode in
                        if mode == 1, !reps.isRange { setReps(PlanEditorValues.toRange(reps)) }
                        if mode == 0, reps.isRange { setReps(PlanEditorValues.toFixed(reps)) }
                    }))
                    .frame(width: 160)
                    .accessibilityLabel("Tipo de \(noun)")
            }
            HStack(alignment: .top, spacing: 8) {
                if case let .range(low, high, _) = reps {
                    PlanStepper(label: "Mínimo", name: "Mínimo de \(noun)", value: low, unit: seconds ? "s" : nil,
                                range: limits.min...max(limits.min, high - limits.step), step: limits.step) { n in
                        setReps(.range(n, high, unit: unit))
                    }
                    PlanStepper(label: "Máximo", name: "Máximo de \(noun)", value: high, unit: seconds ? "s" : nil,
                                range: min(limits.max, low + limits.step)...limits.max, step: limits.step) { n in
                        setReps(.range(low, n, unit: unit))
                    }
                } else {
                    PlanStepper(name: seconds ? "Segundos" : "Repeticiones", value: reps.base, text: reps.storedText,
                                unit: seconds ? "s" : nil, range: limits.min...limits.max, step: limits.step) { n in
                        setReps(.fixed(n, unit: unit))
                    }
                    Color.clear.frame(maxWidth: .infinity, maxHeight: 1).accessibilityHidden(true)
                }
            }
        }
    }

    private func setReps(_ value: PlanEditorValues.Reps) {
        var e = exercise
        e.reps = PlanEditorValues.formatReps(value)
        onChange(e)
    }

    /// Descanso: los rápidos u «Otro» con su contador libre («75 s»). Se guarda «90s», como el generador.
    private var restSection: some View {
        let seconds = PlanEditorValues.restSeconds(exercise.rest)
        let stored = exercise.rest.trimmingCharacters(in: .whitespacesAndNewlines)
        let other = customRest || !PlanEditorValues.restIsQuick(exercise.rest, quick: Self.rests)
        let chosen = other ? nil : (seconds ?? 90)
        return VStack(alignment: .leading, spacing: 6) {
            fieldLabel("Descanso")
            HStack(spacing: 8) {
                ForEach(Self.rests, id: \.self) { s in
                    restChip(PlanEditorValues.formatRest(s), on: chosen == s, spoken: "Descanso de \(PlanEditorValues.formatRestSpoken(s))") {
                        customRest = false
                        if seconds != s { var e = exercise; e.rest = PlanEditorValues.restValue(s); onChange(e) }
                    }
                }
                restChip("Otro", on: other, spoken: "Otro descanso") { customRest = true }
            }
            if other {
                HStack(alignment: .top, spacing: 8) {
                    PlanStepper(name: "Descanso en segundos", value: PlanEditorValues.restBase(exercise.rest),
                                text: seconds == nil && !stored.isEmpty ? stored : nil,
                                unit: seconds == nil && !stored.isEmpty ? nil : "s",
                                range: PlanEditorValues.restMin...PlanEditorValues.restMax, step: PlanEditorValues.restStep) { n in
                        customRest = true
                        var e = exercise; e.rest = PlanEditorValues.restValue(n); onChange(e)
                    }
                    Color.clear.frame(maxWidth: .infinity, maxHeight: 1).accessibilityHidden(true)
                }
                .padding(.top, 4)
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Descanso")
    }

    /// Opción del descanso en píldora (44 pt): dorado tenue la elegida.
    private func restChip(_ title: String, on: Bool, spoken: String, action: @escaping () -> Void) -> some View {
        Button { Haptics.selection(); action() } label: {
            Text(title).font(.apFootnote.weight(.semibold).monospacedDigit())
                .lineLimit(1).minimumScaleFactor(0.8)
                .foregroundStyle(on ? Palette.gold : Palette.foreground)
                .padding(.horizontal, 4)
                .frame(maxWidth: .infinity, minHeight: 44)
                .background(on ? Palette.gold.opacity(0.15) : Palette.secondary, in: Capsule())
                .contentShape(Capsule())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(spoken)
        .accessibilityAddTraits(on ? .isSelected : [])
    }

    private func moveButton(_ symbol: String, label: String, disabled: Bool, action: @escaping () -> Void) -> some View {
        Button { Haptics.tap(); action() } label: {
            Image(systemName: symbol).font(.system(size: 15, weight: .semibold))
                .frame(width: 44, height: 44).contentShape(Circle())
        }
        .buttonStyle(.plain).foregroundStyle(Palette.muted).disabled(disabled).opacity(disabled ? 0.3 : 1)
        .accessibilityLabel(label)
    }
}

/// Valores del editor de rutina, como `planEditorValues.ts` en la web (mismas reglas y mismos
/// patrones). Lo guardado se respeta tal cual: unas reps «8-12», «20-60s» o un descanso «75 s» /
/// «2 min» no se convierten al abrir ni al guardar; solo cambian cuando el usuario pulsa − / +,
/// escribe en el campo, cambia entre «Fijo» y «Rango» o elige otro descanso. Al cambiar algo se
/// escribe en el formato del generador: reps «10», «8-12», «30s», «20-60s» y descansos «90s».
enum PlanEditorValues {
    // MARK: Repeticiones

    /// Reps leídas: un número, un rango o un texto que no se entiende («AMRAP»), que se enseña tal cual.
    /// La unidad es «» (repeticiones) o «s» (segundos, isométricos).
    enum Reps: Equatable {
        case fixed(Int, unit: String)
        case range(Int, Int, unit: String)
        case text(String, base: Int)

        var unit: String {
            switch self {
            case let .fixed(_, unit), let .range(_, _, unit): return unit
            case .text: return ""
            }
        }
        var isRange: Bool { if case .range = self { return true } else { return false } }
        /// Número del que parten − y + (en un rango, el mínimo).
        var base: Int {
            switch self {
            case let .fixed(n, _): return n
            case let .range(low, _, _): return low
            case let .text(_, n): return n
            }
        }
        /// Lo guardado que no es un número ni un rango («AMRAP»): se enseña tal cual.
        var storedText: String? { if case let .text(text, _) = self { return text } else { return nil } }
    }

    /// «10», «8-12», «8 – 12», «30s», «20-60 s». Mismo patrón que `REPS_PATTERN` en la web.
    static let repsPattern = #"^(\d{1,3})(?:\s*-\s*(\d{1,3}))?(\s*s)?$"#
    private static let repsRegex = try! NSRegularExpression(pattern: repsPattern, options: [.caseInsensitive])

    /// Márgenes de − / +: reps de 1 en 1 (1–100) y segundos de 5 en 5 (5–600). `spread` abre un rango desde un número.
    static func repsLimits(_ unit: String) -> (min: Int, max: Int, step: Int, spread: Int) {
        unit == "s" ? (min: 5, max: 600, step: 5, spread: 10) : (min: 1, max: 100, step: 1, spread: 2)
    }

    private static func clamp(_ n: Int, _ low: Int, _ high: Int) -> Int { max(low, min(high, n)) }

    private static func firstNumber(_ text: String) -> Int? {
        text.split(whereSeparator: { !($0.isASCII && $0.isNumber) }).compactMap { Int($0) }.first
    }

    /// Grupos de la primera coincidencia (nil si no casa; cada grupo vacío, nil).
    private static func groups(_ regex: NSRegularExpression, _ text: String) -> [String?]? {
        let ns = text as NSString
        guard let m = regex.firstMatch(in: text, range: NSRange(location: 0, length: ns.length)) else { return nil }
        return (0..<m.numberOfRanges).map { i in
            let r = m.range(at: i)
            return r.location == NSNotFound ? nil : ns.substring(with: r)
        }
    }

    private static func trimmed(_ text: String) -> String { text.trimmingCharacters(in: .whitespacesAndNewlines) }

    /// Reps tal como están guardadas («10», «8-12», «30 s»); sin dato, «10».
    static func repsText(_ reps: String) -> String {
        let text = trimmed(reps)
        return text.isEmpty ? "10" : text
    }

    static func parseReps(_ reps: String) -> Reps {
        let text = repsText(reps)
        let clean = text.replacingOccurrences(of: "–", with: "-").replacingOccurrences(of: "—", with: "-")
        guard let g = groups(repsRegex, clean), let first = g[1], let a = Int(first) else {
            return .text(text, base: firstNumber(text) ?? 10)
        }
        let unit = g[3] != nil ? "s" : ""
        guard let second = g[2] else { return .fixed(a, unit: unit) }
        guard let b = Int(second) else { return .text(text, base: a) }
        if b == a { return .fixed(a, unit: unit) }
        return .range(min(a, b), max(a, b), unit: unit)
    }

    /// Lo que se guarda: «10», «8-12», «30s», «20-60s» (un texto sin tocar, tal cual).
    static func formatReps(_ value: Reps) -> String {
        switch value {
        case let .fixed(n, unit): return "\(n)\(unit)"
        case let .range(low, high, unit): return "\(low)-\(high)\(unit)"
        case let .text(text, _): return text
        }
    }

    /// «Rango» desde un número: se abre a su alrededor («10» → «8-12», «30s» → «20-40s»).
    static func toRange(_ value: Reps) -> Reps {
        if value.isRange { return value }
        let unit = value.unit
        let l = repsLimits(unit)
        let low = clamp(value.base - l.spread, l.min, l.max - l.step)
        let high = clamp(value.base + l.spread, low + l.step, l.max)
        return .range(low, high, unit: unit)
    }

    /// «Fijo» desde un rango: su número central («8-12» → «10», «20-60s» → «40s»).
    static func toFixed(_ value: Reps) -> Reps {
        switch value {
        case .fixed: return value
        case let .text(_, n): return .fixed(clamp(n, 1, 100), unit: "")
        case let .range(low, high, unit): return .fixed((low + high + 1) / 2, unit: unit)
        }
    }

    /// Reps en el resumen de la fila: «10 reps», «1 rep», «8-12 reps», «30 s», «20-60 s» o el texto guardado.
    static func repsLabel(_ reps: String) -> String {
        let value = parseReps(reps)
        switch value {
        case let .text(text, _): return text.contains(where: \.isLetter) ? text : "\(text) reps"
        case let .fixed(n, unit): return unit == "s" ? "\(n) s" : "\(n) \(n == 1 ? "rep" : "reps")"
        case let .range(low, high, unit): return unit == "s" ? "\(low)-\(high) s" : "\(low)-\(high) reps"
        }
    }

    /// Lo mismo para VoiceOver: «de 8 a 12 repeticiones», «30 segundos».
    static func repsSpoken(_ reps: String) -> String {
        let value = parseReps(reps)
        let noun = value.unit == "s" ? ("segundo", "segundos") : ("repetición", "repeticiones")
        switch value {
        case let .text(text, _): return text
        case let .range(low, high, _): return "de \(low) a \(high) \(noun.1)"
        case let .fixed(n, _): return "\(n) \(n == 1 ? noun.0 : noun.1)"
        }
    }

    // MARK: Descanso

    /// «Otro» descanso: de 10 s a 10 min, de 15 en 15 con − / + (`REST_LIMITS` en la web).
    static let restMin = 10
    static let restMax = 600
    static let restStep = 15

    /// «1:30». Mismo patrón que `REST_CLOCK` en la web.
    static let restClock = #"^(\d{1,2}):([0-5]\d)$"#
    /// «2 min», «2,5 min», «1 min 30 s». Mismo patrón que `REST_MINUTES` en la web.
    static let restMinutes = #"^(\d{1,2}(?:[.,]\d)?)\s*min(?:utos?|s)?\.?(?:\s*(\d{1,2})\s*s)?$"#
    /// «90», «90s», «90 s», «90 seg». Mismo patrón que `REST_PLAIN` en la web.
    static let restPlain = #"^(\d{1,3})\s*(?:s|seg|segundos?)?\.?$"#
    private static let clockRegex = try! NSRegularExpression(pattern: restClock)
    private static let minutesRegex = try! NSRegularExpression(pattern: restMinutes, options: [.caseInsensitive])
    private static let plainRegex = try! NSRegularExpression(pattern: restPlain, options: [.caseInsensitive])

    /// Segundos de un descanso escrito de cualquier forma («90s», «75 s», «2 min», «1:30»); nil si no se entiende.
    static func restSeconds(_ rest: String) -> Int? {
        let text = trimmed(rest)
        if let g = groups(clockRegex, text), let m = Int(g[1] ?? ""), let s = Int(g[2] ?? "") { return m * 60 + s }
        if let g = groups(minutesRegex, text), let minutes = Double((g[1] ?? "").replacingOccurrences(of: ",", with: ".")) {
            return Int((minutes * 60).rounded()) + (Int(g[2] ?? "") ?? 0)
        }
        if let g = groups(plainRegex, text), let s = Int(g[1] ?? "") { return s }
        return nil
    }

    /// Lo que se guarda al elegir un descanso: el formato del generador («90s», «180s»).
    static func restValue(_ seconds: Int) -> String { "\(seconds)s" }

    /// Descanso en pantalla: «45 s», «90 s», «2 min», «2,5 min», «3 min».
    static func formatRest(_ seconds: Int) -> String {
        seconds < 120 || seconds % 30 != 0 ? "\(seconds) s" : "\(seconds / 60)\(seconds % 60 != 0 ? ",5" : "") min"
    }

    /// Lo mismo para VoiceOver: «90 segundos», «2 minutos», «2,5 minutos».
    static func formatRestSpoken(_ seconds: Int) -> String {
        seconds < 120 || seconds % 30 != 0
            ? "\(seconds) \(seconds == 1 ? "segundo" : "segundos")"
            : "\(seconds / 60)\(seconds % 60 != 0 ? ",5" : "") minutos"
    }

    /// Segundos que se enseñan: los guardados, o 90 si no hay descanso (lo mismo que dice el resumen).
    private static func shownRest(_ rest: String) -> Int? { trimmed(rest).isEmpty ? 90 : restSeconds(rest) }

    /// Descanso en el resumen de la fila («180s» → «3 min»); lo que no se entiende, tal cual.
    static func restLabel(_ rest: String) -> String { shownRest(rest).map(formatRest) ?? trimmed(rest) }

    static func restSpoken(_ rest: String) -> String { shownRest(rest).map(formatRestSpoken) ?? trimmed(rest) }

    /// ¿El descanso es uno de los rápidos? Si no («75 s», «45s»), se ve elegido «Otro», sin cambiarlo.
    static func restIsQuick(_ rest: String, quick: [Int]) -> Bool {
        guard let s = shownRest(rest) else { return false }
        return quick.contains(s)
    }

    /// Número del que parte el contador de «Otro»: los segundos guardados, su primera cifra o 90.
    static func restBase(_ rest: String) -> Int { shownRest(rest) ?? firstNumber(rest) ?? 90 }

    // MARK: Peso

    /// Peso escrito («62,5»): solo cifras y una coma decimal, guardado con punto («62.5»). Una segunda
    /// coma no cuenta («62,5,» sigue siendo «62.5»). Es `typedWeight` en la web.
    static func typedWeight(_ text: String) -> String {
        let clean = text.filter { ($0.isASCII && $0.isNumber) || $0 == "," || $0 == "." }
            .replacingOccurrences(of: ",", with: ".")
        let parts = clean.split(separator: ".", omittingEmptySubsequences: false)
        guard let whole = parts.first else { return "" }
        return parts.count > 1 ? "\(whole).\(parts.dropFirst().joined())" : String(whole)
    }

    // MARK: Fila

    static func seriesLabel(_ n: Int) -> String { "\(n) \(n == 1 ? "serie" : "series")" }

    /// «3 series · 8-12 reps · 90 s» (y «1 serie», «20-60 s», «3 min»). Igual que `exerciseSummary` en la web.
    static func summary(_ e: GymExercise) -> String {
        [seriesLabel(e.series), repsLabel(e.reps), restLabel(e.rest)].joined(separator: " · ")
    }

    /// «Remo con barra: 4 series, de 8 a 12 repeticiones, descanso de 75 segundos» (`exerciseSpoken`).
    static func spoken(_ e: GymExercise) -> String {
        "\(e.name): \(seriesLabel(e.series)), \(repsSpoken(e.reps)), descanso de \(restSpoken(e.rest))"
    }

    /// Fila con su clave estable (no su posición): al subirla o bajarla sigue abierta (`rowKeys` en la web).
    struct KeyedExercise: Identifiable {
        let id: String
        let index: Int
        let exercise: GymExercise
    }

    static func keyed(_ list: [GymExercise]) -> [KeyedExercise] {
        var seen: [String: Int] = [:]
        return list.enumerated().map { index, ex in
            let base = "\(ex.exercise_id)|\(ex.name)"
            let n = seen[base, default: 0]
            seen[base] = n + 1
            return KeyedExercise(id: "\(base)#\(n)", index: index, exercise: ex)
        }
    }
}

/// Contador en píldora: − cifra + con zona táctil de 44 (`Stepper` en `ExerciseRowEditor.tsx`).
/// `text` es lo guardado tal cual (unas reps «AMRAP»); `value` es el número del que parten − y +.
/// Al tocar la cifra se escribe una nueva (la actual queda como pista gris); lo escrito cuenta en
/// cuanto cabe en `range` y al salir del campo se ajusta a ese margen. Salir sin escribir deja la
/// cifra como estaba. Abrir y guardar nunca cambian nada.
struct PlanStepper: View {
    var label: String? = nil
    /// Nombre para VoiceOver («Series», «Mínimo de repeticiones»); − / + dicen «Reducir …» y «Aumentar …».
    let name: String
    let value: Int
    var text: String? = nil
    /// Unidad pegada a la cifra («s»).
    var unit: String? = nil
    let range: ClosedRange<Int>
    var step = 1
    var onChange: (Int) -> Void

    /// Lo que se está escribiendo (nil si no se escribe).
    @State private var draft: String?
    @FocusState private var focused: Bool

    private var current: String { text ?? "\(value)" }
    private var display: String { draft ?? current }

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            if let label {
                Text(label).font(.apFootnote).foregroundStyle(Palette.muted).padding(.leading, 4)
                    .accessibilityHidden(true)
            }
            HStack(spacing: 0) {
                stepButton("minus", "Reducir \(name.lowercased())", disabled: value <= range.lowerBound) { commit(value - step) }
                HStack(spacing: 4) {
                    field
                    if let unit { Text(unit).font(.apSubhead).foregroundStyle(Palette.muted).accessibilityHidden(true) }
                }
                .frame(maxWidth: .infinity, minHeight: 44)
                .contentShape(Rectangle())
                // Toda la zona central abre el campo (también la «s»), sin quitarle el toque al propio campo.
                .simultaneousGesture(TapGesture().onEnded { focused = true })
                stepButton("plus", "Aumentar \(name.lowercased())", disabled: value >= range.upperBound) { commit(value + step) }
            }
            .frame(height: 44)
            .background(Palette.secondary, in: Capsule())
        }
        .frame(maxWidth: .infinity)
        .onChange(of: focused) { _, isFocused in
            // Al tocar la cifra se escribe una nueva directamente: la actual queda como pista gris.
            if isFocused { draft = ""; return }
            // Al salir, lo escrito se ajusta al margen; sin cifra, se queda como estaba.
            if let draft, let n = Int(draft) { commit(n) }
            draft = nil
        }
    }

    @ViewBuilder private var field: some View {
        let input = TextField(current, text: Binding(
            get: { display },
            set: { v in
                // Al salir del campo el Mac puede reescribir el mismo texto: eso no es un cambio.
                guard v != display else { return }
                let digits = String(v.filter { $0.isASCII && $0.isNumber }.prefix(3))
                draft = digits
                if let n = Int(digits), range.contains(n) { commit(n) }
            }))
            .font(.apHeadline.monospacedDigit()).multilineTextAlignment(.center).textFieldStyle(.plain)
            #if os(iOS)
            .keyboardType(.numberPad)
            #endif
            .focused($focused)
            .onSubmit { focused = false }
            .accessibilityLabel(name)
        // Con unidad («20 s»), el campo mide lo que su cifra para que «s» quede pegada y el conjunto centrado.
        if unit != nil { input.fixedSize() } else { input.frame(maxWidth: .infinity) }
    }

    private func commit(_ n: Int) {
        let next = min(range.upperBound, max(range.lowerBound, n))
        // Con un texto guardado («AMRAP», «60-90 s»), escribir su número de partida también lo cambia.
        if next != value || text != nil { onChange(next) }
    }

    private func stepButton(_ symbol: String, _ label: String, disabled: Bool, action: @escaping () -> Void) -> some View {
        Button { Haptics.selection(); draft = nil; action() } label: {
            Image(systemName: symbol).font(.system(size: 14, weight: .semibold))
                .frame(width: 44, height: 44).contentShape(Circle())
        }
        .buttonStyle(.plain).foregroundStyle(Palette.muted).disabled(disabled).opacity(disabled ? 0.3 : 1)
        .accessibilityLabel(label)
    }
}

/// Fila del buscador de ejercicios (misma forma en disco y en memoria). La modalidad y los datos de
/// la huella son opcionales: las copias guardadas antes no los traen y se siguen leyendo.
struct ExercisePickerRow: Codable, Identifiable, Hashable {
    let id: String
    let name: String
    let muscle_group: String?
    let image_url: String?
    var exercise_type: String? = nil
    var movement_pattern: String? = nil
    var stimulus_type: String? = nil
    var load_level: String? = nil

    /// Columnas que pide el buscador (como `ExercisePicker.tsx`).
    static let columns = "id,name,muscle_group,image_url,exercise_type,movement_pattern,stimulus_type,load_level"
}

/// Catálogo del buscador: memoria → disco → red, compartido por toda la app. Se calienta al
/// abrir la app para que «Añadir ejercicio» aparezca lleno al instante, sin rueda.
enum ExerciseCatalogStore {
    private static let key = "exercise-picker-catalog"
    private static let lock = NSLock()
    private static var memory: [ExercisePickerRow]?
    private static var warmed = false
    private static var warming = false

    static var cached: [ExercisePickerRow] {
        lock.lock(); defer { lock.unlock() }
        if let memory { return memory }
        let rows = Snapshots.load([ExercisePickerRow].self, key) ?? []
        memory = rows
        return rows
    }

    static func store(_ rows: [ExercisePickerRow]) {
        lock.lock(); memory = rows; lock.unlock()
        Snapshots.save(rows, key)
    }

    /// Descarga el catálogo una vez por arranque. Sin red se queda la copia del disco.
    static func warm() async {
        lock.lock()
        let skip = warmed || warming
        if !skip { warming = true }
        lock.unlock()
        guard !skip else { return }
        defer { lock.lock(); warming = false; lock.unlock() }
        if let rows: [ExercisePickerRow] = try? await Backend.client.from("exercises")
            .select(ExercisePickerRow.columns).order("name").limit(200).execute().value,
           !rows.isEmpty {
            store(rows)
            lock.lock(); warmed = true; lock.unlock()
        }
    }
}

/// Buscador de la biblioteca de ejercicios (`ExercisePicker.tsx`): mismos textos, filtros y filas
/// que la web. Se tocan todos los que se quieran (su orden va en el círculo dorado) y se añaden de
/// una vez con el botón de abajo. Los que ya están en la sesión se ven, atenuados, sin repetirse.
struct ExercisePickerView: View {
    @Environment(\.dismiss) private var dismiss
    let existing: Set<String>
    var onPick: ([GymExercise]) -> Void

    /// Modalidad y grupo, en el mismo orden que `TYPES` y `GROUPS` en la web.
    static let types = ["Todo", "Gimnasio", "Calistenia"]
    static let groups = ["Todos", "Pecho", "Espalda", "Hombros", "Piernas", "Glúteos", "Isquiotibiales", "Bíceps", "Tríceps", "Core", "Gemelos"]

    private typealias Row = ExercisePickerRow
    /// Arranca ya con la copia del teléfono: la lista aparece al instante y la red solo la afina.
    @State private var rows: [Row] = ExerciseCatalogStore.cached
    @State private var query = ""
    /// Ids elegidos, en el orden en que se tocaron, y sus filas (siguen aunque un filtro las oculte).
    @State private var selected: [String] = []
    @State private var picked: [String: Row] = [:]
    @State private var group = "Todos"
    @State private var type = "Todo"
    @State private var loading = true
    @State private var failed = false
    /// Última lista completa descargada. Vive en el teléfono para que el buscador siga
    /// funcionando en el gimnasio sin cobertura (y al abrir en frío sin red).
    @State private var catalog: [Row] = ExerciseCatalogStore.cached
    @State private var offline = false

    /// Se busca en el servidor (no en memoria): la biblioteca es grande y traerla entera dejaba
    /// la pantalla en blanco. Los resultados llegan por nombre y músculo, con un límite sano.
    private var searchKey: String { "\(query)|#\(group)|\(type)" }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 12) {
                    Text("Toca todos los que quieras y añádelos de una vez.")
                        .font(.apSubhead).foregroundStyle(Palette.muted)
                        .fixedSize(horizontal: false, vertical: true)
                    SearchPill(prompt: "Buscar por nombre o músculo", text: $query)
                    chips
                    if offline {
                        Label("Sin conexión: mostrando la última lista descargada.", systemImage: "wifi.slash")
                            .font(.apFootnote).foregroundStyle(Palette.muted)
                    }
                    content.padding(.top, 4)
                }
                .padding(.horizontal, 16).padding(.top, 4).padding(.bottom, 24)
                .frame(maxWidth: 680)
                .frame(maxWidth: .infinity)
            }
            .scrollDismissesKeyboard(.interactively)
            .screenBackground()
            .safeAreaInset(edge: .bottom) { footer }
            .navigationTitle("Añadir ejercicios")
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancelar") { dismiss() } }
            }
        }
        #if os(macOS)
        .frame(minWidth: 520, minHeight: 640)
        #endif
        // Se pinta al momento con la copia del teléfono (sin rueda al abrir ni al escribir) y,
        // en paralelo, se pide al servidor: su respuesta solo afina la lista cuando llega.
        .task(id: searchKey) {
            let text = query.trimmingCharacters(in: .whitespaces)
            if !catalog.isEmpty {
                let local = localMatches(text)
                if local != rows { rows = local }
            } else {
                await ExerciseCatalogStore.warm()
                if catalog.isEmpty { catalog = ExerciseCatalogStore.cached }
                if !catalog.isEmpty {
                    let local = localMatches(text)
                    if local != rows { rows = local }
                }
            }
            // Espera corta al escribir (y cancela la búsqueda anterior): una sola petición por pausa.
            if !text.isEmpty || group != "Todos" || type != "Todo" { try? await Task.sleep(for: .milliseconds(300)) }
            guard !Task.isCancelled else { return }
            await load()
        }
    }

    /// Modalidad | grupo, en una fila que se desliza (como la web).
    private var chips: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(Self.types, id: \.self) { t in chip(t, active: type == t) { type = t } }
                Rectangle().fill(Palette.separator).frame(width: 1, height: 24).padding(.horizontal, 2)
                    .accessibilityHidden(true)
                ForEach(Self.groups, id: \.self) { g in chip(g, active: group == g) { group = g } }
            }
        }
    }

    @ViewBuilder private var content: some View {
        if failed {
            VStack(spacing: 0) {
                EmptyStateView(symbol: "wifi.exclamationmark", title: "No hemos podido cargar los ejercicios",
                               message: "Revisa tu conexión y vuelve a intentarlo.")
                Button("Reintentar") { Task { await load() } }.buttonStyle(.pillSecondary).fixedSize()
            }
            .frame(maxWidth: .infinity)
        } else if loading && rows.isEmpty {
            // La firma de marca (el AP latiendo), nunca la rueda del sistema.
            VStack(spacing: 12) {
                BrandLoader(size: 28)
                Text("Cargando ejercicios…").font(.apFootnote).foregroundStyle(Palette.muted)
            }
            .frame(maxWidth: .infinity).padding(.vertical, 48)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("Cargando ejercicios")
        } else if rows.isEmpty {
            EmptyStateView(symbol: "magnifyingglass", title: "Prueba con otro nombre",
                           message: "Busca por ejercicio o músculo, o quita algún filtro.")
        } else {
            // Filas en un grupo sin borde, como la biblioteca.
            LazyVStack(spacing: 0) {
                ForEach(Array(rows.enumerated()), id: \.element.id) { index, row in
                    pickerRow(row, separator: index < rows.count - 1)
                }
            }
            .clipShape(RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
            .surface()
        }
    }

    /// Miniatura, nombre, «grupo · modalidad» (y «Ya en la sesión») y el círculo con su orden.
    private func pickerRow(_ row: Row, separator: Bool) -> some View {
        let order = selected.firstIndex(of: row.id)
        let inSession = existing.contains(row.name)
        let info = [row.muscle_group, row.exercise_type, inSession ? "Ya en la sesión" : nil]
            .compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: " · ")
        return Button { toggle(row) } label: {
            HStack(spacing: 12) {
                ExerciseThumb(url: row.image_url, size: 48, name: row.name, muscleGroup: row.muscle_group,
                              pattern: row.movement_pattern, stimulus: row.stimulus_type, load: row.load_level)
                VStack(alignment: .leading, spacing: 2) {
                    Text(row.name).font(.apHeadline).lineLimit(1)
                    if !info.isEmpty { Text(info).font(.apFootnote).foregroundStyle(Palette.muted).lineLimit(1) }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                selectionMark(order)
            }
            .padding(.horizontal, 12).padding(.vertical, 10)
            .background(order != nil ? Palette.gold.opacity(0.10) : Color.clear)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(inSession)
        .opacity(inSession ? 0.5 : 1)
        .overlay(alignment: .bottom) {
            // El separador nace donde empieza el texto (12 + 48 + 12).
            if separator { Rectangle().fill(Palette.separator).frame(height: 0.5).padding(.leading, 72) }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(info.isEmpty ? row.name : "\(row.name), \(info)")
        .accessibilityValue(order.map { "Elegido, \($0 + 1)º" } ?? "")
        .accessibilityAddTraits(order != nil ? [.isButton, .isSelected] : .isButton)
    }

    /// Círculo de selección: dorado con el orden en que se tocó, o un aro gris.
    private func selectionMark(_ order: Int?) -> some View {
        ZStack {
            if let order {
                Circle().fill(Palette.gold)
                Text("\(order + 1)").font(.apFootnote.weight(.bold).monospacedDigit()).foregroundStyle(Palette.background)
            } else {
                Circle().strokeBorder(Palette.muted.opacity(0.4), lineWidth: 1.5)
            }
        }
        .frame(width: 28, height: 28)
        .accessibilityHidden(true)
    }

    /// La única acción dorada: «Añadir 3 ejercicios» (o «Elige ejercicios» mientras no hay ninguno).
    private var footer: some View {
        Button(selected.isEmpty ? "Elige ejercicios" : "Añadir \(ExerciseLibraryCatalog.count(selected.count))") { add() }
            .buttonStyle(.pill)
            .disabled(selected.isEmpty)
            .padding(.horizontal, 16).padding(.top, 12).padding(.bottom, 8)
            .frame(maxWidth: 680)
            .frame(maxWidth: .infinity)
            .background(alignment: .top) {
                Palette.background.opacity(0.92).ignoresSafeArea(edges: .bottom)
                    .overlay(alignment: .top) { Rectangle().fill(Palette.separator).frame(height: 0.5) }
            }
    }

    /// Petición al servidor con los filtros actuales (nombre/músculo, grupo y modalidad).
    private func fetch(text: String) async throws -> [Row] {
        var request = Backend.client.from("exercises").select(Row.columns)
        if !text.isEmpty {
            // Búsqueda sin acentos ni mayúsculas: «biceps» encuentra «Bíceps».
            let clean = text.replacingOccurrences(of: "%", with: "").replacingOccurrences(of: ",", with: " ")
            request = request.or("name.ilike.%\(clean)%,muscle_group.ilike.%\(clean)%")
        }
        if group != "Todos" { request = request.eq("muscle_group", value: group) }
        // «Calistenia» incluye lo mixto, como en la web.
        if type == "Calistenia" { request = request.in("exercise_type", values: ["Calistenia", "Mixto"]) }
        else if type != "Todo" { request = request.eq("exercise_type", value: type) }
        return try await request.order("name").limit(200).execute().value
    }

    private func load() async {
        loading = true
        failed = false
        defer { loading = false }
        let text = query.trimmingCharacters(in: .whitespaces)
        do {
            var result: [Row]
            do {
                result = try await fetch(text: text)
            } catch {
                guard !Task.isCancelled else { return }
                // Un reintento corto: al abrir en frío el primer intento puede adelantarse al
                // refresco de la sesión o a que el móvil recupere cobertura.
                try? await Task.sleep(for: .milliseconds(700))
                guard !Task.isCancelled else { return }
                result = try await fetch(text: text)
            }
            guard !Task.isCancelled else { return }
            rows = result
            offline = false
            if text.isEmpty, group == "Todos", type == "Todo" {
                // El catálogo completo queda en el teléfono: sin red se busca en esta copia.
                catalog = result
                ExerciseCatalogStore.store(result)
            }
        } catch {
            guard !Task.isCancelled else { return }
            if !catalog.isEmpty {
                // Sin conexión: se filtra la copia local por nombre, músculo, grupo y modalidad.
                rows = localMatches(text)
                offline = true
            } else if rows.isEmpty {
                failed = true
            }
        }
    }

    /// Búsqueda en la copia del teléfono, sin acentos ni mayúsculas (igual que `ilike`).
    private func localMatches(_ text: String) -> [Row] {
        func key(_ value: String) -> String {
            value.folding(options: [.caseInsensitive, .diacriticInsensitive], locale: .current)
        }
        let needle = key(text)
        return catalog.filter { row in
            if group != "Todos", row.muscle_group != group { return false }
            if type != "Todo", !(row.exercise_type == type || (type == "Calistenia" && row.exercise_type == "Mixto")) { return false }
            guard !needle.isEmpty else { return true }
            return key(row.name).contains(needle) || key(row.muscle_group ?? "").contains(needle)
        }
    }

    private func chip(_ label: String, active: Bool, action: @escaping () -> Void) -> some View {
        Button { Haptics.selection(); action() } label: {
            Text(label).font(.apFootnote.weight(.semibold))
                .padding(.horizontal, 16).frame(height: 40)
                .foregroundStyle(active ? Palette.gold : Palette.foreground)
                .background(active ? Palette.gold.opacity(0.15) : Palette.secondary, in: Capsule())
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(active ? .isSelected : [])
    }

    private func toggle(_ row: Row) {
        Haptics.selection()
        if let i = selected.firstIndex(of: row.id) {
            selected.remove(at: i)
            picked[row.id] = nil
        } else {
            selected.append(row.id)
            picked[row.id] = row
        }
    }

    /// Nuevos ejercicios con los valores por defecto de la web: 3 × 10, 90 s de descanso.
    private func add() {
        let list = selected.compactMap { picked[$0] }.map { r in
            GymExercise(exercise_id: r.id, name: r.name, series: 3, reps: "10", weight: "", rest: "90 s",
                        image_url: r.image_url, muscle_group: r.muscle_group)
        }
        guard !list.isEmpty else { return }
        Haptics.tap()
        onPick(list)
        dismiss()
    }
}
