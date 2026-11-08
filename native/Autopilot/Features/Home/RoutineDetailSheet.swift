import SwiftUI
#if os(iOS)
import UIKit
#endif
import Supabase

/// Detalle y edición de una rutina desde Inicio, estilo Hevy: nombre arriba, ejercicios en
/// columna con sus series, añadir ejercicio, empezar. Iconos minimalistas (SF Symbols), sin emojis.
struct RoutineDetailSheet: View {
    @EnvironmentObject private var session: SessionModel
    @Environment(\.dismiss) private var dismiss

    let day: DayPlan
    let plans: [DayPlan]
    var onSave: ([DayPlan]) -> Void

    @State private var name: String
    @State private var icon: String?
    @State private var coverUrl: String?
    @State private var selectedDay: String
    @State private var generatingCover = false
    @State private var exercises: [GymExercise]
    @State private var addingExercise = false
    @State private var saving = false
    @State private var error: String?
    @State private var showIcons = false

    private let icons: [String] = [
        "dumbbell", "flame", "target", "bolt", "trophy", "heart", "star",
        "leaf", "moon", "sun.max", "figure.run", "figure.strengthtraining.traditional",
        "figure.core.training", "bicycle", "figure.walk", "sparkles"
    ]

    init(day: DayPlan, plans: [DayPlan], onSave: @escaping ([DayPlan]) -> Void) {
        self.day = day
        self.plans = plans
        self.onSave = onSave
        _name = State(initialValue: day.routine_name ?? day.title)
        _icon = State(initialValue: day.session_icon)
        _coverUrl = State(initialValue: day.cover_url)
        _selectedDay = State(initialValue: day.day)
        _exercises = State(initialValue: day.exercises ?? [])
    }

