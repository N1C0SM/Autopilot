import SwiftUI

/// Pantalla del entreno en curso, nativa: series, peso, repeticiones y descanso.
struct WorkoutView: View {
    @ObservedObject var workout: ActiveWorkout
    let userId: UUID
    var onClose: (_ finished: Bool) -> Void

    @State private var confirmFinish = false
    @State private var rpe: Int = 7
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 14) {
                    header
                    ForEach(Array(workout.exercises.enumerated()), id: \.element.id) { index, exercise in
                        ExerciseCard(workout: workout, exercise: exercise, number: index + 1)
                            .id(exercise.id)
                    }
                    Button("Terminar entreno") { confirmFinish = true }
                        .buttonStyle(.pill)
                        .padding(.top, 8)
                    if let error = workout.saveError {
                        Text(error).font(.apFootnote).foregroundStyle(Palette.destructive)
                    }
                }
                .padding(16)
                .padding(.bottom, workout.draft.restEndsAt == nil ? 16 : 120)
                .frame(maxWidth: 760)
                .frame(maxWidth: .infinity)
            }
            .onAppear {
                if let ex = workout.exercises[safe: workout.draft.currentExercise] { proxy.scrollTo(ex.id, anchor: .top) }
            }
        }
        .screenBackground()
        .overlay(alignment: .bottom) {
            if let end = workout.draft.restEndsAt {
                RestBar(end: end, workout: workout)
                    .padding(.horizontal, 16).padding(.bottom, 12)
                    .transition(reduceMotion ? .opacity : .move(edge: .bottom).combined(with: .opacity))
            }
        }
        .animation(reduceMotion ? nil : .spring(response: 0.35, dampingFraction: 0.85), value: workout.draft.restEndsAt)
        .navigationTitle(workout.draft.day.title)
        #if os(iOS)
        .navigationBarTitleDisplayMode(.inline)
        #endif
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button("Cerrar") { onClose(false) }
                    .accessibilityHint("El entreno queda guardado y puedes seguir luego")
            }
        }
        .sheet(isPresented: $confirmFinish) { finishSheet }
    }

    private var header: some View {
        HStack(spacing: 12) {
            FigureTile(label: "Series", value: "\(workout.doneSets)/\(workout.totalSets)")
            FigureTile(label: "Carga", value: "\(NumberText.integer(Int(workout.volumeKg))) kg")
            TimelineView(.periodic(from: .now, by: 1)) { context in
                FigureTile(label: "Tiempo", value: Duration.seconds(context.date.timeIntervalSince(workout.draft.startedAt))
                    .formatted(.time(pattern: .minuteSecond)))
            }
        }
    }

    private var finishSheet: some View {
        VStack(spacing: 22) {
            Text("¿Cómo de duro ha sido?").font(.apTitle2).accessibilityAddTraits(.isHeader)
            Text("\(rpe)").font(.apFigure).foregroundStyle(Palette.gold).accessibilityHidden(true)
            Slider(value: Binding(get: { Double(rpe) }, set: { rpe = Int($0.rounded()) }), in: 1...10, step: 1)
                .accessibilityLabel("Esfuerzo percibido")
                .accessibilityValue("\(rpe) de 10")
            Text(rpeLabel).font(.apSubhead).foregroundStyle(Palette.muted)
            Button {
                Task {
                    if await workout.finish(userId: userId, rpe: rpe) { confirmFinish = false; onClose(true) }
                }
            } label: {
                if workout.saving { ProgressView().tint(.black) } else { Text("Guardar entreno") }
            }
            .buttonStyle(.pill)
            .disabled(workout.saving)
            if let error = workout.saveError { Text(error).font(.apFootnote).foregroundStyle(Palette.destructive) }
            Button("Seguir entrenando") { confirmFinish = false }
                .font(.apSubhead).foregroundStyle(Palette.muted).frame(minHeight: 44)
        }
        .padding(28)
        .frame(minWidth: 340)
        .presentationDetents([.medium, .large])
        .screenBackground()
    }

    private var rpeLabel: String {
        switch rpe {
        case ...4: "Suave"
        case 5...6: "Moderado"
        case 7...8: "Duro"
        default: "Al límite"
        }
    }
}

/// Un ejercicio con sus series.
struct ExerciseCard: View {
    @ObservedObject var workout: ActiveWorkout
    let exercise: GymExercise
    let number: Int

