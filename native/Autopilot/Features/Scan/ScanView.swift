import SwiftUI
import PhotosUI
import Supabase
#if os(iOS)
import UIKit
typealias PlatformImage = UIImage
#else
import AppKit
typealias PlatformImage = NSImage
#endif

/// Pestaña Scan de Progreso, calcada de la web: foto de delante y de atrás, «Tu objetivo»,
/// «Cómo tomar las fotos» y «Analizar mi físico». Usa la misma función `analyze-physique`
/// y guarda en `scan_history` y en el bucket privado `progress-photos`, como la web.
struct ScanView: View {
    @EnvironmentObject private var session: SessionModel
    @State private var front: PlatformImage?
    @State private var back: PlatformImage?
    @State private var frontItem: PhotosPickerItem?
    @State private var backItem: PhotosPickerItem?
    @State private var goal = "Ganar músculo"
    @State private var analyzing = false
    @State private var result: ScanResult?
    @State private var error: String?
    @State private var bio = Biometrics()

    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            if let result {
                ScanResultView(result: result) { self.result = nil; front = nil; back = nil }
            } else {
                Text("Sube tu foto frontal o de espalda para actualizar tu análisis")
                    .font(.apSubhead).foregroundStyle(Palette.muted)

                HStack(spacing: 12) {
                    photoTile(title: "Foto de delante", hint: "Cuerpo completo", image: front, item: $frontItem, silhouette: "figure.stand")
                    photoTile(title: "Foto de atrás", hint: "Opcional", image: back, item: $backItem, silhouette: "figure.stand")
                }

                HStack(alignment: .top, spacing: 14) {
                    Image(systemName: "target").font(.system(size: 18, weight: .semibold)).foregroundStyle(Palette.gold)
                        .frame(width: 32, height: 32).background(Palette.gold.opacity(0.15), in: RoundedRectangle(cornerRadius: 8, style: .continuous))
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Tu objetivo").font(.apHeadline)
                        Text(goal).font(.apSubhead).foregroundStyle(Palette.muted)
                    }
                    Spacer()
                }
                .padding(18)
                .background(Palette.card, in: RoundedRectangle(cornerRadius: Radius.card, style: .continuous))

                VStack(alignment: .leading, spacing: 12) {
                    Text("Cómo tomar las fotos").font(.apTitle3)
                    tip("ruler", "Distancia", "Cámara a 2-3 m, a la altura del ombligo, con el cuerpo entero y el móvil en vertical y bien apoyado.")
                    tip("sun.max", "Luz y fondo", "Luz natural frontal y uniforme, sin contraluz ni flash, con un fondo liso y claro.")
                    tip("figure.arms.open", "Postura y ropa", "Ropa ajustada, pies a la anchura de los hombros y brazos relajados a los lados. Para la de atrás, date la vuelta sin moverte de sitio.")
                }

                Button { Task { await analyze() } } label: {
                    if analyzing { HStack(spacing: 10) { ProgressView().tint(.black); Text("Analizando…") } } else { Text("Analizar mi físico") }
                }
                .buttonStyle(PillButtonStyle(kind: .primary, height: 56))
                .disabled(analyzing || (front == nil && back == nil))

                if let error { Text(error).font(.apFootnote).foregroundStyle(Palette.destructive) }

