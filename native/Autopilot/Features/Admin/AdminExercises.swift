import SwiftUI
import PhotosUI
import AVKit
import Supabase

/// Ejercicios, calcado de `ExerciseLibrary.tsx`: «Nuevo ejercicio», buscador, filtros por músculo y tipo,
/// chips de medios, lista con miniatura y ficha de edición (clasificación, parámetros, imagen y vídeo con IA).
struct AdminExercisesView: View {
    struct Exercise: Codable, Identifiable, Hashable {
        var id: String; var name: String; var muscle_group: String?; var image_url: String?; var video_url: String?
        var exercise_type: String?; var movement_pattern: String?; var level: Int?; var priority: Int?; var stimulus_type: String?
        var load_level: String?; var fatigue_level: String?; var recommended_order: Int?; var alternative_id: String?
        var skill_tag: String?; var progression_order: Int?; var is_stable: Bool?; var is_progressable: Bool?; var high_tension: Bool?
        var tracking_mode: String?
        static func blank() -> Exercise { Exercise(id: "", name: "") }
        init(id: String, name: String) { self.id = id; self.name = name }
    }

    static let muscles = ["Pecho", "Espalda", "Hombros", "Bíceps", "Tríceps", "Piernas", "Glúteos", "Core", "Cardio", "Cuerpo completo", "Isquiotibiales", "Gemelos", "Antebrazos", "Trapecios", "Romboides", "Lumbares", "Serrato", "Aductores", "Abductores", "Cuello"]
    static let types = ["Calistenia", "Gimnasio", "Mixto"]
    static let patterns = ["Empuje", "Tirón", "Sentadilla", "Bisagra", "Core"]
    static let stimuli = ["Fuerza", "Hipertrofia", "Resistencia", "Isométrico"]
    static let levels3 = ["Alta", "Media", "Baja"]

    @State private var exercises: [Exercise] = []
    @State private var fetched = false
    @State private var failed = false
    @State private var search = ""
    @State private var muscle = ""
    @State private var type = ""
    @State private var media = "all"
    @State private var editing: Exercise?
    @State private var preview: Exercise?
    @State private var visible = 60
    @State private var batchConfirm = false
    @State private var batch: (current: Int, total: Int, name: String)?
    @State private var batchTask: Task<Void, Never>?

    private var base: [Exercise] {
        exercises.filter { e in
            (search.isEmpty || e.name.localizedCaseInsensitiveContains(search)) && (muscle.isEmpty || e.muscle_group == muscle) && (type.isEmpty || e.exercise_type == type)
        }
    }
    private var filtered: [Exercise] {
        switch media {
        case "noImage": base.filter { ($0.image_url ?? "").isEmpty }
        case "noVideo": base.filter { ($0.video_url ?? "").isEmpty }
        case "complete": base.filter { !($0.image_url ?? "").isEmpty && !($0.video_url ?? "").isEmpty }
        default: base
        }
    }

    private var mediaOptions: [(String, String, Int)] {
        let b = base
        let noImage = b.filter { ($0.image_url ?? "").isEmpty }.count
        let noVideo = b.filter { ($0.video_url ?? "").isEmpty }.count
        let complete = b.filter { !($0.image_url ?? "").isEmpty && !($0.video_url ?? "").isEmpty }.count
        return [("all", "Todos", b.count), ("noImage", "Sin imagen", noImage), ("noVideo", "Sin vídeo", noVideo), ("complete", "Completos", complete)]
    }

