import SwiftUI
import Supabase

/// Mi cuenta / Ajustes: perfil, contraseña, cuentas del dispositivo y sesión.
struct AccountView: View {
    @EnvironmentObject private var session: SessionModel
    @EnvironmentObject private var accounts: AccountStore
    @State private var name = ""
    @State private var newPassword = ""
    @State private var confirmPassword = ""
    @State private var message: String?
    @State private var busy = false

    var body: some View {
        Form {
            Section("Perfil") {
                LabeledContent("Nombre") {
                    TextField("Nombre", text: $name).multilineTextAlignment(.trailing)
                }
                LabeledContent("Correo", value: session.session?.user.email ?? "")
                Button("Guardar perfil") { Task { await saveProfile() } }.disabled(busy)
            }

            Section("Cambiar contraseña") {
                SecureField("Nueva (mínimo 6 caracteres)", text: $newPassword)
                SecureField("Repite la contraseña", text: $confirmPassword)
                Button("Cambiar contraseña") { Task { await changePassword() } }
                    .disabled(busy || newPassword.count < 6 || newPassword != confirmPassword)
            }

            Section {
                ForEach(accounts.accounts) { account in
                    HStack(spacing: 12) {
                        AvatarView(name: account.name, url: account.avatar, size: 36)
                        VStack(alignment: .leading) {
                            HStack(spacing: 4) {
                                Text(account.name).font(.apBody)
                                if account.requirePassword { Image(systemName: "lock.fill").font(.caption).foregroundStyle(Palette.muted).accessibilityLabel("pide contraseña") }
                            }
                            Text(account.expired ? "Vuelve a entrar" : account.email).font(.apFootnote).foregroundStyle(Palette.muted)
                        }
                        Spacer()
                        if account.id == session.userIdString {
                            Image(systemName: "checkmark").foregroundStyle(Palette.gold).accessibilityLabel("Cuenta actual")
                        }
                    }
                    .accessibilityElement(children: .combine)
                    .swipeActions {
                        if account.id != session.userIdString {
                            Button("Quitar", role: .destructive) { accounts.forget(account.id) }
                        }
                    }
                    .contextMenu {
                        if account.id != session.userIdString {
                            Button("Quitar de este dispositivo", role: .destructive) { accounts.forget(account.id) }
                        }
                    }
                }
                Button { session.showPicker = true } label: { Label("Cambiar de cuenta", systemImage: "arrow.left.arrow.right") }
                Button { session.addAnotherAccount() } label: { Label("Añadir otra cuenta", systemImage: "plus") }
            } header: {
                Text("Cuentas en este dispositivo")
            } footer: {
                Text("Cambia de cuenta sin cerrar sesión, como los usuarios de un Mac.")
            }

            Section {
                Button("Cerrar sesión", role: .destructive) { Task { await session.signOut() } }
            } footer: {
                Text("Cierra tu sesión en este dispositivo.")
            }

            if let message {
                Section { Text(message).font(.apFootnote) }
            }
        }
        .formStyle(.grouped)
        .scrollContentBackground(.hidden)
        .screenBackground()
        .task { await loadProfile() }
    }

    private func loadProfile() async {
        guard let id = session.userId else { return }
        struct Row: Decodable { let name: String? }
        if let row: Row = try? await Backend.client.from("profiles").select("name").eq("user_id", value: id).single().execute().value {
            name = row.name ?? ""
        }
    }

    private func saveProfile() async {
        guard let id = session.userId else { return }
        busy = true
        defer { busy = false }
        do {
            try await Backend.client.from("profiles").update(["name": name]).eq("user_id", value: id).execute()
            message = "Perfil guardado."
            Haptics.success()
        } catch {
            message = "No se pudo guardar el perfil."
            Haptics.error()
        }
    }

    private func changePassword() async {
        busy = true
        defer { busy = false }
        do {
            try await Backend.client.auth.update(user: UserAttributes(password: newPassword))
            newPassword = ""; confirmPassword = ""
            message = "Contraseña cambiada."
            Haptics.success()
        } catch {
            message = "No se pudo cambiar la contraseña."
            Haptics.error()
        }
    }
}
