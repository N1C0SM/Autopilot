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

    private let columns = [GridItem(.adaptive(minimum: 120, maximum: 160), spacing: 20)]

    var body: some View {
        ScrollView {
            VStack(spacing: 28) {
                Text("¿Quién entrena?").font(.apLargeTitle).padding(.top, 56).accessibilityAddTraits(.isHeader)

                LazyVGrid(columns: columns, spacing: 24) {
                    ForEach(accounts.accounts) { account in
                        let isDefault = accounts.defaultAccountId == account.id
                        Button { Task { await choose(account) } } label: {
                            VStack(spacing: 10) {
                                ZStack(alignment: .bottomTrailing) {
                                    AvatarView(name: account.name, url: account.avatar, size: 88)
                                    if isDefault {
                                        Image(systemName: "star.fill").font(.system(size: 14, weight: .bold))
                                            .foregroundStyle(Palette.gold)
                                            .padding(3)
                                            .background(Palette.background, in: Circle())
                                            .offset(x: 2, y: 2)
                                    }
                                }
                                HStack(spacing: 4) {
                                    Text(account.name).font(.apHeadline).lineLimit(1)
                                    if account.requirePassword {
                                        Image(systemName: "lock.fill").font(.inter(.footnote)).foregroundStyle(Palette.muted)
                                    }
                                }
                                if isDefault {
                                    Text("Predeterminada").font(.apFootnote).foregroundStyle(Palette.gold)
                                } else if account.expired {
                                    Text("Vuelve a entrar").font(.apFootnote).foregroundStyle(Palette.muted)
                                }
                            }
                            .frame(minHeight: 44)
                        }
                        .buttonStyle(.plain)
                        .disabled(busy)
                        .contextMenu {
                            if isDefault {
                                Button { accounts.setDefaultAccount(nil); Haptics.tap() } label: {
                                    Label("Quitar predeterminada", systemImage: "star.slash")
                                }
                            } else {
                                Button { accounts.setDefaultAccount(account.id); Haptics.tap() } label: {
                                    Label("Usar como predeterminada", systemImage: "star.fill")
                                }
                            }
                        }
                        .accessibilityLabel(account.name + (isDefault ? ", predeterminada" : "") + (account.requirePassword ? ", pide contraseña" : "") + (account.expired ? ", vuelve a entrar" : ""))
                    }
                    Button { session.addAnotherAccount() } label: {
                        VStack(spacing: 10) {
                            Image(systemName: "plus").font(.inter(size: 30, weight: .semibold)).foregroundStyle(Palette.gold)
                                .frame(width: 88, height: 88).background(Palette.gold.opacity(0.15), in: Circle())
                            Text("Añadir").font(.apHeadline)
                        }
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Añadir otra cuenta")
                }
                .padding(.horizontal, 24)

                if let message { Text(message).font(.apFootnote).foregroundStyle(Palette.destructive) }

                if let current = accounts.accounts.first(where: { $0.id == session.userIdString }), !current.requirePassword, session.session != nil {
                    Button("Seguir como \(current.name)") { session.showPicker = false }
                        .font(.apSubhead).foregroundStyle(Palette.muted).frame(minHeight: 44).buttonStyle(.plain)
                }
            }
            .frame(maxWidth: 640).frame(maxWidth: .infinity)
        }
        .screenBackground()
        .sheet(item: $asking) { account in passwordSheet(account) }
    }

    private func passwordSheet(_ account: SavedAccount) -> some View {
        VStack(spacing: 20) {
            AvatarView(name: account.name, url: account.avatar, size: 72)
            Text(account.name).font(.apTitle2)
            PillField(label: "Contraseña", text: $password, secure: true, contentType: .password)
                .onSubmit { Task { await unlock(account) } }
            if wrong { Text("Contraseña incorrecta.").font(.apFootnote).foregroundStyle(Palette.destructive) }
            Button("Entrar") { Task { await unlock(account) } }.buttonStyle(.pill).disabled(password.isEmpty || busy)
                .keyboardShortcut(.defaultAction)
            Button("Cancelar") { asking = nil }.font(.apSubhead).foregroundStyle(Palette.muted).frame(minHeight: 44)
        }
        .padding(28)
        .frame(minWidth: 320)
        .presentationDetents([.medium])
        .presentationBackground(Palette.card)
    }

    private func choose(_ account: SavedAccount) async {
        Haptics.selection()
        message = nil
        if account.requirePassword && !account.expired { password = ""; wrong = false; asking = account; return }
        if account.id == session.userIdString && !account.expired { session.showPicker = false; return }
        busy = true
        defer { busy = false }
        switch await accounts.switchTo(account.id) {
        case .ok: await session.switched()
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
        case .ok: asking = nil; await session.switched()
        case .offline: wrong = false; message = "Sin conexión."; asking = nil
        default: wrong = true; Haptics.error()
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
