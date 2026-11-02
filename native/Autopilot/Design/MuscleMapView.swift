import SwiftUI

// MARK: - Muscle mapping (mirrors muscleMapping.ts)

private let ALIASES: [String: String] = [
    "pecho": "Pecho", "pectoral": "Pecho", "pectorales": "Pecho",
    "espalda": "Espalda", "dorsal": "Espalda", "dorsales": "Espalda",
    "hombro": "Hombros", "hombros": "Hombros", "deltoides": "Hombros",
    "biceps": "Bíceps", "bíceps": "Bíceps",
    "tricep": "Tríceps", "triceps": "Tríceps", "tríceps": "Tríceps",
    "piernas": "Piernas", "cuadriceps": "Piernas", "cuádriceps": "Piernas",
    "gluteo": "Glúteos", "gluteos": "Glúteos", "glúteos": "Glúteos",
    "core": "Core", "abdomen": "Core", "abdominales": "Core",
    "isquiotibiales": "Isquiotibiales", "isquios": "Isquiotibiales",
    "gemelos": "Gemelos", "pantorrillas": "Gemelos",
    "antebrazos": "Antebrazos",
    "trapecio": "Trapecios", "trapecios": "Trapecios",
    "romboides": "Romboides",
    "lumbares": "Lumbares",
    "serrato": "Serrato",
    "aductores": "Aductores",
    "abductores": "Abductores",
]

private func normalizeMuscle(_ raw: String) -> [String] {
    let key = raw.lowercased()
        .folding(options: .diacriticInsensitive, locale: .current)
        .trimmingCharacters(in: .whitespaces)
    if key == "cuerpo completo" || key == "full body" {
        return ["Pecho", "Espalda", "Hombros", "Piernas", "Glúteos", "Core"]
    }
    if let direct = ALIASES[key] { return [direct] }
    // compound: "Pecho y tríceps" → split
    let parts = key.components(separatedBy: CharacterSet(charactersIn: " ,·/+y-"))
    return Array(Set(parts.compactMap { ALIASES[$0] }))
}

private struct MuscleRule {
    let pattern: NSRegularExpression
    let primary: [String]
    let synergists: [String]
}

private let RULES: [MuscleRule] = {
    func r(_ pat: String, p: [String], s: [String]) -> MuscleRule {
        MuscleRule(
            pattern: try! NSRegularExpression(pattern: pat, options: .caseInsensitive),
            primary: p, synergists: s
        )
    }
    return [
        r("press.*(banca|inclinad|declinad|pecho)|bench|flexion|push.?up|fondos.*pecho|aperturas",
          p: ["Pecho"], s: ["Tríceps", "Hombros"]),
        r("fondos|dips", p: ["Tríceps"], s: ["Pecho", "Hombros"]),
        r("press.*(militar|hombro|arnold)|overhead|pike|handstand|pino",
          p: ["Hombros"], s: ["Tríceps", "Trapecios"]),
        r("elevacion.*lateral|pajaro|face.?pull", p: ["Hombros"], s: ["Trapecios"]),
        r("dominada|pull.?up|chin|jalon|lat.?pull", p: ["Espalda"], s: ["Bíceps", "Antebrazos", "Romboides"]),
        r("remo|row", p: ["Espalda"], s: ["Romboides", "Bíceps", "Trapecios"]),
        r("peso muerto rumano|rumano|rdl|buenos dias|good morning|curl femoral|leg curl|nordic",
          p: ["Isquiotibiales"], s: ["Glúteos", "Lumbares"]),
        r("peso muerto|deadlift", p: ["Isquiotibiales"], s: ["Glúteos", "Lumbares", "Espalda", "Trapecios"]),
        r("hip.?thrust|puente.*glut|patada.*glut", p: ["Glúteos"], s: ["Isquiotibiales"]),
        r("sentadilla|squat|prensa|zancada|lunge|bulgara|step.?up|pistol",
          p: ["Piernas"], s: ["Glúteos", "Aductores", "Core"]),
        r("extension.*(cuadriceps|pierna)|leg extension", p: ["Piernas"], s: []),
        r("gemelo|calf|pantorrilla", p: ["Gemelos"], s: []),
        r("curl", p: ["Bíceps"], s: ["Antebrazos"]),
        r("extension.*tricep|press frances|skull|patada.*tricep|pushdown", p: ["Tríceps"], s: []),
        r("encogimiento|shrug", p: ["Trapecios"], s: []),
        r("plancha|plank|crunch|rueda|ab.?wheel|elevacion.*pierna|hollow|l.?sit|dragon",
          p: ["Core"], s: []),
    ]
}()

