import Foundation

/// Caché en disco de la última respuesta buena de cada pantalla. Al abrir la app se pinta
/// al instante con ella y la red la refresca por detrás (`TopScreens`), así que ni Inicio ni
/// Nutrición arrancan en esqueleto. Cada usuario tiene sus claves y se borra al cerrar sesión.
enum Snapshots {
    /// Versión del formato: al cambiarlo, las cachés viejas se ignoran solas.
    private static let version = 1
    /// Una caché más vieja que esto ya no se usa: mejor esqueleto que datos de hace días.
    private static let maxAge: TimeInterval = 3 * 24 * 60 * 60
    private static let queue = DispatchQueue(label: "app.autopilotplan.snapshots", qos: .utility)

    private static var directory: URL? {
        guard let base = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first else { return nil }
        let dir = base.appendingPathComponent("snapshots", isDirectory: true)
        if !FileManager.default.fileExists(atPath: dir.path) {
            try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        }
        return dir
    }

    private static func fileURL(_ key: String) -> URL? {
        guard let directory else { return nil }
        return directory.appendingPathComponent("\(version)-\(fnv(key)).json")
    }

    /// Hash estable de la clave: el nombre del archivo no depende de tildes ni de la ruta.
    private static func fnv(_ text: String) -> String {
        var hash: UInt64 = 0xcbf2_9ce4_8422_2325
        for byte in text.utf8 {
            hash ^= UInt64(byte)
            hash = hash &* 0x0000_0100_0000_01b3
        }
        return String(hash, radix: 16)
    }

    static func save<T: Encodable>(_ value: T, _ key: String) {
        guard let file = fileURL(key) else { return }
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .secondsSince1970
        guard let data = try? encoder.encode(value) else { return }
        queue.async {
            try? data.write(to: file, options: .atomic)
        }
    }

    static func load<T: Decodable>(_ type: T.Type, _ key: String) -> T? {
        guard let file = fileURL(key) else { return nil }
        if let attributes = try? FileManager.default.attributesOfItem(atPath: file.path),
           let modified = attributes[.modificationDate] as? Date,
           Date().timeIntervalSince(modified) > maxAge {
            try? FileManager.default.removeItem(at: file)
            return nil
        }
        guard let data = try? Data(contentsOf: file) else { return nil }
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .secondsSince1970
        return try? decoder.decode(type, from: data)
    }

    /// Al cerrar sesión no se deja nada de la persona anterior en el disco.
    static func clear() {
        guard let directory else { return }
        queue.async {
            let files = (try? FileManager.default.contentsOfDirectory(at: directory, includingPropertiesForKeys: nil)) ?? []
            for file in files where file.pathExtension == "json" {
                try? FileManager.default.removeItem(at: file)
            }
        }
    }
}
