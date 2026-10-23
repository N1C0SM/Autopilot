import SwiftUI

/// Sesión en curso, calcada de `WorkoutTracker.tsx` (vista de lista): barra «Salir · título ·
/// tiempo · X de Y series · ···», tarjetas de ejercicio con la tabla Serie/Previa/Kg/Reps/✓,
/// «Añadir serie», y el pie con el descanso (−30 / +30 / Saltar) y «Terminar entrenamiento».
struct WorkoutView: View {
    @ObservedObject var workout: ActiveWorkout
    let userId: UUID
    var onClose: (_ finished: Bool) -> Void

    @State private var rpeOpen = false
    @State private var finishIncompleteOpen = false
    @State private var discardOpen = false
    @State private var rpe = 7
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private var progress: Double { workout.totalSets > 0 ? Double(workout.doneSets) / Double(workout.totalSets) : 0 }

    var body: some View {
        VStack(spacing: 0) {
            ScrollView {
                VStack(alignment: .leading, spacing: 12) {
                    ForEach(Array(workout.exercises.enumerated()), id: \.element.id) { i, ex in
                        SessionExerciseCard(workout: workout, exercise: ex, index: i)
                    }
                    if let error = workout.saveError {
                        Text(error).font(.apFootnote).foregroundStyle(Palette.destructive)
                    }
                }
                .padding(.horizontal, 16).padding(.top, 12).padding(.bottom, 24)
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            footer
        }
        .screenBackground()
        .navigationTitle(workout.draft.day.routine_name?.trimmingCharacters(in: .whitespaces).nilIfEmpty ?? workout.draft.day.title)
        #if os(iOS)
        .navigationBarTitleDisplayMode(.inline)
        .navigationBarBackButtonHidden()
        #endif
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button { Haptics.tap(); workout.persist(); onClose(false) } label: {
                    HStack(spacing: 2) { Image(systemName: "chevron.left").fontWeight(.semibold); Text("Salir") }
                }
                .foregroundStyle(Palette.gold)
                .accessibilityHint("El entrenamiento queda guardado")
            }
            ToolbarItem(placement: .principal) {
                VStack(spacing: 0) {
                    Text(workout.draft.day.routine_name ?? workout.draft.day.title).font(.apHeadline).lineLimit(1)
                    TimelineView(.periodic(from: .now, by: 1)) { ctx in
                        Text("\(elapsed(ctx.date)) · \(workout.doneSets) de \(workout.totalSets) series")
                            .font(.apFootnote.monospacedDigit()).foregroundStyle(Palette.muted)
                    }
                }
                .accessibilityElement(children: .combine)
            }
            ToolbarItem(placement: .primaryAction) {
                Button { Haptics.tap(); discardOpen = true } label: {
                    Image(systemName: "ellipsis").font(.system(size: 15, weight: .bold)).foregroundStyle(Palette.gold)
                        .frame(width: 30, height: 30).background(Palette.secondary, in: Circle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Más acciones")
            }
        }
        .overlay(alignment: .top) {
            GeometryReader { geo in
                Rectangle().fill(Palette.gold).frame(width: geo.size.width * progress, height: 2)
            }
            .frame(height: 2)
            .accessibilityLabel("Progreso de la sesión")
            .accessibilityValue("\(Int(progress * 100)) por ciento")
        }
        .confirmationDialog("¿Descartar entrenamiento?", isPresented: $discardOpen, titleVisibility: .visible) {
            Button("Descartar entrenamiento", role: .destructive) {
                ActiveWorkout.clear(userId: workout.draft.userId)
                workout.skipRest()
                onClose(false)
            }
            Button("Seguir entrenando", role: .cancel) {}
        } message: {
            Text("Se borrarán las series de esta sesión y no contará como hecha. Podrás empezarla de nuevo cuando quieras.")
        }
        .confirmationDialog("¿Terminar con series pendientes?", isPresented: $finishIncompleteOpen, titleVisibility: .visible) {
            Button("Terminar y guardar") { rpeOpen = true }
            Button("Seguir entrenando", role: .cancel) {}
        } message: {
            Text("Te quedan \(workout.totalSets - workout.doneSets) de \(workout.totalSets) series. Puedes terminarlo igualmente o seguir entrenando.")
        }
        .sheet(isPresented: $rpeOpen) { rpeSheet }
        .onReceive(NotificationCenter.default.publisher(for: .finishWorkout)) { _ in finish() }
        .onReceive(NotificationCenter.default.publisher(for: .skipRest)) { _ in workout.skipRest() }
        .onReceive(NotificationCenter.default.publisher(for: .restPlus)) { _ in workout.adjustRest(by: 30) }
        .onReceive(NotificationCenter.default.publisher(for: .restMinus)) { _ in workout.adjustRest(by: -30) }
    }

    private func elapsed(_ now: Date) -> String {
        Duration.seconds(max(0, now.timeIntervalSince(workout.draft.startedAt))).formatted(.time(pattern: .minuteSecond))
    }

    private func finish() {
        guard workout.doneSets > 0 else { return }
        Haptics.tap()
        if workout.doneSets < workout.totalSets { finishIncompleteOpen = true } else { rpeOpen = true }
    }

    // MARK: Pie fijo: descanso + «Terminar entrenamiento»

    private var footer: some View {
        VStack(spacing: 0) {
            if let end = workout.draft.restEndsAt {
                RestTimerRow(end: end, workout: workout)
                    .padding(.bottom, 12)
                    .transition(reduceMotion ? .opacity : .move(edge: .bottom).combined(with: .opacity))
            }
            Button {
                finish()
            } label: {
                if workout.saving { HStack { ProgressView().tint(.black); Text("Guardando…") } } else { Text("Terminar entrenamiento") }
            }
            .buttonStyle(.pill)
            .disabled(workout.saving || workout.doneSets == 0)
            .keyboardShortcut(.return, modifiers: .command)
        }
        .padding(.horizontal, 16).padding(.top, 12).padding(.bottom, 12)
        .background(.bar)
        .overlay(alignment: .top) { Rectangle().fill(Palette.separator).frame(height: 0.5) }
        .animation(reduceMotion ? nil : .spring(response: 0.35, dampingFraction: 0.9), value: workout.draft.restEndsAt)
    }

    // MARK: Esfuerzo (RPEDialog)

    private var rpeSheet: some View {
        VStack(spacing: 20) {
            Text("¿Cómo de duro ha sido?").font(.apTitle2).accessibilityAddTraits(.isHeader)
            Text("\(rpe)").font(.apFigure).foregroundStyle(Palette.gold).accessibilityHidden(true)
            Slider(value: Binding(get: { Double(rpe) }, set: { rpe = Int($0.rounded()) }), in: 1...10, step: 1)
                .accessibilityLabel("Esfuerzo percibido").accessibilityValue("\(rpe) de 10")
            Button {
                Task { if await workout.finish(userId: userId, rpe: rpe) { rpeOpen = false; onClose(true) } }
            } label: {
                if workout.saving { ProgressView().tint(.black) } else { Text("Guardar") }
            }
            .buttonStyle(.pill)
            .disabled(workout.saving)
            if let error = workout.saveError { Text(error).font(.apFootnote).foregroundStyle(Palette.destructive) }
        }
        .padding(28)
        .frame(minWidth: 340)
        .presentationDetents([.medium])
        .screenBackground()
    }
}

/// Tarjeta de ejercicio en sesión: cabecera (miniatura, nombre, «N series · R reps · descanso», ✓)
/// y, abierta, la tabla de series.
struct SessionExerciseCard: View {
    @ObservedObject var workout: ActiveWorkout
    let exercise: GymExercise
    let index: Int