    private var exerciseIds: [String] { exercises.compactMap { $0.exercise_id }.filter { !$0.isEmpty } }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    // Portada + nombre
                    HStack(alignment: .top, spacing: 14) {
                        Button { Task { await generateCover() } } label: {
                            ZStack {
                                if let url = coverUrl, let u = URL(string: url) {
                                    CachedAsyncImage(url: u) { $0.resizable().scaledToFill() } placeholder: { Palette.secondary }
                                } else if let icon, !icon.isEmpty, !icon.hasPrefix("http") {
                                    Image(systemName: icon).font(.inter(size: 28, weight: .semibold)).foregroundStyle(Palette.gold)
                                } else {
                                    Image(systemName: "dumbbell").font(.inter(size: 24, weight: .semibold)).foregroundStyle(Palette.muted)
                                }
                                if generatingCover {
                                    Palette.card.opacity(0.6)
                                    BrandLoader().tint(Palette.gold)
                                }
                            }
                            .frame(width: 88, height: 88)
                            .background(Palette.secondary, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                            .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).strokeBorder(Color.white.opacity(0.08), lineWidth: 1))
                            .overlay(alignment: .bottomTrailing) {
                                Image(systemName: "camera.fill").font(.system(size: 11, weight: .bold)).foregroundStyle(Palette.background)
                                    .padding(5).background(Palette.gold, in: Circle()).offset(x: 4, y: 4)
                            }
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("Portada. Tocar para generar con IA")

                        VStack(alignment: .leading, spacing: 6) {
                            Text("Nombre").font(.apCaption).foregroundStyle(Palette.muted)
                            TextField("Nombre de la sesión", text: $name)
                                .font(.apTitle2.weight(.bold))
                                .padding(12)
                                .background(Palette.secondary, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                        }
                    }

                    // Día de la semana
                VStack(alignment: .leading, spacing: 6) {
                    Text("Día").font(.apCaption).foregroundStyle(Palette.muted)
                    Menu {
                        ForEach(0..<DayNames.all.count, id: \.self) { i in
                            let d = DayNames.all[i]
                            Button {
                                Haptics.selection()
                                selectedDay = d
                            } label: {
                                if selectedDay == d { Label(d, systemImage: "checkmark") } else { Text(d) }
                            }
                        }
                    } label: {
                        HStack {
                            Text(selectedDay).font(.apBody.weight(.semibold))
                            Spacer()
                            Image(systemName: "chevron.up.chevron.down").font(.system(size: 12, weight: .semibold)).foregroundStyle(Palette.muted)
                        }
                        .padding(14)
                        .background(Palette.secondary, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                    }
                    .buttonStyle(.plain)
                }

                // Icono (colapsable)
                    DisclosureGroup("Icono (SF Symbols)", isExpanded: $showIcons) {
                        FlowRow(spacing: 8) {
                            ForEach(icons, id: \.self) { symbol in
                                Button {
                                    Haptics.selection()
                                    icon = (icon == symbol) ? nil : symbol
                                    if icon != nil { coverUrl = nil }
                                } label: {
                                    Image(systemName: symbol)
                                        .font(.inter(size: 18, weight: .semibold))
                                        .frame(width: 44, height: 44)
                                        .foregroundStyle(icon == symbol ? Color.black : Palette.foreground)
                                        .background(icon == symbol ? Palette.gold : Palette.secondary, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
                                }
                                .buttonStyle(.plain)
                            }
                        }
                        .padding(.top, 8)
                    }
                    .font(.apCaption).foregroundStyle(Palette.muted)

                    // Generar portada
                    Button { Task { await generateCover() } } label: {
                        HStack {
                            if generatingCover { BrandLoader().tint(.black) }
                            else { Image(systemName: "sparkles").font(.inter(size: 14, weight: .semibold)) }
                            Text(generatingCover ? "Generando…" : "Generar portada con IA")
                                .font(.apSubhead.weight(.semibold))
                        }
                        .foregroundStyle(Palette.background)
                        .frame(maxWidth: .infinity, minHeight: 44)
                        .background(Palette.gold, in: Capsule())
                    }
                    .buttonStyle(.plain)
                    .disabled(generatingCover || exerciseIds.isEmpty)

                    // Ejercicios: edición completa (series, reps, kg, descanso), como en Entrenar.
                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            Text("Ejercicios").font(.apHeadline)
                            Spacer()
                            Text("\(exercises.count)").font(.apSubhead.monospacedDigit()).foregroundStyle(Palette.muted)
                        }
                        if exercises.isEmpty {
                            Text("Sin ejercicios. Añade el primero.")
                                .font(.apFootnote).foregroundStyle(Palette.muted)
                                .padding(.vertical, 8)
                        } else {
                            VStack(spacing: 10) {
                                ForEach(Array(exercises.enumerated()), id: \.offset) { index, ex in
                                    ExerciseEditRow(exercise: ex, index: index, total: exercises.count,
                                        onChange: { updated in exercises[index] = updated },
                                        onMove: { dir in
                                            let target = index + dir
                                            guard exercises.indices.contains(target) else { return }
                                            exercises.swapAt(index, target)
                                            Haptics.selection()
                                        },
                                        onRemove: { Haptics.tap(); exercises.remove(at: index) })
                                }
                            }
                        }
                        Button { addingExercise = true } label: {
                            Label("Añadir ejercicio", systemImage: "plus")
                                .font(.apSubhead.weight(.medium))
                                .foregroundStyle(Palette.foreground)
                                .frame(maxWidth: .infinity, minHeight: 44)
                                .background(Palette.secondary, in: Capsule())
                        }
                        .buttonStyle(.plain)
                    }

                    if let error { Text(error).font(.apFootnote).foregroundStyle(Palette.destructive) }

                    // Guardar
                    Button {
                        Task { await save() }
                    } label: {
                        if saving { BrandLoader().tint(.black) } else { Text("Guardar") }
                    }
                    .buttonStyle(.pill)
                    .disabled(saving || name.trimmingCharacters(in: .whitespaces).isEmpty)
                    .frame(maxWidth: .infinity)
                }
                .padding(20)
            }
            .screenBackground()
            .navigationTitle(name.isEmpty ? "Rutina" : name)
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancelar") { dismiss() } }
            }
            .sheet(isPresented: $addingExercise) {
                ExercisePickerView(existing: Set(exercises.map(\.name))) { picked in
                    exercises.append(contentsOf: picked)
                }
            }
        }
        .presentationDetents([.large])
        .presentationBackground(Palette.card)
    }

    private func generateCover() async {
        guard let userId = session.userId else { return }
        let ids = exerciseIds
        guard !ids.isEmpty else { return }
        generatingCover = true
        defer { generatingCover = false }
        do {
            struct Resp: Decodable { let url: String? }
            let resp: Resp = try await Backend.client.functions.invoke(
                "session-cover",
                options: FunctionInvokeOptions(body: ["exercise_ids": ids])
            )
            if let url = resp.url {
                coverUrl = url
                icon = nil
                Haptics.success()
            } else {
                error = "No se pudo generar la portada."
            }
        } catch {
            Haptics.error()
            self.error = "No se pudo generar la portada."
        }
    }

    private func save() async {
        guard let userId = session.userId else { return }
        saving = true; defer { saving = false }
        var updated = plans
        if let idx = updated.firstIndex(where: { $0.day == day.day }) {
            updated[idx].day = self.selectedDay
            updated[idx].routine_name = name.trimmingCharacters(in: .whitespaces)
            updated[idx].session_icon = icon
            updated[idx].cover_url = coverUrl
            updated[idx].exercises = exercises.isEmpty ? nil : exercises
        }
        let clean = updated.filter { $0.type == "actividad" || !($0.exercises ?? []).isEmpty }
            .sorted { (DayNames.all.firstIndex(of: $0.day) ?? 0) < (DayNames.all.firstIndex(of: $1.day) ?? 0) }
        struct Row: Encodable { let user_id: UUID; let workouts_json: [DayPlan]; let updated_at: String }
        do {
            try await Backend.client.from("training_plan")
                .upsert(Row(user_id: userId, workouts_json: clean, updated_at: ISO8601DateFormatter().string(from: Date())), onConflict: "user_id")
                .execute()
            TrainingRepo.storePlanLocally(userId: userId, clean)
            Haptics.success()
            onSave(clean)
            dismiss()
        } catch {
            Haptics.error()
            self.error = "No se pudo guardar. Inténtalo de nuevo."
        }
    }
}


