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
    @State private var loaded = false
    @State private var failed = false
    @State private var toast: String?

    private static let tabs = ["Plan", "Perfil", "Acceso", "Progreso", "Entreno", "Nutrición", "Chat"]

    var body: some View {
        VStack(spacing: 0) {
            tabStrip
            Rectangle().fill(Palette.separator).frame(height: 0.5).padding(.horizontal, 20)
            if tab == 6 {
                ChatView(conversationUserId: userId)
            } else {
                ScrollView {
                    VStack(alignment: .leading, spacing: 20) {
                        header
                        if !loaded {
                            contentSkeleton
                        } else if failed && profile.isEmpty {
                            AdminErrorCard(title: "No hemos podido cargar la ficha",
                                           message: "Revisa la conexión y vuelve a intentarlo.") {
                                loaded = false
                                Task { await load() }
                            }
                        } else {
                            Group {
                                switch tab {
                                case 0: planTab
                                case 1: perfilTab
                                case 2: accesoTab
                                case 3: progresoTab
                                case 4: entrenoTab
                                default: nutricionTab
                                }
                            }
                        }
                    }
                    .padding(.horizontal, 20)
                    .padding(.top, 4)
                    .padding(.bottom, 28)
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
        }
        .screenBackground()
        .overlay(alignment: .top) { ToastView(text: toast) }
        .task { await load() }
    }

    // MARK: Cabecera y pestañas

    private var tabStrip: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(Self.tabs.indices, id: \.self) { i in
                    Button {
                        Haptics.selection()
                        tab = i
                    } label: {
                        Text(Self.tabs[i])
                            .font(.apSubhead.weight(.medium))
                            .lineLimit(1)
                            .padding(.horizontal, 14)
                            .frame(minHeight: 44)
                            .foregroundStyle(tab == i ? Color.black : Palette.foreground)
                            .background(tab == i ? Palette.gold : Palette.secondary, in: Capsule())
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(Self.tabs[i])
                    .accessibilityAddTraits(tab == i ? .isSelected : [])
                }
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 8)
        }
        .accessibilityLabel("Pestañas de la ficha del usuario")
    }

    private var header: some View {
        HStack(alignment: .center, spacing: 14) {
            AvatarView(name: display, url: nonEmpty(profile.adminString("avatar_url")), size: 64)
            VStack(alignment: .leading, spacing: 3) {
                Text(display)
                    .font(.apTitle2)
                    .lineLimit(2)
                    .minimumScaleFactor(0.8)
                Text(email)
                    .font(.apSubhead)
                    .foregroundStyle(Palette.muted)
                    .lineLimit(1)
                    .truncationMode(.middle)
                if loaded {
                    HStack(spacing: 6) {
                        pill(planName, tint: Palette.gold)
                        if isTest { pill("Cuenta de prueba", tint: Palette.muted) }
                    }
                }
            }
            Spacer(minLength: 0)
        }
        .accessibilityElement(children: .combine)
    }

    private func pill(_ text: String, tint: Color) -> some View {
        Text(text)
            .font(.inter(.caption).weight(.semibold))
            .lineLimit(1)
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .foregroundStyle(tint)
            .background(tint.opacity(0.15), in: Capsule())
    }

    private var contentSkeleton: some View {
        AdminKitSkeletonPulse {
            VStack(alignment: .leading, spacing: 12) {
                AdminKitSkeletonBlock(height: 13, radius: 6, width: 128)
                HStack(spacing: 10) {
                    ForEach(0..<3, id: \.self) { _ in
                        AdminKitSkeletonBlock(height: 96, radius: Radius.card).frame(maxWidth: .infinity)
                    }
                }
                AdminKitSkeletonBlock(height: 190, radius: Radius.card)
            }
        }
    }

    // MARK: Plan

    private var currentPlan: String {
        let tier = profile.adminString("subscription_tier")
        guard profile.adminString("payment_status") == "paid" else { return "free" }
        return ["full", "transform", "personal", "coach"].contains(tier) ? "full" : (["training", "plus"].contains(tier) ? "training" : "free")
    }

    private var planName: String {
        switch currentPlan {
        case "full": "Coach"
        case "training": "Plus"
        default: "Free"
        }
    }

    private var planTab: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("PLAN")
                .font(.apFootnote.weight(.semibold))
                .tracking(0.6)
                .foregroundStyle(Palette.muted)
                .padding(.horizontal, 16)
                .accessibilityAddTraits(.isHeader)
            HStack(spacing: 10) {
                ForEach([("free", "Free", "0"), ("training", "Plus", "14,99"), ("full", "Coach", "49")], id: \.0) { value, name, price in
                    let active = currentPlan == value
                    Button {
                        Haptics.selection()
                        Task { await setTier(value, name) }
                    } label: {
                        VStack(spacing: 3) {
                            Text(name).font(.apHeadline).lineLimit(1).minimumScaleFactor(0.8)
                            Text("\(price) €/mes").font(.apCaption.monospacedDigit())
                                .foregroundStyle(active ? Palette.gold : Palette.muted)
                            Image(systemName: active ? "checkmark.circle.fill" : "circle")
                                .font(.inter(size: 13, weight: .semibold))
                                .opacity(active ? 1 : 0)
                                .accessibilityHidden(true)
                        }
                        .foregroundStyle(active ? Palette.gold : Palette.foreground)
                        .frame(maxWidth: .infinity, minHeight: 96)
                        .background(active ? Palette.gold.opacity(0.15) : Palette.card,
                                    in: RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
                        .overlay {
                            RoundedRectangle(cornerRadius: Radius.card, style: .continuous)
                                .strokeBorder(Palette.gold.opacity(active ? 0.55 : 0), lineWidth: 1.5)
                        }
                    }
                    .buttonStyle(.plain)
                    .disabled(active)
                    .accessibilityLabel("Plan \(name), \(price) euros al mes")
                    .accessibilityAddTraits(active ? .isSelected : [])
                    .accessibilityHint(active ? "Plan actual" : "Toca para asignar este plan")
                }
            }
            ListGroupView(header: "Estado") {
                info("Estado del plan", ["plan_ready": "Plan listo", "plan_pending": "Pendiente"][profile.adminString("plan_status")] ?? "Onboarding", first: true)
                info("Pago", profile.adminString("payment_status") == "paid" ? "Pagado" : "Sin pagar")
                info("Suscripción", nonEmpty(profile.adminString("subscription_status")) ?? "—")
                info("Alta", String(profile.adminString("created_at").prefix(10)))
            }
        }
    }

    // MARK: Perfil

    @ViewBuilder private var perfilTab: some View {
        if onboarding.isEmpty {
            Card(padding: 8, radius: Radius.hero) {
                EmptyStateView(symbol: "person", title: "Aún no hay datos de perfil",
                               message: "Cuando complete el onboarding aparecerán aquí.")
            }
        } else {
            ListGroupView(header: "Datos") {
                info("Edad", nonEmpty(onboarding.adminString("age")) ?? "—", first: true)
                info("Altura", nonEmpty(onboarding.adminString("height")).map { "\($0) cm" } ?? "—")
                info("Peso", nonEmpty(onboarding.adminString("weight")).map { "\($0) kg" } ?? "—")
                info("Sexo", nonEmpty(onboarding.adminString("sex")) ?? "—")
                info("Objetivo", ["lose_weight": "Perder peso", "gain_muscle": "Ganar músculo", "improve_endurance": "Mejorar resistencia"][onboarding.adminString("goal")] ?? "—")
                info("Equipamiento", nonEmpty(onboarding.adminString("equipment_type")) ?? "—")
                info("Lesiones", nonEmpty(onboarding.adminString("injuries")) ?? "—")
                info("Alergias", nonEmpty(onboarding.adminString("allergies")) ?? "—")
                info("Preferencias", nonEmpty(onboarding.adminString("nutrition_preferences")) ?? "—")
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
                        Text("No cuenta en métricas ni estadísticas.")
                            .font(.apFootnote)
                            .foregroundStyle(Palette.muted)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
                .tint(Palette.gold)
                .padding(.horizontal, 16)
                .padding(.vertical, 8)
                .frame(minHeight: 56)
                .overlay(alignment: .top) {
                    Rectangle().fill(Palette.separator).frame(height: 0.5).padding(.leading, 16)
                }
            }
            ListGroupView(header: "Entrenador asignado") {
                Picker("Entrenador", selection: Binding(get: { trainerId }, set: { v in Task { await assign(v) } })) {
                    Text("Sin entrenador").tag("")
                    ForEach(trainers, id: \.id) { Text($0.email).tag($0.id) }
                }
                .tint(Palette.gold)
                .pickerStyle(.menu)
                .padding(.horizontal, 16)
                .frame(minHeight: 50)
                .accessibilityLabel("Entrenador asignado")
                .overlay(alignment: .top) {
                    Rectangle().fill(Palette.separator).frame(height: 0.5).padding(.leading, 16)
                }
            }
        }
    }

    private func roleToggle(_ title: String, _ subtitle: String, _ value: Binding<Bool>, _ role: String, first: Bool = false) -> some View {
        Toggle(isOn: Binding(get: { value.wrappedValue }, set: { v in
            Haptics.selection()
            Task { await setRole(role, v); value.wrappedValue = v }
        })) {
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(.apBody)
                Text(subtitle)
                    .font(.apFootnote)
                    .foregroundStyle(Palette.muted)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .tint(Palette.gold)
        .padding(.horizontal, 16)
        .padding(.vertical, 8)
        .frame(minHeight: 56)
        .overlay(alignment: .top) {
            if !first { Rectangle().fill(Palette.separator).frame(height: 0.5).padding(.leading, 16) }
        }
    }

    // MARK: Progreso, Entreno, Nutrición

    private var progresoTab: some View {
        VStack(alignment: .leading, spacing: 16) {
            ListGroupView(header: "Últimos 30 días") {
                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                    FigureTile(label: "Entrenos", value: "\(workouts30)", accent: true)
                    FigureTile(label: "Peso actual", value: lastWeight.map { "\(NumberText.decimal($0)) kg" } ?? "—")
                }
                .padding(12)
            }
        }
    }

    private var entrenoTab: some View {
        Group {
            if plan.isEmpty {
                Card(padding: 8, radius: Radius.hero) {
                    EmptyStateView(symbol: "calendar", title: "Sin plan de entrenamiento",
                                   message: "Este usuario todavía no tiene días con sesión.")
                }
            } else {
                VStack(spacing: 12) {
                    ForEach(plan) { d in
                        Card {
                            Text(d.day.uppercased())
                                .font(.apCaption.weight(.semibold))
                                .tracking(0.6)
                                .foregroundStyle(Palette.gold)
                            Text(d.title)
                                .font(.apHeadline)
                                .lineLimit(2)
                                .fixedSize(horizontal: false, vertical: true)
                            if let exercises = d.exercises, !exercises.isEmpty {
                                VStack(spacing: 0) {
                                    ForEach(Array(exercises.enumerated()), id: \.element.id) { i, e in
                                        HStack(alignment: .firstTextBaseline, spacing: 12) {
                                            Text(e.name).font(.apBody).lineLimit(2)
                                            Spacer(minLength: 8)
                                            Text("\(e.series) × \(e.reps)")
                                                .font(.apSubhead.monospacedDigit())
                                                .foregroundStyle(Palette.muted)
                                                .lineLimit(1)
                                        }
                                        .padding(.vertical, 8)
                                        .overlay(alignment: .top) {
                                            if i > 0 { Rectangle().fill(Palette.separator).frame(height: 0.5) }
                                        }
                                    }
                                }
                            } else {
                                Text("Sin ejercicios programados.")
                                    .font(.apSubhead)
                                    .foregroundStyle(Palette.muted)
                            }
                        }
                        .accessibilityElement(children: .contain)
                    }
                }
            }
        }
    }

    private var nutricionTab: some View {
        Group {
            if macros.isEmpty {
                Card(padding: 8, radius: Radius.hero) {
                    EmptyStateView(symbol: "fork.knife", title: "Sin plan de nutrición",
                                   message: "Cuando tenga plan de comidas aparecerán aquí sus macros.")
                }
            } else {
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 140), spacing: 12)], spacing: 12) {
                    FigureTile(label: "Proteína", value: "\(macros.adminString("protein")) g", hint: "al día")
                    FigureTile(label: "Carbohidratos", value: "\(macros.adminString("carbs")) g", hint: "al día")
                    FigureTile(label: "Grasas", value: "\(macros.adminString("fats")) g", hint: "al día")
                }
            }
        }
    }

    private func info(_ label: String, _ value: String, first: Bool = false) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 12) {
            Text(label).font(.apBody)
            Spacer(minLength: 12)
            Text(value)
                .font(.apBody)
                .foregroundStyle(Palette.muted)
                .multilineTextAlignment(.trailing)
                .lineLimit(3)
                .minimumScaleFactor(0.85)
        }
        .padding(.horizontal, 16)
        .frame(minHeight: 50)
        .overlay(alignment: .top) {
            if !first { Rectangle().fill(Palette.separator).frame(height: 0.5).padding(.leading, 16) }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(label)
        .accessibilityValue(value)
    }

    // MARK: Datos

    private func load() async {
        do {
            let p: [[String: AnyJSON]] = try await Backend.client.from("profiles").select()
                .eq("user_id", value: userId).limit(1).execute().value
            profile = p.first ?? [:]
            failed = false
        } catch {
            failed = true
            loaded = true
            return
        }
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
        loaded = true
    }

    private func setTier(_ value: String, _ name: String) async {
        Haptics.selection()
        do {
            if value == "free" {
                try await Backend.client.from("profiles").update(["payment_status": "unpaid", "subscription_status": "inactive"]).eq("user_id", value: userId).execute()
            } else {
                let status = profile.adminString("plan_status") == "onboarding" ? "plan_pending" : profile.adminString("plan_status")
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
        } catch {
            Haptics.error()
            show("No se pudo cambiar el plan")
        }
    }

    private func setRole(_ role: String, _ on: Bool) async {
        do {
            if on { try await Backend.client.from("user_roles").insert(["user_id": userId, "role": role]).execute() }
            else { try await Backend.client.from("user_roles").delete().eq("user_id", value: userId).eq("role", value: role).execute() }
            show("Rol actualizado")
        } catch {
            Haptics.error()
            show("No se pudo cambiar el rol")
        }
    }

    private func setTest(_ on: Bool) async {
        do {
            if on { try await Backend.client.from("metrics_excluded_users").insert(["user_id": userId]).execute() }
            else { try await Backend.client.from("metrics_excluded_users").delete().eq("user_id", value: userId).execute() }
            isTest = on
        } catch {
            Haptics.error()
            show("No se pudo cambiar")
        }
    }

    private func assign(_ trainer: String) async {
        do {
            try await Backend.client.from("trainer_assignments").delete().eq("user_id", value: userId).execute()
            if !trainer.isEmpty {
                try await Backend.client.from("trainer_assignments").insert(["trainer_id": trainer, "user_id": userId]).execute()
            }
            trainerId = trainer
            show(trainer.isEmpty ? "Asignación retirada" : "Entrenador asignado")
        } catch {
            Haptics.error()
            show("No se pudo cambiar la asignación")
        }
    }

    private func nonEmpty(_ s: String) -> String? { s.isEmpty ? nil : s }

    private func show(_ t: String) {
        toast = t
        Task { try? await Task.sleep(for: .seconds(2)); toast = nil }
    }
}

