import SwiftUI
import Supabase

/// Biblioteca de ejercicios. Mismas listas, reglas y pantallas que la web
/// (`src/shared/lib/exerciseLibrary.ts` y `src/app/components/library/ExerciseLibrarySheet.tsx`).
enum ExerciseLibraryCatalog {
    static let groups = ["Pecho", "Espalda", "Hombros", "Bíceps", "Tríceps", "Antebrazos", "Abdomen",
                         "Cuádriceps", "Isquiotibiales", "Glúteos", "Gemelos", "Cuerpo completo"]
    static let equipment = ["Peso corporal", "Mancuernas", "Barra", "Máquinas", "Poleas", "Kettlebell",
                            "Bandas elásticas", "Anillas", "Barra de dominadas", "Paralelas", "Otros"]
    static let modalities = ["Gimnasio", "Calistenia", "Entrenamiento funcional", "Entrenamiento híbrido", "Movilidad"]
    static let detailSections = ["Cómo se hace", "Músculos", "Errores frecuentes", "Consejos", "Seguridad", "Variantes", "Alternativas"]

    static let legacyGroups: [String: [String]] = [
        "Pecho": ["Pecho"], "Serrato": ["Pecho"],
        "Espalda": ["Espalda"], "Trapecios": ["Espalda"], "Romboides": ["Espalda"], "Lumbares": ["Espalda"],
        "Hombros": ["Hombros"], "Bíceps": ["Bíceps"], "Tríceps": ["Tríceps"], "Antebrazos": ["Antebrazos"],
        "Core": ["Abdomen"], "Abdomen": ["Abdomen"],
        "Piernas": ["Cuádriceps"], "Cuádriceps": ["Cuádriceps"], "Aductores": ["Cuádriceps"],
        "Isquiotibiales": ["Isquiotibiales"], "Glúteos": ["Glúteos"], "Abductores": ["Glúteos"], "Gemelos": ["Gemelos"],
        "Cuerpo completo": ["Cuerpo completo"], "Cardio": ["Cuerpo completo"],
    ]
    static let legacyModalities: [String: [String]] = [
        "Gimnasio": ["Gimnasio"], "Calistenia": ["Calistenia"], "Mixto": ["Entrenamiento híbrido"],
    ]
    static let levels = [1: "Básico", 2: "Intermedio", 3: "Avanzado"]

    /// «1 ejercicio», «12 ejercicios», «1.234 ejercicios»: punto de miles siempre y el plural
    /// correcto. Igual que `exerciseCount` en la web (`exerciseLibrary.ts`).
    static func count(_ n: Int) -> String { "\(NumberText.grouped(Double(max(0, n)))) \(n == 1 ? "ejercicio" : "ejercicios")" }

    /// La huella de un grupo muscular (la deducida de su nombre): el visual de la tarjeta sin
    /// foto, como `groupGlyph` en la web.
    static func groupGlyph(_ group: String) -> ExerciseMotion.Spec {
        ExerciseMotion.specFor(name: group, pattern: nil, stimulus: nil, load: nil, muscleGroup: group)
    }

    /// Igual que `public.exercise_name_key`: minúsculas, sin acentos ni signos.
    static func nameKey(_ value: String) -> String {
        let folded = value.folding(options: [.diacriticInsensitive, .caseInsensitive], locale: Locale(identifier: "es")).lowercased()
        let mapped = folded.unicodeScalars.map { CharacterSet.alphanumerics.contains($0) && $0.isASCII ? Character($0) : " " }
        return String(mapped).split(separator: " ").joined(separator: " ")
    }

    private static func withinOneEdit(_ a: [Character], _ b: [Character]) -> Bool {
        if abs(a.count - b.count) > 1 { return false }
        var i = 0, j = 0, edits = 0
        while i < a.count && j < b.count {
            if a[i] == b[j] { i += 1; j += 1; continue }
            edits += 1
            if edits > 1 { return false }
            if a.count > b.count { i += 1 } else if a.count < b.count { j += 1 } else { i += 1; j += 1 }
        }
        return edits + (a.count - i) + (b.count - j) <= 1
    }

    private static func fuzzyPrefix(_ token: String, _ word: String) -> Bool {
        if word.hasPrefix(token) { return true }
        guard token.count >= 4 else { return false }
        let t = Array(token), w = Array(word)
        return [-1, 0, 1].contains { d in withinOneEdit(t, Array(w.prefix(max(0, t.count + d)))) }
    }

    static func matchScore(_ e: LibraryExercise, _ query: String) -> Int {
        let q = nameKey(query)
        if q.isEmpty { return 1 }
        let tokens = q.split(separator: " ").map(String.init)
        var best = 0
        for label in [e.name] + e.altNames {
            let key = nameKey(label)
            let words = key.split(separator: " ").map(String.init)
            if key.hasPrefix(q) { best = max(best, 4); continue }
            if tokens.allSatisfy({ t in words.contains { $0.hasPrefix(t) } }) { best = max(best, 3); continue }
            if key.contains(q) { best = max(best, 2); continue }
            if tokens.allSatisfy({ t in words.contains { fuzzyPrefix(t, $0) } }) { best = max(best, 1) }
        }
        return best
    }

    static func isFullBody(_ e: LibraryExercise) -> Bool { e.groups.contains("Cuerpo completo") || Set(e.groups).count >= 3 }

