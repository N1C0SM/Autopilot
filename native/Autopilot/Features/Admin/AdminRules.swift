import SwiftUI
import Supabase

/// Reglas, calcado de `TrainingRulesEditor.tsx`: configuración del motor Autopilot en grupos
/// (volumen, series por prioridad, repeticiones y descanso por estímulo, límites, patrones y recuperación).
struct AdminRulesView: View {
    @State private var row: [String: AnyJSON] = [:]
    @State private var loading = true
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
            if loading { ProgressView().frame(maxWidth: .infinity).padding(.top, 60) }
            else if row.isEmpty { EmptyStateView(symbol: "slider.horizontal.3", title: "Sin reglas", message: "No se encontraron reglas de generación.") }
            else {
                VStack(alignment: .leading, spacing: 24) {
                    HStack {
                        Text("Configuración del motor Autopilot").font(.apSubhead).foregroundStyle(Palette.muted)
                        Spacer()
                        Button("Restablecer") { resetDefaults() }.foregroundStyle(Palette.gold).buttonStyle(.plain).frame(minHeight: 44)
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
                        FlowRow {
                            ForEach(Self.patterns, id: \.self) { p in
                                let on = requiredPatterns.contains(p)
                                Button(p) { togglePattern(p) }
                                    .font(.apSubhead.weight(.medium)).padding(.horizontal, 16).frame(minHeight: 36)
                                    .foregroundStyle(on ? Palette.gold : Palette.muted)
                                    .background(on ? Palette.gold.opacity(0.15) : Palette.secondary, in: Capsule())
                                    .buttonStyle(.plain)
                                    .accessibilityAddTraits(on ? .isSelected : [])
                            }
                        }
                        .padding(16)
                    }
                    group("Horas de recuperación por músculo") {
                        ForEach(Array(recovery.keys.sorted().enumerated()), id: \.element) { i, muscle in
                            HStack {
                                Text(muscle).font(.apBody)
                                Spacer()
                                countField(Binding(get: { recovery[muscle] ?? 0 }, set: { setRecovery(muscle, $0) }), label: "Horas de recuperación de \(muscle)")
                                Text("h").font(.apSubhead).foregroundStyle(Palette.muted)
                            }
                            .rowStyle(first: i == 0)
                        }
                    }
                    Button { Task { await save() } } label: { if saving { ProgressView().tint(.black) } else { Text("Guardar") } }
                        .buttonStyle(.pill).disabled(saving)
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
            Text(header.uppercased()).font(.apFootnote).foregroundStyle(Palette.muted).padding(.horizontal, 16)
            VStack(spacing: 0) { content() }.background(Palette.card, in: RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
            if let footer { Text(footer).font(.apFootnote).foregroundStyle(Palette.muted).padding(.horizontal, 16) }
        }
    }

    private func countField(_ value: Binding<Int>, label: String, width: CGFloat = 64) -> some View {
        TextField("0", text: Binding(get: { String(value.wrappedValue) }, set: { value.wrappedValue = Int($0) ?? 0 }))
            .textFieldStyle(.plain).multilineTextAlignment(.trailing).font(.apBody.monospacedDigit())
            .padding(.horizontal, 10).frame(width: width, height: 36)
            .background(Palette.secondary, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
            #if os(iOS)
            .keyboardType(.numberPad)
            #endif
            .accessibilityLabel(label)
    }

    private func numberRow(_ label: String, _ key: String, first: Bool = false) -> some View {
        HStack {
            Text(label).font(.apBody)
            Spacer()
            countField(Binding(get: { int(key) }, set: { row[key] = .integer($0) }), label: label)
        }
        .rowStyle(first: first)
    }

    private func rangeRow(_ label: String, _ prefix: String, first: Bool = false) -> some View {
        HStack(spacing: 8) {
            Text(label).font(.apBody)
            Spacer()
            countField(Binding(get: { int("\(prefix)_min") }, set: { row["\(prefix)_min"] = .integer($0) }), label: "\(label), mínimo de series", width: 56)
            Text("–").foregroundStyle(Palette.muted)
            countField(Binding(get: { int("\(prefix)_max") }, set: { row["\(prefix)_max"] = .integer($0) }), label: "\(label), máximo de series", width: 56)
        }
        .rowStyle(first: first)
    }

    private func textRow(_ label: String, _ key: String, first: Bool = false) -> some View {
        HStack {
            Text(label).font(.apBody)
            Spacer()
            TextField("", text: Binding(get: { str(key) }, set: { row[key] = .string($0) }))
                .textFieldStyle(.plain).multilineTextAlignment(.trailing)
                .padding(.horizontal, 10).frame(width: 96, height: 36)
                .background(Palette.secondary, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
                .accessibilityLabel(label)
        }
        .rowStyle(first: first)
    }

    // MARK: Datos

    private func load() async {
        let rows: [[String: AnyJSON]] = (try? await Backend.client.from("training_rules").select().limit(1).execute().value) ?? []
        row = rows.first ?? [:]
        if !row.isEmpty {
            if requiredPatterns.isEmpty { row["required_patterns"] = Self.defaults["required_patterns"] }
            if recovery.isEmpty { row["recovery_hours"] = Self.defaults["recovery_hours"] }
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

extension View {
    /// Fila de lista agrupada: 16 pt a los lados, 50 pt de alto y línea fina encima salvo la primera.
    func rowStyle(first: Bool) -> some View {
        self.padding(.horizontal, 16).frame(minHeight: 50)
            .overlay(alignment: .top) { if !first { Rectangle().fill(Palette.separator).frame(height: 0.5).padding(.leading, 16) } }
    }
}
