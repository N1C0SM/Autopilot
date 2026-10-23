import SwiftUI
import PhotosUI
import Supabase

/// Físicos, calcado de `GoalPhysiquesEditor.tsx`: físicos de referencia del AI Scan con foto,
/// nombre y visibilidad. Las fotos van al bucket público `site-assets/goal-physiques/`.
struct AdminPhysiquesView: View {
    struct Physique: Codable, Identifiable, Hashable { let id: String; var name: String; var image_url: String; var sort_order: Int; var visible: Bool }

    @State private var items: [Physique] = []
    @State private var loading = true
    @State private var editing: Physique?
    @State private var toast: String?

    var body: some View {
        ScrollView {
            if loading { ProgressView().frame(maxWidth: .infinity).padding(.top, 60) } else {
                VStack(alignment: .leading, spacing: 20) {
                    Text("Físicos de referencia que verán los usuarios en el AI Scan. Pueden elegir uno como objetivo en vez de subir su propia foto.")
                        .font(.apSubhead).foregroundStyle(Palette.muted)
                    Button("Añadir físico") { Task { await add() } }.buttonStyle(.pill).frame(maxWidth: 260)
                    if items.isEmpty {
                        EmptyStateView(symbol: "target", title: "Aún no hay físicos", message: "Añade el primero con una foto y un nombre.")
                    } else {
                        VStack(spacing: 0) {
                            ForEach(Array(items.enumerated()), id: \.element.id) { i, it in
                                Button { editing = it } label: {
                                    HStack(spacing: 12) {
                                        PhysiqueImage(url: it.image_url).frame(width: 56, height: 56)
                                            .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                                        Text(it.name.trimmingCharacters(in: .whitespaces).isEmpty ? "Sin nombre" : it.name).font(.apBody)
                                        Spacer()
                                        Text(it.visible ? "Visible" : "Oculto").font(.apBody).foregroundStyle(Palette.muted)
                                        Image(systemName: "chevron.right").font(.footnote.weight(.semibold)).foregroundStyle(Palette.muted)
                                    }
                                    .padding(.horizontal, 16).padding(.vertical, 8)
                                    .overlay(alignment: .top) { if i > 0 { Rectangle().fill(Palette.separator).frame(height: 0.5).padding(.leading, 84) } }
                                    .contentShape(Rectangle())
                                }
                                .buttonStyle(.plain)
                            }
                        }
                        .background(Palette.card, in: RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
                    }
                }
                .padding(20).frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .screenBackground()
        .overlay(alignment: .top) { ToastView(text: toast) }
        .task { await load() }
        .sheet(item: $editing) { it in
            PhysiqueEditor(item: it) { saved in
                if let saved, let i = items.firstIndex(where: { $0.id == saved.id }) { items[i] = saved; show("Guardado") }
                editing = nil
            } onDelete: {
                items.removeAll { $0.id == it.id }
                editing = nil
            }
        }
    }

    private func load() async {
        items = (try? await Backend.client.from("goal_physiques").select("id, name, image_url, sort_order, visible").order("sort_order").execute().value) ?? []
        loading = false
    }

    private func add() async {
        Haptics.tap()
        struct Insert: Encodable { let name: String; let image_url: String; let sort_order: Int; let visible: Bool }
        do {
            let created: Physique = try await Backend.client.from("goal_physiques")
                .insert(Insert(name: "Nuevo físico", image_url: "", sort_order: items.count, visible: true))
                .select("id, name, image_url, sort_order, visible").single().execute().value
            items.append(created)
            editing = created
        } catch { show("No se pudo crear") }
    }

    private func show(_ t: String) { toast = t; Task { try? await Task.sleep(for: .seconds(2.5)); toast = nil } }
}

/// Foto con hueco gris de respaldo, nunca imagen rota.
struct PhysiqueImage: View {
    let url: String
    var body: some View {
        ZStack {
            Palette.secondary
            if let u = URL(string: url), !url.isEmpty {
                AsyncImage(url: u) { phase in
                    if let image = phase.image { image.resizable().scaledToFill() } else { placeholder }
                }
            } else { placeholder }
        }
        .accessibilityHidden(true)
    }
    private var placeholder: some View {
        Image(systemName: "person.fill").resizable().scaledToFit().padding(14).foregroundStyle(Palette.muted.opacity(0.6))
    }
}

struct PhysiqueEditor: View {
    @State var item: AdminPhysiquesView.Physique
    var onDone: (AdminPhysiquesView.Physique?) -> Void
    var onDelete: () -> Void
    @State private var photo: PhotosPickerItem?
    @State private var uploading = false
    @State private var confirmDelete = false

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    PhysiqueImage(url: item.image_url).frame(width: 144, height: 192)
                        .clipShape(RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
                        .frame(maxWidth: .infinity)
                    PhotosPicker(selection: $photo, matching: .images) {
                        HStack { Text(item.image_url.isEmpty ? "Subir foto" : "Cambiar foto").foregroundStyle(Palette.gold); Spacer(); if uploading { ProgressView() } }
                    }
                    .disabled(uploading)
                }
                Section("Nombre") { TextField("Físico de referencia", text: $item.name) }
                Section { Toggle("Visible", isOn: $item.visible).tint(Palette.gold) } footer: {
                    Text("Si lo ocultas, los usuarios no lo verán en el AI Scan.")
                }
                Section {
                    Button("Eliminar físico", role: .destructive) { confirmDelete = true }
                }
            }
            .formStyle(.grouped)
            .navigationTitle("Físico objetivo")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancelar") { onDone(nil) } }
                ToolbarItem(placement: .confirmationAction) { Button("Guardar") { Task { await save() } } }
            }
        }
        .frame(minWidth: 420, minHeight: 560)
        .tint(Palette.gold)
        .onChange(of: photo) { _, p in Task { await upload(p) } }
        .confirmationDialog("Eliminar físico", isPresented: $confirmDelete, titleVisibility: .visible) {
            Button("Eliminar", role: .destructive) {
                Task { _ = try? await Backend.client.from("goal_physiques").delete().eq("id", value: item.id).execute(); onDelete() }
            }
            Button("Cancelar", role: .cancel) {}
        } message: { Text("Se quitará \(item.name.isEmpty ? "este físico" : item.name) de los físicos de referencia. Esta acción no se puede deshacer.") }
    }

    private func upload(_ p: PhotosPickerItem?) async {
        guard let p, let data = try? await p.loadTransferable(type: Data.self), let img = PlatformImage(data: data), let jpg = img.jpegData() else { return }
        uploading = true; defer { uploading = false }
        let path = "goal-physiques/\(Int(Date().timeIntervalSince1970 * 1000)).jpg"
        do {
            try await Backend.client.storage.from("site-assets").upload(path, data: jpg, options: FileOptions(contentType: "image/jpeg"))
            let url = try Backend.client.storage.from("site-assets").getPublicURL(path: path).absoluteString
            item.image_url = url
            _ = try? await Backend.client.from("goal_physiques").update(["image_url": url]).eq("id", value: item.id).execute()
        } catch {}
    }

    private func save() async {
        struct U: Encodable { let name: String; let image_url: String; let visible: Bool }
        do {
            try await Backend.client.from("goal_physiques").update(U(name: item.name, image_url: item.image_url, visible: item.visible)).eq("id", value: item.id).execute()
            Haptics.success(); onDone(item)
        } catch { Haptics.error() }
    }
}