    /// Filtros combinables: Y entre facetas, O dentro de cada faceta. Con texto, por relevancia.
    static func filter(_ items: [LibraryExercise], _ f: LibraryFilters) -> [LibraryExercise] {
        let groups = f.groups.filter { $0 != "Cuerpo completo" }
        let wantsFullBody = f.groups.contains("Cuerpo completo")
        func facet(_ values: [String], _ selected: [String]) -> Bool { selected.isEmpty || selected.contains { values.contains($0) } }
        return items.compactMap { e -> (LibraryExercise, Int)? in
            let groupOk = f.groups.isEmpty || (!groups.isEmpty && facet(e.groups, groups)) || (wantsFullBody && isFullBody(e))
            guard groupOk, facet(e.equipment, f.equipment), facet(e.modalities, f.modalities) else { return nil }
            let score = matchScore(e, f.query)
            return score > 0 ? (e, score) : nil
        }
        .sorted { $0.1 != $1.1 ? $0.1 > $1.1 : $0.0.name.compare($1.0.name, locale: Locale(identifier: "es")) == .orderedAscending }
        .map(\.0)
    }

    /// Parecidos: mismo grupo principal, mismo patrón y equipo compartido.
    static func similar(_ target: LibraryExercise, _ items: [LibraryExercise], limit: Int = 6) -> [LibraryExercise] {
        let main = target.groups.first
        let scored: [(LibraryExercise, Int)] = items.filter { $0.id != target.id }.map { e -> (LibraryExercise, Int) in
            let group: Int = (main != nil && e.groups.first == main) ? 3 : (e.groups.contains { target.groups.contains($0) } ? 1 : 0)
            let pattern: Int = (target.pattern != nil && e.pattern == target.pattern) ? 2 : 0
            let equip: Int = e.equipment.contains { target.equipment.contains($0) } ? 1 : 0
            return (e, group + pattern + equip)
        }
        return scored.filter { $0.1 >= 3 }
        .sorted { $0.1 != $1.1 ? $0.1 > $1.1 : $0.0.name.compare($1.0.name, locale: Locale(identifier: "es")) == .orderedAscending }
        .prefix(limit).map(\.0)
    }
}

struct LibraryExercise: Identifiable, Hashable {
    let id: String
    let name: String
    let altNames: [String]
    let groups: [String]
    let primaryMuscles: [String]
    let secondaryMuscles: [String]
    let equipment: [String]
    let modalities: [String]
    let pattern: String?
    let stimulus: String?
    let load: String?
    let level: Int?
    let image: String?
    let video: String?
    let description: String?
    let instructions: [String]
    let mistakes: [String]
    let tips: [String]
    let safety: [String]
    let source: String
    let license: String?
    let licenseAuthor: String?
    let sourceUrl: String?

    var subtitle: String { [primaryMuscles.first ?? groups.first, equipment.first].compactMap { $0 }.joined(separator: " · ") }
    /// Atribución obligatoria para fichas de terceros (CC BY-SA).
    var attribution: String? {
        // Solo las licencias que exigen citar al autor en la ficha (CC BY / BY-SA); lo demás se ve como de Autopilot.
        guard source != "autopilot", (license ?? "").uppercased().hasPrefix("CC BY") else { return nil }
        return ["Fuente: \(source == "wger" ? "wger.de" : source)", licenseAuthor, license].compactMap { $0 }.joined(separator: " · ")
    }
}

struct LibraryFilters: Equatable {
    var query = ""
    var groups: [String] = []
    var equipment: [String] = []
    var modalities: [String] = []
    var activeCount: Int { groups.count + equipment.count + modalities.count }
}

@MainActor
final class ExerciseLibraryModel: ObservableObject {
    @Published var items: [LibraryExercise]?
    @Published var failed = false
    @Published var favorites: Set<String> = [] { didSet { rememberPersonal() } }
    @Published var recent: [String] = [] { didSet { rememberPersonal() } }
    @Published var personal = false

    private static var cache: [LibraryExercise]?
    /// Favoritos y recientes de la última cuenta. La pestaña crea el modelo en cada visita: sin
    /// esto «Recientes» llegaba un segundo después y empujaba hacia abajo las tarjetas de grupos.
    private static var personalCache: (user: String, favorites: Set<String>, recent: [String])?
    private var cacheUser: String?

    /// Arranca con lo último descargado (lista, favoritos y recientes): el primer fotograma ya es
    /// el definitivo y la red solo lo actualiza.
    init(userId: UUID? = nil) {
        items = Self.cache
        let uid = userId?.uuidString.lowercased()
        if let uid, let mine = Self.personalCache, mine.user == uid {
            favorites = mine.favorites
            recent = mine.recent
            personal = true
        }
        cacheUser = uid
    }

    private func rememberPersonal() {
        guard personal, let cacheUser else { return }
        Self.personalCache = (cacheUser, favorites, recent)
    }
    private static let base = "id, name, muscle_group, exercise_type, movement_pattern, stimulus_type, load_level, level, image_url, video_url"
    private static let full = base + ", slug, alt_names, description, instructions, common_mistakes, tips, safety_notes, source, license, license_author, source_url, "
        + "exercise_muscles(role, muscles(name, filter_group, sort)), exercise_equipment(equipment(name, sort)), "
        + "exercise_categories(exercise_categories_catalog(name))"

