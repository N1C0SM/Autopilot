import SwiftUI

// MARK: - GlassCard
/// Tarjeta Glassmorphic con .ultraThinMaterial, bordes sutiles y esquinas redondeadas continuas.
public struct GlassCard<Content: View>: View {
    private let cornerRadius: CGFloat
    private let content: Content

    public init(cornerRadius: CGFloat = 16, @ViewBuilder content: () -> Content) {
        self.cornerRadius = cornerRadius
        self.content = content()
    }

    public var body: some View {
        content
            .background {
                RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                    .fill(.ultraThinMaterial)
                    .overlay(
                        RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                            .fill(Color.glassSurface.opacity(0.55))
                    )
            }
            .clipShape(RoundedRectangle(cornerRadius: cornerRadius, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                    .strokeBorder(Color.glassBorder, lineWidth: 1)
            )
            .shadow(color: Color.black.opacity(0.35), radius: 14, x: 0, y: 8)
    }
}

// MARK: - PrimaryButton
/// Botón con gradiente de Violeta Eléctrico, bordes luminosos y resplandor sutil (glow).
public struct PrimaryButton: View {
    let title: String
    let iconName: String?
    let action: () -> Void

    public init(_ title: String, iconName: String? = nil, action: @escaping () -> Void) {
        self.title = title
        self.iconName = iconName
        self.action = action
    }

    public var body: some View {
        Button(action: action) {
            HStack(spacing: 8) {
                if let iconName {
                    Image(systemName: iconName)
                        .font(.body.weight(.semibold))
                }
                Text(title)
                    .font(.body.weight(.semibold))
            }
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity)
            .frame(height: 50)
            .background {
                Capsule(style: .continuous)
                    .fill(
                        LinearGradient(
                            colors: [Color.electricViolet, Color.electricViolet.opacity(0.85)],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
            }
            .overlay {
                Capsule(style: .continuous)
                    .strokeBorder(Color.white.opacity(0.2), lineWidth: 1)
            }
            .glow(color: .electricViolet, radius: 10, opacity: 0.5)
        }
        .buttonStyle(SpringyScaleButtonStyle())
    }
}

public struct SpringyScaleButtonStyle: ButtonStyle {
    public init() {}
    public func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.96 : 1.0)
            .animation(.spring(response: 0.28, dampingFraction: 0.65), value: configuration.isPressed)
    }
}

// MARK: - MetricTile (Bento Grid Tile)
/// Tarjeta modular optimizada para Bento Grid con indicadores de tendencia y acentos cromáticos.
public struct MetricTile: View {
    public enum TrendDirection {
        case up, down, neutral
    }

    let title: String
    let value: String
    let subtitle: String?
    let trend: String?
    let trendDirection: TrendDirection
    let accentColor: Color
    let icon: String

    public init(
        title: String,
        value: String,
        subtitle: String? = nil,
        trend: String? = nil,
        trendDirection: TrendDirection = .neutral,
        accentColor: Color = .electricViolet,
        icon: String
    ) {
        self.title = title
        self.value = value
        self.subtitle = subtitle
        self.trend = trend
        self.trendDirection = trendDirection
        self.accentColor = accentColor
        self.icon = icon
    }

    public var body: some View {
        GlassCard(cornerRadius: 16) {
            VStack(alignment: .leading, spacing: 14) {
                HStack {
                    ZStack {
                        Circle()
                            .fill(accentColor.opacity(0.16))
                            .frame(width: 38, height: 38)
                        
                        Image(systemName: icon)
                            .foregroundStyle(accentColor)
                            .font(.system(size: 16, weight: .bold))
                    }
                    
                    Spacer()
                    
                    if let trend {
                        HStack(spacing: 4) {
                            Image(systemName: trendIcon)
                            Text(trend)
                        }
                        .font(.glassBadge)
                        .foregroundStyle(trendColor)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background {
                            Capsule().fill(trendColor.opacity(0.12))
                        }
                    }
                }

                VStack(alignment: .leading, spacing: 4) {
                    Text(value)
                        .font(.glassMetric)
                        .foregroundStyle(Color.glassTextPrimary)
                    
                    Text(title)
                        .font(.subheadline)
                        .foregroundStyle(Color.glassTextSecondary)
                }

                if let subtitle {
                    Text(subtitle)
                        .font(.caption)
                        .foregroundStyle(Color.glassTextMuted)
                }
            }
            .padding(18)
        }
    }

    private var trendIcon: String {
        switch trendDirection {
        case .up: return "arrow.up.right"
        case .down: return "arrow.down.right"
        case .neutral: return "minus"
        }
    }

    private var trendColor: Color {
        switch trendDirection {
        case .up: return .limeAccent
        case .down: return Color(hex: 0xEF4444)
        case .neutral: return .glassTextSecondary
        }
    }
}
