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

/// Pestaña Scan de Progreso, la referencia de la web (`ProgressScan.tsx`): foto de delante y de
/// atrás, «Tu objetivo», «Tu físico objetivo», «Cómo tomar las fotos» y «Analizar mi físico»; la
/// espera por pasos y el resultado. Usa la misma función `analyze-physique` y guarda en
/// `scan_history` y en el bucket privado `progress-photos`, como la web.
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
    /// Físico objetivo: una referencia del admin (`goal_physiques`) o una foto propia, como la web.
    @State private var presets: [GoalPreset] = []
    @State private var presetId: String?
    @State private var objectiveURL: URL?
    @State private var objectiveImage: PlatformImage?
    @State private var objectiveJPEG: Data?
    @State private var objectiveItem: PhotosPickerItem?
    /// Mac: la foto se elige como archivo (la fototeca puede no existir: «No Library Found»).
    @State private var importingFile = false
    @State private var importTarget: ImportTarget = .front
    @State private var goal = ""
    /// En qué punto real está el análisis (nil: formulario o resultado). Igual que la web.
    @State private var stage: ScanLoading.Stage?
    @State private var result: ScanResult?
    @State private var error: String?
    /// Aviso de guardado (el análisis se ve, pero el historial o las fotos no se pudieron guardar).
    @State private var warning: String?
    @State private var bio = Biometrics()
    /// Altura/peso/edad ya pedidos: evita analizar sin ellos si aún no habían llegado.
    @State private var bioLoaded = false

    enum ImportTarget { case front, back, objective }
    struct GoalPreset: Decodable, Identifiable, Hashable { let id: String; let name: String; let image_url: String? }

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            if let result {
                ScanResultView(result: result, photo: front ?? back, objectiveImage: objectiveImage,
                               objectiveURL: objectiveURL) { reset() }
                    .transition(reduceMotion ? .opacity : .move(edge: .bottom).combined(with: .opacity))
                // El análisis se muestra aunque el guardado haya fallado, pero se dice.
                if let warning {
                    Text(warning).font(.apFootnote).foregroundStyle(Palette.destructive)
                        .fixedSize(horizontal: false, vertical: true)
                }
            } else if let stage {
                ScanAnalyzingView(photo: front ?? back, stage: stage, saves: true)
                    .transition(.opacity)
            } else {
                header
                photos
                goalCard
                objectivePicker
                tipsCard
                if let error { errorNotice(error) }
                analyzeButton
                Text("Con una sola foto ya podemos analizarte: valoraremos solo lo que se vea en esa vista. Con las dos fotos el análisis es más completo.")
                    .font(.apFootnote).foregroundStyle(Palette.muted)
                    .fixedSize(horizontal: false, vertical: true)
                privacyNote
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .animation(reduceMotion ? nil : .snappy, value: result != nil)
        .animation(reduceMotion ? nil : .easeOut(duration: 0.2), value: stage)
        .onChange(of: frontItem) { _, item in Task { await pick(item, target: .front) } }
        .onChange(of: backItem) { _, item in Task { await pick(item, target: .back) } }
        .onChange(of: objectiveItem) { _, item in Task { await pick(item, target: .objective) } }
        .task { await loadBiometrics() }
        .task { await loadPresets() }
        #if os(macOS)
        .fileImporter(isPresented: $importingFile, allowedContentTypes: [.image]) { result in
            let target = importTarget
            if case .success(let url) = result { Task { await pickFile(url, target: target) } }
        }
        #endif
    }

    // MARK: - Cabecera

    /// Alineada a la izquierda, como «Tu fuerza» en Progreso (nunca centrada).
    private var header: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text("Análisis físico con IA").font(.apTitle3)
                .accessibilityAddTraits(.isHeader)
            Text("Sube tus fotos y la IA analiza tu físico y tu potencial para personalizar aún más tu plan.")
                .font(.apSubhead).foregroundStyle(Palette.muted)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    // MARK: - Fotos

    private var photos: some View {
        HStack(spacing: 12) {
            photoTile(title: "Foto de delante", hint: "Cuerpo completo", badge: "Recomendada",
                      image: front, item: $frontItem, target: .front)
            photoTile(title: "Foto de atrás", hint: "Cuerpo completo", badge: "Opcional",
                      image: back, item: $backItem, target: .back)
        }
    }

    // MARK: - Objetivo

    private var goalCard: some View {
        HStack(alignment: .center, spacing: 14) {
            IconTile(symbol: "target", size: 40)
            VStack(alignment: .leading, spacing: 2) {
                Text("Tu objetivo").font(.apHeadline)
                Text(goal.isEmpty ? "Sin definir" : goal).font(.apSubhead).foregroundStyle(Palette.muted)
                Text("Se usa para personalizar el análisis.").font(.apFootnote).foregroundStyle(Palette.muted)
            }
            Spacer(minLength: 0)
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .surface()
        .accessibilityElement(children: .combine)
    }

    private var hasObjective: Bool { objectiveURL != nil || objectiveImage != nil }

    /// «Tu físico objetivo»: subir una foto propia o elegir una referencia, en una tira horizontal
    /// (como `ScanObjectivePicker` en la web). Solo con objetivo hay similitud y meses.
    private var objectivePicker: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .top, spacing: 12) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Tu físico objetivo").font(.apTitle3).accessibilityAddTraits(.isHeader)
                    Text("Elige una referencia o sube tu foto. Solo con objetivo calculamos la similitud y los meses que te faltan.")
                        .font(.apFootnote).foregroundStyle(Palette.muted)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                if hasObjective {
                    Button("Quitar") { Haptics.tap(); clearObjective() }
                        .font(.apSubhead.weight(.semibold)).foregroundStyle(Palette.gold)
                        .buttonStyle(.plain).frame(minHeight: 44)
                }
            }
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 12) {
                    ownObjectiveTile
                    ForEach(presets) { presetTile($0) }
                }
                .padding(2)
            }
        }
    }

    @ViewBuilder private var ownObjectiveTile: some View {
        #if os(macOS)
        Button {
            importTarget = .objective
            importingFile = true
        } label: { ownObjectiveLabel }
        .buttonStyle(.pressableCard(scale: 0.97))
        .accessibilityLabel("Subir la foto de tu físico objetivo")
        #else
        PhotosPicker(selection: $objectiveItem, matching: .images) { ownObjectiveLabel }
            .buttonStyle(.pressableCard(scale: 0.97))
            .accessibilityLabel("Subir la foto de tu físico objetivo")
        #endif
    }

    private var ownObjectiveLabel: some View {
        ZStack {
            if let objectiveImage {
                Color.clear.overlay { Image(platformImage: objectiveImage).resizable().scaledToFill() }
            } else {
                VStack(spacing: 6) {
                    Image(systemName: "plus").font(.inter(size: 16, weight: .bold)).foregroundStyle(Palette.gold)
                        .frame(width: 36, height: 36).background(Palette.gold.opacity(0.15), in: Circle())
                    Text("Subir foto").font(.apFootnote).foregroundStyle(Palette.muted)
                }
            }
        }
        .frame(width: 80, height: 112)
        .clipShape(RoundedRectangle(cornerRadius: Radius.chip, style: .continuous))
        // La misma profundidad que `bg-card` en la web (luz arriba y sombra difusa), fuera del recorte.
        .background(SurfaceBackground(shape: RoundedRectangle(cornerRadius: Radius.chip, style: .continuous)))
        .overlay {
            if objectiveImage != nil {
                RoundedRectangle(cornerRadius: Radius.chip, style: .continuous).strokeBorder(Palette.gold, lineWidth: 2)
            }
        }
    }

    private func presetTile(_ p: GoalPreset) -> some View {
        let selected = presetId == p.id
        return Button {
            Haptics.selection()
            presetId = p.id
            objectiveURL = p.image_url.flatMap(URL.init(string:))
            objectiveImage = nil
            objectiveJPEG = nil
        } label: {
            ZStack(alignment: .bottomLeading) {
                Color.clear.overlay {
                    CachedAsyncImage(url: p.image_url.flatMap(URL.init(string:)), maxSide: 112) {
                        $0.resizable().scaledToFill()
                    } placeholder: { Palette.card }
                }
                LinearGradient(colors: [.clear, .black.opacity(0.8)], startPoint: .center, endPoint: .bottom)
                Text(p.name).font(.apFootnote.weight(.semibold)).foregroundStyle(.white)
                    .lineLimit(1).padding(.horizontal, 6).padding(.bottom, 6)
            }
            .frame(width: 80, height: 112)
            .clipShape(RoundedRectangle(cornerRadius: Radius.chip, style: .continuous))
            .overlay {
                if selected { RoundedRectangle(cornerRadius: Radius.chip, style: .continuous).strokeBorder(Palette.gold, lineWidth: 2) }
            }
            .overlay(alignment: .topTrailing) {
                if selected {
                    Image(systemName: "checkmark").font(.inter(size: 10, weight: .heavy)).foregroundStyle(Palette.background)
                        .frame(width: 20, height: 20).background(Palette.gold, in: Circle()).padding(6)
                }
            }
        }
        .buttonStyle(.pressableCard(scale: 0.97))
        .accessibilityLabel("Objetivo: \(p.name)")
        .accessibilityAddTraits(selected ? .isSelected : [])
    }

    private func clearObjective() {
        presetId = nil
        objectiveURL = nil
        objectiveImage = nil
        objectiveJPEG = nil
        objectiveItem = nil
    }

    // MARK: - Consejos

    private static let tips: [(String, String)] = [
        ("figure.stand", "Cuerpo entero, de pie y con el móvil en vertical"),
        ("ruler", "Cámara a 2-3 m, a la altura del ombligo"),
        ("sun.max", "Luz natural frontal, sin contraluz ni flash"),
        ("tshirt", "Ropa ajustada y fondo liso y claro"),
        ("arrow.uturn.backward", "Para la de atrás, date la vuelta sin moverte"),
    ]

    /// «Cómo tomar las fotos» en Title 3 y una fila por consejo en un grupo sin borde (como la web).
    private var tipsCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Cómo tomar las fotos").font(.apTitle3).accessibilityAddTraits(.isHeader)
            VStack(spacing: 0) {
                ForEach(Array(Self.tips.enumerated()), id: \.offset) { index, tip in
                    HStack(spacing: 12) {
                        Image(systemName: tip.0)
                            .font(.inter(size: 16, weight: .semibold))
                            .foregroundStyle(Palette.muted)
                            .frame(width: 20)
                            .accessibilityHidden(true)
                        Text(tip.1).font(.apSubhead)
                            .fixedSize(horizontal: false, vertical: true)
                        Spacer(minLength: 0)
                    }
                    .padding(.horizontal, 16).padding(.vertical, 10)
                    .frame(minHeight: 48)
                    .overlay(alignment: .top) {
                        if index > 0 { Rectangle().fill(Palette.separator).frame(height: 0.5) }
                    }
                }
            }
            .surface()
        }
    }

    // MARK: - Acción

    private var analyzeButton: some View {
        Button { Haptics.tap(); Task { await analyze() } } label: {
            HStack(spacing: 8) {
                Text("Analizar mi físico")
                Image(systemName: "arrow.right").accessibilityHidden(true)
            }
        }
        .buttonStyle(PillButtonStyle(kind: .primary, height: 56))
        .disabled(front == nil && back == nil)
        .accessibilityHint("Con una sola foto ya hay análisis; con las dos es más completo")
    }

    /// Aviso de error (mismos mensajes que `scanErrors.ts`), en una fila con su icono.
    private func errorNotice(_ text: String) -> some View {
        HStack(alignment: .center, spacing: 12) {
            IconTile(symbol: "exclamationmark.circle", size: 32, tint: Palette.destructive)
            Text(text).font(.apSubhead).fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: 0)
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .surface()
        .accessibilityElement(children: .combine)
    }

    private var privacyNote: some View {
        HStack(spacing: 6) {
            Image(systemName: "lock.fill").font(.inter(size: 12)).accessibilityHidden(true)
            Text(ScanFormat.keepTogether("Privado: solo para tu análisis · Menos de 1 minuto"))
        }
        .font(.apFootnote)
        .foregroundStyle(Palette.muted)
        .accessibilityElement(children: .combine)
    }

    private func photoTile(title: String, hint: String, badge: String,
                           image: PlatformImage?, item: Binding<PhotosPickerItem?>, target: ImportTarget) -> some View {
        #if os(macOS)
        Button {
            importTarget = target
            importingFile = true
        } label: { photoTileLabel(title: title, hint: hint, badge: badge, image: image) }
        .buttonStyle(.pressableCard(scale: 0.98))
        .accessibilityLabel(image == nil ? "\(title), \(hint), \(badge). Pulsa para elegir foto" : "\(title) elegida. Pulsa para cambiarla")
        .accessibilityHint("Abre una ventana para elegir el archivo de la foto")
        #else
        PhotosPicker(selection: item, matching: .images) {
            photoTileLabel(title: title, hint: hint, badge: badge, image: image)
        }
        .buttonStyle(.pressableCard(scale: 0.98))
        .accessibilityLabel(image == nil ? "\(title), \(hint), \(badge). Toca para elegir foto" : "\(title) elegida. Toca para cambiarla")
        .accessibilityHint("Abre tu fototeca para elegir la foto")
        #endif
    }

    /// Tarjeta de 28 sin borde, con la profundidad de las demás: cámara dorada, título y pista; o la foto.
    private func photoTileLabel(title: String, hint: String, badge: String, image: PlatformImage?) -> some View {
        ZStack {
            Color.clear.surface(Radius.hero)
            if let image {
                Color.clear.overlay { Image(platformImage: image).resizable().scaledToFill() }
                    .clipShape(RoundedRectangle(cornerRadius: Radius.hero, style: .continuous))
            } else {
                VStack(spacing: 8) {
                    Image(systemName: "camera.fill")
                        .font(.inter(size: 20, weight: .semibold)).foregroundStyle(Palette.gold)
                        .frame(width: 54, height: 54)
                        .background(Palette.gold.opacity(0.15), in: Circle())
                    Text(title).font(.apHeadline).multilineTextAlignment(.center)
                    Text(hint).font(.apSubhead).foregroundStyle(Palette.muted)
                }
                .padding(.horizontal, 12)
            }

            // Insignia arriba a la derecha, sin desplazar el centro. Sobre la foto, cristal oscuro y
            // texto claro; sin foto, la píldora gris del sistema (también en modo claro), como la web.
            VStack {
                HStack {
                    Spacer()
                    Text(badge)
                        .font(.apFootnote.weight(.semibold))
                        .foregroundStyle(badge == "Recomendada" ? Palette.gold : image != nil ? Color.white.opacity(0.8) : Palette.muted)
                        .padding(.horizontal, 9).padding(.vertical, 4)
                        .background(image != nil ? Color.black.opacity(0.45) : Palette.secondary, in: Capsule())
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
        .contentShape(RoundedRectangle(cornerRadius: Radius.hero, style: .continuous))
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
        // Los del configurador y los de Ajustes, como `SCAN_GOAL_LABELS` en la web.
        let target = ScanFormat.goalLabels[o.goal ?? ""] ?? ""
        bio = value
        goal = target
        bioLoaded = true
        ScanCache.shared.store(bio: value, goal: target, userId: id)
    }

    /// Físicos objetivo del admin con foto pública (los mismos que la web).
    private func loadPresets() async {
        guard presets.isEmpty else { return }
        guard let rows: [GoalPreset] = try? await Backend.client.from("goal_physiques").select("id, name, image_url")
            .order("sort_order", ascending: true).execute().value else { return }
        presets = rows.filter { ($0.image_url ?? "").lowercased().hasPrefix("http") }
    }

    /// Foto elegida: se decodifica y se reduce fuera del hilo principal (una foto de 12 Mpx
    /// decodificada en el MainActor era un tirón visible al elegirla) y se guarda ya en JPEG.
    private func pick(_ item: PhotosPickerItem?, target: ImportTarget) async {
        let picked = await Self.picked(item)
        show(picked, target: target, requested: item != nil)
    }

    /// Mac: archivo elegido en el Finder; se lee y se reduce fuera del hilo principal.
    private func pickFile(_ url: URL, target: ImportTarget) async {
        let access = url.startAccessingSecurityScopedResource()
        defer { if access { url.stopAccessingSecurityScopedResource() } }
        let data = await Task.detached(priority: .userInitiated) { try? Data(contentsOf: url) }.value
        let picked = await Self.prepared(data)
        show(picked, target: target, requested: true)
    }

    private func show(_ picked: (image: PlatformImage, jpeg: Data)?, target: ImportTarget, requested: Bool) {
        switch target {
        case .front:
            front = picked?.image
            frontJPEG = picked?.jpeg
        case .back:
            back = picked?.image
            backJPEG = picked?.jpeg
        case .objective:
            // Sin elegir nada (p. ej. al quitar el objetivo) no se toca la referencia elegida.
            guard requested else { return }
            objectiveImage = picked?.image
            objectiveJPEG = picked?.jpeg
            if picked != nil { presetId = nil; objectiveURL = nil }
        }
        // No se deja la foto anterior en pantalla si la nueva no se pudo abrir.
        if requested, picked == nil { error = "No se pudo abrir esa foto. Prueba con otra." }
        else if requested { error = nil }
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
        stage = .analyzing
        error = nil
        warning = nil
        defer { stage = nil }

        // Si los datos de la ficha aún no habían llegado, el análisis saldría sin altura/peso/edad.
        if !bioLoaded { await loadBiometrics() }

        // El base64 de las fotos (ya reducidas) se prepara fuera del MainActor: eran varios MB.
        let frontData = frontJPEG, backData = backJPEG, objectiveData = objectiveJPEG
        let (frontURL, backURL, ownObjective) = await Task.detached(priority: .userInitiated) { () -> (String?, String?, String?) in
            (frontData?.dataURL, backData?.dataURL, objectiveData?.dataURL)
        }.value
        // Objetivo: la foto propia o la URL pública de la referencia (como la web).
        let objective = ownObjective ?? objectiveURL?.absoluteString

        struct Body: Encodable {
            let currentImage: String?; let backImage: String?; let objectiveImage: String?
            let height_cm: Double?; let weight_kg: Double?; let age: Int?; let gender: String?
        }
        do {
            // JSON en bruto: se guarda entero en scan_history (antes se perdía el detalle de Plus
            // al volver a codificar solo los campos que pintaba la app).
            let raw: Data = try await Backend.client.functions.invoke("analyze-physique", options: FunctionInvokeOptions(
                body: Body(currentImage: frontURL, backImage: backURL, objectiveImage: objective,
                           height_cm: bio.height, weight_kg: bio.weight, age: bio.age, gender: bio.gender))) { data, _ in data }
            let r = try JSONDecoder().decode(ScanResult.self, from: raw)
            let fullResult = try JSONDecoder().decode(AnyJSON.self, from: raw)
            // Paso real: la IA ya ha respondido; ahora se guarda en el historial.
            stage = .saving
            // Igual que la web: fotos al bucket privado y el resultado a scan_history.
            let stamp = Int(Date().timeIntervalSince1970 * 1000)
            // Las dos subidas a la vez: antes eran dos esperas en serie antes de guardar el scan.
            async let frontPath = upload(frontData, suffix: "front", userId: id, stamp: stamp)
            async let backPath = upload(backData, suffix: "back", userId: id, stamp: stamp)
            let (frontPhoto, backPhoto) = await (frontPath, backPath)
            struct Insert: Encodable {
                let user_id: UUID; let current_photo_url: String?; let back_photo_url: String?; let result: AnyJSON
                let attractiveness: Double?; let potential: Double?; let physique: Double?; let style: Double?
                let months_with_plan: Double?; let emailed_to: String?
            }
            // El guardado en el historial ya no se traga el error: si falla, se avisa.
            let insert = Insert(
                user_id: id, current_photo_url: frontPhoto, back_photo_url: backPhoto, result: fullResult,
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
            // Todos los pasos marcados: el último check se ve un instante antes del resultado.
            stage = .done
            if !reduceMotion { try? await Task.sleep(for: ScanLoading.revealDelay) }
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

/// Espera del scan, igual que la web (`src/shared/lib/scanLoading.ts`): los mismos pasos, cada uno
/// marcado cuando de verdad termina (sin porcentajes inventados), los mismos mensajes y la misma pausa.
enum ScanLoading {
    static let messages = [
        "Analizando postura…",
        "Detectando prioridades físicas…",
        "Calculando margen de mejora…",
        "Evaluando proporciones y simetría…",
        "Evaluando tu punto de partida…",
        "Generando tu diagnóstico personalizado…",
    ]
    /// Cada cuánto cambia el mensaje del paso activo.
    static let messageInterval: Duration = .milliseconds(1600)
    /// Con todo hecho, cuánto se ve el último check antes del resultado (`SCAN_REVEAL_MS`).
    static let revealDelay: Duration = .milliseconds(600)
    static let waitNote = "Suele tardar menos de un minuto."

    enum Stage: Equatable { case analyzing, saving, done }
    enum StepState { case done, active, pending }

    static let photosStep = "Fotos preparadas"
    static let analysisStep = "Análisis con IA"
    static let savingStep = "Guardado en tu historial"
    static let resultStep = "Tu resultado"

    /// Pasos con su estado (`scanSteps` en la web). `saves`: con cuenta se guarda antes del resultado.
    static func steps(_ stage: Stage, saves: Bool) -> [(label: String, state: StepState)] {
        let at = stage == .analyzing ? 0 : stage == .saving ? 1 : 2
        var list: [(label: String, state: StepState)] = [
            (photosStep, .done),
            (analysisStep, at == 0 ? .active : .done),
        ]
        if saves { list.append((savingStep, at == 0 ? .pending : at == 1 ? .active : .done)) }
        list.append((resultStep, at == 2 ? .done : .pending))
        return list
    }
}

/// La espera del análisis (como `ScanAnalyzing.tsx` en la web): la foto que se analiza con una línea
/// dorada que la recorre, «Analizando tu físico» y los pasos reales; el activo lleva el AP latiendo.
struct ScanAnalyzingView: View {
    let photo: PlatformImage?
    let stage: ScanLoading.Stage
    var saves = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var message = 0
    @State private var sweep = false

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            if let photo {
                ZStack(alignment: .top) {
                    Color.clear.overlay { Image(platformImage: photo).resizable().scaledToFill() }
                    LinearGradient(stops: [.init(color: .clear, location: 0.66), .init(color: .black.opacity(0.6), location: 1)],
                                   startPoint: .top, endPoint: .bottom)
                    if !reduceMotion && stage != .done { scanLine }
                }
                .frame(maxWidth: .infinity).frame(height: 320)
                .clipShape(RoundedRectangle(cornerRadius: Radius.hero, style: .continuous))
                .accessibilityHidden(true)
            }

            VStack(alignment: .leading, spacing: 4) {
                Text("Analizando tu físico").font(.apTitle1)
                    .accessibilityAddTraits(.isHeader)
                Text(ScanLoading.waitNote).font(.apSubhead).foregroundStyle(Palette.muted)
            }

            VStack(spacing: 0) {
                ForEach(Array(ScanLoading.steps(stage, saves: saves).enumerated()), id: \.offset) { index, step in
                    HStack(spacing: 14) {
                        indicator(step.state).frame(width: 28, height: 28)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(step.label).font(.apHeadline)
                                .foregroundStyle(step.state == .pending ? Palette.muted : Palette.foreground)
                            if step.state == .active && index == 1 {
                                Text(ScanLoading.messages[message]).font(.apFootnote).foregroundStyle(Palette.muted)
                                    .id(message)
                                    .transition(.opacity)
                            }
                        }
                        Spacer(minLength: 0)
                    }
                    .padding(.horizontal, 16).padding(.vertical, 12)
                    .frame(minHeight: 60)
                    .overlay(alignment: .top) {
                        if index > 0 { Rectangle().fill(Palette.separator).frame(height: 0.5) }
                    }
                    .accessibilityElement(children: .combine)
                    .accessibilityValue(step.state == .done ? "hecho" : step.state == .active ? "en curso" : "pendiente")
                }
            }
            .surface()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        // VoiceOver oye el paso cuando cambia, no cada mensaje que rota (como el `role="status"` de la web).
        .onChange(of: stage) { _, new in
            let active = ScanLoading.steps(new, saves: saves).first { $0.state == .active }
            A11y.announce(active.map { "\($0.label): en curso" } ?? "Análisis terminado")
        }
        .task(id: stage) {
            guard stage == .analyzing else { return }
            while !Task.isCancelled {
                try? await Task.sleep(for: ScanLoading.messageInterval)
                guard !Task.isCancelled else { return }
                withAnimation(reduceMotion ? nil : .easeInOut(duration: 0.2)) {
                    message = (message + 1) % ScanLoading.messages.count
                }
            }
        }
    }

    /// La línea que recorre la foto mientras la IA trabaja (sin ella con «Reducir movimiento»).
    private var scanLine: some View {
        VStack(spacing: 0) {
            LinearGradient(colors: [Palette.gold.opacity(0), Palette.gold.opacity(0.2)], startPoint: .top, endPoint: .bottom)
            Rectangle().fill(Palette.gold).frame(height: 2)
        }
        .frame(height: 64)
        .offset(y: sweep ? 256 : -62)
        .onAppear {
            withAnimation(.easeInOut(duration: 2.4).repeatForever(autoreverses: true)) { sweep = true }
        }
    }

    @ViewBuilder private func indicator(_ state: ScanLoading.StepState) -> some View {
        switch state {
        case .done:
            Image(systemName: "checkmark").font(.inter(size: 11, weight: .heavy)).foregroundStyle(Palette.background)
                .frame(width: 24, height: 24).background(Palette.gold, in: Circle())
        case .active:
            BrandMark(size: 20, beat: true)
        case .pending:
            Circle().strokeBorder(Palette.muted.opacity(0.4), lineWidth: 1.5).frame(width: 24, height: 24)
        }
    }
}

/// Resultado del análisis (mismo JSON que devuelve `analyze-physique`).
struct ScanResult: Codable {
    var physique: Double?
    var potential: Double?
    var attractiveness: Double?
    var style: Double?
    var similarity: Double?
    var months_with_plan: Double?
    var estimated_months: Double?
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
    /// Detalle de Plus («Lectura estimada por IA»), igual que en la web.
    var body_composition: BodyComposition?
    var muscle_breakdown: [MuscleScore]?
    var posture: Posture?
    var proportions: Proportions?
    var genetic_markers: [String]?
    var `protocol`: ScanProtocol?

    struct BodyComposition: Codable {
        var body_fat_pct: Double?; var lean_mass_kg: Double?; var weight_kg: Double?
        var somatotype: String?; var frame_size: String?; var fat_distribution: String?
    }
    struct MuscleScore: Codable, Hashable { var group: String; var score: Double; var verdict: String? }
    struct Posture: Codable { var issues: [String]?; var severity: String?; var note: String? }
    struct Proportions: Codable {
        var shoulder_to_waist_ratio: Double?; var v_taper_score: Double?; var symmetry_score: Double?
        var upper_lower_balance: String?; var weakest_link: String?
    }
    struct ScanProtocol: Codable {
        var training_days_per_week: Double?; var weekly_sets_priority: Double?; var calorie_adjustment_kcal: Double?
        var protein_g_per_kg: Double?; var cardio_minutes_per_week: Double?; var key_lifts: [String]?; var avoid: [String]?
    }

    /// Item de «Mejoras»: el JSON trae `label` y `priority`. Antes se decodificaban
    /// `title`/`description`, que no existen, y las tarjetas salían vacías.
    struct Improvement: Codable, Hashable { var label: String?; var priority: String? }
}

/// Formato del resultado y de su imagen para compartir: las mismas reglas que
/// `src/shared/lib/scanResultFormat.ts` en la web.
enum ScanFormat {
    /// «Tu objetivo»: el nombre del objetivo guardado en `onboarding.goal` (`SCAN_GOAL_LABELS` en la web).
    static let goalLabels = [
        "lose_weight": "Perder peso",
        "gain_muscle": "Ganar músculo",
        "improve_endurance": "Mejorar resistencia",
        "recomp": "Recomposición",
        "general_health": "Fuerza y salud",
    ]
    /// Nota de 0 a 10 con coma decimal («7,4»); sin dato, «—» (un 0 parecería una nota real).
    static func score(_ value: Double?) -> String { value.map { NumberText.decimal($0) } ?? "—" }
    static func sentence(_ s: String) -> String { s.prefix(1).uppercased() + s.dropFirst() }
    /// Notas con « · » que no se parten mal (`keepTogether` en la web): cada trozo corto va entero,
    /// una cifra nunca se separa de sus palabras y el «·» no empieza línea.
    static func keepTogether(_ s: String) -> String {
        s.components(separatedBy: " · ")
            .map { part in
                part.count <= 24
                    ? part.replacingOccurrences(of: " ", with: "\u{00A0}")
                    : part.replacingOccurrences(of: #" (\d[\d.,]*) "#, with: "\u{00A0}$1\u{00A0}", options: .regularExpression)
            }
            .joined(separator: "\u{00A0}· ")
    }
    /// «1 mes» / «6 meses».
    static func months(_ n: Int) -> String { "\(NumberText.grouped(Double(n))) \(n == 1 ? "mes" : "meses")" }
    /// «+300 kcal», «−250 kcal».
    static func signedKcal(_ n: Double) -> String { "\(n > 0 ? "+" : "")\(NumberText.grouped(n)) kcal" }
    static func isHighPriority(_ p: String?) -> Bool { p?.lowercased().contains("alta") == true }
    static func fraction(_ value: Double, max: Double = 10) -> Double { Swift.max(0, Swift.min(1, value / max)) }

    /// Meses hasta el físico objetivo: solo existen si se eligió un objetivo.
    static func objectiveMonths(_ r: ScanResult) -> (withPlan: Int, withoutPlan: Int?)? {
        guard let m = r.months_with_plan ?? r.estimated_months else { return nil }
        let withPlan = Swift.max(1, Int(m.rounded()))
        let without = r.months_without_plan.map { Swift.max(withPlan + 1, Int($0.rounded())) }
        return (withPlan, without)
    }

    /// Mejoras sin repetir «Lo que más te frena».
    static func improvements(_ r: ScanResult) -> [(label: String, priority: String?)] {
        let top = r.bottleneck?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        return (r.improvements ?? []).compactMap { item in
            let label = (item.label ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
            let priority = item.priority?.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !label.isEmpty, label.lowercased() != top else { return nil }
            return (label, (priority?.isEmpty ?? true) ? nil : priority)
        }
    }

    static let shareTitle = "Mi análisis físico"
    static let shareSubtitle = "Estimación visual con IA"
    static let shareHero = "Físico"
    static let shareFocus = "Foco"

    /// Tres cifras al pie: Potencial primero; con composición, la grasa estimada.
    static func shareStats(_ r: ScanResult) -> [(String, String)] {
        let fat = r.body_composition?.body_fat_pct
        let stats: [(String, Double?)] = fat != nil
            ? [("Potencial", r.potential), ("Grasa est.", fat), ("Atractivo", r.attractiveness)]
            : [("Potencial", r.potential), ("Atractivo", r.attractiveness), ("Estilo", r.style)]
        return stats.compactMap { label, value in
            guard let value else { return nil }
            return (label, label == "Grasa est." ? "\(NumberText.decimal(value)) %" : NumberText.decimal(value))
        }
    }

    static func shareHeadline(_ r: ScanResult) -> String? {
        [r.headline_diagnosis, r.summary]
            .compactMap { $0?.trimmingCharacters(in: .whitespacesAndNewlines) }
            .first { !$0.isEmpty }
    }

    /// Lo primero que trabajar: la mejora de prioridad alta o, si no, la primera («Espalda alta», con mayúscula).
    static func shareFocus(_ r: ScanResult) -> String? {
        let list = improvements(r)
        if let label = (list.first { isHighPriority($0.priority) } ?? list.first)?.label { return sentence(label) }
        let b = r.bottleneck?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return b.isEmpty ? nil : sentence(b)
    }

    /// «19 nov 2026».
    static func shareDate(_ d: Date = Date()) -> String {
        d.formatted(.dateTime.day().month(.abbreviated).year().locale(Locale(identifier: "es_ES")))
            .replacingOccurrences(of: ".", with: "")
    }
}

/// Resultado, calcado en la web por `ScanResultView.tsx` y en el mismo orden: tu foto con la nota
/// de físico, Atractivo · Potencial · Estilo, el objetivo (si lo hay), el resumen, «Qué mejorar»,
/// la lectura estimada por IA (Plus), lo que desbloquea Plus, «Compartir resumen» y «Hacer otro scan».
struct ScanResultView: View {
    let result: ScanResult
    /// La foto del propio scan (delante o, si no hay, espalda).
    var photo: PlatformImage? = nil
    var objectiveImage: PlatformImage? = nil
    var objectiveURL: URL? = nil
    var onAgain: () -> Void
    @State private var shareImage: Image?
    @State private var shareCardFailed = false

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            hero
            HStack(spacing: 12) {
                ScoreTile(label: "Atractivo", value: result.attractiveness)
                ScoreTile(label: "Potencial", value: result.potential, accent: true)
                ScoreTile(label: "Estilo", value: result.style)
            }
            if let months = ScanFormat.objectiveMonths(result) { objectiveCard(months) }
            if let s = result.summary?.trimmingCharacters(in: .whitespacesAndNewlines), !s.isEmpty {
                Text(s).font(.apBody).foregroundStyle(Palette.foreground.opacity(0.85))
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(18).frame(maxWidth: .infinity, alignment: .leading).surface()
            }
            improvementsSection
            if hasDetail { detail }
            if result.basic == true { plusCard }
            shareButton
            Button("Hacer otro scan") { Haptics.tap(); onAgain() }.buttonStyle(.pillSecondary)
        }
        .task { await prepareShareCard() }
    }

    // MARK: - Compartir

    @ViewBuilder private var shareButton: some View {
        if let shareImage {
            ShareLink(item: shareImage, preview: SharePreview(ScanFormat.shareTitle, image: shareImage)) {
                Label("Compartir resumen", systemImage: "square.and.arrow.up")
            }
            .buttonStyle(.pill)
        } else if shareCardFailed {
            VStack(alignment: .leading, spacing: 8) {
                Text("No se pudo crear la imagen. Inténtalo de nuevo.")
                    .font(.apFootnote).foregroundStyle(Palette.muted)
                Button("Reintentar") { Task { await prepareShareCard() } }.buttonStyle(.pillSecondary)
            }
        } else {
            Button {} label: { Label("Compartir resumen", systemImage: "square.and.arrow.up") }
                .buttonStyle(.pill).disabled(true)
        }
    }

    @MainActor
    private func prepareShareCard() async {
        guard let image = renderShareImage() else {
            shareCardFailed = true
            return
        }
        shareCardFailed = false
        shareImage = image
    }

    /// Historia de 1080 × 1920 con la misma composición que `renderScanStory` en la web.
    @MainActor
    private func renderShareImage() -> Image? {
        let card = ScanShareCardView(result: result).environment(\.colorScheme, .dark)
        let renderer = ImageRenderer(content: card)
        renderer.scale = 3
        #if os(iOS)
        guard let image = renderer.uiImage else { return nil }
        return Image(uiImage: image)
        #else
        guard let image = renderer.nsImage else { return nil }
        return Image(nsImage: image)
        #endif
    }

    // MARK: - Tu físico

    private var hero: some View {
        let has = result.physique != nil
        let headline = result.headline_diagnosis?.trimmingCharacters(in: .whitespacesAndNewlines)
        return VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .center, spacing: 16) {
                if let photo {
                    Color.clear.frame(width: 99, height: 132)
                        .overlay { Image(platformImage: photo).resizable().scaledToFill() }
                        .clipShape(RoundedRectangle(cornerRadius: Radius.media, style: .continuous))
                }
                VStack(alignment: .leading, spacing: 0) {
                    Text("Tu físico").font(.apTitle3)
                    // La cifra en Big Shoulders y su «/10» siempre en la misma línea.
                    HStack(alignment: .firstTextBaseline, spacing: 4) {
                        Text(ScanFormat.score(result.physique))
                            .font(.figure(size: 64))
                            .lineLimit(1).minimumScaleFactor(0.6)
                            .contentTransition(.numericText())
                        if has { Text("/10").font(.apTitle3).foregroundStyle(Palette.muted).fixedSize() }
                    }
                    .padding(.top, 8)
                    Text(has ? "Puntuación global de tu físico" : "Sin puntuación global")
                        .font(.apFootnote).foregroundStyle(Palette.muted)
                        .padding(.top, 6)
                }
                Spacer(minLength: 0)
            }
            if let headline, !headline.isEmpty {
                Text(headline).font(.apHeadline)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.top, 16)
            }
        }
        .padding(20)
        .frame(maxWidth: .infinity, alignment: .leading)
        .surface(Radius.hero)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Tu físico: \(has ? ScanFormat.score(result.physique) + " sobre 10" : "sin puntuación global"). \(headline ?? "")")
    }

    // MARK: - Objetivo

    private func objectiveCard(_ months: (withPlan: Int, withoutPlan: Int?)) -> some View {
        let similarity = result.similarity.flatMap { $0 > 0 ? Int($0.rounded()) : nil }
        return VStack(alignment: .leading, spacing: 16) {
            HStack(alignment: .center, spacing: 16) {
                objectiveThumb
                VStack(alignment: .leading, spacing: 0) {
                    Text("Hasta tu físico objetivo").font(.apFootnote).foregroundStyle(Palette.muted)
                    HStack(alignment: .firstTextBaseline, spacing: 6) {
                        Text(NumberText.grouped(Double(months.withPlan))).font(.figure(size: 40))
                        Text(months.withPlan == 1 ? "mes" : "meses").font(.apSubhead).foregroundStyle(Palette.muted)
                    }
                    .lineLimit(1)
                    .padding(.top, 4)
                    if let without = months.withoutPlan {
                        Text("Con plan, frente a unos \(ScanFormat.months(without)) sin plan.")
                            .font(.apFootnote.monospacedDigit()).foregroundStyle(Palette.muted)
                            .fixedSize(horizontal: false, vertical: true)
                            .padding(.top, 6)
                    }
                }
                Spacer(minLength: 0)
            }
            .accessibilityElement(children: .combine)
            if let similarity {
                meterRow("Similitud con tu objetivo", "\(similarity) %", Double(similarity) / 100, strong: similarity >= 70, note: nil)
            }
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .surface()
    }

    @ViewBuilder private var objectiveThumb: some View {
        if let objectiveImage {
            Color.clear.frame(width: 66, height: 88)
                .overlay { Image(platformImage: objectiveImage).resizable().scaledToFill() }
                .clipShape(RoundedRectangle(cornerRadius: Radius.chip, style: .continuous))
                .accessibilityHidden(true)
        } else if let objectiveURL {
            Color.clear.frame(width: 66, height: 88)
                .overlay {
                    CachedAsyncImage(url: objectiveURL, maxSide: 112) { $0.resizable().scaledToFill() } placeholder: { Palette.secondary }
                }
                .clipShape(RoundedRectangle(cornerRadius: Radius.chip, style: .continuous))
                .accessibilityHidden(true)
        }
    }

    // MARK: - Plus

    /// Scan básico: lo que se desbloquea con Plus (como `ScanPlusCard` de la web), en un grupo sin
    /// borde con la insignia Plus. Sin enlace de pago en iOS (normas de la App Store).
    private var plusCard: some View {
        let items = (result.locked_sections ?? []).isEmpty
            ? ["Composición corporal", "Puntuación por músculo", "Postura y proporciones", "Protocolo personalizado", "Tu yo futuro"]
            : (result.locked_sections ?? [])
        return VStack(alignment: .leading, spacing: 10) {
            VStack(alignment: .leading, spacing: 2) {
                Text("Análisis completo (Plus)").font(.apTitle3).accessibilityAddTraits(.isHeader)
                Text("Este es tu scan básico. Desbloquea el análisis avanzado de tu físico con recomendaciones personalizadas:")
                    .font(.apSubhead).foregroundStyle(Palette.muted).fixedSize(horizontal: false, vertical: true)
            }
            VStack(spacing: 0) {
                ForEach(Array(items.enumerated()), id: \.offset) { index, item in
                    HStack(spacing: 12) {
                        Image("lu-lock").renderingMode(.template).resizable().frame(width: 18, height: 18)
                            .foregroundStyle(Palette.muted).accessibilityHidden(true)
                        Text(item).font(.apSubhead.weight(.medium)).fixedSize(horizontal: false, vertical: true)
                        Spacer(minLength: 0)
                        PlusBadge()
                    }
                    .padding(.horizontal, 16).padding(.vertical, 12)
                    .frame(minHeight: 56)
                    .overlay(alignment: .top) {
                        if index > 0 { Rectangle().fill(Palette.separator).frame(height: 0.5) }
                    }
                    .accessibilityElement(children: .combine)
                }
            }
            .surface()
            Text("Incluido en Plus").font(.apFootnote.weight(.semibold)).foregroundStyle(Palette.gold)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    // MARK: - Lectura estimada por IA (Plus)

    private var hasDetail: Bool {
        result.body_composition != nil || !(result.muscle_breakdown ?? []).isEmpty || result.proportions != nil
            || !(result.posture?.issues ?? []).isEmpty || result.posture?.note != nil
            || !(result.genetic_markers ?? []).isEmpty || result.protocol != nil
    }

    /// Fila de un panel (`Panel` en la web): barra con nota, dato o texto, con separador fino entre filas.
    private enum PanelRow {
        case meter(String, String, Double, Bool, String?)
        case info(String, String)
        case text(String, muted: Bool)
    }

    private var detail: some View {
        VStack(alignment: .leading, spacing: 18) {
            VStack(alignment: .leading, spacing: 4) {
                Text("Lectura estimada por IA").font(.apTitle3).accessibilityAddTraits(.isHeader)
                Text("Es una estimación visual, no un diagnóstico médico.").font(.apFootnote).foregroundStyle(Palette.muted)
            }
            if let bc = result.body_composition {
                block("Composición corporal estimada") {
                    let candidates: [(String, Double, String, Bool)?] = [
                        bc.body_fat_pct.map { ("Grasa", $0, "%", true) },
                        bc.lean_mass_kg.map { ("Masa magra", $0, "kg", false) },
                        bc.weight_kg.map { ("Peso est.", $0, "kg", false) },
                    ]
                    let tiles = candidates.compactMap { $0 }
                    if !tiles.isEmpty {
                        HStack(spacing: 12) {
                            ForEach(Array(tiles.enumerated()), id: \.offset) { _, t in
                                UnitTile(label: t.0, value: t.1, unit: t.2, accent: t.3)
                            }
                        }
                    }
                    let infos: [PanelRow?] = [
                        bc.somatotype.map { PanelRow.info("Somatotipo", ScanFormat.sentence($0)) },
                        bc.frame_size.map { PanelRow.info("Estructura", ScanFormat.sentence($0)) },
                        bc.fat_distribution.map { PanelRow.info("Distribución de grasa", ScanFormat.sentence($0)) },
                    ]
                    let rows = infos.compactMap { $0 }
                    if !rows.isEmpty { panel(rows) }
                }
            }
            if let groups = result.muscle_breakdown, !groups.isEmpty {
                block("Lectura por grupo muscular") {
                    let rows: [PanelRow] = groups.map { m in
                        PanelRow.meter(ScanFormat.sentence(m.group), "\(NumberText.decimal(m.score))/10", ScanFormat.fraction(m.score), m.score >= 7,
                                       (m.verdict?.isEmpty == false) ? m.verdict : nil)
                    }
                    panel(rows)
                }
            }
            if let pr = result.proportions {
                block("Proporciones y simetría") {
                    let candidates: [PanelRow?] = [
                        pr.shoulder_to_waist_ratio.map { PanelRow.meter("Ratio hombro/cintura", NumberText.decimal($0, digits: 2), ScanFormat.fraction($0, max: 1.8), $0 >= 1.5, "Ideal ~1,60") },
                        pr.v_taper_score.map { PanelRow.meter("V-taper", "\(NumberText.decimal($0))/10", ScanFormat.fraction($0), $0 >= 7, nil) },
                        pr.symmetry_score.map { PanelRow.meter("Simetría", "\(NumberText.decimal($0))/10", ScanFormat.fraction($0), $0 >= 7, nil) },
                        pr.upper_lower_balance.map { PanelRow.info("Balance", ScanFormat.sentence($0)) },
                        pr.weakest_link.map { PanelRow.info("Eslabón más débil", ScanFormat.sentence($0)) },
                    ]
                    let rows = candidates.compactMap { $0 }
                    if !rows.isEmpty { panel(rows) }
                }
            }
            if let po = result.posture, !(po.issues ?? []).isEmpty || po.note != nil {
                block("Postura", badge: po.severity.map(ScanFormat.sentence)) {
                    let issues: [PanelRow] = (po.issues ?? []).map { PanelRow.text(ScanFormat.sentence($0), muted: false) }
                    let note: [PanelRow] = po.note.map { [PanelRow.text($0, muted: true)] } ?? []
                    panel(issues + note)
                }
            }
            if let markers = result.genetic_markers, !markers.isEmpty {
                block("Rasgos visuales que juegan a tu favor (o en contra)") {
                    let rows: [PanelRow] = markers.map { PanelRow.text(ScanFormat.sentence($0), muted: false) }
                    panel(rows)
                    Text("Señales observadas en tus fotos: no es un estudio genético.")
                        .font(.apFootnote).foregroundStyle(Palette.muted)
                }
            }
            if let pc = result.protocol {
                block("Protocolo recomendado por la IA") {
                    let candidates: [PanelRow?] = [
                        pc.training_days_per_week.map { PanelRow.info("Días de entreno por semana", NumberText.grouped($0)) },
                        pc.weekly_sets_priority.map { PanelRow.info("Series del grupo prioritario", NumberText.grouped($0)) },
                        pc.protein_g_per_kg.map { PanelRow.info("Proteína por kg", "\(NumberText.decimal($0)) g") },
                        pc.calorie_adjustment_kcal.map { PanelRow.info("Calorías frente a mantenimiento", ScanFormat.signedKcal($0)) },
                        pc.cardio_minutes_per_week.map { PanelRow.info("Cardio por semana", "\(NumberText.grouped($0)) min") },
                    ]
                    let rows = candidates.compactMap { $0 }
                    if !rows.isEmpty { panel(rows) }
                    if let lifts = pc.key_lifts, !lifts.isEmpty {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Ejercicios clave").font(.apSubhead.weight(.semibold))
                            FlowRow(spacing: 8) {
                                ForEach(Array(lifts.enumerated()), id: \.offset) { _, lift in
                                    Text(lift).font(.apSubhead)
                                        .padding(.horizontal, 12).padding(.vertical, 6)
                                        .background(Palette.card, in: Capsule())
                                }
                            }
                        }
                    }
                    if let avoid = pc.avoid, !avoid.isEmpty {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Evita").font(.apSubhead.weight(.semibold))
                            ForEach(Array(avoid.enumerated()), id: \.offset) { _, item in
                                HStack(alignment: .top, spacing: 10) {
                                    Image(systemName: "minus").font(.inter(size: 13, weight: .bold))
                                        .foregroundStyle(Palette.muted).padding(.top, 3).accessibilityHidden(true)
                                    Text(item).font(.apSubhead).foregroundStyle(Palette.muted)
                                        .fixedSize(horizontal: false, vertical: true)
                                }
                                .padding(.vertical, 4)
                            }
                        }
                    }
                }
            }
        }
    }

    private func block<Content: View>(_ title: String, badge: String? = nil,
                                      @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .center, spacing: 12) {
                Text(title).font(.apHeadline).fixedSize(horizontal: false, vertical: true)
                    .accessibilityAddTraits(.isHeader)
                Spacer(minLength: 0)
                if let badge {
                    // Gravedad de la postura: leve en gris; moderada o severa en dorado (nunca rojo de error).
                    let mild = badge.lowercased().contains("leve")
                    Text(badge).font(.apFootnote.weight(.semibold))
                        .foregroundStyle(mild ? Palette.muted : Palette.gold)
                        .padding(.horizontal, 10).padding(.vertical, 4)
                        .background(mild ? Palette.secondary : Palette.gold.opacity(0.15), in: Capsule())
                }
            }
            content()
        }
    }

    private func panel(_ rows: [PanelRow]) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            ForEach(Array(rows.enumerated()), id: \.offset) { index, row in
                Group {
                    switch row {
                    case let .meter(label, value, fraction, strong, note): meterRow(label, value, fraction, strong: strong, note: note)
                    case let .info(label, value): infoRow(label, value)
                    case let .text(text, muted):
                        Text(text).font(muted ? .apFootnote : .apSubhead)
                            .foregroundStyle(muted ? Palette.muted : Palette.foreground)
                            .fixedSize(horizontal: false, vertical: true)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(.vertical, 10)
                    }
                }
                .overlay(alignment: .top) {
                    if index > 0 { Rectangle().fill(Palette.separator).frame(height: 0.5) }
                }
            }
        }
        .padding(.horizontal, 18).padding(.vertical, 10)
        .frame(maxWidth: .infinity, alignment: .leading)
        .surface()
    }

    private func infoRow(_ label: String, _ value: String) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 12) {
            Text(label).font(.apSubhead)
            Spacer(minLength: 8)
            Text(value).font(.apSubhead.monospacedDigit()).foregroundStyle(Palette.muted).multilineTextAlignment(.trailing)
        }
        .padding(.vertical, 10)
        .accessibilityElement(children: .combine)
    }

    private func meterRow(_ label: String, _ value: String, _ fraction: Double, strong: Bool, note: String?) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(alignment: .firstTextBaseline, spacing: 12) {
                Text(label).font(.apSubhead.weight(.semibold))
                Spacer(minLength: 8)
                Text(value).font(.apSubhead.weight(.semibold).monospacedDigit())
                    .foregroundStyle(strong ? Palette.gold : Palette.foreground)
                    .lineLimit(1).fixedSize()
            }
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Capsule().fill(Palette.secondary)
                    Capsule().fill(strong ? Palette.gold : Palette.foreground.opacity(0.4))
                        .frame(width: geo.size.width * ScanFormat.fraction(fraction, max: 1))
                }
            }
            .frame(height: 6)
            .accessibilityHidden(true)
            if let note {
                Text(note).font(.apFootnote).foregroundStyle(Palette.muted).fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding(.vertical, 10)
        .accessibilityElement(children: .combine)
    }

    // MARK: - Qué mejorar

    @ViewBuilder private var improvementsSection: some View {
        let list = ScanFormat.improvements(result)
        let bottleneck = result.bottleneck?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        if !list.isEmpty || !bottleneck.isEmpty {
            VStack(alignment: .leading, spacing: 10) {
                Text("Qué mejorar").font(.apTitle3).accessibilityAddTraits(.isHeader)
                if !bottleneck.isEmpty {
                    HStack(alignment: .top, spacing: 14) {
                        IconTile(symbol: "target", size: 40)
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Lo que más te frena").font(.apFootnote).foregroundStyle(Palette.muted)
                            Text(ScanFormat.sentence(bottleneck)).font(.apHeadline)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                        Spacer(minLength: 0)
                    }
                    .padding(16)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .surface()
                    .accessibilityElement(children: .combine)
                }
                if !list.isEmpty {
                    VStack(spacing: 0) {
                        ForEach(Array(list.enumerated()), id: \.offset) { index, item in
                            HStack(alignment: .top, spacing: 12) {
                                Text("\(index + 1)")
                                    .font(.apFootnote.weight(.bold).monospacedDigit())
                                    .foregroundStyle(Palette.gold)
                                    .frame(width: 24, height: 24).background(Palette.gold.opacity(0.15), in: Circle())
                                VStack(alignment: .leading, spacing: 4) {
                                    Text(ScanFormat.sentence(item.label)).font(.apHeadline)
                                        .fixedSize(horizontal: false, vertical: true)
                                    if let priority = item.priority {
                                        let high = ScanFormat.isHighPriority(priority)
                                        Text("Prioridad \(priority.lowercased())")
                                            .font(.apFootnote.weight(.semibold))
                                            .foregroundStyle(high ? Palette.gold : Palette.muted)
                                            .padding(.horizontal, 8).padding(.vertical, 3)
                                            .background(high ? Palette.gold.opacity(0.15) : Palette.secondary, in: Capsule())
                                    }
                                }
                                Spacer(minLength: 0)
                            }
                            .padding(.horizontal, 16).padding(.vertical, 14)
                            .overlay(alignment: .top) {
                                if index > 0 { Rectangle().fill(Palette.separator).frame(height: 0.5) }
                            }
                            .accessibilityElement(children: .ignore)
                            .accessibilityLabel("Mejora \(index + 1): \(ScanFormat.sentence(item.label))\(item.priority.map { ". Prioridad \($0.lowercased())" } ?? "")")
                        }
                    }
                    .surface()
                }
            }
        }
    }
}

