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
