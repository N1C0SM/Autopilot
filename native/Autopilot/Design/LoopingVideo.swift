import SwiftUI
import AVFoundation
#if os(iOS)
import UIKit
#else
import AppKit
#endif

/// Vídeo de técnica de cada ejercicio (el bucle corto de `exercise-video`), pedido una vez por
/// nombre. Igual que la web: solo archivos directos (`.mp4`, `.mov`, `.m4v`).
@MainActor
final class ExerciseLoops: ObservableObject {
    static let shared = ExerciseLoops()
    @Published private(set) var urls: [String: URL] = [:]
    private var asked: Set<String> = []

    func load(_ names: [String]) async {
        let missing = Array(Set(names).subtracting(asked))
        guard !missing.isEmpty else { return }
        asked.formUnion(missing)
        struct R: Decodable { let name: String; let video_url: String? }
        do {
            let rows: [R] = try await Backend.client.from("exercises").select("name, video_url")
                .in("name", values: missing).execute().value
            for r in rows {
                guard let s = r.video_url, let u = URL(string: s),
                      ["mp4", "mov", "m4v"].contains(u.pathExtension.lowercased()) else { continue }
                urls[r.name] = u
            }
        } catch {
            asked.subtract(missing) // sin red: se vuelve a intentar la próxima vez
        }
    }
}

/// Bucle corto, mudo y sin controles (como un GIF): enseña el movimiento. Mezcla con la música
/// del usuario (sesión de audio `.ambient`) y no recibe toques, así el deslizamiento sigue.
struct LoopingVideo: View {
    let url: URL
    @State private var player = AVQueuePlayer()
    @State private var looper: AVPlayerLooper?

    var body: some View {
        PlayerLayerView(player: player)
            .allowsHitTesting(false)
            .accessibilityHidden(true)
            .task(id: url) {
                #if os(iOS)
                try? AVAudioSession.sharedInstance().setCategory(.ambient, options: [.mixWithOthers])
                #endif
                looper?.disableLooping()
                player.removeAllItems()
                player.isMuted = true
                player.preventsDisplaySleepDuringVideoPlayback = false
                looper = AVPlayerLooper(player: player, templateItem: AVPlayerItem(url: url))
                player.play()
            }
            .onDisappear { player.pause() }
    }
}

#if os(iOS)
private struct PlayerLayerView: UIViewRepresentable {
    let player: AVPlayer

    final class Host: UIView {
        override class var layerClass: AnyClass { AVPlayerLayer.self }
        var playerLayer: AVPlayerLayer { layer as! AVPlayerLayer }
    }

    func makeUIView(context: Context) -> Host {
        let v = Host()
        v.isUserInteractionEnabled = false
        v.playerLayer.videoGravity = .resizeAspectFill
        v.playerLayer.player = player
        return v
    }

    func updateUIView(_ v: Host, context: Context) { v.playerLayer.player = player }
}
#else
private struct PlayerLayerView: NSViewRepresentable {
    let player: AVPlayer

    final class Host: NSView {
        override func hitTest(_ point: NSPoint) -> NSView? { nil }
    }

    func makeNSView(context: Context) -> Host {
        let v = Host()
        let l = AVPlayerLayer(player: player)
        l.videoGravity = .resizeAspectFill
        v.layer = l
        v.wantsLayer = true
        return v
    }

    func updateNSView(_ v: Host, context: Context) { (v.layer as? AVPlayerLayer)?.player = player }
}
#endif
