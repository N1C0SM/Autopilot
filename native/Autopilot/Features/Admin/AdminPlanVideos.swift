import SwiftUI
import Supabase

/// Lógica de «Generar vídeos de los ejercicios de los planes», la misma que `src/shared/lib/planVideos.ts`:
/// qué ejercicios usan los planes de los usuarios, cuáles no tienen vídeo todavía y cuánto cuesta crearlos.
enum PlanVideos {
    /// Un clip de técnica de 4 s (Veo 3.1 Fast en el AI Gateway de Lovable) cuesta unos 1,6 créditos.
    static let creditsPerClip = 1.6
    /// Lo que tarda como mucho un vídeo antes de darlo por atascado (suelen ser 1–3 minutos).
    static let deadline: TimeInterval = 10 * 60
    /// Cada cuánto se pregunta a `exercise-video` (acción `check`) si el vídeo ya está.
    static let pollSeconds = 8
    /// Dónde se activan los vídeos si están en pausa (`app_secrets.AI_VIDEO_ENABLED = "0"`).
    static let settingPath = "Admin → Landing → Claves de IA → Vídeos de ejercicios"

    static let title = "Vídeos de los planes"
    static let body = "Los ejercicios que usan los planes de tus usuarios, en movimiento: un clip de 4 s por ejercicio, hecho a partir de su foto. Los que ya tienen vídeo se saltan."
    static let button = "Generar vídeos de los ejercicios de los planes"
    static let counting = "Contando los ejercicios de los planes…"
    static let loadError = "No hemos podido contar los ejercicios de los planes."
    static let retry = "Reintentar"
    static let allDone = "Todos los ejercicios de los planes ya tienen su vídeo."
    static let noPlans = "Aún no hay ejercicios en los planes de tus usuarios."
    static let paused = "Vídeos en pausa"
    static let pausedHelp = "Los vídeos de técnica están en pausa. Actívalos en \(settingPath) y vuelve aquí."
    static let cancel = "Ahora no"
    static let stop = "Parar"
    static let stopping = "Parando al terminar este vídeo…"
    static let failures = "Para reintentar"
    static let keepOpen = "Mantén esta pantalla abierta: cada vídeo tarda de 1 a 3 minutos."
    static let creditsOut = "Se han acabado los créditos de IA: la cola se ha parado. Recarga créditos en Lovable y vuelve a pulsar el botón."

    struct Exercise: Decodable, Hashable {
        let id: String
        let name: String
        let image_url: String?
        let video_url: String?
    }

    struct Queue {
        var inPlans = 0
        var withVideo = 0
        var missing: [Exercise] = []
        var ready: [Exercise] = []
        var needPhoto: [Exercise] = []
    }

    private static func normalize(_ name: String) -> String {
        name.trimmingCharacters(in: .whitespacesAndNewlines).lowercased(with: Locale(identifier: "es"))
    }

    /// Ids y nombres de todos los ejercicios de todos los planes (`workouts_json`), sin repetir.
    static func keys(_ plans: [AnyJSON]) -> (ids: Set<String>, names: Set<String>) {
        var ids = Set<String>(), names = Set<String>()
        for plan in plans {
            for day in plan.arrayValue ?? [] {
                for entry in day.objectValue?["exercises"]?.arrayValue ?? [] {
                    guard let fields = entry.objectValue else { continue }
                    if let id = fields["exercise_id"]?.stringValue?.trimmingCharacters(in: .whitespaces), !id.isEmpty { ids.insert(id) }
                    if let name = fields["name"]?.stringValue, !normalize(name).isEmpty { names.insert(normalize(name)) }
                }
            }
        }
        return (ids, names)
    }

    /// Cruza la biblioteca con los planes (por id y, si no, por nombre) y separa con y sin vídeo.
    static func queue(_ library: [Exercise], ids: Set<String>, names: Set<String>) -> Queue {
        let has = { (value: String?) in !(value ?? "").trimmingCharacters(in: .whitespaces).isEmpty }
        let used = library.filter { ids.contains($0.id) || names.contains(normalize($0.name)) }
            .sorted { $0.name.compare($1.name, locale: Locale(identifier: "es")) == .orderedAscending }
        let missing = used.filter { !has($0.video_url) }
        return Queue(inPlans: used.count, withVideo: used.count - missing.count, missing: missing,
                     ready: missing.filter { has($0.image_url) }, needPhoto: missing.filter { !has($0.image_url) })
    }

    /// Créditos estimados: vídeos × 1,6, con un decimal.
    static func credits(_ count: Int) -> Double { (Double(max(0, count)) * creditsPerClip * 10).rounded() / 10 }