    var body: some View {
        Card {
            HStack(alignment: .top, spacing: 12) {
                if let url = exercise.image_url, let u = URL(string: url) {
                    AsyncImage(url: u) { $0.resizable().scaledToFill() } placeholder: { Palette.secondary }
                        .frame(width: 56, height: 56)
                        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                        .accessibilityHidden(true)
                }
                VStack(alignment: .leading, spacing: 2) {
                    Text(exercise.name).font(.apHeadline).accessibilityAddTraits(.isHeader)
                    Text("\(exercise.series) × \(exercise.reps) · descanso \(exercise.rest)")
                        .font(.apFootnote).foregroundStyle(Palette.muted)
                }
                Spacer(minLength: 0)
            }

            let sets = workout.draft.logs[exercise.name] ?? []
            VStack(spacing: 8) {
                ForEach(sets.indices, id: \.self) { i in
                    SetRow(workout: workout, exercise: exercise, index: i, set: sets[i])
                }
            }
            Button { workout.addSet(exercise.name) } label: {
                Label("Añadir serie", systemImage: "plus").font(.apSubhead)
                    .frame(maxWidth: .infinity, minHeight: 44)
            }
            .buttonStyle(.plain)
            .foregroundStyle(Palette.gold)
        }
    }
}

/// Fila de serie: peso, repeticiones y marcar hecha. Zonas táctiles ≥ 44 pt.
struct SetRow: View {
    @ObservedObject var workout: ActiveWorkout
    let exercise: GymExercise
    let index: Int
    let set: SetLog

    var body: some View {
        HStack(spacing: 10) {
            Text("\(index + 1)").font(.apHeadline.monospacedDigit()).foregroundStyle(Palette.muted)
                .frame(width: 24).accessibilityHidden(true)

            Stepper(value: Binding(get: { set.reps }, set: { v in workout.update(exercise.name, set: index) { $0.reps = max(0, v) } }), in: 0...100) {
                Text("\(set.reps) reps").font(.apBody.monospacedDigit())
            }
            .accessibilityLabel("Repeticiones de la serie \(index + 1)")
            .accessibilityValue("\(set.reps)")

            TextField("kg", text: Binding(get: { set.weight }, set: { v in workout.update(exercise.name, set: index) { $0.weight = v } }))
                .textFieldStyle(.plain)
                .font(.apBody.monospacedDigit())
                .multilineTextAlignment(.center)
                .frame(width: 72, height: 44)
                .background(Palette.secondary, in: Capsule())
                #if os(iOS)
                .keyboardType(.decimalPad)
                #endif
                .accessibilityLabel("Peso en kilos de la serie \(index + 1)")

            Button { workout.toggleDone(exercise, set: index) } label: {
                Image(systemName: set.done ? "checkmark.circle.fill" : "circle")
                    .font(.system(size: 30, weight: .semibold))
                    .foregroundStyle(set.done ? Palette.gold : Palette.muted)
                    .frame(width: 44, height: 44)
            }
            .buttonStyle(.plain)
            .accessibilityLabel(set.done ? "Serie \(index + 1) hecha" : "Marcar serie \(index + 1) como hecha")
            .sensoryFeedback(.success, trigger: set.done)
        }
        .padding(.vertical, 2)
        .contextMenu {
            Button(role: .destructive) { workout.removeSet(exercise.name, at: index) } label: { Label("Quitar serie", systemImage: "trash") }
        }
    }
}

/// Barra de descanso: cuenta atrás desde una hora absoluta (sigue bien tras cerrar la app).
struct RestBar: View {
    let end: Date
    @ObservedObject var workout: ActiveWorkout

    var body: some View {
        TimelineView(.periodic(from: .now, by: 1)) { context in
            let left = max(0, Int(end.timeIntervalSince(context.date).rounded(.up)))
            HStack(spacing: 12) {
                VStack(alignment: .leading, spacing: 0) {
                    Text("Descanso").font(.apFootnote).foregroundStyle(Palette.muted)
                    Text(Duration.seconds(left).formatted(.time(pattern: .minuteSecond)))
                        .font(.apFigureSmall).foregroundStyle(left == 0 ? Palette.gold : Palette.foreground)
                }
                .accessibilityElement(children: .combine)
                .accessibilityLabel("Descanso, quedan \(left) segundos")
                Spacer()
                Button("−15") { workout.adjustRest(by: -15) }.buttonStyle(.pillSecondary).frame(width: 64)
                    .accessibilityLabel("Restar 15 segundos")
                Button("+15") { workout.adjustRest(by: 15) }.buttonStyle(.pillSecondary).frame(width: 64)
                    .accessibilityLabel("Sumar 15 segundos")
                Button(left == 0 ? "Listo" : "Saltar") { workout.skipRest() }.buttonStyle(.pill).frame(width: 92)
            }
            .padding(14)
            .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: Radius.hero, style: .continuous))
            .onChange(of: left == 0) { _, finished in if finished { Haptics.warning() } }
        }
    }
}

extension Array {
    subscript(safe index: Int) -> Element? { indices.contains(index) ? self[index] : nil }
}