/// Fila editable de un ejercicio de la rutina (igual que en PlanEditorView).
private struct ExerciseEditRow: View {
    let exercise: GymExercise
    let index: Int
    let total: Int
    var onChange: (GymExercise) -> Void
    var onMove: (Int) -> Void
    var onRemove: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 10) {
                CachedAsyncImage(url: exercise.image_url.flatMap(URL.init(string:))) { $0.resizable().scaledToFill() } placeholder: { Palette.secondary }
                    .frame(width: 44, height: 44).clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                Text(exercise.name).font(.apHeadline).lineLimit(2).frame(maxWidth: .infinity, alignment: .leading)
                iconButton("lu-chevron-left", rotation: 90, label: "Subir", disabled: index == 0) { onMove(-1) }
                iconButton("lu-chevron-left", rotation: -90, label: "Bajar", disabled: index == total - 1) { onMove(1) }
                iconButton("lu-x", rotation: 0, label: "Quitar", disabled: false, action: onRemove)
            }
            HStack(spacing: 8) {
                field("Series", Binding(get: { String(exercise.series) }, set: { var e = exercise; e.series = Int($0) ?? e.series; onChange(e) }), numeric: true)
                field("Reps", Binding(get: { exercise.reps }, set: { var e = exercise; e.reps = $0; onChange(e) }))
                field("Kg", Binding(get: { exercise.weight }, set: { var e = exercise; e.weight = $0; onChange(e) }))
                field("Descanso", Binding(get: { exercise.rest }, set: { var e = exercise; e.rest = $0; onChange(e) }))
            }
        }
        .padding(12)
        .background(Palette.card, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).strokeBorder(Color.white.opacity(0.06), lineWidth: 1))
    }

    private func field(_ label: String, _ text: Binding<String>, numeric: Bool = false) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label).font(.apCaption).foregroundStyle(Palette.muted)
            TextField(label, text: text)
                .font(.apSubhead.monospacedDigit())
                #if os(iOS)
                .keyboardType(numeric ? .numberPad : .default)
                #endif
                .padding(.horizontal, 10).frame(height: 38)
                .background(Palette.secondary, in: Capsule())
        }
    }

    private func iconButton(_ icon: String, rotation: Double, label: String, disabled: Bool, action: @escaping () -> Void) -> some View {
        Button { Haptics.tap(); action() } label: {
            Image(icon).renderingMode(.template).resizable().frame(width: 14, height: 14)
                .rotationEffect(.degrees(rotation))
                .frame(width: 30, height: 30).background(Palette.secondary, in: Circle())
        }
        .buttonStyle(.plain).foregroundStyle(Palette.muted).disabled(disabled).opacity(disabled ? 0.4 : 1)
        .accessibilityLabel(label)
    }
}
