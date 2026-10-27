import SwiftUI
import UniformTypeIdentifiers
import Supabase

/// Landing, calcado de `SiteContentEditor.tsx`: Claves de IA (motor de texto, imágenes, vídeos y claves),
/// secciones visibles, recomendaciones, vídeo del hero, enlaces a la app, plazas, fundador y testimonios.
struct AdminLandingView: View {
    typealias Row = [String: AnyJSON]
    struct Testimonial: Codable, Identifiable, Hashable { let id: String; var name: String; var result: String?; var text: String; var sort_order: Int?; var photo_url: String? }
    struct Recommendation: Codable, Identifiable, Hashable { var id: String; var title: String; var description: String; var url: String; var badge: String; var image_url: String? }

    private static let aiKeys = [
        ("OPENAI_API_KEY", "OpenAI (ChatGPT)", "Vídeos, imágenes, blog, libros y el resto de la IA con tu cuenta de OpenAI.", "sk-..."),
        ("ANTHROPIC_API_KEY", "Claude (Anthropic)", "Segunda opción para el texto si OpenAI se queda sin saldo.", "sk-ant-..."),
        ("DEEPSEEK_API_KEY", "DeepSeek", "Solo texto (planes, blog, chat, clasificación), mucho más barato. No genera imágenes ni vídeos: para eso sigue haciendo falta OpenAI.", "sk-..."),
    ]
    private static let providers = [("openai", "OpenAI", "Texto, imágenes y vídeo"), ("anthropic", "Claude", "Solo texto"), ("deepseek", "DeepSeek", "Solo texto, muy barato"), ("lovable", "Lovable", "Incluida, sin clave")]
    private static let engines = [("auto", "Automático", "Sigue el orden del motor de texto (se salta las que no hacen imágenes)."), ("openai", "OpenAI", "Siempre tu cuenta de OpenAI; si falla, Lovable de respaldo."), ("lovable", "Lovable", "Siempre los créditos de Lovable.")]

    @State private var settings: Row = [:]
    @State private var secrets: [String: String] = [:]
    @State private var testimonials: [Testimonial] = []
    @State private var recs: [Recommendation] = []
    @State private var loading = true
    @State private var toast: String?
    @State private var importing: String?
    @State private var uploading = false
    @State private var social: [String: String] = [:]
    private static let networks = [("instagram", "Instagram"), ("tiktok", "TikTok"), ("youtube", "YouTube"), ("x", "X"), ("whatsapp", "WhatsApp")]

    private var id: String { settings.str("id") }

