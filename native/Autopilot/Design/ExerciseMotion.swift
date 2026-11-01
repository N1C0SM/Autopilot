import SwiftUI

/// La huella de movimiento de un ejercicio: la trayectoria de una repetición,
/// dibujada con los datos reales de la ficha (patrón, estímulo y carga). No es
/// una foto ni un vídeo: es la firma visual de Autopilot.
///
/// Espejo exacto de `src/shared/lib/exerciseMotion.ts` — mismos raíles, mismo
/// ritmo, mismo hash — así que el mismo ejercicio dibuja lo mismo en la web, en
/// la PWA, en el APK y aquí. Es pura y determinista.
enum ExerciseMotion {
    struct Point: Hashable {
        var x: Double
        var y: Double
    }

    /// Una repetición completa, lista para dibujar y animar.
    struct Spec: Hashable {
        /// Inicio, dos controles y final de la curva de una repetición.
        let points: [Point]
        /// Reposo: donde empieza y termina cada repetición.
        let start: Point
        /// Donde el músculo trabaja más: el final del recorrido.
        let end: Point
        /// Duración de un ciclo completo (subida + bajada + pausa), en segundos.
        let duration: Double
        /// Isométrico: el punto viaja una vez y aguanta.
        let hold: Bool
        /// Grosor de la línea, en unidades del lienzo.
        let stroke: Double
        /// Texto corto y honesto para leerlo en voz alta.
        let label: String
        /// Tiempos del bucle (0…1), espejo de `motionKeyTimes`.
        let cycleTimes: [Double]
        /// Dónde está el punto en cada tiempo del bucle.
        let cyclePos: [Double]
    }

    /// Lienzo común: 100 × 56 (16:9), con el suelo en y = 46.
    static let canvas = CGSize(width: 100, height: 56)

    /// Raíles: por donde va de verdad cada patrón.
    private static let rails: [String: [Point]] = [
        "Empuje": [Point(x: 16, y: 42), Point(x: 40, y: 38), Point(x: 62, y: 24), Point(x: 84, y: 12)],
        "Tirón": [Point(x: 84, y: 14), Point(x: 62, y: 18), Point(x: 38, y: 32), Point(x: 16, y: 40)],
        "Sentadilla": [Point(x: 50, y: 10), Point(x: 34, y: 26), Point(x: 34, y: 40), Point(x: 50, y: 44)],
        "Bisagra": [Point(x: 16, y: 14), Point(x: 38, y: 18), Point(x: 62, y: 30), Point(x: 84, y: 42)],
        "Core": [Point(x: 18, y: 42), Point(x: 38, y: 12), Point(x: 62, y: 12), Point(x: 82, y: 42)],
    ]

    private struct Tempo {
        let conc: Double
        let ecc: Double
        let pause: Double
    }

    /// Ritmo por estímulo: la subida es corta y viva, la bajada más lenta.
    private static let tempos: [String: Tempo] = [
        "Fuerza": Tempo(conc: 0.85, ecc: 2.3, pause: 1.5),
        "Hipertrofia": Tempo(conc: 0.8, ecc: 1.6, pause: 0.45),
        "Resistencia": Tempo(conc: 0.42, ecc: 0.75, pause: 0.15),
        "Isométrico": Tempo(conc: 1.1, ecc: 1.1, pause: 3.0),
    ]

    /// Carga: cuánto se abre la trayectoria y cuánto pesa la línea.
    private static let weights: [String: (amp: Double, stroke: Double)] = [
        "Alta": (1, 2.2),
        "Media": (0.82, 1.8),
        "Baja": (0.64, 1.5),
    ]

    /// FNV-1a sobre unidades UTF-16: el mismo hash que `charCodeAt` en la web.
    private static func hash(_ value: String) -> UInt32 {
        var h: UInt32 = 2_166_136_261
        for unit in value.utf16 {
            h = h ^ UInt32(unit)
            h = h &* 16_777_619
        }
        return h
    }

