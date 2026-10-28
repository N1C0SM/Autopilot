import SwiftUI

#if os(iOS)

/// Menú lateral de Admin en iPhone. Se abre con la hamburguesa de la barra y se cierra
/// al elegir una sección (igual que la barra lateral de Mac/iPad, pero como cajón).
///
/// Mismo lenguaje que el resto de la app: negro, dorado contenido, tarjetas de 22 pt,
/// píldoras y filas de 46 pt. La sección activa se marca con fondo dorado suave, texto
/// dorado y un punto a la derecha (no solo con color: también con forma).
struct AdminSidebarView: View {
    @Binding var selection: AppSection
    @EnvironmentObject private var session: SessionModel
    @EnvironmentObject private var accounts: AccountStore
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var onClose: () -> Void

    private var account: SavedAccount? {
        accounts.accounts.first { $0.id == session.userIdString }
    }

    private var initial: String {
        String((account?.name ?? "A").prefix(1)).uppercased()
    }

    private var accountName: String {
        let name = (account?.name ?? "").trimmingCharacters(in: .whitespaces)
        return name.isEmpty ? "Administrador" : name
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            header
            Rectangle()
                .fill(Palette.separator)
                .frame(height: 0.5)
                .padding(.horizontal, 20)
                .accessibilityHidden(true)
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    ForEach(AppSection.adminGroups, id: \.label) { group in
                        groupView(group.label, items: group.items)
                    }
                }
                .padding(.horizontal, 10)
                .padding(.vertical, 16)
            }
            .scrollIndicators(.hidden)
            footer
        }
        .frame(maxHeight: .infinity, alignment: .top)
        .background(Palette.background)
        .overlay(alignment: .trailing) {
            Rectangle().fill(Palette.separator).frame(width: 0.5).accessibilityHidden(true)
        }
        .ignoresSafeArea(edges: .bottom)
    }

    // MARK: - Cabecera

    private var header: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack(spacing: 12) {
                brand
                Spacer(minLength: 8)
                Button {
                    Haptics.tap()
                    onClose()
                } label: {
                    Image(systemName: "xmark")
                        .font(.inter(size: 13, weight: .bold))
                        .foregroundStyle(Palette.foreground)
                        .frame(width: 32, height: 32)
                        .background(Palette.secondary, in: Circle())
                        .frame(width: 44, height: 44)
                        .contentShape(Circle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Cerrar menú")
                .accessibilityHint("Vuelve a la sección que estabas viendo")
            }
            accountCard
        }
        .padding(.horizontal, 20)
        .padding(.top, 12)
        .padding(.bottom, 16)
    }

    private var brand: some View {
        HStack(spacing: 10) {
            Image(systemName: "square.grid.2x2.fill")
                .font(.inter(size: 15, weight: .semibold))
                .foregroundStyle(Palette.gold)
                .frame(width: 32, height: 32)
                .background(Palette.gold.opacity(0.15), in: RoundedRectangle(cornerRadius: 9, style: .continuous))
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 0) {
                Text("Autopilot").font(.apHeadline).lineLimit(1)
                Text("ADMIN")
                    .font(.apCaption.weight(.semibold))
                    .tracking(1.0)
                    .foregroundStyle(Palette.gold)
            }
            Spacer(minLength: 0)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Autopilot, administración")
        .accessibilityAddTraits(.isHeader)
    }

    private var accountCard: some View {
        HStack(spacing: 12) {
            ZStack {
                Circle().fill(Palette.secondary)
                Text(initial)
                    .font(.apSubhead.weight(.semibold))
                    .foregroundStyle(Palette.gold)
                if let a = account?.avatar, let u = URL(string: a) {
                    CachedAsyncImage(url: u) { $0.resizable().scaledToFill() } placeholder: { Color.clear }
                }
            }
            .frame(width: 44, height: 44)
            .clipShape(Circle())
            .overlay(Circle().strokeBorder(Palette.gold.opacity(0.45), lineWidth: 1.5))
            .accessibilityHidden(true)

            VStack(alignment: .leading, spacing: 1) {
                Text(accountName)
                    .font(.apBody.weight(.semibold))
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
                Text(account?.email ?? "Panel de administración")
                    .font(.apFootnote)
                    .foregroundStyle(Palette.muted)
                    .lineLimit(1)
                    .truncationMode(.middle)
            }
            Spacer(minLength: 0)
        }
        .padding(12)
        .background(Palette.card, in: RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Cuenta de administración: \(accountName)")
        .accessibilityValue(account?.email ?? "")
    }

    // MARK: - Grupos

    private func groupView(_ label: String, items: [AppSection]) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label.uppercased())
                .font(.apCaption.weight(.semibold))
                .tracking(0.8)
                .foregroundStyle(Palette.muted)
                .padding(.horizontal, 12)
                .accessibilityAddTraits(.isHeader)
            VStack(alignment: .leading, spacing: 2) {
                ForEach(items) { item in
                    row(item)
                }
            }
        }
    }

    private func row(_ item: AppSection) -> some View {
        let active = item == selection
        return Button {
            if active { Haptics.tap() } else { Haptics.selection() }
            // Con «Reducir movimiento» el cambio de sección es instantáneo, sin deslizamientos.
            if reduceMotion {
                selection = item
            } else {
                withAnimation(.easeOut(duration: 0.18)) { selection = item }
            }
            onClose()
        } label: {
            HStack(spacing: 12) {
                Image(systemName: item.symbol)
                    .font(.inter(size: 15, weight: .semibold))
                    .frame(width: 22, alignment: .center)
                Text(item.title)
                    .font(.apBody.weight(active ? .semibold : .regular))
                    .lineLimit(2)
                    .multilineTextAlignment(.leading)
                Spacer(minLength: 4)
                if active {
                    Circle()
                        .fill(Palette.gold)
                        .frame(width: 6, height: 6)
                        .transition(reduceMotion ? .opacity : .scale)
                }
            }
            .foregroundStyle(active ? Palette.gold : Palette.foreground)
            .padding(.horizontal, 12)
            .frame(minHeight: 46)
            .background(
                active ? Palette.gold.opacity(0.14) : Color.clear,
                in: RoundedRectangle(cornerRadius: 12, style: .continuous)
            )
            .contentShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(item.title)
        .accessibilityHint(active ? "Sección actual" : "Abre la sección \(item.title)")
        .accessibilityAddTraits(active ? .isSelected : [])
    }

    // MARK: - Pie de cuenta

    private var footer: some View {
        VStack(spacing: 0) {
            Rectangle()
                .fill(Palette.separator)
                .frame(height: 0.5)
                .accessibilityHidden(true)
            action("Cambiar de cuenta", icon: "arrow.left.arrow.right",
                   hint: "Abre el selector de cuentas de este dispositivo") {
                onClose()
                session.showPicker = true
            }
            action("Cerrar sesión", icon: "rectangle.portrait.and.arrow.right", destructive: true,
                   hint: "Cierra la sesión de este dispositivo", separator: true) {
                onClose()
                Task { await session.signOut() }
            }
        }
        .padding(.bottom, 28)
    }

    private func action(_ title: String, icon: String, destructive: Bool = false, hint: String,
                        separator: Bool = false, run: @escaping () -> Void) -> some View {
        Button {
            Haptics.selection()
            run()
        } label: {
            HStack(spacing: 12) {
                Image(systemName: icon)
                    .font(.inter(size: 15, weight: .semibold))
                    .frame(width: 22, alignment: .center)
                Text(title).font(.apBody).lineLimit(1).minimumScaleFactor(0.85)
                Spacer(minLength: 0)
            }
            .foregroundStyle(destructive ? Palette.destructive : Palette.foreground)
            .padding(.horizontal, 22)
            .frame(minHeight: 48)
            .overlay(alignment: .top) {
                // Separador alineado con el texto (icono de 22 + 12 de espacio), no a sangre.
                if separator {
                    Rectangle().fill(Palette.separator).frame(height: 0.5).padding(.leading, 22 + 22 + 12)
                }
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(title)
        .accessibilityHint(hint)
    }
}

#endif
