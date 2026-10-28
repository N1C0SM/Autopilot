import SwiftUI
import Supabase

/// Reglas, calcado de `TrainingRulesEditor.tsx`: configuración del motor Autopilot en grupos
/// (volumen, series por prioridad, repeticiones y descanso por estímulo, límites, patrones y recuperación).
struct AdminRulesView: View {
    @State private var row: [String: AnyJSON] = [:]
    @State private var loading = true
    @State private var failed = false
    @State private var saving = false
    @State private var toast: String?

    private static let stimuli = [("fuerza", "Fuerza"), ("hipertrofia", "Hipertrofia"), ("resistencia", "Resistencia"), ("isometrico", "Isométrico")]
    private static let patterns = ["Empuje", "Tirón", "Sentadilla", "Bisagra", "Core", "Aislamiento"]
    private static let defaults: [String: AnyJSON] = [
        "min_sets_per_session": 12, "max_sets_per_session": 20,
        "series_p1_min": 3, "series_p1_max": 5, "series_p2_min": 3, "series_p2_max": 4, "series_p3_min": 2, "series_p3_max": 3,
        "reps_fuerza": "4-8", "reps_hipertrofia": "8-15", "reps_resistencia": "15-25", "reps_isometrico": "20-60s",
        "rest_fuerza": "180s", "rest_hipertrofia": "90s", "rest_resistencia": "45s", "rest_isometrico": "60s",
        "max_consecutive_high_fatigue": 2, "max_heavy_hinges": 1, "max_pattern_repeats": 2, "push_pull_max_diff": 1,
        "max_p2_exercises": 2, "max_p3_exercises": 2,
        "required_patterns": .array(["Empuje", "Tirón", "Sentadilla", "Bisagra", "Core"].map { .string($0) }),
        "recovery_hours": .object(["Pecho": 48, "Espalda": 48, "Hombros": 48, "Bíceps": 36, "Tríceps": 36, "Piernas": 72, "Glúteos": 48, "Core": 24, "Cuerpo completo": 48, "Cardio": 24]),
    ]

