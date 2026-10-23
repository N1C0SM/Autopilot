import SwiftUI
import WebKit
import Supabase

/// Emails, calcado de `EmailTemplatesEditor.tsx`: plantilla, personalización activa, asunto, variables,
/// HTML y vista previa. Guarda en `email_template_overrides`; el diseño por defecto llega de `render-email-template`.
struct AdminEmailsView: View {
    private static let templates: [(name: String, label: String, placeholders: [String])] = [
        ("scan-diagnosis", "Scan Diagnosis (resultado del AI scan)", ["name", "headline", "summary", "monthsWithPlan", "monthsWithoutPlan", "SCAN_IMAGE_URL", "cardImageUrl", "photoUrl", "reportUrl"]),
        ("mini-plan", "Mini Plan (plan gratis post-onboarding)", ["insight", "mistake", "action", "ctaUrl"]),
        ("payment-reminder", "Payment Reminder (recordatorio de pago)", ["name", "customMessage", "checkoutUrl"]),
        ("renewal-no-answer", "Renovación sin respuesta (Transformación 12 semanas)", ["name", "cycleEndDate", "manageUrl"]),
    ]

    @State private var selected = "scan-diagnosis"
    @State private var subject = ""
    @State private var html = ""
    @State private var enabled = true
    @State private var hasOverride = false
    @State private var loading = true
    @State private var saving = false
    @State private var showPreview = false
    @State private var confirmReset = false
    @State private var confirmDefault = false
    @State private var toast: String?

    private var current: (name: String, label: String, placeholders: [String]) { Self.templates.first { $0.name == selected } ?? Self.templates[0] }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                Text("Personaliza el asunto y el HTML de cada email transaccional. Si está desactivado, se usa el diseño por defecto.")
                    .font(.apSubhead).foregroundStyle(Palette.muted)
                VStack(alignment: .leading, spacing: 6) {
                    Text("Plantilla").font(.apSubhead).foregroundStyle(Palette.muted)
                    Picker("Plantilla", selection: $selected) {
                        ForEach(Self.templates, id: \.name) { Text($0.label).tag($0.name) }
                    }
                    .labelsHidden().pickerStyle(.menu).tint(Palette.gold)
                }
                if loading { ProgressView().frame(maxWidth: .infinity).padding(.top, 40) } else {
                    Toggle(isOn: $enabled) {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Personalización activa").font(.apBody)
                            Text(hasOverride ? "Estás usando una versión personalizada" : "Sin personalizar (se usa el diseño por defecto)")
                                .font(.apFootnote).foregroundStyle(Palette.muted)
                        }
                    }
                    .tint(Palette.gold).padding(16)
                    .background(Palette.card, in: RoundedRectangle(cornerRadius: Radius.card, style: .continuous))

