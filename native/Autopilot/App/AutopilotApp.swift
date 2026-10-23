import SwiftUI

@main
struct AutopilotApp: App {
    @StateObject private var session = SessionModel()
    @StateObject private var accounts = AccountStore.shared

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(session)
                .environmentObject(accounts)
                .preferredColorScheme(.dark)
                .tint(Palette.gold)
                .task { await session.start() }
        }
        #if os(macOS)
        .defaultSize(width: 1200, height: 820)
        .commands { AppCommands(session: session) }
        #endif
    }
}

#if os(macOS)
/// Menús propios del Mac: cuenta y navegación con atajos de teclado.
struct AppCommands: Commands {
    @ObservedObject var session: SessionModel

    var body: some Commands {
        CommandMenu("Cuenta") {
            Button("Cambiar de cuenta…") { session.showPicker = true }
                .keyboardShortcut("u", modifiers: [.command, .shift])
            Button("Añadir otra cuenta…") { session.addAnotherAccount() }
            Divider()
            Button("Cerrar sesión") { Task { await session.signOut() } }
                .keyboardShortcut("q", modifiers: [.command, .shift])
        }
        CommandMenu("Ir") {
            ForEach(Array(AppSection.userSections.enumerated()), id: \.element) { index, section in
                Button(section.title) { NotificationCenter.default.post(name: .goToSection, object: section) }
                    .keyboardShortcut(KeyEquivalent(Character(String(index + 1))), modifiers: .command)
            }
        }
    }
}
#endif

extension Notification.Name {
    static let goToSection = Notification.Name("autopilot.goToSection")
}
