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
        guard source != "autopilot" else { return nil }
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
    @Published var favorites: Set<String> = []
    @Published var recent: [String] = []
    @Published var personal = false

    private static var cache: [LibraryExercise]?
    private static let base = "id, name, muscle_group, exercise_type, movement_pattern, level, image_url, video_url"
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
                pattern: movement_pattern, level: level, image: image_url, video: video_url,
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
        if items == nil, let cached = Self.cache { items = cached }
        if Self.cache == nil {
            do {
                let rows: [Row]
                do { rows = try await fetchAll(Self.full, published: true) }
                // Sin la migración de la biblioteca: mismos ejercicios, filtros por su grupo de siempre.
                catch { rows = try await fetchAll(Self.base, published: false) }
                let list = rows.map { $0.toExercise() }
                Self.cache = list
                items = list
                failed = false
            } catch {
                failed = items == nil
            }
        }
        guard let userId else { return }
        let uid = userId.uuidString.lowercased()
        do {
            let fav: [ExerciseRef] = try await Backend.client.from("exercise_favorites").select("exercise_id")
                .eq("user_id", value: uid).execute().value
            let rec: [ExerciseRef] = try await Backend.client.from("exercise_recent").select("exercise_id")
                .eq("user_id", value: uid).order("viewed_at", ascending: false).limit(12).execute().value
            favorites = Set(fav.map(\.exercise_id))
            recent = rec.map(\.exercise_id)
            personal = true
        } catch {
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
    @StateObject private var model = ExerciseLibraryModel()
    @State private var filters = LibraryFilters()
    @State private var facet: String?
    @State private var path: [LibraryExercise] = []
    @Environment(\.dismiss) private var dismiss

    private var items: [LibraryExercise] { model.items ?? [] }
    private var browsing: Bool { filters.query.trimmingCharacters(in: .whitespaces).isEmpty && filters.activeCount == 0 }
    private let facets: [(key: String, label: String, options: [String])] = [
        ("groups", "Grupo", ExerciseLibraryCatalog.groups),
        ("equipment", "Equipo", ExerciseLibraryCatalog.equipment),
        ("modalities", "Modalidad", ExerciseLibraryCatalog.modalities),
    ]

    var body: some View {
        NavigationStack(path: $path) {
            ScrollView {
                VStack(alignment: .leading, spacing: 12) {
                    searchField
                    facetRow
                    if let facet, let options = facets.first(where: { $0.key == facet })?.options {
                        FlowRow { ForEach(options, id: \.self) { chip($0, facet: facet) } }
                            .transition(.opacity)
                    }
                    content.padding(.top, 4)
                }
                .padding(.horizontal, 20).padding(.bottom, 24)
            }
            .screenBackground()
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
        .task { await model.load(userId: userId) }
    }

    private var searchField: some View {
        HStack(spacing: 8) {
            Image("lu-search").resizable().frame(width: 16, height: 16).foregroundStyle(Palette.muted)
            TextField("Buscar ejercicio", text: $filters.query)
                .font(.apBody).textFieldStyle(.plain).autocorrectionDisabled()
                .accessibilityLabel("Buscar ejercicio")
            if !filters.query.isEmpty {
                Button { filters.query = "" } label: { Image("lu-x").resizable().frame(width: 16, height: 16).foregroundStyle(Palette.muted) }
                    .buttonStyle(.plain).accessibilityLabel("Borrar búsqueda")
            }
        }
        .padding(.horizontal, 16).frame(height: 44)
        .background(Palette.card, in: Capsule())
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
                            .font(.apFootnote.weight(.semibold))
                            .foregroundStyle(count > 0 ? Palette.gold : Palette.foreground)
                            .padding(.horizontal, 16).frame(height: 36)
                            .background(count > 0 ? Palette.gold.opacity(0.15) : Palette.secondary, in: Capsule())
                    }
                    .buttonStyle(.plain)
                }
                if filters.activeCount > 0 {
                    Button("Quitar filtros") { filters = LibraryFilters(query: filters.query) }
                        .font(.apFootnote.weight(.semibold)).foregroundStyle(Palette.muted).buttonStyle(.plain)
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

    @ViewBuilder private var content: some View {
        if model.failed {
            VStack(spacing: 12) {
                Text("No se pudo cargar la biblioteca.").font(.apSubhead).foregroundStyle(Palette.muted)
                Button("Reintentar") { Task { await model.retry(userId: userId) } }.buttonStyle(.pillSecondary)
            }
            .frame(maxWidth: .infinity).padding(.vertical, 40)
        } else if model.items == nil {
            VStack(spacing: 12) {
                ForEach(0..<6, id: \.self) { _ in RoundedRectangle(cornerRadius: 16).fill(Palette.card).frame(height: 56) }
            }
        } else if browsing {
            browse
        } else {
            let results = ExerciseLibraryCatalog.filter(items, filters)
            if results.isEmpty {
                Text("Ningún ejercicio coincide. Prueba con otro nombre o quita algún filtro.")
                    .font(.apSubhead).foregroundStyle(Palette.muted).multilineTextAlignment(.center)
                    .frame(maxWidth: .infinity).padding(.vertical, 40)
            } else {
                Text("\(results.count) \(results.count == 1 ? "ejercicio" : "ejercicios")").font(.apFootnote).foregroundStyle(Palette.muted)
                ExerciseRows(items: results, favorites: model.favorites) { open($0) }
            }
        }
    }

    private func open(_ e: LibraryExercise) {
        Haptics.tap()
        model.markViewed(e.id, userId: userId)
        path.append(e)
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
        return VStack(alignment: .leading, spacing: 24) {
            if !recent.isEmpty {
                LibrarySectionTitle("Recientes")
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(alignment: .top, spacing: 12) {
                        ForEach(recent) { e in
                            Button { open(e) } label: {
                                VStack(alignment: .leading, spacing: 6) {
                                    ExerciseThumbView(url: e.image, width: 112, height: 63)
                                    Text(e.name).font(.apFootnote.weight(.medium)).lineLimit(2).multilineTextAlignment(.leading)
                                }
                                .frame(width: 112, alignment: .leading)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
            }
            if !favorites.isEmpty {
                LibrarySectionTitle("Favoritos")
                ExerciseRows(items: favorites, favorites: []) { open($0) }
            }
            LibrarySectionTitle("Grupos musculares")
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 150), spacing: 12)], spacing: 12) {
                ForEach(tiles, id: \.0) { tile in
                    Button { Haptics.selection(); filters.groups = [tile.0] } label: { groupTile(tile.0, count: tile.1, image: tile.2) }
                        .buttonStyle(PressableCardStyle())
                }
            }
        }
    }

    private func groupTile(_ name: String, count: Int, image: String?) -> some View {
        ZStack(alignment: .bottomLeading) {
            Palette.card
            if let image, let url = URL(string: image) {
                CachedAsyncImage(url: url, maxSide: 500) { $0.resizable().scaledToFill() } placeholder: { Palette.card }
                    .opacity(0.7)
            }
            LinearGradient(colors: [.black.opacity(0.8), .black.opacity(0.2), .clear], startPoint: .bottom, endPoint: .top)
            VStack(alignment: .leading, spacing: 2) {
                Text(name).font(.apHeadline).foregroundStyle(.white)
                Text("\(count) \(count == 1 ? "ejercicio" : "ejercicios")").font(.apFootnote).foregroundStyle(.white.opacity(0.7))
            }
            .padding(12)
        }
        .aspectRatio(4 / 3, contentMode: .fit)
        .clipShape(RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
    }
}

private struct LibrarySectionTitle: View {
    let text: String
    init(_ text: String) { self.text = text }
    var body: some View {
        Text(text.uppercased()).font(.apFootnote.weight(.semibold)).tracking(0.5).foregroundStyle(Palette.muted)
    }
}

private struct ExerciseThumbView: View {
    let url: String?
    var width: CGFloat = 48
    var height: CGFloat = 48
    var body: some View {
        Group {
            if let url, let u = URL(string: url) {
                CachedAsyncImage(url: u, maxSide: 200) { $0.resizable().scaledToFill() } placeholder: { Palette.secondary }
            } else {
                ZStack { Palette.secondary; Image("lu-dumbbell").resizable().frame(width: 18, height: 18).foregroundStyle(Palette.muted) }
            }
        }
        .frame(width: width, height: height)
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        .accessibilityHidden(true)
    }
}

private struct ExerciseRows: View {
    let items: [LibraryExercise]
    let favorites: Set<String>
    let onOpen: (LibraryExercise) -> Void
    var body: some View {
        LazyVStack(spacing: 0) {
            ForEach(Array(items.enumerated()), id: \.element.id) { index, e in
                Button { onOpen(e) } label: {
                    HStack(spacing: 12) {
                        ExerciseThumbView(url: e.image)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(e.name).font(.apBody.weight(.medium)).lineLimit(1)
                            Text(e.subtitle).font(.apFootnote).foregroundStyle(Palette.muted).lineLimit(1)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        if favorites.contains(e.id) {
                            Image(systemName: "heart.fill").font(.footnote).foregroundStyle(Palette.gold).accessibilityLabel("Favorito")
                        }
                    }
                    .padding(.vertical, 10).contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                if index < items.count - 1 { Divider().overlay(Palette.separator) }
            }
        }
    }
}

/// Ficha: clip en bucle (o foto, o placeholder), datos clave y secciones con contenido.
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
                        Text(exercise.name).font(.apTitle2)
                        if !exercise.altNames.isEmpty {
                            Text(exercise.altNames.joined(separator: " · ")).font(.apSubhead).foregroundStyle(Palette.muted)
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
                                .frame(width: 40, height: 40).background(Palette.secondary, in: Circle())
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
                sections.padding(.top, 8)
            }
            .padding(.horizontal, 20).padding(.bottom, 32)
        }
        .screenBackground()
        .navigationTitle(exercise.name)
        #if os(iOS)
        .navigationBarTitleDisplayMode(.inline)
        #endif
        .task(id: exercise.id) { variantIds = await model.variants(of: exercise.id) }
    }

    @ViewBuilder private var hero: some View {
        let shape = RoundedRectangle(cornerRadius: Radius.hero, style: .continuous)
        ZStack {
            Palette.card
            if let image = exercise.image, let url = URL(string: image) {
                CachedAsyncImage(url: url) { $0.resizable().scaledToFill() } placeholder: { Palette.card }
            }
            if let video = exercise.video, let url = URL(string: video), ["mp4", "mov", "m4v"].contains(url.pathExtension.lowercased()) {
                LoopingVideo(url: url)
            } else if exercise.image == nil {
                VStack(spacing: 8) {
                    Image("lu-dumbbell").resizable().frame(width: 28, height: 28).foregroundStyle(Palette.muted)
                    Text("Demostración en preparación").font(.apFootnote).foregroundStyle(Palette.muted)
                }
            }
        }
        .aspectRatio(16 / 9, contentMode: .fit)
        .clipShape(shape)
        .accessibilityLabel(exercise.name)
    }

    private func list(_ items: [String], numbered: Bool = false) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            ForEach(Array(items.enumerated()), id: \.offset) { i, t in
                HStack(alignment: .firstTextBaseline, spacing: 12) {
                    Text(numbered ? "\(i + 1)" : "·").font(.apSubhead.weight(.semibold)).foregroundStyle(Palette.gold).frame(width: 18, alignment: .leading)
                    Text(t).font(.apSubhead).frame(maxWidth: .infinity, alignment: .leading)
                }
            }
        }
        .padding(16).frame(maxWidth: .infinity, alignment: .leading)
        .background(Palette.card, in: RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
    }

    @ViewBuilder private var sections: some View {
        let e = exercise
        VStack(alignment: .leading, spacing: 24) {
            if !e.instructions.isEmpty || e.description != nil {
                section("Cómo se hace") {
                    if !e.instructions.isEmpty { list(e.instructions, numbered: true) }
                    else if let d = e.description {
                        Text(d).font(.apSubhead).padding(16).frame(maxWidth: .infinity, alignment: .leading)
                            .background(Palette.card, in: RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
                    }
                }
            }
            if !e.primaryMuscles.isEmpty || !e.groups.isEmpty {
                section("Músculos") {
                    VStack(alignment: .leading, spacing: 4) {
                        (Text("Principal: ").foregroundStyle(Palette.muted) + Text((e.primaryMuscles.isEmpty ? e.groups : e.primaryMuscles).joined(separator: ", ")))
                        if !e.secondaryMuscles.isEmpty {
                            Text("Secundarios: ").foregroundStyle(Palette.muted) + Text(e.secondaryMuscles.joined(separator: ", "))
                        }
                    }
                    .font(.apSubhead).padding(16).frame(maxWidth: .infinity, alignment: .leading)
                    .background(Palette.card, in: RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
                }
            }
            if !e.mistakes.isEmpty { section("Errores frecuentes") { list(e.mistakes) } }
            if !e.tips.isEmpty { section("Consejos") { list(e.tips) } }
            if !e.safety.isEmpty { section("Seguridad") { list(e.safety) } }
            if !variants.isEmpty { section("Variantes") { ExerciseRows(items: variants, favorites: model.favorites, onOpen: open) } }
            if !alternatives.isEmpty { section("Alternativas") { ExerciseRows(items: alternatives, favorites: model.favorites, onOpen: open) } }
            if let credit = e.attribution {
                if let s = e.sourceUrl, let url = URL(string: s) {
                    Link(credit, destination: url).font(.apCaption).foregroundStyle(Palette.muted)
                } else {
                    Text(credit).font(.apCaption).foregroundStyle(Palette.muted)
                }
            }
        }
    }

    private func open(_ e: LibraryExercise) {
        Haptics.tap()
        model.markViewed(e.id, userId: userId)
        onOpen(e)
    }

    private func section<Content: View>(_ title: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            LibrarySectionTitle(title)
            content()
        }
    }
}
