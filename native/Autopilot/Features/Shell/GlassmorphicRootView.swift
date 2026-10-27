import SwiftUI

// MARK: - Navigation Item
public enum GlassNavigationTab: String, CaseIterable, Identifiable {
    case dashboard = "Panel"
    case train = "Entreno"
    case nutrition = "Nutrición"
    case progress = "Progreso"
    case settings = "Ajustes"

    public var id: String { rawValue }

    public var icon: String {
        switch self {
        case .dashboard: return "square.grid.2x2.fill"
        case .train: return "flame.fill"
        case .nutrition: return "fork.knife"
        case .progress: return "chart.bar.xaxis"
        case .settings: return "gearshape.fill"
        }
    }
}

// MARK: - Multiplatform Glass Root View
public struct GlassmorphicRootView: View {
    @State private var selectedTab: GlassNavigationTab = .dashboard

    public init() {}

    public var body: some View {
        #if os(macOS)
        macOSNavigation
        #else
        iOSNavigation
        #endif
    }

    // MARK: - iOS TabView + NavigationStack
    #if os(iOS)
    private var iOSNavigation: some View {
        TabView(selection: $selectedTab) {
            NavigationStack {
                GlassmorphicDashboardView()
                    .toolbar(.hidden, for: .navigationBar)
            }
            .tabItem {
                Label(GlassNavigationTab.dashboard.rawValue, systemImage: GlassNavigationTab.dashboard.icon)
            }
            .tag(GlassNavigationTab.dashboard)

            NavigationStack {
                placeholderView(for: .train)
            }
            .tabItem {
                Label(GlassNavigationTab.train.rawValue, systemImage: GlassNavigationTab.train.icon)
            }
            .tag(GlassNavigationTab.train)

            NavigationStack {
                placeholderView(for: .nutrition)
            }
            .tabItem {
                Label(GlassNavigationTab.nutrition.rawValue, systemImage: GlassNavigationTab.nutrition.icon)
            }
            .tag(GlassNavigationTab.nutrition)

            NavigationStack {
                placeholderView(for: .progress)
            }
            .tabItem {
                Label(GlassNavigationTab.progress.rawValue, systemImage: GlassNavigationTab.progress.icon)
            }
            .tag(GlassNavigationTab.progress)

            NavigationStack {
                placeholderView(for: .settings)
            }
            .tabItem {
                Label(GlassNavigationTab.settings.rawValue, systemImage: GlassNavigationTab.settings.icon)
            }
            .tag(GlassNavigationTab.settings)
        }
        .tint(Color.electricViolet)
    }
    #endif

    // MARK: - macOS NavigationSplitView con Sidebar Glassmórfica y Atajos
    #if os(macOS)
    private var macOSNavigation: some View {
        NavigationSplitView {
            List(GlassNavigationTab.allCases, selection: Binding(
                get: { selectedTab },
                set: { if let tab = $0 { selectedTab = tab } }
            )) { tab in
                NavigationLink(value: tab) {
                    HStack(spacing: 12) {
                        Image(systemName: tab.icon)
                            .font(.system(size: 16))
                            .foregroundStyle(selectedTab == tab ? Color.electricViolet : Color.glassTextSecondary)
                        Text(tab.rawValue)
                            .font(.system(size: 14, weight: selectedTab == tab ? .semibold : .regular))
                            .foregroundStyle(selectedTab == tab ? Color.white : Color.glassTextPrimary)
                    }
                    .padding(.vertical, 4)
                }
                .keyboardShortcut(shortcutKey(for: tab), modifiers: .command)
            }
            .navigationSplitViewColumnWidth(min: 200, ideal: 230, max: 280)
            .background(.ultraThinMaterial)
            .listStyle(.sidebar)
        } detail: {
            Group {
                switch selectedTab {
                case .dashboard:
                    GlassmorphicDashboardView()
                case .train:
                    placeholderView(for: .train)
                case .nutrition:
                    placeholderView(for: .nutrition)
                case .progress:
                    placeholderView(for: .progress)
                case .settings:
                    placeholderView(for: .settings)
                }
            }
            .frame(minWidth: 640, minHeight: 520)
            .background(Color.glassBackground)
        }
        .tint(Color.electricViolet)
    }

    private func shortcutKey(for tab: GlassNavigationTab) -> KeyEquivalent {
        switch tab {
        case .dashboard: return "1"
        case .train: return "2"
        case .nutrition: return "3"
        case .progress: return "4"
        case .settings: return "5"
        }
    }
    #endif

    private func placeholderView(for tab: GlassNavigationTab) -> some View {
        ZStack {
            Color.glassBackground.ignoresSafeArea()
            VStack(spacing: 12) {
                Image(systemName: tab.icon)
                    .font(.system(size: 40))
                    .foregroundStyle(Color.electricViolet)
                    .glow(color: .electricViolet, radius: 10, opacity: 0.5)
                Text(tab.rawValue)
                    .font(.glassTitle)
                    .foregroundStyle(Color.glassTextPrimary)
            }
        }
    }
}
