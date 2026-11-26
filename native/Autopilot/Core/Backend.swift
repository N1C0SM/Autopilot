import Foundation
import Supabase

/// El mismo proyecto de Supabase que la web: mismas tablas, RLS, funciones y planes.
/// La clave publicable es pública (la lleva también la web).
enum Backend {
    /// Producción por defecto.
    static let productionURL = URL(string: "https://enebrcdrdnfkyduzyrzm.supabase.co")!
    static let productionKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVuZWJyY2RyZG5ma3lkdXp5cnptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5ODIzMjksImV4cCI6MjA4ODU1ODMyOX0.X-E8IIiL4hxkAeE4immBPbcAbi25LuW8yYT0xzWqovU"

    /// En DEBUG se puede apuntar a la base de pruebas sin recompilar la configuración:
    /// `-supabaseURL=https://<ref>.supabase.co -supabaseKey=<anon key>`
    /// (main usa producción; staging puede lanzarse contra la BBDD de prueba).
    static let url: URL = {
        #if DEBUG
        if let v = arg("supabaseURL"), let u = URL(string: v) { return u }
        #endif
        return productionURL
    }()

    static let publishableKey: String = {
        #if DEBUG
        if let v = arg("supabaseKey"), !v.isEmpty { return v }
        #endif
        return productionKey
    }()

    /// La sesión guardada se entrega al instante, aunque el token esté caducado: la app abre con
    /// los datos ya descargados (offline primero) y el refresco ocurre por detrás al haber red.
    /// Sin esto, el SDK intentaba refrescar antes de abrir y, sin internet, dejaba al usuario en
    /// la pantalla de acceso, donde es imposible entrar sin conexión.
    static let client = SupabaseClient(
        supabaseURL: url,
        supabaseKey: publishableKey,
        options: .init(auth: .init(emitLocalSessionAsInitialSession: true))
    )

    /// Filas por petición: PostgREST corta cada respuesta en 1.000 aunque haya más (`ROWS_PER_PAGE` en la web).
    static let rowsPerPage = 1000

    /// Lee una tabla entera por páginas (`range`) hasta la última, como `fetchAllRows` en la web: listas como
    /// la biblioteca de ejercicios no se quedan en las primeras 1.000 filas. La consulta debe tener un orden
    /// estable (el nombre y después el id), o una fila podría repetirse o perderse entre dos páginas.
    static func allRows<Row>(_ page: (_ from: Int, _ to: Int) async throws -> [Row]) async throws -> [Row] {
        var rows: [Row] = []
        var from = 0
        while true {
            let chunk = try await page(from, from + rowsPerPage - 1)
            rows += chunk
            if chunk.count < rowsPerPage { return rows }
            from += rowsPerPage
        }
    }

    #if DEBUG
    private static func arg(_ name: String) -> String? {
        let prefix = "-\(name)="
        return ProcessInfo.processInfo.arguments
            .first { $0.hasPrefix(prefix) }
            .map { String($0.dropFirst(prefix.count)) }
    }
    #endif
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