    private struct Row: Decodable {
        struct Muscle: Decodable { let name: String; let filter_group: String?; let sort: Int? }
        struct MuscleLink: Decodable { let role: String; let muscles: Muscle? }
        struct Named: Decodable { let name: String; let sort: Int? }
        struct EquipmentLink: Decodable { let equipment: Named? }
        struct CategoryLink: Decodable { let exercise_categories_catalog: Named? }
        let id: String; let name: String
        let muscle_group: String?; let exercise_type: String?; let movement_pattern: String?; let level: Int?
        let stimulus_type: String?; let load_level: String?
        let image_url: String?; let video_url: String?
        let alt_names: [String]?; let description: String?; let instructions: [String]?
        let common_mistakes: [String]?; let tips: [String]?; let safety_notes: [String]?
        let source: String?; let license: String?; let license_author: String?; let source_url: String?
        let exercise_muscles: [MuscleLink]?; let exercise_equipment: [EquipmentLink]?; let exercise_categories: [CategoryLink]?

        func toExercise() -> LibraryExercise {
            func uniq(_ v: [String?]) -> [String] { var seen = Set<String>(); return v.compactMap { $0 }.filter { seen.insert($0).inserted } }
            let links = (exercise_muscles ?? []).filter { $0.muscles != nil }.sorted {
                $0.role == $1.role ? ($0.muscles?.sort ?? 0) < ($1.muscles?.sort ?? 0) : $0.role == "primary"
            }
            let primary = links.filter { $0.role == "primary" }
            let linkedGroups = uniq(primary.map { $0.muscles?.filter_group })
            let modalities = uniq((exercise_categories ?? []).map { $0.exercise_categories_catalog?.name })
            return LibraryExercise(
                id: id, name: name, altNames: alt_names ?? [],
                groups: linkedGroups.isEmpty ? ExerciseLibraryCatalog.legacyGroups[muscle_group ?? ""] ?? [] : linkedGroups,
                primaryMuscles: uniq(primary.map { $0.muscles?.name }),
                secondaryMuscles: uniq(links.filter { $0.role != "primary" }.map { $0.muscles?.name }),
                equipment: uniq((exercise_equipment ?? []).sorted { ($0.equipment?.sort ?? 0) < ($1.equipment?.sort ?? 0) }.map { $0.equipment?.name }),
                modalities: modalities.isEmpty ? ExerciseLibraryCatalog.legacyModalities[exercise_type ?? ""] ?? [] : modalities,
                pattern: movement_pattern, stimulus: stimulus_type, load: load_level, level: level, image: image_url, video: video_url,
                description: description, instructions: instructions ?? [], mistakes: common_mistakes ?? [],
                tips: tips ?? [], safety: safety_notes ?? [], source: source ?? "autopilot",
                license: license, licenseAuthor: license_author, sourceUrl: source_url)
        }
    }

    private struct ExerciseRef: Decodable { let exercise_id: String }

    /// Toda la biblioteca publicada, por páginas de 1.000 (el límite de PostgREST).
    private func fetchAll(_ select: String, published: Bool) async throws -> [Row] {
        var rows: [Row] = []
        var from = 0
        while true {
            let page: [Row]
            if published {
                page = try await Backend.client.from("exercises").select(select).eq("status", value: "published")
                    .order("name").range(from: from, to: from + 999).execute().value
            } else {
                page = try await Backend.client.from("exercises").select(select)
                    .order("name").range(from: from, to: from + 999).execute().value
            }
            rows += page
            if page.count < 1000 { return rows }
            from += 1000
        }
    }

    func load(userId: UUID?) async {
        // Lista, favoritos y recientes se piden juntos y se publican a la vez: así «Recientes» no
        // aparece después encima de las tarjetas. Lo ya descargado se ve mientras tanto.
        var list: [LibraryExercise]?
        do {
            let rows: [Row]
            do { rows = try await fetchAll(Self.full, published: true) }
            // Sin la migración de la biblioteca: mismos ejercicios, filtros por su grupo de siempre.
            catch { rows = try await fetchAll(Self.base, published: false) }
            list = rows.map { $0.toExercise() }
        } catch {
            list = nil
        }
        var mine: (favorites: Set<String>, recent: [String])?
        if let userId {
            let uid = userId.uuidString.lowercased()
            do {
                let fav: [ExerciseRef] = try await Backend.client.from("exercise_favorites").select("exercise_id")
                    .eq("user_id", value: uid).execute().value
                let rec: [ExerciseRef] = try await Backend.client.from("exercise_recent").select("exercise_id")
                    .eq("user_id", value: uid).order("viewed_at", ascending: false).limit(12).execute().value
                mine = (Set(fav.map(\.exercise_id)), rec.map(\.exercise_id))
            } catch {
                mine = nil
            }
        }
        if let list {
            Self.cache = list
            items = list
            failed = false
        } else {
            failed = items == nil
        }
        guard let userId else { return }
        cacheUser = userId.uuidString.lowercased()
        if let mine {
            personal = true
            favorites = mine.favorites
            recent = mine.recent
        } else if Self.personalCache?.user != cacheUser {
            personal = false
        }
    }

    func retry(userId: UUID?) async { Self.cache = nil; items = nil; failed = false; await load(userId: userId) }

    func toggleFavorite(_ id: String, userId: UUID?) async {
        guard let userId else { return }
        let uid = userId.uuidString.lowercased()
        let wasOn = favorites.contains(id)
        if wasOn { favorites.remove(id) } else { favorites.insert(id) }
        do {
            if wasOn {
                try await Backend.client.from("exercise_favorites").delete().eq("user_id", value: uid).eq("exercise_id", value: id).execute()
            } else {
                try await Backend.client.from("exercise_favorites").insert(["user_id": uid, "exercise_id": id]).execute()
            }
        } catch {
            if wasOn { favorites.insert(id) } else { favorites.remove(id) }
        }
    }