    private static func round2(_ n: Double) -> Double { (n * 100 + 0.5).rounded(.down) / 100 }

    private static func clamp(_ n: Double, _ lo: Double, _ hi: Double) -> Double { Swift.min(hi, Swift.max(lo, n)) }

    /// Devía los controles de la curva para que cada ejercicio tenga su letra.
    private static func jitter(seed: Double, index: Int, span: Double) -> Double {
        let wave = sin(seed * 0.0001 + Double(index) * 1.7) * 0.5 + sin(seed * 0.0007 + Double(index)) * 0.5
        return round2(wave * span)
    }

    /// La huella del ejercicio, o `nil` si la ficha no tiene patrón: sin patrón
    /// no hay movimiento que dibujar y la pantalla enseña la foto.
    static func spec(name: String, pattern: String?, stimulus: String?, load: String?) -> Spec? {
        guard let rail = rails[pattern ?? ""] else { return nil }
        let stim = stimulus.flatMap { tempos[$0] == nil ? nil : $0 }
        let tempo = tempos[stim ?? "Hipertrofia"] ?? Tempo(conc: 0.8, ecc: 1.6, pause: 0.45)
        let weight = weights[load ?? "Media"] ?? (0.82, 1.8)
        // El isométrico viaja menos: aguanta, no recorre.
        let amp = weight.amp * (stim == "Isométrico" ? 0.7 : 1)
        let seed = Double(hash(name))
        let points = rail.enumerated().map { (i, p) -> Point in
            Point(
                x: clamp(round2(50 + (p.x - 50) * amp + jitter(seed: seed, index: i, span: 6)), 6, 94),
                y: clamp(round2(28 + (p.y - 28) * amp + jitter(seed: seed, index: i + 4, span: 4.5)), 5, 44)
            )
        }
        let duration = round2(tempo.conc + tempo.ecc + tempo.pause)
        let hold = stim == "Isométrico"
        return Spec(
            points: points,
            start: points[0],
            end: points[3],
            duration: duration,
            hold: hold,
            stroke: weight.stroke,
            label: stim == nil ? (pattern ?? "") : "\(pattern ?? "") · \(stim!)",
            cycleTimes: hold
                ? [0, 0.28, 1]
                : [0, round2(tempo.conc / duration), round2((tempo.conc + tempo.ecc) / duration), 1],
            cyclePos: hold ? [0, 1, 1] : [0, 1, 0, 0]
        )
    }

    /// Dónde está el punto en un instante: sube rápido, baja despacio y descansa.
    static func position(spec: Spec, time: Double) -> Double {
        let cycle = Swift.max(spec.duration, 0.01)
        let f = time.truncatingRemainder(dividingBy: cycle) / cycle
        guard spec.cycleTimes.count > 1 else { return spec.cyclePos.last ?? 0 }
        for i in 1..<spec.cycleTimes.count where f <= spec.cycleTimes[i] {
            let span = spec.cycleTimes[i] - spec.cycleTimes[i - 1]
            let local = span > 0 ? (f - spec.cycleTimes[i - 1]) / span : 1
            return spec.cyclePos[i - 1] + (spec.cyclePos[i] - spec.cyclePos[i - 1]) * local
        }
        return spec.cyclePos.last ?? 0
    }

    /// Punto de la curva en el parámetro `u` (0 = reposo, 1 = tensión máxima).
    static func bezier(_ spec: Spec, _ u: Double) -> Point {
        let p = spec.points
        let v = 1 - u
        let a = v * v * v, b = 3 * v * v * u, c = 3 * v * u * u, d = u * u * u
        return Point(
            x: a * p[0].x + b * p[1].x + c * p[2].x + d * p[3].x,
            y: a * p[0].y + b * p[1].y + c * p[2].y + d * p[3].y
        )
    }
}

// MARK: - Dibujo

extension ExerciseMotion {
    enum Mode {
        /// Miniatura: la curva y sus dos extremos, quieta.
        case thumb
        /// Héroe: la curva con el punto que entrena en la posición `u`.
        case hero(u: Double)
    }

