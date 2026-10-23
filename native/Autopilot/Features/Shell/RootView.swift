import SwiftUI

/// Secciones de la app. Admin usa los mismos grupos que `src/app/components/admin/adminNav.ts`.
enum AppSection: String, CaseIterable, Identifiable, Hashable {
    // Usuario
    case home, train, progress, nutrition, scan, settings
    // Entrenador
    case trainerClients, trainerProfile
    // Admin
    case adminDashboard, adminMetrics, adminRoadmap, adminUsers, adminTrainers, adminReminders,
         adminExercises, adminRules, adminPhysiques, adminDrive, adminLanding, adminBlog, adminEmails,
         adminProducts, adminPayments, account

    var id: String { rawValue }

    /// Barra lateral de la web (UserSidebar): Inicio, Entrenamiento, Nutrición, Mi progreso, Ajustes.
    static let userSections: [AppSection] = [.home, .train, .nutrition, .progress, .settings]
    /// Pestañas del iPhone (MobileTabBar): Hoy, Entrenar, Nutrición, Progreso. Ajustes va en el avatar.
    static let userTabs: [AppSection] = [.home, .train, .nutrition, .progress]
    static let trainerSections: [AppSection] = [.trainerClients, .trainerProfile, .settings]

    static let adminGroups: [(label: String, items: [AppSection])] = [
        ("General", [.adminDashboard, .adminMetrics, .adminRoadmap]),
        ("Personas", [.adminUsers, .adminTrainers, .adminReminders]),
        ("Entrenamiento", [.adminExercises, .adminRules, .adminPhysiques, .adminDrive]),
        ("Contenido", [.adminLanding, .adminBlog, .adminEmails]),
        ("Negocio", [.adminProducts, .adminPayments]),
        ("Cuenta", [.account]),
    ]

    /// Nombre en la pestaña del iPhone (como MobileTabBar).
    var tabTitle: String {
        switch self {
        case .home: "Hoy"
        case .train: "Entrenar"
        case .progress: "Progreso"
        default: title
        }
    }

    var title: String {
        switch self {
        case .home: "Inicio"
        case .train: "Entrenamiento"
        case .progress: "Mi progreso"
        case .nutrition: "Nutrición"
        case .scan: "Escáner"
        case .settings: "Ajustes"
        case .trainerClients: "Clientes"
        case .trainerProfile: "Mi perfil"
        case .adminDashboard: "Dashboard"
        case .adminMetrics: "Métricas"
        case .adminRoadmap: "Roadmap"
        case .adminUsers: "Usuarios"
        case .adminTrainers: "Entrenadores"
        case .adminReminders: "Recordatorios"
        case .adminExercises: "Ejercicios"
        case .adminRules: "Reglas"
        case .adminPhysiques: "Físicos"
        case .adminDrive: "Drive · Libros"
        case .adminLanding: "Landing"
        case .adminBlog: "Blog"
        case .adminEmails: "Emails"
        case .adminProducts: "Planes y productos"
        case .adminPayments: "Pagos"
        case .account: "Mi cuenta"
        }
    }

    var symbol: String {
        switch self {
        case .home: "house.fill"
        case .train: "dumbbell.fill"
        case .progress: "chart.line.uptrend.xyaxis"
        case .nutrition: "fork.knife"
        case .scan: "figure.stand"
        case .settings: "gearshape.fill"
        case .trainerClients: "person.2.fill"
        case .trainerProfile: "person.crop.circle"
        case .adminDashboard: "square.grid.2x2"
        case .adminMetrics: "chart.bar.xaxis"
        case .adminRoadmap: "point.topleft.down.to.point.bottomright.curvepath"
        case .adminUsers: "person.2"
        case .adminTrainers: "person.badge.key"
        case .adminReminders: "envelope"
        case .adminExercises: "dumbbell"
        case .adminRules: "slider.horizontal.3"
        case .adminPhysiques: "target"
        case .adminDrive: "folder"
        case .adminLanding: "globe"
        case .adminBlog: "doc.text"
        case .adminEmails: "envelope.open"
        case .adminProducts: "square.stack.3d.up"
        case .adminPayments: "creditcard"
        case .account: "person.crop.circle"
        }
    }
}

struct RootView: View {
    @EnvironmentObject private var session: SessionModel

    var body: some View {
        Group {
            if !session.ready {
                ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity).screenBackground()
            } else if session.showPicker {
                WhoIsTrainingView()
            } else if session.session == nil || session.addingAccount {
                LoginView()
            } else {
                MainShell()
            }
        }
        .animation(.easeOut(duration: 0.2), value: session.session?.user.id)
    }
}

/// Pestañas en iPhone; barra lateral nativa en Mac y iPad.
struct MainShell: View {
    @EnvironmentObject private var session: SessionModel
    @Environment(\.horizontalSizeClass) private var sizeClass
    @State private var selection: AppSection?
    @State private var showSettings = false
    @EnvironmentObject private var accounts: AccountStore

    private var initial: String {
        String((accounts.accounts.first { $0.id == session.userIdString }?.name ?? "?").prefix(1)).uppercased()
    }

    private var flatSections: [AppSection] {
        switch session.role {
        case .admin: AppSection.adminGroups.flatMap(\.items)
        case .trainer: AppSection.trainerSections
        case .user: AppSection.userSections
        }
    }

    private var defaultSection: AppSection { flatSections.first ?? .home }

