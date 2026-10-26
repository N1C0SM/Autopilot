import Foundation
import Supabase

/// Rol y plan de la cuenta activa. El rol (usuario/entrenador/admin) y el plan
/// (free/plus/coach) van por separado, como en la web.
enum Role { case user, trainer, admin }

@MainActor
final class SessionModel: ObservableObject {
    @Published private(set) var session: Session?
    @Published private(set) var role: Role = .user
    @Published private(set) var ready = false
    /// Mostrar «¿Quién entrena?» al abrir (varias cuentas o cuenta protegida).
    @Published var showPicker = false

    private let accounts = AccountStore.shared

    var userId: UUID? { session?.user.id }
    var userIdString: String? { session?.user.id.uuidString.lowercased() }

    func start() async {
        for await (event, session) in Backend.client.auth.authStateChanges {
            switch event {
            case .initialSession:
                self.session = session
                if let session { accounts.remember(session); await loadRole() }
                
                // Si hay una cuenta predeterminada marcada, entramos en ella sin preguntar quién entrena.
                if let defId = accounts.defaultAccountId,
                   let target = accounts.accounts.first(where: { $0.id == defId }),
                   !target.requirePassword {
                    if userIdString != defId {
                        // `switchTo` no actualiza este modelo: refrescamos sesión y rol solo si entra.
                        switch await accounts.switchTo(defId) {
                        case .ok:
                            await switched()
                        case .offline, .expired, .wrong:
                            // Si la predeterminada falla (sin red, caducada o rechazada), mostramos el
                            // picker para elegir o volver a entrar en vez de quedarnos sin salida.
                            showPicker = true
                        }
                    } else {
                        showPicker = false
                    }
                } else {
                    // Sin predeterminada utilizable (o protegida con contraseña): decidimos si hace falta el picker.
                    let currentLocked = accounts.accounts.contains { $0.id == userIdString && $0.requirePassword }
                    let defaultLocked = accounts.defaultAccountId
                        .flatMap { id in accounts.accounts.first { $0.id == id } }?.requirePassword == true
                    showPicker = accounts.accounts.count >= 2 || currentLocked || defaultLocked
                }
                ready = true
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

    private func loadRole() async {
        guard let id = userId else { return }
        func has(_ r: String) async -> Bool {
            (try? await Backend.client.rpc("has_role", params: ["_user_id": id.uuidString, "_role": r]).execute().value as Bool) ?? false
        }
        if await has("admin") { role = .admin } else if await has("trainer") { role = .trainer } else { role = .user }
    }

    enum LoginError: Error { case invalid, unconfirmed, rateLimited, offline }

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
        session = nil
    }

    func switched() async {
        session = try? await Backend.client.auth.session
        await loadRole()
        showPicker = false
    }
}

