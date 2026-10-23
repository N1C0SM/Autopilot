import SwiftUI

/// Acceso con correo o usuario. Al añadir otra cuenta ofrece protegerla con contraseña.
struct LoginView: View {
    @EnvironmentObject private var session: SessionModel
    @EnvironmentObject private var accounts: AccountStore
    @State private var identifier = UserDefaults.standard.string(forKey: "last-login") ?? ""
    @State private var password = ""
    @State private var lockAccount = false
    @State private var loading = false
    @State private var error: String?
    @FocusState private var focus: Field?
    enum Field { case identifier, password }

    private var offerLock: Bool { !accounts.accounts.isEmpty }

    var body: some View {
        ScrollView {
            VStack(spacing: 28) {
                VStack(spacing: 14) {
                    Image("Logo").resizable().scaledToFit().frame(width: 76, height: 76)
                        .clipShape(Circle()).accessibilityHidden(true)
                    Text(session.addingAccount ? "Añadir cuenta" : "Hola de nuevo").font(.apLargeTitle)
                        .accessibilityAddTraits(.isHeader)
                    Text("Inicia sesión para acceder a tu plan.").font(.apSubhead).foregroundStyle(Palette.muted)
                }
                .padding(.top, 40)

                VStack(spacing: 12) {
                    PillField(label: "Usuario o correo", text: $identifier, contentType: .username)
                        .focused($focus, equals: .identifier)
                        .submitLabel(.next)
                        .onSubmit { focus = .password }
                    PillField(label: "Contraseña", text: $password, secure: true, contentType: .password)
                        .focused($focus, equals: .password)
                        .submitLabel(.go)
                        .onSubmit { Task { await submit() } }
                    if let error {
                        Text(error).font(.apFootnote).foregroundStyle(Palette.destructive)
                            .frame(maxWidth: .infinity, alignment: .leading).padding(.horizontal, 8)
                            .accessibilityAddTraits(.updatesFrequently)
                    }
                    if offerLock {
                        Toggle(isOn: $lockAccount) {
                            Text("Pedir contraseña al elegir esta cuenta").font(.apSubhead).foregroundStyle(Palette.muted)
                        }
                        .toggleStyle(RoundCheckStyle())
                        .padding(.horizontal, 8).padding(.top, 4)
                    }
                }

                VStack(spacing: 12) {
                    Button { Task { await submit() } } label: {
                        if loading { ProgressView().tint(.black) } else { Text("Iniciar sesión") }
                    }
                    .buttonStyle(.pill)
                    .disabled(loading || identifier.trimmingCharacters(in: .whitespaces).isEmpty || password.isEmpty)
                    .keyboardShortcut(.defaultAction)

                    if session.addingAccount {
                        Button("Cancelar") { session.addingAccount = false }
                            .font(.apSubhead).foregroundStyle(Palette.muted).frame(minHeight: 44)
                    } else if accounts.accounts.count > 0 {
                        Button("¿Quién entrena?") { session.showPicker = true }
                            .font(.apSubhead).foregroundStyle(Palette.gold).frame(minHeight: 44)
                    }
                    Link("Crear una cuenta", destination: URL(string: "https://autopilotplan.app/signup")!)
                        .font(.apSubhead).foregroundStyle(Palette.muted).frame(minHeight: 44)
                }
            }
            .frame(maxWidth: 420)
            .padding(.horizontal, 24)
            .frame(maxWidth: .infinity)
        }
        .screenBackground()
        .onAppear { focus = identifier.isEmpty ? .identifier : .password }
    }

    private func submit() async {
        guard !loading else { return }
        loading = true
        error = nil
        defer { loading = false }
        do {
            try await session.signIn(identifier: identifier, password: password, lockAccount: offerLock ? lockAccount : nil)
            UserDefaults.standard.set(identifier.trimmingCharacters(in: .whitespaces), forKey: "last-login")
            Haptics.success()
        } catch SessionModel.LoginError.unconfirmed {
            error = "Debes verificar tu correo antes de iniciar sesión. Revisa tu bandeja de entrada."
            Haptics.error()
        } catch SessionModel.LoginError.rateLimited {
            error = "Demasiados intentos. Espera un minuto."
            Haptics.error()
        } catch SessionModel.LoginError.offline {
            error = "Sin conexión. Inténtalo de nuevo cuando vuelvas a tener internet."
            Haptics.error()
        } catch {
            self.error = "Usuario o contraseña incorrectos."
            Haptics.error()
        }
    }
}

/// Casilla redonda, como en Recordatorios.
struct RoundCheckStyle: ToggleStyle {
    func makeBody(configuration: Configuration) -> some View {
        Button { configuration.isOn.toggle(); Haptics.selection() } label: {
            HStack(spacing: 12) {
                Image(systemName: configuration.isOn ? "checkmark.circle.fill" : "circle")
                    .font(.system(size: 22))
                    .foregroundStyle(configuration.isOn ? Palette.gold : Palette.muted)
                configuration.label
                Spacer(minLength: 0)
            }
            .frame(minHeight: 44)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(.isButton)
        .accessibilityValue(configuration.isOn ? "Activado" : "Desactivado")
    }
}