    func markViewed(_ id: String, userId: UUID?) {
        recent = Array(([id] + recent.filter { $0 != id }).prefix(12))
        guard personal, let userId else { return }
        let row = ["user_id": userId.uuidString.lowercased(), "exercise_id": id, "viewed_at": ISO8601DateFormatter().string(from: Date())]
        Task { try? await Backend.client.from("exercise_recent").upsert(row, onConflict: "user_id,exercise_id").execute() }
    }

    func variants(of id: String) async -> [String] {
        struct R: Decodable { let related_id: String }
        let rows: [R] = (try? await Backend.client.from("exercise_relations").select("related_id")
            .eq("exercise_id", value: id).eq("kind", value: "variant").execute().value) ?? []
        return rows.map(\.related_id)
    }
}

/// Lista con buscador, filtros, recientes, favoritos y grupos musculares.
struct ExerciseLibraryView: View {
    let userId: UUID?
    /// Pestaña «Ejercicios» de la barra: sin «Cerrar» y empujando la ficha en la pila de la app.
    var embedded = false
    @StateObject private var model: ExerciseLibraryModel
    @State private var filters = LibraryFilters()
    @State private var facet: String?
    @State private var path: [LibraryExercise] = []
    /// Ficha abierta en modo pestaña (la pila es la de la app, no la propia).
    @State private var pushed: LibraryExercise?
    @Environment(\.dismiss) private var dismiss
    #if !os(macOS)
    @Environment(\.horizontalSizeClass) private var sizeClass
    #endif

    /// Columnas de las tarjetas de grupo: 2 en el iPhone y 3 en iPad y Mac, como
    /// `grid-cols-2 sm:grid-cols-3` en la web (antes el Mac ponía 4 en la columna de 680).
    private var groupColumns: [GridItem] {
        #if os(macOS)
        let count = 3
        #else
        let count = sizeClass == .regular ? 3 : 2
        #endif
        return Array(repeating: GridItem(.flexible(), spacing: 12), count: count)
    }

    init(userId: UUID?, embedded: Bool = false) {
        self.userId = userId
        self.embedded = embedded
        _model = StateObject(wrappedValue: ExerciseLibraryModel(userId: userId))
    }

    private var items: [LibraryExercise] { model.items ?? [] }
    private var browsing: Bool { filters.query.trimmingCharacters(in: .whitespaces).isEmpty && filters.activeCount == 0 }
    private let facets: [(key: String, label: String, options: [String])] = [
        ("groups", "Grupo", ExerciseLibraryCatalog.groups),
        ("equipment", "Equipo", ExerciseLibraryCatalog.equipment),
        ("modalities", "Modalidad", ExerciseLibraryCatalog.modalities),
    ]

    var body: some View {
        Group {
            if embedded {
                list.navigationDestination(item: $pushed) { e in
                    LibraryDetailHost(exercise: e, model: model, userId: userId)
                }
            } else {
                sheet
            }
        }
        .task { await model.load(userId: userId) }
    }