    private var sets: [SetLog] { workout.draft.logs[exercise.name] ?? [] }
    private var allDone: Bool { !sets.isEmpty && sets.allSatisfy(\.done) }
    private var isOpen: Bool { workout.openExercises.contains(index) }
    private var firstPending: Int? { sets.firstIndex { !$0.done } }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Button {
                Haptics.tap()
                if isOpen { workout.openExercises.remove(index) } else { workout.openExercises.insert(index) }
            } label: {
                HStack(spacing: 12) {
                    ExerciseThumb(url: exercise.image_url, completed: allDone)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(exercise.name).font(.apHeadline).lineLimit(2).foregroundStyle(allDone ? Palette.muted : Palette.foreground)
                        Text("\(exercise.series) series · \(exercise.reps) reps · \(exercise.rest)").font(.apFootnote.monospacedDigit())
                            .foregroundStyle(Palette.muted)
                    }
                    Spacer(minLength: 0)
                    if allDone {
                        Image(systemName: "checkmark").font(.system(size: 18, weight: .bold)).foregroundStyle(Palette.gold)
                            .frame(width: 36, height: 44).accessibilityLabel("hecho")
                    }
                }
                .padding(.leading, 12).padding(.trailing, 8).frame(minHeight: 68)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityAddTraits(.isHeader)
            .accessibilityValue(isOpen ? "abierto" : "cerrado")

