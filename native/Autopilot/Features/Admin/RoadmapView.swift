import SwiftUI
import Supabase

/// Roadmap de Admin, calcado de `RoadmapAdmin.tsx`: cabecera «Foco: vX» con progreso,
/// pestañas Versiones · Ideas · Historial, tarjetas de tarea con estado, editar y eliminar.
/// «Hecho» sin prueba en el código pide una prueba escrita, como en la web.
struct RoadmapView: View {
    struct Version: Codable, Identifiable, Hashable {
        let id: String; var title: String; var objective: String?; let phase: Int?; let position: Int?
        var is_current: Bool?; var release_stage: String?; var release_notes: String?
    }
    struct Item: Codable, Identifiable, Hashable {
        let id: String; var title: String; var description: String; var version_id: String?
        var status: String; var effort: String; var evidence: String; var ai_reason: String?; var position: Int?
    }

    @State private var versions: [Version] = []
    @State private var items: [Item] = []
    @State private var loading = true
    @State private var failed = false
    @State private var busy = false
    @State private var tab = 0
    @State private var selected = "1.0"
    @State private var search = ""
    @State private var ideas = UserDefaults.standard.string(forKey: "roadmap-ideas") ?? ""
    @State private var editing: Item?
    @State private var creating = false
    @State private var deleting: Item?
    @State private var proofFor: Item?
    @State private var proofText = ""
    @State private var toast: String?

    private static let phaseNames = ["Lanzamiento y día a día", "Inteligencia y adaptación", "Análisis físico y visión", "Ecosistema y comunidad"]
    private static let statusLabels = [("idea", "Idea", "No realizado"), ("pending", "Pendiente", "En proceso"), ("done", "Hecho", "Finalizado")]
    private static let effortLabels = ["small": "Rápido", "medium": "Medio", "large": "Grande"]

    private var current: Version? { versions.first { $0.is_current == true } }
    private var currentTasks: [Item] { items.filter { $0.version_id == current?.id } }
    private var doneCount: Int { currentTasks.filter { $0.status == "done" }.count }
    private var inbox: [Item] { items.filter { $0.status == "idea" } }
    private var selectedTasks: [Item] {
        items.filter { (selected == "ice" ? $0.version_id == nil : $0.version_id == selected) &&
            (search.isEmpty || "\($0.title) \($0.description)".localizedCaseInsensitiveContains(search)) }
    }

