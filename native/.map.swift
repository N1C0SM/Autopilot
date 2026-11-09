import Foundation
import AppKit

for path in CommandLine.arguments.dropFirst() {
    guard let img = NSImage(contentsOfFile: path),
          let cg = img.cgImage(forProposedRect: nil, context: nil, hints: nil) else { continue }
    let w = cg.width, h = cg.height
    var data = [UInt8](repeating: 0, count: w * h * 4)
    let cs = CGColorSpaceCreateDeviceRGB()
    guard let ctx = CGContext(data: &data, width: w, height: h, bitsPerComponent: 8, bytesPerRow: w * 4,
                              space: cs, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else { continue }
    ctx.draw(cg, in: CGRect(x: 0, y: 0, width: w, height: h))
    let cols = 42, rows = 92
    print("===== \(path) =====")
    let chars = Array(" .:-=+*#%@")
    for r in 0..<rows {
        var line = ""
        for c in 0..<cols {
            let x0 = c * w / cols, x1 = max(x0 + 1, (c + 1) * w / cols)
            let y0 = r * h / rows, y1 = max(y0 + 1, (r + 1) * h / rows)
            var sum = 0.0, n = 0.0
            var rr = 0.0, gg = 0.0, bb = 0.0
            var step = max(1, (x1 - x0) / 6)
            var sy = max(1, (y1 - y0) / 6)
            var x = x0
            while x < x1 {
                var y = y0
                while y < y1 {
                    let i = (y * w + x) * 4
                    let R = Double(data[i]) / 255, G = Double(data[i+1]) / 255, B = Double(data[i+2]) / 255
                    rr += R; gg += G; bb += B
                    sum += 0.2126 * R + 0.7152 * G + 0.0722 * B
                    n += 1
                    y += sy
                }
                x += step
            }
            let lum = sum / max(n, 1)
            var ch = chars[min(chars.count - 1, Int(lum * Double(chars.count - 1) + 0.5))]
            // Marca el oro (r alto, g medio, b bajo) con una 'G'
            let ar = rr / max(n, 1), ag = gg / max(n, 1), ab = bb / max(n, 1)
            if ar > 0.55 && ag > 0.38 && ab < 0.35 && ar - ab > 0.3 { ch = "G" }
            line.append(ch)
        }
        print(String(format: "%4d ", r * h / rows) + line)
    }
}