    var body: some View {
        Group {
            #if os(iOS)
            if sizeClass == .compact && session.role == .user {
                // Como la web en el móvil: cabecera con campana y avatar, y barra flotante abajo.
                // La barra reserva su espacio: el final de cada pantalla queda siempre por encima de ella.
                NavigationStack {
                    SectionView(section: selection ?? .home, onNavigate: { selection = $0 })
                        .toolbar {
                            ToolbarItem(placement: .topBarTrailing) {
                                HeaderButtons(initial: initial) { showSettings = true }
                            }
                        }
                        .navigationDestination(isPresented: $showSettings) { AccountView().navigationTitle("Ajustes") }
                        .safeAreaInset(edge: .bottom, spacing: 0) {
                            FloatingTabBar(tabs: AppSection.userTabs, selection: Binding(get: { selection ?? .home }, set: { selection = $0 }))
                                .padding(.bottom, 4).padding(.top, 8)
                        }
                }
            } else {
                split
            }
            #else
            split
            #endif
        }
        .onReceive(NotificationCenter.default.publisher(for: .goToSection)) { note in
            if let s = note.object as? AppSection { selection = s }
        }
        .onChange(of: session.role) { _, _ in selection = nil }
        .onReceive(NotificationCenter.default.publisher(for: .startTodayWorkout)) { _ in
            if session.role == .user && selection != .train {
                selection = .train
                // La pantalla Entrenar recoge el aviso cuando ya está en pantalla.
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.6) { NotificationCenter.default.post(name: .startTodayWorkout, object: nil) }
            }
        }
    }

    private func sidebarRow(_ item: AppSection) -> some View {
        let active = (selection ?? defaultSection) == item
        return Button { selection = item; Haptics.selection() } label: {
            Label {
                Text(item.title).fontWeight(active ? .semibold : .regular)
            } icon: {
                Image(systemName: item.symbol)
                    .symbolRenderingMode(.monochrome)
                    .foregroundStyle(active ? Palette.gold : Palette.foreground)
            }
            .foregroundStyle(active ? Palette.gold : Palette.foreground)
            .frame(maxWidth: .infinity, minHeight: 30, alignment: .leading)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .listRowBackground(
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .fill(active ? Palette.gold.opacity(0.15) : Color.clear)
                .padding(.horizontal, 6)
        )
        .accessibilityAddTraits(active ? .isSelected : [])
    }

    private var split: some View {
        NavigationSplitView {
            // Selección como en la web (bg-primary/15, texto dorado), no el acento del sistema.
            List {
                if session.role == .admin {
                    ForEach(AppSection.adminGroups, id: \.label) { group in
                        Section(group.label) {
                            ForEach(group.items) { item in sidebarRow(item) }
                        }
                    }
                } else {
                    ForEach(flatSections) { item in sidebarRow(item) }
                }
                Section {
                    Button { session.showPicker = true } label: {
                        Label { Text("Cambiar de cuenta") } icon: { Image(systemName: "arrow.left.arrow.right").foregroundStyle(Palette.foreground) }
                            .foregroundStyle(Palette.foreground)
                    }
                    .buttonStyle(.plain)
                    Button { Task { await session.signOut() } } label: {
                        Label { Text("Cerrar sesión") } icon: { Image(systemName: "rectangle.portrait.and.arrow.right").foregroundStyle(Palette.destructive) }
                            .foregroundStyle(Palette.destructive)
                    }
                    .buttonStyle(.plain)
                }
            }
            .listStyle(.sidebar)
            .tint(Palette.gold)
            .navigationTitle(session.role == .admin ? "Admin" : "Autopilot")
            #if os(macOS)
            .navigationSplitViewColumnWidth(min: 220, ideal: 250)
            #endif
        } detail: {
            NavigationStack { SectionView(section: selection ?? defaultSection, onNavigate: { selection = $0 }) }
        }
    }
}

/// Contenido de cada sección.
struct SectionView: View {
    let section: AppSection
    var onNavigate: (AppSection) -> Void = { _ in }

    var body: some View {
        Group {
            switch section {
            case .home: HomeView(onNavigate: onNavigate)
            case .train: TrainView()
            case .progress: ProgressScreen()
            case .nutrition: NutritionView()
            case .scan: ScanView()
            case .settings, .account: AccountView()
            case .trainerClients: TrainerClientsView()
            case .trainerProfile: TrainerProfileView()
            case .adminDashboard: AdminDashboardView(onNavigate: onNavigate)
            case .adminMetrics: AdminMetricsWebView()
            case .adminUsers: AdminUsersView()
            case .adminRoadmap: RoadmapView()
            case .adminReminders: AdminRemindersView()
            case .adminPayments: AdminPaymentsView()
            case .adminTrainers: AdminTrainersView()
            case .adminRules: AdminRulesView()
            case .adminPhysiques: AdminPhysiquesView()
            case .adminProducts: AdminProductsView()
            case .adminBlog: AdminBlogView()
            case .adminEmails: AdminEmailsView()
            case .adminExercises: AdminExercisesView()
            case .adminDrive: AdminDriveView()
            case .adminLanding: AdminLandingView()
            default: AdminWebSectionView(section: section)
            }
        }
        .navigationTitle(section.navTitle)
        #if os(iOS)
        .navigationBarTitleDisplayMode(section == .home ? .inline : .large)
        #endif
    }
}

extension AppSection {
    /// Título de la barra como en la web: «Hoy», «Plan», «Nutrición», «Progreso».
    var navTitle: String {
        switch self {
        case .home: "Hoy"
        case .train: "Plan"
        case .progress: "Progreso"
        default: title
        }
    }
}