func musclesForExercise(name: String, muscleGroup: String?) -> (primary: [String], synergists: [String]) {
    let n = name.lowercased()
    let fromGroup = normalizeMuscle(muscleGroup ?? "")
    var primary = fromGroup
    var synergists: [String] = []
    for rule in RULES {
        let range = NSRange(n.startIndex..., in: n)
        if rule.pattern.firstMatch(in: n, range: range) != nil {
            if primary.isEmpty { primary = rule.primary }
            synergists = rule.synergists.filter { !primary.contains($0) }
            break
        }
    }
    return (primary: primary, synergists: synergists)
}

// MARK: - Muscle IDs

private let BACK_MUSCLES: Set<String> = [
    "Espalda", "Trapecios", "Romboides", "Lumbares",
    "Isquiotibiales", "Glúteos", "Gemelos",
]

private func isBackMuscle(_ m: String) -> Bool { BACK_MUSCLES.contains(m) }

private func resolveView(primary: [String], synergists: [String]) -> Bool {
    // returns true if back view
    for m in primary + synergists {
        if isBackMuscle(m) { return true }
    }
    return false
}

// MARK: - Drawing helpers

private let BASE = Color(red: 0.118, green: 0.118, blue: 0.133)
private let DIM  = Color(red: 0.094, green: 0.094, blue: 0.094)
private let GLOW = Color(red: 0.855, green: 0.647, blue: 0.125) // gold

private func highlighted(_ muscle: String, primary: [String], synergists: [String]) -> Color? {
    if primary.contains(muscle) { return Palette.gold }
    if synergists.contains(muscle) { return Palette.gold.opacity(0.45) }
    return nil
}

private func muscFill(_ muscle: String, primary: [String], synergists: [String]) -> Color {
    highlighted(muscle, primary: primary, synergists: synergists) ?? BASE
}

// MARK: - Front body

private struct FrontBodyShape: View {
    let primary: [String]
    let synergists: [String]

    private func fill(_ m: String) -> Color { muscFill(m, primary: primary, synergists: synergists) }
    private func isActive(_ m: String) -> Bool { primary.contains(m) || synergists.contains(m) }

