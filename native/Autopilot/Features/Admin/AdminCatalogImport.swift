import SwiftUI
import Supabase

/// Admin → Biblioteca: importar el catálogo base (datos abiertos MIT, sin imágenes de terceros),
/// redactarlo con IA con la voz de Autopilot y publicarlo. Igual que `CatalogImport.tsx` en la web.
struct AdminCatalogImportCard: View {
    var onChanged: () -> Void

    struct Counts: Decodable { var draft: Int; var pending: Int; var published: Int; var draftCredits: Double }
    struct Preview: Decodable { var total: Int; var variants: Int; var alreadyImported: Int; var nameTaken: Int; var toImport: Int }
    private struct Imported: Decodable { var imported: Int }
    private struct ImportRequest: Encodable { let action: String; var limit: Int? = nil }
    private struct ImportFailure: Decodable { var error: String }

    @State private var counts: Counts?
    @State private var preview: Preview?
    @State private var busy = false
    @State private var drafting: (done: Int, total: Int)?
    @State private var stopDrafting = false
    @State private var confirmPublish = false
    @State private var message: String?

    var body: some View {
        Card(padding: 16) {
            Text("Catálogo base").font(.apHeadline)
            Text("Ejercicios con datos abiertos (licencia MIT), sin imágenes de terceros. Entran como borrador, la IA los reescribe con la voz de Autopilot y los publicas tú. El planificador no los usa hasta que los marques como aptos.")
                .font(.apFootnote).foregroundStyle(Palette.muted).fixedSize(horizontal: false, vertical: true)
            if let c = counts {
                Text("Borrador \(c.draft) · Pendientes de revisar \(c.pending) · Publicados \(c.published)").font(.apFootnote)
            }
            if let p = preview {
                Text("\(p.toImport) nuevos de \(p.total) · \(p.variants) variantes repetidas · \(p.alreadyImported + p.nameTaken) ya están en tu biblioteca")
                    .font(.apFootnote).foregroundStyle(Palette.muted)
            }
            if let d = drafting {
                Text("Redactando \(d.done) de \(d.total)").font(.apFootnote).foregroundStyle(Palette.muted)
                ProgressView(value: Double(d.done), total: Double(max(d.total, 1))).tint(Palette.gold)
                    .accessibilityLabel("Progreso de la redacción")
            }
            if let m = message { Text(m).font(.apFootnote).foregroundStyle(Palette.muted) }

            VStack(alignment: .leading, spacing: 10) {
                if let p = preview, p.toImport > 0 {
                    Button("Importar \(p.toImport) como borrador") { run { try await importAll() } }
                        .buttonStyle(.pill).disabled(busy)
                } else {
                    Button("Revisar importación") { run { preview = try await call(ImportRequest(action: "preview")) } }
                        .buttonStyle(.pillSecondary).disabled(busy)
                }
                if drafting != nil {
                    Button("Parar") { Haptics.tap(); stopDrafting = true }.buttonStyle(.pillSecondary)
                } else {
                    Button("Redactar con IA (\(counts?.draft ?? 0)) · ≈\(credits) créditos") { run { try await draftAll() } }
                        .buttonStyle(.pillSecondary).disabled(busy || (counts?.draft ?? 0) == 0)
                }
                if confirmPublish {
                    Button("Confirmar: publicar \(counts?.pending ?? 0)") { run { try await publish() } }
                        .buttonStyle(.pill).disabled(busy)
                } else {
                    Button("Publicar redactados (\(counts?.pending ?? 0))") { Haptics.tap(); confirmPublish = true }
                        .buttonStyle(.pillSecondary).disabled(busy || (counts?.pending ?? 0) == 0)
                }
            }
            .frame(maxWidth: 320, alignment: .leading)
        }
        .task { counts = try? await call(ImportRequest(action: "status")) }
    }

    private var credits: String {
        (counts?.draftCredits ?? 0).formatted(.number.precision(.fractionLength(0...1)).locale(Locale(identifier: "es")))
    }

    private func call<T: Decodable>(_ body: ImportRequest) async throws -> T {
        do {
            return try await Backend.client.functions.invoke("exercise-import", options: FunctionInvokeOptions(body: body))
        } catch FunctionsError.httpError(_, let data) {
            throw NSError(domain: "exercise-import", code: 0, userInfo: [
                NSLocalizedDescriptionKey: (try? JSONDecoder().decode(ImportFailure.self, from: data))?.error ?? "No se pudo completar",
            ])
        }
    }

    private func run(_ work: @escaping () async throws -> Void) {
        Haptics.tap()
        busy = true
        message = nil
        Task {
            do { try await work() } catch { message = error.localizedDescription }
            busy = false
        }
    }

    private func importAll() async throws {
        let r: Imported = try await call(ImportRequest(action: "import"))
        counts = try await call(ImportRequest(action: "status"))
        preview = nil
        message = "\(r.imported) ejercicios importados como borrador"
        onChanged()
    }

    private func draftAll() async throws {
        stopDrafting = false
        let total = counts?.draft ?? 0
        drafting = (0, total)
        defer { drafting = nil; onChanged() }
        while let c = counts, c.draft > 0, !stopDrafting {
            let next: Counts = try await call(ImportRequest(action: "draft", limit: 25))
            counts = next
            drafting = (total - next.draft, total)
            // Si una tanda no avanza, los que quedan fallan siempre: no se repite en bucle.
            if next.draft >= c.draft { message = "\(next.draft) borradores no se pudieron redactar"; break }
        }
    }

    private func publish() async throws {
        counts = try await call(ImportRequest(action: "publish"))
        confirmPublish = false
        message = "Ejercicios publicados"
        onChanged()
    }
}
