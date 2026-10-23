import SwiftUI
import PhotosUI
import Supabase

/// Ficha de usuario, como `UserDetail.tsx`: pestañas Plan · Perfil · Acceso · Progreso · Entreno · Nutrición · Chat.
struct AdminUserFullDetail: View {
    let userId: String
    let display: String
    let email: String

    @State private var tab = 0
    @State private var profile: [String: AnyJSON] = [:]
    @State private var onboarding: [String: AnyJSON] = [:]
    @State private var plan: [DayPlan] = []
    @State private var macros: [String: AnyJSON] = [:]
    @State private var isAdmin = false
    @State private var isTrainer = false
    @State private var isTest = false
    @State private var trainers: [(id: String, email: String)] = []
    @State private var trainerId = ""
    @State private var workouts30 = 0
    @State private var lastWeight: Double?
    @State private var toast: String?

    private static let tabs = ["Plan", "Perfil", "Acceso", "Progreso", "Entreno", "Nutrición", "Chat"]

    var body: some View {
        VStack(spacing: 0) {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(Self.tabs.indices, id: \.self) { i in
                        Button(Self.tabs[i]) { tab = i; Haptics.selection() }
                            .font(.apSubhead.weight(.medium)).padding(.horizontal, 14).frame(minHeight: 36)
                            .foregroundStyle(tab == i ? Color.black : Palette.foreground)
                            .background(tab == i ? Palette.gold : Palette.secondary, in: Capsule()).buttonStyle(.plain)
                    }
                }
                .padding(.horizontal, 20).padding(.vertical, 10)
            }
            if tab == 6 {
                ChatView(conversationUserId: userId)
            } else {
                ScrollView {
                    VStack(alignment: .leading, spacing: 20) {
                        HStack(spacing: 14) {
                            AvatarView(name: display, url: profile.str("avatar_url").nilIfEmpty, size: 56)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(display).font(.apTitle2)
                                Text(email).font(.apSubhead).foregroundStyle(Palette.muted)
                            }
                        }
                        switch tab {
                        case 0: planTab
                        case 1: perfilTab
                        case 2: accesoTab
                        case 3: progresoTab
                        case 4: entrenoTab
                        default: nutricionTab
                        }
                    }
                    .padding(20).frame(maxWidth: .infinity, alignment: .leading)
                }
            }
        }
        .screenBackground()
        .overlay(alignment: .top) { ToastView(text: toast) }
        .task { await load() }
    }

    // MARK: Plan

    private var currentPlan: String {
        let tier = profile.str("subscription_tier")
        guard profile.str("payment_status") == "paid" else { return "free" }
        return ["full", "transform", "personal", "coach"].contains(tier) ? "full" : (["training", "plus"].contains(tier) ? "training" : "free")
    }

    private var planTab: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("PLAN").font(.apFootnote).foregroundStyle(Palette.muted).padding(.horizontal, 16)
            HStack(spacing: 10) {
                ForEach([("free", "Free", "0"), ("training", "Plus", "14,99"), ("full", "Coach", "49")], id: \.0) { value, name, price in
                    let active = currentPlan == value
                    Button { Task { await setTier(value, name) } } label: {
                        VStack(spacing: 2) {
                            Text(name).font(.apHeadline)
                            Text("\(price) €/mes").font(.apFootnote.monospacedDigit())
                        }
                        .foregroundStyle(active ? Palette.gold : Palette.foreground)
                        .frame(maxWidth: .infinity, minHeight: 88)
                        .background(active ? Palette.gold.opacity(0.15) : Palette.card, in: RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
                    }
                    .buttonStyle(.plain).disabled(active)
                    .accessibilityAddTraits(active ? .isSelected : [])
                }
            }
            ListGroupView(header: "Estado") {
                info("Estado del plan", ["plan_ready": "Plan listo", "plan_pending": "Pendiente"][profile.str("plan_status")] ?? "Onboarding", first: true)
                info("Pago", profile.str("payment_status") == "paid" ? "Pagado" : "Sin pagar")
                info("Suscripción", profile.str("subscription_status").nilIfEmpty ?? "—")
                info("Alta", String(profile.str("created_at").prefix(10)))
            }
        }
    }

    // MARK: Perfil

    private var perfilTab: some View {
        Group {
            if onboarding.isEmpty {
                EmptyStateView(symbol: "person", title: "Aún no hay datos de perfil")
            } else {
                ListGroupView(header: "Datos") {
                    info("Edad", onboarding.str("age").nilIfEmpty ?? "—", first: true)
                    info("Altura", onboarding.str("height").nilIfEmpty.map { "\($0) cm" } ?? "—")
                    info("Peso", onboarding.str("weight").nilIfEmpty.map { "\($0) kg" } ?? "—")
                    info("Sexo", onboarding.str("sex").nilIfEmpty ?? "—")
                    info("Objetivo", ["lose_weight": "Perder peso", "gain_muscle": "Ganar músculo", "improve_endurance": "Mejorar resistencia"][onboarding.str("goal")] ?? "—")
                    info("Equipamiento", onboarding.str("equipment_type").nilIfEmpty ?? "—")
                    info("Lesiones", onboarding.str("injuries").nilIfEmpty ?? "—")
                    info("Alergias", onboarding.str("allergies").nilIfEmpty ?? "—")
                    info("Preferencias", onboarding.str("nutrition_preferences").nilIfEmpty ?? "—")
                }
            }
        }
    }

    // MARK: Acceso

    private var accesoTab: some View {
        VStack(alignment: .leading, spacing: 20) {
            ListGroupView(header: "Roles") {
                roleToggle("Administrador", "Puede gestionar la administración de Autopilot.", $isAdmin, "admin", first: true)
                roleToggle("Entrenador", "Puede entrar al panel de entrenador y gestionar clientes asignados.", $isTrainer, "trainer")
                Toggle(isOn: Binding(get: { isTest }, set: { v in Task { await setTest(v) } })) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Cuenta de prueba").font(.apBody)
                        Text("No cuenta en métricas ni estadísticas.").font(.apFootnote).foregroundStyle(Palette.muted)
                    }
                }
                .tint(Palette.gold).padding(.vertical, 6).rowStyle(first: false)
            }
            ListGroupView(header: "Entrenador asignado") {
                Picker("Entrenador", selection: Binding(get: { trainerId }, set: { v in Task { await assign(v) } })) {
                    Text("Sin entrenador").tag("")
                    ForEach(trainers, id: \.id) { Text($0.email).tag($0.id) }
                }
                .tint(Palette.gold).rowStyle(first: true)
            }
        }
    }

    private func roleToggle(_ title: String, _ subtitle: String, _ value: Binding<Bool>, _ role: String, first: Bool = false) -> some View {
        Toggle(isOn: Binding(get: { value.wrappedValue }, set: { v in Task { await setRole(role, v); value.wrappedValue = v } })) {
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(.apBody)
                Text(subtitle).font(.apFootnote).foregroundStyle(Palette.muted)
            }
        }
        .tint(Palette.gold).padding(.vertical, 6).rowStyle(first: first)
    }

    // MARK: Progreso, Entreno, Nutrición

    private var progresoTab: some View {
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 160), spacing: 12)], spacing: 12) {
            FigureTile(label: "Entrenos 30 días", value: "\(workouts30)", accent: true)
            FigureTile(label: "Peso", value: lastWeight.map { "\(NumberText.decimal($0)) kg" } ?? "—")
        }
    }

    private var entrenoTab: some View {
        Group {
            if plan.isEmpty { EmptyStateView(symbol: "calendar", title: "Sin plan de entrenamiento") } else {
                VStack(spacing: 12) {
                    ForEach(plan) { d in
                        Card {
                            Text(d.day).font(.apFootnote).foregroundStyle(Palette.muted)
                            Text(d.title).font(.apHeadline)
                            ForEach(d.exercises ?? []) { e in
                                HStack { Text(e.name).font(.apBody); Spacer(); Text("\(e.series) × \(e.reps)").font(.apSubhead.monospacedDigit()).foregroundStyle(Palette.muted) }
                            }
                        }
                    }
                }
            }
        }
    }

    private var nutricionTab: some View {
        Group {
            if macros.isEmpty { EmptyStateView(symbol: "fork.knife", title: "Sin plan de nutrición") } else {
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 140), spacing: 12)], spacing: 12) {
                    FigureTile(label: "Proteína", value: "\(macros.str("protein")) g")
                    FigureTile(label: "Carbohidratos", value: "\(macros.str("carbs")) g")
                    FigureTile(label: "Grasas", value: "\(macros.str("fats")) g")
                }
            }
        }
    }

    private func info(_ label: String, _ value: String, first: Bool = false) -> some View {
        HStack { Text(label).font(.apBody); Spacer(); Text(value).font(.apBody).foregroundStyle(Palette.muted).multilineTextAlignment(.trailing) }
            .padding(.vertical, 4).rowStyle(first: first)
    }

    // MARK: Datos

    private func load() async {
        let p: [[String: AnyJSON]] = (try? await Backend.client.from("profiles").select().eq("user_id", value: userId).limit(1).execute().value) ?? []
        profile = p.first ?? [:]
        let o: [[String: AnyJSON]] = (try? await Backend.client.from("onboarding").select().eq("user_id", value: userId).limit(1).execute().value) ?? []
        onboarding = o.first ?? [:]
        if let uid = UUID(uuidString: userId) { plan = (try? await TrainingRepo.plan(userId: uid)) ?? [] }
        struct N: Decodable { let macros_json: [String: AnyJSON]? }
        let n: [N] = (try? await Backend.client.from("nutrition_plan").select("macros_json").eq("user_id", value: userId).limit(1).execute().value) ?? []
        macros = n.first?.macros_json ?? [:]
        struct R: Decodable { let user_id: String; let role: String }
        let roles: [R] = (try? await Backend.client.from("user_roles").select("user_id, role").in("role", values: ["admin", "trainer"]).execute().value) ?? []
        isAdmin = roles.contains { $0.user_id == userId && $0.role == "admin" }
        isTrainer = roles.contains { $0.user_id == userId && $0.role == "trainer" }
        struct T: Decodable { let user_id: String }
        let tests: [T] = (try? await Backend.client.from("metrics_excluded_users").select("user_id").eq("user_id", value: userId).execute().value) ?? []
        isTest = !tests.isEmpty
        let trainerIds = roles.filter { $0.role == "trainer" }.map(\.user_id)
        struct E: Decodable { let user_id: String; let email: String? }
        let emails: [E] = trainerIds.isEmpty ? [] : ((try? await Backend.client.from("profiles").select("user_id, email").in("user_id", values: trainerIds).execute().value) ?? [])
        trainers = emails.map { ($0.user_id, $0.email ?? $0.user_id) }
        struct A: Decodable { let trainer_id: String }
        let a: [A] = (try? await Backend.client.from("trainer_assignments").select("trainer_id").eq("user_id", value: userId).limit(1).execute().value) ?? []
        trainerId = a.first?.trainer_id ?? ""
        struct C: Decodable { let id: String }
        let comps: [C] = (try? await Backend.client.from("day_completions").select("id").eq("user_id", value: userId).gte("completed_at", value: LocalDate.daysAgo(29)).execute().value) ?? []
        workouts30 = comps.count
        struct W: Decodable { let weight: Double? }
        let w: [W] = (try? await Backend.client.from("weight_logs").select("weight").eq("user_id", value: userId).order("logged_at", ascending: false).limit(1).execute().value) ?? []
        lastWeight = w.first?.weight
    }

    private func setTier(_ value: String, _ name: String) async {
        Haptics.selection()
        do {
            if value == "free" {
                try await Backend.client.from("profiles").update(["payment_status": "unpaid", "subscription_status": "inactive"]).eq("user_id", value: userId).execute()
            } else {
                let status = profile.str("plan_status") == "onboarding" ? "plan_pending" : profile.str("plan_status")
                try await Backend.client.from("profiles").update(["subscription_tier": value, "payment_status": "paid", "subscription_status": "active", "plan_status": status]).eq("user_id", value: userId).execute()
            }
            // Igual que la web: el plan manual queda marcado para que nada automático lo baje.
            _ = try? await Backend.client.from("entitlements").update(["status": "canceled"]).eq("user_id", value: userId).eq("source", value: "manual").execute()
            if value != "free" {
                struct E: Encodable { let user_id: String; let plan: String; let source: String; let status: String; let expires_at: String? }
                _ = try? await Backend.client.from("entitlements").upsert(E(user_id: userId, plan: value == "training" ? "plus" : "coach", source: "manual", status: "active", expires_at: nil), onConflict: "user_id,plan,source").execute()
            }
            show("Plan: \(name)")
            await load()
        } catch { show("No se pudo cambiar el plan") }
    }

    private func setRole(_ role: String, _ on: Bool) async {
        do {
            if on { try await Backend.client.from("user_roles").insert(["user_id": userId, "role": role]).execute() }
            else { try await Backend.client.from("user_roles").delete().eq("user_id", value: userId).eq("role", value: role).execute() }
            show("Rol actualizado")
        } catch { show("No se pudo cambiar el rol") }
    }

    private func setTest(_ on: Bool) async {
        do {
            if on { try await Backend.client.from("metrics_excluded_users").insert(["user_id": userId]).execute() }
            else { try await Backend.client.from("metrics_excluded_users").delete().eq("user_id", value: userId).execute() }
            isTest = on
        } catch { show("No se pudo cambiar") }
    }

    private func assign(_ trainer: String) async {
        do {
            try await Backend.client.from("trainer_assignments").delete().eq("user_id", value: userId).execute()
            if !trainer.isEmpty { try await Backend.client.from("trainer_assignments").insert(["trainer_id": trainer, "user_id": userId]).execute() }
            trainerId = trainer
            show(trainer.isEmpty ? "Asignación retirada" : "Entrenador asignado")
        } catch { show("No se pudo cambiar la asignación") }
    }

    private func show(_ t: String) { toast = t; Task { try? await Task.sleep(for: .seconds(2)); toast = nil } }
}

