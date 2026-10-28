import SwiftUI

/// «Editar mi rutina» de la web (`PlanEditor.tsx`): días de la semana, nombre de la sesión,
/// ejercicios con series/reps/peso/descanso y «Añadir ejercicios». Al guardar, cada día queda
/// marcado `custom: true`, así el piloto automático nunca pisa la rutina del usuario.
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
                            Text("\(day): \(plan?.sport ?? "Actividad")").font(.apSubhead).foregroundStyle(Palette.muted)
                            Button("Convertir en día de fuerza") { setDay { _ in DayPlan(day: day, type: "gimnasio", routine_name: "", exercises: []) } }
                                .buttonStyle(.pillSecondary)
                        }
                        .padding(18).frame(maxWidth: .infinity, alignment: .leading)
                        .background(Palette.card, in: RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
                    } else {
                        TextField("Nombre del \(day.lowercased()) (p. ej. Torso A)", text: Binding(
                            get: { plan?.routine_name ?? "" },
                            set: { name in setDay { var p = $0; p.routine_name = name; return p } }))
                            .font(.apBody).padding(.horizontal, 18).frame(height: 50)
                            .background(Palette.card, in: Capsule())
                        if exercises.isEmpty {
                            Button { picking = true } label: {
                                VStack(spacing: 6) {
                                    Image("lu-plus").renderingMode(.template).resizable().frame(width: 24, height: 24).foregroundStyle(Palette.gold)
                                    Text("Día de descanso").font(.apSubhead.weight(.medium))
                                    Text("Añade ejercicios para entrenar el \(day.lowercased())").font(.apFootnote).foregroundStyle(Palette.muted)
                                }
                                .frame(maxWidth: .infinity, minHeight: 200)
                                .background(Palette.card, in: RoundedRectangle(cornerRadius: Radius.hero, style: .continuous))
                            }
                            .buttonStyle(.pressableCard)
                        } else {
                            ForEach(Array(exercises.enumerated()), id: \.offset) { index, ex in
                                ExerciseEditRow(exercise: ex, index: index, total: exercises.count,
                                                onChange: { new in editExercises { $0[index] = new } },
                                                onMove: { dir in editExercises { list in
                                                    let j = index + dir
                                                    if list.indices.contains(j) { list.swapAt(index, j) }
                                                } },
                                                onRemove: { editExercises { $0.remove(at: index) } })
                            }
                            Button("Añadir ejercicios") { picking = true }.buttonStyle(.pillSecondary)
                        }
                    }
                    if let error { Text(error).font(.apFootnote).foregroundStyle(Palette.destructive) }
                }
                .padding(16)
            }
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
                    .frame(maxWidth: .infinity).padding(.vertical, 8)
                    .foregroundStyle(day == d ? Palette.foreground : Palette.muted)
                    .background(day == d ? Palette.gold.opacity(0.15) : Palette.secondary, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                }
                .buttonStyle(.plain)
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

    /// Igual que `normalizePlan` + `markManual` de la web.
    static func normalized(_ plans: [DayPlan]) -> [DayPlan] {
        plans.filter { $0.type == "actividad" || !($0.exercises ?? []).isEmpty }
            .sorted { (DayNames.all.firstIndex(of: $0.day) ?? 0) < (DayNames.all.firstIndex(of: $1.day) ?? 0) }
    }

    private func save() async {
        guard let userId = session.userId else { return }
        saving = true; defer { saving = false }
        let clean = Self.normalized(draft).map { p -> DayPlan in var p = p; p.custom = true; return p }
        struct Row: Encodable { let user_id: UUID; let workouts_json: [DayPlan]; let updated_at: String }
        do {
            try await Backend.client.from("training_plan")
                .upsert(Row(user_id: userId, workouts_json: clean, updated_at: ISO8601DateFormatter().string(from: Date())), onConflict: "user_id")
                .execute()
            Haptics.success()
            onSaved(clean)
            dismiss()
        } catch {
            Haptics.error()
            self.error = "No se pudo guardar tu rutina. Inténtalo de nuevo."
        }
    }
}

