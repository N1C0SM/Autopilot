import Foundation

/// Calculadora de discos: qué poner en cada lado de la barra para un peso total.
/// Es la misma cuenta que `src/shared/lib/plateMath.ts` de la web (y sus tests).
enum PlateMath {
    /// Discos habituales de un gimnasio, del más pesado al más ligero.
    static let plates: [Double] = [25, 20, 15, 10, 5, 2.5, 1.25]

    /// Barras habituales (kg).
    static let bars: [Double] = [20, 15, 10, 0]

    /// Reparto por lado para `target` kg con una barra de `bar` kg.
    /// - Returns: los discos de un lado y lo que no se puede montar con los discos dados.
    static func perSide(target: Double, bar: Double) -> (plates: [Double], missing: Double) {
        let total = max(0, target - bar)
        var side = total / 2
        var out: [Double] = []
        for plate in plates {
            while side + 0.001 >= plate {
                out.append(plate)
                side -= plate
            }
        }
        // Lo que sobra se redondea a 0,25 kg para no enseñar ruido de coma flotante.
        let missing = (side * 4).rounded() / 4
        return (out, missing > 0.001 ? missing : 0)
    }

    /// «20 + 10 + 1,25» con coma decimal, como el resto de la app.
    static func describe(_ plates: [Double]) -> String {
        plates.isEmpty ? "solo la barra" : plates.map(kg).joined(separator: " + ")
    }

    static func kg(_ value: Double) -> String {
        value.truncatingRemainder(dividingBy: 1) == 0 ? String(Int(value)) : String(value).replacingOccurrences(of: ".", with: ",")
    }
}
