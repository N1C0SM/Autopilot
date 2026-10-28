import SwiftUI
#if os(iOS)
import UIKit
#endif

/// Respuesta táctil del sistema. En el Mac no hace nada.
enum Haptics {
    static func tap() {
        #if os(iOS)
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
        #endif
    }
    static func selection() {
        #if os(iOS)
        UISelectionFeedbackGenerator().selectionChanged()
        #endif
    }
    /// Firma de Autopilot («Ritmo» 2-1-2): fuerte, suave, fuerte. Igual que `hapticSignature` en la web.
    static func signature() {
        #if os(iOS)
        let heavy = UIImpactFeedbackGenerator(style: .heavy), light = UIImpactFeedbackGenerator(style: .light)
        heavy.impactOccurred()
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.09) { light.impactOccurred() }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.18) { heavy.impactOccurred() }
        #endif
    }
    static func success() {
        #if os(iOS)
        UINotificationFeedbackGenerator().notificationOccurred(.success)
        #endif
    }
    static func warning() {
        #if os(iOS)
        UINotificationFeedbackGenerator().notificationOccurred(.warning)
        #endif
    }
    static func error() {
        #if os(iOS)
        UINotificationFeedbackGenerator().notificationOccurred(.error)
        #endif
    }
}