/// Nota de 0 a 10 con su «/10» en la misma línea (nunca se parte), como `ScoreTile` en la web.
private struct ScoreTile: View {
    let label: String
    let value: Double?
    var accent = false

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label).font(.apFootnote).foregroundStyle(Palette.muted).lineLimit(1).minimumScaleFactor(0.8)
            HStack(alignment: .firstTextBaseline, spacing: 2) {
                Text(ScanFormat.score(value)).font(.figure(size: 34))
                    .foregroundStyle(accent ? Palette.gold : Palette.foreground)
                    .lineLimit(1).minimumScaleFactor(0.6)
                if value != nil { Text("/10").font(.apFootnote).foregroundStyle(Palette.muted).fixedSize() }
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .surface()
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(label): \(value.map { NumberText.decimal($0) + " sobre 10" } ?? "sin datos")")
    }
}

/// Cifra de composición con su unidad pegada («18,5 %», «62,3 kg»), como `UnitTile` en la web.
private struct UnitTile: View {
    let label: String
    let value: Double
    let unit: String
    var accent = false

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label).font(.apFootnote).foregroundStyle(Palette.muted).lineLimit(1).minimumScaleFactor(0.8)
            HStack(alignment: .firstTextBaseline, spacing: 4) {
                Text(NumberText.decimal(value)).font(.figure(size: 28))
                    .foregroundStyle(accent ? Palette.gold : Palette.foreground)
                    .lineLimit(1).minimumScaleFactor(0.6)
                Text(unit).font(.apFootnote).foregroundStyle(Palette.muted).fixedSize()
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .surface()
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(label): \(NumberText.decimal(value)) \(unit)")
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
        // Versión reducida de Supabase (WebP); si el render fallara, la original.
        var loaded = try? await session.data(for: ImageCache.fastURL(url, maxSide: maxSide) ?? URLRequest(url: url))
        if (loaded?.1 as? HTTPURLResponse)?.statusCode ?? 0 >= 400 { loaded = try? await session.data(from: url) }
        guard let (data, _) = loaded else { return nil }
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
