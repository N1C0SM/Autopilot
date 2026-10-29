import SwiftUI
import Foundation

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
                // Arranque con la firma de marca: la misma «A» del splash, con el rayo latiendo.
                BrandMark(size: 72, beat: true)
                    .frame(maxWidth: .infinity, maxHeight: .infinity).screenBackground()
                    .accessibilityLabel("Autopilot")
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
    /// Sección visible del panel de Admin en iPhone y estado del cajón lateral.
    @State private var adminSection: AppSection = .adminDashboard
    @State private var adminMenuOpen = false
    #if DEBUG
    /// Solo para capturas de QA: `-previewSummary` abre el resumen de fin de entreno.
    @State private var previewSummary = ProcessInfo.processInfo.arguments.contains("-previewSummary")
    @State private var previewTracker = ProcessInfo.processInfo.arguments.contains("-previewWorkout")
    @State private var previewWorkout: ActiveWorkout?
    #endif

    init() {
        #if DEBUG
        // Solo para capturas de QA: `-section=nutrition` abre esa pestaña al lanzar.
        if let arg = ProcessInfo.processInfo.arguments.first(where: { $0.hasPrefix("-section=") }),
           let section = AppSection(rawValue: String(arg.dropFirst("-section=".count))) {
            _selection = State(initialValue: section)
        }
        // QA del Admin: abre el cajón lateral nada más entrar.
        if ProcessInfo.processInfo.arguments.contains("-openAdminMenu") {
            _adminMenuOpen = State(initialValue: true)
        }
        #endif
    }

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
            if sizeClass == .compact && session.role == .admin {
                adminShell
            } else if sizeClass == .compact && session.role == .user {
                // Como la web en el móvil: cabecera con campana y avatar, y barra flotante abajo.
                // La barra reserva su espacio: el final de cada pantalla queda siempre por encima de ella.
                NavigationStack {
                    SectionView(section: selection ?? .home, onNavigate: { selection = $0 })
                        .toolbar(.hidden, for: .navigationBar)
                        // Cabecera de la web (MobileHeader): campana y avatar en círculos, «Hoy» centrado
                        // y en el resto de pestañas el título grande a la izquierda.
                        .safeAreaInset(edge: .top, spacing: 0) {
                            let current = selection ?? .home
                            VStack(alignment: .leading, spacing: 4) {
                                ZStack {
                                    // El saludo con la fecha ya dice que es hoy: sin título duplicado.
                                    HStack { Spacer(); HeaderButtons(initial: initial, avatar: accounts.accounts.first { $0.id == session.userIdString }?.avatar) { showSettings = true } }
                                }
                                .frame(height: 44)
                                if current != .home {
                                    Text(current.navTitle).font(.inter(.largeTitle).weight(.bold))
                                        .accessibilityAddTraits(.isHeader)
                                }
                            }
                            .padding(.horizontal, 16).padding(.bottom, 6)
                            .background(Palette.background)
                        }
                        .navigationDestination(isPresented: $showSettings) { AccountView().navigationTitle("Ajustes") }
                        .safeAreaInset(edge: .bottom, spacing: 0) {
                            FloatingTabBar(tabs: AppSection.userTabs, selection: Binding(get: { selection ?? .home }, set: { selection = $0 }))
                                .padding(.bottom, 4).padding(.top, 8)
                                .shadow(color: .black.opacity(0.5), radius: 12, y: 8)
                                // Tapa lo que hay entre la barra y el borde: nada asoma por debajo.
                                .background(
                                    LinearGradient(colors: [.black.opacity(0), .black.opacity(0.95), .black], startPoint: .top, endPoint: .center)
                                        .padding(.top, -24)
                                        .ignoresSafeArea(edges: .bottom)
                                )
                        }
                }
            } else {
                split
            }
            #else
            split
            #endif
        }
        #if DEBUG
        .task {
            if (previewSummary || previewTracker), previewWorkout == nil { previewWorkout = await Self.mockWorkout() }
        }
        .sheet(isPresented: $previewSummary) {
            if let w = previewWorkout {
                WorkoutSummaryView(workout: w, rpe: 8) { previewSummary = false }
            }
        }
        .sheet(isPresented: $previewTracker) {
            if let w = previewWorkout {
                NavigationStack {
                    WorkoutView(workout: w, userId: UUID()) { _ in previewTracker = false }
                }
            }
        }
        #endif
        #if DEBUG
        .task {
            if let docs = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first {
                let line = "role=\(session.role) compact=\(sizeClass == .compact) selection=\(String(describing: selection))\n"
                try? line.write(to: docs.appendingPathComponent("mainshell.log"), atomically: true, encoding: .utf8)
            }
        }
        #endif
        .onReceive(NotificationCenter.default.publisher(for: .goToSection)) { note in
            if let s = note.object as? AppSection { selection = s }
        }
        .onChange(of: session.role) { _, _ in selection = nil; adminMenuOpen = false }
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
                Group {
                    if let lu = item.lucide { Image(lu).renderingMode(.template).resizable().frame(width: 18, height: 18) }
                    else { Image(systemName: item.symbol).symbolRenderingMode(.monochrome) }
                }
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

    #if os(iOS)
    /// Admin en iPhone: contenido a pantalla completa y la barra lateral como cajón
    /// (hamburguesa). Al elegir una sección el cajón se cierra y cambia el contenido.
    private var adminShell: some View {
        ZStack(alignment: .leading) {
            NavigationStack {
                SectionView(section: adminSection, onNavigate: { adminSection = $0 })
                    .toolbar {
                        ToolbarItem(placement: .topBarLeading) {
                            Button {
                                Haptics.selection()
                                withAnimation(.easeOut(duration: 0.22)) { adminMenuOpen = true }
                            } label: {
                                Image(systemName: "line.3.horizontal")
                                    .font(.inter(.body).weight(.semibold))
                                    .foregroundStyle(Palette.foreground)
                            }
                            .accessibilityLabel("Menú de administración")
                        }
                    }
            }

            if adminMenuOpen {
                Color.black.opacity(0.5)
                    .ignoresSafeArea()
                    .onTapGesture { closeAdminMenu() }
                    .transition(.opacity)
                    .accessibilityLabel("Cerrar menú")
                    .accessibilityAddTraits(.isButton)

                AdminSidebarView(selection: $adminSection, onClose: closeAdminMenu)
                    .frame(width: 310)
                    .transition(.move(edge: .leading))
            }
        }
        .animation(.easeOut(duration: 0.22), value: adminMenuOpen)
    }

    private func closeAdminMenu() {
        withAnimation(.easeOut(duration: 0.2)) { adminMenuOpen = false }
    }

    #endif

    #if DEBUG
    @MainActor
    static func mockWorkout() async -> ActiveWorkout {
        func ex(_ id: String, _ name: String, _ series: Int, _ reps: String, _ weight: String, _ rest: String, _ muscle: String) -> GymExercise {
            let json = """
            {"exercise_id":"\(id)","name":"\(name)","series":\(series),"reps":"\(reps)","weight":"\(weight)","rest":"\(rest)","muscle_group":"\(muscle)"}
            """
            return try! JSONDecoder().decode(GymExercise.self, from: Data(json.utf8))
        }
        let day = DayPlan(day: DayNames.today, type: "gimnasio", sport: nil, intensity: nil, duration: nil,
                          routine_name: "Full Body B",
                          muscle_focus: "Hombros, piernas, glúteos, isquiotibiales y core",
                          exercises: [
                            ex("1", "Press militar con barra de pie estricto", 4, "4-6", "40", "180s", "Hombros"),
                            ex("2", "Press inclinado con barra", 4, "6", "42.5", "180s", "Pecho"),
                            ex("3", "Remo con barra", 3, "10", "60", "90s", "Espalda"),
                          ], custom: nil)
        // Fotos reales de la biblioteca, como en un entreno de verdad.
        let w = ActiveWorkout(userId: "preview", day: await TrainingRepo.withImages([day]).first ?? day, previous: [:])
        w.draft.startedAt = Date().addingTimeInterval(-42 * 60)
        for (name, weight) in [("Press militar con barra de pie estricto", "40"), ("Press inclinado con barra", "42,5"), ("Remo con barra", "60")] {
            if var sets = w.draft.logs[name] {
                for i in sets.indices {
                    sets[i].weight = weight
                    sets[i].done = i < 2
                    sets[i].rpe = i < 2 ? 8 : nil
                }
                if name == "Press militar con barra de pie estricto" { sets[0].failure = true }
                w.draft.logs[name] = sets
            }
        }
        w.draft.supersets = [["Press militar", "Sentadilla"]]
        w.records = ["Press militar", "Sentadilla"]
        return w
    }
    #endif

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
                        Label { Text("Cambiar de cuenta") } icon: { Image("lu-arrow-left-right").renderingMode(.template).resizable().frame(width: 18, height: 18).foregroundStyle(Palette.foreground) }
                            .foregroundStyle(Palette.foreground)
                    }
                    .buttonStyle(.plain)
                    Button { Task { await session.signOut() } } label: {
                        Label { Text("Cerrar sesión") } icon: { Image("lu-log-out").renderingMode(.template).resizable().frame(width: 18, height: 18).foregroundStyle(Palette.destructive) }
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
                // Negro de borde a borde, también bajo la barra de título de la ventana.
                .background(Palette.background.ignoresSafeArea())
                #if os(macOS)
                .toolbarBackground(Palette.background, for: .windowToolbar)
                .toolbarBackground(.visible, for: .windowToolbar)
                #endif
        }
    }
}

