import SwiftUI
import Supabase

/// Acceso con correo o usuario. Al añadir otra cuenta ofrece protegerla con contraseña.
struct LoginView: View {
    /// Alta dentro de la app (cuestionario y cuenta al final); nil al añadir otra cuenta.
    var onCreateAccount: (() -> Void)?
    @EnvironmentObject private var session: SessionModel
    @EnvironmentObject private var accounts: AccountStore
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var identifier = UserDefaults.standard.string(forKey: "last-login") ?? ""
    @State private var password = ""
    @State private var lockAccount = false
    @State private var loading = false
    @State private var error: String?
    @State private var forgot = false
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
                    Button("¿Olvidaste la contraseña?") { Haptics.tap(); forgot = true }
                        .font(.apSubhead).foregroundStyle(Palette.gold).frame(minHeight: 44)
                        .frame(maxWidth: .infinity, alignment: .trailing).padding(.horizontal, 8)
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
                        if loading {
                            // El icono de carga no aporta nada a VoiceOver: el botón ya dice
                            // «Iniciando sesión» mientras dura la petición.
                            BrandLoader().tint(.black).accessibilityHidden(true)
                        } else {
                            Text("Iniciar sesión")
                        }
                    }
                    .buttonStyle(.pill)
                    .disabled(loading || identifier.trimmingCharacters(in: .whitespaces).isEmpty || password.isEmpty)
                    .accessibilityLabel(loading ? "Iniciando sesión" : "Iniciar sesión")
                    .accessibilityValue(loading ? "En curso" : "")
                    .accessibilityHint(loading ? "" : "Accede con tu usuario y contraseña")
                    .keyboardShortcut(.defaultAction)
                    .apAnimation(.easeInOut(duration: 0.2), value: loading, reduceMotion: reduceMotion)

                    if session.addingAccount {
                        Button("Cancelar") { session.addingAccount = false }
                            .font(.apSubhead).foregroundStyle(Palette.muted).frame(minHeight: 44)
                    } else if accounts.accounts.count > 0 {
                        Button("¿Quién entrena?") { session.showPicker = true }
                            .font(.apSubhead).foregroundStyle(Palette.gold).frame(minHeight: 44)
                            .accessibilityHint("Elige entre las cuentas guardadas en este dispositivo")
                    }
                    if let onCreateAccount {
                        Button("Crear una cuenta gratis") { Haptics.tap(); onCreateAccount() }
                            .font(.apSubhead).foregroundStyle(Palette.muted).frame(minHeight: 44)
                            .accessibilityHint("Prepara tu rutina y crea la cuenta al final")
                    }
                }
            }
            .frame(maxWidth: 420)
            .padding(.horizontal, 24)
            .frame(maxWidth: .infinity)
        }
        // Con el teclado abierto (y texto grande) el botón no queda tapado: se puede arrastrar.
        .scrollDismissesKeyboard(.interactively)
        .screenBackground()
        .sheet(isPresented: $forgot) { ForgotPasswordSheet(email: identifier.contains("@") ? identifier : "") }
        // No se roba el foco del teclado a VoiceOver: quien usa lector de pantalla navega a su
        // ritmo y un foco automático le haría perder el hilo del formulario.
        .onAppear { if !A11y.voiceOver { focus = identifier.isEmpty ? .identifier : .password } }
        // El error aparece sin que el foco se mueva: se anuncia a VoiceOver en voz alta.
        .onChange(of: error) { _, text in
            if let text { A11y.announce("Error: \(text)") }
        }
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

/// Casilla redonda, como en Recordatorios. VoiceOver la lee como interruptor con su estado
/// («Activado» / «Desactivado») y su acción, no como un botón sin contexto.
struct RoundCheckStyle: ToggleStyle {
    func makeBody(configuration: Configuration) -> some View {
        Button { configuration.isOn.toggle(); Haptics.selection() } label: {
            HStack(spacing: 12) {
                Image(systemName: configuration.isOn ? "checkmark.circle.fill" : "circle")
                    .font(.inter(size: 22))
                    .foregroundStyle(configuration.isOn ? Palette.gold : Palette.muted)
                configuration.label
                Spacer(minLength: 0)
            }
            .frame(minHeight: 44)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits([.isButton, .isToggle])
        .accessibilityValue(configuration.isOn ? "Activado" : "Desactivado")
        .accessibilityHint(configuration.isOn ? "Desactiva pedir contraseña al elegir esta cuenta" : "Pide contraseña al elegir esta cuenta")
    }
}

/// «Recuperar contraseña» de la web (`ForgotPassword.tsx`): el enlace abre el cambio de
/// contraseña en la web y después se entra aquí con la nueva.
struct ForgotPasswordSheet: View {
    @Environment(\.dismiss) private var dismiss
    @State var email: String
    @State private var sent = false
    @State private var loading = false
    @State private var error: String?

    var body: some View {
        VStack(spacing: 24) {
            VStack(spacing: 12) {
                Image(systemName: sent ? "envelope.badge" : "key.fill").font(.system(size: 36, weight: .semibold))
                    .foregroundStyle(Palette.gold).accessibilityHidden(true)
                Text(sent ? "Revisa tu correo" : "Recuperar contraseña").font(.apTitle1).accessibilityAddTraits(.isHeader)
                Text(sent ? "Te hemos enviado un enlace a \(email) para restablecer tu contraseña." : "Te enviaremos un enlace a tu correo.")
                    .font(.apSubhead).foregroundStyle(Palette.muted).multilineTextAlignment(.center)
            }
            if !sent {
                PillField(label: "Correo electrónico", text: $email, contentType: .email)
                if let error {
                    Text(error).font(.apFootnote).foregroundStyle(Palette.destructive)
                        .frame(maxWidth: .infinity, alignment: .leading).padding(.horizontal, 8)
                }
            }
            Button { if sent { dismiss() } else { Task { await send() } } } label: {
                if loading { BrandLoader().tint(.black).accessibilityHidden(true) }
                else { Text(sent ? "Volver al inicio de sesión" : "Enviar enlace") }
            }
            .buttonStyle(.pill)
            .disabled(loading || (!sent && !email.contains("@")))
            .accessibilityLabel(loading ? "Enviando…" : sent ? "Volver al inicio de sesión" : "Enviar enlace")
            Spacer(minLength: 0)
        }
        .padding(24).padding(.top, 16)
        .frame(maxWidth: 420)
        .frame(maxWidth: .infinity)
        .screenBackground()
        .presentationDetents([.medium, .large])
        .onChange(of: error) { _, text in
            if let text { A11y.announce("Error: \(text)") }
        }
    }

    private func send() async {
        loading = true
        error = nil
        defer { loading = false }
        do {
            try await Backend.client.auth.resetPasswordForEmail(email.trimmingCharacters(in: .whitespacesAndNewlines),
                                                                redirectTo: URL(string: "https://autopilotplan.com/reset-password"))
            Haptics.success()
            sent = true
        } catch {
            Haptics.error()
            self.error = AccountStore.isNetworkError(error)
                ? "Sin conexión. Inténtalo de nuevo cuando vuelvas a tener internet."
                : "No hemos podido enviar el enlace. Revisa el correo e inténtalo de nuevo."
        }
    }
}