    var body: some View {
        ScrollView {
            if !fetched {
                AdminLoadingView(message: "Cargando los ejercicios")
            } else if failed {
                AdminErrorCard(message: "No se pudo cargar la biblioteca de ejercicios. Comprueba la conexión y vuelve a intentarlo.") {
                    fetched = false
                    Task { await load() }
                }
                .padding(20)
            } else {
                VStack(alignment: .leading, spacing: 24) {
                    AdminPaneHeader("Biblioteca de ejercicios: clasificación, patrón, alternativa e imagen y vídeo de técnica con IA. Lo que genera la IA se guarda a medida que termina.") {
                        VStack(alignment: .leading, spacing: 10) {
                            Button("Nuevo ejercicio") { editing = .blank() }
                                .buttonStyle(.pill).frame(maxWidth: 260)
                            Button { batchConfirm = true } label: { Label("Generar medios pendientes", systemImage: "sparkles") }
                                .buttonStyle(.pillSecondary).frame(maxWidth: 300)
                                .disabled(batch != nil || pending.isEmpty)
                        }
                    }

                    if let b = batch {
                        Card(padding: 16) {
                            HStack {
                                Text("Generando \(b.current) de \(b.total) · \(b.name)")
                                    .font(.apFootnote).foregroundStyle(Palette.muted).lineLimit(1)
                                Spacer(minLength: 8)
                                AdminTextButton(title: "Cancelar") { batchTask?.cancel(); batch = nil }
                            }
                            ProgressView(value: Double(b.current - 1), total: Double(max(b.total, 1)))
                                .tint(Palette.gold)
                                .accessibilityLabel("Generando medios")
                                .accessibilityValue("\(b.current) de \(b.total)")
                        }
                    }

                    HStack {
                        Image(systemName: "magnifyingglass").foregroundStyle(Palette.muted)
                            .accessibilityHidden(true)
                        TextField("Buscar ejercicio…", text: $search).textFieldStyle(.plain)
                            .accessibilityLabel("Buscar ejercicio")
                        if !search.isEmpty {
                            AdminIconButton(symbol: "xmark", label: "Borrar búsqueda", tint: Palette.muted) { search = "" }
                        }
                    }
                    .padding(.leading, 16).padding(.trailing, 4).frame(minHeight: 52)
                    .background(Palette.secondary, in: Capsule())

                    HStack(alignment: .top, spacing: 12) {
                        filterMenu("Músculo", $muscle, Self.muscles.filter { m in exercises.contains { $0.muscle_group == m } })
                        filterMenu("Tipo", $type, Self.types)
                    }

                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 8) {
                            ForEach(mediaOptions, id: \.0) { k, l, n in
                                AdminChip(title: "\(l) · \(n)", selected: media == k) {
                                    media = k; Haptics.selection()
                                }
                            }
                        }
                    }

                    if filtered.isEmpty {
                        EmptyStateView(symbol: exercises.isEmpty ? "dumbbell" : "magnifyingglass",
                                       title: exercises.isEmpty ? "Aún no hay ejercicios" : "Sin resultados",
                                       message: exercises.isEmpty ? "Añade el primero con el botón Nuevo ejercicio." : "Prueba con otra búsqueda o cambia los filtros.")
                    } else {
                        AdminRows {
                            ForEach(Array(filtered.prefix(visible).enumerated()), id: \.element.id) { i, ex in
                                Button { editing = ex } label: {
                                    AdminListRow(ex.name, detail: [ex.muscle_group, ex.exercise_type, ex.movement_pattern].compactMap { $0 }.joined(separator: " · ")) {
                                        ExerciseThumb(url: ex.image_url, size: 52)
                                    } trailing: {
                                        HStack(spacing: 2) {
                                            if !(ex.video_url ?? "").isEmpty || !(ex.image_url ?? "").isEmpty {
                                                AdminIconButton(symbol: "play.fill", label: "Ver el vídeo de \(ex.name)") {
                                                    preview = ex
                                                }
                                            }
                                            Image(systemName: "chevron.right").font(.inter(.footnote).weight(.semibold))
                                                .foregroundStyle(Palette.muted).accessibilityHidden(true)
                                        }
                                    }
                                    .contentShape(Rectangle())
                                }
                                .buttonStyle(.plain)
                                .accessibilityHint("Abre la ficha del ejercicio")
                                .onAppear { if i == visible - 1 { visible += 60 } }
                                .adminRowDivider(first: i == 0, leading: 80)
                            }
                        }
                    }
                }
                .padding(20).frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .screenBackground()
        .task { await load() }
        .refreshable { await load() }
        .confirmationDialog("Generar medios pendientes", isPresented: $batchConfirm, titleVisibility: .visible) {
            Button("Generar") { startBatch() }
            Button("Ahora no", role: .cancel) {}
        } message: {
            Text("Se generará imagen y/o vídeo de técnica con IA para \(pending.count) ejercicios de los filtros actuales. Puede tardar bastante y consume créditos de IA. Se guarda a medida que se completa: si lo cancelas, podrás reanudarlo sin repetir los que ya estén listos.")
        }
        .sheet(item: $editing) { ex in
            ExerciseEditor(exercise: ex, all: exercises) { changed in editing = nil; if changed { Task { await load() } } }
        }
        .sheet(item: $preview) { ex in
            VStack(spacing: 12) {
                if let v = ex.video_url, let u = URL(string: v) {
                    VideoPlayer(player: AVPlayer(url: u)).frame(minHeight: 360)
                        .accessibilityLabel("Vídeo de técnica de \(ex.name)")
                } else if let i = ex.image_url, let u = URL(string: i) {
                    CachedAsyncImage(url: u) { $0.resizable().scaledToFit() } placeholder: { ProgressView() }
                        .accessibilityLabel("Imagen de \(ex.name)")
                }
                Text(ex.name).font(.apTitle3)
                Text([ex.muscle_group, ex.exercise_type].compactMap { $0 }.joined(separator: " · ")).font(.apSubhead).foregroundStyle(Palette.muted)
                Button("Cerrar") { preview = nil }.buttonStyle(.pillSecondary).frame(maxWidth: 280)
            }
            .padding(20).frame(minWidth: 480).screenBackground()
        }
    }

