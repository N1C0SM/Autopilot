import Foundation
import Supabase

/// Rol y plan de la cuenta activa. El rol (usuario/entrenador/admin) y el plan
/// (free/plus/coach) van por separado, como en la web.
enum Role: String { case user, trainer, admin }

@MainActor
final class SessionModel: ObservableObject {
    @Published private(set) var session: Session?
    @Published private(set) var role: Role = .user
    @Published private(set) var ready = false
    /// Mostrar «¿Quién entrena?» al abrir (solo si la cuenta activa está protegida).
    @Published var showPicker = false
    /// Cuenta recién verificada guardando el cuestionario: se sigue en el alta hasta terminar.
    @Published var finishingSignup = false

    private let accounts = AccountStore.shared

    var userId: UUID? { session?.user.id }
    var userIdString: String? { session?.user.id.uuidString.lowercased() }

    func start() async {
        for await (event, session) in Backend.client.auth.authStateChanges {
            switch event {
            case .initialSession:
                self.session = session
                if let session { accounts.remember(session) }
                let currentLocked = accounts.accounts.contains { $0.id == userIdString && $0.requirePassword }
                // Se entra directo con la última cuenta usada; cambiar de cuenta: mantener el avatar.
                // Solo una cuenta protegida pide pasar por «¿Quién entrena?».
                showPicker = currentLocked
                #if DEBUG
                // Solo para capturas de QA: `-skipPicker` entra directo con la sesión activa.
                if ProcessInfo.processInfo.arguments.contains("-skipPicker") { showPicker = false }
                #endif
                // Cuenta predeterminada: si está disponible se entra directo en ella.
                if await openDefaultIfNeeded() { showPicker = false }
                // El rol guardado pinta la app correcta al instante; la comprobación real sigue
                // en segundo plano para no retrasar el arranque con dos RPC.
                if let id = userId { applyCachedRole(for: id) }
                ready = true
                if session != nil { await loadRole() }
            case .signedIn, .tokenRefreshed, .userUpdated:
                self.session = session
                if let session { accounts.remember(session); await loadRole() }
            case .signedOut:
                self.session = nil
                role = .user
            default:
                break
            }
        }
    }

    /// Entra directamente en la cuenta predeterminada al abrir. Devuelve `true` si la
    /// app ya puede mostrarse sin pasar por «¿Quién entrena?».
    private func openDefaultIfNeeded() async -> Bool {
        guard let def = accounts.defaultAccount else { return false }
        // Si pide contraseña o su sesión caducó se mantiene el comportamiento de siempre.
        guard !def.requirePassword, !def.expired else { return false }
        if def.id == userIdString { return true }
        switch await accounts.switchTo(def.id) {
        case .ok:
            await switched()
            return true
        case .offline:
            if let cached = try? await Backend.client.auth.session,
               cached.user.id.uuidString.lowercased() == def.id {
                self.session = cached
                accounts.remember(cached)
                await switched()
                return true
            }
            return false
        case .expired, .wrong:
            return false
        }
    }

    /// Rol recordado en el dispositivo (misma cuenta, mismo rol): evita esperar a la red al abrir.
    private static func roleKey(_ id: UUID) -> String { "account-role.\(id.uuidString.lowercased())" }

    private func applyCachedRole(for id: UUID) {
        guard let raw = UserDefaults.standard.string(forKey: Self.roleKey(id)),
              let cached = Role(rawValue: raw) else { return }
        role = cached
    }

    private func setRole(_ new: Role, for id: UUID) {
        role = new
        UserDefaults.standard.set(new.rawValue, forKey: Self.roleKey(id))
    }

