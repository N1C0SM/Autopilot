import SwiftUI

// Compartido por la app y la extensión de widgets (Live Activity del entreno): una sola geometría
// del AP en todo lo nativo. `BrandMark` (Components.swift) y la isla dinámica lo pintan igual.

/// El monograma AP en las coordenadas del dibujo original, ajustado a la caja 30…946 × 30…530
/// (igual que `BRAND_VIEWBOX` en la web). La «A» con sus dos curvas y la «P» con sus dos arcos.
struct BrandShape: Shape {
    enum Part { case a, p }
    let part: Part
    func path(in rect: CGRect) -> Path {
        let k = min(rect.width / 916, rect.height / 500)
        let ox = rect.midX - 488 * k, oy = rect.midY - 280 * k
        let pt = { (x: CGFloat, y: CGFloat) in CGPoint(x: ox + x * k, y: oy + y * k) }
        var p = Path()
        switch part {
        case .a: // M35 520L382 50Q396 34 411 52L680 515H548L390 235L203 510Q197 520 185 520Z
            p.move(to: pt(35, 520))
            p.addLine(to: pt(382, 50))
            p.addQuadCurve(to: pt(411, 52), control: pt(396, 34))
            p.addLine(to: pt(680, 515))
            p.addLine(to: pt(548, 515))
            p.addLine(to: pt(390, 235))
            p.addLine(to: pt(203, 510))
            p.addQuadCurve(to: pt(185, 520), control: pt(197, 520))
        case .p: // M460 45H775A166.5 166.5 0 0 1 775 378H655L600 272H770A62 62 0 0 0 770 148H520Z
            p.move(to: pt(460, 45))
            p.addLine(to: pt(775, 45))
            p.addArc(center: pt(775, 211.5), radius: 166.5 * k, startAngle: .degrees(-90), endAngle: .degrees(90), clockwise: false)
            p.addLine(to: pt(655, 378))
            p.addLine(to: pt(600, 272))
            p.addLine(to: pt(770, 272))
            p.addArc(center: pt(770, 210), radius: 62 * k, startAngle: .degrees(90), endAngle: .degrees(-90), clockwise: true)
            p.addLine(to: pt(520, 148))
        }
        p.closeSubpath()
        return p
    }
}
