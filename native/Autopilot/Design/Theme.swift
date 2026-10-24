import SwiftUI

/// Lenguaje de diseño de Autopilot (.claude/design): negro, dorado contenido,
/// tarjetas sin borde de 22/28 pt, botones y campos en píldora, cifras grandes redondeadas.
enum Palette {
    static let background = Color.black
    static let foreground = Color.white
    static let card = Color(red: 0.107, green: 0.107, blue: 0.113)
    static let secondary = Color(red: 0.177, green: 0.177, blue: 0.183)
    static let muted = Color(red: 0.67, green: 0.67, blue: 0.69)
    static let gold = Color(red: 0.844, green: 0.706, blue: 0.356)
    static let destructive = Color(red: 1.0, green: 0.259, blue: 0.22)
    /// --success 135 64% 50%
    static let success = Color(red: 0.18, green: 0.82, blue: 0.34)
    static let separator = Color.white.opacity(0.12)
    /// --accent 240 2% 23% (segmentado activo, pulsado)
    static let accent = Color(red: 0.225, green: 0.225, blue: 0.235)
    /// --border 240 2% 22%
    static let border = Color(red: 0.216, green: 0.216, blue: 0.224)
}

enum Radius {
    static let card: CGFloat = 22
    static let hero: CGFloat = 28
}

/// Escala tipográfica de la web (`type-*`) sobre los estilos del sistema,
/// así crece con el tamaño de texto de Ajustes (Dynamic Type).
extension Font {
    static let apLargeTitle = Font.system(.largeTitle).weight(.bold)
    static let apTitle1 = Font.system(.title).weight(.bold)
    static let apTitle2 = Font.system(.title2).weight(.bold)
    static let apTitle3 = Font.system(.title3).weight(.bold)
    static let apHeadline = Font.headline
    static let apBody = Font.body
    static let apSubhead = Font.subheadline
    static let apFootnote = Font.footnote
    static let apCaption = Font.caption2
    /// Cifra protagonista (34 pt, redondeada, crece con Dynamic Type).
    static let apFigure = Font.system(.largeTitle).weight(.bold).monospacedDigit()
    static let apFigureSmall = Font.system(.title).weight(.bold).monospacedDigit()
}

/// Tarjeta del sistema: sin borde, 22 pt.
struct Card<Content: View>: View {
    var padding: CGFloat = 18
    var radius: CGFloat = Radius.card
    @ViewBuilder var content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 12) { content }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(padding)
            .background(Palette.card, in: RoundedRectangle(cornerRadius: radius, style: .continuous))
    }
}

/// Botón en píldora. `.primary` es la acción dorada (una por pantalla).
struct PillButtonStyle: ButtonStyle {
    enum Kind { case primary, secondary, destructive }
    var kind: Kind = .primary
    var height: CGFloat = 50
    @Environment(\.isEnabled) private var isEnabled

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.apHeadline)
            .frame(maxWidth: .infinity, minHeight: height)
            .padding(.horizontal, 24)
            .foregroundStyle(kind == .primary ? Color.black : Palette.foreground)
            .background(kind == .primary ? Palette.gold : (kind == .destructive ? Palette.destructive : Palette.secondary), in: Capsule())
            .opacity(isEnabled ? (configuration.isPressed ? 0.75 : 1) : 0.4)
            .contentShape(Capsule())
    }
}

extension ButtonStyle where Self == PillButtonStyle {
    static var pill: PillButtonStyle { PillButtonStyle() }
    static var pillSecondary: PillButtonStyle { PillButtonStyle(kind: .secondary) }
    static var pillDestructive: PillButtonStyle { PillButtonStyle(kind: .destructive) }
}

/// Campo en píldora con etiqueta accesible.
struct PillField: View {
    let label: String
    @Binding var text: String
    var secure = false
    var contentType: TextContentTypeCompat = .none

    var body: some View {
        Group {
            if secure {
                SecureField(label, text: $text)
            } else {
                TextField(label, text: $text)
            }
        }
        .textFieldStyle(.plain)
        .font(.apBody)
        .textContentTypeCompat(contentType)
        .padding(.horizontal, 20)
        .frame(minHeight: 52)
        .background(Palette.secondary, in: Capsule())
        .accessibilityLabel(label)
    }
}

enum TextContentTypeCompat { case none, username, password, email }

extension View {
    @ViewBuilder func textContentTypeCompat(_ type: TextContentTypeCompat) -> some View {
        #if os(iOS)
        switch type {
        case .username: self.textContentType(.username).textInputAutocapitalization(.never).autocorrectionDisabled()
        case .password: self.textContentType(.password)
        case .email: self.textContentType(.emailAddress).keyboardType(.emailAddress).textInputAutocapitalization(.never).autocorrectionDisabled()
        case .none: self
        }
        #else
        switch type {
        case .username: self.textContentType(.username).autocorrectionDisabled()
        case .password: self.textContentType(.password)
        case .email: self.textContentType(.username).autocorrectionDisabled()
        case .none: self
        }
        #endif
    }

    /// Fondo negro de pantalla completa.
    func screenBackground() -> some View {
        background(Palette.background.ignoresSafeArea())
    }
}

/// Título de sección único (como `SectionHeader` en la web).
struct SectionTitle: View {
    let title: String
    var hint: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(title).font(.apTitle3).accessibilityAddTraits(.isHeader)
            if let hint { Text(hint).font(.apFootnote).foregroundStyle(Palette.muted) }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

/// Cifra con etiqueta y contexto (KPI).
struct FigureTile: View {
    let label: String
    let value: String
    var hint: String?
    var accent = false

    var body: some View {
        Card(padding: 16) {
            VStack(alignment: .leading, spacing: 2) {
                Text(label).font(.apFootnote).foregroundStyle(Palette.muted).lineLimit(1)
                Text(value).font(.apFigureSmall).foregroundStyle(accent ? Palette.gold : Palette.foreground)
                    .lineLimit(1).minimumScaleFactor(0.6)
                if let hint { Text(hint).font(.apFootnote).foregroundStyle(Palette.muted).lineLimit(1) }
            }
        }
        .accessibilityElement(children: .combine)
    }
}

/// Estado vacío común (como `EmptyState`).
struct EmptyStateView: View {
    let symbol: String
    let title: String
    var message: String?

    var body: some View {
        VStack(spacing: 10) {
            Image(systemName: symbol).font(.system(size: 36, weight: .semibold)).foregroundStyle(Palette.gold)
                .accessibilityHidden(true)
            Text(title).font(.apHeadline)
            if let message { Text(message).font(.apSubhead).foregroundStyle(Palette.muted).multilineTextAlignment(.center) }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 40)
        .accessibilityElement(children: .combine)
    }
}

/// Números en español: 49,6 · 2.366
enum NumberText {
    static func decimal(_ value: Double, digits: Int = 1) -> String {
        value.formatted(.number.precision(.fractionLength(digits)).locale(Locale(identifier: "es_ES")))
    }
    static func integer(_ value: Int) -> String {
        value.formatted(.number.locale(Locale(identifier: "es_ES")))
    }
}