                    VStack(alignment: .leading, spacing: 6) {
                        Text("Asunto").font(.apSubhead).foregroundStyle(Palette.muted)
                        PillField(label: "Asunto del email", text: $subject)
                    }
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Variables").font(.apSubhead).foregroundStyle(Palette.muted)
                        FlowRow {
                            ForEach(current.placeholders, id: \.self) { p in
                                Button("{{\(p)}}") { html += "{{\(p)}}"; Haptics.tap() }
                                    .font(.system(.footnote, design: .monospaced)).padding(.horizontal, 10).frame(minHeight: 32)
                                    .background(Palette.secondary, in: Capsule()).buttonStyle(.plain)
                                    .accessibilityLabel("Insertar {{\(p)}}")
                            }
                        }
                    }
                    VStack(alignment: .leading, spacing: 6) {
                        Text("HTML").font(.apSubhead).foregroundStyle(Palette.muted)
                        TextEditor(text: $html)
                            .font(.system(.caption, design: .monospaced))
                            .scrollContentBackground(.hidden)
                            .padding(10).frame(minHeight: 360)
                            .background(Palette.card, in: RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
                    }
                    VStack(spacing: 0) {
                        actionRow("Previsualizar", first: true) { showPreview = true }
                        actionRow("Cargar HTML por defecto") { confirmDefault = true }
                        if hasOverride { actionRow("Restaurar por defecto", destructive: true) { confirmReset = true } }
                    }
                    .background(Palette.card, in: RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
                    Button { Task { await save() } } label: { if saving { ProgressView().tint(.black) } else { Text("Guardar") } }
                        .buttonStyle(.pill).disabled(saving)
                }
            }
            .padding(20).frame(maxWidth: .infinity, alignment: .leading)
        }
        .screenBackground()
        .overlay(alignment: .top) { ToastView(text: toast) }
        .task(id: selected) { await load() }
        .sheet(isPresented: $showPreview) {
            NavigationStack {
                HTMLView(html: html).navigationTitle(subject)
                    .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Listo") { showPreview = false } } }
            }
            .frame(minWidth: 640, minHeight: 720)
        }
        .confirmationDialog("¿Restaurar la plantilla por defecto?", isPresented: $confirmReset, titleVisibility: .visible) {
            Button("Restaurar", role: .destructive) { Task { await reset() } }
            Button("Cancelar", role: .cancel) {}
        } message: { Text("Se borrará tu personalización.") }
        .confirmationDialog("¿Cargar el HTML por defecto?", isPresented: $confirmDefault, titleVisibility: .visible) {
            Button("Cargar") { Task { await loadDefault() } }
            Button("Cancelar", role: .cancel) {}
        } message: { Text("Se sobrescribirá lo que tengas escrito en el editor. No se guardará hasta que pulses Guardar.") }
    }

    private func actionRow(_ title: String, destructive: Bool = false, first: Bool = false, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title).font(.apBody).foregroundStyle(destructive ? Palette.destructive : Palette.gold)
                .frame(maxWidth: .infinity, alignment: .leading).contentShape(Rectangle())
        }
        .buttonStyle(.plain).rowStyle(first: first)
    }

    private struct Rendered: Decodable { let subject: String?; let html: String? }

    private func load() async {
        loading = true; defer { loading = false }
        struct O: Decodable { let subject: String; let html: String; let enabled: Bool }
        let rows: [O] = (try? await Backend.client.from("email_template_overrides").select("subject, html, enabled").eq("template_name", value: selected).limit(1).execute().value) ?? []
        if let o = rows.first {
            subject = o.subject; html = o.html; enabled = o.enabled; hasOverride = true
        } else if let d: Rendered = try? await Backend.client.functions.invoke("render-email-template", options: FunctionInvokeOptions(body: ["templateName": selected])) {
            subject = d.subject ?? ""; html = d.html ?? ""; enabled = true; hasOverride = false
        } else { show("No se pudo cargar la plantilla") }
    }

    private func loadDefault() async {
        if let d: Rendered = try? await Backend.client.functions.invoke("render-email-template", options: FunctionInvokeOptions(body: ["templateName": selected])) {
            subject = d.subject ?? ""; html = d.html ?? ""; show("HTML por defecto cargado")
        } else { show("Error al cargar el HTML por defecto") }
    }

    private func save() async {
        guard !subject.trimmingCharacters(in: .whitespaces).isEmpty, !html.trimmingCharacters(in: .whitespaces).isEmpty else { show("Asunto y HTML son obligatorios"); return }
        saving = true; defer { saving = false }
        struct U: Encodable { let template_name: String; let subject: String; let html: String; let enabled: Bool }
        do {
            try await Backend.client.from("email_template_overrides")
                .upsert(U(template_name: selected, subject: subject.trimmingCharacters(in: .whitespaces), html: html, enabled: enabled), onConflict: "template_name").execute()
            hasOverride = true; Haptics.success(); show("Plantilla guardada")
        } catch { Haptics.error(); show("No se pudo guardar") }
    }

    private func reset() async {
        do {
            try await Backend.client.from("email_template_overrides").delete().eq("template_name", value: selected).execute()
            show("Restaurada"); await load()
        } catch { show("Error al restaurar") }
    }

    private func show(_ t: String) { toast = t; Task { try? await Task.sleep(for: .seconds(2.5)); toast = nil } }
}

/// Muestra HTML (vista previa de emails).
struct HTMLView {
    let html: String
}

#if os(iOS)
extension HTMLView: UIViewRepresentable {
    func makeUIView(context: Context) -> WKWebView { WKWebView() }
    func updateUIView(_ view: WKWebView, context: Context) { view.loadHTMLString(html, baseURL: nil) }
}
#else
extension HTMLView: NSViewRepresentable {
    func makeNSView(context: Context) -> WKWebView { WKWebView() }
    func updateNSView(_ view: WKWebView, context: Context) { view.loadHTMLString(html, baseURL: nil) }
}
#endif
