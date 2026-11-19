import SwiftUI

/// «Nueva rutina» y «Editar rutina» (`RoutineEditor.tsx` en la web): nombre, ejercicios con el
/// selector compartido y cada fila con el mismo editor que «Editar mi rutina» (series, reps
/// «Fijo | Rango», descanso rápido u «Otro»). Una sola acción dorada: «Guardar rutina».
struct RoutineEditorView: View {
    @Environment(\.dismiss) private var dismiss
    let routine: DayPlan?
    var limitReached = false
    var onSave: (String, [GymExercise]) async -> Bool

    @State private var name: String
    @State private var list: [GymExercise]
    @State private var picking = false
    @State private var saving = false
    @State private var failed = false
    @State private var confirmDiscard = false

    init(routine: DayPlan? = nil, limitReached: Bool = false, onSave: @escaping (String, [GymExercise]) async -> Bool) {
        self.routine = routine
        self.limitReached = limitReached
        self.onSave = onSave
        _name = State(initialValue: routine?.routine_name ?? "")
        _list = State(initialValue: routine?.exercises ?? [])
    }

    private var editing: Bool { routine != nil }
    /// Una rutina nueva no cabe con siete sesiones: se dice arriba y «Guardar» no se activa.
    private var blocked: Bool { !editing && limitReached }
    private var trimmedName: String { name.trimmingCharacters(in: .whitespacesAndNewlines) }
    private var dirty: Bool {
        trimmedName != (routine?.routine_name ?? "").trimmingCharacters(in: .whitespacesAndNewlines) || list != (routine?.exercises ?? [])
    }
    private var ready: Bool { !trimmedName.isEmpty && !list.isEmpty && dirty && !blocked }
    private var sets: Int { list.reduce(0) { $0 + $1.series } }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    Text("Ponle nombre, elige los ejercicios y ajusta series, repeticiones y descanso.")
                        .font(.apSubhead).foregroundStyle(Palette.muted)
                        .fixedSize(horizontal: false, vertical: true)
                    if blocked { RoutineLimitNote() }
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Nombre").font(.apFootnote.weight(.semibold)).foregroundStyle(Palette.muted)
                            .padding(.leading, 4).accessibilityHidden(true)
                        TextField("Ej.: Pierna pesada", text: $name)
                            .font(.apBody).textFieldStyle(.plain)
                            .padding(.horizontal, 20).frame(minHeight: 52)
                            .background(Palette.secondary, in: Capsule())
                            .accessibilityLabel("Nombre")
                    }
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Ejercicios").font(.apTitle3).accessibilityAddTraits(.isHeader)
                        if list.isEmpty {
                            // Sin ejercicios: la misma tarjeta grande que el día vacío de «Editar mi rutina».
                            Button { Haptics.selection(); picking = true } label: {
                                VStack(spacing: 8) {
                                    Image("lu-plus").renderingMode(.template).resizable().frame(width: 24, height: 24).foregroundStyle(Palette.gold)
                                        .frame(width: 48, height: 48).background(Palette.gold.opacity(0.15), in: Circle())
                                        .padding(.bottom, 4)
                                    Text("Añadir ejercicios").font(.apHeadline)
                                    Text("Busca por nombre o filtra por músculo").font(.apFootnote).foregroundStyle(Palette.muted)
                                        .multilineTextAlignment(.center)
                                }
                                .padding(.horizontal, 24)
                                .frame(maxWidth: .infinity, minHeight: 200)
                                .surface(Radius.hero)
                            }
                            .buttonStyle(.pressableCard)
                        } else {
                            VStack(spacing: 12) {
                                ForEach(PlanEditorValues.keyed(list)) { row in
                                    let index = row.index
                                    PlanExerciseRow(exercise: row.exercise, index: index, total: list.count,
                                                    onChange: { new in list[index] = new },
                                                    onMove: { dir in
                                                        let j = index + dir
                                                        if list.indices.contains(j) { list.swapAt(index, j) }
                                                    },
                                                    onRemove: { list.remove(at: index) })
                                }
                            }
                            Button { Haptics.selection(); picking = true } label: { Label("Añadir ejercicios", systemImage: "plus") }
                                .buttonStyle(.pillSecondary)
                        }
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
                    Button("Cerrar") { if dirty && !list.isEmpty { confirmDiscard = true } else { dismiss() } }
                }
            }
            .confirmationDialog("Tienes cambios sin guardar en esta rutina.", isPresented: $confirmDiscard, titleVisibility: .visible) {
                Button("Descartar cambios", role: .destructive) { dismiss() }
                Button("Seguir editando", role: .cancel) {}
            }
            .sheet(isPresented: $picking) {
                ExercisePickerView(existing: Set(list.map(\.name))) { picked in list += picked }
            }
        }
        .interactiveDismissDisabled(dirty && !list.isEmpty)
        #if os(macOS)
        .frame(minWidth: 560, minHeight: 680)
        #endif
    }

    /// La única acción dorada, abajo como en la web, con lo que lleva la rutina debajo.
    private var footer: some View {
        VStack(spacing: 8) {
            if failed {
                Text("No se pudo guardar la rutina. Inténtalo de nuevo.").font(.apFootnote).foregroundStyle(Palette.destructive)
                    .multilineTextAlignment(.center)
            }
            Button(saving ? "Guardando…" : "Guardar rutina") { Task { await save() } }
                .buttonStyle(.pill)
                .disabled(!ready || saving)
            if !list.isEmpty {
                Text("\(ExerciseLibraryCatalog.count(list.count)) · \(sets) \(sets == 1 ? "serie" : "series")")
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
        let ok = await onSave(trimmedName, list)
        saving = false
        if ok { Haptics.success(); dismiss() } else { failed = true; Haptics.error(); A11y.announce("No se pudo guardar la rutina") }
    }
}

/// «Tienes 7 sesiones: borra o edita una para añadir otra», en una tarjeta dorada tenue.
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

/// «Mis rutinas» en Entrenar (`MyRoutines.tsx`): cada rutina con su nombre, cuántos ejercicios y
/// qué músculos, sus miniaturas (foto o la huella del ejercicio) y «Empezar»; en «···», «Editar»,
/// «Duplicar» y «Borrar» (con hoja de confirmación).
struct MyRoutinesSection: View {
    let routines: [DayPlan]
    let limitReached: Bool
    var resumableDay: String? = nil
    var doneToday: Set<String> = []
    var onNew: () -> Void
    var onStart: (String) -> Void
    var onEdit: (String) -> Void
    var onDuplicate: (String) async -> Bool
    var onDelete: (String) async -> Bool

    @State private var deleting: DayPlan?
    @State private var busy = false
    /// Miniaturas que se enseñan por rutina; el resto, «+N».
    private let thumbs = 4

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .bottom, spacing: 12) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Mis rutinas").font(.apTitle3).accessibilityAddTraits(.isHeader)
                    if !routines.isEmpty {
                        Text("\(routines.count) \(routines.count == 1 ? "rutina tuya" : "rutinas tuyas")")
                            .font(.apFootnote.monospacedDigit()).foregroundStyle(Palette.muted)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                Button { Haptics.tap(); onNew() } label: {
                    Label("Nueva rutina", systemImage: "plus")
                        .font(.apSubhead.weight(.semibold)).foregroundStyle(Palette.gold)
                        .frame(minHeight: 44).contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .padding(.vertical, -8)
                .accessibilityHint(limitReached ? CustomRoutines.limitMessage : "Crea una rutina con tus ejercicios")
            }
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
                        .buttonStyle(.pillSecondary).padding(.top, 12)
                }
                .padding(20)
                .frame(maxWidth: .infinity, alignment: .leading)
                .surface()
            } else {
                VStack(spacing: 12) {
                    ForEach(routines, id: \.day) { card($0) }
                }
            }
        }
        .sheet(item: $deleting) { routine in
            // Borrar: hoja de confirmación, como «¿Descartar entrenamiento?».
            ChoiceSheet(title: "¿Borrar «\(CustomRoutines.name(routine))»?",
                        message: "Se quita de tu plan. Tu historial y tus récords se quedan como están.",
                        primary: busy ? "Borrando…" : "Borrar rutina", destructive: true, cancel: "Cancelar") {
                guard !busy else { return }
                Task {
                    busy = true
                    let ok = await onDelete(routine.day)
                    busy = false
                    if ok { deleting = nil }
                }
            } onCancel: { deleting = nil }
        }
    }

    private func card(_ routine: DayPlan) -> some View {
        let name = CustomRoutines.name(routine)
        let exercises = routine.exercises ?? []
        let extra = exercises.count - thumbs
        let done = doneToday.contains(routine.day)
        return VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .top, spacing: 12) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(name).font(.apHeadline).lineLimit(2).fixedSize(horizontal: false, vertical: true)
                    Text(CustomRoutines.meta(routine)).font(.apFootnote.monospacedDigit()).foregroundStyle(Palette.muted)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                Menu {
                    Button { Haptics.selection(); onEdit(routine.day) } label: { Label("Editar", systemImage: "pencil") }
                    Button { Haptics.selection(); Task { _ = await onDuplicate(routine.day) } } label: {
                        Label("Duplicar", systemImage: "plus.square.on.square")
                    }
                    .disabled(limitReached)
                    Divider()
                    Button(role: .destructive) { Haptics.warning(); deleting = routine } label: { Label("Borrar", systemImage: "trash") }
                } label: {
                    Image(systemName: "ellipsis").font(.system(size: 17, weight: .semibold)).foregroundStyle(Palette.muted)
                        .frame(width: 44, height: 44).contentShape(Circle())
                }
                #if os(macOS)
                .menuStyle(.borderlessButton).menuIndicator(.hidden).fixedSize()
                #endif
                .padding(.top, -10).padding(.trailing, -10)
                .accessibilityLabel("Más acciones de \(name)")
            }
            if !exercises.isEmpty {
                HStack(spacing: 8) {
                    ForEach(Array(exercises.prefix(thumbs).enumerated()), id: \.offset) { _, exercise in
                        ExerciseThumb(url: exercise.image_url, size: 48, name: exercise.name, muscleGroup: exercise.muscle_group)
                    }
                    if extra > 0 {
                        Text("+\(extra)").font(.apFootnote.weight(.semibold).monospacedDigit()).foregroundStyle(Palette.muted)
                            .frame(width: 48, height: 48)
                            .background(Palette.secondary, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                    }
                }
                .padding(.top, 12)
                .accessibilityHidden(true)
            }
            if done {
                Label("Hecha hoy", systemImage: "checkmark")
                    .font(.apHeadline).foregroundStyle(Palette.gold)
                    .frame(maxWidth: .infinity, minHeight: 50)
                    .background(Palette.gold.opacity(0.14), in: Capsule())
                    .accessibilityElement(children: .combine)
                    .padding(.top, 16)
            } else {
                Button(resumableDay == routine.day ? "Continuar entreno" : "Empezar") { Haptics.tap(); onStart(routine.day) }
                    .buttonStyle(.pillSecondary)
                    .disabled(exercises.isEmpty)
                    .padding(.top, 16)
                    .accessibilityLabel("\(resumableDay == routine.day ? "Continuar" : "Empezar") \(name)")
            }
        }
        .padding(16)
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
                    Text("Mis rutinas").font(.apTitle3).accessibilityAddTraits(.isHeader)
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
                                              muscleGroup: first?.muscle_group)
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