/// Campos de un JSON como texto legible (los perfiles guardan números y cadenas mezclados).
private extension Dictionary where Key == String, Value == AnyJSON {
    func adminString(_ key: String) -> String {
        guard let value = self[key] else { return "" }
        switch value {
        case .string(let s): return s
        case .integer(let i): return String(i)
        case .double(let d): return d == d.rounded() ? String(Int(d)) : NumberText.decimal(d)
        case .bool(let b): return b ? "Sí" : "No"
        default: return ""
        }
    }
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
    @State private var loadedOnce = false
    @State private var loadFailed = false
    @State private var sendFailed = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    private var me: String? { Backend.client.auth.currentUser?.id.uuidString.lowercased() }

    private var canSend: Bool {
        !sending && !(text.trimmingCharacters(in: .whitespaces).isEmpty && pending == nil)
    }

    var body: some View {
        VStack(spacing: 0) {
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(spacing: 8) {
                        if messages.isEmpty {
                            if loadFailed {
                                AdminErrorCard(title: "No hemos podido cargar los mensajes",
                                               message: "Revisa la conexión; se reintentará solo en unos segundos.") {
                                    Task { await load() }
                                }
                            } else if loadedOnce {
                                Card(padding: 8, radius: Radius.hero) {
                                    EmptyStateView(symbol: "bubble.left.and.bubble.right", title: "Sin mensajes todavía",
                                                   message: "Escribe abajo para empezar la conversación.")
                                }
                            } else {
                                ProgressView()
                                    .tint(Palette.gold)
                                    .frame(maxWidth: .infinity)
                                    .padding(.top, 48)
                                    .accessibilityLabel("Cargando mensajes")
                            }
                        }
                        ForEach(messages) { m in
                            let mine = m.sender_id.lowercased() == me
                            HStack {
                                if mine { Spacer(minLength: 40) }
                                VStack(alignment: .leading, spacing: 4) {
                                    if let u = m.media_url, let url = URL(string: u) {
                                        CachedAsyncImage(url: url) { $0.resizable().scaledToFit() } placeholder: { ProgressView() }
                                            .frame(maxWidth: 240)
                                            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                                    }
                                    Text(m.content).font(.apBody)
                                }
                                .padding(.horizontal, 14)
                                .padding(.vertical, 10)
                                .foregroundStyle(mine ? Color.black : Palette.foreground)
                                .background(mine ? Palette.gold : Palette.card, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
                                if !mine { Spacer(minLength: 40) }
                            }
                            .id(m.id)
                            .accessibilityElement(children: .combine)
                            .accessibilityLabel(mine ? "Tú: \(m.content)" : "Mensaje: \(m.content)")
                        }
                    }
                    .padding(16)
                }
                .scrollDismissesKeyboard(.interactively)
                .onChange(of: messages.count) { _, _ in
                    guard let last = messages.last else { return }
                    withAnimation(reduceMotion ? nil : .easeOut(duration: 0.2)) {
                        proxy.scrollTo(last.id, anchor: .bottom)
                    }
                }
            }
            if let pending, let img = PlatformImage(data: pending) {
                HStack(spacing: 10) {
                    Image(platformImage: img).resizable().scaledToFill()
                        .frame(width: 64, height: 64)
                        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                        .accessibilityHidden(true)
                    Button {
                        self.pending = nil
                        photo = nil
                    } label: {
                        Image(systemName: "xmark.circle.fill")
                            .font(.inter(size: 18))
                            .foregroundStyle(Palette.muted)
                            .frame(width: 44, height: 44)
                            .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Quitar foto")
                    Spacer()
                }
                .padding(.horizontal, 12)
            }
            if sendFailed {
                Text("No se pudo enviar. Inténtalo de nuevo.")
                    .font(.apFootnote)
                    .foregroundStyle(Palette.destructive)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, 16)
                    .padding(.bottom, 4)
            }
            HStack(spacing: 8) {
                PhotosPicker(selection: $photo, matching: .images) {
                    Image(systemName: "photo")
                        .font(.inter(size: 18))
                        .frame(width: 44, height: 44)
                        .background(Palette.secondary, in: Circle())
                }
                .buttonStyle(.plain)
                .foregroundStyle(Palette.gold)
                .accessibilityLabel("Adjuntar foto")
                TextField("Escribe un mensaje…", text: $text, axis: .vertical)
                    .textFieldStyle(.plain)
                    .font(.apBody)
                    .lineLimit(1...5)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 12)
                    .background(Palette.secondary, in: RoundedRectangle(cornerRadius: 22, style: .continuous))
                    .accessibilityLabel("Mensaje")
                Button {
                    Task { await send() }
                } label: {
                    Image(systemName: "arrow.up")
                        .font(.inter(size: 17, weight: .bold))
                        .foregroundStyle(.black)
                        .frame(width: 44, height: 44)
                        .background(Palette.gold, in: Circle())
                        .opacity(canSend ? 1 : 0.45)
                }
                .buttonStyle(.plain)
                .disabled(!canSend)
                .accessibilityLabel("Enviar")
                .accessibilityHint("Envía el mensaje")
            }
            .padding(12)
        }
        .onChange(of: photo) { _, p in
            Task {
                if let p, let d = try? await p.loadTransferable(type: Data.self) {
                    pending = PlatformImage(data: d)?.jpegData(maxSide: 1600)
                }
            }
        }
        .task {
            while !Task.isCancelled {
                await load()
                try? await Task.sleep(for: .seconds(5))
            }
        }
    }

    private func load() async {
        do {
            let rows: [Message] = try await Backend.client.from("chat_messages").select("id, sender_id, content, media_url, media_type, created_at")
                .eq("conversation_user_id", value: conversationUserId).order("created_at").limit(300).execute().value
            if rows != messages { messages = rows }
            loadFailed = false
        } catch {
            loadFailed = true
        }
        loadedOnce = true
    }

    private func send() async {
        guard let me else { return }
        sending = true
        sendFailed = false
        defer { sending = false }
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
            text = ""
            pending = nil
            photo = nil
            Haptics.tap()
            await load()
        } catch {
            sendFailed = true
            Haptics.error()
        }
    }
}