    var body: some View {
        Group {
            if loading {
                ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if failed {
                VStack(spacing: 14) {
                    Text("No se pudo cargar el Roadmap.")
                    Button { Task { await load() } } label: { Label("Reintentar", systemImage: "arrow.clockwise") }.buttonStyle(.pill).frame(maxWidth: 240)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                ScrollView {
                    VStack(alignment: .leading, spacing: 28) {
                        header
                        SegmentedPill(options: ["Versiones", "Ideas (\(inbox.count))", "Historial"], selection: $tab).frame(maxWidth: 520)
                        switch tab {
                        case 0: versionsTab
                        case 1: ideasTab
                        default: historyTab
                        }
                    }
                    .padding(20)
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
        }
        .screenBackground()
        .task { await load() }
        .onReceive(NotificationCenter.default.publisher(for: .refreshSection)) { _ in Task { await load() } }
        .sheet(item: $editing) { item in TaskEditor(item: item, versions: versions, isNew: creating) { saved in Task { await save(saved) } } }
        .confirmationDialog("Eliminar tarea", isPresented: Binding(get: { deleting != nil }, set: { if !$0 { deleting = nil } }), titleVisibility: .visible) {
            Button("Eliminar", role: .destructive) { if let d = deleting { Task { await delete(d) } } }
            Button("Cancelar", role: .cancel) {}
        } message: { Text("¿Eliminar «\(deleting?.title ?? "")»? No se puede deshacer.") }
        .sheet(item: $proofFor) { item in proofSheet(item) }
        .overlay(alignment: .top) {
            if let toast {
                Text(toast).font(.apSubhead.weight(.semibold)).padding(.horizontal, 16).padding(.vertical, 10)
                    .background(.ultraThinMaterial, in: Capsule()).padding(.top, 8)
            }
        }
        .animation(.easeOut(duration: 0.2), value: toast)
        .onChange(of: ideas) { _, v in UserDefaults.standard.set(v, forKey: "roadmap-ideas") }
    }

    // MARK: Cabecera

    private var header: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                VStack(alignment: .leading, spacing: 6) {
                    Text("AUTOPILOT · DIRECCIÓN DE PRODUCTO").font(.apFootnote.weight(.semibold)).foregroundStyle(Palette.muted)
                    Label("Foco: v\(current?.id ?? "1.0")", systemImage: "scope").font(.apTitle1)
                        .labelStyle(GoldIconLabel())
                }
                Spacer()
                Button { Task { await load() } } label: { Image(systemName: "arrow.clockwise").font(.title3) }
                    .buttonStyle(.plain).frame(width: 44, height: 44).accessibilityLabel("Actualizar Roadmap")
            }
            Text(current?.title ?? "").font(.apBody).foregroundStyle(Palette.muted)
            HStack(spacing: 14) {
                ProgressView(value: currentTasks.isEmpty ? 0 : Double(doneCount) / Double(currentTasks.count)).tint(Palette.gold)
                Text("\(doneCount)/\(currentTasks.count) hechos").font(.apFootnote.monospacedDigit())
            }
            .frame(maxWidth: 520)
            .padding(.top, 8)
            let future = items.filter { $0.status == "pending" && $0.version_id != current?.id }
            if !future.isEmpty {
                Label("\(future.count) tareas fuera del foco están en curso. Prioridad ahora: v\(current?.id ?? ""), \(currentTasks.first { $0.status != "done" }?.title ?? "validar esta versión").",
                      systemImage: "scope")
                    .font(.apSubhead).foregroundStyle(Palette.gold).padding(.top, 6)
            }
        }
        .padding(.bottom, 20)
        .overlay(alignment: .bottom) { Rectangle().fill(Palette.separator).frame(height: 0.5) }
    }

    // MARK: Versiones

    private var versionsTab: some View {
        ViewThatFits(in: .horizontal) {
            HStack(alignment: .top, spacing: 24) {
                versionNav.frame(width: 240)
                versionDetail.frame(minWidth: 560)
            }
            VStack(alignment: .leading, spacing: 16) {
                Picker("Versión", selection: $selected) {
                    ForEach(versions) { v in Text("v\(v.id) · \(v.title)\(v.is_current == true ? " · Actual" : "")").tag(v.id) }
                    Text("Ideas en hielo").tag("ice")
                }
                .pickerStyle(.menu).tint(Palette.gold)
                versionDetail
            }
        }
    }

    private var versionNav: some View {
        VStack(alignment: .leading, spacing: 14) {
            ForEach(1...4, id: \.self) { phase in
                VStack(alignment: .leading, spacing: 6) {
                    Text("\(phase) · \(Self.phaseNames[phase - 1])").font(.apFootnote).foregroundStyle(Palette.muted)
                    LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 4) {
                        ForEach(versions.filter { $0.phase == phase }) { v in
                            Button { selected = v.id; Haptics.selection() } label: {
                                HStack(spacing: 4) {
                                    Text(v.id).font(.apSubhead.monospacedDigit())
                                    if v.is_current == true { Circle().fill(Palette.gold).frame(width: 6, height: 6) }
                                    Spacer(minLength: 0)
                                }
                                .padding(.horizontal, 10).frame(minHeight: 34)
                                .foregroundStyle(selected == v.id ? Palette.gold : Palette.foreground)
                                .background(selected == v.id ? Palette.gold.opacity(0.15) : .clear, in: Capsule())
                                .contentShape(Capsule())
                            }
                            .buttonStyle(.plain)
                            .accessibilityLabel("Ver versión \(v.id)")
                        }
                    }
                }
            }
            Button { selected = "ice" } label: { Label("Ideas en hielo", systemImage: "archivebox") }
                .buttonStyle(.plain).foregroundStyle(selected == "ice" ? Palette.gold : Palette.foreground).frame(minHeight: 36)
        }
        .padding(.trailing, 16)
        .overlay(alignment: .trailing) { Rectangle().fill(Palette.separator).frame(width: 0.5) }
    }