    /// Ejercicios de los filtros actuales a los que les falta imagen o vídeo.
    private var pending: [Exercise] { base.filter { ($0.image_url ?? "").isEmpty || ($0.video_url ?? "").isEmpty } }

    private func startBatch() {
        let queue = pending
        batchTask = Task {
            struct R: Decodable { let image_url: String?; let video_url: String?; let error: String? }
            for (i, ex) in queue.enumerated() {
                if Task.isCancelled { break }
                batch = (i + 1, queue.count, ex.name)
                if (ex.image_url ?? "").isEmpty {
                    let _: R? = try? await Backend.client.functions.invoke("exercise-video", options: FunctionInvokeOptions(body: ["exercise_id": ex.id, "action": "image"]))
                }
                if (ex.video_url ?? "").isEmpty, !Task.isCancelled {
                    let _: R? = try? await Backend.client.functions.invoke("exercise-video", options: FunctionInvokeOptions(body: ["exercise_id": ex.id, "action": "create"]))
                    for _ in 0..<60 {
                        if Task.isCancelled { break }
                        try? await Task.sleep(for: .seconds(10))
                        let c: R? = try? await Backend.client.functions.invoke("exercise-video", options: FunctionInvokeOptions(body: ["exercise_id": ex.id, "action": "check"]))
                        if c?.video_url != nil || c?.error != nil { break }
                    }
                }
            }
            batch = nil
            await load()
        }
    }

    private func filterMenu(_ label: String, _ value: Binding<String>, _ options: [String]) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label).font(.apFootnote).foregroundStyle(Palette.muted)
            Picker(label, selection: value) {
                Text("Todos").tag("")
                ForEach(options, id: \.self) { o in Text(o).tag(o) }
            }
            .labelsHidden().pickerStyle(.menu).tint(Palette.gold)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .frame(maxWidth: .infinity)
    }

    private func load() async {
        do {
            exercises = try await Backend.client.from("exercises")
                .select("id, name, muscle_group, image_url, video_url, exercise_type, movement_pattern, level, priority, stimulus_type, load_level, fatigue_level, recommended_order, alternative_id, skill_tag, progression_order, is_stable, is_progressable, high_tension, tracking_mode")
                .order("muscle_group").order("recommended_order").order("name").execute().value
            failed = false
        } catch {
            failed = true
        }
        fetched = true
    }
}

/// Ficha de ejercicio (ExerciseFormDialog).
struct ExerciseEditor: View {
    @State var exercise: AdminExercisesView.Exercise
    let all: [AdminExercisesView.Exercise]
    var onDone: (Bool) -> Void
    @State private var photo: PhotosPickerItem?
    @State private var busy: String?
    @State private var error: String?
    @State private var confirmDelete = false

