import SwiftUI
import Supabase

/// Recordatorios, calcado de `PaymentReminders.tsx`: usuarios sin pagar, selección, espera
/// de 3 días por usuario y envío con `send-payment-reminder`.
struct AdminRemindersView: View {
    @StateObject private var data = AdminData()
    @State private var search = ""
    @State private var selected: Set<String> = []
    @State private var lastSent: [String: Date] = [:]
    @State private var composing = false
    @State private var subject = "Tu plan personalizado te está esperando"
    @State private var bodyText = "Te registraste en Autopilot pero todavía no has activado tu plan. Tu entrenamiento + nutrición personalizados están listos para empezar a transformar tu rutina.\n\nSolo te llevará 1 minuto. Empieza hoy y recibe tu plan completo en Google Calendar mañana mismo."
    @State private var sending = false
    @State private var toast: String?

    private var unpaid: [AdminData.Profile] { data.profiles.filter { $0.payment_status != "paid" } }
    private var filtered: [AdminData.Profile] { search.isEmpty ? unpaid : unpaid.filter { ($0.email ?? "").localizedCaseInsensitiveContains(search) } }
    private func daysSince(_ id: String) -> Int? { lastSent[id].map { Int(Date().timeIntervalSince($0) / 86400) } }

    var body: some View {
        ScrollView {
            if !data.loaded {
                AdminLoadingView(message: "Cargando los usuarios sin pagar")
            } else if data.failed {
                AdminErrorCard(message: "No se pudieron cargar los usuarios sin pagar. Comprueba la conexión y vuelve a intentarlo.") {
                    data.loaded = false
                    Task { await reload() }
                }
                .padding(20)
            } else {
                VStack(alignment: .leading, spacing: 24) {
                    AdminPaneHeader("\(unpaid.count) usuario\(unpaid.count == 1 ? "" : "s") registrado\(unpaid.count == 1 ? "" : "s") sin pagar. Se puede reenviar cada 3 días por usuario.") {
                        PillField(label: "Buscar por email…", text: $search, contentType: .email)
                            .frame(maxWidth: 420)
                    }
                    HStack(spacing: 16) {
                        AdminTextButton(title: "Seleccionar todos (\(filtered.count))") {
                            selected = Set(filtered.map(\.user_id)); Haptics.selection()
                        }
                        if !selected.isEmpty {
                            AdminTextButton(title: "Limpiar (\(selected.count))", tint: Palette.muted) {
                                selected = []; Haptics.selection()
                            }
                        }
                        Spacer(minLength: 0)
                    }
                    Button("Enviar recordatorio a \(selected.count)") { composing = true }
                        .buttonStyle(.pill).frame(maxWidth: 360).disabled(selected.isEmpty)

                    if filtered.isEmpty {
                        EmptyStateView(symbol: "envelope", title: "No hay usuarios sin pagar",
                                       message: "Cuando alguien se registre y no pague, aparecerá aquí.")
                    } else {
                        AdminRows {
                            ForEach(Array(filtered.enumerated()), id: \.element.id) { i, u in
                                let ds = daysSince(u.user_id)
                                Button {
                                    if selected.contains(u.user_id) { selected.remove(u.user_id) } else { selected.insert(u.user_id) }
                                    Haptics.selection()
                                } label: {
                                    AdminListRow(u.email ?? "", detail: registration(u, ds)) {
                                        Image(systemName: selected.contains(u.user_id) ? "checkmark.circle.fill" : "circle")
                                            .font(.inter(size: 22))
                                            .foregroundStyle(selected.contains(u.user_id) ? Palette.gold : Palette.muted)
                                            .frame(width: 32, height: 32)
                                            .accessibilityHidden(true)
                                    } trailing: {
                                        if let ds, ds < 3 {
                                            AdminStatusPill(text: "En espera")
                                        } else if ds != nil {
                                            AdminStatusPill(text: "Enviado", tint: Palette.success)
                                        }
                                    }
                                    .contentShape(Rectangle())
                                }
                                .buttonStyle(.plain)
                                .accessibilityLabel("Seleccionar \(u.email ?? "")")
                                .accessibilityAddTraits(selected.contains(u.user_id) ? .isSelected : [])
                                .adminRowDivider(first: i == 0, leading: 60)
                            }
                        }
                    }
                }
                .padding(20).frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .screenBackground()
        .overlay(alignment: .top) { ToastView(text: toast) }
        .task { await reload() }
        .refreshable { await reload() }
        .sheet(isPresented: $composing) { composer }
    }

    private func registration(_ u: AdminData.Profile, _ ds: Int?) -> String {
        let date = u.createdDate?.formatted(.dateTime.day().month(.abbreviated).locale(Locale(identifier: "es_ES"))) ?? ""
        var parts = [date.isEmpty ? nil : "Registrado \(date)"]
        if let ds { parts.append(ds == 0 ? "Último email hoy" : "Último email hace \(ds)d") }
        return parts.compactMap { $0 }.joined(separator: " · ")
    }

    private var composer: some View {
        NavigationStack {
            Form {
                Section("Asunto") { TextField("Asunto", text: $subject) }
                Section { TextEditor(text: $bodyText).frame(minHeight: 160) } header: { Text("Mensaje") } footer: {
                    Text("El email incluye un botón \"Activar mi plan\" automáticamente.")
                }
            }
            .formStyle(.grouped)
            .navigationTitle("Recordatorio a \(selected.count) usuario\(selected.count == 1 ? "" : "s")")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancelar") { composing = false }.disabled(sending) }
                ToolbarItem(placement: .confirmationAction) {
                    Button { Task { await send() } } label: { if sending { BrandLoader() } else { Text("Enviar") } }.disabled(sending)
                }
            }
        }
        .frame(minWidth: 480, minHeight: 460)
        .tint(Palette.gold)
    }

    private func reload() async {
        await data.load()
        await loadSent()
    }

    private func loadSent() async {
        struct R: Decodable { let user_id: String; let sent_at: String }
        let rows: [R] = (try? await Backend.client.from("payment_reminders").select("user_id, sent_at").order("sent_at", ascending: false).execute().value) ?? []
        var map: [String: Date] = [:]
        let iso = ISO8601DateFormatter(); iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        for r in rows where map[r.user_id] == nil { map[r.user_id] = iso.date(from: r.sent_at) ?? ISO8601DateFormatter().date(from: r.sent_at) }
        lastSent = map
    }

    private func send() async {
        sending = true
        var ok = 0, skip = 0, fail = 0
        let me = Backend.client.auth.currentUser?.id
        struct Body: Encodable { let recipientEmail: String; let idempotencyKey: String; let templateData: T
            struct T: Encodable { let name: String; let customMessage: String; let checkoutUrl: String } }
        struct Sent: Decodable { let sent: Bool? }
        struct Insert: Encodable { let user_id: String; let recipient_email: String; let subject: String; let body: String; let sent_by: UUID? }
        for u in unpaid where selected.contains(u.user_id) {
            if let ds = daysSince(u.user_id), ds < 3 { skip += 1; continue }
            let email = u.email ?? ""
            do {
                let r: Sent = try await Backend.client.functions.invoke("send-payment-reminder", options: FunctionInvokeOptions(body: Body(
                    recipientEmail: email, idempotencyKey: "pay-reminder-\(u.user_id)-\(Int(Date().timeIntervalSince1970 * 1000))",
                    templateData: .init(name: email.components(separatedBy: "@").first ?? "", customMessage: bodyText, checkoutUrl: "https://autopilotplan.com/dashboard"))))
                guard r.sent == true else { skip += 1; continue }
                try await Backend.client.from("payment_reminders").insert(Insert(user_id: u.user_id, recipient_email: email, subject: subject, body: bodyText, sent_by: me)).execute()
                ok += 1
            } catch { fail += 1 }
        }
        sending = false; composing = false; selected = []
        fail > 0 ? Haptics.warning() : Haptics.success()
        show("Enviados: \(ok)\(skip > 0 ? " · Saltados (cooldown 3d): \(skip)" : "")\(fail > 0 ? " · Fallidos: \(fail)" : "")")
        await loadSent()
    }

    private func show(_ t: String) { toast = t; Task { try? await Task.sleep(for: .seconds(3)); toast = nil } }
}

/// Pagos, calcado de `PaymentModeToggle.tsx`: modo de pago (pruebas/producción) y enlaces de Stripe.
struct AdminPaymentsView: View {
    struct Book: Codable, Identifiable { let id: String; let title: String; let kind: String; let price: String?; var buy_url_test: String?; var buy_url_live: String? }
    @State private var settingsId: String?
    @State private var mode = "test"
    @State private var links: [String: String] = [:]
    @State private var books: [Book] = []
    @State private var loading = true
    @State private var failed = false
    @State private var saving = false
    @State private var toast: String?

