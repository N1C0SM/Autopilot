import SwiftUI
import Supabase

/// Blog, calcado de `BlogPostsEditor.tsx`: «Escribir con IA» (borrador, nunca se publica solo),
/// carpetas por categoría de la Academia, lista de artículos y editor completo.
struct AdminBlogView: View {
    struct Post: Codable, Identifiable, Hashable {
        var id: String; var slug: String; var title: String; var excerpt: String?; var body_markdown: String
        var cover_url: String?; var seo_title: String?; var seo_description: String?; var author_name: String?
        var published: Bool; var published_at: String?; var category: String?; var level: String?
        var order_index: Int?; var evidence_level: String?; var review_status: String?; var references: AnyJSON?
        static func blank() -> Post {
            Post(id: "", slug: "", title: "", excerpt: "", body_markdown: "", cover_url: "", seo_title: "", seo_description: "",
                 author_name: "Autopilot", published: false, published_at: nil, category: nil, level: nil, order_index: nil,
                 evidence_level: nil, review_status: "draft", references: .array([]))
        }
    }

    static let categories: [(String, String)] = [
        ("fundamentos", "Fundamentos"), ("sobrecarga-progresiva", "Sobrecarga progresiva"), ("hipertrofia", "Hipertrofia"),
        ("biomecanica", "Biomecánica"), ("sistema-nervioso-fuerza", "Sistema nervioso y fuerza"), ("programacion", "Programación"),
        ("tecnica", "Técnica"), ("calistenia", "Calistenia"), ("nutricion", "Nutrición"), ("recuperacion", "Recuperación"),
        ("mitos", "Mitos frecuentes"), ("entrenamiento-avanzado", "Entrenamiento avanzado"),
    ]
    static let reviewLabels = ["draft": "Borrador", "in_review": "En revisión", "verified": "Verificado"]

    @State private var posts: [Post] = []
    @State private var loading = true
    @State private var failed = false
    @State private var folder = "all"
    @State private var aiTopic = ""
    @State private var aiAudience = ""
    @State private var generating = false
    @State private var editing: Post?
    @State private var toast: String?

