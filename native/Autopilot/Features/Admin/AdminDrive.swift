import SwiftUI
import PhotosUI
import UniformTypeIdentifiers
import AVFoundation
import Supabase

/// Drive · Libros, calcado de `LibraryDrive.tsx`: ruta de carpetas, «Nuevo» (carpeta, libro, pack, vídeo, archivo),
/// lista con portada y estado, y ficha (portada, archivo de cualquier tipo, precio, libros del pack, enlace de 1 descarga, publicar).
struct AdminDriveView: View {
    struct Book: Codable, Identifiable, Hashable {
        let id: String; var title: String; var description: String?; var price: String?; var buy_url: String?
        var buy_url_test: String?; var buy_url_live: String?; var video_url: String?; var kind: String?; var folder: String
        var cover_path: String?; var file_path: String?; var is_pack: Bool?; var is_folder: Bool?; var parent_id: String?
        var published: Bool; var sort_order: Int?; var pack_items: [String]?
        var resolvedKind: String { kind ?? (is_pack == true ? "pack" : is_folder == true ? "folder" : "book") }
    }
    static let kindLabel = ["folder": "Carpeta", "book": "Libro", "pack": "Pack", "video": "Vídeo", "recommendation": "Recomendación", "file": "Archivo"]
    static let kindSymbol = ["folder": "folder", "book": "book.closed", "pack": "shippingbox", "video": "play.rectangle", "recommendation": "star", "file": "doc"]

    private static let imageExt = ["jpg", "jpeg", "png", "webp", "gif", "avif", "heic", "heif", "bmp", "svg"]
    private static let videoExt = ["mp4", "mov", "m4v", "webm", "ogv", "avi", "mkv"]
    private static let audioExt = ["mp3", "m4a", "wav", "aac", "ogg", "flac"]

    private static func ext(_ path: String) -> String {
        (path as NSString).pathExtension.lowercased()
    }

    /// Etiqueta corta del tipo de archivo ("Imagen", "Vídeo", "PDF", "ZIP"…).
    static func mediaLabel(_ path: String?) -> String {
        guard let path, !path.isEmpty else { return "Archivo" }
        let e = ext(path)
        if imageExt.contains(e) { return "Imagen" }
        if videoExt.contains(e) { return "Vídeo" }
        if audioExt.contains(e) { return "Audio" }
        if e == "pdf" { return "PDF" }
        return e.isEmpty ? "Archivo" : e.uppercased()
    }

    static func isImage(_ path: String?) -> Bool {
        guard let path else { return false }
        return imageExt.contains(ext(path))
    }

    static func isVideo(_ path: String?) -> Bool {
        guard let path else { return false }
        return videoExt.contains(ext(path))
    }

    @State private var books: [Book] = []
    @State private var covers: [String: String] = [:]
    /// URLs firmadas de los vídeos subidos, para sacar su miniatura.
    @State private var videoThumbs: [String: String] = [:]
    @State private var path: [(id: String, title: String)] = []
    @State private var loading = true
    @State private var failed = false
    @State private var open: Book?
    @State private var renaming: Book?
    @State private var newName = ""
    @State private var toast: String?
    @State private var confirmDeleteAll = false

    private var parentId: String? { path.last?.id }
    private var items: [Book] { books.filter { $0.parent_id == parentId } }