    private var list: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                #if os(iOS)
                // Subtítulo bajo el título grande, como la web móvil (en Mac la barra lleva su pista).
                if embedded {
                    Text("Técnica, músculos y variantes de cada ejercicio.")
                        .font(.apSubhead).foregroundStyle(Palette.muted)
                        .fixedSize(horizontal: false, vertical: true)
                        .padding(.bottom, 4)
                }
                #endif
                searchField
                facetRow
                if let facet, let options = facets.first(where: { $0.key == facet })?.options {
                    FlowRow { ForEach(options, id: \.self) { chip($0, facet: facet) } }
                        .transition(.opacity)
                }
                content.padding(.top, 4)
            }
            .padding(.horizontal, embedded ? 16 : 20).padding(.bottom, 24)
            // Una columna de 680 en iPad y Mac, como Hoy y Nutrición.
            .frame(maxWidth: 680)
            .frame(maxWidth: .infinity)
        }
        .screenBackground()
    }

    private var sheet: some View {
        NavigationStack(path: $path) {
            list
            .navigationTitle("Ejercicios")
            #if os(iOS)
            .navigationBarTitleDisplayMode(.large)
            #endif
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cerrar") { dismiss() }.foregroundStyle(Palette.gold)
                }
            }
            .navigationDestination(for: LibraryExercise.self) { e in
                ExerciseDetailView(exercise: e, model: model, userId: userId) { path.append($0) }
            }
        }
    }

    private var searchField: some View {
        SearchPill(prompt: "Buscar ejercicio", text: $filters.query)
    }

    private func selected(_ key: String) -> [String] {
        switch key { case "groups": filters.groups; case "equipment": filters.equipment; default: filters.modalities }
    }

    private func toggle(_ value: String, facet key: String) {
        func flip(_ list: inout [String]) { if let i = list.firstIndex(of: value) { list.remove(at: i) } else { list.append(value) } }
        switch key { case "groups": flip(&filters.groups); case "equipment": flip(&filters.equipment); default: flip(&filters.modalities) }
    }

    private var facetRow: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(facets, id: \.key) { f in
                    let count = selected(f.key).count
                    Button {
                        Haptics.selection()
                        withAnimation(.easeOut(duration: 0.2)) { facet = facet == f.key ? nil : f.key }
                    } label: {
                        Text(count > 0 ? "\(f.label) · \(count)" : f.label)
                            .font(.apFootnote.weight(.semibold).monospacedDigit())
                            .foregroundStyle(count > 0 ? Palette.gold : Palette.foreground)
                            .padding(.horizontal, 16).frame(height: 40)
                            .background(count > 0 ? Palette.gold.opacity(0.15) : Palette.secondary, in: Capsule())
                    }
                    .buttonStyle(.plain)
                    // «Grupo · 2» se lee «Grupo: 2 filtros», como `facetLabel` en la web.
                    .accessibilityLabel(count > 0 ? "\(f.label): \(count) \(count == 1 ? "filtro" : "filtros")" : f.label)
                    .accessibilityAddTraits(facet == f.key ? .isSelected : [])
                }
                if filters.activeCount > 0 {
                    Button("Quitar filtros") { clearFilters() }
                        .font(.apFootnote.weight(.semibold)).foregroundStyle(Palette.muted).buttonStyle(.plain)
                        .padding(.horizontal, 12).frame(height: 40)
                }
            }
        }
    }

    private func chip(_ value: String, facet key: String) -> some View {
        let on = selected(key).contains(value)
        return Button { Haptics.selection(); toggle(value, facet: key) } label: {
            Text(value).font(.apSubhead.weight(.medium))
                .foregroundStyle(on ? Palette.gold : Palette.foreground)
                .padding(.horizontal, 16).frame(height: 40)
                .background(on ? Palette.gold.opacity(0.15) : Palette.card, in: Capsule())
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(on ? .isSelected : [])
    }

    private func clearFilters() { filters = LibraryFilters(query: filters.query) }

    @ViewBuilder private var content: some View {
        if model.failed {
            VStack(spacing: 0) {
                EmptyStateView(symbol: "wifi.exclamationmark", title: "No hemos podido cargar los ejercicios",
                               message: "Revisa tu conexión y vuelve a intentarlo.")
                Button("Reintentar") { Task { await model.retry(userId: userId) } }
                    .buttonStyle(.pillSecondary).fixedSize()
            }
            .frame(maxWidth: .infinity).padding(.bottom, 24)
        } else if model.items == nil {
            // Carga con la firma de marca (el AP latiendo), nunca bloques grises.
            BrandLoader(size: 28).accessibilityLabel("Cargando ejercicios")
                .frame(maxWidth: .infinity).padding(.vertical, 64)
        } else if browsing {
            browse
        } else {
            let results = ExerciseLibraryCatalog.filter(items, filters)
            if results.isEmpty {
                VStack(spacing: 0) {
                    EmptyStateView(symbol: "magnifyingglass", title: "Prueba con otro nombre",
                                   message: "Busca por ejercicio o músculo, o quita algún filtro.")
                    if filters.activeCount > 0 {
                        Button("Quitar filtros") { clearFilters() }.buttonStyle(.pillSecondary).fixedSize()
                    }
                }
                .frame(maxWidth: .infinity).padding(.bottom, 24)
            } else {
                Text(ExerciseLibraryCatalog.count(results.count)).font(.apFootnote.monospacedDigit()).foregroundStyle(Palette.muted)
                    .padding(.horizontal, 4)
                ExerciseRows(items: results, favorites: model.favorites) { open($0) }
            }
        }
    }

    private func open(_ e: LibraryExercise) {
        Haptics.tap()
        model.markViewed(e.id, userId: userId)
        if embedded { pushed = e } else { path.append(e) }
    }

    private var browse: some View {
        let byId = Dictionary(uniqueKeysWithValues: items.map { ($0.id, $0) })
        let recent = model.recent.compactMap { byId[$0] }
        let favorites = items.filter { model.favorites.contains($0.id) }
        let tiles = ExerciseLibraryCatalog.groups.compactMap { g -> (String, Int, String?)? in
            var f = LibraryFilters(); f.groups = [g]
            let members = ExerciseLibraryCatalog.filter(items, f)
            return members.isEmpty ? nil : (g, members.count, members.first { $0.image != nil }?.image)
        }
        return VStack(alignment: .leading, spacing: 32) {
            if !recent.isEmpty {
                VStack(alignment: .leading, spacing: 10) {
                    LibrarySectionTitle("Recientes")
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(alignment: .top, spacing: 12) {
                            ForEach(recent) { e in
                                Button { open(e) } label: {
                                    VStack(alignment: .leading, spacing: 6) {
                                        ExerciseThumbView(url: e.image, name: e.name, pattern: e.pattern, stimulus: e.stimulus, load: e.load,
                                                          muscleGroup: e.groups.first, video: e.video, width: 112, height: 63)
                                        Text(e.name).font(.apFootnote.weight(.medium)).lineLimit(2).multilineTextAlignment(.leading)
                                            .fixedSize(horizontal: false, vertical: true)
                                    }
                                    .frame(width: 112, alignment: .leading)
                                }
                                .buttonStyle(.plain)
                                .accessibilityLabel(e.name)
                            }
                        }
                    }
                }
            }
            if !favorites.isEmpty {
                VStack(alignment: .leading, spacing: 10) {
                    LibrarySectionTitle("Favoritos")
                    ExerciseRows(items: favorites, favorites: []) { open($0) }
                }
            }
            VStack(alignment: .leading, spacing: 10) {
                LibrarySectionTitle("Grupos musculares")
                LazyVGrid(columns: groupColumns, spacing: 12) {
                    ForEach(tiles, id: \.0) { tile in
                        Button { Haptics.selection(); filters.groups = [tile.0] } label: { groupTile(tile.0, count: tile.1, image: tile.2) }
                            .buttonStyle(PressableCardStyle())
                    }
                }
            }
        }
    }

    /// Tarjeta de grupo muscular: la foto real de uno de sus ejercicios con su degradado o, si el
    /// grupo aún no tiene ninguna, su huella dorada en el centro (como `GroupTile` en la web).
    private func groupTile(_ name: String, count: Int, image: String?) -> some View {
        let photo = image.flatMap(URL.init(string:))
        let glyph = ExerciseMotionGlyph(spec: ExerciseLibraryCatalog.groupGlyph(name))
            .frame(width: 96, height: 54)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .padding(.bottom, 48)
        return ZStack(alignment: .bottomLeading) {
            Color.clear
            if let photo {
                CachedAsyncImage(url: photo, maxSide: 500) { $0.resizable().scaledToFill() } placeholder: { glyph }
                    .opacity(0.7)
                LinearGradient(colors: [.black.opacity(0.8), .black.opacity(0.2), .clear], startPoint: .bottom, endPoint: .top)
            } else {
                glyph
            }
            VStack(alignment: .leading, spacing: 2) {
                Text(name).font(.apHeadline).foregroundStyle(photo != nil ? Color.white : Palette.foreground).lineLimit(1)
                Text(ExerciseLibraryCatalog.count(count)).font(.apFootnote.monospacedDigit())
                    .foregroundStyle(photo != nil ? Color.white.opacity(0.75) : Palette.muted).lineLimit(1)
            }
            .padding(12)
        }
        .aspectRatio(4 / 3, contentMode: .fit)
        .clipShape(RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
        .surface()
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(name), \(ExerciseLibraryCatalog.count(count))")
        .accessibilityAddTraits(.isButton)
    }
}