                Text("Con una sola foto ya podemos analizarte: valoraremos solo lo que se vea en esa vista. Con las dos fotos el análisis es más completo.")
                    .font(.apFootnote).foregroundStyle(Palette.muted)
                Text("Privado: solo para tu análisis · Sin registro · Menos de 1 minuto")
                    .font(.apFootnote).foregroundStyle(Palette.muted)
            }
        }
        .onChange(of: frontItem) { _, item in Task { front = await load(item) } }
        .onChange(of: backItem) { _, item in Task { back = await load(item) } }
        .task { await loadBiometrics() }
    }

    private func photoTile(title: String, hint: String, image: PlatformImage?, item: Binding<PhotosPickerItem?>, silhouette: String) -> some View {
        PhotosPicker(selection: item, matching: .images) {
            ZStack {
                RoundedRectangle(cornerRadius: Radius.hero, style: .continuous).fill(Palette.card)
                if let image {
                    Image(platformImage: image).resizable().scaledToFill()
                        .clipShape(RoundedRectangle(cornerRadius: Radius.hero, style: .continuous))
                } else {
                    Image(systemName: silhouette).font(.system(size: 150, weight: .ultraLight)).foregroundStyle(Color.white.opacity(0.06))
                    VStack(spacing: 6) {
                        Image(systemName: "square.and.arrow.up").font(.system(size: 22, weight: .semibold)).foregroundStyle(Palette.gold)
                            .frame(width: 54, height: 54).background(Palette.secondary, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                        Text(title).font(.apHeadline).foregroundStyle(Palette.foreground).padding(.top, 8)
                        Text(hint).font(.apSubhead).foregroundStyle(Palette.muted)
                    }
                }
            }
            .frame(maxWidth: .infinity).frame(height: 240)
            .clipShape(RoundedRectangle(cornerRadius: Radius.hero, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(image == nil ? "\(title), \(hint)" : "\(title) elegida, toca para cambiarla")
    }

    private func tip(_ symbol: String, _ title: String, _ text: String) -> some View {
        HStack(alignment: .top, spacing: 14) {
            Image(systemName: symbol).foregroundStyle(Palette.gold).frame(width: 24).accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(.apHeadline)
                Text(text).font(.apSubhead).foregroundStyle(Palette.muted)
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Palette.card, in: RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
        .accessibilityElement(children: .combine)
    }

    // MARK: Datos

    struct Biometrics { var height: Double?; var weight: Double?; var age: Int?; var gender: String? }

    private func loadBiometrics() async {
        guard let id = session.userId else { return }
        struct O: Decodable { let height: Double?; let weight: Double?; let age: Double?; let goal: String?; let sex: String? }
        if let o: O = try? await Backend.client.from("onboarding").select("height, weight, age, goal, sex")
            .eq("user_id", value: id).single().execute().value {
            bio = Biometrics(height: o.height, weight: o.weight, age: o.age.map { Int($0) }, gender: o.sex)
            goal = ["lose_weight": "Perder peso", "gain_muscle": "Ganar músculo", "improve_endurance": "Mejorar resistencia"][o.goal ?? ""] ?? goal
        }
    }

    private func load(_ item: PhotosPickerItem?) async -> PlatformImage? {
        guard let item, let data = try? await item.loadTransferable(type: Data.self) else { return nil }
        return PlatformImage(data: data)
    }

    private func analyze() async {
        guard let id = session.userId else { return }
        analyzing = true
        error = nil
        defer { analyzing = false }
        let frontURL = front.flatMap { $0.jpegDataURL() }
        let backURL = back.flatMap { $0.jpegDataURL() }
        struct Body: Encodable {
            let currentImage: String?; let backImage: String?; let objectiveImage: String?
            let height_cm: Double?; let weight_kg: Double?; let age: Int?; let gender: String?
        }
        do {
            let r: ScanResult = try await Backend.client.functions.invoke("analyze-physique", options: FunctionInvokeOptions(
                body: Body(currentImage: frontURL, backImage: backURL, objectiveImage: nil,
                           height_cm: bio.height, weight_kg: bio.weight, age: bio.age, gender: bio.gender)))
            // Igual que la web: fotos al bucket privado y el resultado a scan_history.
            let stamp = Int(Date().timeIntervalSince1970 * 1000)
            func upload(_ image: PlatformImage?, _ suffix: String) async -> String? {
                guard let data = image?.jpegData() else { return nil }
                let path = "\(id.uuidString.lowercased())/scan_\(stamp)_\(suffix).jpg"
                do {
                    try await Backend.client.storage.from("progress-photos").upload(path, data: data, options: FileOptions(contentType: "image/jpeg"))
                    return path
                } catch { return nil }
            }
            let frontPath = await upload(front, "front")
            let backPath = await upload(back, "back")
            struct Insert: Encodable {
                let user_id: UUID; let current_photo_url: String?; let back_photo_url: String?; let result: ScanResult
                let attractiveness: Double?; let potential: Double?; let physique: Double?; let style: Double?
                let months_with_plan: Double?; let emailed_to: String?
            }
            _ = try? await Backend.client.from("scan_history").insert(Insert(
                user_id: id, current_photo_url: frontPath, back_photo_url: backPath, result: r,
                attractiveness: r.attractiveness, potential: r.potential, physique: r.physique, style: r.style,
                months_with_plan: r.months_with_plan, emailed_to: session.session?.user.email)).execute()
            Haptics.success()
            result = r
        } catch {
            Haptics.error()
            self.error = "No se pudo analizar. Comprueba la conexión e inténtalo de nuevo."
        }
    }
}

/// Resultado del análisis (mismo JSON que devuelve `analyze-physique`).
struct ScanResult: Codable {
    var physique: Double?
    var potential: Double?
    var attractiveness: Double?
    var style: Double?
    var months_with_plan: Double?
    var summary: String?
    var improvements: [Improvement]?
    struct Improvement: Codable, Hashable { var title: String?; var description: String? }
}

struct ScanResultView: View {
    let result: ScanResult
    var onAgain: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            VStack(alignment: .leading, spacing: 0) {
                Text("Físico").font(.apSubhead.weight(.semibold)).foregroundStyle(Palette.gold)
                HStack(alignment: .firstTextBaseline, spacing: 4) {
                    Text(NumberText.decimal(result.physique ?? 0)).font(.system(size: 64, weight: .bold).monospacedDigit())
                    Text("/10").font(.apTitle3).foregroundStyle(Palette.muted)
                }
            }
            .padding(20).frame(maxWidth: .infinity, alignment: .leading)
            .background(Palette.card, in: RoundedRectangle(cornerRadius: Radius.hero, style: .continuous))
            HStack(spacing: 12) {
                FigureTile(label: "Atractivo", value: NumberText.decimal(result.attractiveness ?? 0), hint: "/10")
                FigureTile(label: "Potencial", value: NumberText.decimal(result.potential ?? 0), hint: "/10", accent: true)
                FigureTile(label: "Estilo", value: NumberText.decimal(result.style ?? 0), hint: "/10")
            }
            if let s = result.summary { Text(s).font(.apBody).foregroundStyle(Palette.muted) }
            if let list = result.improvements, !list.isEmpty {
                Text("Mejoras").font(.apTitle3)
                ForEach(list, id: \.self) { i in
                    VStack(alignment: .leading, spacing: 2) {
                        Text(i.title ?? "").font(.apHeadline)
                        if let d = i.description { Text(d).font(.apSubhead).foregroundStyle(Palette.muted) }
                    }
                    .padding(16).frame(maxWidth: .infinity, alignment: .leading)
                    .background(Palette.card, in: RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
                }
            }
            Button("Hacer otro scan", action: onAgain).buttonStyle(.pillSecondary)
        }
    }
}

extension Image {
    init(platformImage: PlatformImage) {
        #if os(iOS)
        self.init(uiImage: platformImage)
        #else
        self.init(nsImage: platformImage)
        #endif
    }
}

extension PlatformImage {
    /// JPEG reducido (lado largo 1600 px), como la web antes de enviarlo.
    func jpegData(maxSide: CGFloat = 1600) -> Data? {
        #if os(iOS)
        let scale = min(1, maxSide / max(size.width, size.height))
        let target = CGSize(width: size.width * scale, height: size.height * scale)
        let resized = UIGraphicsImageRenderer(size: target).image { _ in draw(in: CGRect(origin: .zero, size: target)) }
        return resized.jpegData(compressionQuality: 0.85)
        #else
        guard let tiff = tiffRepresentation, let rep = NSBitmapImageRep(data: tiff) else { return nil }
        return rep.representation(using: .jpeg, properties: [.compressionFactor: 0.85])
        #endif
    }

    func jpegDataURL() -> String? {
        jpegData().map { "data:image/jpeg;base64," + $0.base64EncodedString() }
    }
}