    private var versionDetail: some View {
        let active = versions.first { $0.id == selected }
        return VStack(alignment: .leading, spacing: 16) {
            VStack(alignment: .leading, spacing: 4) {
                Text(selected == current?.id ? "VERSIÓN ACTUAL" : selected == "ice" ? "SIN FECHA" : "POR DELANTE")
                    .font(.apFootnote).foregroundStyle(Palette.gold)
                Text(selected == "ice" ? "Hielo" : "v\(selected) · \(active?.title ?? "")").font(.apTitle2)
                if let o = active?.objective { Text(o).font(.apSubhead).foregroundStyle(Palette.muted) }
            }
            HStack(spacing: 8) {
                PillField(label: "Buscar tareas", text: $search)
                Button { creating = true; editing = Item(id: "", title: "", description: "", version_id: selected == "ice" ? nil : selected, status: "idea", effort: "medium", evidence: "") } label: {
                    Label("Tarea", systemImage: "plus")
                }
                .buttonStyle(PillButtonStyle(kind: .secondary)).frame(width: 130)
            }
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 340), spacing: 12, alignment: .top)], spacing: 12) {
                ForEach(selectedTasks) { taskCard($0) }
            }
            if selectedTasks.isEmpty { Text("No hay tareas aquí.").foregroundStyle(Palette.muted).frame(maxWidth: .infinity).padding(.vertical, 40) }
        }
    }

    // MARK: Ideas

    private var ideasTab: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Lluvia de ideas").font(.apTitle2)
            TextEditor(text: $ideas)
                .scrollContentBackground(.hidden)
                .font(.apBody)
                .padding(12)
                .frame(minHeight: 160)
                .background(Palette.card, in: RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
                .overlay(alignment: .topLeading) {
                    if ideas.isEmpty { Text("Una idea por línea…").foregroundStyle(Palette.muted).padding(18).allowsHitTesting(false) }
                }
                .accessibilityLabel("Lluvia de ideas")
            Button { Task { await captureIdeas() } } label: { Label("Guardar ideas", systemImage: "plus") }
                .buttonStyle(.pill).frame(maxWidth: 260)
                .disabled(busy || ideas.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            ForEach(versions.filter { v in inbox.contains { $0.version_id == v.id } }) { v in
                let group = inbox.filter { $0.version_id == v.id }
                VStack(alignment: .leading, spacing: 10) {
                    HStack(alignment: .firstTextBaseline, spacing: 8) {
                        Text("v\(v.id) · \(v.title)").font(.apHeadline)
                        if v.id == current?.id { Text("Versión actual").font(.apFootnote).foregroundStyle(Palette.gold) }
                        Text("\(group.count) idea\(group.count == 1 ? "" : "s")").font(.apFootnote).foregroundStyle(Palette.muted)
                    }
                    LazyVGrid(columns: [GridItem(.adaptive(minimum: 300), spacing: 12, alignment: .top)], spacing: 12) {
                        ForEach(group) { taskCard($0) }
                    }
                }
            }
            let ice = inbox.filter { i in i.version_id == nil || !versions.contains { $0.id == i.version_id } }
            if !ice.isEmpty {
                Text("Hielo · sin versión asignada").font(.apHeadline)
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 300), spacing: 12, alignment: .top)], spacing: 12) {
                    ForEach(ice) { taskCard($0) }
                }
            }
            if inbox.isEmpty { Text("Sin ideas pendientes de ordenar.").foregroundStyle(Palette.muted) }
        }
    }

    // MARK: Historial

    private var historyTab: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("Historial de versiones").font(.apTitle2).padding(.bottom, 12)
            ForEach(versions.filter { v in v.release_stage != "internal" || !(v.release_notes ?? "").isEmpty || items.contains { $0.version_id == v.id && $0.status == "done" } }) { v in
                VStack(alignment: .leading, spacing: 6) {
                    Text("v\(v.id) · \(v.title)").font(.apHeadline)
                    Text(["internal": "Desarrollo interno", "beta": "Beta", "rc": "Candidata", "released": "Publicada"][v.release_stage ?? "internal"] ?? "")
                        .font(.apFootnote).foregroundStyle(Palette.gold)
                    if let n = v.release_notes, !n.isEmpty { Text(n).font(.apSubhead).foregroundStyle(Palette.muted) }
                    ForEach(items.filter { $0.version_id == v.id && $0.status == "done" }) { i in
                        Label(i.title, systemImage: "checkmark").font(.apSubhead).labelStyle(GoldIconLabel())
                    }
                }
                .padding(.vertical, 16)
                .overlay(alignment: .bottom) { Rectangle().fill(Palette.separator).frame(height: 0.5) }
            }
        }
    }

    // MARK: Tarjeta de tarea

    private func taskCard(_ item: Item) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .top, spacing: 12) {
                Button { changeStatus(item, item.status == "done" ? "idea" : "done") } label: {
                    Image(systemName: item.status == "done" ? "checkmark.circle.fill" : "circle")
                        .font(.system(size: 22)).foregroundStyle(item.status == "done" ? Palette.gold : Palette.muted)
                }
                .buttonStyle(.plain).frame(width: 30, height: 30)
                .accessibilityLabel("Completar \(item.title)")
                VStack(alignment: .leading, spacing: 4) {
                    Text(item.title).font(.apHeadline).strikethrough(item.status == "done")
                        .foregroundStyle(item.status == "done" ? Palette.muted : Palette.foreground)
                    if !item.description.isEmpty { Text(item.description).font(.apSubhead).foregroundStyle(Palette.muted) }
                }
                Spacer(minLength: 0)
                Button { creating = false; editing = item } label: { Image(systemName: "pencil") }
                    .buttonStyle(.plain).frame(width: 36, height: 36).accessibilityLabel("Editar \(item.title)")
            }
            if !item.evidence.isEmpty {
                Label(item.evidence, systemImage: "checkmark").font(.apFootnote)
                    .foregroundStyle(item.evidence.hasPrefix("Confirmado por ti") ? Palette.muted : Palette.gold)
            }
            if let r = item.ai_reason, !r.isEmpty { Text(r).font(.apFootnote).foregroundStyle(Palette.muted) }
            HStack(spacing: 8) {
                Menu {
                    ForEach(Self.statusLabels, id: \.0) { key, label, meaning in
                        Button("\(label) · \(meaning)") { changeStatus(item, key) }
                    }
                } label: {
                    HStack(spacing: 6) {
                        Text(Self.statusLabels.first { $0.0 == item.status }?.1 ?? item.status)
                        Image(systemName: "chevron.up.chevron.down").font(.caption)
                    }
                    .font(.apSubhead).padding(.horizontal, 14).frame(minHeight: 36)
                    .background(Palette.secondary, in: Capsule())
                }
                .menuStyle(.button).buttonStyle(.plain)
                .accessibilityLabel("Estado de \(item.title)")
                Text("\(Self.effortLabels[item.effort] ?? item.effort)\(item.version_id.map { " · v\($0)" } ?? " · Hielo")")
                    .font(.apFootnote).foregroundStyle(Palette.muted)
                Spacer()
                Button { deleting = item } label: { Image(systemName: "trash") }
                    .buttonStyle(.plain).foregroundStyle(Palette.muted).frame(width: 36, height: 36)
                    .accessibilityLabel("Eliminar \(item.title)")
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Palette.card, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
    }

    private func proofSheet(_ item: Item) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("¿Cómo sabes que está hecho?").font(.apTitle2)
            Text("«\(item.title)» no tiene prueba en el código. Escribe qué lo demuestra (p. ej. «compra real probada el 18/10»). Se mostrará como confirmado por ti, no como verificado.")
                .font(.apSubhead).foregroundStyle(Palette.muted)
            TextEditor(text: $proofText).scrollContentBackground(.hidden).padding(10).frame(minHeight: 100)
                .background(Palette.secondary, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                .accessibilityLabel("Prueba de finalización")
            Button("Marcar como Hecho") {
                let proof = proofText.trimmingCharacters(in: .whitespacesAndNewlines)
                proofFor = nil
                Task { await update(item, status: "done", evidence: "Confirmado por ti · \(proof)") }
            }
            .buttonStyle(.pill)
            .disabled(proofText.trimmingCharacters(in: .whitespacesAndNewlines).count < 10)
        }
        .padding(24).frame(minWidth: 380)
        .presentationDetents([.medium])
        .screenBackground()
    }

    // MARK: Acciones

    private func changeStatus(_ item: Item, _ status: String) {
        Haptics.selection()
        // Lo verificado por el código (evidencia sin «Confirmado por ti») sigue como Hecho.
        if item.status == "done" && !item.evidence.isEmpty && !item.evidence.hasPrefix("Confirmado por ti") && status != "done" {
            show("El código demuestra que esta función ya existe; sigue como Hecho."); return
        }
        if status == "done" && item.evidence.isEmpty { proofText = ""; proofFor = item; return }
        Task { await update(item, status: status, evidence: status == "done" ? item.evidence : "") }
    }

    private func show(_ text: String) {
        toast = text
        Task { try? await Task.sleep(for: .seconds(2.5)); toast = nil }
    }

    private func load() async {
        do {
            async let v: [Version] = Backend.client.from("roadmap_versions").select().order("position").execute().value
            async let i: [Item] = Backend.client.from("roadmap_items").select().order("position").order("created_at").execute().value
            versions = try await v
            items = try await i
            if let c = versions.first(where: { $0.is_current == true }), !versions.contains(where: { $0.id == selected }) || selected == "1.0" { selected = c.id }
            failed = false
        } catch { failed = true }
        loading = false
    }

    private func update(_ item: Item, status: String, evidence: String) async {
        struct Patch: Encodable { let status: String; let evidence: String; let updated_at: String }
        do {
            try await Backend.client.from("roadmap_items")
                .update(Patch(status: status, evidence: evidence, updated_at: ISO8601DateFormatter().string(from: Date())))
                .eq("id", value: item.id).execute()
            if let i = items.firstIndex(where: { $0.id == item.id }) { items[i].status = status; items[i].evidence = evidence }
        } catch { show("No se pudo guardar. Tus cambios no se han aplicado.") }
    }

    private func save(_ draft: Item) async {
        struct Patch: Encodable { let title: String; let description: String; let version_id: String?; let effort: String; let status: String }
        struct Insert: Encodable { let title: String; let description: String; let version_id: String?; let effort: String; let status: String; let position: Int }
        let title = String(draft.title.trimmingCharacters(in: .whitespaces).prefix(250))
        guard !title.isEmpty else { return }
        do {
            if creating {
                let row: Item = try await Backend.client.from("roadmap_items")
                    .insert(Insert(title: title, description: draft.description, version_id: draft.version_id, effort: draft.effort, status: draft.status, position: items.count))
                    .select().single().execute().value
                items.append(row)
            } else {
                try await Backend.client.from("roadmap_items")
                    .update(Patch(title: title, description: draft.description, version_id: draft.version_id, effort: draft.effort, status: draft.status))
                    .eq("id", value: draft.id).execute()
                if let i = items.firstIndex(where: { $0.id == draft.id }) { items[i] = draft; items[i].title = title }
            }
            editing = nil
            show("Tarea guardada")
        } catch { show("No se pudo guardar. Tus cambios no se han aplicado.") }
    }

    private func delete(_ item: Item) async {
        do {
            try await Backend.client.from("roadmap_items").delete().eq("id", value: item.id).execute()
            items.removeAll { $0.id == item.id }
        } catch { show("No se pudo eliminar.") }
        deleting = nil
    }

    private func captureIdeas() async {
        busy = true; defer { busy = false }
        let lines = ideas.split(separator: "\n").map { $0.trimmingCharacters(in: CharacterSet(charactersIn: "-*• ").union(.whitespaces)) }.filter { !$0.isEmpty }
        let normalize = { (s: String) in s.folding(options: [.diacriticInsensitive, .caseInsensitive], locale: Locale(identifier: "es")).filter { $0.isLetter || $0.isNumber } }
        let existing = Set(items.map { normalize($0.title) })
        let unique = Array(Set(lines.filter { !existing.contains(normalize($0)) }))
        guard !unique.isEmpty else { show("Estas ideas ya están en el Roadmap."); return }
        struct Insert: Encodable { let title: String; let description: String; let status: String; let source: String; let position: Int }
        do {
            let rows: [Item] = try await Backend.client.from("roadmap_items")
                .insert(unique.enumerated().map { Insert(title: String($1.prefix(250)), description: $1.count > 250 ? $1 : "", status: "idea", source: "brainstorm", position: items.count + $0) })
                .select().execute().value
            items.append(contentsOf: rows)
            ideas = ""
            show("Ideas guardadas")
        } catch { show("No se pudo guardar. Tus ideas siguen aquí.") }
    }
}