    var body: some View {
        ScrollView {
            if loading {
                AdminLoadingView(message: "Cargando los artículos")
            } else if failed {
                AdminErrorCard(message: "No se pudieron cargar los artículos del blog. Comprueba la conexión y vuelve a intentarlo.") {
                    Task { await reload() }
                }
                .padding(20)
            } else {
                VStack(alignment: .leading, spacing: 24) {
                    AdminPaneHeader("Artículos públicos en /blog. SEO orgánico a largo plazo.") {
                        Button { editing = .blank() } label: { Label("Nuevo artículo", systemImage: "plus") }
                            .buttonStyle(.pill).frame(maxWidth: 260)
                    }
                    Card {
                        Label("Escribir con IA", systemImage: "sparkles").font(.apSubhead.weight(.semibold)).labelStyle(GoldIconLabel())
                        Text("La IA crea un borrador. Nunca se publica solo: lo revisas, lo editas y decides tú.")
                            .font(.apFootnote).foregroundStyle(Palette.muted)
                            .fixedSize(horizontal: false, vertical: true)
                        LazyVGrid(columns: [GridItem(.adaptive(minimum: 260), spacing: 12)], spacing: 12) {
                            labeled("¿De qué trata?") {
                                TextField("Cuántos días entrenar a la semana si trabajas 10 horas", text: $aiTopic)
                                    .adminField()
                                    .accessibilityLabel("De qué trata el artículo")
                            }
                            labeled("Para quién (opcional)") {
                                TextField("Hombres de 30-45 con poco tiempo", text: $aiAudience)
                                    .adminField()
                                    .accessibilityLabel("Para quién es el artículo")
                            }
                        }
                        Button { Task { await generate() } } label: {
                            Label(generating ? "Escribiendo borrador..." : "Generar borrador", systemImage: "sparkles")
                        }
                        .buttonStyle(.pill).frame(maxWidth: 260).disabled(generating)
                    }
                    if posts.isEmpty {
                        EmptyStateView(symbol: "doc.text", title: "Aún no hay artículos",
                                       message: "Crea el primero o genera un borrador con IA: tú decides cuándo se publica.")
                    } else if folder == "all" {
                        folders
                    } else {
                        folderContents
                    }
                }
                .padding(20).frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .screenBackground()
        .overlay(alignment: .top) { ToastView(text: toast) }
        .task { await reload() }
        .refreshable { await reload() }
        .sheet(item: $editing) { p in
            BlogEditor(post: p) { message in
                editing = nil
                if let message { show(message); Task { await reload() } }
            }
        }
    }

    /// Carpetas de la Academia, con el recuento de artículos y publicados de cada una.
    private var folders: some View {
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 200), spacing: 12)], spacing: 12) {
            ForEach(Self.categories + [("none", "Blog (sin categoría)")], id: \.0) { slug, name in
                let list = posts.filter { slug == "none" ? ($0.category ?? "").isEmpty : $0.category == slug }
                Button {
                    Haptics.selection()
                    folder = slug
                } label: {
                    VStack(alignment: .leading, spacing: 10) {
                        IconTile(symbol: slug == "none" ? "tray" : "folder", size: 36)
                        Text(name).font(.apHeadline).multilineTextAlignment(.leading).lineLimit(2)
                        Spacer(minLength: 2)
                        Text("\(list.count) artículos · \(list.filter(\.published).count) publicados")
                            .font(.apFootnote).foregroundStyle(Palette.muted).lineLimit(1).minimumScaleFactor(0.8)
                    }
                    .padding(16).frame(maxWidth: .infinity, minHeight: 132, alignment: .topLeading)
                    .background(Palette.card, in: RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
                    .contentShape(RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
                }
                .buttonStyle(.plain)
                .accessibilityElement(children: .combine)
                .accessibilityHint("Abre la carpeta de artículos")
            }
        }
    }

    /// Artículos de la carpeta elegida, en una sola tarjeta con separadores alineados al texto.
    private var folderContents: some View {
        let list = posts.filter { folder == "none" ? ($0.category ?? "").isEmpty : $0.category == folder }
            .sorted { ($0.order_index ?? .max) < ($1.order_index ?? .max) }
        return VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 12) {
                AdminTextButton(title: "Todas las carpetas", systemImage: "chevron.left") {
                    Haptics.selection()
                    folder = "all"
                }
                Spacer(minLength: 0)
                Text(folder == "none" ? "Blog (sin categoría)" : Self.categories.first { $0.0 == folder }?.1 ?? "")
                    .font(.apFootnote).foregroundStyle(Palette.muted).lineLimit(1)
            }
            AdminRows {
                ForEach(Array(list.enumerated()), id: \.element.id) { i, p in
                    Button { editing = p } label: {
                        AdminListRow(p.title, detail: detail(p)) {
                            cover(p)
                        } trailing: {
                            HStack(spacing: 6) {
                                AdminStatusPill(text: p.published ? "Publicado" : "Borrador",
                                                tint: p.published ? Palette.gold : Palette.muted)
                                Menu {
                                    if p.published, let u = URL(string: "https://autopilotplan.app/blog/\(p.slug)") {
                                        Link("Ver en el blog", destination: u)
                                    }
                                    Button("Eliminar", role: .destructive) { Task { await remove(p) } }
                                } label: {
                                    Image(systemName: "ellipsis").font(.inter(.body).weight(.semibold))
                                        .foregroundStyle(Palette.muted).frame(width: 44, height: 44)
                                }
                                .menuStyle(.borderlessButton).fixedSize()
                                .accessibilityLabel("Opciones de \(p.title)")
                            }
                        }
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityHint("Abre el editor del artículo")
                    .adminRowDivider(first: i == 0, leading: 92)
                }
            }
        }
    }

    private func detail(_ p: Post) -> String {
        let cat = p.category.flatMap { c in Self.categories.first { $0.0 == c }?.1 }
        let review = Self.reviewLabels[p.review_status ?? "draft"] ?? ""
        return [cat, review.isEmpty ? nil : review, "/blog/\(p.slug)"].compactMap { $0 }.joined(separator: " · ")
    }

    @ViewBuilder private func cover(_ p: Post) -> some View {
        let c = p.cover_url ?? ""
        if !c.isEmpty, let u = URL(string: c) {
            CachedAsyncImage(url: u) { $0.resizable().scaledToFill() } placeholder: { Palette.secondary }
                .frame(width: 64, height: 48).clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
        } else {
            RoundedRectangle(cornerRadius: 10, style: .continuous).fill(Palette.secondary)
                .frame(width: 64, height: 48)
                .overlay { Image(systemName: "doc.text").foregroundStyle(Palette.muted) }
                .accessibilityHidden(true)
        }
    }

    private func labeled<C: View>(_ label: String, @ViewBuilder content: () -> C) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label).font(.apFootnote).foregroundStyle(Palette.muted)
            content()
        }
    }

    private func reload() async {
        loading = true
        do {
            posts = try await Backend.client.from("blog_posts").select().order("created_at", ascending: false).execute().value
            failed = false
        } catch {
            failed = true
        }
        loading = false
    }

    private func generate() async {
        let topic = aiTopic.trimmingCharacters(in: .whitespaces)
        guard !topic.isEmpty else { show("Escribe de qué quieres que hable el artículo"); return }
        generating = true; defer { generating = false }
        struct Draft: Decodable { let title: String?; let excerpt: String?; let body_markdown: String?; let seo_title: String?; let seo_description: String?; let error: String? }
        do {
            let d: Draft = try await Backend.client.functions.invoke("generate-blog-post", options: FunctionInvokeOptions(body: ["topic": topic, "audience": aiAudience.trimmingCharacters(in: .whitespaces)]))
            if let e = d.error { show(e); return }
            var p = Post.blank()
            p.title = d.title ?? topic; p.slug = BlogEditor.slugify(p.title); p.excerpt = d.excerpt ?? ""
            p.body_markdown = d.body_markdown ?? ""; p.seo_title = d.seo_title ?? ""; p.seo_description = d.seo_description ?? ""
            aiTopic = ""; aiAudience = ""
            editing = p
            show("Borrador creado. Revísalo antes de publicar.")
        } catch { show("No se pudo generar el artículo") }
    }

    private func remove(_ p: Post) async {
        do { try await Backend.client.from("blog_posts").delete().eq("id", value: p.id).execute(); posts.removeAll { $0.id == p.id } }
        catch { show("No se pudo eliminar") }
    }

    private func show(_ t: String) { toast = t; Task { try? await Task.sleep(for: .seconds(2.5)); toast = nil } }
}

