import SwiftUI
import PhotosUI
import ImageIO
import UniformTypeIdentifiers
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
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    /// Aviso a Progreso de que hay fotos nuevas, para refrescar «Físico» sin esperar a la caché.
    var onScanned: (() -> Void)? = nil
    @State private var front: PlatformImage?
    @State private var back: PlatformImage?
    /// JPEG de la foto ya reducida: se reutiliza al analizar (sin recodificar en el hilo principal).
    @State private var frontJPEG: Data?
    @State private var backJPEG: Data?
    @State private var frontItem: PhotosPickerItem?
    @State private var backItem: PhotosPickerItem?
    /// Mac: la foto se elige como archivo (la fototeca puede no existir: «No Library Found»).
    @State private var importingFile = false
    @State private var importingFront = true
    @State private var goal = ""
    @State private var analyzing = false
    @State private var result: ScanResult?
    @State private var error: String?
    /// Aviso de guardado (el análisis se ve, pero el historial o las fotos no se pudieron guardar).
    @State private var warning: String?
    @State private var bio = Biometrics()
    /// Altura/peso/edad ya pedidos: evita analizar sin ellos si aún no habían llegado.
    @State private var bioLoaded = false

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            if let result {
                ScanResultView(result: result) { reset() }
                    .transition(reduceMotion ? .opacity : .move(edge: .bottom).combined(with: .opacity))
                // El análisis se muestra aunque el guardado haya fallado, pero se dice.
                if let warning {
                    Text(warning).font(.apFootnote).foregroundStyle(Palette.destructive)
                        .fixedSize(horizontal: false, vertical: true)
                }
            } else {
                header
                photos
                goalCard
                tipsCard
                analyzeButton
                if let error {
                    Text(error).font(.apFootnote).foregroundStyle(Palette.destructive)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Text("Con una sola foto ya podemos analizarte: valoraremos solo lo que se vea en esa vista. Con las dos fotos el análisis es más completo.")
                    .font(.apFootnote).foregroundStyle(Palette.muted)
                    .fixedSize(horizontal: false, vertical: true)
                privacyNote
            }
        }
        .animation(reduceMotion ? nil : .snappy, value: result != nil)
        .onChange(of: frontItem) { _, item in Task { await pick(item, isFront: true) } }
        .onChange(of: backItem) { _, item in Task { await pick(item, isFront: false) } }
        .task { await loadBiometrics() }
        #if os(macOS)
        .fileImporter(isPresented: $importingFile, allowedContentTypes: [.image]) { result in
            let isFront = importingFront
            if case .success(let url) = result { Task { await pickFile(url, isFront: isFront) } }
        }
        #endif
    }

    // MARK: - Cabecera

    private var header: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("AI SCAN").font(.apCaption.weight(.bold)).tracking(1.6).foregroundStyle(Palette.gold)
            Text("Tu análisis corporal").font(.apTitle1)
                .accessibilityAddTraits(.isHeader)
            Text("Sube una foto frontal (y otra de espalda si quieres) y la IA valora tu físico y tu potencial.")
                .font(.apSubhead).foregroundStyle(Palette.muted)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    // MARK: - Fotos

    private var photos: some View {
        ZStack {
            HStack(spacing: 12) {
                photoTile(title: "Delante", hint: "Cuerpo completo", badge: "Obligatoria",
                          image: front, item: $frontItem, isFront: true, silhouette: "figure.stand")
                    .disabled(analyzing)
                photoTile(title: "Atrás", hint: "Opcional", badge: "Opcional",
                          image: back, item: $backItem, isFront: false, silhouette: "figure.stand")
                    .disabled(analyzing)
            }
            .opacity(analyzing ? 0.35 : 1)

            if analyzing {
                VStack(spacing: 10) {
                    BrandLoader().tint(Palette.gold).scaleEffect(1.15)
                        .accessibilityHidden(true)
                    Text("Analizando tu físico…").font(.apHeadline)
                    Text("Unos segundos y listo.").font(.apFootnote).foregroundStyle(Palette.muted)
                }
                .padding(22)
                .frame(maxWidth: .infinity)
                .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: Radius.hero, style: .continuous))
                .overlay {
                    RoundedRectangle(cornerRadius: Radius.hero, style: .continuous)
                        .strokeBorder(Palette.gold.opacity(0.4), lineWidth: 1)
                }
                .transition(.opacity)
                .accessibilityElement(children: .combine)
                .accessibilityLabel("Analizando tu físico")
            }
        }
        .animation(reduceMotion ? nil : .easeOut(duration: 0.2), value: analyzing)
    }

    // MARK: - Objetivo

    private var goalCard: some View {
        HStack(alignment: .top, spacing: 14) {
            IconTile(symbol: "target", size: 36)
            VStack(alignment: .leading, spacing: 2) {
                Text("Tu objetivo").font(.apHeadline)
                Text(goal.isEmpty ? "Sin definir" : goal).font(.apSubhead).foregroundStyle(Palette.muted)
                Text("Se usa para personalizar el análisis.").font(.apFootnote).foregroundStyle(Palette.muted)
            }
            Spacer(minLength: 0)
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Palette.card, in: RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
        .accessibilityElement(children: .combine)
    }

    // MARK: - Consejos

    private var tipsCard: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("Cómo tomar las fotos").font(.apTitle3).padding(.bottom, 8)
            tipRow("ruler", "Distancia", "Cámara a 2-3 m, a la altura del ombligo, cuerpo entero y móvil en vertical.")
            tipRow("sun.max", "Luz y fondo", "Luz natural frontal y uniforme, sin contraluz ni flash, con fondo liso y claro.")
            tipRow("figure.arms.open", "Postura y ropa", "Ropa ajustada, pies a la anchura de los hombros y brazos relajados. Para la de atrás, date la vuelta sin moverte.")
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Palette.card, in: RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
    }

    private func tipRow(_ symbol: String, _ title: String, _ text: String) -> some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: symbol)
                .font(.inter(size: 14, weight: .semibold))
                .foregroundStyle(Palette.gold)
                .frame(width: 26, height: 26)
                .background(Palette.gold.opacity(0.14), in: RoundedRectangle(cornerRadius: 8, style: .continuous))
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 1) {
                Text(title).font(.apSubhead.weight(.semibold))
                Text(text).font(.apFootnote).foregroundStyle(Palette.muted)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: 0)
        }
        .padding(.vertical, 7)
        .accessibilityElement(children: .combine)
    }

    // MARK: - Acción

    private var analyzeButton: some View {
        Button { Haptics.tap(); Task { await analyze() } } label: {
            HStack(spacing: 10) {
                if analyzing { BrandLoader().tint(.black) }
                Text(analyzing ? "Analizando…" : "Analizar mi físico")
            }
        }
        .buttonStyle(PillButtonStyle(kind: .primary, height: 56))
        .disabled(analyzing || (front == nil && back == nil))
        .opacity(analyzing ? 0.6 : 1)
        .accessibilityHint("Con una sola foto ya hay análisis; con las dos es más completo")
    }

    private var privacyNote: some View {
        HStack(spacing: 6) {
            Image(systemName: "lock.fill").font(.inter(size: 11)).accessibilityHidden(true)
            Text("Privado: solo para tu análisis · Sin registro · Menos de 1 minuto")
        }
        .font(.apFootnote)
        .foregroundStyle(Palette.muted)
        .accessibilityElement(children: .combine)
    }

    private func photoTile(title: String, hint: String, badge: String,
                           image: PlatformImage?, item: Binding<PhotosPickerItem?>, isFront: Bool,
                           silhouette: String) -> some View {
        #if os(macOS)
        Button {
            importingFront = isFront
            importingFile = true
        } label: { photoTileLabel(title: title, hint: hint, badge: badge, image: image, silhouette: silhouette) }
        .buttonStyle(.plain)
        .accessibilityLabel(image == nil ? "\(title), \(hint), \(badge). Pulsa para elegir foto" : "\(title) elegida. Pulsa para cambiarla")
        .accessibilityHint("Abre una ventana para elegir el archivo de la foto")
        #else
        PhotosPicker(selection: item, matching: .images) {
            photoTileLabel(title: title, hint: hint, badge: badge, image: image, silhouette: silhouette)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(image == nil ? "\(title), \(hint), \(badge). Toca para elegir foto" : "\(title) elegida. Toca para cambiarla")
        .accessibilityHint("Abre tu fototeca para elegir la foto")
        #endif
    }

    private func photoTileLabel(title: String, hint: String, badge: String,
                                image: PlatformImage?, silhouette: String) -> some View {
        ZStack {
            RoundedRectangle(cornerRadius: Radius.hero, style: .continuous).fill(Palette.card)
            if let image {
                Image(platformImage: image).resizable().scaledToFill()
                    .clipShape(RoundedRectangle(cornerRadius: Radius.hero, style: .continuous))
            } else {
                RoundedRectangle(cornerRadius: Radius.hero, style: .continuous)
                    .strokeBorder(style: StrokeStyle(lineWidth: 1.5, dash: [6, 6]))
                    .foregroundStyle(Palette.gold.opacity(0.35))
                Image(systemName: silhouette)
                    .font(.inter(size: 150, weight: .ultraLight))
                    .foregroundStyle(Color.white.opacity(0.06))
                    .accessibilityHidden(true)
                // Todo centrado: cruz, título y pista.
                VStack(spacing: 8) {
                    Image(systemName: "plus")
                        .font(.inter(size: 20, weight: .bold)).foregroundStyle(Palette.gold)
                        .frame(width: 54, height: 54)
                        .background(Palette.gold.opacity(0.14), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                    Text(title).font(.apHeadline)
                    Text(hint).font(.apSubhead).foregroundStyle(Palette.muted)
                }
            }

            // Badge arriba a la derecha, sin desplazar el centro.
            VStack {
                HStack {
                    Spacer()
                    Text(badge)
                        .font(.apCaption.weight(.semibold))
                        .foregroundStyle(badge == "Opcional" ? Palette.muted : Palette.gold)
                        .padding(.horizontal, 9).padding(.vertical, 4)
                        .background(.black.opacity(0.45), in: Capsule())
                }
                Spacer()
            }
            .padding(10)

            if image != nil {
                VStack {
                    Spacer()
                    Text("Cambiar foto")
                        .font(.apFootnote.weight(.semibold))
                        .foregroundStyle(Palette.foreground)
                        .padding(.horizontal, 12).padding(.vertical, 7)
                        .background(.ultraThinMaterial, in: Capsule())
                        .padding(.bottom, 12)
                }
            }
        }
        .frame(maxWidth: .infinity).frame(height: 240)
        .clipShape(RoundedRectangle(cornerRadius: Radius.hero, style: .continuous))
    }


    // MARK: Datos

    struct Biometrics { var height: Double?; var weight: Double?; var age: Int?; var gender: String? }

    /// Vuelve al formulario limpio: antes se quedaban las fotos/JPEG del scan anterior y el
    /// siguiente envío podía llevar una foto vieja que ya no se veía en pantalla.
    private func reset() {
        result = nil
        error = nil
        warning = nil
        front = nil
        back = nil
        frontJPEG = nil
        backJPEG = nil
        frontItem = nil
        backItem = nil
    }

    private func loadBiometrics() async {
        guard let id = session.userId else { return }
        // La pestaña se recrea en cada visita: con caché no se repite la consulta ni se ve
        // «Tu objetivo» con el valor por defecto durante un instante.
        if let cached = ScanCache.shared.biometrics(userId: id) {
            bio = cached.bio
            goal = cached.goal
            bioLoaded = true
            return
        }
        struct O: Decodable { let height: Double?; let weight: Double?; let age: Double?; let goal: String?; let sex: String? }
        guard let o: O = try? await Backend.client.from("onboarding").select("height, weight, age, goal, sex")
            .eq("user_id", value: id).single().execute().value else { return }
        let value = Biometrics(height: o.height, weight: o.weight, age: o.age.map { Int($0) }, gender: o.sex)
        // Sin objetivo conocido se deja vacío y la tarjeta dice «Sin definir» (antes se inventaba).
        let target = ["lose_weight": "Perder peso", "gain_muscle": "Ganar músculo", "improve_endurance": "Mejorar resistencia"][o.goal ?? ""] ?? ""
        bio = value
        goal = target
        bioLoaded = true
        ScanCache.shared.store(bio: value, goal: target, userId: id)
    }

    /// Foto elegida: se decodifica y se reduce fuera del hilo principal (una foto de 12 Mpx
    /// decodificada en el MainActor era un tirón visible al elegirla) y se guarda ya en JPEG.
    private func pick(_ item: PhotosPickerItem?, isFront: Bool) async {
        let picked = await Self.picked(item)
        show(picked, isFront: isFront, requested: item != nil)
    }

    /// Mac: archivo elegido en el Finder; se lee y se reduce fuera del hilo principal.
    private func pickFile(_ url: URL, isFront: Bool) async {
        let access = url.startAccessingSecurityScopedResource()
        defer { if access { url.stopAccessingSecurityScopedResource() } }
        let data = await Task.detached(priority: .userInitiated) { try? Data(contentsOf: url) }.value
        let picked = await Self.prepared(data)
        show(picked, isFront: isFront, requested: true)
    }

    private func show(_ picked: (image: PlatformImage, jpeg: Data)?, isFront: Bool, requested: Bool) {
        if isFront {
            front = picked?.image
            frontJPEG = picked?.jpeg
        } else {
            back = picked?.image
            backJPEG = picked?.jpeg
        }
        // No se deja la foto anterior en pantalla si la nueva no se pudo abrir.
        if requested, picked == nil { error = "No se pudo abrir esa foto. Prueba con otra." }
    }

    private static func picked(_ item: PhotosPickerItem?) async -> (image: PlatformImage, jpeg: Data)? {
        guard let item else { return nil }
        return await prepared(try? await item.loadTransferable(type: Data.self))
    }

    private static func prepared(_ data: Data?) async -> (image: PlatformImage, jpeg: Data)? {
        guard let data else { return nil }
        return await Task.detached(priority: .userInitiated) { () -> (image: PlatformImage, jpeg: Data)? in
            guard let image = PlatformImage.downscaled(from: data, maxSide: 1600),
                  let jpeg = image.jpegData() else { return nil }
            return (image, jpeg)
        }.value
    }

    private func analyze() async {
        guard let id = session.userId else { return }
        analyzing = true
        error = nil
        warning = nil
        defer { analyzing = false }

        // Si los datos de la ficha aún no habían llegado, el análisis saldría sin altura/peso/edad.
        if !bioLoaded { await loadBiometrics() }

        // El base64 de las fotos (ya reducidas) se prepara fuera del MainActor: eran varios MB.
        let frontData = frontJPEG, backData = backJPEG
        let (frontURL, backURL) = await Task.detached(priority: .userInitiated) { () -> (String?, String?) in
            (frontData?.dataURL, backData?.dataURL)
        }.value

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
            // Las dos subidas a la vez: antes eran dos esperas en serie antes de guardar el scan.
            async let frontPath = upload(frontData, suffix: "front", userId: id, stamp: stamp)
            async let backPath = upload(backData, suffix: "back", userId: id, stamp: stamp)
            let (frontPhoto, backPhoto) = await (frontPath, backPath)
            struct Insert: Encodable {
                let user_id: UUID; let current_photo_url: String?; let back_photo_url: String?; let result: ScanResult
                let attractiveness: Double?; let potential: Double?; let physique: Double?; let style: Double?
                let months_with_plan: Double?; let emailed_to: String?
            }
            // El guardado en el historial ya no se traga el error: si falla, se avisa.
            let insert = Insert(
                user_id: id, current_photo_url: frontPhoto, back_photo_url: backPhoto, result: r,
                attractiveness: r.attractiveness, potential: r.potential, physique: r.physique, style: r.style,
                months_with_plan: r.months_with_plan, emailed_to: session.session?.user.email)
            var saved = false
            var scanId: String?
            do {
                let row: ScanRow = try await Backend.client.from("scan_history").insert(insert)
                    .select("id").single().execute().value
                scanId = row.id
                saved = true
            } catch {
                // Si el servidor no devuelve la fila (p. ej. política de lectura), se guarda igualmente
                // sin enlazar las fotos: perder el análisis entero sería peor.
                do {
                    try await Backend.client.from("scan_history").insert(insert).execute()
                    saved = true
                } catch {
                    saved = false
                }
            }
            // Se cambió de cuenta mientras analizaba: el resultado no es de la cuenta activa.
            guard session.userId == id else { return }

            // Como la web: las fotos del scan también se guardan en «Físico» (`progress_photos`).
            // Sin esto, tras hacer un scan la pestaña «Físico» seguía vacía para siempre.
            var photosSaved = true
            if saved {
                if let scanId {
                    struct PhotoRow: Encodable {
                        let user_id: UUID; let photo_url: String; let note: String
                        let taken_at: String; let scan_history_id: String
                    }
                    var rows: [PhotoRow] = []
                    if let frontPhoto {
                        rows.append(PhotoRow(user_id: id, photo_url: frontPhoto, note: "Scan · frente",
                                             taken_at: LocalDate.string(), scan_history_id: scanId))
                    }
                    if let backPhoto {
                        rows.append(PhotoRow(user_id: id, photo_url: backPhoto, note: "Scan · espalda",
                                             taken_at: LocalDate.string(), scan_history_id: scanId))
                    }
                    if !rows.isEmpty {
                        do {
                            try await Backend.client.from("progress_photos").insert(rows).execute()
                            // «Físico» tiene las fotos en caché: se olvida para que las pida de nuevo.
                            ProgressModel.invalidatePhotoCache(userId: id)
                            onScanned?()
                        } catch {
                            photosSaved = false
                        }
                    }
                } else {
                    // Sin id no se pueden enlazar: si había fotos, no se han guardado en «Físico».
                    photosSaved = frontPhoto == nil && backPhoto == nil
                }
            }

            let photosLost = (frontData != nil && frontPhoto == nil) || (backData != nil && backPhoto == nil)
            warning = !saved
                ? "El análisis no se pudo guardar en tu historial."
                : ((!photosSaved || photosLost) ? "Las fotos no se pudieron guardar en tu historial." : nil)
            Haptics.success()
            result = r
        } catch {
            guard session.userId == id else { return }
            #if DEBUG
            // Deja el error real en Documents para leerlo desde el Mac.
            if let docs = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first {
                var detail = String(describing: error)
                if case let FunctionsError.httpError(code, data) = error,
                   let body = String(data: data, encoding: .utf8) {
                    detail += " code=\(code) body=\(body)"
                }
                let line = "\(Date()) analyze: \(detail)\n  localized: \(error.localizedDescription)\n"
                let url = docs.appendingPathComponent("scan-error.log")
                if let data = line.data(using: .utf8) {
                    if let handle = try? FileHandle(forWritingTo: url) {
                        handle.seekToEndOfFile(); handle.write(data); try? handle.close()
                    } else {
                        try? data.write(to: url)
                    }
                }
            }
            #endif
            Haptics.error()
            // Mismos mensajes que la web. El motivo técnico del servidor nunca se enseña tal cual:
            // solo decide el aviso («Payment Required» es el proveedor de IA sin saldo).
            var status: Int?
            var serverMessage = ""
            if case let FunctionsError.httpError(code, data) = error {
                struct E: Decodable { let error: String? }
                status = code
                serverMessage = ((try? JSONDecoder().decode(E.self, from: data))?.error ?? "").lowercased()
            }
            if status == 429 || serverMessage.contains("too many") {
                self.error = "Has hecho muchos análisis seguidos. Espera un rato y vuelve a intentarlo."
            } else if serverMessage.contains("payment") {
                self.error = "El análisis con IA está pausado: el servicio no tiene saldo. Estamos en ello; inténtalo más tarde."
            } else if error is URLError {
                self.error = "Sin conexión. Comprueba tu internet e inténtalo de nuevo."
            } else {
                self.error = "No hemos podido analizar las fotos. Inténtalo de nuevo en unos segundos."
            }
        }
    }

    /// Sube una foto (ya en JPEG y reducida) al bucket privado de progreso.
    private func upload(_ data: Data?, suffix: String, userId id: UUID, stamp: Int) async -> String? {
        guard let data else { return nil }
        let path = "\(id.uuidString.lowercased())/scan_\(stamp)_\(suffix).jpg"
        do {
            try await Backend.client.storage.from("progress-photos")
                .upload(path, data: data, options: FileOptions(contentType: "image/jpeg"))
            return path
        } catch { return nil }
    }

    /// Id de la fila recién insertada en `scan_history` (para enlazar las fotos del scan).
    private struct ScanRow: Decodable { let id: String }
}