/// Contenido de cada sección.
struct SectionView: View {
    @EnvironmentObject private var session: SessionModel
    let section: AppSection
    var onNavigate: (AppSection) -> Void = { _ in }

    var body: some View {
        #if os(macOS)
        // La web de escritorio ocupa todo el ancho (`<main>` es `w-full` con `p-4 md:p-8 lg:p-10`,
        // sin `max-w`): aquí no hay tope de 948, solo el padding del lienzo.
        GeometryReader { geo in
            canvas
                .padding(.horizontal, section.lucide != nil ? Self.canvasPadding(for: geo.size.width) : 0)
        }
        // El margen del lienzo también es negro: sin esto se veía una franja gris a los lados.
        .background(Palette.background.ignoresSafeArea())
        #else
        canvas
        #endif
    }

    /// Padding horizontal del lienzo de escritorio, como `p-4` / `md:p-8` / `lg:p-10` de la web.
    private static func canvasPadding(for width: CGFloat) -> CGFloat {
        width >= 1024 ? 32 : width >= 768 ? 24 : 16
    }

    /// Sección elegida, con su carga y su título de barra.
    private var canvas: some View {
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
        // Al cambiar o recuperar la cuenta, cada pantalla vuelve a cargar con el usuario correcto.
        .id(session.userIdString ?? "")
        #if os(macOS)
        .navigationTitle(section.deskTitle)
        .navigationSubtitle(section.deskHint ?? "")
        #else
        .navigationTitle(section.navTitle)
        #endif
        #if os(iOS)
        .navigationBarTitleDisplayMode(section == .home ? .inline : .large)
        #endif
    }
}

extension AppSection {
    /// Título de la barra como en la web: «Hoy», «Plan», «Nutrición», «Progreso».
    /// Icono Lucide de la barra lateral de escritorio (`UserSidebar.tsx`).
    var lucide: String? {
        switch self {
        case .home: "lu-house"
        case .train: "lu-dumbbell"
        case .nutrition: "lu-apple"
        case .progress: "lu-sparkles"
        case .settings: "lu-settings"
        default: nil
        }
    }

    /// Título y pista de la cabecera de escritorio (SECTION_LABELS / SECTION_HINTS de la web).
    var deskTitle: String {
        switch self {
        case .train: "Entrenamiento"
        case .progress: "Progreso"
        default: title
        }
    }
    var deskHint: String? {
        switch self {
        case .home: "Tu entreno de hoy y lo que toca comer"
        case .train: "Tu rutina de la semana. Marca las series al terminarlas"
        case .nutrition: "Tus macros y comidas del día"
        case .progress: "Fotos, peso y evolución semanal"
        case .settings: "Perfil, suscripción y notificaciones"
        default: nil
        }
    }

    var navTitle: String {
        switch self {
        case .home: "Hoy"
        case .train: "Entrenar"
        case .progress: "Progreso"
        default: title
        }
    }
}
