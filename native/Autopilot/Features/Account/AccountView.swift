import SwiftUI
import PhotosUI
import UniformTypeIdentifiers
import Supabase
#if os(iOS)
import UIKit
#endif

/// Ajustes / Mi cuenta, calcado de `SettingsPanel.tsx`: cabecera con avatar, nombre y correo,
/// y los grupos Perfil, Privacidad, Tus datos, Objetivo, Disponibilidad, Tu forma de entrenar,
/// Cambiar contraseña, Cuentas en este dispositivo, Legal y Sesión.
struct AccountView: View {
    @EnvironmentObject private var session: SessionModel
    @EnvironmentObject private var accounts: AccountStore
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.dismiss) private var dismiss

    @State private var name = ""
    @State private var avatar: String?
    @State private var namePublic = false
    @State private var avatarPublic = false
    @State private var age = ""
    @State private var height = ""
    @State private var weight = ""
    @State private var goal = "gain_muscle"
    @State private var days = ""
    @State private var minutes = ""
    @State private var newPassword = ""
    @State private var confirmPassword = ""
    @State private var restSeconds = UserDefaults.standard.integer(forKey: "rest-seconds").nonZero ?? 90
    /// Texto de «Personalizado». El teclado numérico de iOS no tiene tecla Intro: `onSubmit` no
    /// llegaba nunca y el descanso personalizado no se guardaba. Ahora se confirma al salir del campo.
    @State private var restText = String(UserDefaults.standard.integer(forKey: "rest-seconds").nonZero ?? 90)
    @FocusState private var restFocused: Bool
    @State private var toast: String?
    @State private var toastTask: Task<Void, Never>?
    @State private var busy = false
    @State private var sports = ""
    @State private var nutritionPrefs = ""
    @State private var allergies = ""
    @State private var workoutView = UserDefaults.standard.string(forKey: "workout-view") ?? "list"
    @State private var photo: PhotosPickerItem?
    @State private var exportDoc: JSONDoc?
    @State private var confirmDelete = false
    @State private var subTier: String?
    /// Cuenta a la que se está cambiando (spinner) y cuenta que pide contraseña.
    @State private var switching: String?
    @State private var unlocking: SavedAccount?
    @State private var subStatus = ""
    @State private var subEnd: Date?
    @State private var isAdmin = false
    /// Ficha y datos ya cargados del servidor. Sin esto, un fallo de red dejaba los campos vacíos
    /// y «Guardar» podía sobrescribir con vacíos lo que ya había (pérdida de datos).
    @State private var profileLoaded = false
    @State private var onboardingLoaded = false
    /// Igual que la web: «training» = Plus; «full», «transform», «personal» = Coach.
    private var planName: String { ["full", "transform", "personal"].contains(subTier ?? "") ? "Coach" : subTier == "training" ? "Plus" : "Free" }
    private var paid: Bool { planName != "Free" }
    private var subActive: Bool { subStatus == "active" || subStatus == "trialing" }

    private func setRest(_ secs: Int) {
        let v = min(600, max(15, secs))
        restSeconds = v
        restText = String(v)
        UserDefaults.standard.set(v, forKey: "rest-seconds"); Haptics.selection()
    }

    /// Confirma lo escrito en «Personalizado». Si no es un número, vuelve al valor guardado.
    private func commitRest() {
        let trimmed = restText.trimmingCharacters(in: .whitespaces)
        guard let v = Int(trimmed) else { restText = String(restSeconds); return }
        if v == restSeconds { restText = String(restSeconds); return }
        setRest(v)
    }

    private static let goals = [("lose_weight", "Perder peso"), ("gain_muscle", "Ganar músculo"), ("improve_endurance", "Mejorar resistencia")]
    private static let rests = [(45, "45 s"), (60, "1 min"), (90, "1.5 min"), (120, "2 min"), (180, "3 min")]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 28) {
                header

                group("Perfil") {
                    fieldRow("Nombre") { TextField("Nombre", text: $name).multilineTextAlignment(.trailing).textFieldStyle(.plain) }
                    row("Correo") { Text(session.session?.user.email ?? "").foregroundStyle(Palette.muted).lineLimit(2) }
                    actionRow("Guardar perfil") { await saveProfile() }
                }

                group("Privacidad", footer: "Tu entrenador siempre te ve. Esto decide qué pueden ver los demás.") {
                    toggleRow("Nombre público", "Si está apagado, se muestran solo tus iniciales.", namePublicBinding)
                    toggleRow("Foto de perfil pública", "Si está apagado, se muestra un icono genérico.", avatarPublicBinding)
                }

                group("Tus datos") {
                    fieldRow("Edad") { numberField($age) }
                    fieldRow("Altura (cm)") { numberField($height) }
                    fieldRow("Peso (kg)") { numberField($weight) }
                }

                group("Objetivo") {
                    ForEach(Self.goals, id: \.0) { value, label in
                        Button { goal = value; Haptics.selection() } label: {
                            HStack {
                                Text(label).font(.apBody)
                                Spacer()
                                if goal == value {
                                    Image(systemName: "checkmark").font(.inter(.body).weight(.semibold))
                                        .foregroundStyle(Palette.gold).accessibilityHidden(true)
                                }
                            }
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel(label)
                        .accessibilityAddTraits(goal == value ? .isSelected : [])
                    }
                }

                group("Disponibilidad") {
                    fieldRow("Días/semana") { numberField($days) }
                    fieldRow("Minutos/sesión") { numberField($minutes) }
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
                    fieldRow("Personalizado") {
                        TextField("90", text: $restText)
                            .multilineTextAlignment(.trailing).textFieldStyle(.plain)
                            .frame(width: 64)
                            #if os(iOS)
                            .keyboardType(.numberPad)
                            #endif
                            .focused($restFocused)
                            .onSubmit { commitRest(); restFocused = false }
                            // Al cerrar el teclado (o tocar otro campo) se confirma y se persiste.
                            .onChange(of: restFocused) { _, focused in if !focused { commitRest() } }
                            .accessibilityLabel("Descanso personalizado, en segundos")
                        Text("segundos").foregroundStyle(Palette.muted).lineLimit(1)
                            .accessibilityHidden(true)
                    }
                }

                group("Cambiar contraseña") {
                    fieldRow("Nueva") { SecureField("Mínimo 6 caracteres", text: $newPassword).multilineTextAlignment(.trailing).textFieldStyle(.plain) }
                    fieldRow("Confirmar") { SecureField("Repite la contraseña", text: $confirmPassword).multilineTextAlignment(.trailing).textFieldStyle(.plain) }
                    actionRow("Cambiar contraseña", disabled: newPassword.count < 6 || newPassword != confirmPassword) { await changePassword() }
                }

                if !isAdmin, profileLoaded {
                    // Hasta tener la ficha no se enseña el plan: «Free» por defecto mentiría a quien paga.
                    group("Suscripción") {
                        HStack(spacing: 12) {
                            Image(systemName: "crown").foregroundStyle(paid ? Palette.gold : Palette.muted).frame(width: 28)
                                .accessibilityHidden(true)
                            VStack(alignment: .leading, spacing: 1) {
                                Text("Plan \(planName)").font(.apBody)
                                Text(subActive ? (subStatus == "trialing" ? "Prueba gratuita activa" : "Suscripción activa") : paid ? "Acceso activo (pago único)" : "Cuenta Free")
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
                                .accessibilityHidden(true)
                        }
                        .frame(minHeight: 44)
                        .contentShape(Rectangle())
                    }
                }

                group("Legal") {
                    linkRow("Términos", "https://autopilotplan.app/legal/terminos")
                    linkRow("Cookies", "https://autopilotplan.app/legal/cookies")
                    linkRow("Disclaimer médico", "https://autopilotplan.app/legal/disclaimer-medico")
                    linkRow("Aviso legal", "https://autopilotplan.app/legal/aviso-legal")
                }

                group("Cuentas en este dispositivo", footer: "Cambia de cuenta sin cerrar sesión, como los usuarios de un Mac. «Abrir siempre con» decide qué cuenta se abre al entrar en la app.") {
                    fieldRow("Abrir siempre con") {
                        Menu {
                            Button {
                                accounts.setDefault(nil)
                            } label: {
                                if accounts.defaultId == nil {
                                    Label("Preguntar al abrir", systemImage: "checkmark")
                                } else {
                                    Text("Preguntar al abrir")
                                }
                            }
                            Divider()
                            ForEach(accounts.accounts) { a in
                                Button {
                                    accounts.setDefault(a.id)
                                } label: {
                                    if a.id == accounts.defaultId {
                                        Label(defaultMenuTitle(a), systemImage: "checkmark")
                                    } else {
                                        Text(defaultMenuTitle(a))
                                    }
                                }
                                .disabled(a.requirePassword || a.expired)
                            }
                        } label: {
                            HStack(spacing: 6) {
                                Text(defaultSelectionLabel)
                                    .font(.apBody)
                                    .foregroundStyle(accounts.defaultAccount == nil ? Palette.muted : Palette.gold)
                                    .lineLimit(1).minimumScaleFactor(0.75)
                                Image(systemName: "chevron.up.chevron.down")
                                    .font(.inter(.caption).weight(.semibold)).foregroundStyle(Palette.muted)
                            }
                            .frame(minHeight: 44)
                            .contentShape(Rectangle())
                        }
                        .menuStyle(.button).buttonStyle(.plain)
                        .accessibilityLabel("Abrir siempre con")
                        .accessibilityValue(defaultSelectionLabel)
                    }
                    ForEach(accounts.accounts) { a in
                        HStack(spacing: 12) {
                            // El toque de la fila se expone como botón: antes era un
                            // `onTapGesture` invisible para VoiceOver. «Quitar» va aparte para
                            // que siga siendo un botón real.
                            if a.id == session.userIdString {
                                accountIdentity(a)
                                    .accessibilityElement(children: .combine)
                                    .accessibilityLabel("\(a.name), \(a.email), cuenta actual")
                            } else {
                                Button {
                                    Haptics.tap()
                                    Task { await switchToAccount(a) }
                                } label: { accountIdentity(a) }
                                    .buttonStyle(PressableCardStyle(scale: 0.99))
                                    .disabled(switching != nil)
                                    .overlay(alignment: .trailing) {
                                        if switching == a.id {
                                            ProgressView().tint(Palette.gold).padding(.trailing, 6)
                                                .accessibilityLabel("Cambiando de cuenta")
                                        }
                                    }
                                    .accessibilityLabel("\(a.name), \(a.expired ? "vuelve a entrar" : a.email)\(a.id == accounts.defaultId ? ", cuenta predeterminada" : "")")
                                    .accessibilityHint("Abre esta cuenta")
                                Button("Quitar") { Haptics.warning(); accounts.forget(a.id) }
                                    .font(.apSubhead).foregroundStyle(Palette.muted).buttonStyle(.plain)
                                    .frame(minHeight: 44)
                                    .accessibilityLabel("Quitar \(a.name) de este dispositivo")
                            }
                        }
                        .contextMenu {
                            if a.id == accounts.defaultId {
                                Button("Ya no abrir con esta cuenta") { accounts.setDefault(nil) }
                            } else {
                                Button("Abrir siempre con esta cuenta") { accounts.setDefault(a.id) }
                                    .disabled(a.requirePassword || a.expired)
                            }
                            if a.id != session.userIdString {
                                Divider()
                                // Cambiar directamente también desde el menú de mantener pulsado.
                                Button {
                                    Haptics.tap()
                                    Task { await switchToAccount(a) }
                                } label: {
                                    Label("Cambiar a esta cuenta", systemImage: "arrow.left.arrow.right")
                                }
                                Button("Quitar de este dispositivo", role: .destructive) { Haptics.warning(); accounts.forget(a.id) }
                            }
                        }
                    }
                    Button { session.addAnotherAccount() } label: {
                        HStack(spacing: 12) {
                            Image(systemName: "plus").font(.inter(.body).weight(.bold)).foregroundStyle(Palette.gold)
                                .frame(width: 44, height: 44).background(Palette.gold.opacity(0.15), in: Circle())
                                .accessibilityHidden(true)
                            Text("Añadir otra cuenta").font(.apBody)
                            Spacer()
                        }
                        .frame(minHeight: 44)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityHint("Inicia sesión con otra cuenta sin cerrar la actual")
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
                    .accessibilityHint("Pide confirmación y borra tu cuenta y tus datos")
                }
                .background(Palette.card, in: RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
            }
            .padding(.horizontal, 16).padding(.top, 8).padding(.bottom, 16)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .screenBackground()
        // Gesto nativo: tirar hacia abajo vuelve a pedir la ficha y los datos sin vaciar la pantalla.
        .refreshable { await load(clear: false) }
        #if os(iOS)
        // El teclado numérico no tiene tecla para cerrarse: sin «Listo» el descanso
        // personalizado no se llegaba a confirmar nunca.
        .toolbar {
            ToolbarItemGroup(placement: .keyboard) {
                Spacer()
                Button("Listo") { commitRest(); restFocused = false; dismissKeyboard() }
            }
        }
        #endif
        .overlay(alignment: .top) {
            if let toast {
                Text(toast).font(.apSubhead.weight(.semibold)).padding(.horizontal, 16).padding(.vertical, 10)
                    .background(.ultraThinMaterial, in: Capsule()).padding(.top, 8)
                    // Con «Reducir movimiento» el aviso entra con un fundido, sin deslizarse.
                    .transition(reduceMotion ? .opacity : .move(edge: .top).combined(with: .opacity))
                    .accessibilityAddTraits(.isStaticText)
            }
        }
        .apAnimation(.easeOut(duration: 0.2), value: toast, reduceMotion: reduceMotion)
        // Con `id` se recarga al cambiar de cuenta: la pantalla puede quedar montada al entrar
        // con otra cuenta y antes seguía enseñando (y guardando) los datos de la anterior.
        .task(id: session.userId) { await load() }
        .onChange(of: session.role) { _, role in isAdmin = role == .admin }
        .onChange(of: photo) { _, p in Task { await uploadAvatar(p) } }
        .fileExporter(isPresented: Binding(get: { exportDoc != nil }, set: { if !$0 { exportDoc = nil } }), document: exportDoc,
                      contentType: .json, defaultFilename: "autopilot-mis-datos-\(LocalDate.string()).json") { result in
            // El resultado del exportador antes se ignoraba: decía «descargado» también al cancelar o fallar.
            switch result {
            case .success: show("Tus datos se han descargado")
            case .failure: show("No se pudieron guardar tus datos")
            }
        }
        .confirmationDialog("¿Eliminar tu cuenta?", isPresented: $confirmDelete, titleVisibility: .visible) {
            Button("Eliminar cuenta", role: .destructive) { Task { await deleteAccount() } }
            Button("Cancelar", role: .cancel) {}
        } message: { Text("Se borrarán tu cuenta y todos tus datos de forma permanente. No se puede deshacer.") }
        .sheet(item: $unlocking) { target in
            AccountUnlockSheet(target: target) { password in
                let result = await accounts.signIn(target.id, password: password)
                guard result == .ok else { return false }
                await session.switched()
                Haptics.success()
                show("Ahora entrenas como \(target.name)")
                dismiss()
                return true
            }
        }
    }

    /// Cambia a otra cuenta guardada sin pasar por «¿Quién entrena?».
    /// Entra directa aunque la cuenta tenga contraseña: esa protección es solo para el
    /// selector de al abrir, no para cambiar desde Ajustes con la sesión activa.
    /// Solo se pide contraseña si la sesión guardada caducó de verdad.
    private func switchToAccount(_ target: SavedAccount) async {
        guard target.id != session.userIdString, switching == nil else { return }
        switching = target.id
        defer { switching = nil }
        switch await accounts.switchTo(target.id) {
        case .ok:
            await session.switched()
            Haptics.success()
            show("Ahora entrenas como \(target.name)")
            dismiss()
        case .offline:
            Haptics.error()
            show("Sin conexión: no se ha cambiado de cuenta.")
        case .expired, .wrong:
            unlocking = target
        }
    }

    private func uploadAvatar(_ p: PhotosPickerItem?) async {
        // Sin foto nueva no hay nada que hacer (al cancelar el selector llega `nil`).
        guard let p else { return }
        // Se limpia la selección para poder volver a elegir la misma foto (si la subida falló).
        defer { photo = nil }
        guard let id = session.userId, let data = try? await p.loadTransferable(type: Data.self),
              let img = PlatformImage(data: data), let jpg = img.jpegData(maxSide: 800) else {
            Haptics.error(); show("No se pudo abrir la foto"); return
        }
        let path = "\(id.uuidString.lowercased())/avatar.jpg"
        do {
            try await Backend.client.storage.from("avatars").upload(path, data: jpg, options: FileOptions(contentType: "image/jpeg", upsert: true))
            let url = try Backend.client.storage.from("avatars").getPublicURL(path: path).absoluteString + "?t=\(Int(Date().timeIntervalSince1970))"
            try await Backend.client.from("profiles").update(["avatar_url": url]).eq("user_id", value: id).execute()
            avatar = url
            // La cuenta guardada en el dispositivo también cambia de foto (cabecera y picker).
            accounts.updateProfile(id: id.uuidString.lowercased(), avatar: url)
            Haptics.success(); show("Foto actualizada")
        } catch { Haptics.error(); show("No se pudo subir la foto") }
    }

    private func exportData() async {
        busy = true; defer { busy = false }
        guard let token = try? await Backend.client.auth.session.accessToken else {
            show("No se pudieron exportar tus datos"); return
        }
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

    /// Distintivo de la cuenta que se abre al entrar en la app.
    private var defaultBadge: some View {
        Text("Predeterminada")
            .font(.apCaption.weight(.semibold))
            .foregroundStyle(Palette.gold)
            .padding(.horizontal, 8).padding(.vertical, 3)
            .background(Palette.gold.opacity(0.15), in: Capsule())
            .fixedSize(horizontal: true, vertical: false)
            .accessibilityLabel("Cuenta predeterminada")
    }

    /// Texto del selector visible: la cuenta que se abre sola o «Preguntar al abrir».
    private var defaultSelectionLabel: String {
        accounts.defaultAccount?.name ?? "Preguntar al abrir"
    }

    /// Nombre de la cuenta en el selector, con el motivo si no puede ser la predeterminada.
    private func defaultMenuTitle(_ a: SavedAccount) -> String {
        if a.requirePassword { return "\(a.name) · pide contraseña" }
        if a.expired { return "\(a.name) · vuelve a entrar" }
        return a.name
    }

    /// Contenido visible de una cuenta del dispositivo (avatar, nombre, correo y distintivos).
    private func accountIdentity(_ a: SavedAccount) -> some View {
        HStack(spacing: 12) {
            AvatarView(name: a.name, url: a.avatar, size: 44)
            VStack(alignment: .leading, spacing: 2) {
                Text(a.name).font(.apBody).lineLimit(2).minimumScaleFactor(0.85)
                HStack(spacing: 6) {
                    Text(a.expired ? "Vuelve a entrar" : a.email).font(.apFootnote)
                        .foregroundStyle(Palette.muted).lineLimit(2)
                    if a.id == accounts.defaultId { defaultBadge }
                }
            }
            Spacer(minLength: 8)
            if a.id == session.userIdString {
                Image(systemName: "checkmark").font(.inter(.body).weight(.bold))
                    .foregroundStyle(Palette.gold).accessibilityHidden(true)
            }
        }
        .frame(minHeight: 44)
        .contentShape(Rectangle())
    }

    private var header: some View {
        VStack(spacing: 6) {
            AvatarView(name: name.isEmpty ? "?" : name, url: avatar, size: 88)
            Text(name.isEmpty ? "Tu perfil" : name).font(.apTitle2).padding(.top, 8)
                .accessibilityAddTraits(.isHeader)
            Text(session.session?.user.email ?? "").font(.apBody).foregroundStyle(Palette.muted)
                .lineLimit(2)
            PhotosPicker(selection: $photo, matching: .images) { Text("Cambiar foto").font(.apHeadline).foregroundStyle(Palette.gold) }
                .buttonStyle(.plain).padding(.top, 6)
                .frame(minHeight: 44)
                .accessibilityHint("Abre tus fotos para elegir una nueva foto de perfil")
        }
        .frame(maxWidth: .infinity)
        .padding(.top, 8)
    }

    private func group<Content: View>(_ title: String, footer: String? = nil, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            // Se ve en mayúsculas, pero VoiceOver lee el título natural y lo usa como cabecera
            // para navegar entre secciones.
            Text(title.uppercased()).font(.apFootnote).foregroundStyle(Palette.muted).padding(.horizontal, 16)
                .accessibilityLabel(title)
                .accessibilityAddTraits(.isHeader)
            VStack(alignment: .leading, spacing: 0) {
                _VariadicView.Tree(SeparatedLayout()) { content() }
            }
            .background(Palette.card, in: RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
            .accessibilityElement(children: .contain)
            if let footer { Text(footer).font(.apFootnote).foregroundStyle(Palette.muted).padding(.horizontal, 16) }
        }
    }

    /// Fila de solo lectura: etiqueta y valor se leen juntos («Correo, ana@…»), no en dos paradas.
    private func row<V: View>(_ label: String, @ViewBuilder value: () -> V) -> some View {
        HStack(spacing: 12) {
            Text(label).font(.apBody).lineLimit(2).minimumScaleFactor(0.85)
                .fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: 12)
            value().font(.apBody)
        }
        .frame(minHeight: 44)
        .accessibilityElement(children: .combine)
    }

    /// Fila con un control (campo, selector): la etiqueta visible se oculta a VoiceOver y se usa
    /// como nombre del propio control, así no se lee dos veces.
    private func fieldRow<V: View>(_ label: String, @ViewBuilder value: () -> V) -> some View {
        HStack(spacing: 12) {
            Text(label).font(.apBody).lineLimit(2).minimumScaleFactor(0.85)
                .fixedSize(horizontal: false, vertical: true)
                .accessibilityHidden(true)
            Spacer(minLength: 12)
            value().font(.apBody).accessibilityLabel(Text(label))
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
                    .accessibilityHidden(true)
            }
            .frame(minHeight: 44)
            .contentShape(Rectangle())
        }
        .accessibilityHint("Abre el documento en el navegador")
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
        // El aviso aparece flotando sin mover el foco: se anuncia a VoiceOver en voz alta.
        A11y.announce(text)
        toast = text
        // Un aviso nuevo no debe apagarse con el temporizador del anterior.
        toastTask?.cancel()
        toastTask = Task {
            try? await Task.sleep(for: .seconds(2))
            guard !Task.isCancelled, toast == text else { return }
            toast = nil
        }
    }

    /// El teclado numérico de iOS no tiene tecla para cerrarse: se baja a mano desde «Listo».
    private func dismissKeyboard() {
        #if os(iOS)
        UIApplication.shared.sendAction(#selector(UIResponder.resignFirstResponder), to: nil, from: nil, for: nil)
        #endif
    }

    // MARK: Datos

    private func load(clear: Bool = true) async {
        guard let id = session.userId else { return }
        // Al cambiar de cuenta se vacía antes de pedir: si la petición falla no se mezclan los
        // datos (ni se guardan encima) de la cuenta anterior. Al refrescar se mantienen.
        if clear {
            profileLoaded = false
            onboardingLoaded = false
            name = ""; avatar = nil; namePublic = false; avatarPublic = false
            age = ""; height = ""; weight = ""; days = ""; minutes = ""
            sports = ""; nutritionPrefs = ""; allergies = ""
            goal = "gain_muscle"; subTier = nil; subStatus = ""; subEnd = nil
        }
        struct P: Decodable { let name: String?; let avatar_url: String?; let name_public: Bool?; let avatar_public: Bool?; let subscription_tier: String?; let subscription_status: String?; let subscription_end: Date? }
        if let p: P = try? await Backend.client.from("profiles").select("name, avatar_url, name_public, avatar_public, subscription_tier, subscription_status, subscription_end")
            .eq("user_id", value: id).single().execute().value {
            name = p.name ?? ""; avatar = p.avatar_url
            namePublic = p.name_public ?? false; avatarPublic = p.avatar_public ?? false
            subTier = p.subscription_tier; subStatus = p.subscription_status ?? "inactive"; subEnd = p.subscription_end
            profileLoaded = true
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
            onboardingLoaded = true
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

    /// Interruptores de privacidad: se guardan al tocarlos (no en `onChange`, que también se
    /// disparaba al cargar y reescribía lo mismo). Si falla la red, el interruptor vuelve atrás.
    private var namePublicBinding: Binding<Bool> {
        Binding(get: { namePublic }, set: { value in
            guard profileLoaded else { show("No se pudieron cargar tus ajustes"); return }
            let previous = namePublic
            namePublic = value
            Task { await savePrivacy(previousName: previous) }
        })
    }

    private var avatarPublicBinding: Binding<Bool> {
        Binding(get: { avatarPublic }, set: { value in
            guard profileLoaded else { show("No se pudieron cargar tus ajustes"); return }
            let previous = avatarPublic
            avatarPublic = value
            Task { await savePrivacy(previousAvatar: previous) }
        })
    }

    private func saveProfile() async {
        guard let id = session.userId else { return }
        // Sin ficha cargada, guardar un nombre vacío borraría el que ya había.
        guard profileLoaded || !name.trimmingCharacters(in: .whitespaces).isEmpty else { show("No se pudieron cargar tus datos"); return }
        busy = true; defer { busy = false }
        do {
            try await Backend.client.from("profiles").update(["name": name]).eq("user_id", value: id).execute()
            // La cuenta guardada en el dispositivo cambia de nombre también (¿Quién entrena?).
            let trimmed = name.trimmingCharacters(in: .whitespaces)
            if !trimmed.isEmpty { accounts.updateProfile(id: id.uuidString.lowercased(), name: trimmed) }
            Haptics.success(); show("Perfil guardado")
        } catch { Haptics.error(); show("No se pudo guardar") }
    }

    private func savePrivacy(previousName: Bool? = nil, previousAvatar: Bool? = nil) async {
        guard let id = session.userId else { return }
        let sentName = namePublic, sentAvatar = avatarPublic
        do {
            try await Backend.client.from("profiles")
                .update(["name_public": sentName, "avatar_public": sentAvatar])
                .eq("user_id", value: id).execute()
        } catch {
            // Antes el `try?` se comía el error y el interruptor se quedaba como si se hubiera
            // guardado. Se deshace el cambio y se avisa.
            if let previousName, namePublic == sentName { namePublic = previousName }
            if let previousAvatar, avatarPublic == sentAvatar { avatarPublic = previousAvatar }
            Haptics.error(); show("No se pudo guardar la privacidad")
        }
    }

    private func saveData() async {
        guard let id = session.userId else { return }
        guard onboardingLoaded else { show("No se pudieron cargar tus datos"); return }
        let num = { (s: String) in Double(s.replacingOccurrences(of: ",", with: ".")) }
        let trimmed = { (s: String) in s.trimmingCharacters(in: .whitespaces) }
        // Un campo a medio escribir no se envía como `nil` (borraría el dato que ya había): se avisa.
        if !trimmed(age).isEmpty, Int(trimmed(age)) == nil { show("Revisa la edad"); return }
        if !trimmed(height).isEmpty, num(height) == nil { show("Revisa la altura"); return }
        if !trimmed(weight).isEmpty, num(weight) == nil { show("Revisa el peso"); return }
        if !trimmed(days).isEmpty, Int(trimmed(days)) == nil { show("Revisa los días por semana"); return }
        if !trimmed(minutes).isEmpty, num(minutes) == nil { show("Revisa los minutos por sesión"); return }
        busy = true; defer { busy = false }
        struct Avail: Encodable { let days: Int?; let hours: Double?; let auto_calculated: Bool }
        struct U: Encodable { let user_id: UUID; let age: Int?; let height: Double?; let weight: Double?; let goal: String; let availability: Avail; let sports: String; let nutrition_preferences: String; let allergies: String }
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

/// Pide la contraseña de una cuenta guardada sin salir de Ajustes.
private struct AccountUnlockSheet: View {
    let target: SavedAccount
    var onUnlock: (String) async -> Bool

    @Environment(\.dismiss) private var dismiss
    @State private var password = ""
    @State private var busy = false
    @State private var error: String?

    var body: some View {
        VStack(spacing: 14) {
            VStack(spacing: 4) {
                Text(target.name).font(.apTitle2)
                Text(target.email).font(.apFootnote).foregroundStyle(Palette.muted).lineLimit(1)
            }
            .padding(.top, 8)

            SecureField("Contraseña", text: $password)
                .textContentType(.password)
                .submitLabel(.go)
                .onSubmit { Task { await unlock() } }
                .padding(14)
                .background(Palette.secondary, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                .accessibilityLabel("Contraseña de \(target.name)")

            if let error {
                Text(error).font(.apFootnote).foregroundStyle(Palette.destructive)
                    .fixedSize(horizontal: false, vertical: true)
            }

            Button {
                Task { await unlock() }
            } label: {
                if busy { ProgressView().tint(.black) } else { Text("Entrar") }
            }
            .buttonStyle(PillButtonStyle(kind: .primary, height: 50))
            .disabled(busy || password.isEmpty)

            Button("Cancelar") { dismiss() }
                .buttonStyle(.pillSecondary)
        }
        .padding(24)
        .presentationDetents([.medium])
        .presentationBackground(Palette.card)
    }

    private func unlock() async {
        guard !busy else { return }
        busy = true
        error = nil
        let ok = await onUnlock(password)
        busy = false
        if !ok {
            Haptics.error()
            error = "Contraseña incorrecta. Inténtalo de nuevo."
        }
    }
}