    /// «1,6», «19,2», «64».
    static func format(_ value: Double) -> String {
        value.formatted(.number.precision(.fractionLength(0...1)).locale(Locale(identifier: "es_ES")))
    }

    private static func number(_ n: Int) -> String { n.formatted(.number.locale(Locale(identifier: "es_ES"))) }
    private static func plural(_ n: Int, _ one: String, _ many: String) -> String { "\(number(n)) \(n == 1 ? one : many)" }

    /// «40 ejercicios en los planes · 28 con vídeo · 12 sin vídeo».
    static func summary(_ q: Queue) -> String {
        "\(plural(q.inPlans, "ejercicio", "ejercicios")) en los planes · \(number(q.withVideo)) con vídeo · \(number(q.missing.count)) sin vídeo"
    }

    /// «12 vídeos de 4 s · ≈19,2 créditos de Lovable (1,6 por vídeo)».
    static func estimate(_ n: Int) -> String {
        "\(plural(n, "vídeo", "vídeos")) de 4 s · ≈\(format(credits(n))) créditos de Lovable (\(format(creditsPerClip)) por vídeo)"
    }

    static func needPhoto(_ n: Int) -> String {
        n == 1
            ? "1 necesita antes su foto (el vídeo parte de ella): créala desde su ficha y entrará en la siguiente tanda."
            : "\(number(n)) necesitan antes su foto (el vídeo parte de ella): créala desde su ficha y entrarán en la siguiente tanda."
    }

    static func confirmTitle(_ n: Int) -> String { "¿Generar \(plural(n, "vídeo", "vídeos"))?" }
    static func confirmAction(_ n: Int) -> String { "Generar \(plural(n, "vídeo", "vídeos"))" }
    static func confirmBody(_ n: Int) -> String {
        "Se creará un clip de 4 s para cada ejercicio de los planes que aún no tiene vídeo, uno detrás de otro. Coste estimado: ≈\(format(credits(n))) créditos de Lovable (\(format(creditsPerClip)) por vídeo). Los que ya tienen vídeo se saltan y puedes parar cuando quieras."
    }

    /// «Generando 12 de 40».
    static func progress(_ current: Int, _ total: Int) -> String { "Generando \(number(current)) de \(number(total))" }

    static func done(created: Int, total: Int, stopped: Bool) -> String {
        stopped
            ? "Parado: \(number(created)) de \(plural(total, "vídeo creado", "vídeos creados"))."
            : "Listo: \(plural(created, "vídeo nuevo", "vídeos nuevos"))."
    }

    /// ¿Error de saldo? Entonces se para la cola entera en vez de fallar uno a uno.
    static func isCreditsError(_ message: String) -> Bool {
        message.range(of: "créditos|credit limit|sin saldo|insufficient_quota|402", options: [.regularExpression, .caseInsensitive]) != nil
    }
}

/// Admin → Biblioteca: «Generar vídeos de los ejercicios de los planes», como `PlanVideos.tsx` en la web.
/// Cuenta los ejercicios que usan los planes y aún no tienen vídeo, enseña el coste, pide confirmación
/// y los crea uno a uno con `exercise-video` (create → check), saltando los que ya tienen vídeo, con
/// «Parar» al terminar el actual. Con los vídeos en pausa en Claves de IA lo dice y no lanza nada.
struct AdminPlanVideosCard: View {
    var onChanged: () -> Void

    private struct Failure: Hashable { let name: String; let message: String }
    private struct Run { var current = 0; var total = 0; var name = ""; var created = 0; var stopping = false }
    private struct VideoResponse: Decodable { let paused: Bool?; let status: String?; let video_url: String?; let error: String? }
    private struct VideoFailure: Decodable { let error: String }
    private struct VideoRequest: Encodable { let exercise_id: String; let action: String }
    private struct PlanRow: Decodable { let workouts_json: AnyJSON? }
    private struct Secret: Decodable { let value: String? }

    @State private var queue: PlanVideos.Queue?
    @State private var paused = false
    @State private var failed = false
    @State private var confirming = false
    @State private var run: Run?
    @State private var failures: [Failure] = []
    @State private var outcome: String?
    @State private var stopRequested = false
    @State private var worker: Task<Void, Never>?

    private var ready: Int { queue?.ready.count ?? 0 }
    private var missing: Int { queue?.missing.count ?? 0 }

