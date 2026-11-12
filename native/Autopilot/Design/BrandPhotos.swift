import Foundation
import Observation
import Supabase

/// Fotos de marca (las de `BRAND_PHOTOS` en `brandPhotos.ts`): son las fotos de 4 ejercicios de la
/// biblioteca. Su URL cambia cada vez que el admin regenera la foto o la pasa a WebP, y la anterior
/// se borra del bucket: con URLs fijas, Progreso, Hoy y la bienvenida se quedaron sin foto. Se piden
/// por id (`get_brand_photos_public`, también sin sesión) y se recuerdan en el dispositivo; hasta
/// saberlas, sale la foto de reserva incluida en la app.
@Observable
final class BrandPhotos {
    enum Kind: String, CaseIterable {
        case gym, dumbbells, home, pullupBar

        var exerciseId: String {
            switch self {
            case .gym: "a31c7206-d2a4-4b31-856a-f5dec09b890e"
            case .dumbbells: "d5e30e05-0791-4886-84a0-7b2695728225"
            case .home: "14988835-a004-49d6-95c5-63978dbce978"
            case .pullupBar: "7ab0b27f-f296-4fa6-bf07-8f8b026b0832"
            }
        }

        /// Si su ejercicio ya no está en la biblioteca (se borró o se reimportó), la foto es la del
        /// primer ejercicio publicado, por nombre, que encaje con estas palabras. Igual que
        /// `get_brand_photos_public` y `brandPhotos.ts`.
        var patterns: [String] {
            switch self {
            case .pullupBar: ["dominada"]
            case .dumbbells: ["mancuerna"]
            case .home: ["goblet", "flexi", "zancada"]
            case .gym: ["press", "sentadilla", "peso muerto"]
            }
        }
        var excludes: [String] { self == .home || self == .gym ? ["mancuerna"] : [] }
    }

    /// Orden en que se reparten las fotos (cada una con un ejercicio distinto).
    static let order: [Kind] = [.pullupBar, .dumbbells, .home, .gym]

    struct Row: Decodable {
        var slot: String?
        var id: UUID?
        var name: String?
        var image_url: String?
    }

    /// Elige la foto de cada hueco: la que ya decidió el servidor, la de su ejercicio o, si no
    /// está, la de un ejercicio parecido.
    static func pick(_ rows: [Row]) -> [String: String] {
        var out: [String: String] = [:]
        for row in rows {
            if let slot = row.slot, Kind(rawValue: slot) != nil, let url = row.image_url, !url.isEmpty { out[slot] = url }
        }
        let fold = { (text: String) in text.folding(options: [.diacriticInsensitive, .caseInsensitive], locale: nil).lowercased() }
        let live = rows.filter { $0.id != nil && !($0.image_url ?? "").isEmpty }
            .sorted { fold($0.name ?? "") < fold($1.name ?? "") }
        var used = Set(out.values)
        for kind in order where out[kind.rawValue] == nil {
            let own = live.first { $0.id?.uuidString.lowercased() == kind.exerciseId }
            let similar = live.first { row in
                let name = fold(row.name ?? "")
                return !used.contains(row.image_url ?? "") && kind.patterns.contains { name.contains($0) }
                    && !kind.excludes.contains { name.contains($0) }
            }
            if let url = (own ?? similar)?.image_url {
                out[kind.rawValue] = url
                used.insert(url)
            }
        }
        return out
    }

    static let shared = BrandPhotos()
    private static let storageKey = "brand-photos-v1"

    private var urls: [String: String]
    @ObservationIgnored private var refreshing = false
    @ObservationIgnored private var lastAttempt: Date?

    private init() {
        urls = (UserDefaults.standard.dictionary(forKey: Self.storageKey) as? [String: String]) ?? [:]
    }

    /// Foto propia incluida en la app (la misma que usa la web de reserva): sale mientras no se sabe
    /// la URL o si no se puede pedir, para que una portada nunca quede vacía.
    private static let fallback = Bundle.main.url(forResource: "brand-fallback", withExtension: "jpg")

    /// URL actual como texto. Leerla en `body` repinta la vista cuando llega.
    static func string(_ kind: Kind) -> String { url(kind)?.absoluteString ?? "" }
    static func url(_ kind: Kind) -> URL? { shared.urls[kind.rawValue].flatMap(URL.init(string:)) ?? fallback }

    /// Pide las URLs actuales: una vez por arranque y, si falta alguna, como mucho cada minuto.
    /// `force` (al entrar con una cuenta) pide aunque haya otra petición en curso: la del arranque
    /// sin sesión se cancela al restaurarse la sesión y antes se tragaba esta, así que las fotos
    /// no llegaban nunca.
    @MainActor func refresh(force: Bool = false) async {
        let complete = Kind.allCases.allSatisfy { urls[$0.rawValue] != nil }
        if !force {
            if refreshing { return }
            if let last = lastAttempt, complete || Date().timeIntervalSince(last) < 60 { return }
        }
        refreshing = true
        lastAttempt = Date()
        defer { refreshing = false }

        // Primero la función pública (vale sin sesión); con sesión, si falta alguna, la tabla.
        var picked: [String: String] = [:]
        if let rows: [Row] = try? await Backend.client.rpc("get_brand_photos_public").execute().value {
            picked = Self.pick(rows)
        }
        if Kind.allCases.contains(where: { picked[$0.rawValue] == nil }) {
            let ids = Kind.allCases.map(\.exerciseId).joined(separator: ",")
            let names = Kind.allCases.flatMap(\.patterns).map { "name.ilike.*\($0.replacingOccurrences(of: " ", with: "*"))*" }
            if let rows: [Row] = try? await Backend.client.from("exercises").select("id, name, image_url")
                .not("image_url", operator: .is, value: "null")
                .or((["id.in.(\(ids))"] + names).joined(separator: ","))
                .limit(300).execute().value {
                picked = Self.pick(rows).merging(picked) { _, server in server }
            }
        }
        // Cancelada (cambio de cuenta): manda la petición nueva, y esta no cuenta como intento.
        if Task.isCancelled { lastAttempt = nil; return }
        let next = urls.merging(picked) { _, new in new }
        guard next != urls else { return }
        urls = next
        UserDefaults.standard.set(next, forKey: Self.storageKey)
    }
}
