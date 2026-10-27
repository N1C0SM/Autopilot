import Foundation
import Supabase

/// El mismo proyecto de Supabase que la web: mismas tablas, RLS, funciones y planes.
/// La clave publicable es pública (la lleva también la web).
enum Backend {
    static let url = URL(string: "https://enebrcdrdnfkyduzyrzm.supabase.co")!
    static let publishableKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVuZWJyY2RyZG5ma3lkdXp5cnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5ODIzMjksImV4cCI6MjA4ODU1ODMyOX0.X-E8IIiL4hxkAeE4immBPbcAbi25LuW8yYT0xzWqovU"

    static let client = SupabaseClient(supabaseURL: url, supabaseKey: publishableKey)
}

/// Guarda pequeños valores en el llavero (sesiones de las cuentas guardadas).
enum Keychain {
    private static let service = "app.autopilotplan.native"

    static func data(_ key: String) -> Data? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        var out: AnyObject?
        return SecItemCopyMatching(query as CFDictionary, &out) == errSecSuccess ? out as? Data : nil
    }

    static func set(_ data: Data, for key: String) {
        let base: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
        ]
        SecItemDelete(base as CFDictionary)
        var add = base
        add[kSecValueData as String] = data
        add[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock
        SecItemAdd(add as CFDictionary, nil)
    }
}