            if isOpen {
                VStack(spacing: 6) {
                    HStack(spacing: 8) {
                        Text("Serie").frame(width: 24)
                        Text("Previa").frame(width: 52)
                        Text("Kg").frame(maxWidth: .infinity)
                        Text("Reps").frame(maxWidth: .infinity)
                        Image(systemName: "checkmark").font(.system(size: 11, weight: .bold)).frame(width: 44)
                    }
                    .font(.caption)
                    .lineLimit(1).minimumScaleFactor(0.7)
                    .foregroundStyle(Palette.muted)
                    .padding(.leading, 12).padding(.trailing, 8)
                    .accessibilityHidden(true)

                    VStack(spacing: 0) {
                        ForEach(sets.indices, id: \.self) { si in
                            SetLine(workout: workout, exercise: exercise, index: si, set: sets[si],
                                    previous: workout.previous[exercise.name]?[safe: si],
                                    isCurrent: si == firstPending, separator: si > 0)
                        }
                    }
                    .background(Palette.card, in: RoundedRectangle(cornerRadius: Radius.card, style: .continuous))

                    Button { workout.addSet(exercise.name) } label: {
                        Label("Añadir serie", systemImage: "plus").font(.apBody).frame(maxWidth: .infinity, minHeight: 44)
                    }
                    .buttonStyle(.plain)
                    .foregroundStyle(Palette.gold)
                }
                .padding(.horizontal, 8).padding(.bottom, 12).padding(.top, 4)
            }
        }
        .background(Palette.card, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
    }
}

/// Fila de serie: número, previa, kg, reps y el círculo de hecha (rejilla 24 · 52 · 1fr · 1fr · 44).
struct SetLine: View {
    @ObservedObject var workout: ActiveWorkout
    let exercise: GymExercise
    let index: Int
    let set: SetLog
    let previous: SetLog?
    let isCurrent: Bool
    let separator: Bool

    var body: some View {
        HStack(spacing: 8) {
            Text("\(index + 1)").font(.system(.headline, design: .rounded).monospacedDigit())
                .foregroundStyle(isCurrent ? Palette.gold : Palette.muted)
                .frame(width: 24)
                .accessibilityHidden(true)
            Text(previous.map { $0.done ? "\($0.weight.isEmpty ? "—" : $0.weight)×\($0.reps)" : "—" } ?? "—")
                .font(.caption.monospacedDigit()).foregroundStyle(Palette.muted).lineLimit(1).minimumScaleFactor(0.7)
                .frame(width: 52)
                .accessibilityLabel("Previa: " + (previous.map { "\($0.weight) kilos por \($0.reps)" } ?? "sin datos"))
            NumberField(text: Binding(get: { set.weight }, set: { v in workout.update(exercise.name, set: index) { $0.weight = v } }),
                        placeholder: previous?.weight.nilIfEmpty ?? exercise.weight.nilIfEmpty ?? "kg", big: isCurrent, decimal: true)
                .accessibilityLabel("Peso de la serie \(index + 1) de \(exercise.name)")
            NumberField(text: Binding(get: { set.reps > 0 ? String(set.reps) : "" },
                                      set: { v in if let n = Int(v) { workout.update(exercise.name, set: index) { $0.reps = n } } }),
                        placeholder: String(exercise.reps), big: isCurrent, decimal: false)
                .accessibilityLabel("Repeticiones de la serie \(index + 1) de \(exercise.name)")
            Button { workout.toggleDone(exercise, set: index) } label: {
                ZStack {
                    Circle().strokeBorder(set.done ? Palette.gold : Palette.muted.opacity(0.4), lineWidth: 2)
                        .background(Circle().fill(set.done ? Palette.gold : .clear))
                    Image(systemName: "checkmark").font(.system(size: 14, weight: .heavy))
                        .foregroundStyle(set.done ? Color.black : Palette.muted.opacity(0.4))
                }
                .frame(width: 32, height: 32)
                .frame(width: 44, height: 44)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("\(set.done ? "Desmarcar" : "Marcar") serie \(index + 1) de \(exercise.name)")
            .sensoryFeedback(.success, trigger: set.done)
        }
        .padding(.leading, 12).padding(.trailing, 8).padding(.vertical, 8)
        .opacity(set.done ? 0.6 : 1)
        .background(
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .fill(isCurrent ? Palette.gold.opacity(0.05) : (set.done ? Color.green.opacity(0.1) : .clear))
                .overlay(RoundedRectangle(cornerRadius: 10, style: .continuous).strokeBorder(isCurrent ? Palette.gold.opacity(0.5) : .clear, lineWidth: 1))
        )
        .overlay(alignment: .top) { if separator && !isCurrent { Rectangle().fill(Palette.separator).frame(height: 0.5).padding(.leading, 12) } }
        .contextMenu {
            Button(role: .destructive) { workout.removeSet(exercise.name, at: index) } label: { Label("Quitar serie", systemImage: "trash") }
        }
    }
}

/// Campo numérico (NUMBER_FIELD): gris, 10 pt de radio, cifra redondeada; la serie actual, más grande.
struct NumberField: View {
    @Binding var text: String
    let placeholder: String
    let big: Bool
    let decimal: Bool