    private static let plans = [("training", "Entrenamiento", "14,99€/mes"), ("full", "Completo", "49€/mes"), ("transform", "Transformación 12 semanas", "299€ pago único")]

    var body: some View {
        ScrollView {
            if loading {
                AdminLoadingView(message: "Cargando la configuración de pagos")
            } else if failed {
                AdminErrorCard(message: "No se pudo cargar la configuración de pagos. Comprueba la conexión y vuelve a intentarlo.") {
                    Task { await load() }
                }
                .padding(20)
            } else {
                VStack(alignment: .leading, spacing: 24) {
                    AdminPaneHeader("Elige si los cobros van en pruebas o en producción y pega el enlace de cada plan, libro y pack. Se usa siempre el del modo activo.") {
                        Button { Task { await save() } } label: { if saving { BrandLoader().tint(.black) } else { Text("Guardar configuración") } }
                            .buttonStyle(.pill).frame(maxWidth: 360).disabled(saving)
                    }

                    ListGroupView(header: "Modo de pago") {
                        HStack(spacing: 12) {
                            VStack(alignment: .leading, spacing: 2) {
                                Text("Modo de pago").font(.apBody)
                                (Text("Activo: ").foregroundColor(Palette.muted) + Text(mode == "live" ? "producción" : "pruebas").foregroundColor(mode == "live" ? Palette.destructive : Palette.gold))
                                    .font(.apFootnote)
                            }
                            Spacer(minLength: 12)
                            AdminSmallAction(title: "Cambiar a \(mode == "test" ? "producción" : "pruebas")") {
                                Task { await toggleMode() }
                            }
                            .disabled(saving)
                            .accessibilityHint("Cambia el modo de cobro de todos los enlaces")
                        }
                        .rowStyle(first: true)
                    }

                    VStack(alignment: .leading, spacing: 12) {
                        SectionTitle(title: "Payment Links de Stripe", hint: "Pega el enlace de cada plan, en pruebas y en producción. Se usa el del modo activo.")
                        ForEach(Self.plans, id: \.0) { key, label, price in
                            ListGroupView(header: "\(label) · \(price)") {
                                linkRow("Pruebas", "https://buy.stripe.com/test_...", binding("payment_link_\(key)_test"), first: true)
                                linkRow("Producción", "https://buy.stripe.com/...", binding("payment_link_\(key)_live"))
                            }
                        }
                    }

                    VStack(alignment: .leading, spacing: 12) {
                        SectionTitle(title: "Libros y packs", hint: "Enlaces de Stripe de todo el Drive. Se usa el del modo activo.")
                        if books.isEmpty {
                            EmptyStateView(symbol: "book", title: "Aún no hay libros ni packs",
                                           message: "Crea libros o packs en el Drive y aparecerán aquí.")
                        }
                        ForEach($books) { $b in
                            ListGroupView(header: "\(b.title) · \(b.kind == "pack" ? "Pack" : "Libro")\(b.price.map { " · \($0)" } ?? "")") {
                                linkRow("Pruebas", "https://buy.stripe.com/test_...", Binding(get: { b.buy_url_test ?? "" }, set: { b.buy_url_test = $0 }), first: true)
                                linkRow("Producción", "https://buy.stripe.com/...", Binding(get: { b.buy_url_live ?? "" }, set: { b.buy_url_live = $0 }))
                            }
                        }
                    }

                    Text("Los webhook secrets de Stripe se gestionan de forma segura como secretos del servidor (no en la base de datos). Si necesitas rotarlos, hazlo desde la configuración de secretos del backend.")
                        .font(.apFootnote).foregroundStyle(Palette.muted).padding(.horizontal, 16)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .padding(20).frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .screenBackground()
        .overlay(alignment: .top) { ToastView(text: toast) }
        .task { await load() }
        .refreshable { await load() }
    }

    private func binding(_ key: String) -> Binding<String> { Binding(get: { links[key] ?? "" }, set: { links[key] = $0 }) }

    private func linkRow(_ label: String, _ placeholder: String, _ value: Binding<String>, first: Bool = false) -> some View {
        HStack(spacing: 12) {
            Text(label).font(.apBody).frame(width: 100, alignment: .leading)
                .lineLimit(1).minimumScaleFactor(0.8)
            TextField(placeholder, text: value)
                .adminField(monospaced: true)
                .textContentTypeCompat(.username)
                .accessibilityLabel("Enlace de pago, \(label)")
        }
        .padding(.vertical, 6)
        .rowStyle(first: first)
    }

    private static let fields = ["payment_link_training_test", "payment_link_training_live", "payment_link_full_test", "payment_link_full_live", "payment_link_transform_test", "payment_link_transform_live"]

    private func load() async {
        loading = true
        do {
            books = try await Backend.client.from("library_books").select("id, title, kind, price, buy_url_test, buy_url_live")
                .in("kind", values: ["book", "pack"]).order("sort_order").execute().value
            if let rows: [[String: AnyJSON]] = try await Backend.client.from("settings").select("id, payment_mode, " + Self.fields.joined(separator: ", ")).limit(1).execute().value,
               let s = rows.first {
                if case .string(let id) = s["id"] { settingsId = id }
                if case .string(let m) = s["payment_mode"] { mode = m == "live" ? "live" : "test" }
                for f in Self.fields { if case .string(let v) = s[f] { links[f] = v } }
            }
            failed = false
        } catch {
            failed = true
        }
        loading = false
    }

    private func toggleMode() async {
        guard let id = settingsId else { return }
        let next = mode == "test" ? "live" : "test"
        saving = true; defer { saving = false }
        do {
            try await Backend.client.from("settings").update(["payment_mode": next]).eq("id", value: id).execute()
            mode = next; show("Modo cambiado a \(next == "live" ? "producción" : "pruebas")")
        } catch { show("Error al cambiar modo") }
    }

    private func save() async {
        guard let id = settingsId else { return }
        saving = true; defer { saving = false }
        do {
            var payload: [String: String] = [:]
            for f in Self.fields { payload[f] = links[f] ?? "" }
            try await Backend.client.from("settings").update(payload).eq("id", value: id).execute()
            struct U: Encodable { let buy_url_test: String?; let buy_url_live: String? }
            for b in books {
                let t = b.buy_url_test?.trimmingCharacters(in: .whitespaces), l = b.buy_url_live?.trimmingCharacters(in: .whitespaces)
                try await Backend.client.from("library_books").update(U(buy_url_test: t?.isEmpty == false ? t : nil, buy_url_live: l?.isEmpty == false ? l : nil))
                    .eq("id", value: b.id).execute()
            }
            Haptics.success(); show("Configuración guardada")
        } catch { Haptics.error(); show("Error al guardar") }
    }

    private func show(_ t: String) { toast = t; Task { try? await Task.sleep(for: .seconds(2.5)); toast = nil } }
}

/// Aviso flotante (como los `toast` de la web). Respeta «Reducir movimiento».
struct ToastView: View {
    let text: String?
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        Group {
            if let text {
                Text(text)
                    .font(.apSubhead.weight(.semibold))
                    .multilineTextAlignment(.center)
                    .lineLimit(3)
                    .padding(.horizontal, 16).padding(.vertical, 10)
                    .background(.ultraThinMaterial, in: Capsule())
                    .padding(.top, 8)
                    .transition(reduceMotion ? .opacity : .move(edge: .top).combined(with: .opacity))
                    .accessibilityElement(children: .combine)
            }
        }
        .animation(reduceMotion ? nil : .easeOut(duration: 0.2), value: text)
        .onChange(of: text) { _, message in
            // VoiceOver: el aviso flotante también se anuncia, no solo se ve.
            guard let message, !message.isEmpty else { return }
            AccessibilityNotification.Announcement(message).post()
        }
    }
}
