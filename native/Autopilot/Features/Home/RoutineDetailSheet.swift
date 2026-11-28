import SwiftUI
#if os(iOS)
import UIKit
#endif
import Supabase

/// «Editar sesión» desde Inicio: portada, nombre, día e icono arriba y, debajo, los ejercicios con
/// la misma fila plegable que «Editar mi rutina» (`PlanExerciseRow`). Una sola acción dorada: Guardar.
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
                VStack(alignment: .leading, spacing: 24) {
                    // Portada + nombre
                    HStack(alignment: .center, spacing: 14) {
                        Button { Task { await generateCover() } } label: {
                            cover
                                .frame(width: 88, height: 88)
                                .clipShape(RoundedRectangle(cornerRadius: Radius.media, style: .continuous))
                                .overlay(alignment: .bottomTrailing) {
                                    Image(systemName: "sparkles").font(.system(size: 12, weight: .bold)).foregroundStyle(Palette.background)
                                        .frame(width: 24, height: 24).background(Palette.gold, in: Circle())
                                        .overlay(Circle().strokeBorder(Palette.background, lineWidth: 2))
                                        .offset(x: 6, y: 6)
                                }
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("Portada de la sesión")
                        .accessibilityHint("Genera una portada nueva con IA")

                        VStack(alignment: .leading, spacing: 6) {
                            Text("Nombre").font(.apFootnote).foregroundStyle(Palette.muted).padding(.leading, 4)
                                .accessibilityHidden(true)
                            TextField("Nombre de la sesión", text: $name)
                                .font(.apHeadline).textFieldStyle(.plain)
                                .padding(.horizontal, 18).frame(height: 52)
                                .background(Palette.secondary, in: Capsule())
                                .accessibilityLabel("Nombre de la sesión")
                        }
                    }

                    // Día de la semana
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Día").font(.apFootnote).foregroundStyle(Palette.muted).padding(.leading, 4)
                            .accessibilityHidden(true)
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
                                Image(systemName: "chevron.up.chevron.down").font(.system(size: 13, weight: .semibold)).foregroundStyle(Palette.muted)
                            }
                            .padding(.horizontal, 18).frame(height: 52)
                            .background(Palette.secondary, in: Capsule())
                            .contentShape(Capsule())
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("Día: \(selectedDay)")
                    }

                    // Icono (plegado)
                    DisclosureGroup(isExpanded: $showIcons) {
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
                                        .foregroundStyle(icon == symbol ? Palette.gold : Palette.foreground)
                                        .background(icon == symbol ? Palette.gold.opacity(0.15) : Palette.secondary,
                                                    in: RoundedRectangle(cornerRadius: Radius.chip, style: .continuous))
                                }
                                .buttonStyle(.plain)
                                .accessibilityAddTraits(icon == symbol ? .isSelected : [])
                            }
                        }
                        .padding(.top, 12)
                    } label: {
                        Text("Icono").font(.apHeadline).foregroundStyle(Palette.foreground)
                    }
                    .tint(Palette.muted)

                    // Portada con IA: secundaria (la acción dorada es «Guardar»).
                    Button { Task { await generateCover() } } label: {
                        HStack(spacing: 8) {
                            if generatingCover { BrandLoader() }
                            else { Image(systemName: "sparkles").font(.inter(size: 14, weight: .semibold)) }
                            Text(generatingCover ? "Generando…" : "Generar portada con IA")
                        }
                    }
                    .buttonStyle(.pillSecondary)
                    .disabled(generatingCover || exerciseIds.isEmpty)

                    // Ejercicios: edición completa (series, reps, peso, descanso), como «Editar mi rutina».
                    VStack(alignment: .leading, spacing: 12) {
                        HStack(alignment: .firstTextBaseline) {
                            Text("Ejercicios").font(.apTitle3).accessibilityAddTraits(.isHeader)
                            Spacer()
                            if !exercises.isEmpty {
                                Text(ExerciseLibraryCatalog.count(exercises.count)).font(.apFootnote.monospacedDigit()).foregroundStyle(Palette.muted)
                            }
                        }
                        if exercises.isEmpty {
                            Text("Añade el primer ejercicio de esta sesión.")
                                .font(.apSubhead).foregroundStyle(Palette.muted)
                        } else {
                            VStack(spacing: 12) {
                                ForEach(Array(exercises.enumerated()), id: \.offset) { index, ex in
                                    PlanExerciseRow(exercise: ex, index: index, total: exercises.count,
                                        onChange: { updated in exercises[index] = updated },
                                        onMove: { dir in
                                            let target = index + dir
                                            guard exercises.indices.contains(target) else { return }
                                            exercises.swapAt(index, target)
                                            Haptics.selection()
                                        },
                                        onRemove: { exercises.remove(at: index) })
                                }
                            }
                        }
                        Button { addingExercise = true } label: { Label("Añadir ejercicios", systemImage: "plus") }
                            .buttonStyle(.pillSecondary)
                    }

                    if let error { Text(error).font(.apFootnote).foregroundStyle(Palette.destructive) }

                    // Guardar: la única acción dorada.
                    Button {
                        Task { await save() }
                    } label: {
                        if saving { BrandLoader().accessibilityLabel("Guardando") } else { Text("Guardar") }
                    }
                    .buttonStyle(.pill)
                    .disabled(saving || name.trimmingCharacters(in: .whitespaces).isEmpty)
                    .frame(maxWidth: .infinity)
                }
                .padding(20)
                .frame(maxWidth: 680)
                .frame(maxWidth: .infinity)
            }
            .scrollDismissesKeyboard(.interactively)
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
        .presentationBackground(Palette.background)
    }

    /// Portada: la generada, el icono elegido o, si no hay, la foto del primer ejercicio (o la de
    /// marca). Mientras carga, el fondo; sin foto posible, el músculo del primer ejercicio en la
    /// silueta. Nunca un cuadro gris con una mancuerna.
    @ViewBuilder private var cover: some View {
        ZStack {
            Palette.secondary
            if let url = coverUrl, let u = URL(string: url) {
                CachedAsyncImage(url: u, maxSide: 88) { $0.resizable().scaledToFill() } placeholder: { Color.clear }
            } else if let icon, !icon.isEmpty, !icon.hasPrefix("http") {
                Image(systemName: icon).font(.inter(size: 28, weight: .semibold)).foregroundStyle(Palette.gold)
            } else if let photo = URL(string: exercises.compactMap(\.image_url).first(where: { !$0.isEmpty }) ?? BrandPhotos.string(.gym)) {
                CachedAsyncImage(url: photo, maxSide: 88) { $0.resizable().scaledToFill() } placeholder: { Color.clear }
            } else {
                coverGlyph
            }
            if generatingCover {
                Palette.card.opacity(0.6)
                BrandLoader()
            }
        }
    }

    private var coverGlyph: some View {
        ExerciseSilhouette(muscleGroup: exercises.first?.muscle_group).padding(10)
    }

    private func generateCover() async {
        guard session.userId != nil else { return }
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
            // Editada a mano: solo esta sesión pasa a ser tuya (el piloto automático no la sustituye).
            // El icono y la portada no cuentan: como «Personalizar» en la web, no cambian el modo del plan.
            var before = day; before.custom = nil; before.session_icon = nil; before.cover_url = nil
            var after = updated[idx]; after.custom = nil; after.session_icon = nil; after.cover_url = nil
            if before != after { updated[idx].custom = true }
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
