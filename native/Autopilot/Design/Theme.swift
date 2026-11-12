import SwiftUI
#if os(iOS)
import UIKit
#elseif os(macOS)
import AppKit
#endif

/// Lenguaje de diseño de Autopilot (.claude/design): negro, dorado contenido,
/// tarjetas sin borde de 22/28 pt, botones y campos en píldora, cifras grandes redondeadas.
enum Palette {
    /// Color dinámico: oscuro en dark mode, claro en light mode (UIKit en iPhone, AppKit en Mac).
    private static func dynamic(dark: (CGFloat, CGFloat, CGFloat), light: (CGFloat, CGFloat, CGFloat)) -> Color {
        dynamic(dark: (dark.0, dark.1, dark.2, 1), light: (light.0, light.1, light.2, 1))
    }

    private static func dynamic(dark: (CGFloat, CGFloat, CGFloat, CGFloat), light: (CGFloat, CGFloat, CGFloat, CGFloat)) -> Color {
        #if os(macOS)
        Color(NSColor(name: nil) { appearance in
            let (r, g, b, a) = appearance.bestMatch(from: [.darkAqua, .aqua]) == .darkAqua ? dark : light
            return NSColor(srgbRed: r, green: g, blue: b, alpha: a)
        })
        #else
        Color(UIColor { trait in
            let (r, g, b, a) = trait.userInterfaceStyle == .dark ? dark : light
            return UIColor(red: r, green: g, blue: b, alpha: a)
        })
        #endif
    }

    /// --background
    static let background = dynamic(dark: (0.042, 0.040, 0.038), light: (0.98, 0.98, 0.99))
    /// --foreground
    static let foreground = dynamic(dark: (1, 1, 1), light: (0.06, 0.06, 0.07))
    /// --card
    static let card = dynamic(dark: (0.067, 0.067, 0.074), light: (1, 1, 1))
    /// --secondary
    static let secondary = dynamic(dark: (0.152, 0.152, 0.168), light: (0.93, 0.93, 0.95))
    /// --muted-foreground
    static let muted = dynamic(dark: (0.657, 0.657, 0.683), light: (0.42, 0.42, 0.46))
    /// Dorado de marca
    static let gold = dynamic(dark: (0.847, 0.698, 0.369), light: (0.72, 0.56, 0.22))
    static let destructive = Color(red: 1.0, green: 0.271, blue: 0.227)
    /// --success
    static let success = Color(red: 0.18, green: 0.82, blue: 0.34)
    static let separator = dynamic(dark: (0.144, 0.144, 0.156), light: (0.88, 0.88, 0.90))
    /// --accent
    static let accent = dynamic(dark: (0.199, 0.199, 0.221), light: (0.88, 0.88, 0.90))
    /// --border
    static let border = dynamic(dark: (0.144, 0.144, 0.156), light: (0.88, 0.88, 0.90))

    // Profundidad (tokens `--surface-*`, `--gold-sheen` y `--chrome-*` de la web).
    /// Luz que baja desde arriba en tarjetas y controles.
    static let sheen = dynamic(dark: (1, 1, 1, 0.055), light: (1, 1, 1, 0))
    /// Filo de luz de 1 pt en el borde superior.
    static let edge = dynamic(dark: (1, 1, 1, 0.085), light: (1, 1, 1, 0.7))
    /// Sombra difusa bajo las superficies.
    static let shadow = dynamic(dark: (0, 0, 0, 0.55), light: (0.06, 0.06, 0.08, 0.10))
    /// Extremos del degradado dorado (`--gold-sheen`), con `gold` en el centro.
    static let goldLight = dynamic(dark: (0.930, 0.806, 0.490), light: (0.704, 0.537, 0.176))
    static let goldDeep = dynamic(dark: (0.770, 0.572, 0.230), light: (0.482, 0.334, 0.078))
    /// Barra de pestañas flotante (`--chrome-sheen`).
    static let chromeTop = dynamic(dark: (0.123, 0.123, 0.137, 0.92), light: (1, 1, 1, 0.94))
    static let chromeBottom = dynamic(dark: (0.067, 0.067, 0.074, 0.92), light: (0.958, 0.958, 0.962, 0.94))
}

/// Fondo de tarjeta con profundidad, como `.bg-card` en la web: luz arriba que se apaga en
/// 140 pt, filo de luz arriba y sombra difusa. Úsalo con `.surface(radio)`.
struct SurfaceBackground<S: InsettableShape>: View {
    let shape: S
    var fill: Color = Palette.card

    var body: some View {
        shape.fill(fill)
            .overlay {
                GeometryReader { g in
                    shape.fill(LinearGradient(stops: [
                        .init(color: Palette.sheen, location: 0),
                        .init(color: Palette.sheen.opacity(0), location: min(1, 140 / max(g.size.height, 1))),
                    ], startPoint: .top, endPoint: .bottom))
                }
            }
            .overlay(shape.strokeBorder(LinearGradient(colors: [Palette.edge, Palette.edge.opacity(0)], startPoint: .top, endPoint: .center), lineWidth: 1))
            .shadow(color: Palette.shadow, radius: 14, y: 8)
    }
}

/// Relleno dorado con relieve (`.btn-gold` en la web): degradado del dorado, filo de luz y halo.
struct GoldFill<S: InsettableShape>: View {
    let shape: S

