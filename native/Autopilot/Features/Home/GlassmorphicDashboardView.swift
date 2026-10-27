import SwiftUI

public struct GlassmorphicDashboardView: View {
    @State private var isLoaded: Bool = false
    public var onStartAction: (() -> Void)?

    public init(onStartAction: (() -> Void)? = nil) {
        self.onStartAction = onStartAction
    }

    public var body: some View {
        ScrollView(.vertical, showsIndicators: false) {
            VStack(alignment: .leading, spacing: 22) {
                // Cabecera Bento / Estado
                headerSection

                // Bento Grid con métricas dinámicas
                LazyVGrid(columns: [
                    GridItem(.flexible(), spacing: 16),
                    GridItem(.flexible(), spacing: 16)
                ], spacing: 16) {
                    MetricTile(
                        title: "Rendimiento",
                        value: "94%",
                        subtitle: "+6% vs semana anterior",
                        trend: "+6.2%",
                        trendDirection: .up,
                        accentColor: .limeAccent,
                        icon: "bolt.fill"
                    )

                    MetricTile(
                        title: "Sesiones",
                        value: "18 / 20",
                        subtitle: "Objetivo casi completado",
                        trend: "En meta",
                        trendDirection: .neutral,
                        accentColor: .electricViolet,
                        icon: "figure.run"
                    )

                    MetricTile(
                        title: "Consumo H2O",
                        value: "2.8 L",
                        subtitle: "85% completado hoy",
                        trend: "+0.4L",
                        trendDirection: .up,
                        accentColor: .cyanAccent,
                        icon: "drop.fill"
                    )

                    MetricTile(
                        title: "Descanso",
                        value: "7h 45m",
                        subtitle: "Eficiencia de sueño 91%",
                        trend: "-12m",
                        trendDirection: .down,
                        accentColor: .electricViolet,
                        icon: "moon.stars.fill"
                    )
                }

                // Bento Banner Destacado / Asistente IA
                heroBentoTile

                PrimaryButton("Iniciar Sesión Inteligente", iconName: "play.fill") {
                    withAnimation(.spring(response: 0.35, dampingFraction: 0.75)) {
                        onStartAction?()
                    }
                }
                .padding(.top, 6)
            }
            .padding(.horizontal, 20)
            .padding(.top, 16)
            .padding(.bottom, 32)
            .opacity(isLoaded ? 1 : 0)
            .offset(y: isLoaded ? 0 : 16)
        }
        .background(Color.glassBackground.ignoresSafeArea())
        .onAppear {
            withAnimation(.spring(response: 0.5, dampingFraction: 0.8)) {
                isLoaded = true
            }
        }
    }

    private var headerSection: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text("AUTOPILOT")
                    .font(.glassBadge)
                    .foregroundStyle(Color.electricViolet)
                    .tracking(2.2)
                Text("Panel de Control")
                    .font(.glassDisplay)
                    .foregroundStyle(Color.glassTextPrimary)
            }
            Spacer()
            ZStack {
                Circle()
                    .fill(Color.glassSurface)
                    .frame(width: 44, height: 44)
                    .overlay(Circle().stroke(Color.glassBorder, lineWidth: 1))
                Image(systemName: "bell.badge.fill")
                    .foregroundStyle(Color.electricViolet)
            }
        }
    }

    private var heroBentoTile: some View {
        GlassCard(cornerRadius: 18) {
            HStack(spacing: 16) {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Recomendación Autopilot IA")
                        .font(.glassBadge)
                        .foregroundStyle(Color.cyanAccent)
                    Text("Sobrecarga progresiva recomendada para sentadilla (+2.5 kg).")
                        .font(.glassBody)
                        .foregroundStyle(Color.glassTextPrimary)
                }
                Spacer()
                Image(systemName: "sparkles")
                    .font(.system(size: 28))
                    .foregroundStyle(Color.electricViolet)
                    .glow(color: .electricViolet, radius: 8, opacity: 0.6)
            }
            .padding(20)
        }
    }
}