    var body: some View {
        TextField(placeholder, text: $text)
            .textFieldStyle(.plain)
            .multilineTextAlignment(.center)
            .font(big ? .system(size: 22, weight: .bold, design: .rounded).monospacedDigit()
                      : .system(.headline, design: .rounded).monospacedDigit())
            .frame(maxWidth: .infinity, minHeight: 44)
            .background(Palette.secondary, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
            #if os(iOS)
            .keyboardType(decimal ? .decimalPad : .numberPad)
            #endif
    }
}

/// Descanso: cifra de 34 pt, −30 / +30 / Saltar en dorado y barra fina.
struct RestTimerRow: View {
    let end: Date
    @ObservedObject var workout: ActiveWorkout

    var body: some View {
        TimelineView(.periodic(from: .now, by: 1)) { ctx in
            let left = max(0, Int(end.timeIntervalSince(ctx.date).rounded(.up)))
            VStack(spacing: 8) {
                HStack(spacing: 0) {
                    Text(String(format: "%d:%02d", left / 60, left % 60))
                        .font(.system(size: 34, weight: .bold, design: .rounded).monospacedDigit())
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .accessibilityLabel("Descanso, quedan \(left) segundos")
                    Button("−30") { Haptics.selection(); workout.adjustRest(by: -30) }
                        .frame(minWidth: 44, minHeight: 44).accessibilityLabel("Restar 30 segundos")
                    Button("+30") { Haptics.selection(); workout.adjustRest(by: 30) }
                        .frame(minWidth: 44, minHeight: 44).accessibilityLabel("Sumar 30 segundos")
                    Button("Saltar") { Haptics.tap(); workout.skipRest() }
                        .frame(minWidth: 52, minHeight: 44).accessibilityLabel("Saltar descanso")
                }
                .font(.apBody.monospacedDigit())
                .buttonStyle(.plain)
                .foregroundStyle(Palette.gold)
                GeometryReader { geo in
                    Capsule().fill(Palette.secondary)
                        .overlay(alignment: .leading) {
                            Capsule().fill(Palette.gold)
                                .frame(width: geo.size.width * min(1, Double(left) / Double(max(workout.restTarget, 1))))
                        }
                }
                .frame(height: 3)
                .accessibilityHidden(true)
            }
            .onChange(of: left == 0) { _, done in if done { Haptics.warning(); workout.skipRest() } }
        }
    }
}

extension Array {
    subscript(safe index: Int) -> Element? { indices.contains(index) ? self[index] : nil }
}

extension String {
    var nilIfEmpty: String? { isEmpty ? nil : self }
}