/// Caché en memoria de los datos de onboarding que usa el scan (altura, peso, edad y objetivo).
private final class ScanCache: @unchecked Sendable {
    static let shared = ScanCache()
    private let lock = NSLock()
    private var entries: [UUID: (bio: ScanView.Biometrics, goal: String, at: Date)] = [:]
    private let ttl: TimeInterval = 10 * 60

    func biometrics(userId: UUID) -> (bio: ScanView.Biometrics, goal: String)? {
        lock.lock(); defer { lock.unlock() }
        guard let entry = entries[userId], Date().timeIntervalSince(entry.at) < ttl else { return nil }
        return (entry.bio, entry.goal)
    }

    func store(bio: ScanView.Biometrics, goal: String, userId: UUID) {
        lock.lock(); defer { lock.unlock() }
        entries[userId] = (bio, goal, Date())
        // Tope por si en el futuro se acumulan muchas cuentas en el dispositivo.
        if entries.count > 8 { entries.removeAll() }
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
    /// Campos que devuelve `analyze-physique` y que usa la web: se decodifican también para no
    /// perderlos al guardar el resultado en `scan_history`.
    var headline_diagnosis: String?
    var bottleneck: String?
    var months_without_plan: Double?
    /// Scan básico (Free): el servidor quita el detalle de Plus y dice qué se desbloquea.
    var basic: Bool?
    var locked_sections: [String]?

    /// Item de «Mejoras»: el JSON trae `label` y `priority`. Antes se decodificaban
    /// `title`/`description`, que no existen, y las tarjetas salían vacías.
    struct Improvement: Codable, Hashable { var label: String?; var priority: String? }
}

struct ScanResultView: View {
    let result: ScanResult
    var onAgain: () -> Void