    var body: some View {
        Canvas { ctx, size in
            let sx = size.width / 200
            let sy = size.height / 310

            func t(_ x: CGFloat, _ y: CGFloat) -> CGPoint { .init(x: x * sx, y: y * sy) }

            // Helper: fill a path with muscle color + optional glow
            func draw(_ path: Path, muscle: String) {
                let color = fill(muscle)
                ctx.fill(path, with: .color(color))
                if isActive(muscle) {
                    var glowCtx = ctx
                    glowCtx.addFilter(.shadow(color: Palette.gold.opacity(0.7), radius: 6 * sx))
                    glowCtx.fill(path, with: .color(color))
                }
            }

            // Head
            var head = Path()
            head.addEllipse(in: .init(x: 82 * sx, y: 2 * sy, width: 36 * sx, height: 40 * sy))
            ctx.fill(head, with: .color(Color(red: 0.145, green: 0.145, blue: 0.157)))

            // Neck
            var neck = Path()
            neck.addRoundedRect(in: .init(x: 93 * sx, y: 38 * sy, width: 14 * sx, height: 14 * sy),
                                cornerSize: .init(width: 4 * sx, height: 4 * sy))
            ctx.fill(neck, with: .color(Color(red: 0.133, green: 0.133, blue: 0.145)))

            // Shoulders
            var shL = Path(); shL.addEllipse(in: .init(x: 50 * sx, y: 54 * sy, width: 32 * sx, height: 36 * sy))
            draw(shL, muscle: "Hombros")
            var shR = Path(); shR.addEllipse(in: .init(x: 118 * sx, y: 54 * sy, width: 32 * sx, height: 36 * sy))
            draw(shR, muscle: "Hombros")

            // Chest L
            var chL = Path()
            chL.move(to: t(100, 58)); chL.addCurve(to: t(62, 82), control1: t(84, 60), control2: t(66, 65))
            chL.addCurve(to: t(80, 109), control1: t(58, 96), control2: t(64, 108))
            chL.addCurve(to: t(100, 96), control1: t(90, 110), control2: t(98, 104)); chL.closeSubpath()
            draw(chL, muscle: "Pecho")

            // Chest R
            var chR = Path()
            chR.move(to: t(100, 58)); chR.addCurve(to: t(138, 82), control1: t(116, 60), control2: t(134, 65))
            chR.addCurve(to: t(120, 109), control1: t(142, 96), control2: t(136, 108))
            chR.addCurve(to: t(100, 96), control1: t(110, 110), control2: t(102, 104)); chR.closeSubpath()
            draw(chR, muscle: "Pecho")

            // Lat sides visible
            var latL = Path()
            latL.move(to: t(66, 80)); latL.addCurve(to: t(64, 154), control1: t(60, 98), control2: t(60, 125))
            latL.addLine(to: t(76, 154)); latL.addCurve(to: t(74, 82), control1: t(72, 126), control2: t(70, 100)); latL.closeSubpath()
            draw(latL, muscle: "Serrato")
            var latR = Path()
            latR.move(to: t(134, 80)); latR.addCurve(to: t(136, 154), control1: t(140, 98), control2: t(140, 125))
            latR.addLine(to: t(124, 154)); latR.addCurve(to: t(126, 82), control1: t(128, 126), control2: t(130, 100)); latR.closeSubpath()
            draw(latR, muscle: "Serrato")

            // Core (6 abs)
            for row in 0..<3 {
                for col in 0..<2 {
                    var ab = Path()
                    ab.addRoundedRect(
                        in: .init(x: CGFloat(96 + col * 14) * sx, y: CGFloat(111 + row * 18) * sy,
                                  width: 12 * sx, height: 14 * sy),
                        cornerSize: .init(width: 3 * sx, height: 3 * sy))
                    draw(ab, muscle: "Core")
                }
            }

            // Obliques
            for (mx, curve) in [(83.0, 85.0), (117.0, 115.0)] {
                var ob = Path()
                ob.move(to: t(mx, 111)); ob.addCurve(to: t(mx - (mx < 100 ? -1 : 1), 158), control1: t(curve - 9, 124), control2: t(curve - 11, 142))
                ob.addLine(to: t(mx + 8 * (mx < 100 ? 1 : -1), 158))
                ob.addCurve(to: t(mx + 2 * (mx < 100 ? 1 : -1), 111), control1: t(curve - 3, 142), control2: t(curve - 3, 124))
                ob.closeSubpath()
                ctx.fill(ob, with: .color(DIM))
            }

            // Hips
            var hip = Path()
            hip.move(to: t(76, 156)); hip.addCurve(to: t(70, 176), control1: t(70, 162), control2: t(68, 170))
            hip.addLine(to: t(130, 176)); hip.addCurve(to: t(124, 156), control1: t(132, 170), control2: t(130, 162)); hip.closeSubpath()
            ctx.fill(hip, with: .color(DIM))

            // Biceps L
            var biL = Path()
            biL.move(to: t(58, 84)); biL.addCurve(to: t(48, 132), control1: t(50, 94), control2: t(46, 114))
            biL.addCurve(to: t(62, 138), control1: t(50, 138), control2: t(56, 140))
            biL.addCurve(to: t(68, 122), control1: t(68, 136), control2: t(70, 130))
            biL.addCurve(to: t(58, 84), control1: t(66, 112), control2: t(62, 96)); biL.closeSubpath()
            draw(biL, muscle: "Bíceps")

            // Biceps R
            var biR = Path()
            biR.move(to: t(142, 84)); biR.addCurve(to: t(152, 132), control1: t(150, 94), control2: t(154, 114))
            biR.addCurve(to: t(138, 138), control1: t(150, 138), control2: t(144, 140))
            biR.addCurve(to: t(132, 122), control1: t(132, 136), control2: t(130, 130))
            biR.addCurve(to: t(142, 84), control1: t(134, 112), control2: t(138, 96)); biR.closeSubpath()
            draw(biR, muscle: "Bíceps")

            // Triceps (front strip)
            var triL = Path()
            triL.move(to: t(56, 86)); triL.addCurve(to: t(50, 126), control1: t(50, 96), control2: t(48, 110))
            triL.addCurve(to: t(60, 128), control1: t(52, 130), control2: t(56, 130))
            triL.addCurve(to: t(62, 86), control1: t(60, 114), control2: t(60, 98)); triL.closeSubpath()
            draw(triL, muscle: "Tríceps")
            var triR = Path()
            triR.move(to: t(144, 86)); triR.addCurve(to: t(150, 126), control1: t(150, 96), control2: t(152, 110))
            triR.addCurve(to: t(140, 128), control1: t(148, 130), control2: t(144, 130))
            triR.addCurve(to: t(138, 86), control1: t(140, 114), control2: t(140, 98)); triR.closeSubpath()
            draw(triR, muscle: "Tríceps")

            // Forearms
            for (x1, x2, x3) in [(48.0, 44.0, 50.0), (152.0, 156.0, 150.0)] {
                var fa = Path()
                fa.move(to: t(x1, 134)); fa.addCurve(to: t(x2, 177), control1: t(x2, 150), control2: t(x2 + 2, 170))
                fa.addCurve(to: t(x3 + (x1 < 100 ? 10 : -10), 177), control1: t(x2 + (x1 < 100 ? 3 : -3), 181), control2: t(x2 + (x1 < 100 ? 9 : -9), 181))
                fa.addCurve(to: t(x1 + (x1 < 100 ? 14 : -14), 134), control1: t(x1 + (x1 < 100 ? 16 : -16), 170), control2: t(x1 + (x1 < 100 ? 17 : -17), 150))
                fa.closeSubpath()
                ctx.fill(fa, with: .color(DIM))
            }

            // Quads L
            var qdL = Path()
            qdL.move(to: t(100, 176)); qdL.addCurve(to: t(68, 250), control1: t(70, 190), control2: t(66, 222))
            qdL.addCurve(to: t(90, 262), control1: t(70, 260), control2: t(78, 264))
            qdL.addCurve(to: t(100, 242), control1: t(98, 260), control2: t(100, 252)); qdL.closeSubpath()
            draw(qdL, muscle: "Piernas")

            // Quads R
            var qdR = Path()
            qdR.move(to: t(100, 176)); qdR.addCurve(to: t(132, 250), control1: t(130, 190), control2: t(134, 222))
            qdR.addCurve(to: t(110, 262), control1: t(130, 260), control2: t(122, 264))
            qdR.addCurve(to: t(100, 242), control1: t(102, 260), control2: t(100, 252)); qdR.closeSubpath()
            draw(qdR, muscle: "Piernas")

            // Knees
            ctx.fill(Path(ellipseIn: .init(x: 74 * sx, y: 257 * sy, width: 20 * sx, height: 14 * sy)), with: .color(Color(red: 0.086, green: 0.086, blue: 0.094)))
            ctx.fill(Path(ellipseIn: .init(x: 106 * sx, y: 257 * sy, width: 20 * sx, height: 14 * sy)), with: .color(Color(red: 0.086, green: 0.086, blue: 0.094)))
        }
        .accessibilityHidden(true)
    }
}

