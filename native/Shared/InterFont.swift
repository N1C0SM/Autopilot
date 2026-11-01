import SwiftUI
import CoreText

/// Inter, la misma fuente variable que la web (`@fontsource-variable/inter`), registrada al arrancar.
enum InterFont {
    // PostScript name de InterVariable.ttf (variable font: el nombre base es «Inter»).
    static let name: String = "Inter"

    static func register() {
        guard let url = Bundle.main.url(forResource: "InterVariable", withExtension: "ttf") else {
            print("[fonts] InterVariable.ttf no está en el bundle")
            return
        }
        var error: Unmanaged<CFError>?
        let ok = CTFontManagerRegisterFontsForURL(url as CFURL, .process, &error)
        if !ok {
            if let e = error?.takeRetainedValue() { print("[fonts] Inter no se pudo registrar: \(e)") }
            else { print("[fonts] Inter no se pudo registrar (motivo desconocido)") }
        }
    }
}

/// Escala tipográfica de la web (`type-*`) en Inter; crece con el tamaño de texto (Dynamic Type).
extension Font {
    static func inter(size: CGFloat, weight: Font.Weight = .regular, design: Font.Design = .default, relativeTo style: Font.TextStyle = .body) -> Font {
        if design == .monospaced { return .system(size: size, weight: weight, design: .monospaced) }
        return Font.custom(InterFont.name, size: size, relativeTo: style).weight(weight)
    }
    static func inter(_ style: Font.TextStyle, design: Font.Design = .default) -> Font {
        let size: CGFloat = switch style {
        case .largeTitle: 34
        case .title: 28
        case .title2: 22
        case .title3: 20
        case .headline, .body: 17
        case .callout: 16
        case .subheadline: 15
        case .footnote: 13
        case .caption: 12
        default: 11
        }
        if design == .monospaced { return .system(style, design: .monospaced) }
        return inter(size: size, weight: style == .headline ? .semibold : .regular, relativeTo: style)
    }
}

/// Firma de marca: cifras protagonistas en Big Shoulders (igual que `.type-figure` en la web).
enum FigureFont {
    // El nombre de familia es «Big Shoulders», pero `Font.custom` necesita el nombre
    // PostScript, que es «BigShoulders-Bold». Por eso antes las cifras salían en Inter.
    static let name: String = "BigShoulders-Bold"

    static func register() {
        guard let url = Bundle.main.url(forResource: "BigShoulders-Bold", withExtension: "ttf") else {
            print("[fonts] BigShoulders-Bold.ttf no está en el bundle")
            return
        }
        var error: Unmanaged<CFError>?
        let ok = CTFontManagerRegisterFontsForURL(url as CFURL, .process, &error)
        if !ok {
            if let e = error?.takeRetainedValue() { print("[fonts] BigShoulders no se pudo registrar: \(e)") }
            else { print("[fonts] BigShoulders no se pudo registrar (motivo desconocido)") }
        }
    }
}

extension Font {
    static func figure(size: CGFloat, relativeTo style: Font.TextStyle = .largeTitle) -> Font {
        Font.custom(FigureFont.name, size: size, relativeTo: style).weight(.heavy).monospacedDigit()
    }
}
