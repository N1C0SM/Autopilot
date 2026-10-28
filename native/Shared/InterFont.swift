import SwiftUI
import CoreText

/// Inter, la misma fuente variable que la web (`@fontsource-variable/inter`), registrada al arrancar.
enum InterFont {
    static let name: String = {
        if let url = Bundle.main.url(forResource: "InterVariable", withExtension: "ttf") {
            CTFontManagerRegisterFontsForURL(url as CFURL, .process, nil)
        }
        return "Inter"
    }()
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
    static let name: String = {
        if let url = Bundle.main.url(forResource: "BigShoulders-Bold", withExtension: "ttf") {
            CTFontManagerRegisterFontsForURL(url as CFURL, .process, nil)
        }
        return "Big Shoulders"
    }()
}

extension Font {
    static func figure(size: CGFloat, relativeTo style: Font.TextStyle = .largeTitle) -> Font {
        Font.custom(FigureFont.name, size: size, relativeTo: style).weight(.heavy).monospacedDigit()
    }
}