    var body: some View {
        ScrollView {
            if loading {
                AdminLoadingView(message: "Cargando las reglas del motor")
            } else if failed {
                AdminErrorCard(message: "No se pudieron cargar las reglas de generación. Comprueba la conexión y vuelve a intentarlo.") {
                    Task { await load() }
                }
                .padding(20)
            } else if row.isEmpty {
                EmptyStateView(symbol: "slider.horizontal.3", title: "Sin reglas", message: "No se encontraron reglas de generación.")
                    .padding(20)
            } else {
                VStack(alignment: .leading, spacing: 24) {
                    AdminPaneHeader("Cómo monta Autopilot cada sesión: volumen, series por prioridad, repeticiones, descansos, límites y recuperación.") {
                        AdminTextButton(title: "Restablecer valores", systemImage: "arrow.counterclockwise") { resetDefaults() }
                    }
                    group("Volumen por sesión") {
                        numberRow("Mínimo de series", "min_sets_per_session", first: true)
                        numberRow("Máximo de series", "max_sets_per_session")
                    }
                    group("Series por prioridad", footer: "Mínimo y máximo de series para cada prioridad.") {
                        rangeRow("P1 (Base)", "series_p1", first: true)
                        rangeRow("P2 (Desarrollo)", "series_p2")
                        rangeRow("P3 (Accesorio)", "series_p3")
                    }
                    group("Repeticiones por estímulo", footer: "Rango de repeticiones por serie, por ejemplo 8-15.") {
                        ForEach(Array(Self.stimuli.enumerated()), id: \.offset) { i, s in textRow(s.1, "reps_\(s.0)", first: i == 0) }
                    }
                    group("Descanso por estímulo", footer: "Tiempo entre series, por ejemplo 90s.") {
                        ForEach(Array(Self.stimuli.enumerated()), id: \.offset) { i, s in textRow(s.1, "rest_\(s.0)", first: i == 0) }
                    }
                    group("Límites de estructura") {
                        numberRow("Máx. fatiga alta seguidas", "max_consecutive_high_fatigue", first: true)
                        numberRow("Máx. bisagras pesadas", "max_heavy_hinges")
                        numberRow("Máx. repetición de patrón", "max_pattern_repeats")
                        numberRow("Diferencia máx. empuje/tirón", "push_pull_max_diff")
                        numberRow("Máx. ejercicios P2", "max_p2_exercises")
                        numberRow("Máx. ejercicios P3", "max_p3_exercises")
                    }
                    group("Patrones obligatorios") {
                        FlowRow(spacing: 8) {
                            ForEach(Self.patterns, id: \.self) { p in
                                AdminChip(title: p, selected: requiredPatterns.contains(p)) { togglePattern(p) }
                            }
                        }
                        .padding(.horizontal, 16)
                        .padding(.vertical, 12)
                    }
                    group("Horas de recuperación por músculo") {
                        ForEach(Array(recovery.keys.sorted().enumerated()), id: \.element) { i, muscle in
                            HStack(spacing: 8) {
                                Text(muscle).font(.apBody).lineLimit(1).minimumScaleFactor(0.85)
                                Spacer(minLength: 12)
                                AdminNumberField(label: "Horas de recuperación de \(muscle)",
                                                 value: Binding(get: { recovery[muscle] ?? 0 }, set: { setRecovery(muscle, $0) }),
                                                 width: 64)
                                Text("h").font(.apSubhead).foregroundStyle(Palette.muted)
                            }
                            .rowStyle(first: i == 0)
                        }
                    }
                    Button { Task { await save() } } label: { if saving { BrandLoader().tint(.black) } else { Text("Guardar reglas") } }
                        .buttonStyle(.pill).frame(maxWidth: 320).disabled(saving)
                }
                .padding(20).frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .screenBackground()
        .overlay(alignment: .top) { ToastView(text: toast) }
        .task { await load() }
    }

    // MARK: Valores

    private func int(_ key: String) -> Int {
        switch row[key] { case .integer(let i): i; case .double(let d): Int(d); default: 0 }
    }
    private func str(_ key: String) -> String { if case .string(let s) = row[key] { return s }; return "" }
    private var requiredPatterns: [String] {
        if case .array(let a) = row["required_patterns"] { return a.compactMap { if case .string(let s) = $0 { return s }; return nil } }
        return []
    }
    private var recovery: [String: Int] {
        guard case .object(let o) = row["recovery_hours"] else { return [:] }
        return o.compactMapValues { switch $0 { case .integer(let i): i; case .double(let d): Int(d); default: nil } }
    }
    private func togglePattern(_ p: String) {
        Haptics.selection()
        var list = requiredPatterns
        if let i = list.firstIndex(of: p) { list.remove(at: i) } else { list.append(p) }
        row["required_patterns"] = .array(list.map { .string($0) })
    }
    private func setRecovery(_ muscle: String, _ hours: Int) {
        var o = recovery
        o[muscle] = hours
        row["recovery_hours"] = .object(o.mapValues { .integer($0) })
    }

    // MARK: Filas

    private func group<C: View>(_ header: String, footer: String? = nil, @ViewBuilder content: () -> C) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            ListGroupView(header: header) { content() }
            if let footer {
                Text(footer).font(.apFootnote).foregroundStyle(Palette.muted).padding(.horizontal, 16)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }

    private func numberRow(_ label: String, _ key: String, first: Bool = false) -> some View {
        HStack(spacing: 8) {
            Text(label).font(.apBody)
            Spacer(minLength: 12)
            AdminNumberField(label: label, value: Binding(get: { int(key) }, set: { row[key] = .integer($0) }), width: 64)
        }
        .rowStyle(first: first)
    }

    private func rangeRow(_ label: String, _ prefix: String, first: Bool = false) -> some View {
        HStack(spacing: 8) {
            Text(label).font(.apBody).lineLimit(1).minimumScaleFactor(0.85)
            Spacer(minLength: 12)
            AdminNumberField(label: "\(label), mínimo de series",
                             value: Binding(get: { int("\(prefix)_min") }, set: { row["\(prefix)_min"] = .integer($0) }), width: 56)
            Text("–").foregroundStyle(Palette.muted)
            AdminNumberField(label: "\(label), máximo de series",
                             value: Binding(get: { int("\(prefix)_max") }, set: { row["\(prefix)_max"] = .integer($0) }), width: 56)
        }
        .rowStyle(first: first)
    }

    private func textRow(_ label: String, _ key: String, first: Bool = false) -> some View {
        HStack(spacing: 8) {
            Text(label).font(.apBody)
            Spacer(minLength: 12)
            AdminCompactField(label: label, text: Binding(get: { str(key) }, set: { row[key] = .string($0) }),
                              width: 96, monospaced: false)
        }
        .rowStyle(first: first)
    }

    // MARK: Datos

    private func load() async {
        loading = true
        do {
            let rows: [[String: AnyJSON]] = try await Backend.client.from("training_rules").select().limit(1).execute().value
            row = rows.first ?? [:]
            if !row.isEmpty {
                if requiredPatterns.isEmpty { row["required_patterns"] = Self.defaults["required_patterns"] }
                if recovery.isEmpty { row["recovery_hours"] = Self.defaults["recovery_hours"] }
            }
            failed = false
        } catch {
            failed = true
        }
        loading = false
    }

    private func resetDefaults() {
        Haptics.tap()
        for (k, v) in Self.defaults { row[k] = v }
        show("Valores por defecto restaurados (guarda para aplicar)")
    }

    private func save() async {
        guard case .string(let id) = row["id"] else { return }
        saving = true; defer { saving = false }
        var patch = row
        patch["id"] = nil
        patch["created_at"] = nil
        patch["updated_at"] = nil
        do {
            try await Backend.client.from("training_rules").update(patch).eq("id", value: id).execute()
            Haptics.success(); show("Reglas actualizadas")
        } catch { Haptics.error(); show("Error al guardar") }
    }

    private func show(_ t: String) { toast = t; Task { try? await Task.sleep(for: .seconds(2.5)); toast = nil } }
}

// MARK: - Piezas compartidas de Admin

// Mismas piezas en todas las pantallas de administración para que el Admin no parezca otra app:
// cabecera, tarjetas de filas, píldoras, campos, separadores y estados de carga/vacío/error.
// Los colores salen de `Palette`, los radios de `Radius` y la tipografía de la escala `.ap*`.

/// Cabecera de una pantalla de Admin: contexto y acciones. El título lo pone la navegación.
struct AdminPaneHeader<Actions: View>: View {
    private let text: String
    private let actions: Actions

    init(_ text: String, @ViewBuilder actions: () -> Actions) {
        self.text = text
        self.actions = actions()
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text(text)
                .font(.apSubhead)
                .foregroundStyle(Palette.muted)
                .fixedSize(horizontal: false, vertical: true)
            actions
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

extension AdminPaneHeader where Actions == EmptyView {
    init(_ text: String) { self.init(text) { EmptyView() } }
}

/// Tarjeta con filas pegadas (sin cabecera propia). Las separaciones las pone `rowStyle`.
struct AdminRows<Content: View>: View {
    private let content: Content

    init(@ViewBuilder content: () -> Content) { self.content = content() }

    var body: some View {
        VStack(spacing: 0) { content }
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Palette.card, in: RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
    }
}

/// Fila de lista de Admin: lo que la identifica (miniatura o icono), título, detalle y accesorios.
struct AdminListRow<Leading: View, Trailing: View>: View {
    private let title: String
    private let detail: String?
    private let leading: Leading
    private let trailing: Trailing

    init(_ title: String, detail: String? = nil,
         @ViewBuilder leading: () -> Leading,
         @ViewBuilder trailing: () -> Trailing) {
        self.title = title
        self.detail = detail
        self.leading = leading()
        self.trailing = trailing()
    }

    var body: some View {
        HStack(spacing: 12) {
            leading
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(.apBody).foregroundStyle(Palette.foreground).lineLimit(2)
                if let detail, !detail.isEmpty {
                    Text(detail).font(.apFootnote).foregroundStyle(Palette.muted).lineLimit(2)
                }
            }
            Spacer(minLength: 8)
            trailing
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .frame(minHeight: 56)
        .contentShape(Rectangle())
    }
}

/// Píldora de estado (Publicado, Borrador, Visible, Oculto, plan…).
struct AdminStatusPill: View {
    let text: String
    var tint: Color = Palette.muted

    var body: some View {
        Text(text)
            .font(.apCaption.weight(.semibold))
            .foregroundStyle(tint)
            .lineLimit(1).minimumScaleFactor(0.8)
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .background(tint.opacity(0.15), in: Capsule())
    }
}

/// Chip de filtro o segmento; la opción activa va en dorado suave.
struct AdminChip: View {
    let title: String
    var selected = false
    var monospaced = false
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(monospaced ? .inter(size: 13, weight: .regular, design: .monospaced, relativeTo: .footnote) : .apSubhead.weight(.medium))
                .lineLimit(1).minimumScaleFactor(0.7)
                .foregroundStyle(selected ? Palette.gold : Palette.muted)
                .padding(.horizontal, 14)
                .frame(minHeight: 44)
                .background(selected ? Palette.gold.opacity(0.15) : Palette.secondary, in: Capsule())
                .contentShape(Capsule())
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(selected ? .isSelected : [])
    }
}

/// Botón de icono con área táctil de 44 pt y etiqueta para VoiceOver.
struct AdminIconButton: View {
    let symbol: String
    let label: String
    var tint: Color = Palette.muted
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: symbol)
                .font(.inter(.body).weight(.semibold))
                .foregroundStyle(tint)
                .frame(width: 44, height: 44)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
    }
}

/// Acción secundaria de texto (dorada o destructiva) con área táctil de 44 pt.
struct AdminTextButton: View {
    let title: String
    var systemImage: String? = nil
    var tint: Color = Palette.gold
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 6) {
                if let systemImage {
                    Image(systemName: systemImage).font(.inter(.footnote).weight(.semibold))
                }
                Text(title).font(.apSubhead.weight(.semibold)).lineLimit(1).minimumScaleFactor(0.8)
            }
            .foregroundStyle(tint)
            .frame(minHeight: 44)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}