    /// Sin dato no se inventa un «0,0»: se muestra «—» (un 0 parecería una nota real).
    private func score(_ value: Double?) -> String {
        value.map { NumberText.decimal($0) } ?? "—"
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            hero
            metrics
            if let s = result.summary, !s.isEmpty { summaryCard(s) }
            if let list = result.improvements, !list.isEmpty { improvements(list) }
            if result.basic == true { plusCard }
            Button("Hacer otro scan", action: onAgain).buttonStyle(.pillSecondary)
        }
    }

    // MARK: - Puntuación

    private var hero: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .top, spacing: 12) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("AI SCAN").font(.apCaption.weight(.bold)).tracking(1.6).foregroundStyle(Palette.gold)
                    Text("Tu físico").font(.apTitle3)
                }
                Spacer(minLength: 8)
                IconTile(symbol: "sparkles", size: 40)
            }
            HStack(alignment: .firstTextBaseline, spacing: 4) {
                Text(score(result.physique))
                    .font(.figure(size: 64))
                    .lineLimit(1).minimumScaleFactor(0.6)
                    .contentTransition(.numericText())
                if result.physique != nil {
                    Text("/10").font(.apTitle3).foregroundStyle(Palette.muted)
                }
            }
            .padding(.top, 10)
            Text(result.physique == nil ? "Sin puntuación global" : "Puntuación global de tu físico")
                .font(.apFootnote).foregroundStyle(Palette.muted)
        }
        .padding(20)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Palette.card, in: RoundedRectangle(cornerRadius: Radius.hero, style: .continuous))
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Físico: \(result.physique.map { NumberText.decimal($0) + " sobre 10" } ?? "sin datos")")
    }

    private var metrics: some View {
        HStack(spacing: 12) {
            FigureTile(label: "Atractivo", value: score(result.attractiveness), hint: result.attractiveness == nil ? nil : "/10")
            FigureTile(label: "Potencial", value: score(result.potential), hint: result.potential == nil ? nil : "/10", accent: true)
            FigureTile(label: "Estilo", value: score(result.style), hint: result.style == nil ? nil : "/10")
        }
    }

    private func summaryCard(_ text: String) -> some View {
        Card {
            HStack(alignment: .top, spacing: 12) {
                Image(systemName: "quote.opening")
                    .font(.inter(size: 16, weight: .semibold))
                    .foregroundStyle(Palette.gold)
                    .accessibilityHidden(true)
                Text(text).font(.apBody)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }

    /// Scan básico: lo que se desbloquea con Plus (como `ScanPlusCard` de la web). Sin enlace
    /// de pago en iOS (normas de la App Store).
    private var plusCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            Image("lu-lock").renderingMode(.template).resizable().frame(width: 18, height: 18)
                .foregroundStyle(Palette.gold)
                .frame(width: 40, height: 40).background(Palette.gold.opacity(0.15), in: Circle())
            Text("Tu scan completo, con Plus").font(.inter(size: 28, weight: .bold)).tracking(-0.7)
            Text("Este es tu scan básico. Con Plus ves el análisis entero de tu físico:")
                .font(.apSubhead).foregroundStyle(Palette.muted).fixedSize(horizontal: false, vertical: true)
            ForEach(result.locked_sections ?? [], id: \.self) { item in
                HStack(alignment: .top, spacing: 10) {
                    Image("lu-check").renderingMode(.template).resizable().frame(width: 14, height: 14)
                        .foregroundStyle(Palette.gold).padding(.top, 3)
                    Text(item).font(.apSubhead).fixedSize(horizontal: false, vertical: true)
                }
            }
            Text("Incluido en Plus").font(.apFootnote.weight(.semibold)).foregroundStyle(Palette.gold).padding(.top, 6)
        }
        .padding(20)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Palette.card, in: RoundedRectangle(cornerRadius: Radius.hero, style: .continuous))
    }

    // MARK: - Mejoras

    private func improvements(_ list: [ScanResult.Improvement]) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Qué mejorar").font(.apTitle3)
            ForEach(Array(list.enumerated()), id: \.offset) { index, item in
                HStack(alignment: .top, spacing: 12) {
                    Text("\(index + 1)")
                        .font(.apSubhead.weight(.bold).monospacedDigit())
                        .foregroundStyle(.black)
                        .frame(width: 26, height: 26)
                        .background(Palette.gold, in: Circle())
                        .accessibilityHidden(true)
                    VStack(alignment: .leading, spacing: 3) {
                        if let title = item.label, !title.isEmpty {
                            Text(title).font(.apHeadline)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                        if let priority = item.priority, !priority.isEmpty {
                            Text("Prioridad \(priority.lowercased())")
                                .font(.apCaption.weight(.semibold))
                                .foregroundStyle(Palette.gold)
                                .padding(.horizontal, 8).padding(.vertical, 3)
                                .background(Palette.gold.opacity(0.14), in: Capsule())
                        }
                    }
                    Spacer(minLength: 0)
                }
                .padding(16)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Palette.card, in: RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
                .accessibilityElement(children: .combine)
                .accessibilityLabel("Mejora \(index + 1): \(item.label ?? ""). Prioridad \(item.priority ?? "sin definir")")
            }
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
    /// Miniatura ya redimensionada con ImageIO. Es segura fuera del hilo principal, a diferencia
    /// de decodificar la imagen completa y dibujarla.
    static func downscaled(from data: Data, maxSide: CGFloat) -> PlatformImage? {
        guard let source = CGImageSourceCreateWithData(data as CFData, nil) else { return nil }
        let options: [CFString: Any] = [
            kCGImageSourceCreateThumbnailFromImageAlways: true,
            kCGImageSourceThumbnailMaxPixelSize: maxSide,
            kCGImageSourceCreateThumbnailWithTransform: true,
        ]
        guard let cgImage = CGImageSourceCreateThumbnailAtIndex(source, 0, options as CFDictionary) else { return nil }
        #if os(iOS)
        return UIImage(cgImage: cgImage)
        #else
        return NSImage(cgImage: cgImage, size: .zero)
        #endif
    }

    /// JPEG reducido (lado largo 1600 px), como la web antes de enviarlo.
    func jpegData(maxSide: CGFloat = 1600) -> Data? {
        #if os(iOS)
        let scale = min(1, maxSide / max(size.width, size.height))
        let target = CGSize(width: size.width * scale, height: size.height * scale)
        // El renderer heredaba la escala de pantalla (×3): el JPEG salía a 4800 px en vez de 1600
        // y pesaba el triple. Aquí 1 px = 1 pt.
        let format = UIGraphicsImageRendererFormat.default()
        format.scale = 1
        let resized = UIGraphicsImageRenderer(size: target, format: format).image { _ in draw(in: CGRect(origin: .zero, size: target)) }
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

private extension Data {
    /// `data:image/jpeg;base64,…` para `analyze-physique` (mismo formato que la web).
    var dataURL: String { "data:image/jpeg;base64," + base64EncodedString() }
}

// MARK: - Miniaturas remotas

/// Caché de miniaturas por (URL, tamaño), en memoria y con decodificado fuera del MainActor.
///
/// `CachedAsyncImage` (Components.swift) decodifica siempre a `maxSide 900` (≈2700 px): para una
/// rejilla de fotos, una lista de récords o las tarjetas de la sesión son decenas de MB y tirones.
/// Aquí se decodifica al tamaño real de uso en una caché aparte, sin tocar Components.swift.
@MainActor
final class ThumbnailCache {
    static let shared = ThumbnailCache()
    private let memory = NSCache<NSString, PlatformImage>()

    private let session: URLSession = {
        let c = URLSessionConfiguration.default
        c.urlCache = URLCache.shared
        c.requestCachePolicy = .returnCacheDataElseLoad
        return URLSession(configuration: c)
    }()

    func cached(_ url: URL, maxSide: CGFloat) -> PlatformImage? {
        memory.object(forKey: key(url, maxSide))
    }

    func load(_ url: URL, maxSide: CGFloat) async -> PlatformImage? {
        let key = key(url, maxSide)
        if let hit = memory.object(forKey: key) { return hit }
        guard let (data, _) = try? await session.data(from: url) else { return nil }
        let image = await Task.detached(priority: .utility) { () -> PlatformImage? in
            guard let source = CGImageSourceCreateWithData(data as CFData, nil) else { return nil }
            let options: [CFString: Any] = [
                kCGImageSourceCreateThumbnailFromImageAlways: true,
                kCGImageSourceThumbnailMaxPixelSize: maxSide * 3,
                kCGImageSourceCreateThumbnailWithTransform: true,
            ]
            guard let cgImage = CGImageSourceCreateThumbnailAtIndex(source, 0, options as CFDictionary) else { return nil }
            #if os(iOS)
            return UIImage(cgImage: cgImage)
            #else
            return NSImage(cgImage: cgImage, size: .zero)
            #endif
        }.value
        if let image { memory.setObject(image, forKey: key) }
        return image
    }

    private func key(_ url: URL, _ maxSide: CGFloat) -> NSString {
        "\(url.absoluteString)|\(Int(maxSide))" as NSString
    }
}

/// Imagen remota decodificada a tamaño de uso (relleno, como las miniaturas de la app).
struct RemoteThumb<Placeholder: View>: View {
    let url: URL?
    let maxSide: CGFloat
    let placeholder: Placeholder
    @State private var image: PlatformImage?

    init(url: URL?, maxSide: CGFloat = 200, @ViewBuilder placeholder: () -> Placeholder) {
        self.url = url
        self.maxSide = maxSide
        self.placeholder = placeholder()
        // Si ya está en caché se pinta en el primer fotograma (sin parpadeo).
        _image = State(initialValue: url.flatMap { u in
            MainActor.assumeIsolated { ThumbnailCache.shared.cached(u, maxSide: maxSide) }
        })
    }

    var body: some View {
        Group {
            if let image {
                Image(platformImage: image).resizable().scaledToFill()
            } else {
                placeholder
            }
        }
        .task(id: url) {
            guard image == nil, let url else { return }
            image = await ThumbnailCache.shared.load(url, maxSide: maxSide)
        }
    }
}
