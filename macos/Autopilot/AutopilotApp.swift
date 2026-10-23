import SwiftUI
import WebKit

// App nativa de macOS: ventana, menús y atajos de Mac alrededor de la misma
// aplicación que usan la web y el iPhone (autopilotplan.com), con su sesión guardada.

private let home = URL(string: "https://autopilotplan.com/dashboard")!

/// Secciones del panel, con el mismo parámetro `section` que usan los atajos de Siri.
enum Section: String, CaseIterable {
    case home, training, nutrition, progress
    var title: String {
        switch self {
        case .home: "Hoy"
        case .training: "Entrenar"
        case .nutrition: "Nutrición"
        case .progress: "Progreso"
        }
    }
    var url: URL { URL(string: "https://autopilotplan.com/dashboard?section=\(rawValue)")! }
}

@MainActor
final class Browser: ObservableObject {
    let webView: WKWebView
    @Published var isLoading = true

    init() {
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .default() // la sesión sobrevive al cerrar la app
        config.preferences.isElementFullscreenEnabled = true
        webView = WKWebView(frame: .zero, configuration: config)
        webView.allowsBackForwardNavigationGestures = true
        webView.allowsMagnification = true
        webView.underPageBackgroundColor = .black
        webView.isInspectable = true
        webView.load(URLRequest(url: home))
    }

    func open(_ section: Section) { webView.load(URLRequest(url: section.url)) }
    func reload() { webView.reload() }
    func back() { if webView.canGoBack { webView.goBack() } }
    func forward() { if webView.canGoForward { webView.goForward() } }
}

/// Enlaces de fuera de Autopilot (tiendas, Stripe, redes) se abren en el navegador del Mac.
final class NavigationDelegate: NSObject, WKNavigationDelegate, WKUIDelegate {
    weak var browser: Browser?

    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction, decisionHandler: @escaping @MainActor (WKNavigationActionPolicy) -> Void) {
        guard let url = action.request.url, let host = url.host else { decisionHandler(.allow); return }
        let isAutopilot = host.hasSuffix("autopilotplan.com") || host.hasSuffix("supabase.co")
        if !isAutopilot && action.navigationType == .linkActivated {
            NSWorkspace.shared.open(url)
            decisionHandler(.cancel)
        } else {
            decisionHandler(.allow)
        }
    }

    // target="_blank": fuera de la app, en el navegador.
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for action: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let url = action.request.url { NSWorkspace.shared.open(url) }
        return nil
    }

    func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
        Task { @MainActor in self.browser?.isLoading = true }
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        NSLog("Autopilot cargado: %@", webView.url?.absoluteString ?? "-")
        Task { @MainActor in self.browser?.isLoading = false }
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        NSLog("Autopilot error: %@", error.localizedDescription)
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        NSLog("Autopilot error inicial: %@", error.localizedDescription)
    }
}

struct WebView: NSViewRepresentable {
    let browser: Browser

    // El delegado vive en el Coordinator: WebKit lo guarda como referencia débil.
    func makeCoordinator() -> NavigationDelegate { NavigationDelegate() }

    func makeNSView(context: Context) -> WKWebView {
        context.coordinator.browser = browser
        browser.webView.navigationDelegate = context.coordinator
        browser.webView.uiDelegate = context.coordinator
        return browser.webView
    }

    func updateNSView(_ nsView: WKWebView, context: Context) {}
}

struct ContentView: View {
    @EnvironmentObject var browser: Browser

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()
            WebView(browser: browser)
                .ignoresSafeArea()
            if browser.isLoading && browser.webView.url == nil {
                // Arranque: el logo sobre negro, como el splash del iPhone.
                Image(nsImage: NSApp.applicationIconImage)
                    .resizable()
                    .frame(width: 96, height: 96)
                    .transition(.opacity)
            }
        }
        .frame(minWidth: 900, minHeight: 640)
        .background(Color.black)
    }
}

@main
struct AutopilotApp: App {
    @StateObject private var browser = Browser()

    var body: some Scene {
        WindowGroup("Autopilot") {
            ContentView()
                .environmentObject(browser)
                .preferredColorScheme(.dark)
        }
        .windowStyle(.hiddenTitleBar)
        .defaultSize(width: 1280, height: 820)
        .commands {
            CommandGroup(replacing: .newItem) {}
            CommandMenu("Ir") {
                ForEach(Array(Section.allCases.enumerated()), id: \.element) { index, section in
                    Button(section.title) { browser.open(section) }
                        .keyboardShortcut(KeyEquivalent(Character("\(index + 1)")), modifiers: .command)
                }
                Divider()
                Button("Atrás") { browser.back() }.keyboardShortcut("[", modifiers: .command)
                Button("Adelante") { browser.forward() }.keyboardShortcut("]", modifiers: .command)
                Button("Recargar") { browser.reload() }.keyboardShortcut("r", modifiers: .command)
            }
        }
    }
}
