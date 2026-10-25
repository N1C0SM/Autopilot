import SwiftUI
import PhotosUI
import UniformTypeIdentifiers
import Supabase

/// Ajustes / Mi cuenta, calcado de `SettingsPanel.tsx`: cabecera con avatar, nombre y correo,
/// y los grupos Perfil, Privacidad, Tus datos, Objetivo, Disponibilidad, Tu forma de entrenar,
/// Cambiar contraseña, Cuentas en este dispositivo, Legal y Sesión.
struct AccountView: View {
    @EnvironmentObject private var session: SessionModel
    @EnvironmentObject private var accounts: AccountStore

    @State private var name = ""
    @State private var avatar: String?
    @State private var namePublic = false
    @State private var avatarPublic = false
    @State private var progressPublic = false
    @State private var age = ""
    @State private var height = ""
    @State private var weight = ""
    @State private var goal = "gain_muscle"
    @State private var days = ""
    @State private var minutes = ""
    @State private var newPassword = ""
    @State private var confirmPassword = ""
    @State private var restSeconds = UserDefaults.standard.integer(forKey: "rest-seconds").nonZero ?? 90
    @State private var toast: String?
    @State private var busy = false
    @State private var sports = ""
    @State private var nutritionPrefs = ""
    @State private var allergies = ""
    @State private var workoutView = UserDefaults.standard.string(forKey: "workout-view") ?? "list"
    @State private var photo: PhotosPickerItem?
    @State private var travelUntil: String?
    @State private var exportDoc: JSONDoc?
    @State private var confirmDelete = false
    @State private var subTier: String?
    @State private var subStatus = ""
    @State private var subEnd: Date?
    @State private var isAdmin = false
    /// Igual que la web: «training» = Plus; «full», «transform», «personal» = Coach.
    private var planName: String { ["full", "transform", "personal"].contains(subTier ?? "") ? "Coach" : subTier == "training" ? "Plus" : "Free" }
    private var paid: Bool { planName != "Free" }
    private var subActive: Bool { subStatus == "active" || subStatus == "trialing" }

    private func setRest(_ secs: Int) {
        let v = min(600, max(15, secs))
        restSeconds = v; UserDefaults.standard.set(v, forKey: "rest-seconds"); Haptics.selection()
    }

