import SwiftUI
import Supabase

/// Planes y productos, calcado de `ProductsAdmin.tsx` + `ConsumerPlansAdmin.tsx`: campaña Free y APK,
/// catálogo Free/Plus/Coach, usuarios por plan con entrenador, Autopilot para entrenadores y solicitudes.
struct AdminProductsView: View {
    typealias Row = [String: AnyJSON]
    struct Assign: Decodable { let user_id: String; let trainer_id: String }
    struct Role: Decodable { let user_id: String }
    struct Lead: Decodable, Identifiable { let id: String; let email: String?; let quiz_answers: [String: AnyJSON]?; let created_at: String }

    @StateObject private var data = AdminData()
    @State private var settingsId: String?
    @State private var campaign = false
    @State private var apk = true
    @State private var plans: [Row] = []
    @State private var trainerCfg: Row?
    @State private var assigns: [Assign] = []
    @State private var trainerIds: [String] = []
    @State private var leads: [Lead] = []
    @State private var filter = "pending"
    @State private var confirmEnable = false
    @State private var toast: String?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 32) {
                VStack(spacing: 0) {
                    toggleRow("Campaña Free / Ocultar Plus", "Oculta ofertas y cobros de planes. Abre sobrecarga progresiva y nutrición básica, sin chat ni calendario. No cambia suscripciones existentes.",
                              Binding(get: { campaign }, set: { v in Task { await setSetting("free_campaign", v) { campaign = v } } }), first: true)
                    toggleRow("Página de descarga del APK (/app)", "Si la apagas, /app y /descargar llevan a la portada. Úsalo cuando estés en Google Play y App Store.",
                              Binding(get: { apk }, set: { v in Task { await setSetting("apk_download_enabled", v) { apk = v } } }))
                }
                .background(Palette.card, in: RoundedRectangle(cornerRadius: Radius.card, style: .continuous))

                Text("Lo que cambies aquí se ve al momento en la portada y en /planes. Los enlaces de cobro siguen en Pagos.")
                    .font(.apSubhead).foregroundStyle(Palette.muted)
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 300), spacing: 16, alignment: .top)], spacing: 16) {
                    ForEach(plans.indices, id: \.self) { i in planCard(i) }
                }
                Text("Cambiar el precio aquí cambia lo que se muestra; el importe real lo cobra el enlace de Stripe configurado en Pagos, así que actualízalo también allí.")
                    .font(.apFootnote).foregroundStyle(Palette.muted).padding(.horizontal, 16)

                usersByPlan
                if trainerCfg != nil { trainerProduct }
                applications
            }
            .padding(20).frame(maxWidth: .infinity, alignment: .leading)
        }
        .screenBackground()
        .overlay(alignment: .top) { ToastView(text: toast) }
        .task { await load() }
        .confirmationDialog("¿Activar Autopilot para entrenadores?", isPresented: $confirmEnable, titleVisibility: .visible) {
            Button("Activar") { Task { await saveTrainer(["enabled": true]) } }
            Button("Cancelar", role: .cancel) {}
        } message: { Text("Los entrenadores con suscripción podrán invitar a sus propios clientes. Lo público depende además de «Visible públicamente».") }
    }

    // MARK: Catálogo

    private func planCard(_ i: Int) -> some View {
        let p = plans[i]
        let key = p.str("key")
        let visible = p.bool("enabled") && p.bool("publicly_visible")
        return VStack(alignment: .leading, spacing: 8) {
            Text(p.str("name").uppercased()).font(.apFootnote).foregroundStyle(Palette.muted).padding(.horizontal, 16)
            VStack(spacing: 0) {
                Toggle(visible ? "Visible en la web" : "Oculto", isOn: Binding(get: { visible }, set: { v in Task { await savePlan(key, ["enabled": .bool(v), "publicly_visible": .bool(v)]) } }))
                    .tint(Palette.gold).rowStyle(first: true)
                planField(i, "Nombre", "name")
                planField(i, "Frase corta", "tagline")
                planField(i, "Precio €/mes", "price", number: true)
                planField(i, "Días de prueba", "trial_days", number: true)
                planLines(i, "Incluye (una por línea)", "features")
                planLines(i, "No incluye (una por línea)", "not_included")
                planField(i, "Texto del botón", "cta")
                Toggle("Acepta altas nuevas", isOn: Binding(get: { p.bool("accepting_new_subscriptions") }, set: { v in Task { await savePlan(key, ["accepting_new_subscriptions": .bool(v)]) } }))
                    .tint(Palette.gold).rowStyle(first: false)
            }
            .background(Palette.card, in: RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
        }
    }

    private func planField(_ i: Int, _ label: String, _ field: String, number: Bool = false) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label).font(.apFootnote).foregroundStyle(Palette.muted)
            TextField(label, text: Binding(get: { plans[i].str(field) }, set: { plans[i][field] = number ? .double(Double($0.replacingOccurrences(of: ",", with: ".")) ?? 0) : .string($0) }))
                .textFieldStyle(.plain)
                .onSubmit { Task { await savePlan(plans[i].str("key"), [field: plans[i][field] ?? .null]) } }
        }
        .padding(.vertical, 8).rowStyle(first: false)
    }

    private func planLines(_ i: Int, _ label: String, _ field: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label).font(.apFootnote).foregroundStyle(Palette.muted)
            TextEditor(text: Binding(get: { plans[i].lines(field).joined(separator: "\n") },
                                     set: { plans[i][field] = .array($0.split(separator: "\n").map { .string($0.trimmingCharacters(in: .whitespaces)) }) }))
                .scrollContentBackground(.hidden).frame(minHeight: 90)
            Button("Guardar") { Task { await savePlan(plans[i].str("key"), [field: plans[i][field] ?? .array([])]) } }
                .font(.apFootnote).foregroundStyle(Palette.gold).buttonStyle(.plain)
        }
        .padding(.vertical, 8).rowStyle(first: false)
    }

    // MARK: Usuarios por plan

    private var usersByPlan: some View {
        let rows = data.profiles.map { p -> (AdminData.Profile, String?) in
            let tid = assigns.first { $0.user_id == p.user_id }?.trainer_id
            return (p, tid.map { t in data.profiles.first { $0.user_id == t }?.email ?? "—" })
        }
        let count = { (plan: String) in rows.filter { $0.0.plan == plan }.count }
        let pending = rows.filter { $0.0.plan == "coach" && $0.1 == nil }.count
        let visible = rows.filter { filter == "all" ? true : filter == "pending" ? ($0.0.plan == "coach" && $0.1 == nil) : $0.0.plan == filter }
        let filters = [("pending", "Coach sin entrenador (\(pending))"), ("free", "Free (\(count("free")))"), ("plus", "Plus (\(count("plus")))"), ("coach", "Coach (\(count("coach")))"), ("all", "Todos")]
        return VStack(alignment: .leading, spacing: 12) {
            SectionTitle(title: "Usuarios por plan")
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(filters, id: \.0) { k, l in
                        Button(l) { filter = k; Haptics.selection() }.font(.apSubhead.weight(.medium)).padding(.horizontal, 14).frame(minHeight: 36)
                            .foregroundStyle(filter == k ? Color.black : Palette.foreground)
                            .background(filter == k ? Palette.gold : Palette.secondary, in: Capsule()).buttonStyle(.plain)
                    }
                }
            }
            if visible.isEmpty { EmptyStateView(symbol: "person.2", title: "No hay usuarios en este grupo") } else {
                VStack(spacing: 0) {
                    ForEach(Array(visible.prefix(200).enumerated()), id: \.element.0.id) { i, pair in
                        let (p, trainer) = pair
                        HStack(alignment: .top) {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(p.name ?? p.email ?? "").font(.apBody)
                                if p.name != nil { Text(p.email ?? "").font(.apFootnote).foregroundStyle(Palette.muted) }
                                if p.plan == "coach" {
                                    Picker("Entrenador de \(p.display)", selection: Binding(
                                        get: { trainerIds.first { t in data.profiles.first { $0.user_id == t }?.email == trainer } ?? "" },
                                        set: { v in Task { await assign(p, v) } })) {
                                        Text("Sin entrenador").tag("")
                                        ForEach(trainerIds, id: \.self) { t in Text(data.profiles.first { $0.user_id == t }?.email ?? t).tag(t) }
                                    }
                                    .labelsHidden().pickerStyle(.menu).tint(Palette.gold)
                                }
                            }
                            Spacer()
                            Text(p.plan.capitalized).font(.apSubhead).foregroundStyle(Palette.muted)
                        }
                        .padding(.vertical, 10).rowStyle(first: i == 0)
                    }
                }
                .background(Palette.card, in: RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
            }
        }
    }

    // MARK: Autopilot para entrenadores

    private var trainerProduct: some View {
        let c = trainerCfg ?? [:]
        return VStack(alignment: .leading, spacing: 16) {
            SectionTitle(title: "Autopilot para entrenadores")
            VStack(alignment: .leading, spacing: 8) {
                Toggle("Producto activado", isOn: Binding(get: { c.bool("enabled") }, set: { v in if v { confirmEnable = true } else { Task { await saveTrainer(["enabled": false]) } } }))
                    .tint(Palette.gold).rowStyle(first: true)
                    .background(Palette.card, in: RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
                if !c.bool("enabled") {
                    Text("El producto está construido pero actualmente no está disponible públicamente.").font(.apFootnote).foregroundStyle(Palette.muted).padding(.horizontal, 16)
                }
            }
            VStack(spacing: 0) {
                trainerField("Nombre", "name", first: true)
                trainerField("Precio", "price", number: true)
                trainerField("Moneda", "currency")
                HStack {
                    Text("Periodicidad").font(.apBody)
                    Spacer()
                    Picker("Periodicidad", selection: Binding(get: { c.str("billing_interval") }, set: { v in Task { await saveTrainer(["billing_interval": .string(v)]) } })) {
                        Text("Mensual").tag("month"); Text("Anual").tag("year")
                    }
                    .labelsHidden().pickerStyle(.menu).tint(Palette.gold)
                }
                .rowStyle(first: false)
                trainerField("Máximo de clientes (interno, no se muestra)", "max_clients", number: true)
                trainerField("Enlace de pago Stripe (Payment Link)", "stripe_price_id_live")
                trainerField("Descripción", "description")
            }
            .background(Palette.card, in: RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
            VStack(spacing: 0) {
                Toggle("Visible públicamente", isOn: Binding(get: { c.bool("publicly_visible") }, set: { v in Task { await saveTrainer(["publicly_visible": .bool(v)]) } }))
                    .tint(Palette.gold).rowStyle(first: true)
                Toggle("Acepta nuevas altas", isOn: Binding(get: { c.bool("accepting_new_subscriptions") }, set: { v in Task { await saveTrainer(["accepting_new_subscriptions": .bool(v)]) } }))
                    .tint(Palette.gold).rowStyle(first: false)
            }
            .background(Palette.card, in: RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
        }
    }

    private func trainerField(_ label: String, _ field: String, number: Bool = false, first: Bool = false) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label).font(.apFootnote).foregroundStyle(Palette.muted)
            TextField(label, text: Binding(get: { trainerCfg?.str(field) ?? "" }, set: { trainerCfg?[field] = number ? .double(Double($0) ?? 0) : .string($0) }))
                .textFieldStyle(.plain)
                .onSubmit { Task { await saveTrainer([field: trainerCfg?[field] ?? .null]) } }
        }
        .padding(.vertical, 8).rowStyle(first: first)
    }

    // MARK: Solicitudes

    private var applications: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionTitle(title: "Solicitudes de entrenadores (\(leads.count))")
            if leads.isEmpty { EmptyStateView(symbol: "tray", title: "Aún no hay solicitudes") } else {
                VStack(spacing: 0) {
                    ForEach(Array(leads.enumerated()), id: \.element.id) { i, a in
                        let q = a.quiz_answers ?? [:]
                        HStack(alignment: .top) {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(q.str("name").isEmpty ? "—" : q.str("name")).font(.apBody)
                                Text("\(a.email ?? "")\(q.str("phone").isEmpty ? "" : " · \(q.str("phone"))")").font(.apFootnote).foregroundStyle(Palette.gold)
                                Text("\(q.str("clients")) clientes · \(q.str("tools")) · \(q.str("goal"))").font(.apFootnote).foregroundStyle(Palette.muted)
                            }
                            Spacer()
                            Text(String(a.created_at.prefix(10))).font(.apFootnote).foregroundStyle(Palette.muted)
                        }
                        .padding(.vertical, 10).rowStyle(first: i == 0)
                    }
                }
                .background(Palette.card, in: RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
            }
        }
    }

    private func toggleRow(_ title: String, _ subtitle: String, _ value: Binding<Bool>, first: Bool = false) -> some View {
        Toggle(isOn: value) {
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(.apBody)
                Text(subtitle).font(.apFootnote).foregroundStyle(Palette.muted)
            }
        }
        .tint(Palette.gold).padding(.vertical, 8).rowStyle(first: first)
    }

    // MARK: Datos

    private func load() async {
        await data.load()
        if let rows: [Row] = try? await Backend.client.from("settings").select("id, free_campaign, apk_download_enabled").limit(1).execute().value, let s = rows.first {
            settingsId = s.str("id"); campaign = s.bool("free_campaign")
            if case .bool(let b) = s["apk_download_enabled"] { apk = b }
        }
        plans = (try? await Backend.client.from("product_configs").select().in("key", values: ["free", "training", "full"]).order("sort_order").execute().value) ?? []
        let cfg: [Row] = (try? await Backend.client.from("product_configs").select().eq("key", value: "trainer_plan").limit(1).execute().value) ?? []
        trainerCfg = cfg.first
        assigns = (try? await Backend.client.from("trainer_assignments").select("user_id, trainer_id").eq("status", value: "active").execute().value) ?? []
        let roles: [Role] = (try? await Backend.client.from("user_roles").select("user_id").eq("role", value: "trainer").execute().value) ?? []
        trainerIds = roles.map(\.user_id)
        leads = (try? await Backend.client.from("leads").select("id, email, quiz_answers, created_at").eq("source", value: "trainer_application")
            .order("created_at", ascending: false).execute().value) ?? []
    }

    private func setSetting(_ field: String, _ value: Bool, onOK: () -> Void) async {
        guard let id = settingsId else { return }
        do {
            try await Backend.client.from("settings").update([field: value]).eq("id", value: id).execute()
            onOK(); Haptics.selection(); show("Guardado")
        } catch { show("No se pudo cambiar") }
    }

    private func savePlan(_ key: String, _ patch: Row) async {
        do {
            try await Backend.client.from("product_configs").update(patch).eq("key", value: key).execute()
            if let i = plans.firstIndex(where: { $0.str("key") == key }) { for (k, v) in patch { plans[i][k] = v } }
            show("Guardado")
        } catch { show("No se pudo guardar") }
    }

    private func saveTrainer(_ patch: Row) async {
        do {
            try await Backend.client.from("product_configs").update(patch).eq("key", value: "trainer_plan").execute()
            for (k, v) in patch { trainerCfg?[k] = v }
            show("Guardado")
        } catch { show("No se pudo guardar") }
    }

    private func assign(_ p: AdminData.Profile, _ trainerId: String) async {
        do {
            if trainerId.isEmpty {
                try await Backend.client.from("trainer_assignments").delete().eq("user_id", value: p.user_id).execute()
            } else {
                try await Backend.client.rpc("admin_assign_user_to_trainer", params: ["_trainer_id": trainerId, "_email": p.email ?? ""]).execute()
            }
            show(trainerId.isEmpty ? "Asignación retirada" : "Entrenador asignado")
            await load()
        } catch { show("No se pudo cambiar la asignación") }
    }

    private func show(_ t: String) { toast = t; Task { try? await Task.sleep(for: .seconds(2)); toast = nil } }
}

extension Dictionary where Key == String, Value == AnyJSON {
    func str(_ k: String) -> String {
        switch self[k] {
        case .string(let s): s
        case .integer(let i): String(i)
        case .double(let d): d.truncatingRemainder(dividingBy: 1) == 0 ? String(Int(d)) : String(d)
        default: ""
        }
    }
    func bool(_ k: String) -> Bool { if case .bool(let b) = self[k] { return b }; return false }
    func lines(_ k: String) -> [String] {
        if case .array(let a) = self[k] { return a.compactMap { if case .string(let s) = $0 { return s }; return nil } }
        return []
    }
}
