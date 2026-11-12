import SwiftUI
import PhotosUI
import UniformTypeIdentifiers
import Supabase
#if os(iOS)
import UIKit
#endif

/// Última ficha de cada cuenta vista en Ajustes, guardada en el dispositivo para pintar la pantalla
/// al instante. Solo lo que se enseña (sin ids de pago).
private struct CachedProfile: Codable {
    var name: String
    var avatar: String?
    var namePublic: Bool
    var avatarPublic: Bool
    var subTier: String?
    var subStatus: String
    var subEnd: Date?
    var paymentPaid: Bool
    var oneTimePurchase: Bool

    private static func key(_ id: UUID) -> String { "settings-profile.\(id.uuidString.lowercased())" }
    static func load(_ id: UUID) -> CachedProfile? {
        guard let data = UserDefaults.standard.data(forKey: key(id)) else { return nil }
        return try? JSONDecoder().decode(CachedProfile.self, from: data)
    }
    func save(_ id: UUID) {
        if let data = try? JSONEncoder().encode(self) { UserDefaults.standard.set(data, forKey: Self.key(id)) }
    }
    static func forget(_ id: UUID) { UserDefaults.standard.removeObject(forKey: key(id)) }
}

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
    @State private var workoutView = UserDefaults.standard.string(forKey: "workout-view") ?? "focus"
    @State private var workoutLayout = UserDefaults.standard.string(forKey: "workout-layout") ?? "rows"
    @AppStorage("appearance") private var appearance: String = "system"
    @State private var photo: PhotosPickerItem?
    @State private var exportDoc: JSONDoc?
    @State private var confirmDelete = false
    /// Acceso con Google vinculado (Ajustes → Contraseña) y número total de accesos.
    @State private var googleIdentity: UserIdentity?
    @State private var identityCount = 0
    @State private var subTier: String?
    /// Cuenta a la que se está cambiando (spinner) y cuenta que pide contraseña.
    @State private var switching: String?
    @State private var unlocking: SavedAccount?
    @State private var subStatus = ""
    @State private var subEnd: Date?
    @State private var paymentPaid = false
    @State private var oneTimePurchase = false
    @State private var isAdmin = false
    /// Ficha y datos ya cargados del servidor. Sin esto, un fallo de red dejaba los campos vacíos
    /// y «Guardar» podía sobrescribir con vacíos lo que ya había (pérdida de datos).
    @State private var profileLoaded = false
    /// El plan que se enseña viene del servidor o de la última ficha guardada en el dispositivo.
    @State private var planKnown = false
    @State private var onboardingLoaded = false
    /// Sección abierta desde el índice (su propia pantalla).
    @State private var openPage: SettingsPage?
    /// Igual que la web: «training» = Plus; «full», «transform», «personal» = Coach.
    private var planName: String { ["full", "transform", "personal"].contains(subTier ?? "") ? "Coach" : subTier == "training" ? "Plus" : "Free" }
    private var paid: Bool { planName != "Free" }
    private var subActive: Bool { subStatus == "active" || subStatus == "trialing" }
    /// Plus o Coach pagado y en vigor, igual que `hasCoaching` (entitlements.ts). Sin esto,
    /// Ajustes no enseña nada de comida: eso llega con Plus y su propio onboarding.
    private var hasPlus: Bool {
        guard paymentPaid, paid else { return false }
        return oneTimePurchase || (subActive && (subEnd.map { $0 > Date() } ?? true))
    }

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

    /// En Mac el padding horizontal lo pone `RootView` (el `<main>` de la web): aquí 0.
    private var pagePadding: CGFloat {
        #if os(macOS)
        return 0
        #else
        return 16
        #endif
    }

    private static let goals = [("lose_weight", "Perder peso"), ("gain_muscle", "Ganar músculo"), ("improve_endurance", "Mejorar resistencia")]
    private static let rests = [(45, "45 s"), (60, "1 min"), (90, "1.5 min"), (120, "2 min"), (180, "3 min")]

    #if os(iOS)
    @Environment(\.horizontalSizeClass) private var sizeClass
    /// iPhone: el subtítulo va bajo el título grande; en iPad/Mac la barra ya lleva su pista.
    private var sizeClassCompact: Bool { sizeClass == .compact }
    #endif

    /// Fila del índice de Ajustes (maqueta de ChatGPT): icono, título, detalle y chevron; abre su pantalla.
    private func hubRow(_ symbol: String, _ title: String, _ detail: String, to target: SettingsPage) -> some View {
        hubRow(symbol, title, detail, to: target) { EmptyView() }
    }

    /// La misma fila con algo antes del chevron (la insignia de «Mi plan»).
    private func hubRow<Trailing: View>(_ symbol: String, _ title: String, _ detail: String, to target: SettingsPage,
                                        @ViewBuilder trailing: () -> Trailing) -> some View {
        let accessory = trailing()
        return Button {
            Haptics.tap()
            openPage = target
        } label: {
            HStack(spacing: 12) {
                Image(systemName: symbol).font(.system(size: 18)).foregroundStyle(Palette.muted)
                    .frame(width: 28).accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 2) {
                    Text(title).font(.apBody).foregroundStyle(Palette.foreground)
                    Text(detail).font(.apFootnote).foregroundStyle(Palette.muted).lineLimit(2)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                accessory
                Image(systemName: "chevron.right").font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Palette.muted.opacity(0.6)).accessibilityHidden(true)
            }
            .frame(minHeight: 56)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    /// Índice agrupado de Ajustes, como `SettingsPanel.tsx`: cada fila abre su sección en su pantalla.
    /// Subtítulo bajo el título grande (en iPad/Mac la barra ya lleva su pista).
    @ViewBuilder private var hubSubtitle: some View {
        #if os(iOS)
        if sizeClassCompact {
            Text("Gestiona tu cuenta, plan y preferencias.").font(.apSubhead).foregroundStyle(Palette.muted)
        }
        #endif
    }

    @ViewBuilder private var hub: some View {
        group("Mi cuenta") {
            hubRow("person", "Perfil", "Nombre, foto y privacidad", to: .perfil)
            hubRow("target", "Tus datos y objetivo", "Edad, peso, objetivo y disponibilidad", to: .datos)
            // Siempre en su sitio (antes aparecía al llegar la ficha y empujaba las filas de debajo).
            // El plan va en una insignia; hasta saberlo, un hueco del mismo tamaño.
            hubRow("crown", "Mi plan", "Tu suscripción y lo que incluye", to: .plan) {
                SubscriptionBadge(name: planKnown ? planName : nil, paid: paid)
            }
            hubRow("person.2", "Cuentas en este dispositivo", "Cambia de cuenta sin cerrar sesión", to: .cuentas)
        }
        group("Preferencias") {
            hubRow("dumbbell", "Tu forma de entrenar", "Vista, disposición y descanso del entreno", to: .entreno)
            hubRow("key", "Contraseña", "Contraseña y cuentas vinculadas", to: .contrasena)
        }
        group("Apariencia") {
            HStack {
                Text("Modo").font(.apBody)
                Spacer()
                Picker("Apariencia", selection: $appearance) {
                    Text("Sistema").tag("system")
                    Text("Claro").tag("light")
                    Text("Oscuro").tag("dark")
                }
                .pickerStyle(.segmented)
                .frame(width: 220)
            }
            .padding(.horizontal, 16).padding(.vertical, 12)
        }
        group("Privacidad y legal") {
            hubRow("checkmark.shield", "Privacidad y mis datos", "Exporta tus datos y política de privacidad", to: .privacidad)
            hubRow("doc.text", "Legal", "Términos, cookies y avisos", to: .legal)
        }
    }

    // MARK: Secciones (cada fila del índice abre la suya en su propia pantalla)

    @ViewBuilder private var profileSection: some View {
                // La foto y el nombre grandes ya encabezan el índice: aquí solo para el admin, que no lo tiene.
                if isAdmin { header }

                group("Perfil") {
                    fieldRow("Nombre") { TextField("Nombre", text: $name).multilineTextAlignment(.trailing).textFieldStyle(.plain) }
                    row("Correo") { Text(session.session?.user.email ?? "").foregroundStyle(Palette.muted).lineLimit(1).minimumScaleFactor(0.8).truncationMode(.middle) }
                    actionRow("Guardar perfil") { await saveProfile() }
                }

                group("Privacidad", footer: "Esto decide qué pueden ver los demás.") {
                    toggleRow("Nombre público", "Si está apagado, se muestran solo tus iniciales.", namePublicBinding)
                    toggleRow("Foto de perfil pública", "Si está apagado, se muestra un icono genérico.", avatarPublicBinding)
                }

    }

    @ViewBuilder private var dataSection: some View {

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
                    if !hasPlus { actionRow("Guardar datos") { await saveData() } }
                }
                // Deportes (calendario) es avanzado: fuera de Ajustes. Lo de comida, solo con Plus.
                if hasPlus {
                group("Lo que te gusta") {
                    FoodChips(options: FoodPrefs.likes, isOn: { FoodPrefs.readLikes(nutritionPrefs).contains($0) }) { v in
                        nutritionPrefs = FoodPrefs.writeLikes(nutritionPrefs, FoodPrefs.toggle(FoodPrefs.readLikes(nutritionPrefs), v))
                    }
                }
                group("Lo que no comes") {
                    FoodChips(options: FoodPrefs.avoid, isOn: { v in FoodPrefs.split(allergies).contains { $0.lowercased() == v.lowercased() } }) { v in
                        allergies = FoodPrefs.toggle(FoodPrefs.split(allergies), v).joined(separator: ", ")
                    }
                }
                group("Preferencias nutricionales") { TextField("Vegetariano, sin lactosa…", text: $nutritionPrefs, axis: .vertical).textFieldStyle(.plain).frame(minHeight: 44) }
                group("Alergias y otros alimentos a evitar") {
                    TextField("Frutos secos, marisco…", text: $allergies, axis: .vertical).textFieldStyle(.plain).frame(minHeight: 44)
                    actionRow("Guardar datos") { await saveData() }
                }
                }

    }

    @ViewBuilder private var trainingSection: some View {

                group("Tu forma de entrenar", footer: "Elige cuánto quieres descansar al marcar una serie. El temporizador se inicia solo durante tu entreno. La disposición cambia cómo se organizan las tarjetas, no la vista «Ejercicio a ejercicio».") {
                    VStack(alignment: .leading, spacing: 10) {
                        Text("Vista del entrenamiento").font(.apBody)
                        SegmentedPill(options: ["Lista vertical", "Ejercicio a ejercicio"], selection: Binding(
                            get: { workoutView == "focus" ? 1 : 0 },
                            set: { workoutView = $0 == 1 ? "focus" : "list"; UserDefaults.standard.set(workoutView, forKey: "workout-view") }))
                    }
                    .padding(.vertical, 6)
                    VStack(alignment: .leading, spacing: 10) {
                        Text("Disposición de los ejercicios").font(.apBody)
                        SegmentedPill(options: ["En filas", "En columnas"], selection: Binding(
                            get: { workoutLayout == "columns" ? 1 : 0 },
                            set: { workoutLayout = $0 == 1 ? "columns" : "rows"; UserDefaults.standard.set(workoutLayout, forKey: "workout-layout") }))
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

    }

    @ViewBuilder private var passwordSection: some View {

                group("Cambiar contraseña") {
                    fieldRow("Nueva") { SecureField("Mínimo 6 caracteres", text: $newPassword).multilineTextAlignment(.trailing).textFieldStyle(.plain) }
                    fieldRow("Confirmar") { SecureField("Repite la contraseña", text: $confirmPassword).multilineTextAlignment(.trailing).textFieldStyle(.plain) }
                    actionRow("Cambiar contraseña", disabled: newPassword.count < 6 || newPassword != confirmPassword) { await changePassword() }
                }
                if googleIdentity != nil {
                    group("Cuentas vinculadas", footer: "Desconectar quita ese acceso; sigues entrando con tu correo y contraseña.") {
                        actionRow("Desconectar de Google") { await unlinkGoogle() }
                    }
                }
                Color.clear.frame(height: 0).task { await loadIdentities() }

    }

    private func loadIdentities() async {
        guard let ids = try? await Backend.client.auth.userIdentities() else { return }
        identityCount = ids.count
        googleIdentity = ids.first { $0.provider == "google" }
    }

    private func unlinkGoogle() async {
        guard let identity = googleIdentity else { return }
        // Nunca dejar la cuenta sin acceso (misma regla que `canUnlink` en la web).
        guard identityCount > 1 else { Haptics.error(); show("Crea una contraseña antes de desconectar Google"); return }
        do {
            try await Backend.client.auth.unlinkIdentity(identity)
            await loadIdentities()
            Haptics.success(); show("Google desconectado")
        } catch { Haptics.error(); show("No se pudo desconectar Google") }
    }

    @ViewBuilder private var planSection: some View {
                if !isAdmin, planKnown {
                    // Hasta tener la ficha (o la última guardada) no se enseña el plan: «Free» por defecto mentiría a quien paga.
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

    }

    @ViewBuilder private var privacySection: some View {

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

    }

    @ViewBuilder private var legalSection: some View {

                group("Legal") {
                    linkRow("Términos", "https://autopilotplan.app/legal/terminos")
                    linkRow("Cookies", "https://autopilotplan.app/legal/cookies")
                    linkRow("Disclaimer médico", "https://autopilotplan.app/legal/disclaimer-medico")
                    linkRow("Aviso legal", "https://autopilotplan.app/legal/aviso-legal")
                }

    }

    @ViewBuilder private var accountsSection: some View {
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
                                            BrandLoader().tint(Palette.gold).padding(.trailing, 6)
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

    }

    /// Cerrar sesión y eliminar cuenta: al final del índice, como en Ajustes de iOS.
    @ViewBuilder private var sessionSection: some View {
                group("Sesión", footer: "Cierra tu sesión en este dispositivo.") {
                    Button { Task { await session.signOut() } } label: {
                        Label("Cerrar sesión", systemImage: "rectangle.portrait.and.arrow.right").font(.apBody).foregroundStyle(Palette.destructive).frame(maxWidth: .infinity, alignment: .leading)
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
                .surface()
    }

    /// Contenido de una pantalla de Ajustes.
    @ViewBuilder private func sections(_ page: SettingsPage) -> some View {
        switch page {
        case .perfil: profileSection
        case .datos: dataSection
        case .plan: planSection
        case .entreno: trainingSection
        case .contrasena: passwordSection
        case .privacidad: privacySection
        case .legal: legalSection
        case .cuentas: accountsSection
        }
    }

    /// Pantalla de una sección: su contenido con el mismo lienzo, aviso y teclado que el índice.
    private func page(_ page: SettingsPage) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 28) { sections(page) }
                .padding(.horizontal, pagePadding).padding(.top, 8).padding(.bottom, 16)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .screenBackground()
        .navigationTitle(page.title)
        #if os(iOS)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItemGroup(placement: .keyboard) {
                Spacer()
                Button("Listo") { commitRest(); restFocused = false; dismissKeyboard() }
            }
        }
        #endif
        .overlay(alignment: .top) { toastView }
    }

    @ViewBuilder private var toastView: some View {
        if let toast {
            Text(toast).font(.apSubhead.weight(.semibold)).padding(.horizontal, 16).padding(.vertical, 10)
                .background(.ultraThinMaterial, in: Capsule()).padding(.top, 8)
                // Con «Reducir movimiento» el aviso entra con un fundido, sin deslizarse.
                .transition(reduceMotion ? .opacity : .move(edge: .top).combined(with: .opacity))
                .accessibilityAddTraits(.isStaticText)
        }
    }


    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 28) {
                if isAdmin {
                    // El admin no tiene índice: todo seguido, como hasta ahora.
                    profileSection
                    trainingSection
                    passwordSection
                    privacySection
                    legalSection
                    accountsSection
                } else {
                    // Solo el índice (perfil arriba y una fila por sección): cada fila abre su
                    // pantalla. Antes debajo del índice seguían todas las secciones de antes.
                    hubSubtitle
                    header
                    hub
                }
                sessionSection
            }
            .padding(.horizontal, pagePadding).padding(.top, 8).padding(.bottom, 16)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .screenBackground()
        .navigationDestination(item: $openPage) { page($0) }
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
        .overlay(alignment: .top) { toastView }
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
        guard let p else { return }
        defer { photo = nil }
        guard let id = session.userId, let data = try? await p.loadTransferable(type: Data.self),
              let img = PlatformImage(data: data), let jpg = img.jpegData(maxSide: 800) else {
            Haptics.error(); show("No se pudo abrir la foto"); return
        }
        let path = "\(id.uuidString.lowercased())/avatar.jpg"
        do {
            let uploadURL = Backend.url.appendingPathComponent("storage/v1/object/avatars/\(path)")
            var req = URLRequest(url: uploadURL)
            req.httpMethod = "POST"
            req.setValue("image/jpeg", forHTTPHeaderField: "Content-Type")
            req.setValue(Backend.publishableKey, forHTTPHeaderField: "apikey")
            if let token = try? await Backend.client.auth.session.accessToken {
                req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
            }
            req.setValue("true", forHTTPHeaderField: "x-upsert")
            let (data, response) = try await URLSession.shared.upload(for: req, from: jpg)
            let status = (response as? HTTPURLResponse)?.statusCode ?? 0
            guard (200..<300).contains(status) else {
                let msg = String(data: data, encoding: .utf8) ?? "HTTP \(status)"
                throw NSError(domain: "avatar-upload", code: status, userInfo: [NSLocalizedDescriptionKey: "upload: \(msg)"])
            }
            let url = Backend.url.appendingPathComponent("storage/v1/object/public/avatars/\(path)").absoluteString + "?t=\(Int(Date().timeIntervalSince1970))"
            var updateComponents = URLComponents(url: Backend.url.appendingPathComponent("rest/v1/profiles"), resolvingAgainstBaseURL: false)!
            updateComponents.queryItems = [URLQueryItem(name: "user_id", value: "eq.\(id.uuidString.lowercased())")]
            let updateURL = updateComponents.url!
            var ureq = URLRequest(url: updateURL)
            ureq.httpMethod = "PATCH"
            ureq.setValue("application/json", forHTTPHeaderField: "Content-Type")
            ureq.setValue(Backend.publishableKey, forHTTPHeaderField: "apikey")
            if let token = try? await Backend.client.auth.session.accessToken {
                ureq.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
            }
            ureq.setValue("return=minimal", forHTTPHeaderField: "Prefer")
            let body = try JSONSerialization.data(withJSONObject: ["avatar_url": url])
            ureq.httpBody = body
            let (udata, uresponse) = try await URLSession.shared.data(for: ureq)
            let ustatus = (uresponse as? HTTPURLResponse)?.statusCode ?? 0
            guard (200..<300).contains(ustatus) else {
                let msg = String(data: udata, encoding: .utf8) ?? "HTTP \(ustatus)"
                throw NSError(domain: "avatar-profile", code: ustatus, userInfo: [NSLocalizedDescriptionKey: "profile: \(msg)"])
            }
            avatar = url
            accounts.updateProfile(id: id.uuidString.lowercased(), avatar: url)
            Haptics.success(); show("Foto actualizada")
        } catch let e {
            Haptics.error()
            print("AVATAR UPLOAD ERROR: \(e)")
            show("No se pudo subir la foto: \(e.localizedDescription)")
        }
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
            if let id = session.userId { CachedProfile.forget(id) }
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
            .surface()
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

    private func apply(_ p: CachedProfile) {
        name = p.name; avatar = p.avatar; namePublic = p.namePublic; avatarPublic = p.avatarPublic
        subTier = p.subTier; subStatus = p.subStatus; subEnd = p.subEnd
        paymentPaid = p.paymentPaid; oneTimePurchase = p.oneTimePurchase
        planKnown = true
    }

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
            goal = "gain_muscle"; subTier = nil; subStatus = ""; subEnd = nil; paymentPaid = false; oneTimePurchase = false
            planKnown = false
            // Lo último que se vio de esta cuenta sale al instante (nombre, foto, plan): sin esto, cada
            // vez que se entraba en Ajustes la cabecera y «Mi plan» llegaban tarde y la lista se movía.
            // Guardar sigue bloqueado hasta que responda el servidor (`profileLoaded`).
            if let cached = CachedProfile.load(id) { apply(cached) }
        }
        struct P: Decodable { let name: String?; let avatar_url: String?; let name_public: Bool?; let avatar_public: Bool?; let subscription_tier: String?; let subscription_status: String?; let subscription_end: Date?; let payment_status: String?; let stripe_payment_id: String? }
        if let p: P = try? await Backend.client.from("profiles").select("name, avatar_url, name_public, avatar_public, subscription_tier, subscription_status, subscription_end, payment_status, stripe_payment_id")
            .eq("user_id", value: id).single().execute().value {
            let fresh = CachedProfile(name: p.name ?? "", avatar: p.avatar_url, namePublic: p.name_public ?? false, avatarPublic: p.avatar_public ?? false,
                                      subTier: p.subscription_tier, subStatus: p.subscription_status ?? "inactive", subEnd: p.subscription_end,
                                      paymentPaid: p.payment_status == "paid", oneTimePurchase: !(p.stripe_payment_id ?? "").isEmpty)
            apply(fresh)
            fresh.save(id)
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
        // Lo que no se ve aquí no se envía (deportes nunca, comida solo con Plus): un `nil` se omite
        // del JSON, así un fallo al cargar nunca borra lo guardado sin que se vea.
        struct U: Encodable { let user_id: UUID; let age: Int?; let height: Double?; let weight: Double?; let goal: String; let availability: Avail; let nutrition_preferences: String?; let allergies: String? }
        let row = U(user_id: id, age: Int(age), height: num(height), weight: num(weight), goal: goal,
                    availability: Avail(days: Int(days), hours: num(minutes).map { $0 / 60 }, auto_calculated: false),
                    nutrition_preferences: hasPlus ? nutritionPrefs : nil,
                    allergies: hasPlus ? allergies.trimmingCharacters(in: .whitespaces) : nil)
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
                if busy { BrandLoader().tint(.black) } else { Text("Entrar") }
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

/// Gustos y alimentos a evitar como chips (igual que `src/shared/lib/foodPrefs.ts`).
enum FoodPrefs {
    static let likes = ["Pollo", "Ternera", "Pescado", "Huevos", "Arroz", "Pasta", "Patata", "Legumbres",
                        "Verduras", "Fruta", "Yogur", "Avena", "Pan", "Frutos secos", "Tofu"]
    static let avoid = ["Lactosa", "Gluten", "Frutos secos", "Marisco", "Pescado", "Huevo", "Cerdo", "Carne roja",
                        "Vegetariano", "Vegano", "Picante"]
    private static let prefix = "Le gusta: "

    static func split(_ text: String) -> [String] {
        text.split(separator: ",").map { $0.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty }
    }
    static func toggle(_ list: [String], _ item: String) -> [String] {
        list.contains { $0.lowercased() == item.lowercased() } ? list.filter { $0.lowercased() != item.lowercased() } : list + [item]
    }
    static func readLikes(_ prefs: String) -> [String] {
        guard let seg = prefs.components(separatedBy: " · ").first(where: { $0.hasPrefix(prefix) }) else { return [] }
        return split(String(seg.dropFirst(prefix.count)))
    }
    static func writeLikes(_ prefs: String, _ likes: [String]) -> String {
        var parts = prefs.components(separatedBy: " · ").map { $0.trimmingCharacters(in: .whitespaces) }
            .filter { !$0.isEmpty && !$0.hasPrefix(prefix) }
        if !likes.isEmpty { parts.append(prefix + likes.joined(separator: ", ")) }
        return parts.joined(separator: " · ")
    }
}

/// Chips de selección múltiple en píldora (`ChipGroup` de la web).
struct FoodChips: View {
    let options: [String]
    let isOn: (String) -> Bool
    let onToggle: (String) -> Void

    var body: some View {
        FlowRow(spacing: 8) {
            ForEach(options, id: \.self) { o in
                let on = isOn(o)
                Button { Haptics.selection(); onToggle(o) } label: {
                    HStack(spacing: 6) {
                        if on { Image("lu-check").renderingMode(.template).resizable().frame(width: 14, height: 14) }
                        Text(o).font(.apSubhead.weight(.medium))
                    }
                    .padding(.horizontal, 14).frame(height: 38)
                    .foregroundStyle(on ? Palette.gold : Palette.foreground)
                    .background(on ? Palette.gold.opacity(0.15) : Palette.secondary, in: Capsule())
                }
                .buttonStyle(.plain)
                .accessibilityAddTraits(on ? .isSelected : [])
            }
        }
        .padding(.vertical, 10)
    }
}

/// Pantallas de Ajustes que abre el índice (como `SettingsPanel.tsx`).
enum SettingsPage: String, Identifiable, Hashable {
    case perfil, datos, plan, entreno, contrasena, privacidad, legal, cuentas
    var id: String { rawValue }
    var title: String {
        switch self {
        case .perfil: "Perfil"
        case .datos: "Tus datos y objetivo"
        case .plan: "Mi plan"
        case .entreno: "Tu forma de entrenar"
        case .contrasena: "Contraseña"
        case .privacidad: "Privacidad y mis datos"
        case .legal: "Legal"
        case .cuentas: "Cuentas en este dispositivo"
        }
    }
}
