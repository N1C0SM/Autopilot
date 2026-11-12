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
                        .surface()
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
                                .surface(Radius.hero)
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
            HStack(spacing: 10) {
                CachedAsyncImage(url: exercise.image_url.flatMap(URL.init(string:))) { $0.resizable().scaledToFill() } placeholder: { Palette.secondary }
                    .frame(width: 48, height: 48).clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
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
        .surface()
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

/// Fila del buscador de ejercicios (misma forma en disco y en memoria).
struct ExercisePickerRow: Codable, Identifiable, Hashable {
    let id: String
    let name: String
    let muscle_group: String?
    let image_url: String?
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
            .select("id,name,muscle_group,image_url").order("name").limit(200).execute().value,
           !rows.isEmpty {
            store(rows)
            lock.lock(); warmed = true; lock.unlock()
        }
    }
}

/// Buscador de la biblioteca de ejercicios (`ExercisePicker.tsx`): selección múltiple y «Añadir».
struct ExercisePickerView: View {
    @Environment(\.dismiss) private var dismiss
    let existing: Set<String>
    var onPick: ([GymExercise]) -> Void

    private typealias Row = ExercisePickerRow
    /// Arranca ya con la copia del teléfono: la lista aparece al instante y la red solo la afina.
    @State private var rows: [Row] = ExerciseCatalogStore.cached
    @State private var query = ""
    @State private var selected: [String] = []
    @State private var group: String?
    /// Grupos musculares del catálogo: se guardan al cargar sin filtros para que los chips no
    /// desaparezcan mientras se busca.
    @State private var groups: [String] = Array(Set(ExerciseCatalogStore.cached.compactMap(\.muscle_group))).sorted()
    @State private var loading = true
    @State private var failed = false
    /// Última lista completa descargada. Vive en el teléfono para que el buscador siga
    /// funcionando en el gimnasio sin cobertura (y al abrir en frío sin red).
    @State private var catalog: [Row] = ExerciseCatalogStore.cached
    @State private var offline = false

    /// Se busca en el servidor (no en memoria): la biblioteca es grande y traerla entera dejaba
    /// la pantalla en blanco. Los resultados llegan por nombre y músculo, con un límite sano.
    private var searchKey: String { "\(query)|#\(group ?? "")" }

    private var filtered: [Row] { rows.filter { !existing.contains($0.name) } }