// MARK: - Back body

private struct BackBodyShape: View {
    let primary: [String]
    let synergists: [String]

    private func fill(_ m: String) -> Color { muscFill(m, primary: primary, synergists: synergists) }
    private func isActive(_ m: String) -> Bool { primary.contains(m) || synergists.contains(m) }

    var body: some View {
        Canvas { ctx, size in
            let sx = size.width / 200
            let sy = size.height / 310
            func t(_ x: CGFloat, _ y: CGFloat) -> CGPoint { .init(x: x * sx, y: y * sy) }

            func draw(_ path: Path, muscle: String) {
                let color = fill(muscle)
                ctx.fill(path, with: .color(color))
                if isActive(muscle) {
                    var gc = ctx
                    gc.addFilter(.shadow(color: Palette.gold.opacity(0.7), radius: 6 * sx))
                    gc.fill(path, with: .color(color))
                }
            }

            // Head
            ctx.fill(Path(ellipseIn: .init(x: 82 * sx, y: 2 * sy, width: 36 * sx, height: 40 * sy)),
                     with: .color(Color(red: 0.145, green: 0.145, blue: 0.157)))

            // Traps
            var trap = Path()
            trap.move(to: t(84, 42)); trap.addCurve(to: t(62, 70), control1: t(76, 48), control2: t(66, 56))
            trap.addLine(to: t(80, 74)); trap.addCurve(to: t(100, 56), control1: t(84, 64), control2: t(92, 58))
            trap.addCurve(to: t(120, 74), control1: t(108, 58), control2: t(116, 64))
            trap.addLine(to: t(138, 70)); trap.addCurve(to: t(116, 42), control1: t(134, 56), control2: t(124, 48)); trap.closeSubpath()
            draw(trap, muscle: "Trapecios")

            // Shoulders back
            var sbL = Path(); sbL.addEllipse(in: .init(x: 44 * sx, y: 60 * sy, width: 36 * sx, height: 32 * sy))
            draw(sbL, muscle: "Hombros")
            var sbR = Path(); sbR.addEllipse(in: .init(x: 120 * sx, y: 60 * sy, width: 36 * sx, height: 32 * sy))
            draw(sbR, muscle: "Hombros")

            // Lats L
            var latL = Path()
            latL.move(to: t(66, 82)); latL.addCurve(to: t(58, 148), control1: t(56, 96), control2: t(54, 120))
            latL.addCurve(to: t(78, 160), control1: t(60, 158), control2: t(68, 162))
            latL.addCurve(to: t(86, 136), control1: t(86, 158), control2: t(88, 150))
            latL.addCurve(to: t(66, 82), control1: t(84, 118), control2: t(76, 100)); latL.closeSubpath()
            draw(latL, muscle: "Espalda")

            // Lats R
            var latR = Path()
            latR.move(to: t(134, 82)); latR.addCurve(to: t(142, 148), control1: t(144, 96), control2: t(146, 120))
            latR.addCurve(to: t(122, 160), control1: t(140, 158), control2: t(132, 162))
            latR.addCurve(to: t(114, 136), control1: t(114, 158), control2: t(112, 150))
            latR.addCurve(to: t(134, 82), control1: t(116, 118), control2: t(124, 100)); latR.closeSubpath()
            draw(latR, muscle: "Espalda")

            // Lower back
            var low = Path()
            low.move(to: t(86, 82)); low.addCurve(to: t(82, 158), control1: t(82, 104), control2: t(80, 132))
            low.addLine(to: t(100, 162)); low.addLine(to: t(118, 158))
            low.addCurve(to: t(114, 82), control1: t(120, 132), control2: t(118, 104))
            low.addCurve(to: t(86, 82), control1: t(110, 78), control2: t(90, 78)); low.closeSubpath()
            draw(low, muscle: "Lumbares")

            // Triceps back
            var tbL = Path()
            tbL.move(to: t(54, 88)); tbL.addCurve(to: t(46, 138), control1: t(46, 100), control2: t(44, 120))
            tbL.addCurve(to: t(60, 144), control1: t(48, 144), control2: t(54, 146))
            tbL.addCurve(to: t(66, 128), control1: t(66, 142), control2: t(68, 136))
            tbL.addCurve(to: t(54, 88), control1: t(64, 116), control2: t(58, 100)); tbL.closeSubpath()
            draw(tbL, muscle: "Tríceps")

            var tbR = Path()
            tbR.move(to: t(146, 88)); tbR.addCurve(to: t(154, 138), control1: t(154, 100), control2: t(156, 120))
            tbR.addCurve(to: t(140, 144), control1: t(152, 144), control2: t(146, 146))
            tbR.addCurve(to: t(134, 128), control1: t(134, 142), control2: t(132, 136))
            tbR.addCurve(to: t(146, 88), control1: t(136, 116), control2: t(142, 100)); tbR.closeSubpath()
            draw(tbR, muscle: "Tríceps")

            // Glutes L
            var glL = Path()
            glL.move(to: t(100, 162)); glL.addCurve(to: t(70, 194), control1: t(72, 168), control2: t(68, 180))
            glL.addCurve(to: t(92, 208), control1: t(72, 204), control2: t(80, 210))
            glL.addCurve(to: t(100, 186), control1: t(100, 206), control2: t(102, 198)); glL.closeSubpath()
            draw(glL, muscle: "Glúteos")

            // Glutes R
            var glR = Path()
            glR.move(to: t(100, 162)); glR.addCurve(to: t(130, 194), control1: t(128, 168), control2: t(132, 180))
            glR.addCurve(to: t(108, 208), control1: t(128, 204), control2: t(120, 210))
            glR.addCurve(to: t(100, 186), control1: t(100, 206), control2: t(98, 198)); glR.closeSubpath()
            draw(glR, muscle: "Glúteos")

            // Hamstrings L
            var hamL = Path()
            hamL.move(to: t(100, 210)); hamL.addCurve(to: t(70, 264), control1: t(70, 224), control2: t(68, 248))
            hamL.addCurve(to: t(90, 274), control1: t(72, 272), control2: t(80, 276))
            hamL.addCurve(to: t(100, 256), control1: t(98, 272), control2: t(100, 264)); hamL.closeSubpath()
            draw(hamL, muscle: "Isquiotibiales")

            // Hamstrings R
            var hamR = Path()
            hamR.move(to: t(100, 210)); hamR.addCurve(to: t(130, 264), control1: t(130, 224), control2: t(132, 248))
            hamR.addCurve(to: t(110, 274), control1: t(128, 272), control2: t(120, 276))
            hamR.addCurve(to: t(100, 256), control1: t(102, 272), control2: t(100, 264)); hamR.closeSubpath()
            draw(hamR, muscle: "Isquiotibiales")

            // Calves
            var caL = Path()
            caL.move(to: t(74, 282)); caL.addCurve(to: t(76, 320), control1: t(70, 298), control2: t(72, 314))
            caL.addCurve(to: t(90, 320), control1: t(79, 324), control2: t(86, 324))
            caL.addCurve(to: t(92, 286), control1: t(93, 315), control2: t(94, 300))
            caL.addCurve(to: t(74, 282), control1: t(90, 279), control2: t(84, 282)); caL.closeSubpath()
            draw(caL, muscle: "Gemelos")

            var caR = Path()
            caR.move(to: t(126, 282)); caR.addCurve(to: t(124, 320), control1: t(130, 298), control2: t(128, 314))
            caR.addCurve(to: t(110, 320), control1: t(121, 324), control2: t(114, 324))
            caR.addCurve(to: t(108, 286), control1: t(107, 315), control2: t(106, 300))
            caR.addCurve(to: t(126, 282), control1: t(110, 279), control2: t(116, 282)); caR.closeSubpath()
            draw(caR, muscle: "Gemelos")
        }
        .accessibilityHidden(true)
    }
}

