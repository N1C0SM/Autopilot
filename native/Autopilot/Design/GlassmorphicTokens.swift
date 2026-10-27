import SwiftUI

// MARK: - Color Tokens (Glassmorphic Dark & Vibrant Accents)
public extension Color {
    // Fondos y Superficies Principales
    static let glassBackground = Color(hex: 0x0D0E12)
    static let glassSurface = Color(hex: 0x16181F)
    static let glassSurfaceSubtle = Color(hex: 0x1C1F28)

    // Acentos Principales y Secundarios
    static let electricViolet = Color(hex: 0x8B5CF6)
    static let cyanAccent = Color(hex: 0x06B6D4)
    static let limeAccent = Color(hex: 0x84CC16)

    // Bordes y Destellos Glassmorphic
    static let glassBorder = Color.white.opacity(0.08)
    static let glassBorderSubtle = Color.white.opacity(0.04)
    static let glassHighlight = Color.white.opacity(0.14)

    // Textos
    static let glassTextPrimary = Color.white
    static let glassTextSecondary = Color(hex: 0x94A3B8)
    static let glassTextMuted = Color(hex: 0x64748B)

    // Inicializador Hexadecimal compatible con SwiftUI
    init(hex: UInt, opacity: Double = 1.0) {
        self.init(
            .sRGB,
            red: Double((hex >> 16) & 0xff) / 255.0,
            green: Double((hex >> 8) & 0xff) / 255.0,
            blue: Double(hex & 0xff) / 255.0,
            opacity: opacity
        )
    }
}

// MARK: - Font Tokens
public extension Font {
    static let glassDisplay = Font.system(.largeTitle, design: .rounded).weight(.bold)
    static let glassMetric = Font.system(size: 32, weight: .bold, design: .rounded)
    static let glassTitle = Font.system(.title2, design: .rounded).weight(.semibold)
    static let glassHeadline = Font.system(.headline, design: .default).weight(.medium)
    static let glassBody = Font.system(.body, design: .default)
    static let glassBadge = Font.system(.caption2, design: .rounded).weight(.bold)
}

// MARK: - Glow Modifier
public struct GlowModifier: ViewModifier {
    var color: Color
    var radius: CGFloat
    var opacity: Double

    public func body(content: Content) -> some View {
        content
            .shadow(color: color.opacity(opacity), radius: radius, x: 0, y: 0)
            .shadow(color: color.opacity(opacity * 0.4), radius: radius * 1.8, x: 0, y: 0)
    }
}

public extension View {
    func glow(color: Color = .electricViolet, radius: CGFloat = 12, opacity: Double = 0.45) -> some View {
        self.modifier(GlowModifier(color: color, radius: radius, opacity: opacity))
    }
}