    var body: some View {
        ScrollView {
            if loading {
                AdminLoadingView(message: "Cargando el Drive")
            } else if failed {
                AdminErrorCard(message: "No se pudo cargar el Drive. Comprueba la conexión y vuelve a intentarlo.") {
                    Task { await load() }
                }
                .padding(20)
            } else {
                VStack(alignment: .leading, spacing: 24) {
                    AdminPaneHeader("Todo tu contenido en un solo sitio: carpetas, libros, packs, vídeos y archivos de cualquier tipo. Nada se ve fuera hasta que tú lo publicas.") {
                        HStack(spacing: 12) {
                            breadcrumb
                            Spacer(minLength: 0)
                            if !items.isEmpty { moreMenu }
                            newMenu
                        }
                    }
                    if items.isEmpty {
                        EmptyStateView(symbol: "folder", title: path.isEmpty ? "El Drive está vacío" : "Esta carpeta está vacía",
                                       message: "Pulsa «Nuevo» para crear una carpeta, un libro, un pack, un vídeo o un archivo.")
                    } else {
                        AdminRows {
                            ForEach(Array(items.enumerated()), id: \.element.id) { i, b in
                                row(b, first: i == 0)
                            }
                        }
                    }
                }
                .padding(20).frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .screenBackground()
        .overlay(alignment: .top) { ToastView(text: toast) }
        .task { await load() }
        .refreshable { await load() }
        .sheet(item: $open) { b in
            DriveItemEditor(book: b, allBooks: books, cover: covers[b.id]) { saved in
                if let saved, let i = books.firstIndex(where: { $0.id == saved.id }) { books[i] = saved }
                open = nil
                Task { await load() }
            }
        }
        .alert("Nombre de la carpeta", isPresented: Binding(get: { renaming != nil }, set: { if !$0 { renaming = nil } })) {
            TextField("Nombre", text: $newName)
            Button("Guardar") { if let r = renaming { Task { _ = try? await Backend.client.from("library_books").update(["title": newName]).eq("id", value: r.id).execute(); await load() } } }
            Button("Cancelar", role: .cancel) {}
        }
        .confirmationDialog("¿Eliminar todo lo que hay aquí?", isPresented: $confirmDeleteAll, titleVisibility: .visible) {
            Button("Eliminar \(items.count) elementos", role: .destructive) {
                Task { await deleteAll(items.map(\.id)) }
            }
            Button("Cancelar", role: .cancel) {}
        } message: {
            Text("Se eliminarán sus archivos. No se puede deshacer.")
        }
    }

    /// Ruta de carpetas del Drive.
    private var breadcrumb: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 2) {
                Button("Drive") { path = [] }.fontWeight(path.isEmpty ? .semibold : .regular)
                    .foregroundStyle(path.isEmpty ? Palette.foreground : Palette.gold).frame(minHeight: 44)
                ForEach(Array(path.enumerated()), id: \.element.id) { i, p in
                    Image(systemName: "chevron.right").font(.inter(.caption)).foregroundStyle(Palette.muted)
                        .accessibilityHidden(true)
                    Button(p.title) { path = Array(path.prefix(i + 1)) }.fontWeight(i == path.count - 1 ? .semibold : .regular)
                        .foregroundStyle(i == path.count - 1 ? Palette.foreground : Palette.gold).frame(minHeight: 44)
                        .lineLimit(1)
                }
            }
            .buttonStyle(.plain).font(.apSubhead)
        }
        .accessibilityLabel("Ruta del Drive")
    }

    /// Menú «Nuevo», con el mismo aspecto de píldora que el resto de acciones.
    private var newMenu: some View {
        Menu {
            Button { Task { await create("folder") } } label: { Label("Carpeta", systemImage: "folder.badge.plus") }
            Button { Task { await create("book") } } label: { Label("Libro (portada + archivo)", systemImage: "book.closed") }
            Button { Task { await create("pack") } } label: { Label("Pack (elige libros)", systemImage: "shippingbox") }
            Button { Task { await create("video") } } label: { Label("Vídeo (archivo o enlace)", systemImage: "play.rectangle") }
            Button { Task { await create("file") } } label: { Label("Archivo (imagen, vídeo, PDF…)", systemImage: "doc") }
        } label: {
            Label("Nuevo", systemImage: "plus")
                .font(.apHeadline)
                .foregroundStyle(Palette.foreground)
                .padding(.horizontal, 24)
                .frame(minHeight: 44)
                .background(Palette.secondary, in: Capsule())
        }
        .menuStyle(.borderlessButton)
        .fixedSize()
        .accessibilityLabel("Crear carpeta, libro, pack, vídeo o archivo")
    }

    /// Menú «···» de la carpeta actual: borrar todo lo que contiene de una vez.
    private var moreMenu: some View {
        Menu {
            Button(role: .destructive) { confirmDeleteAll = true } label: {
                Label("Eliminar todo de aquí", systemImage: "trash")
            }
        } label: {
            Image(systemName: "ellipsis")
                .font(.inter(.body).weight(.semibold))
                .foregroundStyle(Palette.foreground)
                .frame(width: 44, height: 44)
                .background(Palette.secondary, in: Capsule())
        }
        .menuStyle(.borderlessButton)
        .fixedSize()
        .accessibilityLabel("Más opciones de esta carpeta")
    }

    @ViewBuilder private func row(_ b: Book, first: Bool) -> some View {
        let kind = b.resolvedKind
        if kind == "folder" {
            Button { Haptics.selection(); path.append((b.id, b.title)) } label: {
                AdminListRow(b.title, detail: "\(books.filter { $0.parent_id == b.id }.count) elementos") {
                    IconTile(symbol: "folder.fill", size: 44)
                } trailing: {
                    Menu {
                        Button("Renombrar") { newName = b.title; renaming = b }
                        Button("Eliminar carpeta", role: .destructive) { Task { await remove(b) } }
                    } label: {
                        Image(systemName: "ellipsis").font(.inter(.body).weight(.semibold))
                            .foregroundStyle(Palette.muted).frame(width: 44, height: 44)
                    }
                    .menuStyle(.borderlessButton).fixedSize()
                    .accessibilityLabel("Opciones de \(b.title)")
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityHint("Abre la carpeta")
            .contextMenu {
                Button("Renombrar") { newName = b.title; renaming = b }
                Button("Eliminar carpeta", role: .destructive) { Task { await remove(b) } }
            }
            .adminRowDivider(first: first, leading: 72)
        } else {
            let thumb = covers[b.id] ?? (kind == "pack" ? (b.pack_items?.first).flatMap { covers[$0] } : nil)
            // Un vídeo subido enseña su propio fotograma, con la proporción real del archivo.
            let videoURL = thumb == nil ? videoThumbs[b.id].flatMap(URL.init(string:)) : nil
            let detail: String = {
                switch kind {
                case "book": return "\(b.file_path != nil ? "Archivo listo" : "Sin archivo") · \(b.cover_path != nil ? "con portada" : "sin portada")"
                case "pack": return "\((b.pack_items ?? []).count) libros incluidos"
                case "file": return b.file_path != nil ? AdminDriveView.mediaLabel(b.file_path) : "Sin archivo"
                case "video": return b.file_path != nil ? AdminDriveView.mediaLabel(b.file_path)
                    : (b.video_url?.isEmpty == false ? "Enlace añadido" : "Sin contenido")
                default: return (b.buy_url ?? b.buy_url_live ?? b.buy_url_test) != nil ? "Con enlace" : "Sin enlace"
                }
            }()
            Button { open = b } label: {
                AdminListRow(b.title.isEmpty ? "Sin título" : b.title,
                             detail: "\(Self.kindLabel[kind] ?? "") · \(detail)") {
                    if let videoURL {
                        DriveVideoThumb(url: videoURL)
                    } else {
                        ZStack {
                            RoundedRectangle(cornerRadius: 10, style: .continuous).fill(Palette.secondary)
                            if let t = thumb, let u = URL(string: t) {
                                CachedAsyncImage(url: u) { $0.resizable().scaledToFill() } placeholder: { Color.clear }
                            } else {
                                Image(systemName: Self.kindSymbol[kind] ?? "doc").foregroundStyle(Palette.muted)
                            }
                        }
                        .frame(width: 44, height: 60)
                        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                        .accessibilityHidden(true)
                    }
                } trailing: {
                    HStack(spacing: 6) {
                        AdminStatusPill(text: b.published ? "Publicado" : "Borrador",
                                        tint: b.published ? Palette.gold : Palette.muted)
                        Image(systemName: "chevron.right").font(.inter(.footnote).weight(.semibold))
                            .foregroundStyle(Palette.muted).accessibilityHidden(true)
                    }
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityHint("Abre la ficha para editarlo")
            .contextMenu {
                Button("Abrir") { open = b }
                Button("Renombrar") { newName = b.title; renaming = b }
                Button("Eliminar", role: .destructive) { Task { await remove(b) } }
            }
            .adminRowDivider(first: first, leading: 72)
        }
    }

    private func load() async {
        loading = true
        do {
            books = try await Backend.client.from("library_books").select()
                .order("is_folder", ascending: false).order("sort_order").execute().value
            failed = false
        } catch {
            failed = true; loading = false; return
        }
        loading = false
        for b in books where covers[b.id] == nil {
            if let c = b.cover_path {
                if c.hasPrefix("http") { covers[b.id] = c }
                else if let u = try? await Backend.client.storage.from("library").createSignedURL(path: c, expiresIn: 3600) { covers[b.id] = u.absoluteString }
            } else if let f = b.file_path, AdminDriveView.isImage(f),
                      let u = try? await Backend.client.storage.from("library").createSignedURL(path: f, expiresIn: 3600) {
                // Un archivo suelto que sea imagen se muestra como miniatura.
                covers[b.id] = u.absoluteString
            } else if let f = b.file_path, AdminDriveView.isVideo(f),
                      let u = try? await Backend.client.storage.from("library").createSignedURL(path: f, expiresIn: 3600) {
                // Los vídeos necesitan su URL firmada para sacar el fotograma.
                videoThumbs[b.id] = u.absoluteString
            }
        }
    }

    private func create(_ kind: String) async {
        let title = ["pack": "Pack completo", "folder": "Nueva carpeta", "video": "Nuevo vídeo", "recommendation": "Nueva recomendación", "file": "Nuevo archivo"][kind] ?? "Nuevo libro"
        struct Insert: Encodable { let title: String; let folder: String; let kind: String; let is_pack: Bool; let is_folder: Bool; let parent_id: String?; let sort_order: Int }
        do {
            let b: Book = try await Backend.client.from("library_books")
                .insert(Insert(title: title, folder: "\(kind)-\(books.count + 1)", kind: kind, is_pack: kind == "pack", is_folder: kind == "folder", parent_id: parentId, sort_order: books.count))
                .select().single().execute().value
            books.append(b)
            if kind == "folder" { path.append((b.id, title)) } else { open = b }
        } catch { show("No se pudo crear") }
    }

    /// Rutas reales en el almacén de un elemento. Las portadas nuevas viven en
    /// `site-assets` y se guardan como URL pública, así que hay que extraer la ruta.
    private func storagePaths(_ b: Book) -> (library: [String], site: [String]) {
        var library: [String] = []
        var site: [String] = []
        if let f = b.file_path { library.append(f) }
        if let c = b.cover_path {
            if c.hasPrefix("http") {
                if let r = c.range(of: "/site-assets/") {
                    let rest = String(c[r.upperBound...]).components(separatedBy: "?").first ?? ""
                    if !rest.isEmpty { site.append(rest.removingPercentEncoding ?? rest) }
                }
            } else {
                library.append(c)
            }
        }
        return (library, site)
    }

    private func remove(_ b: Book) async {
        let paths = storagePaths(b)
        if !paths.library.isEmpty { _ = try? await Backend.client.storage.from("library").remove(paths: paths.library) }
        if !paths.site.isEmpty { _ = try? await Backend.client.storage.from("site-assets").remove(paths: paths.site) }
        do {
            try await Backend.client.from("library_books").delete().eq("id", value: b.id).execute()
            books.removeAll { $0.id == b.id }
            show("Eliminado")
        } catch { show("No se pudo eliminar") }
    }

    /// Borra lo seleccionado y todo lo que cuelga de ello (subcarpetas incluidas).
    private func deleteAll(_ ids: [String]) async {
        var all = Set(ids)
        var added = true
        while added {
            added = false
            for b in books {
                if let parent = b.parent_id, all.contains(parent), !all.contains(b.id) {
                    all.insert(b.id); added = true
                }
            }
        }
        guard !all.isEmpty else { return }
        let targets = books.filter { all.contains($0.id) }
        let library = targets.flatMap { storagePaths($0).library }
        let site = targets.flatMap { storagePaths($0).site }
        if !library.isEmpty { _ = try? await Backend.client.storage.from("library").remove(paths: library) }
        if !site.isEmpty { _ = try? await Backend.client.storage.from("site-assets").remove(paths: site) }
        do {
            try await Backend.client.from("library_books").delete().in("id", values: Array(all)).execute()
            books.removeAll { all.contains($0.id) }
            show(all.count == 1 ? "Eliminado" : "\(all.count) elementos eliminados")
        } catch { show("No se pudo eliminar") }
    }

    private func show(_ t: String) { toast = t; Task { try? await Task.sleep(for: .seconds(2.5)); toast = nil } }
}

/// Ficha de libro, pack, vídeo o recomendación.
struct DriveItemEditor: View {
    @State var book: AdminDriveView.Book
    let allBooks: [AdminDriveView.Book]
    @State var cover: String?
    var onDone: (AdminDriveView.Book?) -> Void
    @State private var coverItem: PhotosPickerItem?
    @State private var filePhotoItem: PhotosPickerItem?
    @State private var importingFile = false
    @State private var busy: String?
    @State private var message: String?
    @State private var confirmDelete = false

    private var kind: String { book.resolvedKind }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    HStack(alignment: .top, spacing: 16) {
                        ZStack {
                            RoundedRectangle(cornerRadius: 10, style: .continuous).fill(Palette.secondary)
                            if let c = cover, let u = URL(string: c) { CachedAsyncImage(url: u) { $0.resizable().scaledToFill() } placeholder: { BrandLoader() } }
                            else { Image(systemName: AdminDriveView.kindSymbol[kind] ?? "doc").font(.inter(.title)).foregroundStyle(Palette.muted) }
                        }
                        .frame(width: 96, height: 132).clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                        VStack(alignment: .leading, spacing: 8) {
                            Text(AdminDriveView.kindLabel[kind] ?? "").font(.apSubhead).foregroundStyle(Palette.muted)
                            if kind != "video" && kind != "file" {
                                PhotosPicker(selection: $coverItem, matching: .images) { Text(cover == nil ? "Subir portada" : "Reemplazar portada").foregroundStyle(Palette.gold) }
                            }
                            if kind == "book" || kind == "file" || kind == "video" {
                                Button(book.file_path == nil ? "Subir archivo" : "Reemplazar archivo") { importingFile = true }.foregroundStyle(Palette.gold)
                                PhotosPicker(selection: $filePhotoItem, matching: .any(of: [.images, .videos])) {
                                    Text("Elegir de Fotos").foregroundStyle(Palette.gold)
                                }
                                if book.file_path != nil {
                                    Text("\(AdminDriveView.mediaLabel(book.file_path)) listo").font(.apFootnote).foregroundStyle(Palette.success)
                                }
                            }
                        }
                        .buttonStyle(.plain)
                    }
                }
                Section {
                    TextField("Título", text: $book.title)
                    TextField(kind == "video" ? "Qué se explica en el vídeo" : "De qué trata y a quién le sirve",
                              text: Binding(get: { book.description ?? "" }, set: { book.description = $0 }), axis: .vertical).lineLimit(3...6)
                    if kind == "video" {
                        TextField("Enlace del vídeo (YouTube, Vimeo…)", text: Binding(get: { book.video_url ?? "" }, set: { book.video_url = $0 }))
                    }
                    if kind == "book" || kind == "pack" {
                        TextField("Precio (Gratis, 19 €…)", text: Binding(get: { book.price ?? "" }, set: { book.price = $0 }))
                    }
                    if kind == "recommendation" {
                        TextField("Enlace de la recomendación", text: Binding(get: { book.buy_url ?? "" }, set: { book.buy_url = $0 }))
                    }
                } footer: { if kind == "book" || kind == "pack" { Text("Los enlaces de compra se gestionan en Pagos.") } }
                if kind == "pack" {
                    let packBooks = allBooks.filter { $0.resolvedKind == "book" }
                    Section {
                        if packBooks.isEmpty { Text("Aún no hay libros. Crea primero algún libro para poder incluirlo.").foregroundStyle(Palette.muted) }
                        ForEach(packBooks) { x in
                            let on = (book.pack_items ?? []).contains(x.id)
                            Button {
                                var items = book.pack_items ?? []
                                if on { items.removeAll { $0 == x.id } } else { items.append(x.id) }
                                book.pack_items = items
                            } label: {
                                HStack { Text(x.title).foregroundStyle(Palette.foreground); Spacer(); Image(systemName: on ? "checkmark.circle.fill" : "circle").foregroundStyle(on ? Palette.gold : Palette.muted) }
                            }
                        }
                    } header: { Text("Libros incluidos en el pack") } footer: { Text("El cliente podrá descargar cada libro incluido una sola vez. Caduca en 7 días.") }
                }
                if book.file_path != nil || (kind == "pack" && !(book.pack_items ?? []).isEmpty) {
                    Section {
                        Button(kind == "pack" ? "Copiar enlace de 1 descarga del pack" : "Copiar enlace de 1 descarga") { Task { await shareOnce() } }
                    } footer: { Text("El cliente podrá descargarlo una sola vez. Caduca en 7 días.") }
                }
                Section {
                    Toggle(isOn: $book.published) {
                        VStack(alignment: .leading) {
                            Text(book.published ? "Publicado" : "Borrador privado")
                            Text(book.published ? "Aparece en la página de recursos de tus clientes." : "Solo lo ves tú. Nadie más puede abrirlo ni encontrarlo.")
                                .font(.apFootnote).foregroundStyle(Palette.muted)
                        }
                    }
                    .tint(Palette.gold)
                }
                if let busy { Section { HStack { BrandLoader(); Text(busy) } } }
                if let message { Section { Text(message) } }
                Section { Button("Eliminar", role: .destructive) { confirmDelete = true } }
            }
            .formStyle(.grouped)
            .navigationTitle(book.title.isEmpty ? "Sin título" : book.title)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cerrar") { onDone(nil) } }
                ToolbarItem(placement: .confirmationAction) { Button("Guardar") { Task { await save() } } }
            }
        }
        .frame(minWidth: 520, minHeight: 680)
        .tint(Palette.gold)
        .onChange(of: coverItem) { _, p in Task { await uploadCover(p) } }
        .onChange(of: filePhotoItem) { _, p in Task { await uploadPhotoFile(p) } }
        .fileImporter(isPresented: $importingFile, allowedContentTypes: [.item]) { result in
            if case .success(let url) = result { Task { await uploadFile(url) } }
        }
        .confirmationDialog("¿Eliminar?", isPresented: $confirmDelete, titleVisibility: .visible) {
            Button("Eliminar", role: .destructive) {
                Task {
                    let paths = [book.file_path, book.cover_path].compactMap { $0 }.filter { !$0.hasPrefix("http") }
                    if !paths.isEmpty { _ = try? await Backend.client.storage.from("library").remove(paths: paths) }
                    _ = try? await Backend.client.from("library_books").delete().eq("id", value: book.id).execute()
                    onDone(nil)
                }
            }
            Button("Cancelar", role: .cancel) {}
        }
    }

    private func save() async {
        busy = "Guardando…"; defer { busy = nil }
        struct U: Encodable {
            let title: String; let description: String?; let price: String?; let buy_url: String?; let video_url: String?
            let pack_items: [String]; let published: Bool
        }
        let t = { (s: String?) -> String? in let v = (s ?? "").trimmingCharacters(in: .whitespaces); return v.isEmpty ? nil : v }
        do {
            try await Backend.client.from("library_books").update(U(title: book.title, description: book.description, price: book.price,
                buy_url: t(book.buy_url), video_url: t(book.video_url), pack_items: book.pack_items ?? [], published: book.published))
                .eq("id", value: book.id).execute()
            Haptics.success(); onDone(book)
        } catch { message = "No se pudo guardar" }
    }

    private func uploadCover(_ p: PhotosPickerItem?) async {
        guard let p, let data = try? await p.loadTransferable(type: Data.self), let img = PlatformImage(data: data), let jpg = img.jpegData(maxSide: 1200) else { return }
        busy = "Subiendo portada…"; defer { busy = nil }
        let path = "library-covers/\(book.folder)/portada-\(Int(Date().timeIntervalSince1970 * 1000)).jpg"
        do {
            try await Backend.client.storage.from("site-assets").upload(path, data: jpg, options: FileOptions(contentType: "image/jpeg", upsert: true))
            let url = try Backend.client.storage.from("site-assets").getPublicURL(path: path).absoluteString
            try await Backend.client.from("library_books").update(["cover_path": url]).eq("id", value: book.id).execute()
            book.cover_path = url; cover = url; message = "Portada reemplazada"
        } catch { message = "No se pudo subir la portada" }
    }

    /// Sube cualquier archivo: imágenes, vídeos, PDF, EPUB, ZIP… Se guarda con su
    /// extensión y tipo MIME reales para que la descarga y la vista previa funcionen.
    private func uploadFile(_ url: URL) async {
        let access = url.startAccessingSecurityScopedResource()
        defer { if access { url.stopAccessingSecurityScopedResource() } }
        guard let data = try? Data(contentsOf: url), !data.isEmpty else { message = "El archivo está vacío"; return }
        let ext = url.pathExtension.lowercased()
        let safeExt = ext.isEmpty ? "bin" : ext
        let type = UTType(filenameExtension: safeExt)?.preferredMIMEType ?? "application/octet-stream"
        await uploadData(data, ext: safeExt, type: type)
    }

    /// Imágenes y vídeos elegidos de la fototeca (en iPhone no salen en el selector de archivos).
    private func uploadPhotoFile(_ item: PhotosPickerItem?) async {
        guard let item else { return }
        guard let data = try? await item.loadTransferable(type: Data.self), !data.isEmpty else {
            message = "No se pudo leer el archivo"; filePhotoItem = nil; return
        }
        let contentType = item.supportedContentTypes.first
        let ext = contentType?.preferredFilenameExtension ?? "jpg"
        let type = contentType?.preferredMIMEType ?? "image/jpeg"
        await uploadData(data, ext: ext, type: type)
        filePhotoItem = nil
    }

    private func uploadData(_ data: Data, ext: String, type: String) async {
        busy = "Subiendo archivo…"; defer { busy = nil }
        let path = "\(book.folder)/archivo-\(Int(Date().timeIntervalSince1970 * 1000)).\(ext)"
        do {
            try await Backend.client.storage.from("library").upload(path, data: data, options: FileOptions(contentType: type, upsert: true))
            try await Backend.client.from("library_books").update(["file_path": path]).eq("id", value: book.id).execute()
            if let old = book.file_path, old != path { _ = try? await Backend.client.storage.from("library").remove(paths: [old]) }
            book.file_path = path; message = "Archivo reemplazado correctamente"
        } catch { message = "No se pudo subir el archivo" }
    }

    private func shareOnce() async {
        struct T: Decodable { let token: String }
        do {
            let t: T = try await Backend.client.from("book_share_links").insert(["book_id": book.id]).select("token").single().execute().value
            let link = "https://autopilotplan.com/d/\(t.token)"
            #if os(iOS)
            UIPasteboard.general.string = link
            #else
            NSPasteboard.general.clearContents(); NSPasteboard.general.setString(link, forType: .string)
            #endif
            message = "Enlace copiado: sirve para 1 descarga, caduca en 7 días"
        } catch { message = "No se pudo crear el enlace" }
    }
}