    var body: some View {
        NavigationStack {
            List {
                if offline {
                    Label("Sin conexión: mostrando la última lista descargada.", systemImage: "wifi.slash")
                        .font(.apFootnote)
                        .foregroundStyle(Palette.muted)
                        .listRowBackground(Color.clear)
                        .listRowSeparator(.hidden)
                }
                if !groups.isEmpty {
                    Section {
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 6) {
                                chip("Todos", active: group == nil) { group = nil }
                                ForEach(groups, id: \.self) { g in chip(g, active: group == g) { group = g } }
                            }
                        }
                        .listRowBackground(Color.clear)
                        .listRowInsets(EdgeInsets())
                    }
                }
                if failed {
                    VStack(spacing: 12) {
                        Image(systemName: "wifi.exclamationmark").font(.system(size: 26))
                            .foregroundStyle(Palette.gold)
                        Text("No hemos podido cargar los ejercicios").font(.apHeadline)
                            .multilineTextAlignment(.center)
                        Text("Revisa tu conexión y vuelve a intentarlo.").font(.apFootnote)
                            .foregroundStyle(Palette.muted).multilineTextAlignment(.center)
                        Button("Reintentar") { Task { await load() } }
                            .buttonStyle(.pillSecondary)
                            .padding(.top, 4)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 40)
                    .listRowBackground(Color.clear)
                    .listRowSeparator(.hidden)
                } else if loading && rows.isEmpty {
                    HStack(spacing: 10) {
                        ProgressView().tint(Palette.gold)
                        Text("Cargando ejercicios…").font(.apFootnote).foregroundStyle(Palette.muted)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 32)
                    .listRowBackground(Color.clear)
                    .listRowSeparator(.hidden)
                } else if filtered.isEmpty {
                    VStack(spacing: 8) {
                        Text(query.isEmpty ? "No quedan ejercicios por añadir" : "Sin resultados para «\(query)»")
                            .font(.apHeadline).multilineTextAlignment(.center)
                        Text(query.isEmpty ? "Quita algún filtro o busca otro músculo." : "Prueba con otro nombre o músculo.")
                            .font(.apFootnote).foregroundStyle(Palette.muted).multilineTextAlignment(.center)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 40)
                    .listRowBackground(Color.clear)
                    .listRowSeparator(.hidden)
                }
                ForEach(filtered) { row in
                Button {
                    Haptics.selection()
                    if let i = selected.firstIndex(of: row.id) { selected.remove(at: i) } else { selected.append(row.id) }
                } label: {
                    HStack(spacing: 12) {
                        CachedAsyncImage(url: row.image_url.flatMap(URL.init(string:))) { $0.resizable().scaledToFill() } placeholder: { Palette.secondary }
                            .frame(width: 64, height: 64).clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
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
            }
            .scrollContentBackground(.hidden)
            .screenBackground()
            .searchable(text: $query, prompt: "Buscar ejercicio o músculo")
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
        // Se pinta al momento con la copia del teléfono (sin rueda al abrir ni al escribir) y,
        // en paralelo, se pide al servidor: su respuesta solo afina la lista cuando llega.
        .task(id: searchKey) {
            let text = query.trimmingCharacters(in: .whitespaces)
            if !catalog.isEmpty {
                let local = localMatches(text, group: group)
                if local != rows { rows = local }
            } else {
                await ExerciseCatalogStore.warm()
                if catalog.isEmpty { catalog = ExerciseCatalogStore.cached }
                if !catalog.isEmpty {
                    let local = localMatches(text, group: group)
                    if local != rows { rows = local }
                    if groups.isEmpty { groups = Array(Set(catalog.compactMap(\.muscle_group))).sorted() }
                }
            }
            // Espera corta al escribir (y cancela la búsqueda anterior): una sola petición por pausa.
            if !text.isEmpty || group != nil { try? await Task.sleep(for: .milliseconds(300)) }
            guard !Task.isCancelled else { return }
            await load()
        }
    }

    /// Petición al servidor con los filtros actuales (nombre/músculo y grupo).
    private func fetch(text: String, group: String?) async throws -> [Row] {
        var request = Backend.client.from("exercises").select("id,name,muscle_group,image_url")
        if !text.isEmpty {
            // Búsqueda sin acentos ni mayúsculas: «biceps» encuentra «Bíceps».
            let clean = text.replacingOccurrences(of: "%", with: "").replacingOccurrences(of: ",", with: " ")
            request = request.or("name.ilike.%\(clean)%,muscle_group.ilike.%\(clean)%")
        }
        if let group { request = request.eq("muscle_group", value: group) }
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
                result = try await fetch(text: text, group: group)
            } catch {
                guard !Task.isCancelled else { return }
                // Un reintento corto: al abrir en frío el primer intento puede adelantarse al
                // refresco de la sesión o a que el móvil recupere cobertura.
                try? await Task.sleep(for: .milliseconds(700))
                guard !Task.isCancelled else { return }
                result = try await fetch(text: text, group: group)
            }
            guard !Task.isCancelled else { return }
            rows = result
            offline = false
            if text.isEmpty, group == nil {
                // El catálogo completo queda en el teléfono: sin red se busca en esta copia.
                catalog = result
                ExerciseCatalogStore.store(result)
                let list = Array(Set(result.compactMap(\.muscle_group))).sorted()
                if !list.isEmpty { groups = list }
            }
        } catch {
            guard !Task.isCancelled else { return }
            if !catalog.isEmpty {
                // Sin conexión: se filtra la copia local por nombre y músculo.
                rows = localMatches(text, group: group)
                if groups.isEmpty {
                    groups = Array(Set(catalog.compactMap(\.muscle_group))).sorted()
                }
                offline = true
            } else if rows.isEmpty {
                failed = true
            }
        }
    }

    /// Búsqueda en la copia del teléfono, sin acentos ni mayúsculas (igual que `ilike`).
    private func localMatches(_ text: String, group: String?) -> [Row] {
        func key(_ value: String) -> String {
            value.folding(options: [.caseInsensitive, .diacriticInsensitive], locale: .current)
        }
        let needle = key(text)
        return catalog.filter { row in
            if let group, row.muscle_group != group { return false }
            guard !needle.isEmpty else { return true }
            return key(row.name).contains(needle) || key(row.muscle_group ?? "").contains(needle)
        }
    }

    private func chip(_ label: String, active: Bool, action: @escaping () -> Void) -> some View {
        Button { Haptics.selection(); action() } label: {
            Text(label).font(.apFootnote.weight(.semibold))
                .padding(.horizontal, 14).frame(height: 34)
                .foregroundStyle(active ? Color.black : Palette.foreground)
                .background(active ? Palette.gold : Palette.secondary, in: Capsule())
        }
        .buttonStyle(.plain)
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