    var body: some View {
        Card(padding: 16) {
            Text(PlanVideos.title).font(.apHeadline).accessibilityAddTraits(.isHeader)
            Text(PlanVideos.body).font(.apFootnote).foregroundStyle(Palette.muted).fixedSize(horizontal: false, vertical: true)

            if failed {
                HStack(spacing: 12) {
                    Text(PlanVideos.loadError).font(.apFootnote).foregroundStyle(Palette.muted)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    Button(PlanVideos.retry) { Haptics.tap(); Task { await count() } }
                        .buttonStyle(.pillSecondary).fixedSize()
                }
            } else if let q = queue {
                if q.inPlans > 0 {
                    // Las dos cifras que deciden: cuántos faltan y cuánto cuestan.
                    HStack(spacing: 12) {
                        figure(PlanVideos.format(Double(missing)), "sin vídeo")
                        figure("≈\(PlanVideos.format(PlanVideos.credits(ready)))", "créditos de Lovable")
                    }
                }
                Text(q.inPlans == 0 ? PlanVideos.noPlans : missing == 0 ? PlanVideos.allDone : PlanVideos.summary(q))
                    .font(.apFootnote.monospacedDigit())
                    .fixedSize(horizontal: false, vertical: true)
                if ready > 0, run == nil {
                    Text(PlanVideos.estimate(ready)).font(.apFootnote.monospacedDigit()).foregroundStyle(Palette.muted)
                        .fixedSize(horizontal: false, vertical: true)
                }
                if !q.needPhoto.isEmpty, run == nil {
                    Text(PlanVideos.needPhoto(q.needPhoto.count)).font(.apFootnote).foregroundStyle(Palette.muted)
                        .fixedSize(horizontal: false, vertical: true)
                }
            } else {
                Text(PlanVideos.counting).font(.apFootnote).foregroundStyle(Palette.muted)
            }

            if let r = run {
                HStack(spacing: 12) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(PlanVideos.progress(max(r.current, 1), r.total)).font(.apSubhead.weight(.semibold).monospacedDigit())
                        Text(r.stopping ? PlanVideos.stopping : r.name).font(.apFootnote).foregroundStyle(Palette.muted).lineLimit(1)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    Button(PlanVideos.stop) { Haptics.tap(); stopRequested = true; run?.stopping = true }
                        .buttonStyle(.pillSecondary).fixedSize()
                        .disabled(r.stopping)
                }
                ProgressView(value: Double(max(r.current - 1, 0)), total: Double(max(r.total, 1)))
                    .tint(Palette.gold)
                    .accessibilityLabel("Progreso de los vídeos")
                    .accessibilityValue(PlanVideos.progress(max(r.current, 1), r.total))
                Text(PlanVideos.keepOpen).font(.apFootnote).foregroundStyle(Palette.muted).fixedSize(horizontal: false, vertical: true)
            }

            if let outcome, run == nil { Text(outcome).font(.apFootnote).fixedSize(horizontal: false, vertical: true) }

            if !failures.isEmpty {
                VStack(alignment: .leading, spacing: 4) {
                    Text("\(PlanVideos.failures) (\(failures.count))").font(.apFootnote.weight(.semibold))
                    ForEach(Array(failures.enumerated()), id: \.offset) { _, f in
                        (Text(f.name).foregroundStyle(Palette.foreground) + Text(" · \(f.message)").foregroundStyle(Palette.muted))
                            .font(.apFootnote).fixedSize(horizontal: false, vertical: true)
                    }
                }
            }

            if paused {
                Button(PlanVideos.paused) {}.buttonStyle(.pillSecondary).disabled(true).frame(maxWidth: 320, alignment: .leading)
                Text(PlanVideos.pausedHelp).font(.apFootnote).foregroundStyle(Palette.muted).fixedSize(horizontal: false, vertical: true)
            } else if run == nil {
                Button { Haptics.tap(); confirming = true } label: {
                    Text(PlanVideos.button).multilineTextAlignment(.center).fixedSize(horizontal: false, vertical: true)
                }
                .buttonStyle(.pillSecondary)
                .frame(maxWidth: 380, alignment: .leading)
                .disabled(queue == nil || ready == 0)
            }
        }
        .task { await count() }
        .onDisappear { stopRequested = true; worker?.cancel() }
        .confirmationDialog(PlanVideos.confirmTitle(ready), isPresented: $confirming, titleVisibility: .visible) {
            Button(PlanVideos.confirmAction(ready)) { start() }
            Button(PlanVideos.cancel, role: .cancel) {}
        } message: {
            Text(PlanVideos.confirmBody(ready))
        }
    }

    private func figure(_ value: String, _ label: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(value).font(.figure(size: 34)).monospacedDigit().lineLimit(1).minimumScaleFactor(0.7)
            Text(label).font(.apFootnote).foregroundStyle(Palette.muted).lineLimit(1)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 16).padding(.vertical, 12)
        .background(Palette.secondary, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        .accessibilityElement(children: .combine)
    }

    /// Lee todo por páginas de 1.000 (el límite de Supabase) con los permisos del admin.
    @discardableResult
    private func count() async -> (queue: PlanVideos.Queue, paused: Bool)? {
        failed = false
        do {
            var plans: [AnyJSON] = []
            var from = 0
            while true {
                let rows: [PlanRow] = try await Backend.client.from("training_plan").select("workouts_json")
                    .range(from: from, to: from + 999).execute().value
                plans += rows.compactMap(\.workouts_json)
                if rows.count < 1000 { break }
                from += 1000
            }
            var library: [PlanVideos.Exercise] = []
            from = 0
            while true {
                let rows: [PlanVideos.Exercise] = try await Backend.client.from("exercises").select("id, name, image_url, video_url")
                    .order("name").range(from: from, to: from + 999).execute().value
                library += rows
                if rows.count < 1000 { break }
                from += 1000
            }
            // Solo se lee el interruptor de Claves de IA; nunca se cambia desde aquí.
            let secrets: [Secret] = (try? await Backend.client.from("app_secrets").select("value")
                .eq("key", value: "AI_VIDEO_ENABLED").limit(1).execute().value) ?? []
            let keys = PlanVideos.keys(plans)
            let next = PlanVideos.queue(library, ids: keys.ids, names: keys.names)
            let isPaused = secrets.first?.value == "0"
            queue = next
            paused = isPaused
            return (next, isPaused)
        } catch {
            failed = true
            return nil
        }
    }

    private func call(_ exerciseId: String, _ action: String) async throws -> VideoResponse {
        do {
            let r: VideoResponse = try await Backend.client.functions.invoke(
                "exercise-video", options: FunctionInvokeOptions(body: VideoRequest(exercise_id: exerciseId, action: action)))
            if let e = r.error { throw NSError(domain: "exercise-video", code: 0, userInfo: [NSLocalizedDescriptionKey: e]) }
            return r
        } catch FunctionsError.httpError(_, let data) {
            throw NSError(domain: "exercise-video", code: 0, userInfo: [
                NSLocalizedDescriptionKey: (try? JSONDecoder().decode(VideoFailure.self, from: data))?.error ?? "No se pudo crear el vídeo",
            ])
        }
    }

    private func start() {
        outcome = nil
        failures = []
        stopRequested = false
        worker = Task { await generate() }
    }

    /// Uno detrás de otro: crear, esperar a que esté y pasar al siguiente.
    private func generate() async {
        // Con datos recién leídos: lo que haya conseguido vídeo entretanto se salta.
        guard let fresh = await count(), !fresh.paused else { return }
        let list = fresh.queue.ready
        var created = 0, stopped = false, creditsOut = false
        run = Run(total: list.count)
        for (i, exercise) in list.enumerated() {
            if stopRequested || Task.isCancelled { stopped = true; break }
            run?.current = i + 1
            run?.name = exercise.name
            do {
                let started = try await call(exercise.id, "create")
                if started.paused == true { paused = true; stopped = true; break }
                var url = started.status == "completed" ? started.video_url : nil
                let deadline = Date().addingTimeInterval(PlanVideos.deadline)
                while url == nil, Date() < deadline, !Task.isCancelled {
                    try await Task.sleep(for: .seconds(PlanVideos.pollSeconds))
                    let status = try await call(exercise.id, "check")
                    if status.status == "completed", let u = status.video_url { url = u }
                    else if status.status == "failed" {
                        throw NSError(domain: "exercise-video", code: 0, userInfo: [NSLocalizedDescriptionKey: status.error ?? "La generación del vídeo falló"])
                    }
                }
                if url == nil { throw NSError(domain: "exercise-video", code: 0, userInfo: [NSLocalizedDescriptionKey: "Sigue generándose: aparecerá en su ficha en unos minutos"]) }
                created += 1
                run?.created = created
            } catch is CancellationError {
                stopped = true
                break
            } catch {
                let message = error.localizedDescription
                failures.append(Failure(name: exercise.name, message: message))
                // Sin saldo: se para toda la cola en vez de fallar uno a uno.
                if PlanVideos.isCreditsError(message) { creditsOut = true; break }
            }
        }
        run = nil
        if failures.isEmpty { Haptics.success() } else { Haptics.warning() }
        outcome = creditsOut ? PlanVideos.creditsOut : PlanVideos.done(created: created, total: list.count, stopped: stopped)
        onChanged()
        await count()
    }
}
