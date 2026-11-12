import Foundation
import Observation
import Supabase

/// Fotos de marca (las de `BRAND_PHOTOS` en `brandPhotos.ts`): son las fotos de 4 ejercicios de la
/// biblioteca. Su URL cambia cada vez que el admin regenera la foto o la pasa a WebP, y la anterior
/// se borra del bucket: con URLs fijas, Progreso, Hoy y la bienvenida se quedaron sin foto. Se piden
/// por id (`get_brand_photos_public`, también sin sesión) y se recuerdan en el dispositivo; hasta
/// saberlas, cada vista enseña su fondo de reserva.
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

    /// URL actual como texto ("" hasta saberla). Leerla en `body` repinta la vista cuando llega.
    static func string(_ kind: Kind) -> String { shared.urls[kind.rawValue] ?? "" }
    static func url(_ kind: Kind) -> URL? { URL(string: string(kind)) }

    /// Pide las URLs actuales: una vez por arranque y, si falta alguna, como mucho cada minuto
    /// (`force` al cambiar de cuenta, porque con sesión también vale la tabla).
    @MainActor func refresh(force: Bool = false) async {
        guard !refreshing else { return }
        let complete = Kind.allCases.allSatisfy { urls[$0.rawValue] != nil }
        if !force, let last = lastAttempt, complete || Date().timeIntervalSince(last) < 60 { return }
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
