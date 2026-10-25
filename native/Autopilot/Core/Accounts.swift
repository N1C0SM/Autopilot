import Foundation
import Supabase

/// Varias cuentas en el mismo dispositivo, como los usuarios de un Mac (igual que
/// `src/shared/lib/accounts.ts`): cada una guarda su sesión y cambiar carga la de otra.
struct SavedAccount: Codable, Identifiable, Equatable {
    let id: String
    var email: String
    var name: String
    var avatar: String?
    var accessToken: String
    var refreshToken: String
    /// La sesión dejó de valer: hay que volver a entrar.
    var expired: Bool = false
    /// Pedir la contraseña al elegirla en «¿Quién entrena?».
    var requirePassword: Bool = false
}

enum SwitchResult { case ok, offline, expired, wrong }

@MainActor
final class AccountStore: ObservableObject {
    static let shared = AccountStore()
    private let key = "accounts.v1"
    private let pendingLockKey = "accounts.pending-lock"

    @Published private(set) var accounts: [SavedAccount] = []
    @Published private(set) var defaultAccountId: String?

    init() {
        accounts = load()
        defaultAccountId = UserDefaults.standard.string(forKey: "accounts.default-id")
    }

    func setDefaultAccount(_ id: String?) {
        defaultAccountId = id
        if let id { UserDefaults.standard.set(id, forKey: "accounts.default-id") }
        else { UserDefaults.standard.removeObject(forKey: "accounts.default-id") }
    }

    private func load() -> [SavedAccount] {
        guard let data = Keychain.data(key) else { return [] }
        return (try? JSONDecoder().decode([SavedAccount].self, from: data)) ?? []
    }

    private func save(_ list: [SavedAccount]) {
        accounts = list
        if let data = try? JSONEncoder().encode(list) { Keychain.set(data, for: key) }
    }

    /// Guarda o actualiza la sesión de la cuenta activa (los tokens rotan al refrescarse).
    func remember(_ session: Session) {
        let user = session.user
        let meta = user.userMetadata
        let name = meta["full_name"]?.stringValue ?? meta["name"]?.stringValue ?? (user.email ?? "").components(separatedBy: "@").first ?? ""
        var list = accounts
        let lock = takePendingLock(for: user.id.uuidString.lowercased())
        if let i = list.firstIndex(where: { $0.id == user.id.uuidString.lowercased() }) {
            list[i].accessToken = session.accessToken
            list[i].refreshToken = session.refreshToken
            list[i].email = user.email ?? list[i].email
            list[i].expired = false
            if let lock { list[i].requirePassword = lock }
        } else {
            list.append(SavedAccount(
                id: user.id.uuidString.lowercased(), email: user.email ?? "", name: name,
                avatar: meta["avatar_url"]?.stringValue, accessToken: session.accessToken,
                refreshToken: session.refreshToken, requirePassword: lock ?? false))
        }
        save(list)
        Task { await syncProfile(id: user.id) }
    }

    /// Nombre y foto de la ficha del perfil, los mismos que en la web.
    private func syncProfile(id: UUID) async {
        struct Row: Decodable { let name: String?; let avatar_url: String? }
        guard let row: Row = try? await Backend.client.from("profiles").select("name, avatar_url")
            .eq("user_id", value: id).single().execute().value else { return }
        var list = accounts
        guard let i = list.firstIndex(where: { $0.id == id.uuidString.lowercased() }) else { return }
        if let n = row.name?.trimmingCharacters(in: .whitespaces), !n.isEmpty { list[i].name = n }
        if let a = row.avatar_url, !a.isEmpty { list[i].avatar = a }
        save(list)
    }

    func forget(_ id: String) { save(accounts.filter { $0.id != id }) }

    func setRequirePassword(_ id: String, _ value: Bool) {
        if accounts.contains(where: { $0.id == id }) {
            save(accounts.map { var a = $0; if a.id == id { a.requirePassword = value }; return a })
        } else {
            // La sesión aún no se ha guardado: se aplica en cuanto llegue.
            UserDefaults.standard.set([id: value], forKey: pendingLockKey)
        }
    }

    private func takePendingLock(for id: String) -> Bool? {
        guard let pending = UserDefaults.standard.dictionary(forKey: pendingLockKey) as? [String: Bool], let v = pending[id] else { return nil }
        UserDefaults.standard.removeObject(forKey: pendingLockKey)
        return v
    }

    private func markExpired(_ id: String) {
        save(accounts.map { var a = $0; if a.id == id { a.expired = true }; return a })
    }

    /// Entra en otra cuenta guardada. Sin conexión no se toca nada.
    func switchTo(_ id: String) async -> SwitchResult {
        guard let target = accounts.first(where: { $0.id == id }) else { return .expired }
        if let current = try? await Backend.client.auth.session { remember(current) }
        do {
            let session = try await Backend.client.auth.setSession(accessToken: target.accessToken, refreshToken: target.refreshToken)
            remember(session)
            return .ok
        } catch {
            // Solo un fallo real de red es "sin conexión"; cualquier otro rechazo pide volver a entrar.
            if Self.isNetworkError(error) { return .offline }
            markExpired(id)
            return .expired
        }
    }

    /// Entra en una cuenta protegida con su contraseña.
    func signIn(_ id: String, password: String) async -> SwitchResult {
        guard let target = accounts.first(where: { $0.id == id }) else { return .expired }
        if let current = try? await Backend.client.auth.session, current.user.id.uuidString.lowercased() != id { remember(current) }
        do {
            let session = try await Backend.client.auth.signIn(email: target.email, password: password)
            remember(session)
            return .ok
        } catch {
            if Self.isNetworkError(error) { return .offline }
            return .wrong
        }
    }

    static func isNetworkError(_ error: Error) -> Bool {
        if error is URLError { return true }
        let ns = error as NSError
        if ns.domain == NSURLErrorDomain { return true }
        if let underlying = ns.userInfo[NSUnderlyingErrorKey] as? NSError, underlying.domain == NSURLErrorDomain { return true }
        return false
    }
}