/// Editor de artículo: título, slug, resumen, portada, Academia (categoría, nivel, evidencia, revisión,
/// orden, referencias), contenido Markdown y SEO. Para publicar en la Academia hace falta «Verificado» y referencias.
struct BlogEditor: View {
    @State var post: AdminBlogView.Post
    var onDone: (String?) -> Void
    @State private var refsText = "[]"
    @State private var saving = false
    @State private var error: String?

    static func slugify(_ s: String) -> String {
        let folded = s.folding(options: [.diacriticInsensitive, .caseInsensitive], locale: Locale(identifier: "es")).lowercased()
        let kept = folded.filter { $0.isLetter || $0.isNumber || $0 == " " || $0 == "-" }
        return String(kept.split(whereSeparator: { $0 == " " || $0 == "-" }).joined(separator: "-").prefix(80))
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Título", text: $post.title)
                    TextField("Slug", text: $post.slug)
                    Text("URL: /blog/\(post.slug.isEmpty ? "..." : post.slug)").font(.inter(.caption2)).foregroundStyle(Palette.muted)
                    TextField("Resumen", text: Binding(get: { post.excerpt ?? "" }, set: { post.excerpt = $0 }), axis: .vertical)
                    TextField("URL de portada", text: Binding(get: { post.cover_url ?? "" }, set: { post.cover_url = $0 }))
                    Toggle("Publicado", isOn: $post.published).tint(Palette.gold)
                }
                Section("Academia") {
                    Picker("Categoría", selection: Binding(get: { post.category ?? "" }, set: { post.category = $0.isEmpty ? nil : $0 })) {
                        Text("Blog (sin categoría)").tag("")
                        ForEach(AdminBlogView.categories, id: \.0) { Text($0.1).tag($0.0) }
                    }
                    Picker("Estado de revisión", selection: Binding(get: { post.review_status ?? "draft" }, set: { post.review_status = $0 })) {
                        ForEach(["draft", "in_review", "verified"], id: \.self) { Text(AdminBlogView.reviewLabels[$0] ?? $0).tag($0) }
                    }
                    TextField("Nivel", text: Binding(get: { post.level ?? "" }, set: { post.level = $0.isEmpty ? nil : $0 }))
                    TextField("Nivel de evidencia", text: Binding(get: { post.evidence_level ?? "" }, set: { post.evidence_level = $0.isEmpty ? nil : $0 }))
                    TextField("Orden en el temario", text: Binding(get: { post.order_index.map(String.init) ?? "" }, set: { post.order_index = Int($0) }))
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Referencias (lista JSON: authors, year, title, journal, doi)").font(.inter(.caption))
                        TextEditor(text: $refsText).font(.inter(.caption, design: .monospaced)).frame(minHeight: 100)
                        Text("Comprueba cada DOI en doi.org antes de marcar como Verificado. Sin verificar y sin referencias no se puede publicar.")
                            .font(.inter(.caption2)).foregroundStyle(Palette.muted)
                    }
                }
                Section {
                    TextEditor(text: $post.body_markdown).font(.inter(.callout, design: .monospaced)).frame(minHeight: 260)
                } header: { Text("Contenido") } footer: { Text("Soporta Markdown completo (#, **, listas, enlaces, código, tablas).") }
                Section("SEO (opcional)") {
                    TextField("SEO title (sobrescribe el título)", text: Binding(get: { post.seo_title ?? "" }, set: { post.seo_title = $0 }))
                    TextField("Meta description", text: Binding(get: { post.seo_description ?? "" }, set: { post.seo_description = $0 }), axis: .vertical)
                }
                if let error { Section { Text(error).foregroundStyle(Palette.destructive) } }
            }
            .formStyle(.grouped)
            .navigationTitle(post.id.isEmpty ? "Nuevo artículo" : "Editar artículo")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancelar") { onDone(nil) } }
                ToolbarItem(placement: .confirmationAction) { Button { Task { await save() } } label: { if saving { BrandLoader() } else { Text("Guardar") } }.disabled(saving) }
            }
        }
        .frame(minWidth: 620, minHeight: 720)
        .tint(Palette.gold)
        .onAppear {
            if let r = post.references, let d = try? JSONEncoder().encode(r), let s = String(data: d, encoding: .utf8) { refsText = s }
        }
    }

    private func save() async {
        let title = post.title.trimmingCharacters(in: .whitespaces)
        guard !title.isEmpty else { error = "Falta el título"; return }
        guard let refsData = refsText.data(using: .utf8), let refs = try? JSONDecoder().decode(AnyJSON.self, from: refsData), case .array(let list) = refs else {
            error = "Las referencias deben ser una lista válida"; return
        }
        if post.published, post.category != nil, post.review_status != "verified" || list.isEmpty {
            error = "Para publicar en la Academia: márcalo como Verificado y añade al menos una referencia"; return
        }
        saving = true; defer { saving = false }
        var p = post
        p.title = title
        p.slug = post.slug.trimmingCharacters(in: .whitespaces).isEmpty ? Self.slugify(title) : post.slug
        p.references = refs
        if p.published && p.published_at == nil { p.published_at = ISO8601DateFormatter().string(from: Date()) }
        struct Payload: Encodable {
            let slug: String; let title: String; let excerpt: String?; let body_markdown: String; let cover_url: String?
            let seo_title: String?; let seo_description: String?; let author_name: String; let published: Bool; let published_at: String?
            let category: String?; let level: String?; let order_index: Int?; let evidence_level: String?; let review_status: String?; let references: AnyJSON?
        }
        let nz = { (s: String?) -> String? in (s ?? "").isEmpty ? nil : s }
        let payload = Payload(slug: p.slug, title: p.title, excerpt: nz(p.excerpt), body_markdown: p.body_markdown, cover_url: nz(p.cover_url),
                              seo_title: nz(p.seo_title), seo_description: nz(p.seo_description), author_name: p.author_name ?? "Autopilot",
                              published: p.published, published_at: p.published_at, category: p.category, level: p.level, order_index: p.order_index,
                              evidence_level: p.evidence_level, review_status: p.review_status, references: p.references)
        do {
            if p.id.isEmpty { try await Backend.client.from("blog_posts").insert(payload).execute() }
            else { try await Backend.client.from("blog_posts").update(payload).eq("id", value: p.id).execute() }
            Haptics.success()
            onDone("Artículo guardado")
        } catch { self.error = "No se pudo guardar" }
    }
}