/// Editor de tarea (diálogo «Nueva tarea» / «Editar tarea» de la web).
struct TaskEditor: View {
    @State var item: RoadmapView.Item
    let versions: [RoadmapView.Version]
    let isNew: Bool
    var onSave: (RoadmapView.Item) -> Void
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            Form {
                Section("Título") { TextField("Título", text: $item.title) }
                Section("Detalles") { TextEditor(text: $item.description).frame(minHeight: 90) }
                Section {
                    Picker("Versión", selection: Binding(get: { item.version_id ?? "ice" }, set: { item.version_id = $0 == "ice" ? nil : $0 })) {
                        Text("Hielo").tag("ice")
                        ForEach(versions) { v in Text("v\(v.id) · \(v.title)").tag(v.id) }
                    }
                    Picker("Esfuerzo", selection: $item.effort) {
                        Text("Rápido").tag("small"); Text("Medio").tag("medium"); Text("Grande").tag("large")
                    }
                }
            }
            .formStyle(.grouped)
            .navigationTitle(isNew ? "Nueva tarea" : "Editar tarea")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancelar") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Guardar tarea") { onSave(item) }.disabled(item.title.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
        }
        .frame(minWidth: 460, minHeight: 440)
        .tint(Palette.gold)
    }
}

/// Etiqueta con el icono en dorado.
struct GoldIconLabel: LabelStyle {
    func makeBody(configuration: Configuration) -> some View {
        HStack(spacing: 8) {
            configuration.icon.foregroundStyle(Palette.gold)
            configuration.title
        }
    }
}
