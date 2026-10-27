import Foundation

/// Sobrecarga progresiva, igual que `src/shared/lib/workoutProgression.ts`.
struct ProgressionSuggestion: Equatable {
    enum Label: String { case up = "Subir", keep = "Mantener", repeatIt = "Repetir", addRep = "Añadir rep" }
    let label: Label
    let weight: String
    let reason: String

    var headline: String {
        let kg = Double(weight).map { "\(Progression.kgText($0)) kg" } ?? ""
        switch label {
        case .up: return "Hoy: \(kg)"
        case .addRep: return "Hoy: +1 rep por serie"
        case .keep: return kg.isEmpty ? "Hoy: mantén la carga" : "Hoy: mantén \(kg)"
        case .repeatIt: return kg.isEmpty ? "Hoy: repite el objetivo" : "Hoy: repite \(kg)"
        }
    }
    var canApply: Bool { label == .up || label == .addRep }
}

enum Progression {
    static func weight(_ raw: String) -> Double? {
        let t = raw.trimmingCharacters(in: .whitespaces).replacingOccurrences(of: ",", with: ".")
        guard let v = Double(t), v > 0 else { return nil }
        return v
    }

    private static func increment(_ w: Double) -> Double { w >= 40 ? 2.5 : 1.25 }
    private static func kg(_ w: Double) -> String { kgText(w) }
    /// Hasta dos decimales y sin ceros de más: 42,5 · 41,25 · 40.
    static func kgText(_ w: Double) -> String { w.formatted(.number.precision(.fractionLength(0...2)).locale(Locale(identifier: "es_ES"))) }
    private static func plain(_ w: Double) -> String { w.truncatingRemainder(dividingBy: 1) == 0 ? String(Int(w)) : String(w) }

    /// «Última vez: 8 · 8 · 7 reps con 60 kg».
    static func summarize(_ previous: [SetLog]?) -> String? {
        let done = (previous ?? []).filter { $0.done && $0.reps > 0 && $0.isWarmup != true }
        guard !done.isEmpty else { return nil }
        let reps = done.map { String($0.reps) }.joined(separator: " · ")
        let loaded = done.compactMap { weight($0.weight) }
        if loaded.isEmpty { return "Última vez: \(reps) reps" }
        if loaded.count == done.count, Set(loaded).count == 1 { return "Última vez: \(reps) reps con \(kg(loaded[0])) kg" }
        return "Última vez: \(reps) reps con \(kg(loaded.min() ?? 0))–\(kg(loaded.max() ?? 0)) kg"
    }

    static func suggestion(_ ex: GymExercise, previous: [SetLog]?, previousRpe: Int?) -> ProgressionSuggestion? {
        let completed = (previous ?? []).filter { $0.done && $0.reps > 0 && $0.isWarmup != true }
        guard !completed.isEmpty else { return nil }
        let prescribed = Array(completed.prefix(ex.series))
        let loaded = prescribed.compactMap { weight($0.weight) }
        let last = loaded.last
        let target = ex.repsTarget
        let reached = prescribed.count == ex.series && prescribed.allSatisfy { $0.reps >= target }
        let lastStr = last.map(plain) ?? ""
        if prescribed.count != ex.series {
            return .init(label: .repeatIt, weight: lastStr, reason: "Registra las \(ex.series) series previstas antes de aumentar la dificultad.")
        }
        if loaded.isEmpty {
            if !reached { return .init(label: .repeatIt, weight: "", reason: "Mantén el ejercicio y alcanza \(target) reps en cada una de las \(ex.series) series antes de progresar.") }
            if let r = previousRpe, r >= 9 { return .init(label: .keep, weight: "", reason: "La sesión anterior fue muy exigente. Mantén el objetivo de repeticiones y prioriza la recuperación.") }
            return .init(label: .addRep, weight: "", reason: "Completaste todas las series sin carga externa. Si mantienes buena técnica, prueba una repetición más por serie.")
        }
        guard let lastW = last else { return nil }
        if loaded.count != prescribed.count || Set(loaded).count != 1 {
            return .init(label: .keep, weight: lastStr, reason: "Las cargas entre series fueron distintas. Mantén el plan y registra cargas consistentes antes de aumentarlas.")
        }
        if !reached { return .init(label: .repeatIt, weight: lastStr, reason: "Mantén \(kg(lastW)) kg hasta completar \(target) reps en todas las series.") }
        if let r = previousRpe, r >= 9 { return .init(label: .keep, weight: lastStr, reason: "La sesión anterior fue muy exigente. Repite la carga y prioriza la recuperación antes de subir.") }
        let next = ((lastW + increment(lastW)) * 100).rounded() / 100
        return .init(label: .up, weight: plain(next), reason: "Completaste \(target) reps en todas las series: prueba \(kg(next)) kg.")
    }
}
