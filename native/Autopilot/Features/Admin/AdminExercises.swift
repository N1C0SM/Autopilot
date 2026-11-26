import SwiftUI
import PhotosUI
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
        /// Nuevo ejercicio con los mismos valores de partida que la web (`ExerciseFormDialog`): nivel
        /// básico, prioridad de desarrollo, orden medio y los tres criterios activados (en la base de
        /// datos no pueden ir vacíos).
        static func blank() -> Exercise {
            var e = Exercise(id: "", name: "")
            e.level = 1; e.priority = 2; e.recommended_order = 2
            e.is_stable = true; e.is_progressable = true; e.high_tension = true
            return e
        }
        init(id: String, name: String) { self.id = id; self.name = name }
    }

    static let muscles = ["Pecho", "Espalda", "Hombros", "Bíceps", "Tríceps", "Piernas", "Glúteos", "Core", "Cardio", "Cuerpo completo", "Isquiotibiales", "Gemelos", "Antebrazos", "Trapecios", "Romboides", "Lumbares", "Serrato", "Aductores", "Abductores", "Cuello"]
    static let types = ["Calistenia", "Gimnasio", "Mixto"]
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
                    AdminPaneHeader("Biblioteca de ejercicios: clasificación, alternativa e imagen y vídeo de técnica con IA. Lo que genera la IA se guarda a medida que termina.") {
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
                            HStack(alignment: .firstTextBaseline, spacing: 8) {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text("Generando \(NumberText.grouped(Double(b.current))) de \(NumberText.grouped(Double(b.total)))")
                                        .font(.apSubhead.weight(.semibold).monospacedDigit())
                                    Text(b.name).font(.apFootnote).foregroundStyle(Palette.muted).lineLimit(2)
                                }
                                .frame(maxWidth: .infinity, alignment: .leading)
                                AdminTextButton(title: "Cancelar") { batchTask?.cancel(); batch = nil }
                            }
                            ProgressView(value: Double(b.current - 1), total: Double(max(b.total, 1)))
                                .tint(Palette.gold)
                                .accessibilityLabel("Generando medios")
                                .accessibilityValue("\(b.current) de \(b.total)")
                        }
                    }

                    AdminCatalogImportCard { Task { await load() } }

                    // Vídeos de los ejercicios que usan los planes: cuenta, coste, confirmación y uno a uno.
                    AdminPlanVideosCard { Task { await load() } }

                    VStack(alignment: .leading, spacing: 12) {
                        SectionTitle(title: "Biblioteca", hint: AdminExercisesView.countLabel(filtered.count))
                        SearchPill(prompt: "Buscar ejercicio", text: $search)

                        // Dos filtros en una fila; con letra grande, uno debajo de otro (nada se corta).
                        if typeSize.isAccessibilitySize {
                            VStack(alignment: .leading, spacing: 8) { filters }
                        } else {
                            HStack(alignment: .top, spacing: 12) { filters }
                        }

                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 8) {
                                ForEach(mediaOptions, id: \.0) { k, l, n in
                                    AdminChip(title: "\(l) · \(NumberText.grouped(Double(n)))", selected: media == k) {
                                        media = k; Haptics.selection()
                                    }
                                    .accessibilityLabel("\(l), \(n)")
                                }
                            }
                        }
                    }

                    if filtered.isEmpty {
                        EmptyStateView(symbol: exercises.isEmpty ? "dumbbell" : "magnifyingglass",
                                       title: exercises.isEmpty ? "Aún no hay ejercicios" : "Sin resultados",
                                       message: exercises.isEmpty ? "Añade el primero con «Nuevo ejercicio»." : "Prueba con otra búsqueda o cambia los filtros.")
                            .surface()
                    } else {
                        AdminRows {
                            ForEach(Array(filtered.prefix(visible).enumerated()), id: \.element.id) { i, ex in
                                Button { editing = ex } label: {
                                    AdminListRow(ex.name, detail: AdminExercisesView.meta(ex)) {
                                        ExerciseThumb(url: ex.image_url, size: 52, name: ex.name, muscleGroup: ex.muscle_group,
                                                      video: ex.video_url, fresh: true)
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
            Text("Se generará imagen y/o vídeo de técnica con IA para \(AdminExercisesView.countLabel(pending.count)) de los filtros actuales. Puede tardar bastante y consume créditos de IA. Se guarda a medida que se completa: si lo cancelas, podrás reanudarlo sin repetir los que ya estén listos.")
        }
        .sheet(item: $editing) { ex in
            ExerciseEditor(exercise: ex, all: exercises) { changed in editing = nil; if changed { Task { await load() } } }
        }
        .sheet(item: $preview) { ex in
            AdminExercisePreview(exercise: ex) { preview = nil }
        }
    }

    /// Subtítulo de la fila: solo grupo muscular y tipo, como `ExerciseMeta` en la web.
    static func meta(_ ex: Exercise) -> String {
        let categories = [ex.muscle_group, ex.exercise_type].compactMap { $0?.isEmpty == false ? $0 : nil }
        return categories.isEmpty ? "Sin clasificar" : categories.joined(separator: " · ")
    }

    /// «1 ejercicio», «1.240 ejercicios» (con punto de miles).
    static func countLabel(_ n: Int) -> String { "\(NumberText.grouped(Double(n))) \(n == 1 ? "ejercicio" : "ejercicios")" }

    @Environment(\.dynamicTypeSize) private var typeSize

    @ViewBuilder private var filters: some View {
        filterMenu("Músculo", $muscle, Self.muscles.filter { m in exercises.contains { $0.muscle_group == m } })
        filterMenu("Tipo", $type, Self.types)
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

    /// Filtro en píldora («Músculo: Todos»), como los de la biblioteca de la app.
    private func filterMenu(_ label: String, _ value: Binding<String>, _ options: [String]) -> some View {
        AdminMenuField(label: label, selection: value,
                       options: [AdminOption(value: "", label: "Todos")] + options.map { AdminOption(value: $0, label: $0) })
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

/// Vista previa de Admin (`ExercisePreviewSheet` en la web): el ejercicio en movimiento sobre su foto
/// a todo el ancho, su nombre y, si aún no tiene clip, qué falta y cómo crearlo. Cabe en el iPhone
/// (sin anchos mínimos) y en el Mac es una hoja de 480.
private struct AdminExercisePreview: View {
    let exercise: AdminExercisesView.Exercise
    let onClose: () -> Void

    var body: some View {
        let ex = exercise
        // Grupo y tipo, como `detail` en la web; sin ninguno de los dos, solo el nombre.
        let detail = [ex.muscle_group, ex.exercise_type].compactMap { $0?.isEmpty == false ? $0 : nil }.joined(separator: " · ")
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                ExerciseHeroMedia(name: ex.name, image: ex.image_url, video: ex.video_url, muscleGroup: ex.muscle_group)
                VStack(alignment: .leading, spacing: 4) {
                    Text(ex.name).font(.apTitle2).fixedSize(horizontal: false, vertical: true).accessibilityAddTraits(.isHeader)
                    if !detail.isEmpty { Text(detail).font(.apSubhead).foregroundStyle(Palette.muted).fixedSize(horizontal: false, vertical: true) }
                }
                if (ex.video_url ?? "").isEmpty, !(ex.image_url ?? "").isEmpty {
                    // Con foto y sin clip: qué falta y cómo crearlo.
                    HStack(alignment: .top, spacing: 14) {
                        IconTile(symbol: "video", size: 40)
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Vídeo de técnica por crear").font(.apHeadline)
                            Text("Créalo desde su ficha o con «Generar vídeos de los ejercicios de los planes».")
                                .font(.apSubhead).foregroundStyle(Palette.muted).fixedSize(horizontal: false, vertical: true)
                        }
                    }
                    .padding(16).frame(maxWidth: .infinity, alignment: .leading)
                    .surface()
                    .accessibilityElement(children: .combine)
                }
                Button("Cerrar") { onClose() }.buttonStyle(.pillSecondary).padding(.top, 4)
            }
            .padding(.horizontal, 20).padding(.vertical, 24)
            .frame(maxWidth: 680).frame(maxWidth: .infinity)
        }
        .screenBackground()
        #if os(iOS)
        .presentationDetents([.large])
        .presentationDragIndicator(.visible)
        .presentationBackground(Palette.background)
        .presentationCornerRadius(Radius.hero)
        #else
        .frame(minWidth: 480, minHeight: 420)
        #endif
    }
}

/// Ficha de ejercicio (ExerciseFormDialog en la web), con el lenguaje de la app: el ejercicio en
/// movimiento a todo el ancho (16:9), secciones con título en Title 3, filas agrupadas sin borde,
/// campos en píldora a todo el ancho y las acciones como filas que crecen con la letra. En el iPhone
/// cabe a 393 pt y con letra de accesibilidad; en el Mac es una hoja de 560 × 720.
struct ExerciseEditor: View {
    @State var exercise: AdminExercisesView.Exercise
    let all: [AdminExercisesView.Exercise]
    var onDone: (Bool) -> Void
    @State private var photo: PhotosPickerItem?
    @State private var busy: String?
    @State private var error: String?
    @State private var confirmDelete = false

    private var isNew: Bool { exercise.id.isEmpty }
    private var hasImage: Bool { !(exercise.image_url ?? "").isEmpty }
    private var hasVideo: Bool { !(exercise.video_url ?? "").isEmpty }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 28) {
                    // El ejercicio arriba del todo, como el formulario de la web: en movimiento si ya tiene
                    // clip, su foto o, sin foto, la silueta con su músculo (que cambia al elegir el grupo).
                    ExerciseHeroMedia(name: exercise.name.isEmpty ? "Nuevo ejercicio" : exercise.name,
                                      image: exercise.image_url, video: exercise.video_url, muscleGroup: exercise.muscle_group)

                    section("Información básica") {
                        VStack(alignment: .leading, spacing: 6) {
                            Text("Nombre").font(.apFootnote).foregroundStyle(Palette.muted)
                            // Campo y «Clasificar» en una fila; con letra de accesibilidad, uno debajo de otro.
                            if typeSize.isAccessibilitySize {
                                VStack(alignment: .leading, spacing: 8) { nameField; classifyButton }
                            } else {
                                HStack(spacing: 8) { nameField; classifyButton }
                            }
                            hint("Escribe el nombre y pulsa Clasificar para rellenar los campos con IA.")
                        }
                        group {
                            picker("Grupo muscular", \.muscle_group, AdminExercisesView.muscles)
                            divider
                            picker("Tipo", \.exercise_type, AdminExercisesView.types)
                        }
                    }

                    section("Clasificación") {
                        group {
                            picker("Estímulo", \.stimulus_type, AdminExercisesView.stimuli)
                            divider
                            intPicker("Nivel", \.level, [(1, "Básico"), (2, "Intermedio"), (3, "Avanzado")])
                            divider
                            intPicker("Prioridad", \.priority, [(1, "Base"), (2, "Desarrollo"), (3, "Accesorio")])
                        }
                    }

                    section("Parámetros de generación") {
                        group {
                            picker("Carga", \.load_level, AdminExercisesView.levels3)
                            divider
                            picker("Fatiga", \.fatigue_level, AdminExercisesView.levels3)
                            divider
                            intPicker("Orden", \.recommended_order, [(1, "Inicio"), (2, "Medio"), (3, "Final")])
                        }
                    }

                    section("Criterios obligatorios") {
                        group {
                            toggle("Estable", "Permite ejecución sin que el equilibrio limite la carga", \.is_stable)
                            divider
                            toggle("Progresable", "Se puede aumentar carga/reps sesión a sesión", \.is_progressable)
                            divider
                            toggle("Alta tensión", "Genera mucha tensión en el músculo objetivo", \.high_tension)
                        }
                        hint("Si alguno está desactivado, el ejercicio no se incluirá en los planes generados.")
                    }

                    section("Imagen del ejercicio") {
                        group {
                            PhotosPicker(selection: $photo, matching: .images) {
                                AdminActionLabel(title: hasImage ? "Cambiar imagen" : "Subir imagen", symbol: "photo")
                            }
                            .buttonStyle(.plain)
                            .disabled(busy != nil)
                            if !isNew {
                                divider
                                AdminActionRow(title: hasImage ? "Otra foto con IA" : "Generar foto con IA", symbol: "sparkles") {
                                    Task { await media("image") }
                                }
                                .disabled(busy != nil)
                            }
                            if hasImage {
                                divider
                                AdminActionRow(title: "Quitar imagen", symbol: "trash", tint: Palette.destructive) { exercise.image_url = nil }
                            }
                        }
                        hint("Se mostrará al usuario en su plan. Las fotos generadas con IA usan siempre el mismo estilo que los vídeos.")
                    }

                    section("Vídeo del ejercicio") {
                        VStack(alignment: .leading, spacing: 6) {
                            Text("URL del vídeo").font(.apFootnote).foregroundStyle(Palette.muted)
                            urlField
                        }
                        if isNew {
                            hint("Guarda el ejercicio y después podrás generar su vídeo con IA.")
                        } else {
                            group {
                                AdminActionRow(title: hasVideo ? "Generar otro vídeo con IA" : "Generar vídeo con IA", symbol: "video") {
                                    Task { await media("create") }
                                }
                                .disabled(busy != nil)
                            }
                        }
                        hint("Pega cualquier URL de YouTube (incluye Shorts), Vimeo o un .mp4 directo, o genera el vídeo con IA. Se mostrará al usuario en su entrenamiento y se ve arriba, en la cabecera del ejercicio.")
                    }

                    section("Alternativa") {
                        group {
                            AdminPickerRow(label: "Ejercicio alternativo",
                                           selection: Binding(get: { exercise.alternative_id ?? "" }, set: { exercise.alternative_id = $0.isEmpty ? nil : $0 }),
                                           options: [AdminOption(value: "", label: "Ninguna")]
                                               + all.filter { $0.id != exercise.id }.map { AdminOption(value: $0.id, label: $0.name) })
                        }
                    }

                    if !isNew {
                        group {
                            AdminActionRow(title: "Eliminar ejercicio", symbol: "trash", tint: Palette.destructive) { confirmDelete = true }
                        }
                    }
                }
                .padding(.horizontal, 20).padding(.top, 8).padding(.bottom, 32)
                .frame(maxWidth: 680, alignment: .leading)
                .frame(maxWidth: .infinity)
            }
            .scrollDismissesKeyboard(.interactively)
            .screenBackground()
            // Lo que está en marcha (y lo que falla) abajo, a la vista desde cualquier sección.
            .safeAreaInset(edge: .bottom) { statusBar }
            .navigationTitle(isNew ? "Nuevo ejercicio" : "Editar ejercicio")
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancelar") { onDone(false) } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Guardar") { Task { await save() } }
                        .fontWeight(.semibold)
                        .disabled(exercise.name.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
        }
        #if os(iOS)
        .presentationDragIndicator(.visible)
        .presentationBackground(Palette.background)
        #else
        .frame(minWidth: 560, minHeight: 720)
        #endif
        .tint(Palette.gold)
        .onChange(of: photo) { _, p in Task { await upload(p) } }
        .onChange(of: error) { _, e in if let e { A11y.announce(e) } }
        .confirmationDialog("Eliminar ejercicio", isPresented: $confirmDelete, titleVisibility: .visible) {
            Button("Eliminar", role: .destructive) { Task { _ = try? await Backend.client.from("exercises").delete().eq("id", value: exercise.id).execute(); onDone(true) } }
            Button("Cancelar", role: .cancel) {}
        } message: { Text("Se eliminará \(exercise.name) de la biblioteca, junto con su imagen y su vídeo guardados. Esta acción no se puede deshacer.") }
    }

    /// Campo de la URL del vídeo: a todo el ancho, sin mayúsculas ni autocorrección y con teclado de URL.
    @ViewBuilder private var urlField: some View {
        let field = TextField("YouTube, Vimeo o MP4 directo (https://…)",
                              text: Binding(get: { exercise.video_url ?? "" }, set: { exercise.video_url = $0.isEmpty ? nil : $0 }))
            .autocorrectionDisabled()
            .accessibilityLabel("URL del vídeo")
            .adminField(minHeight: 48)
        #if os(iOS)
        field.keyboardType(.URL).textInputAutocapitalization(.never)
        #else
        field
        #endif
    }

    /// Barra inferior con lo que está en marcha (el AP latiendo) o el aviso si algo falla.
    @ViewBuilder private var statusBar: some View {
        if busy != nil || error != nil {
            HStack(spacing: 12) {
                if let busy {
                    BrandLoader()
                    Text(busy).font(.apSubhead).foregroundStyle(Palette.foreground)
                } else if let error {
                    Image(systemName: "exclamationmark.circle.fill").foregroundStyle(Palette.destructive).accessibilityHidden(true)
                    Text(error).font(.apSubhead).foregroundStyle(Palette.foreground)
                    Spacer(minLength: 4)
                    AdminIconButton(symbol: "xmark", label: "Cerrar aviso") { self.error = nil }
                }
            }
            .fixedSize(horizontal: false, vertical: true)
            .padding(.horizontal, 18).padding(.vertical, 10)
            .frame(maxWidth: 640, minHeight: 52, alignment: .leading)
            .surface()
            .padding(.horizontal, 20).padding(.bottom, 8)
            .accessibilityElement(children: .combine)
        }
    }

    @Environment(\.dynamicTypeSize) private var typeSize

    private var canClassify: Bool { !exercise.name.trimmingCharacters(in: .whitespaces).isEmpty && busy == nil }

    private var nameField: some View {
        TextField("Press banca", text: $exercise.name)
            .accessibilityLabel("Nombre")
            .adminField(minHeight: 48)
    }

    /// «Clasificar» en píldora dorada suave, como el botón secundario de la web. Mientras clasifica,
    /// el AP late en la barra de abajo (un solo AP por vista).
    private var classifyButton: some View {
        Button { Haptics.tap(); Task { await classify() } } label: {
            HStack(spacing: 6) {
                Image(systemName: "sparkles").font(.inter(.footnote).weight(.semibold)).accessibilityHidden(true)
                Text("Clasificar").font(.apSubhead.weight(.semibold))
            }
            .foregroundStyle(Palette.gold)
            .padding(.horizontal, 16)
            .frame(minHeight: 48)
            .background(Palette.gold.opacity(0.15), in: Capsule())
            .contentShape(Capsule())
            .fixedSize(horizontal: true, vertical: false)
        }
        .buttonStyle(.plain)
        .disabled(!canClassify)
        .opacity(canClassify ? 1 : 0.4)
        .accessibilityLabel("Clasificar con IA")
        .accessibilityHint("Rellena el músculo, el tipo y los parámetros")
    }

    /// Nota gris bajo un bloque (como `Hint` y el pie de `ListGroup` en la web).
    private func hint(_ text: String) -> some View {
        Text(text).font(.apFootnote).foregroundStyle(Palette.muted)
            .fixedSize(horizontal: false, vertical: true)
            .padding(.horizontal, 4)
            .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var divider: some View {
        Rectangle().fill(Palette.separator).frame(height: 0.5).padding(.leading, 16)
    }

    /// Filas pegadas en un grupo sin borde, con la profundidad de las tarjetas.
    private func group<Content: View>(@ViewBuilder _ content: () -> Content) -> some View {
        VStack(spacing: 0) { content() }
            .frame(maxWidth: .infinity, alignment: .leading)
            .surface()
    }

    /// Sección con su título en Title 3 (solo la primera letra en mayúscula), como el resto de la app.
    private func section<Content: View>(_ title: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionTitle(title: title)
            content()
        }
    }

    /// Criterio con su explicación debajo e interruptor a la derecha (la fila crece con la letra).
    private func toggle(_ label: String, _ detail: String, _ key: WritableKeyPath<AdminExercisesView.Exercise, Bool?>) -> some View {
        // Sin valor cuenta como activado, como en la web y en la base de datos (por defecto, sí).
        Toggle(isOn: Binding(get: { exercise[keyPath: key] ?? true }, set: { exercise[keyPath: key] = $0; Haptics.selection() })) {
            VStack(alignment: .leading, spacing: 2) {
                Text(label).font(.apBody).foregroundStyle(Palette.foreground)
                Text(detail).font(.apFootnote).foregroundStyle(Palette.muted)
            }
            .fixedSize(horizontal: false, vertical: true)
        }
        .toggleStyle(TrailingSwitchStyle())
        .tint(Palette.gold)
        .padding(.horizontal, 16).padding(.vertical, 10)
        .frame(minHeight: 56)
    }

    private func picker(_ label: String, _ key: WritableKeyPath<AdminExercisesView.Exercise, String?>, _ options: [String]) -> some View {
        AdminPickerRow(label: label,
                       selection: Binding(get: { exercise[keyPath: key] ?? "" }, set: { exercise[keyPath: key] = $0.isEmpty ? nil : $0 }),
                       options: [AdminOption(value: "", label: "—")] + options.map { AdminOption(value: $0, label: $0) })
    }

    private func intPicker(_ label: String, _ key: WritableKeyPath<AdminExercisesView.Exercise, Int?>, _ options: [(Int, String)]) -> some View {
        AdminPickerRow(label: label,
                       selection: Binding(get: { exercise[keyPath: key] ?? 0 }, set: { exercise[keyPath: key] = $0 == 0 ? nil : $0 }),
                       options: [AdminOption(value: 0, label: "—")] + options.map { AdminOption(value: $0.0, label: $0.1) })
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
        } catch { self.error = "No se pudo guardar el ejercicio. Vuelve a intentarlo." }
    }

    private func upload(_ p: PhotosPickerItem?) async {
        guard let p, let data = try? await p.loadTransferable(type: Data.self), let img = PlatformImage(data: data), let jpg = img.jpegData() else { return }
        busy = "Subiendo imagen…"; defer { busy = nil }
        let path = "exercises/\(exercise.id.isEmpty ? UUID().uuidString : exercise.id)-\(Int(Date().timeIntervalSince1970)).jpg"
        do {
            try await Backend.client.storage.from("site-assets").upload(path, data: jpg, options: FileOptions(contentType: "image/jpeg", upsert: true))
            exercise.image_url = try Backend.client.storage.from("site-assets").getPublicURL(path: path).absoluteString
        } catch { self.error = "No se pudo subir la imagen. Vuelve a intentarlo." }
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
        } catch { self.error = "No se pudo generar con IA. Vuelve a intentarlo en unos minutos." }
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
        } else { error = "No se pudo clasificar. Vuelve a intentarlo o rellena los campos a mano." }
    }
}

extension AdminExercisesView.Exercise {
    enum CodingKeys: String, CodingKey {
        case id, name, muscle_group, image_url, video_url, exercise_type, movement_pattern, level, priority, stimulus_type, load_level,
             fatigue_level, recommended_order, alternative_id, skill_tag, progression_order, is_stable, is_progressable, high_tension, tracking_mode
    }
}