/// Chat privado (como `Chat.tsx`): mensajes de la conversación en tiempo casi real y envío de texto.
struct ChatView: View {
    let conversationUserId: String
    struct Message: Codable, Identifiable, Hashable { let id: String; let sender_id: String; let content: String; let media_url: String?; let media_type: String?; let created_at: String }
    @State private var messages: [Message] = []
    @State private var photo: PhotosPickerItem?
    @State private var pending: Data?
    @State private var text = ""
    @State private var sending = false
    private var me: String? { Backend.client.auth.currentUser?.id.uuidString.lowercased() }

    var body: some View {
        VStack(spacing: 0) {
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(spacing: 8) {
                        if messages.isEmpty { EmptyStateView(symbol: "bubble.left.and.bubble.right", title: "Sin mensajes todavía") }
                        ForEach(messages) { m in
                            let mine = m.sender_id.lowercased() == me
                            HStack {
                                if mine { Spacer(minLength: 40) }
                                VStack(alignment: .leading, spacing: 4) {
                                    if let u = m.media_url, let url = URL(string: u) {
                                        CachedAsyncImage(url: url) { $0.resizable().scaledToFit() } placeholder: { ProgressView() }.frame(maxWidth: 240)
                                    }
                                    Text(m.content).font(.apBody)
                                }
                                .padding(.horizontal, 14).padding(.vertical, 10)
                                .foregroundStyle(mine ? Color.black : Palette.foreground)
                                .background(mine ? Palette.gold : Palette.card, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
                                if !mine { Spacer(minLength: 40) }
                            }
                            .id(m.id)
                        }
                    }
                    .padding(16)
                }
                .onChange(of: messages.count) { _, _ in if let last = messages.last { withAnimation { proxy.scrollTo(last.id, anchor: .bottom) } } }
            }
            if let pending, let img = PlatformImage(data: pending) {
                HStack {
                    Image(platformImage: img).resizable().scaledToFill().frame(width: 64, height: 64).clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                    Button { self.pending = nil; photo = nil } label: { Image(systemName: "xmark.circle.fill").foregroundStyle(Palette.muted) }.buttonStyle(.plain).accessibilityLabel("Quitar foto")
                    Spacer()
                }
                .padding(.horizontal, 12)
            }
            HStack(spacing: 8) {
                PhotosPicker(selection: $photo, matching: .images) {
                    Image(systemName: "photo").font(.system(size: 18)).frame(width: 44, height: 44).background(Palette.secondary, in: Circle())
                }
                .buttonStyle(.plain).foregroundStyle(Palette.gold).accessibilityLabel("Adjuntar foto")
                TextField("Escribe un mensaje…", text: $text, axis: .vertical).textFieldStyle(.plain).lineLimit(1...5)
                    .padding(.horizontal, 16).padding(.vertical, 12).background(Palette.secondary, in: RoundedRectangle(cornerRadius: 22, style: .continuous))
                Button { Task { await send() } } label: {
                    Image(systemName: "arrow.up").font(.system(size: 17, weight: .bold)).foregroundStyle(.black)
                        .frame(width: 44, height: 44).background(Palette.gold, in: Circle())
                }
                .buttonStyle(.plain).disabled((text.trimmingCharacters(in: .whitespaces).isEmpty && pending == nil) || sending)
                .accessibilityLabel("Enviar")
            }
            .padding(12)
        }
        .onChange(of: photo) { _, p in Task { if let p, let d = try? await p.loadTransferable(type: Data.self) { pending = PlatformImage(data: d)?.jpegData(maxSide: 1600) } } }
        .task {
            while !Task.isCancelled {
                await load()
                try? await Task.sleep(for: .seconds(5))
            }
        }
    }

    private func load() async {
        let rows: [Message] = (try? await Backend.client.from("chat_messages").select("id, sender_id, content, media_url, media_type, created_at")
            .eq("conversation_user_id", value: conversationUserId).order("created_at").limit(300).execute().value) ?? []
        if rows != messages { messages = rows }
    }

    private func send() async {
        guard let me else { return }
        sending = true; defer { sending = false }
        struct I: Encodable { let conversation_user_id: String; let sender_id: String; let content: String; let media_url: String?; let media_type: String? }
        do {
            var url: String?
            if let data = pending {
                // Mismo sitio que la web: el primer segmento es quien sube (RLS del almacén).
                let path = "\(me)/chat/\(conversationUserId)/\(Int(Date().timeIntervalSince1970 * 1000)).jpg"
                try await Backend.client.storage.from("progress-photos").upload(path, data: data, options: FileOptions(contentType: "image/jpeg"))
                url = try Backend.client.storage.from("progress-photos").getPublicURL(path: path).absoluteString
            }
            let body = text.trimmingCharacters(in: .whitespacesAndNewlines)
            try await Backend.client.from("chat_messages").insert(I(conversation_user_id: conversationUserId, sender_id: me,
                content: body.isEmpty ? "📷 Foto" : body, media_url: url, media_type: url == nil ? nil : "image")).execute()
            text = ""; pending = nil; photo = nil
            Haptics.tap()
            await load()
        } catch { Haptics.error() }
    }
}