    /// Dibuja la huella dentro del contexto, escalada y centrada (como `meet` en SVG).
    static func draw(_ spec: Spec, in context: GraphicsContext, size: CGSize, mode: Mode) {
        let scale = Swift.min(size.width / canvas.width, size.height / canvas.height)
        let origin = CGPoint(
            x: (size.width - canvas.width * scale) / 2,
            y: (size.height - canvas.height * scale) / 2
        )
        let spot: (Point) -> CGPoint = { CGPoint(x: origin.x + $0.x * scale, y: origin.y + $0.y * scale) }

        let path = Path { p in
            let pts = spec.points.map(spot)
            p.move(to: pts[0])
            p.addCurve(to: pts[3], control1: pts[1], control2: pts[2])
        }

        switch mode {
        case .thumb:
            // En un cuadro tan pequeño una línea fina se convierte en polvo.
            context.stroke(
                path,
                with: .color(Palette.gold.opacity(0.42)),
                style: StrokeStyle(lineWidth: CGFloat(spec.stroke + 6) * scale, lineCap: .round)
            )
            context.fill(circle(spot(spec.start), 3.4 * scale), with: .color(Palette.gold.opacity(0.5)))
            if spec.hold {
                // Isométrico: el punto no viaja, aguanta. Se marca con un anillo.
                context.stroke(circle(spot(spec.end), 6.4 * scale), with: .color(Palette.gold), lineWidth: CGFloat(2.8 * scale))
            } else {
                context.fill(circle(spot(spec.end), 6.6 * scale), with: .color(Palette.gold))
            }
        case .hero(let u):
            context.stroke(
                path,
                with: .color(Palette.gold.opacity(0.22)),
                style: StrokeStyle(lineWidth: CGFloat(spec.stroke) * scale, lineCap: .round)
            )
            context.fill(circle(spot(spec.start), 1.3 * scale), with: .color(Palette.gold.opacity(0.35)))
            context.stroke(circle(spot(spec.end), 2.6 * scale), with: .color(Palette.gold.opacity(0.45)), lineWidth: CGFloat(0.9 * scale))
            // El punto que entrena: halo suave + núcleo.
            let at = spot(bezier(spec, u))
            context.fill(circle(at, 9 * scale), with: .color(Palette.gold.opacity(0.09)))
            context.fill(circle(at, 3.2 * scale), with: .color(Palette.gold))
        }
    }

    private static func circle(_ center: CGPoint, _ radius: CGFloat) -> Path {
        Path(ellipseIn: CGRect(x: center.x - radius, y: center.y - radius, width: radius * 2, height: radius * 2))
    }
}

// MARK: - Vistas

/// La huella en miniatura: quieta, para las filas de las listas.
struct ExerciseMotionGlyph: View {
    let spec: ExerciseMotion.Spec

    var body: some View {
        Canvas { context, size in
            ExerciseMotion.draw(spec, in: context, size: size, mode: .thumb)
        }
        .accessibilityHidden(true)
    }
}

/// La huella grande, con el punto que entrena. Con «reducir movimiento» se ve
/// el mismo dibujo quieto, con el punto en la posición de mayor tensión.
struct ExerciseMotionHero: View {
    let spec: ExerciseMotion.Spec
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        Group {
            if reduceMotion {
                Canvas { context, size in
                    ExerciseMotion.draw(spec, in: context, size: size, mode: .hero(u: 1))
                }
            } else {
                TimelineView(.animation) { timeline in
                    Canvas { context, size in
                        let time = timeline.date.timeIntervalSinceReferenceDate
                        ExerciseMotion.draw(
                            spec,
                            in: context,
                            size: size,
                            mode: .hero(u: ExerciseMotion.position(spec: spec, time: time))
                        )
                    }
                }
            }
        }
        .accessibilityLabel("Ritmo de \(spec.label)")
        .accessibilityAddTraits(.isImage)
    }
}