/// Ficha dentro de la pila de la app (pestaña «Ejercicios»): cada variante abre otra encima.
private struct LibraryDetailHost: View {
    let exercise: LibraryExercise
    @ObservedObject var model: ExerciseLibraryModel
    let userId: UUID?
    @State private var next: LibraryExercise?

    var body: some View {
        ExerciseDetailView(exercise: exercise, model: model, userId: userId) { next = $0 }
            .navigationDestination(item: $next) { e in
                LibraryDetailHost(exercise: e, model: model, userId: userId)
            }
    }
}

private struct LibrarySectionTitle: View {
    let text: String
    init(_ text: String) { self.text = text }
    var body: some View {
        // Cabecera de sección como «Tu plan» o «Comidas de hoy»: Title 3, sin mayúsculas.
        Text(text).font(.apTitle3).accessibilityAddTraits(.isHeader)
    }
}

private struct ExerciseThumbView: View {
    let url: String?
    var name: String = ""
    var pattern: String? = nil
    var stimulus: String? = nil
    var load: String? = nil
    /// Grupo muscular: sin patrón en la ficha, deduce la huella (nunca un hueco vacío).
    var muscleGroup: String? = nil
    /// Clip de técnica: la miniatura se mueve en bucle sobre la foto (como `ExerciseThumb` en la web).
    var video: String? = nil
    var width: CGFloat = 48
    var height: CGFloat = 48
    var body: some View {
        ExerciseLoopView(url: LoopRules.url(video)) {
            // Igual que `ExerciseThumb` en la web: la foto del ejercicio manda y la huella queda
            // mientras carga, si falla o si no tiene foto (la de la ficha o la deducida).
            if let url, let u = URL(string: url) {
                CachedAsyncImage(url: u, maxSide: 200) { $0.resizable().scaledToFill() } placeholder: { fallback }
            } else {
                fallback
            }
        }
        .frame(width: width, height: height)
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        .accessibilityHidden(true)
    }

    private var fallback: some View {
        ZStack {
            Palette.secondary
            ExerciseMotionGlyph(spec: ExerciseMotion.specFor(name: name, pattern: pattern, stimulus: stimulus, load: load, muscleGroup: muscleGroup))
                .padding(6)
        }
    }
}

/// Filas en un grupo sin borde (como «Comidas de hoy»): miniatura, nombre, músculo y equipo, y chevron.
private struct ExerciseRows: View {
    let items: [LibraryExercise]
    let favorites: Set<String>
    let onOpen: (LibraryExercise) -> Void
    var body: some View {
        LazyVStack(spacing: 0) {
            ForEach(Array(items.enumerated()), id: \.element.id) { index, e in
                Button { onOpen(e) } label: {
                    HStack(spacing: 12) {
                        ExerciseThumbView(url: e.image, name: e.name, pattern: e.pattern, stimulus: e.stimulus, load: e.load, muscleGroup: e.groups.first, video: e.video)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(e.name).font(.apHeadline).lineLimit(1)
                            Text(e.subtitle).font(.apFootnote).foregroundStyle(Palette.muted).lineLimit(1)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        if favorites.contains(e.id) {
                            Image(systemName: "heart.fill").font(.footnote).foregroundStyle(Palette.gold).accessibilityLabel("Favorito")
                        }
                        Image(systemName: "chevron.right").font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(Palette.muted.opacity(0.6)).accessibilityHidden(true)
                    }
                    .padding(.horizontal, 12).padding(.vertical, 10).contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .overlay(alignment: .bottom) {
                    // El separador nace donde empieza el texto (12 + 48 + 12).
                    if index < items.count - 1 { Rectangle().fill(Palette.separator).frame(height: 0.5).padding(.leading, 72) }
                }
            }
        }
        .surface()
    }
}

/// Ficha: clip en bucle, foto o la huella del ejercicio; datos clave y secciones con contenido.
struct ExerciseDetailView: View {
    let exercise: LibraryExercise
    @ObservedObject var model: ExerciseLibraryModel
    let userId: UUID?
    let onOpen: (LibraryExercise) -> Void
    @State private var variantIds: [String] = []

