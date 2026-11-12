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

        struct Row: Decodable { let id: UUID; let image_url: String? }
        var rows: [Row] = []
        if let found: [Row] = try? await Backend.client.rpc("get_brand_photos_public").execute().value {
            rows = found
        } else if let found: [Row] = try? await Backend.client.from("exercises").select("id, image_url")
            .in("id", values: Kind.allCases.map(\.exerciseId)).execute().value {
            rows = found
        }
        // Cancelada (cambio de cuenta): manda la petición nueva, y esta no cuenta como intento.
        if Task.isCancelled { lastAttempt = nil; return }
        var next = urls
        for kind in Kind.allCases {
            if let url = rows.first(where: { $0.id.uuidString.lowercased() == kind.exerciseId })?.image_url, !url.isEmpty {
                next[kind.rawValue] = url
            }
        }
        guard next != urls else { return }
        urls = next
        UserDefaults.standard.set(next, forKey: Self.storageKey)
    }
}