/// Miniatura de un vídeo subido, con la proporción real del archivo: si el vídeo es
/// vertical se ve vertical y si es horizontal, horizontal. El fotograma se genera una
/// sola vez por URL y se guarda en memoria.
struct DriveVideoThumb: View {
    let url: URL
    @State private var image: PlatformImage?
    @State private var ratio: CGFloat = 9.0 / 16.0

    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 10, style: .continuous).fill(Palette.secondary)
            if let image {
                Image(platformImage: image).resizable().scaledToFill()
            } else {
                Image(systemName: "play.rectangle").foregroundStyle(Palette.muted)
            }
        }
        .frame(width: min(max(60 * ratio, 34), 107), height: 60)
        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
        .task(id: url.absoluteString) { await load() }
        .accessibilityHidden(true)
    }

    private func load() async {
        let key = url.absoluteString
        if let hit = DriveVideoFrames.shared.frame(for: key) {
            image = hit.image; ratio = hit.ratio; return
        }
        let asset = AVURLAsset(url: url)
        if let track = try? await asset.loadTracks(withMediaType: .video).first,
           let size = try? await track.load(.naturalSize), size.width > 0, size.height > 0 {
            ratio = size.width / size.height
        }
        let generator = AVAssetImageGenerator(asset: asset)
        generator.appliesPreferredTrackTransform = true
        generator.maximumSize = CGSize(width: 320, height: 320)
        guard let result = try? await generator.image(at: .zero) else { return }
        let frame = DriveVideoFrames.Frame(image: Self.platformImage(result.image), ratio: ratio)
        DriveVideoFrames.shared.store(frame, for: key)
        image = frame.image
    }

    private static func platformImage(_ cg: CGImage) -> PlatformImage {
        #if os(iOS)
        return UIImage(cgImage: cg, scale: 1, orientation: .up)
        #else
        return NSImage(cgImage: cg, size: NSSize(width: cg.width, height: cg.height))
        #endif
    }
}

/// Fotogramas ya generados de las miniaturas de vídeo del Drive.
@MainActor
final class DriveVideoFrames {
    static let shared = DriveVideoFrames()
    struct Frame { let image: PlatformImage; let ratio: CGFloat }
    private var cache: [String: Frame] = [:]

    func frame(for key: String) -> Frame? { cache[key] }
    func store(_ frame: Frame, for key: String) { cache[key] = frame }
}
