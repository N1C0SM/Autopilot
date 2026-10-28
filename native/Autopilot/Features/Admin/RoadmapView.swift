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
    @State private var proposals: [Proposal] = []
    @State private var versionEdit: Version?
    @State private var aiHelp: Item?
    struct Proposal: Codable, Identifiable, Hashable { let id: String; var title: String?; var version_id: String?; let reason: String?; let effort: String?; let status: String?; let evidence: String? }

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
                AdminLoadingView(message: "Cargando el Roadmap")
                    .frame(maxHeight: .infinity)
            } else if failed {
                AdminErrorCard(message: "No se pudo cargar el Roadmap. Comprueba la conexión y vuelve a intentarlo.") {
                    Task { await load() }
                }
                .padding(20)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                ScrollView {
                    VStack(alignment: .leading, spacing: 24) {
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
        .refreshable { await load() }
        .onReceive(NotificationCenter.default.publisher(for: .refreshSection)) { _ in Task { await load() } }
        .sheet(item: $editing) { item in TaskEditor(item: item, versions: versions, isNew: creating) { saved in Task { await save(saved) } } }
        .confirmationDialog("Eliminar tarea", isPresented: Binding(get: { deleting != nil }, set: { if !$0 { deleting = nil } }), titleVisibility: .visible) {
            Button("Eliminar", role: .destructive) { if let d = deleting { Task { await delete(d) } } }
            Button("Cancelar", role: .cancel) {}
        } message: { Text("¿Eliminar «\(deleting?.title ?? "")»? No se puede deshacer.") }
        .sheet(item: $proofFor) { item in proofSheet(item) }
        .sheet(isPresented: Binding(get: { !proposals.isEmpty }, set: { if !$0 { proposals = [] } })) { proposalsSheet }
        .sheet(item: $versionEdit) { v in versionSheet(v) }
        .sheet(item: $aiHelp) { item in
            VStack(alignment: .leading, spacing: 14) {
                Text("Implementar con ayuda de IA").font(.apTitle2)
                Text("La IA puede ayudarte a desarrollar esta tarea en Lovable. Algunas partes pueden requerir servicios externos o pruebas reales; el Roadmap no cambia ni publica la aplicación automáticamente.")
                    .font(.apSubhead).foregroundStyle(Palette.muted)
                Text(item.title).font(.apHeadline)
                Text(aiRequest(item)).font(.apFootnote).textSelection(.enabled)
                    .adminFieldBox(radius: 14)
                Button("Copiar petición") { copy(aiRequest(item)); show("Petición copiada para Lovable"); aiHelp = nil }.buttonStyle(.pill)
            }
            .padding(24).frame(minWidth: 420).screenBackground()
        }
        .overlay(alignment: .top) { ToastView(text: toast) }
        .onChange(of: ideas) { _, v in UserDefaults.standard.set(v, forKey: "roadmap-ideas") }
    }

    // MARK: Cabecera

    private var header: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                VStack(alignment: .leading, spacing: 6) {
                    Text("AUTOPILOT · DIRECCIÓN DE PRODUCTO").font(.apFootnote.weight(.semibold)).foregroundStyle(Palette.muted)
                        .lineLimit(1).minimumScaleFactor(0.7)
                    Label("Foco: v\(current?.id ?? "1.0")", systemImage: "scope").font(.apTitle1)
                        .labelStyle(GoldIconLabel())
                        .lineLimit(1).minimumScaleFactor(0.7)
                }
                Spacer()
                AdminIconButton(symbol: "arrow.clockwise", label: "Actualizar Roadmap", tint: Palette.foreground) {
                    Task { await load() }
                }
            }
            Text(current?.title ?? "").font(.apBody).foregroundStyle(Palette.muted)
            HStack(spacing: 14) {
                ProgressView(value: currentTasks.isEmpty ? 0 : Double(doneCount) / Double(currentTasks.count)).tint(Palette.gold)
                    .accessibilityLabel("Progreso de la versión \(current?.id ?? "")")
                    .accessibilityValue("\(doneCount) de \(currentTasks.count) tareas hechas")
                Text("\(doneCount)/\(currentTasks.count) hechos").font(.apFootnote.monospacedDigit())
                    .lineLimit(1).minimumScaleFactor(0.8)
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
                                .padding(.horizontal, 10).frame(minHeight: 44)
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
            .frame(maxWidth: .infinity, alignment: .leading)
            .overlay(alignment: .topTrailing) {
                if let active { Button { versionEdit = active } label: { Image(systemName: "pencil") }.buttonStyle(.plain).frame(width: 44, height: 44).accessibilityLabel("Editar versión") }
            }
            VStack(alignment: .leading, spacing: 10) {
                PillField(label: "Buscar tareas", text: $search)
                HStack(spacing: 10) {
                    Button { creating = true; editing = Item(id: "", title: "", description: "", version_id: selected == "ice" ? nil : selected, status: "idea", effort: "medium", evidence: "") } label: {
                        Label("Nueva tarea", systemImage: "plus")
                    }
                    .buttonStyle(PillButtonStyle(kind: .secondary)).frame(maxWidth: 180)
                    Button { Task { await classify(selectedTasks.filter { $0.status != "done" }) } } label: {
                        Label("Revisar con IA", systemImage: busy ? "hourglass" : "wand.and.stars")
                    }
                    .buttonStyle(PillButtonStyle(kind: .secondary)).frame(maxWidth: 220)
                    .disabled(busy || selectedTasks.allSatisfy { $0.status == "done" })
                }
            }
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 340), spacing: 12, alignment: .top)], spacing: 12) {
                ForEach(selectedTasks) { taskCard($0) }
            }
            if selectedTasks.isEmpty {
                EmptyStateView(symbol: "tray", title: "No hay tareas aquí",
                               message: "Crea una tarea o cambia de versión para ver las de otra.")
            }
        }
    }

    // MARK: Ideas

    private var ideasTab: some View {
        VStack(alignment: .leading, spacing: 16) {
            SectionTitle(title: "Lluvia de ideas", hint: "Una idea por línea. Después puedes ordenarlas con IA o guardarlas como tareas.")
            TextEditor(text: $ideas)
                .font(.apBody)
                .adminEditorBox(minHeight: 160)
                .overlay(alignment: .topLeading) {
                    if ideas.isEmpty {
                        Text("Una idea por línea…").font(.apBody).foregroundStyle(Palette.muted)
                            .padding(16).allowsHitTesting(false)
                    }
                }
                .accessibilityLabel("Lluvia de ideas")
            HStack(spacing: 8) {
                Button { Task { await captureIdeas() } } label: { Label("Guardar ideas", systemImage: "plus") }
                    .buttonStyle(.pill).frame(maxWidth: 260)
                    .disabled(busy || ideas.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                Button { Task { await classify(inbox) } } label: { Label("Ordenar con IA\(inbox.count > 25 ? " (25)" : "")", systemImage: "wand.and.stars") }
                    .buttonStyle(PillButtonStyle(kind: .secondary)).frame(maxWidth: 260)
                    .disabled(busy || inbox.isEmpty)
            }
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
            if inbox.isEmpty {
                EmptyStateView(symbol: "lightbulb", title: "Sin ideas pendientes",
                               message: "Escribe una idea por línea y pulsa Guardar ideas.")
            }
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
                    if let n = v.release_notes, !n.isEmpty {
                        Text(n).font(.apSubhead).foregroundStyle(Palette.muted)
                            .fixedSize(horizontal: false, vertical: true)
                    }
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
        Card(padding: 16) {
            HStack(alignment: .top, spacing: 8) {
                Button { changeStatus(item, item.status == "done" ? "idea" : "done") } label: {
                    Image(systemName: item.status == "done" ? "checkmark.circle.fill" : "circle")
                        .font(.inter(size: 22)).foregroundStyle(item.status == "done" ? Palette.gold : Palette.muted)
                        .frame(width: 44, height: 44)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Completar \(item.title)")
                .accessibilityAddTraits(item.status == "done" ? .isSelected : [])
                VStack(alignment: .leading, spacing: 4) {
                    Text(item.title).font(.apHeadline).strikethrough(item.status == "done")
                        .foregroundStyle(item.status == "done" ? Palette.muted : Palette.foreground)
                    if !item.description.isEmpty {
                        Text(item.description).font(.apSubhead).foregroundStyle(Palette.muted)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
                Spacer(minLength: 0)
                AdminIconButton(symbol: "pencil", label: "Editar \(item.title)", tint: Palette.muted) {
                    creating = false; editing = item
                }
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
                        Image(systemName: "chevron.up.chevron.down").font(.inter(.caption))
                    }
                    .font(.apSubhead)
                    .foregroundStyle(item.status == "done" ? Palette.gold : Palette.muted)
                    .padding(.horizontal, 14).frame(minHeight: 44)
                    .background((item.status == "done" ? Palette.gold.opacity(0.15) : Palette.secondary), in: Capsule())
                }
                .menuStyle(.button).buttonStyle(.plain)
                .accessibilityLabel("Estado de \(item.title)")
                Text("\(Self.effortLabels[item.effort] ?? item.effort)\(item.version_id.map { " · v\($0)" } ?? " · Hielo")")
                    .font(.apFootnote).foregroundStyle(Palette.muted)
                    .lineLimit(1).minimumScaleFactor(0.8)
                Spacer(minLength: 0)
                AdminIconButton(symbol: "trash", label: "Eliminar \(item.title)", tint: Palette.muted) {
                    deleting = item
                }
            }
            if item.status != "done" {
                AdminTextButton(title: "Ayuda de IA", systemImage: "wand.and.stars") { aiHelp = item }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func aiRequest(_ item: Item) -> String {
        "Revisa si ya existe «\(item.title)» en Autopilot. Si falta, impleméntalo y pruébalo sin ampliar el alcance. Versión: \(item.version_id ?? "Hielo"). Detalles: \(item.description). Marca Hecho solo con evidencia verificable y avisa si está fuera del foco actual."
    }

    private func copy(_ text: String) {
        #if os(iOS)
        UIPasteboard.general.string = text
        #else
        NSPasteboard.general.clearContents(); NSPasteboard.general.setString(text, forType: .string)
        #endif
    }

    private func classify(_ target: [Item]) async {
        guard !target.isEmpty else { return }
        busy = true; defer { busy = false }
        struct R: Decodable { let proposals: [Proposal]?; let error: String? }
        do {
            let r: R = try await Backend.client.functions.invoke("roadmap-ai", options: FunctionInvokeOptions(body: ["item_ids": Array(target.prefix(25).map(\.id))]))
            if let e = r.error { show(e) } else { proposals = r.proposals ?? [] }
        } catch { show("No se pudo ordenar con IA. Tus ideas siguen guardadas.") }
    }

    private func applyProposals() async {
        struct Patch: Encodable { let title: String?; let version_id: String?; let status: String?; let evidence: String; let effort: String?; let ai_reason: String? }
        for p in proposals {
            let title = p.title?.trimmingCharacters(in: .whitespaces)
            let ev = (p.evidence ?? "").isEmpty ? (items.first { $0.id == p.id }?.evidence ?? "") : (p.evidence ?? "")
            _ = try? await Backend.client.from("roadmap_items")
                .update(Patch(title: title?.isEmpty == false ? String(title!.prefix(80)) : nil, version_id: p.version_id, status: p.status, evidence: ev, effort: p.effort, ai_reason: p.reason))
                .eq("id", value: p.id).execute()
        }
        proposals = []
        show("Propuestas aplicadas")
        await load()
    }

    private var proposalsSheet: some View {
        NavigationStack {
            List {
                Section { Text("La IA propone; tú decides qué se guarda.").foregroundStyle(Palette.muted) }
                ForEach($proposals) { $p in
                    VStack(alignment: .leading, spacing: 6) {
                        TextField("Título", text: Binding(get: { p.title ?? "" }, set: { p.title = $0 })).font(.apHeadline)
                        if let original = items.first(where: { $0.id == p.id })?.title, original != p.title {
                            Text("Escrito por ti: \(original)").font(.apFootnote).foregroundStyle(Palette.muted)
                        }
                        Picker("Destino", selection: Binding(get: { p.version_id ?? "ice" }, set: { p.version_id = $0 == "ice" ? nil : $0 })) {
                            Text("Hielo").tag("ice")
                            ForEach(versions) { v in Text("v\(v.id) · \(v.title)").tag(v.id) }
                        }
                        if let r = p.reason { Text(r).font(.apSubhead).foregroundStyle(Palette.muted) }
                        if let e = p.evidence, !e.isEmpty { Text("Ya implementado · \(e)").font(.apFootnote).foregroundStyle(Palette.gold) }
                        Button("Descartar propuesta") { proposals.removeAll { $0.id == p.id } }.font(.apFootnote)
                    }
                }
            }
            .navigationTitle("Propuesta de orden")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cerrar") { proposals = [] } }
                ToolbarItem(placement: .confirmationAction) { Button("Aplicar (\(proposals.count))") { Task { await applyProposals() } } }
            }
        }
        .frame(minWidth: 560, minHeight: 600)
        .tint(Palette.gold)
    }

    private func versionSheet(_ v: Version) -> some View {
        VersionEditor(version: v, isCurrent: v.is_current == true) { msg in
            versionEdit = nil
            if let msg { show(msg); Task { await load() } }
        }
    }

    private func proofSheet(_ item: Item) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("¿Cómo sabes que está hecho?").font(.apTitle2)
            Text("«\(item.title)» no tiene prueba en el código. Escribe qué lo demuestra (p. ej. «compra real probada el 18/10»). Se mostrará como confirmado por ti, no como verificado.")
                .font(.apSubhead).foregroundStyle(Palette.muted)
            TextEditor(text: $proofText)
                .adminFieldBox(minHeight: 100, radius: 14)
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


/// Editar versión: nombre, objetivo, etapa, notas y «Establecer como actual».
struct VersionEditor: View {
    @State var version: RoadmapView.Version
    let isCurrent: Bool
    var onDone: (String?) -> Void
    @State private var saving = false

    var body: some View {
        NavigationStack {
            Form {
                Section("Nombre") { TextField("Nombre", text: $version.title) }
                Section("Objetivo") { TextEditor(text: Binding(get: { version.objective ?? "" }, set: { version.objective = $0 })).frame(minHeight: 80) }
                Section {
                    Picker("Etapa de lanzamiento", selection: Binding(get: { version.release_stage ?? "internal" }, set: { version.release_stage = $0 })) {
                        Text("Desarrollo interno").tag("internal"); Text("Beta").tag("beta"); Text("Candidata de lanzamiento").tag("rc"); Text("Publicada").tag("released")
                    }
                }
                Section("Notas de versión") { TextEditor(text: Binding(get: { version.release_notes ?? "" }, set: { version.release_notes = $0 })).frame(minHeight: 100) }
                if !isCurrent {
                    Section {
                        Button { Task {
                            do { try await Backend.client.rpc("roadmap_set_current", params: ["target": version.id]).execute(); onDone("Foco actualizado") }
                            catch { onDone("No se pudo cambiar el foco") }
                        } } label: { Label("Establecer como actual", systemImage: "scope") }
                    }
                }
            }
            .formStyle(.grouped)
            .navigationTitle("Versión \(version.id)")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancelar") { onDone(nil) } }
                ToolbarItem(placement: .confirmationAction) { Button("Guardar versión") { Task { await save() } }.disabled(version.title.trimmingCharacters(in: .whitespaces).isEmpty || saving) }
            }
        }
        .frame(minWidth: 480, minHeight: 560)
        .tint(Palette.gold)
    }

    private func save() async {
        saving = true; defer { saving = false }
        struct U: Encodable { let title: String; let objective: String?; let release_stage: String?; let release_notes: String?; let updated_at: String }
        do {
            try await Backend.client.from("roadmap_versions")
                .update(U(title: version.title, objective: version.objective, release_stage: version.release_stage, release_notes: version.release_notes, updated_at: ISO8601DateFormatter().string(from: Date())))
                .eq("id", value: version.id).execute()
            onDone("Versión guardada")
        } catch { onDone("No se pudo guardar") }
    }
}