/// Fila editable de un ejercicio (`ExerciseRowEditor.tsx`).
private struct ExerciseEditRow: View {
    let exercise: GymExercise
    let index: Int
    let total: Int
    var onChange: (GymExercise) -> Void
    var onMove: (Int) -> Void
    var onRemove: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 8) {
                Text(exercise.name).font(.apHeadline).lineLimit(2).frame(maxWidth: .infinity, alignment: .leading)
                iconButton("lu-chevron-left", rotation: 90, label: "Subir", disabled: index == 0) { onMove(-1) }
                iconButton("lu-chevron-left", rotation: -90, label: "Bajar", disabled: index == total - 1) { onMove(1) }
                iconButton("lu-x", rotation: 0, label: "Quitar", disabled: false, action: onRemove)
            }
            HStack(spacing: 8) {
                field("Series", Binding(get: { String(exercise.series) }, set: { var e = exercise; e.series = Int($0) ?? e.series; onChange(e) }), numeric: true)
                field("Reps", Binding(get: { exercise.reps }, set: { var e = exercise; e.reps = $0; onChange(e) }))
                field("Kg", Binding(get: { exercise.weight }, set: { var e = exercise; e.weight = $0; onChange(e) }))
                field("Descanso", Binding(get: { exercise.rest }, set: { var e = exercise; e.rest = $0; onChange(e) }))
            }
        }
        .padding(16)
        .background(Palette.card, in: RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
    }

    private func field(_ label: String, _ text: Binding<String>, numeric: Bool = false) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label).font(.apCaption).foregroundStyle(Palette.muted)
            TextField(label, text: text)
                .font(.apSubhead.monospacedDigit())
                #if os(iOS)
                .keyboardType(numeric ? .numberPad : .default)
                #endif
                .padding(.horizontal, 12).frame(height: 40)
                .background(Palette.secondary, in: Capsule())
        }
    }

    private func iconButton(_ icon: String, rotation: Double, label: String, disabled: Bool, action: @escaping () -> Void) -> some View {
        Button { Haptics.tap(); action() } label: {
            Image(icon).renderingMode(.template).resizable().frame(width: 14, height: 14)
                .rotationEffect(.degrees(rotation))
                .frame(width: 32, height: 32).background(Palette.secondary, in: Circle())
        }
        .buttonStyle(.plain).foregroundStyle(Palette.muted).disabled(disabled).opacity(disabled ? 0.4 : 1)
        .accessibilityLabel(label)
    }
}

/// Buscador de la biblioteca de ejercicios (`ExercisePicker.tsx`): selección múltiple y «Añadir».
struct ExercisePickerView: View {
    @Environment(\.dismiss) private var dismiss
    let existing: Set<String>
    var onPick: ([GymExercise]) -> Void

    private struct Row: Decodable, Identifiable { let id: String; let name: String; let muscle_group: String?; let image_url: String? }
    @State private var rows: [Row] = []
    @State private var query = ""
    @State private var selected: [String] = []

    private var filtered: [Row] {
        let fold: (String) -> String = { $0.folding(options: [.diacriticInsensitive, .caseInsensitive], locale: .current) }
        let q = fold(query.trimmingCharacters(in: .whitespaces))
        return rows.filter { row in
            guard !existing.contains(row.name) else { return false }
            if q.isEmpty { return true }
            let name: String = fold(row.name)
            let group: String = fold(row.muscle_group ?? "")
            return name.contains(q) || group.contains(q)
        }
    }

    var body: some View {
        NavigationStack {
            List(filtered) { row in
                Button {
                    Haptics.selection()
                    if let i = selected.firstIndex(of: row.id) { selected.remove(at: i) } else { selected.append(row.id) }
                } label: {
                    HStack(spacing: 12) {
                        CachedAsyncImage(url: row.image_url.flatMap(URL.init(string:))) { $0.resizable().scaledToFill() } placeholder: { Palette.secondary }
                            .frame(width: 44, height: 44).clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                        VStack(alignment: .leading, spacing: 2) {
                            Text(row.name).font(.apBody)
                            if let g = row.muscle_group { Text(g).font(.apFootnote).foregroundStyle(Palette.muted) }
                        }
                        Spacer()
                        if selected.contains(row.id) {
                            Image("lu-check").renderingMode(.template).resizable().frame(width: 18, height: 18).foregroundStyle(Palette.gold)
                        }
                    }
                }
                .buttonStyle(.plain)
                .listRowBackground(Palette.card)
            }
            .scrollContentBackground(.hidden)
            .screenBackground()
            .searchable(text: $query, prompt: "Buscar ejercicio o músculo")
            .overlay { if rows.isEmpty { BrandLoader() } }
            .navigationTitle("Añadir ejercicios")
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancelar") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button(selected.isEmpty ? "Añadir" : "Añadir (\(selected.count))") { add() }
                    .disabled(selected.isEmpty).fontWeight(.semibold)
                }
            }
        }
        .task {
            rows = (try? await Backend.client.from("exercises").select("id,name,muscle_group,image_url").order("name").execute().value) ?? []
        }
    }

    /// Nuevos ejercicios con los valores por defecto de la web: 3 × 10, 90 s de descanso.
    private func add() {
        var byId: [String: Row] = [:]
        for row in rows { byId[row.id] = row }
        var picked: [GymExercise] = []
        for id in selected {
            guard let r = byId[id] else { continue }
            picked.append(GymExercise(exercise_id: r.id, name: r.name, series: 3, reps: "10", weight: "", rest: "90 s",
                                      image_url: r.image_url, muscle_group: r.muscle_group))
        }
        onPick(picked)
        dismiss()
    }
}