    private var all: [LibraryExercise] { model.items ?? [] }
    private var variants: [LibraryExercise] { variantIds.compactMap { id in all.first { $0.id == id } } }
    private var alternatives: [LibraryExercise] {
        ExerciseLibraryCatalog.similar(exercise, all).filter { a in !variantIds.contains(a.id) }
    }
    private var chips: [String] {
        [exercise.primaryMuscles.first ?? exercise.groups.first, exercise.equipment.first,
         exercise.level.flatMap { ExerciseLibraryCatalog.levels[$0] }].compactMap { $0 }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                hero
                HStack(alignment: .top, spacing: 12) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(exercise.name).font(.apTitle1).tracking(-0.4)
                            .fixedSize(horizontal: false, vertical: true)
                            .accessibilityAddTraits(.isHeader)
                        if !exercise.altNames.isEmpty {
                            Text(exercise.altNames.joined(separator: " · ")).font(.apSubhead).foregroundStyle(Palette.muted)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    if model.personal {
                        let on = model.favorites.contains(exercise.id)
                        Button {
                            Haptics.selection()
                            Task { await model.toggleFavorite(exercise.id, userId: userId) }
                        } label: {
                            Image(systemName: on ? "heart.fill" : "heart").font(.title3)
                                .foregroundStyle(on ? Palette.gold : Palette.foreground)
                                .frame(width: 44, height: 44).background(Palette.secondary, in: Circle())
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel(on ? "Quitar de favoritos" : "Añadir a favoritos")
                    }
                }
                if !chips.isEmpty {
                    FlowRow {
                        ForEach(chips, id: \.self) { c in
                            Text(c).font(.apFootnote.weight(.medium)).padding(.horizontal, 12).padding(.vertical, 6)
                                .background(Palette.secondary, in: Capsule())
                        }
                    }
                }
                sections.padding(.top, 16)
            }
            .padding(.horizontal, 20).padding(.top, 4).padding(.bottom, 32)
            .frame(maxWidth: 680)
            .frame(maxWidth: .infinity)
        }
        .screenBackground()
        .navigationTitle(exercise.name)
        #if os(iOS)
        .navigationBarTitleDisplayMode(.inline)
        #endif
        .task(id: exercise.id) { variantIds = await model.variants(of: exercise.id) }
    }

    /// Héroe 16:9: el mismo que la técnica desde Entrenar (`ExerciseHeroMedia`).
    private var hero: some View {
        // Con patrón en la ficha hay «Ritmo»; sin él, la huella deducida solo hace de visual.
        let motion = ExerciseMotion.spec(name: exercise.name, pattern: exercise.pattern, stimulus: exercise.stimulus, load: exercise.load)
        return ExerciseHeroMedia(name: exercise.name, image: exercise.image, video: exercise.video, motion: motion,
                                 glyph: motion ?? ExerciseMotion.specFor(name: exercise.name, pattern: nil, stimulus: exercise.stimulus,
                                                                         load: exercise.load, muscleGroup: exercise.groups.first))
            .id(exercise.id)
    }

    /// Pasos con su número en un círculo dorado tenue; el resto, con un punto dorado (como la web).
    private func list(_ items: [String], numbered: Bool = false) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            ForEach(Array(items.enumerated()), id: \.offset) { i, t in
                HStack(alignment: .top, spacing: 12) {
                    if numbered {
                        Text("\(i + 1)").font(.apFootnote.weight(.bold).monospacedDigit()).foregroundStyle(Palette.gold)
                            .frame(width: 24, height: 24).background(Palette.gold.opacity(0.15), in: Circle())
                            .accessibilityHidden(true)
                    } else {
                        Circle().fill(Palette.gold).frame(width: 6, height: 6).padding(.top, 7).accessibilityHidden(true)
                    }
                    Text(t).font(.apSubhead).padding(.top, numbered ? 2 : 0)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
        }
        .padding(16).frame(maxWidth: .infinity, alignment: .leading)
        .surface()
    }

    @ViewBuilder private var sections: some View {
        let e = exercise
        VStack(alignment: .leading, spacing: 32) {
            if !e.instructions.isEmpty || e.description != nil {
                section("Cómo se hace") {
                    if !e.instructions.isEmpty { list(e.instructions, numbered: true) }
                    else if let d = e.description {
                        Text(d).font(.apSubhead).padding(16).frame(maxWidth: .infinity, alignment: .leading)
                            .surface()
                    }
                }
            }
            if !e.primaryMuscles.isEmpty || !e.groups.isEmpty {
                section("Músculos") {
                    // «Principal» y «Secundarios» como filas de dato (etiqueta pequeña y valor), como la web.
                    VStack(alignment: .leading, spacing: 0) {
                        muscleRow("Principal", (e.primaryMuscles.isEmpty ? e.groups : e.primaryMuscles).joined(separator: ", "))
                        if !e.secondaryMuscles.isEmpty {
                            Rectangle().fill(Palette.separator).frame(height: 0.5)
                            muscleRow("Secundarios", e.secondaryMuscles.joined(separator: ", "))
                        }
                    }
                    .padding(.horizontal, 16).frame(maxWidth: .infinity, alignment: .leading)
                    .surface()
                }
            }
            if !e.mistakes.isEmpty { section("Errores frecuentes") { list(e.mistakes) } }
            if !e.tips.isEmpty { section("Consejos") { list(e.tips) } }
            if !e.safety.isEmpty { section("Seguridad") { list(e.safety) } }
            if !variants.isEmpty { section("Variantes") { ExerciseRows(items: variants, favorites: model.favorites, onOpen: open) } }
            if !alternatives.isEmpty { section("Alternativas") { ExerciseRows(items: alternatives, favorites: model.favorites, onOpen: open) } }
            // Autor y licencia solo cuando la licencia lo exige (CC BY / BY-SA).
            if let credit = e.attribution {
                Group {
                    if let s = e.sourceUrl, let url = URL(string: s) {
                        Link(credit, destination: url)
                    } else {
                        Text(credit)
                    }
                }
                .font(.apFootnote).foregroundStyle(Palette.muted).padding(.horizontal, 4)
            }
        }
    }

