import SwiftUI

/// «¿Quién entrena?»: elegir cuenta al abrir, como los usuarios de un Mac.
struct WhoIsTrainingView: View {
    @EnvironmentObject private var session: SessionModel
    @EnvironmentObject private var accounts: AccountStore
    @State private var asking: SavedAccount?
    @State private var password = ""
    @State private var wrong = false
    @State private var busy = false
    @State private var message: String?
    /// Foco del campo de contraseña de la hoja: se pide al abrir, salvo con VoiceOver (que navega
    /// a su ritmo y un foco automático le haría perder el hilo).
    @FocusState private var passwordFocused: Bool

    var body: some View {
        ScrollView {
            VStack(spacing: 28) {
                // Misma cabecera que «Hola de nuevo» (LoginView y `WhoIsTraining` en la web).
                VStack(spacing: 14) {
                    VStack(spacing: 10) {
                        BrandMark(size: 44)
                        Text("AUTOPILOT").font(.inter(size: 20, weight: .bold)).tracking(1.3)
                    }
                    .padding(.bottom, 10)
                    .accessibilityElement(children: .ignore)
                    .accessibilityLabel("Autopilot")
                    Text("¿Quién entrena?")
                        .font(.inter(size: 28, weight: .bold)).tracking(-0.6)
                        .accessibilityAddTraits(.isHeader)
                    Text("Elige tu cuenta. Marca una como predeterminada y entrará sola al abrir la app.")
                        .font(.apSubhead).foregroundStyle(Palette.muted)
                        .multilineTextAlignment(.center)
                }
                .padding(.top, 40)

                VStack(spacing: 10) {
                    ForEach(accounts.accounts) { account in accountRow(account) }
                    Button { session.addAnotherAccount() } label: {
                        HStack(spacing: 14) {
                            Image(systemName: "plus").font(.inter(size: 22, weight: .semibold)).foregroundStyle(Palette.gold)
                                .frame(width: 52, height: 52).background(Palette.secondary, in: Circle())
                            VStack(alignment: .leading, spacing: 2) {
                                Text("Añadir cuenta").font(.apHeadline)
                                Text("Otra persona en este dispositivo").font(.apSubhead).foregroundStyle(Palette.muted)
                            }
                            Spacer(minLength: 0)
                        }
                        .accountCard()
                    }
                    .buttonStyle(PressableCardStyle(scale: 0.98))
                    .disabled(busy)
                    .accessibilityElement(children: .ignore)
                    .accessibilityLabel("Añadir otra cuenta")
                    .accessibilityHint("Inicia sesión con otra cuenta")
                    .accessibilityAddTraits(.isButton)
                }

                if let message {
                    Text(message).font(.apFootnote).foregroundStyle(Palette.destructive)
                        .multilineTextAlignment(.center)
                        .accessibilityAddTraits(.updatesFrequently)
                }

                if let current = accounts.accounts.first(where: { $0.id == session.userIdString }), !current.requirePassword, session.session != nil {
                    Button("Seguir como \(current.name)") { session.showPicker = false }
                        .font(.apSubhead).foregroundStyle(Palette.muted).frame(minHeight: 44).buttonStyle(.plain)
                        .accessibilityHint("Cierra el selector y sigue con la cuenta actual")
                }
            }
            .padding(.horizontal, 20)
            .padding(.bottom, 32)
            .frame(maxWidth: 440).frame(maxWidth: .infinity)
        }
        .screenBackground()
        .sheet(item: $asking) { account in passwordSheet(account) }
        // El aviso (sin conexión, etc.) aparece sin mover el foco: se anuncia a VoiceOver.
        .onChange(of: message) { _, text in
            if let text { A11y.announce(text) }
        }
    }

    /// Una tarjeta por persona: foto, nombre y correo (o «Predeterminada» / «Vuelve a entrar»).
    private func accountRow(_ account: SavedAccount) -> some View {
        let isDefault = accounts.defaultId == account.id
        return Button { Task { await choose(account) } } label: {
            HStack(spacing: 14) {
                AvatarView(name: account.name, url: account.avatar, size: 52)
                VStack(alignment: .leading, spacing: 2) {
                    HStack(spacing: 6) {
                        Text(account.name).font(.apHeadline).lineLimit(1)
                        if account.requirePassword {
                            Image(systemName: "lock.fill").font(.inter(.caption)).foregroundStyle(Palette.muted)
                        }
                    }
                    Text(account.expired ? "Vuelve a entrar" : isDefault ? "Predeterminada" : account.email)
                        .font(.apSubhead).lineLimit(1)
                        .foregroundStyle(account.expired || isDefault ? Palette.gold : Palette.muted)
                }
                Spacer(minLength: 0)
                Image(systemName: "chevron.right").font(.inter(.footnote).weight(.semibold)).foregroundStyle(Palette.muted)
            }
            .accountCard()
        }
        // Se hunde un poco al pulsar (feedback coherente con el resto de tarjetas).
        .buttonStyle(PressableCardStyle(scale: 0.98))
        .disabled(busy)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(account.name
                            + (account.requirePassword ? ", pide contraseña" : "")
                            + (account.expired ? ", vuelve a entrar" : "")
                            + (isDefault ? ", cuenta predeterminada" : "")
                            + (account.id == session.userIdString ? ", cuenta actual" : ""))
        .accessibilityHint(account.expired ? "Vuelve a entrar para renovar la sesión"
                           : account.requirePassword ? "Pide contraseña antes de entrar"
                           : "Abre esta cuenta")
        .accessibilityAddTraits(.isButton)
        .contextMenu {
            if isDefault {
                Button("Ya no abrir con esta cuenta") { accounts.setDefault(nil) }
            } else {
                Button("Abrir siempre con esta cuenta") { accounts.setDefault(account.id) }
                    .disabled(account.requirePassword || account.expired)
            }
        }
    }

