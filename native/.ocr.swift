import Foundation
import Vision
import AppKit

let args = CommandLine.arguments.dropFirst()
for path in args {
    guard let img = NSImage(contentsOfFile: path),
          let cg = img.cgImage(forProposedRect: nil, context: nil, hints: nil) else { continue }
    let w = CGFloat(cg.width), h = CGFloat(cg.height)
    let req = VNRecognizeTextRequest()
    req.recognitionLevel = .accurate
    req.usesLanguageCorrection = true
    req.recognitionLanguages = ["es-ES", "en-US"]
    let handler = VNImageRequestHandler(cgImage: cg, options: [:])
    do { try handler.perform([req]) } catch { print("ERR \(error)") }
    print("COUNT \(req.results?.count ?? -1)")
    print("===== \(path) (\(Int(w))x\(Int(h))) =====")
    let obs = (req.results ?? []).sorted { a, b in
        let ay = 1 - a.boundingBox.midY, by = 1 - b.boundingBox.midY
        if abs(ay - by) > 0.02 { return ay < by }
        return a.boundingBox.minX < b.boundingBox.minX
    }
    for o in obs {
        guard let t = o.topCandidates(1).first else { continue }
        let b = o.boundingBox
        let x = Int(b.minX * w), y = Int((1 - b.maxY) * h), bw = Int(b.width * w), bh = Int(b.height * h)
        print("[x=\(x) y=\(y) w=\(bw) h=\(bh)] \(t.string)")
    }
}