    private func open(_ e: LibraryExercise) {
        Haptics.tap()
        model.markViewed(e.id, userId: userId)
        onOpen(e)
    }

    private func muscleRow(_ label: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label).font(.apFootnote).foregroundStyle(Palette.muted)
            Text(value).font(.apHeadline).fixedSize(horizontal: false, vertical: true)
        }
        .padding(.vertical, 12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .combine)
    }

    private func section<Content: View>(_ title: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            LibrarySectionTitle(title)
            content()
        }
    }
}

/// Héroe 16:9 de un ejercicio (ficha de la biblioteca y técnica desde Entrenar), igual que `ExerciseMedia`
/// en la web: el clip en bucle (mudo y sin controles) sobre su foto, la foto o la huella (la de la ficha o
/// la deducida), nunca un cuadro de «próximamente». Con foto y patrón pero aún sin clip, «Ritmo / Foto»;
/// con la foto fija (reducir movimiento, bajo consumo o datos reducidos), «Ver vídeo» / «Parar vídeo».
struct ExerciseHeroMedia: View {
    let name: String
    let image: String?
    let video: String?
    /// Huella con el patrón de la ficha: hay «Ritmo» que enseñar. `nil` si no lo tiene.
    let motion: ExerciseMotion.Spec?
    /// La huella siempre (la de la ficha o la deducida).
    let glyph: ExerciseMotion.Spec
    /// Con foto se abre en la foto; «Ritmo» muestra la huella.
    @State private var showRhythm = false
    /// «Ver vídeo» con la foto fija: el clip, porque se ha pedido.
    @State private var playVideo = false
    @ObservedObject private var policy = LoopPolicy.shared
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        let shape = RoundedRectangle(cornerRadius: Radius.hero, style: .continuous)
        let videoURL = LoopRules.url(video)
        let moving = videoURL != nil && policy.allows(reduceMotion: reduceMotion)
        ZStack(alignment: .bottomLeading) {
            Color.clear
            ExerciseLoopView(url: videoURL, hero: true, force: playVideo) { still(clip: videoURL != nil) }
            if videoURL != nil {
                BrandMark(size: 18).opacity(0.6)
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottomTrailing)
                    .padding(12)
                    .allowsHitTesting(false)
                    .accessibilityHidden(true)
            }
            if videoURL != nil, !moving {
                // Con la foto fija, el clip solo si se pide (y se para igual).
                Button {
                    Haptics.selection()
                    playVideo.toggle()
                } label: {
                    Label(playVideo ? "Parar vídeo" : "Ver vídeo", systemImage: playVideo ? "pause.fill" : "play.fill")
                        .font(.apFootnote.weight(.semibold))
                        .foregroundStyle(Palette.foreground)
                        .padding(.horizontal, 14)
                        .frame(minHeight: 44)
                        .background(.ultraThinMaterial, in: Capsule())
                }
                .buttonStyle(.plain)
                .padding(12)
                .accessibilityLabel(playVideo ? "Parar vídeo de técnica de \(name)" : "Ver vídeo de técnica de \(name)")
            }
            // Sin clip ni patrón propio: la foto con la huella dorada en una esquina (como el visor del entreno).
            if motion == nil, image != nil, videoURL == nil {
                ExerciseMotionBadge(spec: glyph).padding(12)
            }
            // Con foto y huella (y aún sin clip), se cambia entre las dos con una píldora discreta.
            if motion != nil, image != nil, videoURL == nil {
                HStack(spacing: 2) {
                    tab("Ritmo", on: showRhythm) { showRhythm = true }
                    tab("Foto", on: !showRhythm) { showRhythm = false }
                }
                .padding(2)
                .background(Palette.secondary, in: Capsule())
                .padding(12)
            }
        }
        .aspectRatio(16 / 9, contentMode: .fit)
        .clipShape(shape)
        .surface(Radius.hero)
        .accessibilityElement(children: .contain)
        .accessibilityLabel(name)
    }

    /// Lo que hay debajo del clip (o sin él): la foto como portada, la huella con «Ritmo» o sin foto.
    @ViewBuilder private func still(clip: Bool) -> some View {
        if clip, let image, let url = URL(string: image) {
            CachedAsyncImage(url: url) { $0.resizable().scaledToFill() } placeholder: { ExerciseMotionHero(spec: glyph).padding(12) }
        } else if image == nil || showRhythm {
            ExerciseMotionHero(spec: glyph).padding(12)
        } else if let image, let url = URL(string: image) {
            CachedAsyncImage(url: url) { $0.resizable().scaledToFill() } placeholder: { ExerciseMotionHero(spec: glyph).padding(12) }
        } else {
            ExerciseMotionHero(spec: glyph).padding(12)
        }
    }

    private func tab(_ title: String, on: Bool, show: @escaping () -> Void) -> some View {
        Button(action: show) {
            Text(title)
                .font(.apFootnote.weight(.semibold))
                .foregroundStyle(on ? Palette.gold : Palette.muted)
                .padding(.horizontal, 12)
                .frame(height: 28)
                .background(on ? Palette.gold.opacity(0.15) : Color.clear, in: Capsule())
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(on ? .isSelected : [])
    }
}