    var body: some View {
        shape.fill(LinearGradient(colors: [Palette.goldLight, Palette.gold, Palette.goldDeep], startPoint: .top, endPoint: .bottom))
            .overlay(shape.strokeBorder(LinearGradient(colors: [.white.opacity(0.45), .white.opacity(0)], startPoint: .top, endPoint: .center), lineWidth: 1))
            .shadow(color: Palette.gold.opacity(0.32), radius: 10, y: 6)
    }
}

/// Control elevado (`.btn-raised` en la web): luz arriba, filo y sombra corta.
struct RaisedFill<S: InsettableShape>: View {
    let shape: S
    var fill: Color = Palette.secondary

    var body: some View {
        shape.fill(fill)
            .overlay(shape.fill(LinearGradient(colors: [Palette.sheen, Palette.sheen.opacity(0)], startPoint: .top, endPoint: .bottom)))
            .overlay(shape.strokeBorder(LinearGradient(colors: [Palette.edge, Palette.edge.opacity(0)], startPoint: .top, endPoint: .center), lineWidth: 1))
            .shadow(color: Palette.shadow.opacity(0.8), radius: 6, y: 4)
    }
}

extension View {
    /// Tarjeta con profundidad (sustituye a `.background(Palette.card, in: RoundedRectangle(…))`).
    func surface(_ radius: CGFloat = Radius.card) -> some View {
        background(SurfaceBackground(shape: RoundedRectangle(cornerRadius: radius, style: .continuous)))
    }
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
    static let apCaption = inter(size: 12, relativeTo: .caption2)
    static let apFigure = inter(size: 34, weight: .bold, relativeTo: .largeTitle).monospacedDigit()
    static let apFigureSmall = inter(size: 28, weight: .bold, relativeTo: .title).monospacedDigit()
}

/// Tarjeta del sistema: sin borde, 22 pt, con la profundidad de `.surface`.
struct Card<Content: View>: View {
    var padding: CGFloat = 18
    var radius: CGFloat = Radius.card
    @ViewBuilder var content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 12) { content }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(padding)
            .surface(radius)
    }
}

/// Botón en píldora. `.primary` es la acción dorada (una por pantalla).
struct PillButtonStyle: ButtonStyle {
    enum Kind { case primary, secondary, outline, destructive }
    var kind: Kind = .primary
    var height: CGFloat = 50
    @Environment(\.isEnabled) private var isEnabled

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.apHeadline)
            .frame(maxWidth: .infinity, minHeight: height)
            .padding(.horizontal, 24)
            .foregroundStyle(kind == .primary ? Palette.background : Palette.foreground)
            .background { fill }
            // Contorno claro de la portada («Ver demo», «Iniciar sesión»): acción secundaria sin relleno.
            .overlay { if kind == .outline { Capsule().strokeBorder(Palette.foreground.opacity(0.3), lineWidth: 1) } }
            .opacity(isEnabled ? (configuration.isPressed ? 0.75 : 1) : 0.4)
            // Microinteracción: la píldora se hunde un punto al pulsarla. Con «Reducir
            // movimiento» solo cambia la opacidad (que ya es instantánea, sin animación).
            .scaleEffect(configuration.isPressed && !A11y.reduceMotion ? 0.97 : 1)
            .animation(A11y.reduceMotion ? nil : .spring(response: 0.22, dampingFraction: 0.72), value: configuration.isPressed)
            .contentShape(Capsule())
    }

    /// Dorado y secundario con relieve, como `.btn-gold` y `.btn-raised` en la web.
    @ViewBuilder private var fill: some View {
        switch kind {
        case .primary: GoldFill(shape: Capsule())
        case .secondary: RaisedFill(shape: Capsule())
        case .destructive: Capsule().fill(Palette.destructive)
        case .outline: Color.clear
        }
    }
}

extension ButtonStyle where Self == PillButtonStyle {
    static var pill: PillButtonStyle { PillButtonStyle() }
    static var pillSecondary: PillButtonStyle { PillButtonStyle(kind: .secondary) }
    static var pillOutline: PillButtonStyle { PillButtonStyle(kind: .outline) }
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

/// Campo en píldora con etiqueta accesible. Con `icon` lleva un SF Symbol gris a la izquierda y, si es `secure`, un ojo para mostrar la contraseña: igual que `AuthFieldRow` en la web.
struct PillField: View {
    let label: String
    @Binding var text: String
    var secure = false
    var contentType: TextContentTypeCompat = .none
    var icon: String? = nil
    @State private var reveal = false

    var body: some View {
        HStack(spacing: 12) {
            if let icon {
                Image(systemName: icon)
                    .font(.system(size: 17, weight: .regular))
                    .foregroundStyle(Palette.muted)
                    .frame(width: 22)
                    .accessibilityHidden(true)
            }
            Group {
                if secure && !reveal {
                    SecureField(label, text: $text)
                } else {
                    TextField(label, text: $text)
                }
            }
            .textFieldStyle(.plain)
            .font(.apBody)
            .textContentTypeCompat(contentType)
            .accessibilityLabel(label)
            if secure {
                Button { Haptics.selection(); reveal.toggle() } label: {
                    Image(systemName: reveal ? "eye.slash" : "eye")
                        .font(.system(size: 17))
                        .foregroundStyle(Palette.muted)
                        .frame(width: 44, height: 44)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel(reveal ? "Ocultar contraseña" : "Mostrar contraseña")
            }
        }
        .padding(.leading, 20)
        .padding(.trailing, secure ? 6 : 20)
        .frame(minHeight: icon == nil ? 52 : 56)
        .background(Palette.secondary, in: Capsule())
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