    var body: some View {
        NavigationStack {
            Form {
                Section("Información básica") {
                    HStack {
                        TextField("Press banca", text: $exercise.name)
                        Button { Task { await classify() } } label: { Label("IA", systemImage: "sparkles") }.disabled(exercise.name.isEmpty || busy != nil)
                    }
                    picker("Músculo", \.muscle_group, AdminExercisesView.muscles)
                    picker("Tipo", \.exercise_type, AdminExercisesView.types)
                }
                Section("Clasificación") {
                    picker("Patrón", \.movement_pattern, AdminExercisesView.patterns)
                    picker("Estímulo", \.stimulus_type, AdminExercisesView.stimuli)
                    intPicker("Nivel", \.level, [(1, "Básico"), (2, "Intermedio"), (3, "Avanzado")])
                    intPicker("Prioridad", \.priority, [(1, "Base"), (2, "Desarrollo"), (3, "Accesorio")])
                }
                Section("Parámetros de generación") {
                    picker("Carga", \.load_level, AdminExercisesView.levels3)
                    picker("Fatiga", \.fatigue_level, AdminExercisesView.levels3)
                    intPicker("Orden recomendado", \.recommended_order, [(1, "Inicio"), (2, "Medio"), (3, "Final")])
                    Toggle("Estable", isOn: Binding(get: { exercise.is_stable ?? false }, set: { exercise.is_stable = $0 }))
                    Toggle("Progresable", isOn: Binding(get: { exercise.is_progressable ?? false }, set: { exercise.is_progressable = $0 }))
                    Toggle("Alta tensión", isOn: Binding(get: { exercise.high_tension ?? false }, set: { exercise.high_tension = $0 }))
                }
                Section("Imagen del ejercicio") {
                    if let i = exercise.image_url, let u = URL(string: i), !i.isEmpty {
                        CachedAsyncImage(url: u) { $0.resizable().scaledToFit() } placeholder: { ProgressView() }.frame(maxHeight: 220)
                    }
                    PhotosPicker(selection: $photo, matching: .images) { Text("Subir imagen").foregroundStyle(Palette.gold) }
                    if !exercise.id.isEmpty {
                        Button("Generar imagen con IA") { Task { await media("image") } }.disabled(busy != nil)
                    }
                    if !(exercise.image_url ?? "").isEmpty { Button("Quitar imagen", role: .destructive) { exercise.image_url = nil } }
                }
                Section("Vídeo del ejercicio") {
                    TextField("YouTube, Vimeo o MP4 directo (https://…)", text: Binding(get: { exercise.video_url ?? "" }, set: { exercise.video_url = $0.isEmpty ? nil : $0 }))
                    if !exercise.id.isEmpty {
                        Button("Generar vídeo de técnica con IA") { Task { await media("create") } }.disabled(busy != nil)
                    }
                }
                Section("Alternativa") {
                    Picker("Ejercicio alternativo", selection: Binding(get: { exercise.alternative_id ?? "" }, set: { exercise.alternative_id = $0.isEmpty ? nil : $0 })) {
                        Text("Ninguna").tag("")
                        ForEach(all.filter { $0.id != exercise.id }) { Text($0.name).tag($0.id) }
                    }
                }
                if let busy { Section { HStack { ProgressView(); Text(busy) } } }
                if let error { Section { Text(error).foregroundStyle(Palette.destructive) } }
                if !exercise.id.isEmpty { Section { Button("Eliminar ejercicio", role: .destructive) { confirmDelete = true } } }
            }
            .formStyle(.grouped)
            .navigationTitle(exercise.id.isEmpty ? "Nuevo ejercicio" : "Editar ejercicio")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancelar") { onDone(false) } }
                ToolbarItem(placement: .confirmationAction) { Button("Guardar") { Task { await save() } }.disabled(exercise.name.trimmingCharacters(in: .whitespaces).isEmpty) }
            }
        }
        .frame(minWidth: 560, minHeight: 720)
        .tint(Palette.gold)
        .onChange(of: photo) { _, p in Task { await upload(p) } }
        .confirmationDialog("Eliminar ejercicio", isPresented: $confirmDelete, titleVisibility: .visible) {
            Button("Eliminar", role: .destructive) { Task { _ = try? await Backend.client.from("exercises").delete().eq("id", value: exercise.id).execute(); onDone(true) } }
            Button("Cancelar", role: .cancel) {}
        } message: { Text("Se eliminará \(exercise.name) de la biblioteca, junto con su imagen y su vídeo guardados. Esta acción no se puede deshacer.") }
    }

    private func picker(_ label: String, _ key: WritableKeyPath<AdminExercisesView.Exercise, String?>, _ options: [String]) -> some View {
        Picker(label, selection: Binding(get: { exercise[keyPath: key] ?? "" }, set: { exercise[keyPath: key] = $0.isEmpty ? nil : $0 })) {
            Text("—").tag("")
            ForEach(options, id: \.self) { Text($0).tag($0) }
        }
    }

    private func intPicker(_ label: String, _ key: WritableKeyPath<AdminExercisesView.Exercise, Int?>, _ options: [(Int, String)]) -> some View {
        Picker(label, selection: Binding(get: { exercise[keyPath: key] ?? 0 }, set: { exercise[keyPath: key] = $0 == 0 ? nil : $0 })) {
            Text("—").tag(0)
            ForEach(options, id: \.0) { Text($0.1).tag($0.0) }
        }
    }

    private func save() async {
        busy = "Guardando…"; defer { busy = nil }
        var payload = exercise
        payload.name = exercise.name.trimmingCharacters(in: .whitespaces)
        struct Insert: Encodable {
            let e: AdminExercisesView.Exercise
            func encode(to encoder: Encoder) throws {
                var c = encoder.container(keyedBy: AdminExercisesView.Exercise.CodingKeys.self)
                try c.encode(e.name, forKey: .name)
                try c.encode(e.muscle_group, forKey: .muscle_group); try c.encode(e.image_url, forKey: .image_url); try c.encode(e.video_url, forKey: .video_url)
                try c.encode(e.exercise_type, forKey: .exercise_type); try c.encode(e.movement_pattern, forKey: .movement_pattern)
                try c.encode(e.level, forKey: .level); try c.encode(e.priority, forKey: .priority); try c.encode(e.stimulus_type, forKey: .stimulus_type)
                try c.encode(e.load_level, forKey: .load_level); try c.encode(e.fatigue_level, forKey: .fatigue_level)
                try c.encode(e.recommended_order, forKey: .recommended_order); try c.encode(e.alternative_id, forKey: .alternative_id)
                try c.encode(e.is_stable, forKey: .is_stable); try c.encode(e.is_progressable, forKey: .is_progressable); try c.encode(e.high_tension, forKey: .high_tension)
            }
        }
        do {
            if payload.id.isEmpty { try await Backend.client.from("exercises").insert(Insert(e: payload)).execute() }
            else { try await Backend.client.from("exercises").update(Insert(e: payload)).eq("id", value: payload.id).execute() }
            Haptics.success(); onDone(true)
        } catch { self.error = "No se pudo guardar" }
    }

    private func upload(_ p: PhotosPickerItem?) async {
        guard let p, let data = try? await p.loadTransferable(type: Data.self), let img = PlatformImage(data: data), let jpg = img.jpegData() else { return }
        busy = "Subiendo imagen…"; defer { busy = nil }
        let path = "exercises/\(exercise.id.isEmpty ? UUID().uuidString : exercise.id)-\(Int(Date().timeIntervalSince1970)).jpg"
        do {
            try await Backend.client.storage.from("site-assets").upload(path, data: jpg, options: FileOptions(contentType: "image/jpeg", upsert: true))
            exercise.image_url = try Backend.client.storage.from("site-assets").getPublicURL(path: path).absoluteString
        } catch { self.error = "Error al subir la imagen" }
    }

    /// Imagen o vídeo con IA mediante `exercise-video` (crear y comprobar, como la web).
    private func media(_ action: String) async {
        struct R: Decodable { let image_url: String?; let video_url: String?; let status: String?; let error: String? }
        do {
            if action == "image" {
                busy = "Generando imagen…"
                let r: R = try await Backend.client.functions.invoke("exercise-video", options: FunctionInvokeOptions(body: ["exercise_id": exercise.id, "action": "image"]))
                if let u = r.image_url { exercise.image_url = u } else if let e = r.error { error = e }
            } else {
                busy = "Generando vídeo… puede tardar unos minutos"
                let _: R = try await Backend.client.functions.invoke("exercise-video", options: FunctionInvokeOptions(body: ["exercise_id": exercise.id, "action": "create"]))
                for _ in 0..<60 {
                    try await Task.sleep(for: .seconds(10))
                    let c: R = try await Backend.client.functions.invoke("exercise-video", options: FunctionInvokeOptions(body: ["exercise_id": exercise.id, "action": "check"]))
                    if let u = c.video_url { exercise.video_url = u; break }
                    if let e = c.error { error = e; break }
                }
            }
        } catch { self.error = "No se pudo generar con IA" }
        busy = nil
    }

    private func classify() async {
        busy = "Clasificando con IA…"; defer { busy = nil }
        struct C: Decodable { let muscle_group: String?; let exercise_type: String?; let movement_pattern: String?; let stimulus_type: String?; let level: Int?; let priority: Int?; let load_level: String?; let fatigue_level: String? }
        if let c: C = try? await Backend.client.functions.invoke("ai-classify-exercise", options: FunctionInvokeOptions(body: ["name": exercise.name])) {
            exercise.muscle_group = c.muscle_group ?? exercise.muscle_group; exercise.exercise_type = c.exercise_type ?? exercise.exercise_type
            exercise.movement_pattern = c.movement_pattern ?? exercise.movement_pattern; exercise.stimulus_type = c.stimulus_type ?? exercise.stimulus_type
            exercise.level = c.level ?? exercise.level; exercise.priority = c.priority ?? exercise.priority
            exercise.load_level = c.load_level ?? exercise.load_level; exercise.fatigue_level = c.fatigue_level ?? exercise.fatigue_level
        } else { error = "No se pudo clasificar" }
    }
}

extension AdminExercisesView.Exercise {
    enum CodingKeys: String, CodingKey {
        case id, name, muscle_group, image_url, video_url, exercise_type, movement_pattern, level, priority, stimulus_type, load_level,
             fatigue_level, recommended_order, alternative_id, skill_tag, progression_order, is_stable, is_progressable, high_tension, tracking_mode
    }
}