    private func passwordSheet(_ account: SavedAccount) -> some View {
        VStack(spacing: 20) {
            AvatarView(name: account.name, url: account.avatar, size: 72)
            Text(account.name).font(.inter(size: 22, weight: .bold)).tracking(-0.4).accessibilityAddTraits(.isHeader)
            Text("Introduce tu contraseña para continuar.").font(.apSubhead).foregroundStyle(Palette.muted)
            PillField(label: "Contraseña", text: $password, secure: true, contentType: .password)
                .focused($passwordFocused)
                .submitLabel(.go)
                .onSubmit { Task { await unlock(account) } }
            if wrong {
                Text("Contraseña incorrecta.").font(.apFootnote).foregroundStyle(Palette.destructive)
                    .accessibilityAddTraits(.updatesFrequently)
            }
            Button("Entrar") { Task { await unlock(account) } }.buttonStyle(.pill).disabled(password.isEmpty || busy)
                .keyboardShortcut(.defaultAction)
                .accessibilityHint("Desbloquea la cuenta en este dispositivo")
            Button("Cancelar") { asking = nil }.font(.apSubhead).foregroundStyle(Palette.muted).frame(minHeight: 44)
        }
        .padding(28)
        .frame(minWidth: 320)
        .presentationDetents([.medium])
        .presentationBackground(Palette.card)
        .onAppear { if !A11y.voiceOver { passwordFocused = true } }
    }

    private func choose(_ account: SavedAccount) async {
        Haptics.selection()
        message = nil
        if account.requirePassword && !account.expired { password = ""; wrong = false; asking = account; return }
        if account.id == session.userIdString && !account.expired { session.showPicker = false; return }
        busy = true
        defer { busy = false }
        switch await accounts.switchTo(account.id) {
        case .ok: Haptics.success(); await session.switched()
        case .offline: message = "Sin conexión. Inténtalo de nuevo cuando vuelvas a tener internet."
        default:
            UserDefaults.standard.set(account.email, forKey: "last-login")
            session.addAnotherAccount()
        }
    }

    private func unlock(_ account: SavedAccount) async {
        busy = true
        defer { busy = false }
        switch await accounts.signIn(account.id, password: password) {
        case .ok: Haptics.success(); asking = nil; await session.switched()
        case .offline:
            // Sin red no se puede comprobar la contraseña. Si es la cuenta que ya está abierta en
            // este dispositivo, no se deja a la persona fuera de su propio entrenamiento: la
            // sesión guardada sigue sirviendo y los datos descargados están en el teléfono.
            if account.id == session.userIdString {
                Haptics.success()
                asking = nil
                session.showPicker = false
                A11y.announce("Sin conexión. Entras en la cuenta guardada.")
            } else {
                wrong = false
                message = "Sin conexión. Elige la cuenta que ya está abierta o vuelve a intentarlo con internet."
                asking = nil
            }
        default:
            wrong = true
            Haptics.error()
            A11y.announce("Contraseña incorrecta")
        }
    }
}

/// Foto de perfil o inicial sobre gris.
struct AvatarView: View {
    let name: String
    let url: String?
    var size: CGFloat = 40

    var body: some View {
        Group {
            if let url, let u = URL(string: url) {
                CachedAsyncImage(url: u) { image in image.resizable().scaledToFill() } placeholder: { initial }
            } else {
                initial
            }
        }
        .frame(width: size, height: size)
        .clipShape(Circle())
        .accessibilityHidden(true)
    }

    private var initial: some View {
        Text(String(name.prefix(1)).uppercased())
            .font(.inter(size: size * 0.42, weight: .bold))
            .foregroundStyle(Palette.gold)
            .frame(width: size, height: size)
            .background(Palette.secondary)
    }
}

private extension View {
    /// Fila de cuenta: tarjeta sin borde de 22 pt, como el resto de la app.
    func accountCard() -> some View {
        padding(.vertical, 12).padding(.leading, 12).padding(.trailing, 18)
            .frame(maxWidth: .infinity, minHeight: 76, alignment: .leading)
            .background(Palette.card, in: RoundedRectangle(cornerRadius: 22, style: .continuous))
            .contentShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
    }
}
