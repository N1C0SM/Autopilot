import SwiftUI
#if os(iOS)
import UIKit
import CoreText
#endif

@main
struct AutopilotApp: App {
    @StateObject private var session = SessionModel()
    @StateObject private var accounts = AccountStore.shared

    init() {
        // Antes que cualquier vista: la barra de navegación ya sale en Inter.
        InterFont.register()
        FigureFont.register()
        #if os(iOS)
        NavigationBarStyle.apply()
        #endif
    }

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(session)
                .environmentObject(accounts)
                .preferredColorScheme(.dark)
                .tint(Palette.gold)
                .toggleStyle(TrailingSwitchStyle())
                .task { await session.start() }
        }
        #if os(macOS)
        .defaultSize(width: 1200, height: 820)
        .commands { AppCommands(session: session) }
        #endif
    }
}

#if os(macOS)
/// Menús propios del Mac, con atajos de teclado. Las secciones de «Ir» siguen el rol de la cuenta.
struct AppCommands: Commands {
    @ObservedObject var session: SessionModel

    private var sections: [AppSection] {
        switch session.role {
        case .admin: AppSection.adminGroups.flatMap(\.items)
        case .trainer: AppSection.trainerSections
        case .user: AppSection.userSections
        }
    }

    var body: some Commands {
        CommandGroup(replacing: .appInfo) {
            Button("Acerca de Autopilot") {
                NSApplication.shared.orderFrontStandardAboutPanel(options: [
                    .applicationName: "Autopilot",
                    .credits: NSAttributedString(string: "Tu plan de entrenamiento y nutrición, en piloto automático."),
                ])
            }
        }
        CommandGroup(replacing: .newItem) {}
        SidebarCommands()
        ToolbarCommands()

        CommandGroup(after: .sidebar) {
            Button("Actualizar") { post(.refreshSection) }
                .keyboardShortcut("r", modifiers: .command)
        }

        CommandMenu("Ir") {
            if session.role == .admin {
                ForEach(AppSection.adminGroups, id: \.label) { group in
                    Section(group.label) {
                        ForEach(group.items) { item in sectionButton(item) }
                    }
                }
            } else {
                ForEach(sections) { item in sectionButton(item) }
            }
        }

        CommandMenu("Entreno") {
            Button("Empezar entreno de hoy") { post(.startTodayWorkout) }
                .keyboardShortcut("e", modifiers: [.command, .shift])
                .disabled(session.role != .user)
            Button("Terminar entreno") { post(.finishWorkout) }
                .keyboardShortcut(.return, modifiers: .command)
            Divider()
            Button("Saltar descanso") { post(.skipRest) }
                .keyboardShortcut("s", modifiers: [.command, .option])
            Button("Sumar 15 s al descanso") { post(.restPlus) }
                .keyboardShortcut("+", modifiers: [.command, .option])
            Button("Restar 15 s al descanso") { post(.restMinus) }
                .keyboardShortcut("-", modifiers: [.command, .option])
        }

        CommandMenu("Cuenta") {
            Button("Mi cuenta") { NotificationCenter.default.post(name: .goToSection, object: session.role == .admin ? AppSection.account : AppSection.settings) }
                .keyboardShortcut(",", modifiers: [.command, .shift])
            Button("Cambiar de cuenta…") { session.showPicker = true }
                .keyboardShortcut("u", modifiers: [.command, .shift])
            Button("Añadir otra cuenta…") { session.addAnotherAccount() }
            Divider()
            Button("Cerrar sesión") { Task { await session.signOut() } }
                .keyboardShortcut("q", modifiers: [.command, .shift])
        }

        CommandGroup(replacing: .help) {
            Link("Ayuda de Autopilot", destination: URL(string: "https://autopilotplan.app/preguntas-frecuentes")!)
            Link("Abrir la web", destination: URL(string: "https://autopilotplan.app")!)
            Divider()
            Link("Privacidad", destination: URL(string: "https://autopilotplan.app/legal/privacidad")!)
            Link("Términos", destination: URL(string: "https://autopilotplan.app/legal/terminos")!)
        }
    }

    @ViewBuilder private func sectionButton(_ item: AppSection) -> some View {
        let index = sections.firstIndex(of: item) ?? 99
        if index < 9 {
            Button(item.title) { NotificationCenter.default.post(name: .goToSection, object: item) }
                .keyboardShortcut(KeyEquivalent(Character(String(index + 1))), modifiers: .command)
        } else {
            Button(item.title) { NotificationCenter.default.post(name: .goToSection, object: item) }
        }
    }

    private func post(_ name: Notification.Name) { NotificationCenter.default.post(name: name, object: nil) }
}
#endif

extension Notification.Name {
    static let goToSection = Notification.Name("autopilot.goToSection")
    static let refreshSection = Notification.Name("autopilot.refresh")
    static let startTodayWorkout = Notification.Name("autopilot.startToday")
    static let finishWorkout = Notification.Name("autopilot.finishWorkout")
    static let skipRest = Notification.Name("autopilot.skipRest")
    static let restPlus = Notification.Name("autopilot.restPlus")
    static let restMinus = Notification.Name("autopilot.restMinus")
}

#if os(iOS)
/// Barra de navegación con la tipografía de la app, como la cabecera de la web (`NavBar`): título
/// grande en Inter Bold 34 que se encoge al hacer scroll, el pequeño en Inter Semibold 17, transparente
/// arriba y con material cuando el contenido pasa por debajo (`solid`).
enum NavigationBarStyle {
    static func apply() {
        let large: [NSAttributedString.Key: Any] = [.font: inter(34, weight: 700, style: .largeTitle), .foregroundColor: UIColor.white]
        let inline: [NSAttributedString.Key: Any] = [.font: inter(17, weight: 600, style: .headline), .foregroundColor: UIColor.white]
        let standard = UINavigationBarAppearance()
        standard.configureWithDefaultBackground()
        standard.largeTitleTextAttributes = large
        standard.titleTextAttributes = inline
        let edge = UINavigationBarAppearance()
        edge.configureWithTransparentBackground()
        edge.largeTitleTextAttributes = large
        edge.titleTextAttributes = inline
        let bar = UINavigationBar.appearance()
        bar.standardAppearance = standard
        bar.compactAppearance = standard
        bar.scrollEdgeAppearance = edge
    }

    /// Inter es variable: el peso va en el eje «wght». Crece con el tamaño de texto del sistema.
    private static func inter(_ size: CGFloat, weight: CGFloat, style: UIFont.TextStyle) -> UIFont {
        let wght = 0x7767_6874 // 'wght'
        let descriptor = UIFontDescriptor(fontAttributes: [
            .name: InterFont.name,
            UIFontDescriptor.AttributeName(rawValue: kCTFontVariationAttribute as String): [wght: weight],
        ])
        return UIFontMetrics(forTextStyle: style).scaledFont(for: UIFont(descriptor: descriptor, size: size))
    }
}
#endif
