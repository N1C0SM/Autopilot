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
    @State private var folder = "all"
    @State private var aiTopic = ""
    @State private var aiAudience = ""
    @State private var generating = false
    @State private var editing: Post?
    @State private var toast: String?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Blog").font(.apHeadline)
                        Text("Artículos públicos en /blog. SEO orgánico a largo plazo.").font(.apFootnote).foregroundStyle(Palette.muted)
                    }
                    Spacer()
                    Button { editing = .blank() } label: { Label("Nuevo artículo", systemImage: "plus") }.buttonStyle(.pill).frame(width: 200)
                }
                Card {
                    Label("Escribir con IA", systemImage: "sparkles").font(.apSubhead.weight(.semibold)).labelStyle(GoldIconLabel())
                    Text("La IA crea un borrador. Nunca se publica solo: lo revisas, lo editas y decides tú.").font(.apFootnote).foregroundStyle(Palette.muted)
                    LazyVGrid(columns: [GridItem(.adaptive(minimum: 260), spacing: 12)], spacing: 12) {
                        labeled("¿De qué trata?") { TextField("Cuántos días entrenar a la semana si trabajas 10 horas", text: $aiTopic).textFieldStyle(.plain) }
                        labeled("Para quién (opcional)") { TextField("Hombres de 30-45 con poco tiempo", text: $aiAudience).textFieldStyle(.plain) }
                    }
                    Button { Task { await generate() } } label: {
                        Label(generating ? "Escribiendo borrador..." : "Generar borrador", systemImage: "sparkles")
                    }
                    .buttonStyle(.pill).frame(maxWidth: 260).disabled(generating)
                }
                if loading { ProgressView().frame(maxWidth: .infinity).padding(.top, 40) }
                else if posts.isEmpty {
                    VStack(spacing: 12) {
                        Text("Aún no hay artículos.").font(.apSubhead).foregroundStyle(Palette.muted)
                        Button { editing = .blank() } label: { Label("Crear el primero", systemImage: "plus") }.buttonStyle(.pillSecondary).frame(width: 220)
                    }
                    .frame(maxWidth: .infinity).padding(.vertical, 60)
                    .background(Palette.card, in: RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
                } else if folder == "all" {
                    LazyVGrid(columns: [GridItem(.adaptive(minimum: 180), spacing: 12)], spacing: 12) {
                        ForEach(Self.categories + [("none", "Blog (sin categoría)")], id: \.0) { slug, name in
                            let list = posts.filter { slug == "none" ? ($0.category ?? "").isEmpty : $0.category == slug }
                            Button { folder = slug } label: {
                                VStack(alignment: .leading) {
                                    Text(name).font(.apHeadline).multilineTextAlignment(.leading)
                                    Spacer(minLength: 12)
                                    Text("\(list.count) artículos · \(list.filter(\.published).count) publicados").font(.apFootnote).foregroundStyle(Palette.muted)
                                }
                                .padding(16).frame(maxWidth: .infinity, minHeight: 110, alignment: .topLeading)
                                .background(Palette.card, in: RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
                            }
                            .buttonStyle(.plain)
                        }
                    }
                } else {
                    Button { folder = "all" } label: {
                        (Text("← Todas las carpetas · ").foregroundColor(Palette.muted) + Text(folder == "none" ? "Blog (sin categoría)" : Self.categories.first { $0.0 == folder }?.1 ?? ""))
                            .font(.apSubhead)
                    }
                    .buttonStyle(.plain).frame(minHeight: 44)
                    ForEach(posts.filter { folder == "none" ? ($0.category ?? "").isEmpty : $0.category == folder }.sorted { ($0.order_index ?? .max) < ($1.order_index ?? .max) }) { p in
                        HStack(spacing: 12) {
                            if let c = p.cover_url, let u = URL(string: c), !c.isEmpty {
                                CachedAsyncImage(url: u) { $0.resizable().scaledToFill() } placeholder: { Palette.secondary }
                                    .frame(width: 64, height: 48).clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                            } else {
                                RoundedRectangle(cornerRadius: 8, style: .continuous).fill(Palette.secondary).frame(width: 64, height: 48)
                            }
                            VStack(alignment: .leading, spacing: 2) {
                                HStack(spacing: 6) {
                                    Text(p.title).font(.apSubhead.weight(.medium)).lineLimit(1)
                                    Text(p.published ? "Publicado" : "Borrador").font(.caption2.weight(.bold))
                                        .padding(.horizontal, 6).padding(.vertical, 2)
                                        .foregroundStyle(p.published ? Palette.gold : Palette.muted)
                                        .background(p.published ? Palette.gold.opacity(0.2) : Palette.secondary, in: Capsule())
                                }
                                Text("\(p.category.flatMap { c in Self.categories.first { $0.0 == c }?.1 }.map { "\($0) · \(Self.reviewLabels[p.review_status ?? "draft"] ?? "") · " } ?? "")/blog/\(p.slug)")
                                    .font(.caption2).foregroundStyle(Palette.muted).lineLimit(1)
                            }
                            Spacer()
                            if p.published, let u = URL(string: "https://autopilotplan.app/blog/\(p.slug)") {
                                Link(destination: u) { Image(systemName: "arrow.up.right.square") }.foregroundStyle(Palette.muted).accessibilityLabel("Ver")
                            }
                            Button("Editar") { editing = p }.buttonStyle(.plain).foregroundStyle(Palette.gold).frame(minHeight: 44)
                            Button { Task { await remove(p) } } label: { Image(systemName: "trash").foregroundStyle(Palette.destructive) }
                                .buttonStyle(.plain).frame(width: 36, height: 44).accessibilityLabel("Eliminar")
                        }
                        .padding(14)
                        .background(Palette.card, in: RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
                    }
                }
            }
            .padding(20).frame(maxWidth: .infinity, alignment: .leading)
        }
        .screenBackground()
        .overlay(alignment: .top) { ToastView(text: toast) }
        .task { await reload() }
        .sheet(item: $editing) { p in
            BlogEditor(post: p) { message in
                editing = nil
                if let message { show(message); Task { await reload() } }
            }
        }
    }

    private func labeled<C: View>(_ label: String, @ViewBuilder content: () -> C) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label).font(.apFootnote)
            content().padding(.horizontal, 14).frame(minHeight: 44).background(Palette.secondary, in: Capsule())
        }
    }

    private func reload() async {
        posts = (try? await Backend.client.from("blog_posts").select().order("created_at", ascending: false).execute().value) ?? []
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
                    Text("URL: /blog/\(post.slug.isEmpty ? "..." : post.slug)").font(.caption2).foregroundStyle(Palette.muted)
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
                        Text("Referencias (lista JSON: authors, year, title, journal, doi)").font(.caption)
                        TextEditor(text: $refsText).font(.system(.caption, design: .monospaced)).frame(minHeight: 100)
                        Text("Comprueba cada DOI en doi.org antes de marcar como Verificado. Sin verificar y sin referencias no se puede publicar.")
                            .font(.caption2).foregroundStyle(Palette.muted)
                    }
                }
                Section {
                    TextEditor(text: $post.body_markdown).font(.system(.callout, design: .monospaced)).frame(minHeight: 260)
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
                ToolbarItem(placement: .confirmationAction) { Button { Task { await save() } } label: { if saving { ProgressView() } else { Text("Guardar") } }.disabled(saving) }
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