/// Acción pequeña en píldora dentro de una fila (guardar una clave o un campo).
struct AdminSmallAction: View {
    let title: String
    var tint: Color = Palette.gold
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.apSubhead.weight(.semibold))
                .lineLimit(1)
                .foregroundStyle(tint)
                .padding(.horizontal, 14)
                .frame(minHeight: 44)
                .background(tint.opacity(0.15), in: Capsule())
                .contentShape(Capsule())
        }
        .buttonStyle(.plain)
    }
}

/// Estado de carga común: indicador centrado y etiqueta para VoiceOver.
struct AdminLoadingView: View {
    var message = "Cargando…"

    var body: some View {
        BrandLoader()
            .tint(Palette.gold)
            .frame(maxWidth: .infinity)
            .padding(.top, 60)
            .accessibilityLabel(message)
    }
}

/// Estado de error común: tarjeta con icono, mensaje y «Reintentar».
struct AdminErrorCard: View {
    var title = "No se pudo cargar"
    let message: String
    let retry: () -> Void

    var body: some View {
        Card {
            HStack(alignment: .top, spacing: 12) {
                IconTile(symbol: "exclamationmark.triangle", size: 40, tint: Palette.destructive)
                VStack(alignment: .leading, spacing: 2) {
                    Text(title).font(.apHeadline)
                    Text(message).font(.apFootnote).foregroundStyle(Palette.muted)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            Button("Reintentar") { retry() }
                .buttonStyle(.pillSecondary)
                .frame(maxWidth: 240)
        }
    }
}

/// Campo numérico compacto (cifra a la derecha y teclado numérico en iOS).
struct AdminNumberField: View {
    let label: String
    @Binding var value: Int
    var width: CGFloat = 64
    var onSubmit: (() -> Void)? = nil

    var body: some View {
        AdminCompactField(label: label,
                          text: Binding(get: { String(value) }, set: { value = Int($0) ?? 0 }),
                          width: width, numeric: true, onSubmit: onSubmit)
    }
}

/// Campo de texto corto en píldora gris del sistema; `numeric` activa el teclado numérico.
struct AdminCompactField: View {
    let label: String
    @Binding var text: String
    var width: CGFloat = 64
    var numeric = false
    var monospaced = true
    var onSubmit: (() -> Void)? = nil

    var body: some View {
        Group {
            #if os(iOS)
            if numeric { field.keyboardType(.numberPad) } else { field }
            #else
            field
            #endif
        }
        .accessibilityLabel(label)
    }

    private var field: some View {
        TextField("", text: $text)
            .textFieldStyle(.plain)
            .multilineTextAlignment(.trailing)
            .font(monospaced ? .apBody.monospacedDigit() : .apBody)
            .padding(.horizontal, 12)
            .frame(minWidth: 44, maxWidth: width, minHeight: 44)
            .background(Palette.secondary, in: Capsule())
            .onSubmit { onSubmit?() }
    }
}

extension View {
    /// Campo de una línea en píldora gris del sistema (44 pt).
    func adminField(monospaced: Bool = false, minHeight: CGFloat = 44) -> some View {
        self.textFieldStyle(.plain)
            .font(monospaced ? .inter(size: 15, weight: .regular, design: .monospaced, relativeTo: .subheadline) : .apBody)
            .padding(.horizontal, 14)
            .frame(minHeight: minHeight)
            .background(Palette.secondary, in: Capsule())
    }

    /// Campo o editor corto de varias líneas: gris del sistema con esquinas de tarjeta.
    func adminFieldBox(minHeight: CGFloat = 88, radius: CGFloat = 14) -> some View {
        self.padding(.horizontal, 12).padding(.vertical, 10)
            .frame(minHeight: minHeight, alignment: .topLeading)
            .background(Palette.secondary, in: RoundedRectangle(cornerRadius: radius, style: .continuous))
    }

    /// Editor largo sobre tarjeta (HTML, Markdown, ideas).
    func adminEditorBox(minHeight: CGFloat) -> some View {
        self.scrollContentBackground(.hidden)
            .padding(12)
            .frame(minHeight: minHeight)
            .background(Palette.card, in: RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
    }

    /// Separador fino entre filas de una tarjeta, alineado con el texto.
    func adminRowDivider(first: Bool, leading: CGFloat = 16) -> some View {
        overlay(alignment: .top) {
            if !first { Rectangle().fill(Palette.separator).frame(height: 0.5).padding(.leading, leading) }
        }
    }

    /// Fila de lista agrupada: 16 pt a los lados, 50 pt de alto y línea fina encima salvo la primera.
    /// `leading` alinea la línea con el texto cuando la fila lleva miniatura.
    func rowStyle(first: Bool, leading: CGFloat = 16, minHeight: CGFloat = 50) -> some View {
        self.padding(.horizontal, 16).frame(minHeight: minHeight)
            .overlay(alignment: .top) { if !first { Rectangle().fill(Palette.separator).frame(height: 0.5).padding(.leading, leading) } }
    }
}