// MARK: - Public view

/// Mapa muscular anatómico con vista frontal / trasera.
/// Flip automático según los músculos primarios del ejercicio.
struct MuscleMapView: View {
    let primary: [String]
    var synergists: [String] = []
    /// Tamaño del contenedor (ancho; alto ≈ 1.55×).
    var size: CGFloat = 100

    @State private var showBack: Bool = false
    @State private var flipping: Bool = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private var targetBack: Bool { resolveView(primary: primary, synergists: synergists) }

    var body: some View {
        VStack(spacing: 6) {
            ZStack {
                if showBack {
                    BackBodyShape(primary: primary, synergists: synergists)
                } else {
                    FrontBodyShape(primary: primary, synergists: synergists)
                }
            }
            .frame(width: size, height: size * 1.55)
            .scaleEffect(x: flipping ? 0.05 : 1, anchor: .center)
            .animation(reduceMotion ? nil : .easeInOut(duration: 0.28), value: flipping)

            // View indicator dots
            HStack(spacing: 6) {
                Circle().fill(!showBack ? Palette.gold : Palette.muted.opacity(0.3)).frame(width: 5, height: 5)
                Circle().fill( showBack ? Palette.gold : Palette.muted.opacity(0.3)).frame(width: 5, height: 5)
            }
            .animation(.easeInOut(duration: 0.3), value: showBack)
        }
        .accessibilityLabel("Mapa muscular – \(primary.joined(separator: ", "))")
        .onAppear { showBack = targetBack }
        .onChange(of: targetBack) { newVal in
            guard newVal != showBack else { return }
            if reduceMotion {
                showBack = newVal
            } else {
                flipping = true
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.28) {
                    showBack = newVal
                    flipping = false
                }
            }
        }
    }
}

// MARK: - Preview

#Preview {
    HStack(spacing: 32) {
        VStack {
            MuscleMapView(primary: ["Pecho"], synergists: ["Tríceps", "Hombros"])
            Text("Pecho").font(.apSubhead).foregroundStyle(Palette.muted)
        }
        VStack {
            MuscleMapView(primary: ["Espalda"], synergists: ["Bíceps"])
            Text("Espalda").font(.apSubhead).foregroundStyle(Palette.muted)
        }
        VStack {
            MuscleMapView(primary: ["Piernas"], synergists: ["Glúteos"])
            Text("Piernas").font(.apSubhead).foregroundStyle(Palette.muted)
        }
    }
    .padding(32)
    .background(Palette.background)
}