    private static let goals = [("lose_weight", "Perder peso"), ("gain_muscle", "Ganar músculo"), ("improve_endurance", "Mejorar resistencia")]
    private static let rests = [(45, "45 s"), (60, "1 min"), (90, "1.5 min"), (120, "2 min"), (180, "3 min")]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 28) {
                header

                group("Perfil") {
                    row("Nombre") { TextField("Nombre", text: $name).multilineTextAlignment(.trailing).textFieldStyle(.plain) }
                    row("Correo") { Text(session.session?.user.email ?? "").foregroundStyle(Palette.muted).lineLimit(1) }
                    actionRow("Guardar perfil") { await saveProfile() }
                }

                group("Privacidad", footer: "Tu entrenador siempre te ve. Esto decide qué pueden ver los demás.") {
                    toggleRow("Nombre público", "Si está apagado, se muestran solo tus iniciales.", $namePublic)
                    toggleRow("Foto de perfil pública", "Si está apagado, se muestra un icono genérico.", $avatarPublic)
                    toggleRow("Progreso público", "Permite mostrar tu evolución (fotos, logros) fuera de tu cuenta.", $progressPublic)
                }
                .onChange(of: namePublic) { _, _ in Task { await savePrivacy() } }
                .onChange(of: avatarPublic) { _, _ in Task { await savePrivacy() } }
                .onChange(of: progressPublic) { _, _ in Task { await savePrivacy() } }

                group("Tus datos") {
                    row("Edad") { numberField($age) }
                    row("Altura (cm)") { numberField($height) }
                    row("Peso (kg)") { numberField($weight) }
                }

                group("Objetivo") {
                    ForEach(Self.goals, id: \.0) { value, label in
                        Button { goal = value; Haptics.selection() } label: {
                            HStack {
                                Text(label).font(.apBody)
                                Spacer()
                                if goal == value { Image(systemName: "checkmark").font(.inter(.body).weight(.semibold)).foregroundStyle(Palette.gold) }
                            }
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                        .accessibilityAddTraits(goal == value ? .isSelected : [])
                    }
                }

                group("Disponibilidad") {
                    row("Días/semana") { numberField($days) }
                    row("Minutos/sesión") { numberField($minutes) }
                }
                group("Deportes") { TextField("Fútbol los martes, pádel…", text: $sports, axis: .vertical).textFieldStyle(.plain).frame(minHeight: 44) }
                group("Preferencias nutricionales") { TextField("Vegetariano, sin lactosa…", text: $nutritionPrefs, axis: .vertical).textFieldStyle(.plain).frame(minHeight: 44) }
                group("Alergias") {
                    TextField("Frutos secos, marisco…", text: $allergies, axis: .vertical).textFieldStyle(.plain).frame(minHeight: 44)
                    actionRow("Guardar datos") { await saveData() }
                }

                group("Tu forma de entrenar", footer: "Elige cuánto quieres descansar al marcar una serie. El temporizador se inicia solo durante tu entreno.") {
                    VStack(alignment: .leading, spacing: 10) {
                        Text("Vista del entrenamiento").font(.apBody)
                        SegmentedPill(options: ["Lista vertical", "Ejercicio a ejercicio"], selection: Binding(
                            get: { workoutView == "focus" ? 1 : 0 },
                            set: { workoutView = $0 == 1 ? "focus" : "list"; UserDefaults.standard.set(workoutView, forKey: "workout-view") }))
                    }
                    .padding(.vertical, 6)
                    VStack(alignment: .leading, spacing: 10) {
                        Text("Descanso entre series").font(.apBody)
                        SegmentedPill(options: Self.rests.map(\.1), selection: Binding(
                            get: { Self.rests.firstIndex { $0.0 == restSeconds } ?? -1 },
                            set: { setRest(Self.rests[$0].0) }))
                    }
                    .padding(.vertical, 6)
                    row("Personalizado") {
                        TextField("90", text: Binding(get: { String(restSeconds) }, set: { restSeconds = Int($0) ?? restSeconds }))
                            .multilineTextAlignment(.trailing).textFieldStyle(.plain)
                            #if os(iOS)
                            .keyboardType(.numberPad)
                            #endif
                            .onSubmit { setRest(restSeconds) }
                        Text("segundos").foregroundStyle(Palette.muted)
                    }
                }

                group("Cambiar contraseña") {
                    row("Nueva") { SecureField("Mínimo 6 caracteres", text: $newPassword).multilineTextAlignment(.trailing).textFieldStyle(.plain) }
                    row("Confirmar") { SecureField("Repite la contraseña", text: $confirmPassword).multilineTextAlignment(.trailing).textFieldStyle(.plain) }
                    actionRow("Cambiar contraseña", disabled: newPassword.count < 6 || newPassword != confirmPassword) { await changePassword() }
                }

                if !isAdmin {
                    group("Suscripción") {
                        HStack(spacing: 12) {
                            Image(systemName: "crown").foregroundStyle(paid ? Palette.gold : Palette.muted).frame(width: 28)
                            VStack(alignment: .leading, spacing: 1) {
                                Text("Plan \(planName)").font(.apBody)
                                Text(subActive ? (subStatus == "trialing" ? "Prueba gratuita activa" : "Suscripción activa") : paid ? "Acceso activo (pago único)" : "Cuenta Free · entrenador opcional")
                                    .font(.apFootnote).foregroundStyle(Palette.muted)
                            }
                        }
                        .frame(minHeight: 44)
                        if subActive, let end = subEnd {
                            row(subStatus == "trialing" ? "Fin de la prueba" : "Próxima renovación") {
                                Text(end.formatted(.dateTime.day().month(.abbreviated).year().locale(Locale(identifier: "es_ES")))).foregroundStyle(Palette.muted)
                            }
                        }
                    }
                }

                group("Privacidad y mis datos", footer: "Conforme al RGPD tienes derecho a acceder, portar y eliminar tus datos en cualquier momento.") {
                    Button { Task { await exportData() } } label: {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(busy ? "Generando…" : "Exportar mis datos").font(.apBody).foregroundStyle(Palette.gold)
                            Text("Descarga un JSON con todo lo que tenemos sobre ti.").font(.apFootnote).foregroundStyle(Palette.muted)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading).contentShape(Rectangle())
                    }
                    .buttonStyle(.plain).disabled(busy)
                    Link(destination: URL(string: "https://autopilotplan.app/legal/privacidad")!) {
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text("Ver Política de Privacidad").font(.apBody).foregroundStyle(Palette.foreground)
                                Text("Qué datos tratamos y con qué base legal.").font(.apFootnote).foregroundStyle(Palette.muted)
                            }
                            Spacer()
                            Image(systemName: "chevron.right").font(.inter(.footnote).weight(.semibold)).foregroundStyle(Palette.muted)
                        }
                    }
                }

                group("Legal") {
                    linkRow("Términos", "https://autopilotplan.app/legal/terminos")
                    linkRow("Cookies", "https://autopilotplan.app/legal/cookies")
                    linkRow("Disclaimer médico", "https://autopilotplan.app/legal/disclaimer-medico")
                    linkRow("Aviso legal", "https://autopilotplan.app/legal/aviso-legal")
                }

                group("Cuentas en este dispositivo", footer: "Cambia de cuenta sin cerrar sesión, como los usuarios de un Mac.") {
                    ForEach(accounts.accounts) { a in
                        HStack(spacing: 12) {
                            AvatarView(name: a.name, url: a.avatar, size: 44)
                            VStack(alignment: .leading, spacing: 1) {
                                Text(a.name).font(.apBody)
                                Text(a.expired ? "Vuelve a entrar" : a.email).font(.apFootnote).foregroundStyle(Palette.muted).lineLimit(1)
                            }
                            Spacer()
                            if accounts.defaultAccountId == a.id {
                                Text("Predeterminada").font(.apFootnote).foregroundStyle(Palette.gold)
                                    .padding(.horizontal, 8).padding(.vertical, 3)
                                    .background(Palette.gold.opacity(0.12), in: Capsule())
                            } else {
                                Button("Fijar") { accounts.setDefaultAccount(a.id); Haptics.tap() }
                                    .font(.apFootnote).foregroundStyle(Palette.muted).buttonStyle(.plain)
                            }
                            if a.id == session.userIdString {
                                Image(systemName: "checkmark").font(.inter(.body).weight(.bold)).foregroundStyle(Palette.gold).accessibilityLabel("Cuenta actual")
                            } else {
                                Button("Quitar") { accounts.forget(a.id) }.font(.apSubhead).foregroundStyle(Palette.muted).buttonStyle(.plain)
                                    .frame(minHeight: 44).accessibilityLabel("Quitar \(a.name) de este dispositivo")
                            }
                        }
                        .contentShape(Rectangle())
                        .onTapGesture { if a.id != session.userIdString { session.showPicker = true } }
                    }
                    Button { session.addAnotherAccount() } label: {
                        HStack(spacing: 12) {
                            Image(systemName: "plus").font(.inter(.body).weight(.bold)).foregroundStyle(Palette.gold)
                                .frame(width: 44, height: 44).background(Palette.gold.opacity(0.15), in: Circle())
                            Text("Añadir otra cuenta").font(.apBody)
                            Spacer()
                        }
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                }

                group("Sesión", footer: "Cierra tu sesión en este dispositivo.") {
                    Button { Task { await session.signOut() } } label: {
                        Text("Cerrar sesión").font(.apBody).foregroundStyle(Palette.destructive).frame(maxWidth: .infinity, alignment: .leading)
                    }
                    .buttonStyle(.plain)
                }
                VStack(spacing: 0) {
                    Button { Haptics.warning(); confirmDelete = true } label: {
                        Text("Eliminar cuenta").font(.apBody).foregroundStyle(Palette.destructive).frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
                            .padding(.horizontal, 16).contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                }
                .background(Palette.card, in: RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
            }
            .padding(.horizontal, 16).padding(.top, 8).padding(.bottom, 16)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .screenBackground()
        .overlay(alignment: .top) {
            if let toast {
                Text(toast).font(.apSubhead.weight(.semibold)).padding(.horizontal, 16).padding(.vertical, 10)
                    .background(.ultraThinMaterial, in: Capsule()).padding(.top, 8)
                    .transition(.move(edge: .top).combined(with: .opacity))
                    .accessibilityAddTraits(.isStaticText)
            }
        }
        .animation(.easeOut(duration: 0.2), value: toast)
        .task { await load() }
        .onChange(of: photo) { _, p in Task { await uploadAvatar(p) } }
        .fileExporter(isPresented: Binding(get: { exportDoc != nil }, set: { if !$0 { exportDoc = nil } }), document: exportDoc,
                      contentType: .json, defaultFilename: "autopilot-mis-datos-\(LocalDate.string()).json") { _ in show("Tus datos se han descargado") }
        .confirmationDialog("¿Eliminar tu cuenta?", isPresented: $confirmDelete, titleVisibility: .visible) {
            Button("Eliminar cuenta", role: .destructive) { Task { await deleteAccount() } }
            Button("Cancelar", role: .cancel) {}
        } message: { Text("Se borrarán tu cuenta y todos tus datos de forma permanente. No se puede deshacer.") }
    }

    private var travelActive: Bool {
        guard let t = travelUntil, let d = DateFormatter.ymd.date(from: String(t.prefix(10))) else { return false }
        return d >= Calendar.current.startOfDay(for: Date())
    }

    private func setTravel(_ on: Bool) async {
        guard let id = session.userId else { return }
        let until: String? = on ? LocalDate.string(Calendar.current.date(byAdding: .day, value: 7, to: Date())!) : nil
        struct U: Encodable { let travel_mode_until: String? }
        do { try await Backend.client.from("profiles").update(U(travel_mode_until: until)).eq("user_id", value: id).execute(); travelUntil = until; show(on ? "Modo viaje activado 7 días" : "Modo viaje desactivado") }
        catch { show("No se pudo cambiar") }
    }

    private func uploadAvatar(_ p: PhotosPickerItem?) async {
        guard let id = session.userId, let p, let data = try? await p.loadTransferable(type: Data.self), let img = PlatformImage(data: data), let jpg = img.jpegData(maxSide: 800) else { return }
        let path = "\(id.uuidString.lowercased())/avatar.jpg"
        do {
            try await Backend.client.storage.from("avatars").upload(path, data: jpg, options: FileOptions(contentType: "image/jpeg", upsert: true))
            let url = try Backend.client.storage.from("avatars").getPublicURL(path: path).absoluteString + "?t=\(Int(Date().timeIntervalSince1970))"
            try await Backend.client.from("profiles").update(["avatar_url": url]).eq("user_id", value: id).execute()
            avatar = url; Haptics.success(); show("Foto actualizada")
        } catch { Haptics.error(); show("No se pudo subir la foto") }
    }

    private func exportData() async {
        busy = true; defer { busy = false }
        guard let token = try? await Backend.client.auth.session.accessToken else { return }
        var req = URLRequest(url: Backend.url.appendingPathComponent("functions/v1/export-user-data"))
        req.httpMethod = "POST"
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        req.setValue(Backend.publishableKey, forHTTPHeaderField: "apikey")
        guard let (data, res) = try? await URLSession.shared.data(for: req), (res as? HTTPURLResponse)?.statusCode == 200 else { show("No se pudieron exportar tus datos"); return }
        exportDoc = JSONDoc(data: data)
    }

    private func deleteAccount() async {
        do {
            _ = try await Backend.client.functions.invoke("delete-account")
            await session.signOut()
        } catch { Haptics.error(); show("Error al eliminar la cuenta. Inténtalo de nuevo.") }
    }

    // MARK: Piezas (ListGroup / ListRow de la web)

    private var header: some View {
        VStack(spacing: 6) {
            AvatarView(name: name.isEmpty ? "?" : name, url: avatar, size: 88)
            Text(name.isEmpty ? "Tu perfil" : name).font(.apTitle2).padding(.top, 8)
            Text(session.session?.user.email ?? "").font(.apBody).foregroundStyle(Palette.muted)
            PhotosPicker(selection: $photo, matching: .images) { Text("Cambiar foto").font(.apHeadline).foregroundStyle(Palette.gold) }
                .buttonStyle(.plain).padding(.top, 6)
        }
        .frame(maxWidth: .infinity)
        .padding(.top, 8)
    }

    private func group<Content: View>(_ title: String, footer: String? = nil, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title.uppercased()).font(.apFootnote).foregroundStyle(Palette.muted).padding(.horizontal, 16)
            VStack(alignment: .leading, spacing: 0) {
                _VariadicView.Tree(SeparatedLayout()) { content() }
            }
            .background(Palette.card, in: RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
            if let footer { Text(footer).font(.apFootnote).foregroundStyle(Palette.muted).padding(.horizontal, 16) }
        }
    }

    private func row<V: View>(_ label: String, @ViewBuilder value: () -> V) -> some View {
        HStack(spacing: 12) {
            Text(label).font(.apBody)
            Spacer(minLength: 12)
            value().font(.apBody)
        }
        .frame(minHeight: 44)
    }

    private func toggleRow(_ title: String, _ subtitle: String, _ binding: Binding<Bool>) -> some View {
        Toggle(isOn: binding) {
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(.apBody)
                Text(subtitle).font(.apFootnote).foregroundStyle(Palette.muted)
            }
        }
        .tint(Palette.gold)
        .padding(.vertical, 4)
    }

    private func actionRow(_ title: String, disabled: Bool = false, action: @escaping () async -> Void) -> some View {
        Button { Task { await action() } } label: {
            Text(title).font(.apBody).foregroundStyle(Palette.gold).frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
        }
        .buttonStyle(.plain)
        .disabled(disabled || busy)
        .opacity(disabled ? 0.4 : 1)
    }

    private func linkRow(_ title: String, _ url: String) -> some View {
        Link(destination: URL(string: url) ?? Backend.url) {
            HStack {
                Text(title).font(.apBody).foregroundStyle(Palette.foreground)
                Spacer()
                Image(systemName: "chevron.right").font(.inter(.footnote).weight(.semibold)).foregroundStyle(Palette.muted)
            }
            .frame(minHeight: 44)
        }
    }

    private func numberField(_ binding: Binding<String>) -> some View {
        TextField("—", text: binding)
            .multilineTextAlignment(.trailing).textFieldStyle(.plain)
            #if os(iOS)
            .keyboardType(.decimalPad)
            #endif
            .frame(maxWidth: 120)
    }

    private func show(_ text: String) {
        toast = text
        Task { try? await Task.sleep(for: .seconds(2)); toast = nil }
    }

    // MARK: Datos

    private func load() async {
        guard let id = session.userId else { return }
        struct P: Decodable { let name: String?; let avatar_url: String?; let name_public: Bool?; let avatar_public: Bool?; let progress_public: Bool?; let travel_mode_until: String?; let subscription_tier: String?; let subscription_status: String?; let subscription_end: Date? }
        if let p: P = try? await Backend.client.from("profiles").select("name, avatar_url, name_public, avatar_public, progress_public, travel_mode_until, subscription_tier, subscription_status, subscription_end")
            .eq("user_id", value: id).single().execute().value {
            name = p.name ?? ""; avatar = p.avatar_url
            namePublic = p.name_public ?? false; avatarPublic = p.avatar_public ?? false; progressPublic = p.progress_public ?? false
            travelUntil = p.travel_mode_until
            subTier = p.subscription_tier; subStatus = p.subscription_status ?? "inactive"; subEnd = p.subscription_end
        }
        isAdmin = session.role == .admin
        struct Avail: Decodable { let days: AnyJSON?; let hours: AnyJSON? }
        struct O: Decodable { let age: Double?; let height: Double?; let weight: Double?; let goal: String?; let availability: Avail?; let sports: String?; let nutrition_preferences: String?; let allergies: String? }
        if let o: O = try? await Backend.client.from("onboarding").select("age, height, weight, goal, availability, sports, nutrition_preferences, allergies")
            .eq("user_id", value: id).single().execute().value {
            age = o.age.map { String(Int($0)) } ?? ""
            height = o.height.map { NumberText.decimal($0, digits: 0) } ?? ""
            weight = o.weight.map { NumberText.decimal($0, digits: $0.truncatingRemainder(dividingBy: 1) == 0 ? 0 : 1) } ?? ""
            goal = o.goal ?? goal
            sports = o.sports ?? ""; nutritionPrefs = o.nutrition_preferences ?? ""; allergies = o.allergies ?? ""
            if let d = o.availability?.days { days = Self.text(d) }
            if let h = o.availability?.hours, let hours = Double(Self.text(h)) { minutes = String(Int((hours * 60).rounded())) }
        }
    }

    private static func text(_ json: AnyJSON) -> String {
        switch json {
        case .string(let s): s
        case .integer(let i): String(i)
        case .double(let d): d.truncatingRemainder(dividingBy: 1) == 0 ? String(Int(d)) : String(d)
        default: ""
        }
    }

    private func saveProfile() async {
        guard let id = session.userId else { return }
        busy = true; defer { busy = false }
        do {
            try await Backend.client.from("profiles").update(["name": name]).eq("user_id", value: id).execute()
            Haptics.success(); show("Perfil guardado")
        } catch { Haptics.error(); show("No se pudo guardar") }
    }

    private func savePrivacy() async {
        guard let id = session.userId else { return }
        try? await Backend.client.from("profiles")
            .update(["name_public": namePublic, "avatar_public": avatarPublic, "progress_public": progressPublic])
            .eq("user_id", value: id).execute()
    }

    private func saveData() async {
        guard let id = session.userId else { return }
        busy = true; defer { busy = false }
        struct Avail: Encodable { let days: Int?; let hours: Double?; let auto_calculated: Bool }
        struct U: Encodable { let user_id: UUID; let age: Int?; let height: Double?; let weight: Double?; let goal: String; let availability: Avail; let sports: String; let nutrition_preferences: String; let allergies: String }
        let num = { (s: String) in Double(s.replacingOccurrences(of: ",", with: ".")) }
        let row = U(user_id: id, age: Int(age), height: num(height), weight: num(weight), goal: goal,
                    availability: Avail(days: Int(days), hours: num(minutes).map { $0 / 60 }, auto_calculated: false),
                    sports: sports, nutrition_preferences: nutritionPrefs, allergies: allergies.trimmingCharacters(in: .whitespaces))
        do {
            try await Backend.client.from("onboarding").upsert(row, onConflict: "user_id").execute()
            Haptics.success(); show("Datos guardados")
        } catch { Haptics.error(); show("No se pudo guardar") }
    }

    private func changePassword() async {
        busy = true; defer { busy = false }
        do {
            try await Backend.client.auth.update(user: UserAttributes(password: newPassword))
            newPassword = ""; confirmPassword = ""
            Haptics.success(); show("Contraseña cambiada")
        } catch { Haptics.error(); show("No se pudo cambiar la contraseña") }
    }
}

/// Filas separadas por una línea fina, como `ListGroup`.
private struct SeparatedLayout: _VariadicView_MultiViewRoot {
    func body(children: _VariadicView.Children) -> some View {
        ForEach(Array(children.enumerated()), id: \.element.id) { i, child in
            child
                .padding(.horizontal, 16).padding(.vertical, 6).frame(minHeight: 52, alignment: .leading)
                .frame(maxWidth: .infinity, alignment: .leading)
                .overlay(alignment: .top) { if i > 0 { Rectangle().fill(Palette.separator).frame(height: 0.5).padding(.leading, 16) } }
        }
    }
}

extension Int {
    var nonZero: Int? { self == 0 ? nil : self }
}


/// Documento JSON para guardar la exportación de datos.
struct JSONDoc: FileDocument {
    static var readableContentTypes: [UTType] { [.json] }
    let data: Data
    init(data: Data) { self.data = data }
    init(configuration: ReadConfiguration) throws { data = configuration.file.regularFileContents ?? Data() }
    func fileWrapper(configuration: WriteConfiguration) throws -> FileWrapper { FileWrapper(regularFileWithContents: data) }
}