    private func loadRole() async {
        guard let id = userId else {
            role = .user
            return
        }
        // Mientras se consultan los roles se puede cambiar de cuenta: el resultado solo se publica
        // si sigue siendo la misma cuenta (antes, al cambiar de admin a usuario, podía quedar .admin).
        // No se pone `.user` por defecto a propósito: MainShell reinicia la sección al cambiar el rol
        // y un cambio transitorio devolvería al usuario a Inicio.
        func has(_ r: String) async -> Bool {
            (try? await Backend.client.rpc("has_role", params: ["_user_id": id.uuidString, "_role": r]).execute().value as Bool) ?? false
        }
        let isAdmin = await has("admin")
        guard userId == id else { return }
        #if DEBUG
        // QA visual del panel de Admin sin cuenta admin en el dispositivo.
        if ProcessInfo.processInfo.arguments.contains("-forceAdmin") {
            setRole(.admin, for: id)
            return
        }
        #endif
        if isAdmin {
            setRole(.admin, for: id)
            return
        }
        let isTrainer = await has("trainer")
        guard userId == id else { return }
        setRole(isTrainer ? .trainer : .user, for: id)
    }

    enum LoginError: Error { case invalid, unconfirmed, rateLimited, offline }

    private func fallbackCachedSession(for identifier: String) async -> Session? {
        let cleaned = identifier.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard let cached = try? await Backend.client.auth.session else { return nil }
        let email = cached.user.email?.lowercased() ?? ""
        let id = cached.user.id.uuidString.lowercased()
        let cachedAccount = accounts.accounts.first { $0.id == id }
        guard cachedAccount?.requirePassword != true else { return nil }
        let matches = cleaned == email || cleaned == id || cachedAccount?.email.lowercased() == cleaned
        return matches ? cached : nil
    }

    /// Correo o nombre de usuario. El usuario se resuelve en el servidor
    /// (`login-identifier`), que nunca devuelve el correo que hay detrás.
    func signIn(identifier: String, password: String, lockAccount: Bool?) async throws {
        let cleaned = identifier.trimmingCharacters(in: .whitespacesAndNewlines)
        do {
            let session: Session
            if cleaned.contains("@") {
                session = try await Backend.client.auth.signIn(email: cleaned, password: password)
            } else {
                struct Tokens: Decodable { let access_token: String; let refresh_token: String }
                let tokens: Tokens = try await Backend.client.functions.invoke(
                    "login-identifier", options: FunctionInvokeOptions(body: ["identifier": cleaned, "password": password]))
                session = try await Backend.client.auth.setSession(accessToken: tokens.access_token, refreshToken: tokens.refresh_token)
            }
            if let lockAccount { accounts.setRequirePassword(session.user.id.uuidString.lowercased(), lockAccount) }
            accounts.remember(session)
            addingAccount = false
        } catch {
            if AccountStore.isNetworkError(error), let cached = await fallbackCachedSession(for: cleaned) {
                self.session = cached
                accounts.remember(cached)
                addingAccount = false
                return
            }
            if AccountStore.isNetworkError(error) { throw LoginError.offline }
            let text = String(describing: error)
            if text.contains("not confirmed") || text.contains("email_not_confirmed") { throw LoginError.unconfirmed }
            if text.contains("rate_limited") { throw LoginError.rateLimited }
            throw LoginError.invalid
        }
    }

    /// Abre la pantalla de acceso sin cerrar la sesión actual: al entrar con otra
    /// cuenta se sustituye, y la anterior queda guardada (no se revoca en el servidor).
    @Published var addingAccount = false

    func addAnotherAccount() {
        if let s = session { accounts.remember(s) }
        showPicker = false
        addingAccount = true
    }

    func signOut() async {
        try? await Backend.client.auth.signOut(scope: .local)
        if let id = userIdString { accounts.forget(id) }
        // Nada de la persona que sale se queda en el disco del aparato.
        Snapshots.clear()
        session = nil
    }

    func switched() async {
        // Si no se puede leer la sesión nueva, se prefiere pedir entrada a dejar en pantalla los
        // datos de la cuenta anterior (con `try?` queda `nil` → LoginView).
        session = try? await Backend.client.auth.session
        await loadRole()
        showPicker = false
    }
}
