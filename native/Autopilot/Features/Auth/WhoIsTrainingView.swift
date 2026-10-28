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

    private let columns = [GridItem(.adaptive(minimum: 120, maximum: 160), spacing: 20)]

    var body: some View {
        ScrollView {
            VStack(spacing: 28) {
                Text("¿Quién entrena?").font(.apLargeTitle).padding(.top, 56).accessibilityAddTraits(.isHeader)

                LazyVGrid(columns: columns, spacing: 24) {
                    ForEach(accounts.accounts) { account in
                        Button { Task { await choose(account) } } label: {
                            VStack(spacing: 10) {
                                AvatarView(name: account.name, url: account.avatar, size: 88)
                                HStack(spacing: 4) {
                                    // Dos líneas con texto grande en vez de truncar el nombre.
                                    Text(account.name).font(.apHeadline)
                                        .lineLimit(2).minimumScaleFactor(0.8)
                                        .multilineTextAlignment(.center)
                                    if account.requirePassword {
                                        Image(systemName: "lock.fill").font(.inter(.footnote)).foregroundStyle(Palette.muted)
                                    }
                                }
                                if account.expired { Text("Vuelve a entrar").font(.apFootnote).foregroundStyle(Palette.muted) }
                                if accounts.defaultId == account.id {
                                    Text("Predeterminada").font(.apCaption).foregroundStyle(Palette.gold)
                                }
                            }
                            .frame(minHeight: 44)
                            .contentShape(Rectangle())
                        }
                        // Se hunde un poco al pulsar (feedback coherente con el resto de tarjetas).
                        .buttonStyle(PressableCardStyle(scale: 0.96))
                        .disabled(busy)
                        .accessibilityLabel(account.name
                                            + (account.requirePassword ? ", pide contraseña" : "")
                                            + (account.expired ? ", vuelve a entrar" : "")
                                            + (accounts.defaultId == account.id ? ", cuenta predeterminada" : "")
                                            + (account.id == session.userIdString ? ", cuenta actual" : ""))
                        .accessibilityHint(account.expired ? "Vuelve a entrar para renovar la sesión"
                                           : account.requirePassword ? "Pide contraseña antes de entrar"
                                           : "Abre esta cuenta")
                        .contextMenu {
                            if accounts.defaultId == account.id {
                                Button("Ya no abrir con esta cuenta") { accounts.setDefault(nil) }
                            } else {
                                Button("Abrir siempre con esta cuenta") { accounts.setDefault(account.id) }
                                    .disabled(account.requirePassword || account.expired)
                            }
                        }
                    }
                    Button { session.addAnotherAccount() } label: {
                        VStack(spacing: 10) {
                            Image(systemName: "plus").font(.inter(size: 30, weight: .semibold)).foregroundStyle(Palette.gold)
                                .frame(width: 88, height: 88).background(Palette.gold.opacity(0.15), in: Circle())
                            Text("Añadir").font(.apHeadline)
                        }
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(PressableCardStyle(scale: 0.96))
                    .accessibilityLabel("Añadir otra cuenta")
                    .accessibilityHint("Inicia sesión con otra cuenta")
                }
                .padding(.horizontal, 24)

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
            .frame(maxWidth: 640).frame(maxWidth: .infinity)
        }
        .screenBackground()
        .sheet(item: $asking) { account in passwordSheet(account) }
        // El aviso (sin conexión, etc.) aparece sin mover el foco: se anuncia a VoiceOver.
        .onChange(of: message) { _, text in
            if let text { A11y.announce(text) }
        }
    }

    private func passwordSheet(_ account: SavedAccount) -> some View {
        VStack(spacing: 20) {
            AvatarView(name: account.name, url: account.avatar, size: 72)
            Text(account.name).font(.apTitle2).accessibilityAddTraits(.isHeader)
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
        case .offline: wrong = false; message = "Sin conexión."; asking = nil
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
