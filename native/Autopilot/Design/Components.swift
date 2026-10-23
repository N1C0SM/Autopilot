import SwiftUI

/// Tarjeta de descanso de la web (`EmptyState rest`): luna dorada con halo, estrellas, título y acción.
struct RestCard<Action: View>: View {
    let title: String
    let message: String
    @ViewBuilder var action: Action

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Spacer(minLength: 150)
            Text(title).font(.system(.title, design: .rounded).weight(.bold)).accessibilityAddTraits(.isHeader)
            Text(message).font(.apBody).foregroundStyle(Palette.muted).fixedSize(horizontal: false, vertical: true)
            action.padding(.top, 14)
        }
        .padding(24)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(alignment: .topTrailing) {
            ZStack(alignment: .topTrailing) {
                RadialGradient(colors: [Palette.gold.opacity(0.28), .clear], center: .init(x: 0.82, y: 0.2), startRadius: 0, endRadius: 220)
                Image(systemName: "moon.fill")
                    .font(.system(size: 120, weight: .regular))
                    .foregroundStyle(Palette.gold)
                    .rotationEffect(.degrees(-20))
                    .padding(.top, 34).padding(.trailing, 34)
                Canvas { ctx, size in
                    for p in [CGPoint(x: 0.22, y: 0.13), CGPoint(x: 0.44, y: 0.2), CGPoint(x: 0.58, y: 0.28), CGPoint(x: 0.3, y: 0.38), CGPoint(x: 0.72, y: 0.12)] {
                        ctx.fill(Path(ellipseIn: CGRect(x: p.x * size.width, y: p.y * size.height, width: 5, height: 5)), with: .color(.white.opacity(0.5)))
                    }
                }
            }
            .accessibilityHidden(true)
        }
        .background(Palette.card)
        .clipShape(RoundedRectangle(cornerRadius: Radius.hero, style: .continuous))
    }
}

/// Botones redondos de la cabecera (campana y avatar con inicial), como `MobileHeader`.
struct HeaderButtons: View {
    let initial: String
    var onProfile: () -> Void

    var body: some View {
        HStack(spacing: 12) {
            Button {} label: {
                Image(systemName: "bell").font(.system(size: 17, weight: .medium))
                    .frame(width: 40, height: 40).background(Palette.card, in: Circle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Notificaciones")
            Button(action: onProfile) {
                Text(initial).font(.system(size: 17, weight: .semibold))
                    .frame(width: 40, height: 40).background(Palette.card, in: Circle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Perfil y ajustes")
        }
        .foregroundStyle(Palette.foreground)
    }
}

/// Barra de pestañas flotante (MobileTabBar): cápsula oscura con la pestaña activa en una píldora dorada.
struct FloatingTabBar: View {
    let tabs: [AppSection]
    @Binding var selection: AppSection

    var body: some View {
        HStack(spacing: 0) {
            ForEach(tabs) { tab in
                let active = tab == selection
                Button { Haptics.selection(); selection = tab } label: {
                    VStack(spacing: 4) {
                        Image(systemName: tab.tabSymbol(active: active)).font(.system(size: 21, weight: active ? .semibold : .regular))
                        Text(tab.tabTitle).font(.system(size: 12, weight: active ? .semibold : .regular))
                    }
                    .foregroundStyle(active ? Color.black : Palette.muted)
                    .frame(maxWidth: .infinity, minHeight: 58)
                    .background { if active { Capsule().fill(Palette.gold).shadow(color: Palette.gold.opacity(0.35), radius: 10) } }
                    .contentShape(Capsule())
                }
                .buttonStyle(.plain)
                .accessibilityLabel(tab.tabTitle)
                .accessibilityAddTraits(active ? .isSelected : [])
            }
        }
        .padding(6)
        .background(Palette.card, in: Capsule())
        .padding(.horizontal, 12)
    }
}

/// Control segmentado de la web (`TabsList`): fondo oscuro y la opción activa en gris claro.
struct SegmentedPill: View {
    let options: [String]
    @Binding var selection: Int

    var body: some View {
        HStack(spacing: 0) {
            ForEach(options.indices, id: \.self) { i in
                Button { Haptics.selection(); selection = i } label: {
                    Text(options[i]).font(.apSubhead.weight(.semibold))
                        .foregroundStyle(i == selection ? Palette.foreground : Palette.muted)
                        .frame(maxWidth: .infinity, minHeight: 40)
                        .background { if i == selection { RoundedRectangle(cornerRadius: 10, style: .continuous).fill(Color.white.opacity(0.16)) } }
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityAddTraits(i == selection ? .isSelected : [])
            }
        }
        .padding(4)
        .background(Palette.card, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
    }
}

/// Anillo de progreso con icono dentro (ProgressRing).
struct ProgressRing: View {
    let value: Double
    let symbol: String
    var muted = false

    var body: some View {
        ZStack {
            Circle().stroke(Palette.secondary, lineWidth: 3.5)
            Circle().trim(from: 0, to: max(0, min(1, value / 100)))
                .stroke(muted ? Palette.muted : Palette.gold, style: StrokeStyle(lineWidth: 3.5, lineCap: .round))
                .rotationEffect(.degrees(-90))
            Image(systemName: symbol).font(.system(size: 13, weight: .semibold)).foregroundStyle(muted ? Palette.muted : Palette.gold)
        }
        .frame(width: 32, height: 32)
        .accessibilityHidden(true)
    }
}

extension AppSection {
    func tabSymbol(active: Bool) -> String {
        switch self {
        case .home: active ? "house.fill" : "house"
        case .train: "dumbbell.fill"
        case .nutrition: "fork.knife"
        case .progress: "chart.line.uptrend.xyaxis"
        default: symbol
        }
    }
}