    var body: some View {
        ScrollView {
            if loading { ProgressView().frame(maxWidth: .infinity).padding(.top, 60) } else {
                VStack(alignment: .leading, spacing: 40) {
                    Text("Lo que se ve en la home pública y la IA que lo genera.").font(.apSubhead).foregroundStyle(Palette.muted)
                    aiSection
                    section("Secciones visibles en la landing", "Activa o desactiva bloques enteros de la home pública.") {
                        group {
                            settingToggle("Blog", "Enlace al blog en el menú y sección de últimos artículos.", "show_blog", first: true)
                            settingToggle("Guías / Ebooks", "Sección de guías descargables (visible en /recursos y en la landing).", "show_ebooks")
                            settingToggle("Recomendaciones", "Productos recomendados (visibles en /recursos y en la landing).", "show_recommendations")
                        }
                        group {
                            settingNumber("Libros en la landing", "Cuántas guías se muestran en la portada (0 = ninguna).", "landing_ebooks_count", first: true)
                            settingNumber("Recomendaciones en la landing", "Cuántos productos recomendados se muestran en la portada.", "landing_recommendations_count")
                        }
                    }
                    section("Recomendaciones", "Suplementos y productos: creatina, proteína, material… con enlace de afiliado si quieres.") {
                        Button { recs.append(Recommendation(id: UUID().uuidString.prefix(8).lowercased(), title: "", description: "", url: "", badge: "")) } label: {
                            Label("Añadir recomendación", systemImage: "plus")
                        }
                        .buttonStyle(.pillSecondary).frame(maxWidth: 280)
                        if recs.isEmpty { EmptyStateView(symbol: "sparkles", title: "Sin recomendaciones", message: "Añade suplementos o material con su enlace.") }
                        ForEach($recs) { $r in
                            VStack(spacing: 8) {
                                HStack {
                                    Spacer()
                                    Button { recs.removeAll { $0.id == r.id } } label: { Image(systemName: "trash").foregroundStyle(Palette.destructive) }
                                        .buttonStyle(.plain).accessibilityLabel("Eliminar \(r.title.isEmpty ? "recomendación" : r.title)")
                                }
                                field("Título (Creatina Monohidratada)", $r.title)
                                field("Por qué la recomiendas", $r.description)
                                field("Etiqueta (Top, Recomendado…)", $r.badge)
                                field("URL (afiliado o web)", $r.url)
                            }
                            .padding(16).background(Palette.card, in: RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
                        }
                        Button("Guardar recomendaciones") { Task { await saveRecs() } }.buttonStyle(.pill).frame(maxWidth: 320)
                    }
                    section("Vídeo del Hero (landing)", "Vídeo corto (15–45 s, MP4/WebM) que se reproduce en silencio en la portada. Mejora notablemente la conversión.") {
                        group {
                            settingText("URL del vídeo", "https://…", "hero_video_url", first: true)
                            settingText("URL del póster", "https://…", "hero_video_poster_url")
                        }
                        HStack(spacing: 8) {
                            Button { importing = "hero_video_url" } label: { Label("Subir vídeo", systemImage: "film") }.buttonStyle(.pillSecondary)
                            Button { importing = "hero_video_poster_url" } label: { Label("Subir póster", systemImage: "photo") }.buttonStyle(.pillSecondary)
                        }
                        .frame(maxWidth: 420).disabled(uploading)
                        if uploading { HStack { ProgressView(); Text("Subiendo…").foregroundStyle(Palette.muted) } }
                        Button("Guardar vídeo") { Task { await saveFields(["hero_video_url", "hero_video_poster_url"]) } }.buttonStyle(.pill).frame(maxWidth: 320)
                    }
                    section("Enlaces a la app (App Store / Google Play)", "Pega aquí las URLs cuando publiques la app. Si dejas un campo vacío, ese botón se ocultará en la web.") {
                        group {
                            settingToggle("Mostrar descarga de la app", nil, "show_app_download", first: true)
                            settingText("App Store", "https://apps.apple.com/app/id0000000000", "app_store_url")
                            settingText("Google Play", "https://play.google.com/store/apps/details?id=…", "play_store_url")
                        }
                        Button("Guardar enlaces") { Task { await saveFields(["app_store_url", "play_store_url"]) } }.buttonStyle(.pill).frame(maxWidth: 320)
                    }
                    section("Plazas de Transformación", "Esta cifra aparece en la landing. Usa 0 cuando no queden plazas disponibles.") {
                        group { settingNumber("Plazas disponibles", nil, "transformation_slots", first: true, autosave: false) }
                        Button("Guardar plazas") { Task { await saveFields(["transformation_slots"]) } }.buttonStyle(.pill).frame(maxWidth: 320)
                    }
                    section("Sobre el fundador", nil) {
                        group {
                            settingText("Nombre", "Tu nombre", "trainer_name", first: true)
                            settingText("Foto (URL)", "https://…", "trainer_photo_url")
                            settingText("Bio", "Llevo años ayudando a personas a…", "trainer_bio")
                            settingText("Teléfono", "+34…", "contact_phone")
                        }
                        Button("Guardar entrenador") { Task { await saveFields(["trainer_name", "trainer_photo_url", "trainer_bio", "contact_phone"]) } }.buttonStyle(.pill).frame(maxWidth: 320)
                    }
                    section("Redes sociales", "Aparecen en el pie de la web y en los datos para buscadores. Escribe el usuario o el enlace.") {
                        group {
                            ForEach(Array(Self.networks.enumerated()), id: \.element.0) { i, n in
                                HStack {
                                    Text(n.1).font(.apBody).frame(width: 110, alignment: .leading)
                                    TextField(n.0 == "whatsapp" ? "Teléfono con prefijo" : "usuario", text: Binding(get: { social[n.0] ?? "" }, set: { social[n.0] = $0 })).textFieldStyle(.plain)
                                        .textContentTypeCompat(.username)
                                }
                                .rowStyle(first: i == 0)
                            }
                        }
                        Button("Guardar redes") { Task { await saveSocial() } }.buttonStyle(.pill).frame(maxWidth: 320)
                    }
                    section("Testimonios", nil) {
                        Button { Task { await addTestimonial() } } label: { Label("Añadir testimonio", systemImage: "plus") }.buttonStyle(.pillSecondary).frame(maxWidth: 280)
                        if testimonials.isEmpty { EmptyStateView(symbol: "star", title: "Sin testimonios", message: "Añade el primero para mostrarlo en la landing.") }
                        ForEach($testimonials) { $t in
                            VStack(spacing: 8) {
                                field("Nombre", $t.name)
                                field("Resultado (-8kg en 3 meses)", Binding(get: { t.result ?? "" }, set: { t.result = $0 }))
                                field("Texto del testimonio", $t.text)
                                HStack {
                                    Button("Guardar") { Task { await saveTestimonial(t) } }.foregroundStyle(Palette.gold)
                                    Spacer()
                                    Button("Eliminar", role: .destructive) { Task { await deleteTestimonial(t) } }.foregroundStyle(Palette.destructive)
                                }
                                .buttonStyle(.plain).frame(minHeight: 44)
                            }
                            .padding(16).background(Palette.card, in: RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
                        }
                    }
                }
                .padding(20).frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .screenBackground()
        .overlay(alignment: .top) { ToastView(text: toast) }
        .task { await load() }
        .fileImporter(isPresented: Binding(get: { importing != nil }, set: { if !$0 { importing = nil } }),
                      allowedContentTypes: importing == "hero_video_url" ? [.movie, .mpeg4Movie] : [.image]) { result in
            let field = importing
            if case .success(let url) = result, let field { Task { await uploadHero(url, field: field) } }
        }
    }

    private func uploadHero(_ url: URL, field: String) async {
        let access = url.startAccessingSecurityScopedResource()
        defer { if access { url.stopAccessingSecurityScopedResource() } }
        guard let data = try? Data(contentsOf: url) else { return }
        guard data.count <= 100 * 1024 * 1024 else { show("Máximo 100 MB"); return }
        uploading = true; defer { uploading = false }
        let ext = url.pathExtension.isEmpty ? (field == "hero_video_url" ? "mp4" : "jpg") : url.pathExtension.lowercased()
        let path = "hero/\(Int(Date().timeIntervalSince1970 * 1000)).\(ext)"
        let type = field == "hero_video_url" ? (ext == "webm" ? "video/webm" : "video/mp4") : (ext == "png" ? "image/png" : "image/jpeg")
        do {
            try await Backend.client.storage.from("site-assets").upload(path, data: data, options: FileOptions(contentType: type, upsert: true))
            let public_ = try Backend.client.storage.from("site-assets").getPublicURL(path: path).absoluteString
            settings[field] = .string(public_)
            await saveFields([field])
        } catch { show("No se pudo subir") }
    }

    private func saveSocial() async {
        guard !id.isEmpty else { return }
        var obj: [String: AnyJSON] = [:]
        for (k, v) in social where !v.trimmingCharacters(in: .whitespaces).isEmpty { obj[k] = .string(v.trimmingCharacters(in: .whitespaces)) }
        do { try await Backend.client.from("settings").update(["social_links": AnyJSON.object(obj)]).eq("id", value: id).execute(); show("Redes guardadas") }
        catch { show("No se pudo guardar") }
    }

    // MARK: Claves de IA

    private var textOrder: [String] {
        let ids = Self.providers.map(\.0)
        let saved = (secrets["AI_TEXT_ORDER"] ?? "").split(separator: ",").map { $0.trimmingCharacters(in: .whitespaces) }.filter { ids.contains($0) }
        return saved + ids.filter { !saved.contains($0) }
    }
    private var textEnabled: Set<String> {
        let saved = (secrets["AI_TEXT_ORDER"] ?? "").split(separator: ",").map { $0.trimmingCharacters(in: .whitespaces) }
        return Set(secrets["AI_TEXT_ORDER"] == nil ? Self.providers.map(\.0) : saved)
    }

    private var aiSection: some View {
        section("Claves de IA", "Toda la IA (vídeos e imágenes de ejercicios, blog, ordenar libros, precios, comidas, sugerencias del chat…) puede funcionar con la IA de Lovable o con tu clave de OpenAI.") {
            VStack(alignment: .leading, spacing: 8) {
                Text("MOTOR DE TEXTO").font(.apFootnote).foregroundStyle(Palette.muted).padding(.horizontal, 16)
                VStack(spacing: 0) {
                    ForEach(Array(textOrder.enumerated()), id: \.element) { i, pid in
                        let p = Self.providers.first { $0.0 == pid }!
                        let on = textEnabled.contains(pid)
                        HStack(spacing: 6) {
                            Text(on ? "\(i + 1)" : "–").font(.apSubhead.monospacedDigit()).foregroundStyle(Palette.muted).frame(width: 18)
                            VStack(alignment: .leading, spacing: 1) {
                                Text(p.1).font(.apBody).foregroundStyle(on ? Palette.foreground : Palette.muted)
                                Text(p.2).font(.apFootnote).foregroundStyle(Palette.muted)
                            }
                            Spacer()
                            Button { move(pid, -1) } label: { Image(systemName: "arrow.up") }.buttonStyle(.plain).frame(width: 40, height: 44).disabled(i == 0).accessibilityLabel("Subir \(p.1)")
                            Button { move(pid, 1) } label: { Image(systemName: "arrow.down") }.buttonStyle(.plain).frame(width: 40, height: 44).disabled(i == textOrder.count - 1).accessibilityLabel("Bajar \(p.1)")
                            Toggle("", isOn: Binding(get: { on }, set: { toggleProvider(pid, $0) })).labelsHidden().tint(Palette.gold).accessibilityLabel("Usar \(p.1)")
                        }
                        .foregroundStyle(Palette.muted)
                        .rowStyle(first: i == 0)
                    }
                }
                .background(Palette.card, in: RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
                Text("Planes, blog, comidas, chat y clasificación. Se prueba en este orden y, si uno falla o no tiene saldo, se pasa al siguiente.")
                    .font(.apFootnote).foregroundStyle(Palette.muted).padding(.horizontal, 16)
            }
            VStack(alignment: .leading, spacing: 8) {
                Text("MOTOR DE IMÁGENES").font(.apFootnote).foregroundStyle(Palette.muted).padding(.horizontal, 16)
                SegmentedPill(options: Self.engines.map(\.1), selection: Binding(
                    get: { Self.engines.firstIndex { $0.0 == (secrets["AI_MEDIA_PROVIDER"] ?? "auto") } ?? 0 },
                    set: { i in Task { await saveSecret("AI_MEDIA_PROVIDER", Self.engines[i].0, "Imágenes: \(Self.engines[i].1)") } }))
                Text(Self.engines.first { $0.0 == (secrets["AI_MEDIA_PROVIDER"] ?? "auto") }?.2 ?? "").font(.apFootnote).foregroundStyle(Palette.muted).padding(.horizontal, 16)
            }
            VStack(alignment: .leading, spacing: 8) {
                Text("MOTOR DE VÍDEOS").font(.apFootnote).foregroundStyle(Palette.muted).padding(.horizontal, 16)
                Toggle("Vídeos de ejercicios", isOn: Binding(get: { secrets["AI_VIDEO_ENABLED"] != "0" },
                                                             set: { v in Task { await saveSecret("AI_VIDEO_ENABLED", v ? "1" : "0", v ? "Vídeos activados" : "Vídeos en pausa") } }))
                    .tint(Palette.gold).rowStyle(first: true)
                    .background(Palette.card, in: RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
                Text("Usa el mismo motor que las imágenes. Apágalo para pausar la generación de vídeos de ejercicios.").font(.apFootnote).foregroundStyle(Palette.muted).padding(.horizontal, 16)
            }
            VStack(alignment: .leading, spacing: 8) {
                Text("CLAVES DE API").font(.apFootnote).foregroundStyle(Palette.muted).padding(.horizontal, 16)
                VStack(spacing: 0) {
                    ForEach(Array(Self.aiKeys.enumerated()), id: \.element.0) { i, k in
                        VStack(alignment: .leading, spacing: 10) {
                            HStack(alignment: .top) {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(k.1).font(.apBody)
                                    Text(k.2).font(.apFootnote).foregroundStyle(Palette.muted)
                                }
                                Spacer()
                                if !(secrets[k.0] ?? "").isEmpty {
                                    Button("Quitar") { Task { await removeSecret(k.0) } }.foregroundStyle(Palette.destructive).buttonStyle(.plain)
                                        .accessibilityLabel("Quitar la clave de \(k.1)")
                                }
                            }
                            HStack(spacing: 8) {
                                SecureField(k.3, text: Binding(get: { secrets[k.0] ?? "" }, set: { secrets[k.0] = $0 }))
                                    .textFieldStyle(.plain).padding(.horizontal, 14).frame(minHeight: 44).background(Palette.secondary, in: Capsule())
                                    .accessibilityLabel("Clave de \(k.1)")
                                Button("Guardar") { Task { await saveSecret(k.0, (secrets[k.0] ?? "").trimmingCharacters(in: .whitespaces), "Clave guardada") } }
                                    .font(.apSubhead.weight(.semibold)).foregroundStyle(Palette.gold).padding(.horizontal, 14).frame(minHeight: 44)
                                    .background(Palette.gold.opacity(0.15), in: Capsule()).buttonStyle(.plain)
                            }
                        }
                        .padding(16)
                        .overlay(alignment: .top) { if i > 0 { Rectangle().fill(Palette.separator).frame(height: 0.5).padding(.leading, 16) } }
                    }
                }
                .background(Palette.card, in: RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
            }
        }
    }

    private func move(_ pid: String, _ dir: Int) {
        var order = textOrder
        guard let i = order.firstIndex(of: pid), order.indices.contains(i + dir) else { return }
        order.swapAt(i, i + dir)
        let enabled = textEnabled
        Task { await saveSecret("AI_TEXT_ORDER", order.filter { enabled.contains($0) }.joined(separator: ","), "Orden de IA guardado") }
    }

    private func toggleProvider(_ pid: String, _ on: Bool) {
        var enabled = textEnabled
        if on { enabled.insert(pid) } else { enabled.remove(pid) }
        guard !enabled.isEmpty else { show("Deja al menos una IA activa"); return }
        Task { await saveSecret("AI_TEXT_ORDER", textOrder.filter { enabled.contains($0) }.joined(separator: ","), "Orden de IA guardado") }
    }

    // MARK: Piezas

    private func section<C: View>(_ title: String, _ description: String?, @ViewBuilder content: () -> C) -> some View {
        VStack(alignment: .leading, spacing: 16) {
            SectionTitle(title: title, hint: description)
            content()
        }
    }

    private func group<C: View>(@ViewBuilder content: () -> C) -> some View {
        VStack(spacing: 0) { content() }.background(Palette.card, in: RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
    }

    private func field(_ placeholder: String, _ value: Binding<String>) -> some View {
        TextField(placeholder, text: value, axis: .vertical).textFieldStyle(.plain)
            .padding(.horizontal, 14).padding(.vertical, 10).background(Palette.secondary, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
    }

    private func settingToggle(_ title: String, _ subtitle: String?, _ key: String, first: Bool = false) -> some View {
        Toggle(isOn: Binding(get: { settings.bool(key) }, set: { v in settings[key] = .bool(v); Task { await saveFields([key]) } })) {
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(.apBody)
                if let subtitle { Text(subtitle).font(.apFootnote).foregroundStyle(Palette.muted) }
            }
        }
        .tint(Palette.gold).padding(.vertical, 6).rowStyle(first: first)
    }

    private func settingNumber(_ title: String, _ subtitle: String?, _ key: String, first: Bool = false, autosave: Bool = true) -> some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(.apBody)
                if let subtitle { Text(subtitle).font(.apFootnote).foregroundStyle(Palette.muted) }
            }
            Spacer()
            TextField("0", text: Binding(get: { settings.str(key) }, set: { settings[key] = .integer(Int($0) ?? 0) }))
                .textFieldStyle(.plain).multilineTextAlignment(.trailing).frame(width: 64, height: 36)
                .padding(.horizontal, 8).background(Palette.secondary, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
                .onSubmit { if autosave { Task { await saveFields([key]) } } }
                .accessibilityLabel(title)
        }
        .padding(.vertical, 6).rowStyle(first: first)
    }

    private func settingText(_ title: String, _ placeholder: String, _ key: String, first: Bool = false) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title).font(.apFootnote).foregroundStyle(Palette.muted)
            TextField(placeholder, text: Binding(get: { settings.str(key) }, set: { settings[key] = .string($0) }), axis: .vertical).textFieldStyle(.plain)
        }
        .padding(.vertical, 8).rowStyle(first: first)
    }

    // MARK: Datos

    private func load() async {
        let rows: [Row] = (try? await Backend.client.from("settings")
            .select("id, trainer_name, trainer_photo_url, trainer_bio, contact_phone, hero_video_url, hero_video_poster_url, app_store_url, play_store_url, show_app_download, transformation_slots, show_blog, show_ebooks, show_recommendations, recommendations, landing_ebooks_count, landing_recommendations_count")
            .limit(1).execute().value) ?? []
        settings = rows.first ?? [:]
        let sl: [[String: AnyJSON]] = (try? await Backend.client.from("settings").select("social_links").limit(1).execute().value) ?? []
        if case .object(let o) = sl.first?["social_links"] { for (k, v) in o { if case .string(let s) = v { social[k] = s } } }
        if let data = try? JSONEncoder().encode(settings["recommendations"] ?? .array([])) { recs = (try? JSONDecoder().decode([Recommendation].self, from: data)) ?? [] }
        struct S: Decodable { let key: String; let value: String }
        let s: [S] = (try? await Backend.client.from("app_secrets").select("key, value").execute().value) ?? []
        secrets = Dictionary(s.map { ($0.key, $0.value) }, uniquingKeysWith: { a, _ in a })
        testimonials = (try? await Backend.client.from("site_testimonials").select("id, name, result, text, sort_order, photo_url").order("sort_order").execute().value) ?? []
        loading = false
    }

    private func saveFields(_ keys: [String]) async {
        guard !id.isEmpty else { return }
        var patch: Row = [:]
        for k in keys { patch[k] = settings[k] ?? .null }
        do { try await Backend.client.from("settings").update(patch).eq("id", value: id).execute(); show("Guardado") }
        catch { show("No se pudo guardar") }
    }

    private func saveRecs() async {
        guard !id.isEmpty else { return }
        struct U: Encodable { let recommendations: [Recommendation] }
        do { try await Backend.client.from("settings").update(U(recommendations: recs)).eq("id", value: id).execute(); show("Recomendaciones guardadas") }
        catch { show("No se pudo guardar") }
    }

    private func saveSecret(_ key: String, _ value: String, _ ok: String) async {
        struct U: Encodable { let key: String; let value: String; let updated_at: String }
        do {
            try await Backend.client.from("app_secrets").upsert(U(key: key, value: value, updated_at: ISO8601DateFormatter().string(from: Date()))).execute()
            secrets[key] = value; show(ok)
        } catch { show("No se pudo guardar") }
    }

    private func removeSecret(_ key: String) async {
        do { try await Backend.client.from("app_secrets").delete().eq("key", value: key).execute(); secrets[key] = nil; show("Clave quitada") }
        catch { show("No se pudo quitar") }
    }

    private func addTestimonial() async {
        struct I: Encodable { let name: String; let text: String; let sort_order: Int }
        if let t: Testimonial = try? await Backend.client.from("site_testimonials").insert(I(name: "", text: "", sort_order: testimonials.count))
            .select("id, name, result, text, sort_order, photo_url").single().execute().value { testimonials.append(t) }
    }

    private func saveTestimonial(_ t: Testimonial) async {
        struct U: Encodable { let name: String; let result: String?; let text: String }
        do { try await Backend.client.from("site_testimonials").update(U(name: t.name, result: t.result, text: t.text)).eq("id", value: t.id).execute(); show("Testimonio guardado") }
        catch { show("No se pudo guardar") }
    }

    private func deleteTestimonial(_ t: Testimonial) async {
        _ = try? await Backend.client.from("site_testimonials").delete().eq("id", value: t.id).execute()
        testimonials.removeAll { $0.id == t.id }
    }

    private func show(_ t: String) { toast = t; Task { try? await Task.sleep(for: .seconds(2)); toast = nil } }
}
