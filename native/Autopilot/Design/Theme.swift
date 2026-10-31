import SwiftUI
#if os(iOS)
import UIKit
#elseif os(macOS)
import AppKit
#endif

/// Lenguaje de diseño de Autopilot (.claude/design): negro, dorado contenido,
/// tarjetas sin borde de 22/28 pt, botones y campos en píldora, cifras grandes redondeadas.
enum Palette {
    static let background = Color.black
    static let foreground = Color.white
    static let card = Color(red: 0.107, green: 0.107, blue: 0.113)
    static let secondary = Color(red: 0.177, green: 0.177, blue: 0.183)
    /// Texto secundario. Contraste medido (WCAG): 7,5:1 sobre `card`, 9,2:1 sobre negro y
    /// 6,0:1 sobre `secondary`, así que ya cumple AA/AAA para texto normal; no hace falta
    /// subir la luminosidad. Los grises con opacidad solo se usan en adornos (chevrones, iconos).
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

/// Preferencias de accesibilidad del sistema leídas de forma síncrona: `@Environment` solo
/// funciona dentro de una vista, y los `ButtonStyle` o los ayudantes estáticos no son vistas.
enum A11y {
    /// «Reducir movimiento»: las animaciones no esenciales deben quedar en cambio instantáneo.
    static var reduceMotion: Bool {
        #if os(iOS)
        UIAccessibility.isReduceMotionEnabled
        #elseif os(macOS)
        NSWorkspace.shared.accessibilityDisplayShouldReduceMotion
        #else
        false
        #endif
    }

    /// VoiceOver activo: no se roba el foco (teclado, campos) al abrir una pantalla.
    static var voiceOver: Bool {
        #if os(iOS)
        UIAccessibility.isVoiceOverRunning
        #elseif os(macOS)
        NSWorkspace.shared.isVoiceOverEnabled
        #else
        false
        #endif
    }

    /// Anuncio para VoiceOver: estados que cambian sin mover el foco (error, aviso, éxito).
    static func announce(_ text: String) {
        AccessibilityNotification.Announcement(text).post()
    }
}

extension View {
    /// Anima solo si el usuario no ha pedido reducir el movimiento; con la preferencia activa el
    /// cambio de estado es instantáneo (las transiciones alternativas usan `.opacity`).
    @ViewBuilder func apAnimation<V: Equatable>(_ animation: Animation?, value: V, reduceMotion: Bool) -> some View {
        self.animation(reduceMotion ? nil : animation, value: value)
    }
}


/// Escala tipográfica de la web (`type-*`) en Inter; crece con el tamaño de texto (Dynamic Type).
extension Font {
    static let apLargeTitle = inter(size: 34, weight: .bold, relativeTo: .largeTitle)
    static let apTitle1 = inter(size: 28, weight: .bold, relativeTo: .title)
    static let apTitle2 = inter(size: 22, weight: .bold, relativeTo: .title2)
    static let apTitle3 = inter(size: 20, weight: .bold, relativeTo: .title3)
    static let apHeadline = inter(size: 17, weight: .semibold, relativeTo: .headline)
    static let apBody = inter(size: 17, relativeTo: .body)
    static let apSubhead = inter(size: 15, relativeTo: .subheadline)
    static let apFootnote = inter(size: 13, relativeTo: .footnote)
    static let apCaption = inter(size: 11, relativeTo: .caption2)
    static let apFigure = inter(size: 34, weight: .bold, relativeTo: .largeTitle).monospacedDigit()
    static let apFigureSmall = inter(size: 28, weight: .bold, relativeTo: .title).monospacedDigit()
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
            // Microinteracción: la píldora se hunde un punto al pulsarla. Con «Reducir
            // movimiento» solo cambia la opacidad (que ya es instantánea, sin animación).
            .scaleEffect(configuration.isPressed && !A11y.reduceMotion ? 0.97 : 1)
            .animation(A11y.reduceMotion ? nil : .spring(response: 0.22, dampingFraction: 0.72), value: configuration.isPressed)
            .contentShape(Capsule())
    }
}

extension ButtonStyle where Self == PillButtonStyle {
    static var pill: PillButtonStyle { PillButtonStyle() }
    static var pillSecondary: PillButtonStyle { PillButtonStyle(kind: .secondary) }
    static var pillDestructive: PillButtonStyle { PillButtonStyle(kind: .destructive) }
}

/// Botón-tarjeta: además de abrir, se hunde de forma imperceptible al pulsarlo. Es el feedback
/// táctil que espera cualquiera al tocar una tarjeta grande (Inicio, Ajustes). Con «Reducir
/// movimiento» solo cambia la opacidad.
struct PressableCardStyle: ButtonStyle {
    var scale: CGFloat = 0.985
    @Environment(\.isEnabled) private var isEnabled

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed && !A11y.reduceMotion ? scale : 1)
            .opacity(isEnabled ? (configuration.isPressed ? 0.93 : 1) : 0.4)
            .animation(A11y.reduceMotion ? nil : .spring(response: 0.2, dampingFraction: 0.78), value: configuration.isPressed)
    }
}

extension ButtonStyle where Self == PressableCardStyle {
    static var pressableCard: PressableCardStyle { PressableCardStyle() }
    static func pressableCard(scale: CGFloat) -> PressableCardStyle { PressableCardStyle(scale: scale) }
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
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        Card(padding: 16) {
            VStack(alignment: .leading, spacing: 2) {
                Text(label).font(.apFootnote).foregroundStyle(Palette.muted)
                    .lineLimit(1).minimumScaleFactor(0.75)
                Text(value).font(.apFigureSmall).foregroundStyle(accent ? Palette.gold : Palette.foreground)
                    // Los dígitos ruedan al cambiar la cifra (sin animación con Reducir movimiento).
                    .contentTransition(.numericText())
                    .lineLimit(1).minimumScaleFactor(0.6)
                if let hint {
                    Text(hint).font(.apFootnote).foregroundStyle(Palette.muted)
                        .lineLimit(1).minimumScaleFactor(0.75)
                }
            }
        }
        .accessibilityElement(children: .combine)
        .apAnimation(.snappy(duration: 0.25), value: value, reduceMotion: reduceMotion)
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
            Text(title).font(.apHeadline).multilineTextAlignment(.center).accessibilityAddTraits(.isHeader)
            if let message { Text(message).font(.apSubhead).foregroundStyle(Palette.muted).multilineTextAlignment(.center) }
        }
        // Margen lateral: dentro de una tarjeta el texto no toca los bordes.
        .padding(.horizontal, 24)
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

/// Interruptor a la derecha de su texto, como las filas de la web (en Mac el `.switch` se pega al texto).
struct TrailingSwitchStyle: ToggleStyle {
    func makeBody(configuration: Configuration) -> some View {
        HStack(spacing: 12) {
            configuration.label.frame(maxWidth: .infinity, alignment: .leading)
            Toggle("", isOn: configuration.$isOn).toggleStyle(.switch).labelsHidden()
        }
    }
}
