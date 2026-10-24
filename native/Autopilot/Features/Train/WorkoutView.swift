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
    @State private var summaryOpen = false
    /// Vista elegida en Ajustes: lista vertical o ejercicio a ejercicio (modo foco).
    private let focusMode = UserDefaults.standard.string(forKey: "workout-view") == "focus"
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private var progress: Double { workout.totalSets > 0 ? Double(workout.doneSets) / Double(workout.totalSets) : 0 }

    var body: some View {
        VStack(spacing: 0) {
            ScrollView {
                VStack(alignment: .leading, spacing: 12) {
                    if focusMode, let i = Optional(min(workout.draft.currentExercise, max(workout.exercises.count - 1, 0))), let ex = workout.exercises[safe: i] {
                        FocusViewer(workout: workout, index: i)
                        SessionExerciseCard(workout: workout, exercise: ex, index: i)
                            .onAppear { workout.openExercises.insert(i) }
                            .id(ex.id)
                    } else {
                        ForEach(Array(workout.exercises.enumerated()), id: \.element.id) { i, ex in
                            SessionExerciseCard(workout: workout, exercise: ex, index: i)
                        }
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
                    Image(systemName: "ellipsis").font(.inter(size: 15, weight: .bold)).foregroundStyle(Palette.gold)
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
        // Hojas que suben desde abajo, como los Drawer de la web (y siempre con «Seguir entrenando»).
        .sheet(isPresented: $discardOpen) {
            ChoiceSheet(title: "¿Descartar entrenamiento?",
                        message: "Se borrarán las series de esta sesión y no contará como hecha. Podrás empezarla de nuevo cuando quieras.",
                        primary: "Descartar entrenamiento", destructive: true) {
                discardOpen = false
                ActiveWorkout.clear(userId: workout.draft.userId)
                workout.skipRest()
                onClose(false)
            } onCancel: { discardOpen = false }
        }
        .sheet(isPresented: $finishIncompleteOpen) {
            ChoiceSheet(title: "¿Terminar con series pendientes?",
                        message: "Te quedan \(workout.totalSets - workout.doneSets) de \(workout.totalSets) series. Puedes terminarlo igualmente o seguir entrenando.",
                        primary: "Terminar y guardar", destructive: false) {
                finishIncompleteOpen = false
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) { rpeOpen = true }
            } onCancel: { finishIncompleteOpen = false }
        }
        .sheet(isPresented: $rpeOpen) { rpeSheet }
        .sheet(isPresented: $summaryOpen, onDismiss: { onClose(true) }) { summarySheet }
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

    // MARK: Resumen final (WorkoutSummary)

    private var summarySheet: some View {
        WorkoutSummaryView(workout: workout, rpe: rpe) { summaryOpen = false }
            .frame(minWidth: 380)
            .presentationDetents([.large])
            .presentationBackground(Palette.card)
    }

    // MARK: Esfuerzo (RPEDialog)

    private var rpeSheet: some View {
        VStack(spacing: 20) {
            Text("¿Cómo de duro ha sido?").font(.apTitle2).accessibilityAddTraits(.isHeader)
            Text("\(rpe)").font(.apFigure).foregroundStyle(Palette.gold).accessibilityHidden(true)
            Slider(value: Binding(get: { Double(rpe) }, set: { rpe = Int($0.rounded()) }), in: 1...10, step: 1)
                .accessibilityLabel("Esfuerzo percibido").accessibilityValue("\(rpe) de 10")
            Button {
                Task { if await workout.finish(userId: userId, rpe: rpe) { rpeOpen = false; summaryOpen = true } }
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
        .presentationBackground(Palette.card)
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
    @State private var technique = false
    @State private var showWhy = false

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Button {
                Haptics.tap()
                if isOpen { workout.openExercises.remove(index) } else { workout.openExercises.insert(index) }
            } label: {
                HStack(spacing: 12) {
                    ExerciseThumb(url: exercise.image_url, completed: allDone)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(workout.swaps[exercise.name] ?? exercise.name).font(.apHeadline).lineLimit(2).foregroundStyle(allDone ? Palette.muted : Palette.foreground)
                        if workout.swaps[exercise.name] != nil { Text("En lugar de \(exercise.name)").font(.apFootnote).foregroundStyle(Palette.muted).lineLimit(1) }
                        Text("\(exercise.series) series · \(exercise.reps) reps · \(exercise.rest)").font(.apFootnote.monospacedDigit())
                            .foregroundStyle(Palette.muted)
                    }
                    Spacer(minLength: 0)
                    if allDone {
                        Image(systemName: "checkmark").font(.inter(size: 18, weight: .bold)).foregroundStyle(Palette.gold)
                            .frame(width: 36, height: 44).accessibilityLabel("hecho")
                    } else {
                        ExerciseSwapMenu(workout: workout, exercise: exercise)
                    }
                    Button { technique = true } label: { Image(systemName: "info.circle").font(.inter(size: 19)) }
                        .buttonStyle(.plain).foregroundStyle(Palette.muted).frame(width: 44, height: 44)
                        .accessibilityLabel("Ver ficha de técnica de \(exercise.name)")
                }
                .padding(.leading, 12).padding(.trailing, 8).frame(minHeight: 68)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityAddTraits(.isHeader)
            .accessibilityValue(isOpen ? "abierto" : "cerrado")

            if isOpen {
                VStack(spacing: 6) {
                    if !allDone, let p = Progression.suggestion(exercise, previous: workout.previous[exercise.name], previousRpe: workout.previousRpe) {
                        VStack(alignment: .leading, spacing: 0) {
                            HStack {
                                Text(p.headline).font(.apSubhead.weight(.semibold).monospacedDigit()).lineLimit(1)
                                Spacer()
                                if p.canApply {
                                    Button("Aplicar") { workout.applyProgression(exercise.name, p) }
                                        .font(.apSubhead.weight(.semibold)).foregroundStyle(Palette.gold).buttonStyle(.plain).frame(minHeight: 44)
                                        .accessibilityLabel(p.label == .up ? "Usar \(p.weight) kg en las series" : "Aplicar +1 rep")
                                }
                            }
                            .frame(minHeight: 44)
                            Button { showWhy.toggle() } label: {
                                Label("Por qué", systemImage: "chart.line.uptrend.xyaxis").font(.apFootnote).foregroundStyle(Palette.muted)
                            }
                            .buttonStyle(.plain).frame(minHeight: 32)
                            if showWhy {
                                if let last = Progression.summarize(workout.previous[exercise.name]) { Text(last).font(.apFootnote.monospacedDigit()).foregroundStyle(Palette.muted) }
                                Text(p.reason).font(.apFootnote).foregroundStyle(Palette.foreground.opacity(0.8)).padding(.bottom, 6)
                            }
                        }
                        .padding(.horizontal, 12).padding(.vertical, 4)
                        .background(Palette.secondary.opacity(0.6), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                        .accessibilityElement(children: .contain)
                        .accessibilityLabel("Por qué esta carga")
                    }
                    HStack(spacing: 8) {
                        Text("Serie").frame(width: 24)
                        Text("Previa").frame(width: 52)
                        Text("Kg").frame(maxWidth: .infinity)
                        Text("Reps").frame(maxWidth: .infinity)
                        Image(systemName: "checkmark").font(.inter(size: 11, weight: .bold)).frame(width: 44)
                    }
                    .font(.inter(.caption))
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
        .sheet(isPresented: $technique) { TechniqueSheet(exercise: exercise) }
    }
}

/// Hoja de confirmación (Drawer de la web): título, texto, acción principal y «Seguir entrenando».
struct ChoiceSheet: View {
    let title: String
    let message: String
    let primary: String
    let destructive: Bool
    var onPrimary: () -> Void
    var onCancel: () -> Void

    var body: some View {
        VStack(spacing: 14) {
            Text(title).font(.apTitle3).multilineTextAlignment(.center).accessibilityAddTraits(.isHeader)
            Text(message).font(.apSubhead).foregroundStyle(Palette.muted).multilineTextAlignment(.center)
            Button(primary) { Haptics.tap(); onPrimary() }
                .buttonStyle(destructive ? .pillDestructive : .pill)
                .padding(.top, 8)
            Button("Seguir entrenando") { Haptics.selection(); onCancel() }
                .font(.apHeadline).foregroundStyle(Palette.foreground).frame(maxWidth: .infinity, minHeight: 50)
                .buttonStyle(.plain)
        }
        .padding(.horizontal, 24).padding(.top, 28).padding(.bottom, 12)
        .presentationDetents([.height(320)])
        .presentationDragIndicator(.visible)
        .presentationBackground(Palette.card)
    }
}

/// Modo foco: visor grande del ejercicio activo (desliza para cambiar) y carrusel de toda la sesión.
struct FocusViewer: View {
    @ObservedObject var workout: ActiveWorkout
    let index: Int

    private func go(_ i: Int) {
        guard workout.exercises.indices.contains(i) else { return }
        workout.draft.currentExercise = i
        workout.openExercises.insert(i)
        workout.persist()
        Haptics.tap()
    }

    var body: some View {
        let ex = workout.exercises[index]
        VStack(spacing: 8) {
            ZStack {
                RoundedRectangle(cornerRadius: Radius.card, style: .continuous).fill(Palette.card)
                if let i = ex.image_url, let u = URL(string: i) {
                    CachedAsyncImage(url: u) { $0.resizable().scaledToFit() } placeholder: { ProgressView() }
                } else {
                    Image(systemName: "dumbbell").font(.inter(.title)).foregroundStyle(Palette.muted)
                }
            }
            .frame(maxWidth: .infinity).frame(height: 240)
            .clipShape(RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
            .gesture(DragGesture(minimumDistance: 30).onEnded { v in
                if v.translation.width < -60 { go(index + 1) } else if v.translation.width > 60 { go(index - 1) }
            })
            .accessibilityLabel("\(ex.name). Desliza para cambiar de ejercicio")
            .accessibilityAdjustableAction { dir in
                switch dir { case .increment: go(index + 1); case .decrement: go(index - 1); default: break }
            }
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(Array(workout.exercises.enumerated()), id: \.element.id) { i, item in
                        let sets = workout.draft.logs[item.name] ?? []
                        let done = !sets.isEmpty && sets.allSatisfy(\.done)
                        Button { go(i) } label: {
                            ExerciseThumb(url: item.image_url, completed: done)
                                .padding(2)
                                .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).strokeBorder(i == index ? Palette.gold : .clear, lineWidth: 2))
                                .opacity(i == index ? 1 : 0.6)
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("\(i + 1). \(workout.swaps[item.name] ?? item.name)\(done ? " · hecho" : "")")
                        .accessibilityAddTraits(i == index ? .isSelected : [])
                    }
                }
            }
        }
    }
}

/// Cambiar el ejercicio por una alternativa del mismo músculo (como `ExerciseSwap`).
struct ExerciseSwapMenu: View {
    @ObservedObject var workout: ActiveWorkout
    let exercise: GymExercise
    @EnvironmentObject private var session: SessionModel
    @State private var options: [String] = []

    var body: some View {
        Menu {
            if workout.swaps[exercise.name] != nil {
                Button("Volver a \(exercise.name)") { if let id = session.userId { workout.swap(exercise.name, to: nil, userId: id) } }
            }
            ForEach(options, id: \.self) { name in
                Button(name) { if let id = session.userId { workout.swap(exercise.name, to: name, userId: id) } }
            }
            if options.isEmpty { Text("Buscando alternativas…") }
        } label: {
            Image(systemName: "arrow.left.arrow.right").font(.inter(size: 16, weight: .semibold)).frame(width: 44, height: 44)
        }
        .menuStyle(.borderlessButton).fixedSize()
        .foregroundStyle(Palette.muted)
        .accessibilityLabel("Cambiar \(exercise.name)")
        .task {
            struct E: Decodable { let name: String }
            guard let group = exercise.muscle_group else { return }
            let rows: [E] = (try? await Backend.client.from("exercises").select("name").eq("muscle_group", value: group).limit(40).execute().value) ?? []
            options = rows.map(\.name).filter { $0 != exercise.name }
        }
    }
}

/// Ficha de técnica del ejercicio (ExerciseFocus): imagen o vídeo, series, reps, descanso y músculo.
struct TechniqueSheet: View {
    let exercise: GymExercise
    @Environment(\.dismiss) private var dismiss
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                if let i = exercise.image_url, let u = URL(string: i) {
                    CachedAsyncImage(url: u) { $0.resizable().scaledToFit() } placeholder: { Palette.card.frame(height: 260) }
                        .clipShape(RoundedRectangle(cornerRadius: Radius.hero, style: .continuous))
                        .accessibilityLabel(exercise.name)
                }
                Text(exercise.name).font(.apTitle1)
                if let g = exercise.muscle_group { Text(g).font(.apSubhead).foregroundStyle(Palette.muted) }
                HStack(spacing: 12) {
                    FigureTile(label: "Series", value: "\(exercise.series)")
                    FigureTile(label: "Reps", value: exercise.reps)
                    FigureTile(label: "Descanso", value: exercise.rest)
                }
                Button("Cerrar") { dismiss() }.buttonStyle(.pillSecondary)
            }
            .padding(20)
        }
        .frame(minWidth: 420, minHeight: 520)
        .presentationDetents([.large])
        .presentationBackground(Palette.card)
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

    private var isWarmup: Bool { self.set.isWarmup == true }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
        HStack(spacing: 8) {
            Group {
                if isWarmup { Image(systemName: "flame.fill").font(.inter(size: 14)) }
                else { Text("\(index + 1)").font(.inter(.headline).monospacedDigit()) }
            }
                .foregroundStyle(isCurrent ? Palette.gold : Palette.muted)
                .frame(width: 24)
                .accessibilityHidden(true)
            Text(previous.map { $0.done ? "\($0.weight.isEmpty ? "—" : $0.weight.replacingOccurrences(of: ".", with: ","))×\($0.reps)" : "—" } ?? "—")
                .font(.inter(.caption).monospacedDigit()).foregroundStyle(Palette.muted).lineLimit(1).minimumScaleFactor(0.7)
                .frame(width: 52)
                .accessibilityLabel("Previa: " + (previous.map { "\($0.weight) kilos por \($0.reps)" } ?? "sin datos"))
            NumberField(text: Binding(get: { set.weight }, set: { v in workout.update(exercise.name, set: index) { $0.weight = v } }),
                        placeholder: previous?.weight.nilIfEmpty ?? exercise.weight.nilIfEmpty ?? "kg", big: isCurrent, decimal: true)
                .accessibilityLabel("Peso de la serie \(index + 1) de \(exercise.name)")
            NumberField(text: Binding(get: { set.reps > 0 ? String(set.reps) : "" },
                                      set: { v in if let n = Int(v) { workout.update(exercise.name, set: index) { $0.reps = n } } }),
                        placeholder: String(exercise.repsTarget), big: isCurrent, decimal: false)
                .accessibilityLabel("Repeticiones de la serie \(index + 1) de \(exercise.name)")
            Button { workout.toggleDone(exercise, set: index) } label: {
                ZStack {
                    Circle().strokeBorder(set.done ? Palette.gold : Palette.muted.opacity(0.4), lineWidth: 2)
                        .background(Circle().fill(set.done ? Palette.gold : .clear))
                    Image(systemName: "checkmark").font(.inter(size: 14, weight: .heavy))
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
        // Bajadas del dropset: dentro de la misma serie, sin descanso.
        ForEach(Array((set.drops ?? []).enumerated()), id: \.offset) { di, drop in
            HStack(spacing: 8) {
                Image(systemName: "arrow.down.right").font(.inter(size: 13)).foregroundStyle(Palette.muted).frame(width: 24)
                Color.clear.frame(width: 52, height: 1)
                NumberField(text: Binding(get: { drop.weight }, set: { v in workout.updateDrop(exercise.name, set: index, drop: di) { $0.weight = v } }),
                            placeholder: "kg", big: false, decimal: true)
                    .accessibilityLabel("Peso de la bajada \(di + 1) de la serie \(index + 1)")
                NumberField(text: Binding(get: { drop.reps > 0 ? String(drop.reps) : "" }, set: { v in if let n = Int(v) { workout.updateDrop(exercise.name, set: index, drop: di) { $0.reps = n } } }),
                            placeholder: "reps", big: false, decimal: false)
                    .accessibilityLabel("Repeticiones de la bajada \(di + 1) de la serie \(index + 1)")
                Button { workout.removeDrop(exercise.name, set: index, drop: di) } label: {
                    Image(systemName: "xmark").font(.inter(size: 11, weight: .bold)).frame(width: 26, height: 26).background(Palette.secondary, in: Circle())
                        .frame(width: 44, height: 44)
                }
                .buttonStyle(.plain).foregroundStyle(Palette.muted)
                .accessibilityLabel("Quitar la bajada \(di + 1) de la serie \(index + 1)")
            }
        }
        if isCurrent {
            HStack(spacing: 8) {
                Button { workout.addDrop(exercise.name, set: index) } label: {
                    Label("Añadir bajada", systemImage: "plus").font(.apSubhead.weight(.medium)).frame(maxWidth: .infinity, minHeight: 36)
                        .background(Palette.secondary, in: Capsule())
                }
                Button { workout.toggleWarmup(exercise.name, set: index) } label: {
                    Label("Calentamiento", systemImage: isWarmup ? "flame.fill" : "flame").font(.apSubhead.weight(.medium)).frame(maxWidth: .infinity, minHeight: 36)
                        .foregroundStyle(isWarmup ? Palette.gold : Palette.foreground)
                        .background(isWarmup ? Palette.gold.opacity(0.15) : Palette.secondary, in: Capsule())
                }
                .accessibilityLabel("\(isWarmup ? "Quitar" : "Marcar") la serie \(index + 1) como calentamiento")
                .accessibilityAddTraits(isWarmup ? .isSelected : [])
            }
            .buttonStyle(.plain)
        }
        if isWarmup && !set.done {
            Text("Calentamiento: no cuenta en volumen, récords ni series completadas.").font(.apFootnote).foregroundStyle(Palette.muted)
        }
        }
        .padding(.leading, 12).padding(.trailing, 8).padding(.vertical, 8)
        .opacity(set.done ? 0.6 : 1)
        .background(
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .fill(isCurrent ? Palette.gold.opacity(0.05) : (set.done && !isWarmup ? Palette.success.opacity(0.1) : .clear))
                .overlay(RoundedRectangle(cornerRadius: 10, style: .continuous).strokeBorder(isCurrent ? Palette.gold.opacity(0.5) : .clear, lineWidth: 1))
        )
        .overlay(alignment: .top) { if separator && !isCurrent { Rectangle().fill(Palette.separator).frame(height: 0.5).padding(.leading, 12) } }
        .accessibilityAction(named: "Quitar serie") { workout.removeSet(exercise.name, at: index) }
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
            .font(big ? .inter(size: 22, weight: .bold).monospacedDigit()
                      : .inter(.headline).monospacedDigit())
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
                        .font(.inter(size: 34, weight: .bold).monospacedDigit())
                        .contentTransition(.numericText(countsDown: true))
                        .transaction { $0.animation = nil }
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


/// Resumen final calcado de `WorkoutSummary.tsx`: páginas que se deslizan (Resumen y Comparar),
/// puntos de página, «Listo» arriba y Compartir abajo.
struct WorkoutSummaryView: View {
    @ObservedObject var workout: ActiveWorkout
    let rpe: Int?
    var onDone: () -> Void
    @State private var page = 0

    private struct Item { let name: String; let change: String; let trend: Int; let proposal: String } // trend 1 sube, -1 baja, 0 igual, 2 nuevo

    private var title: (String, String) {
        let parts = workout.draft.day.title.components(separatedBy: " · ")
        return (parts.first ?? "", parts.dropFirst().joined(separator: " · "))
    }
    private var dateLabel: String { Date().formatted(.dateTime.weekday(.wide).day().month(.wide).locale(Locale(identifier: "es_ES"))) }
    private var previousVolume: Double {
        workout.previous.values.joined().filter { $0.done && $0.isWarmup != true }
            .reduce(0) { $0 + Double($1.reps) * (Double($1.weight.replacingOccurrences(of: ",", with: ".")) ?? 0) }
    }
    private var completedExercises: Int { workout.draft.logs.values.filter { $0.contains { $0.done && $0.isWarmup != true } }.count }

    private func fmt(_ n: Double) -> String { NumberText.decimal(n, digits: n.rounded() == n ? 0 : 1) }

    /// `buildWorkoutReview` de la web.
    private var review: [Item] {
        workout.exercises.compactMap { ex in
            func valid(_ s: [SetLog]) -> [SetLog] { s.filter { $0.done && $0.isWarmup != true && $0.reps > 0 } }
            func w(_ s: SetLog) -> Double? { let t = s.weight.trimmingCharacters(in: .whitespaces); return t.isEmpty ? nil : Double(t.replacingOccurrences(of: ",", with: ".")) }
            let now = valid(workout.draft.logs[ex.name] ?? [])
            guard !now.isEmpty else { return nil }
            let before = valid(workout.previous[ex.name] ?? [])
            let weighted = { (s: [SetLog]) in !s.isEmpty && s.allSatisfy { w($0) != nil } }
            let top = { (s: [SetLog]) in s.map { w($0) ?? 0 }.max() ?? 0 }
            let vol = { (s: [SetLog]) in s.reduce(0.0) { $0 + (w($1) ?? 0) * Double($1.reps) } }
            let reps = { (s: [SetLog]) in s.reduce(0) { $0 + $1.reps } }
            var delta: Double? = nil
            var change = "Nuevo"
            func sign(_ d: Double) -> String { d > 0 ? "+" : d < 0 ? "−" : "" }
            if before.isEmpty {
            } else if !weighted(now) || !weighted(before) {
                let d = Double(reps(now) - reps(before)); delta = d; change = "\(sign(d))\(Int(abs(d))) reps"
            } else if top(now) != top(before) {
                let d = top(now) - top(before); delta = d; change = "\(sign(d))\(fmt(abs(d))) kg"
            } else if now.count == before.count && zip(now, before).allSatisfy({ w($0) == w($1) }) {
                let d = Double(reps(now) - reps(before)); delta = d; change = "\(sign(d))\(Int(abs(d))) reps"
            } else {
                let d = vol(now) - vol(before); delta = d
                let pct = vol(before) > 0 ? Int((d / vol(before) * 100).rounded()) : 0
                change = "\(d > 0 ? "+" : "−")\(pct == 0 ? "\(fmt(abs(d))) kg" : "\(abs(pct)) %")"
            }
            let proposal = (rpe ?? 0) >= 9 ? "Revisar esfuerzo y recuperación antes de aumentar la carga."
                : (delta ?? 0) < 0 ? "Revisar descanso, técnica y sensaciones antes de cambiar la carga."
                : (delta ?? 0) > 0 ? "Si la técnica fue sólida, sube un poco la carga en la próxima sesión."
                : "Mantener el plan como referencia y reunir otra sesión comparable."
            let trend = delta == nil ? 2 : delta! > 0 ? 1 : delta! < 0 ? -1 : 0
            return Item(name: workout.swaps[ex.name] ?? ex.name, change: trend == 0 ? "=" : change, trend: trend, proposal: proposal)
        }
    }

    var body: some View {
        VStack(spacing: 0) {
            HStack { Spacer(); Button("Listo") { Haptics.tap(); onDone() }.font(.apHeadline).foregroundStyle(Palette.gold).frame(minHeight: 44).padding(.horizontal, 14) }
            TabView(selection: $page) {
                ScrollView { summaryPage.padding(.horizontal, 16) }.tag(0)
                ScrollView { comparePage.padding(.horizontal, 16) }.tag(1)
            }
            #if os(iOS)
            .tabViewStyle(.page(indexDisplayMode: .never))
            #endif
            HStack(spacing: 8) {
                ForEach(0..<2, id: \.self) { i in
                    Circle().fill(Palette.foreground.opacity(i == page ? 1 : 0.25)).frame(width: 7, height: 7)
                        .padding(.vertical, 12).padding(.horizontal, 4).contentShape(Rectangle())
                        .onTapGesture { Haptics.selection(); withAnimation { page = i } }
                }
            }
            ShareLink(item: shareText) { Text("Compartir").frame(maxWidth: .infinity) }
                .buttonStyle(.pill).padding(.horizontal, 16).padding(.bottom, 16)
        }
    }

    private var shareText: String {
        var t = "\(workout.draft.day.title) · \(dateLabel)\n"
        if workout.volumeKg > 0 { t += "\(NumberText.integer(Int(workout.volumeKg))) kg · " }
        t += "\(workout.doneSets) series · \(completedExercises) ejercicios"
        if !workout.records.isEmpty { t += "\n🏆 " + workout.records.joined(separator: " · ") }
        return t + "\nautopilotplan.app"
    }

    private func tile<C: View>(@ViewBuilder _ c: () -> C) -> some View {
        c().padding(14).frame(maxWidth: .infinity, alignment: .leading)
            .background(Palette.secondary, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
    }

    private var summaryPage: some View {
        let vol = workout.volumeKg
        let diff = vol - previousVolume
        let showNote = previousVolume > 0 && vol > 0
        let planned = workout.exercises.count
        let cols = [GridItem(.flexible(), spacing: 10), GridItem(.flexible(), spacing: 10)]
        return VStack(alignment: .leading, spacing: 0) {
            DoneMark().padding(.bottom, 12)
            Text("Completado · \(dateLabel)").font(.apSubhead).foregroundStyle(Palette.muted)
            Text(title.0).font(.apLargeTitle).lineLimit(1).padding(.top, 2)
            if !title.1.isEmpty { Text(title.1).font(.apHeadline).foregroundStyle(Palette.muted).lineLimit(1).padding(.top, 2) }
            LazyVGrid(columns: cols, spacing: 10) {
                if vol > 0 {
                    metric("Volumen", NumberText.integer(Int(vol)), "kg", accent: true, note: showNote ? "\(diff >= 0 ? "+" : "−")\(NumberText.integer(Int(abs(diff)))) kg vs. anterior" : nil, positive: diff >= 0)
                    metric("Series", "\(workout.doneSets)", "")
                    metric("Ejercicios", "\(completedExercises)", "/\(planned)")
                } else {
                    metric("Series", "\(workout.doneSets)", "", accent: true)
                    metric("Ejercicios", "\(completedExercises)", "/\(planned)")
                    metric("Récords", "\(workout.records.count)", "")
                }
                metric("Esfuerzo", rpe.map(String.init) ?? "—", rpe == nil ? "" : "/10")
            }
            .padding(.top, 16)
            if !workout.records.isEmpty {
                tile {
                    HStack(spacing: 12) {
                        Image("lu-trophy").renderingMode(.template).resizable().frame(width: 24, height: 24).foregroundStyle(Palette.gold)
                            .modifier(SoftPop(delay: 0.7))
                        VStack(alignment: .leading, spacing: 0) {
                            Text(workout.records.count == 1 ? "Nuevo récord" : "\(workout.records.count) récords nuevos").font(.apFootnote.weight(.semibold)).foregroundStyle(Palette.gold)
                            Text(workout.records.joined(separator: " · ")).font(.apHeadline).lineLimit(1)
                        }
                    }
                }
                .padding(.top, 10)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func metric(_ label: String, _ value: String, _ unit: String, accent: Bool = false, note: String? = nil, positive: Bool = true) -> some View {
        tile {
            VStack(alignment: .leading, spacing: 4) {
                Text(label).font(.apFootnote.weight(.semibold)).foregroundStyle(accent ? Palette.gold : Palette.muted)
                (Text(value).foregroundColor(accent ? Palette.gold : Palette.foreground) + Text(unit.isEmpty ? "" : " \(unit)").font(.inter(size: 17, weight: .semibold)).foregroundColor(Palette.muted))
                    .font(.inter(size: 30, weight: .bold).monospacedDigit()).lineLimit(1).minimumScaleFactor(0.6)
                if let note { Text(note).font(.inter(.caption).weight(.medium).monospacedDigit()).foregroundStyle(positive ? Palette.success : Palette.muted).lineLimit(1) }
            }
        }
    }

    private var comparePage: some View {
        let items = review
        return VStack(alignment: .leading, spacing: 0) {
            Text("Frente a la última vez").font(.apTitle2)
            if items.isEmpty {
                Text("Esta sesión será tu referencia para la próxima.").font(.apSubhead).foregroundStyle(Palette.muted).padding(.top, 16)
            } else {
                VStack(spacing: 0) {
                    ForEach(Array(items.prefix(6).enumerated()), id: \.offset) { i, it in
                        HStack(spacing: 12) {
                            Text(it.name).font(.apSubhead).lineLimit(1).frame(maxWidth: .infinity, alignment: .leading)
                            let color: Color = it.trend == 1 ? Palette.success : it.trend == -1 ? Palette.destructive : Palette.muted
                            Text(it.change).font(.apFootnote.weight(.semibold).monospacedDigit()).foregroundStyle(color)
                                .padding(.horizontal, 8).padding(.vertical, 2)
                                .background((it.trend == 1 || it.trend == -1 ? color.opacity(0.15) : Palette.foreground.opacity(0.1)), in: Capsule())
                        }
                        .padding(.horizontal, 14).frame(minHeight: 44)
                        .overlay(alignment: .bottom) { if i < min(items.count, 6) - 1 { Rectangle().fill(Palette.separator).frame(height: 0.5) } }
                    }
                }
                .background(Palette.secondary, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                .padding(.top, 16)
            }
            tile {
                HStack(alignment: .top, spacing: 12) {
                    Image("lu-target").renderingMode(.template).resizable().frame(width: 20, height: 20).foregroundStyle(Palette.gold).padding(.top, 2)
                    VStack(alignment: .leading, spacing: 0) {
                        Text("Próxima sesión").font(.apFootnote.weight(.semibold)).foregroundStyle(Palette.gold)
                        Text(items.first?.proposal ?? "Mantén tu plan como referencia para la próxima sesión.").font(.apSubhead)
                    }
                }
            }
            .padding(.top, 12)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}


/// Anillo dorado que se cierra y check que se dibuja (igual que `.done-ring` de la web). Sin animación si se reduce el movimiento.
struct DoneMark: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var ring: CGFloat = 0
    @State private var check: CGFloat = 0
    var body: some View {
        ZStack {
            Circle().stroke(Palette.gold.opacity(0.15), lineWidth: 4)
            Circle().trim(from: 0, to: ring).stroke(Palette.gold, style: StrokeStyle(lineWidth: 4, lineCap: .round)).rotationEffect(.degrees(-90))
            Path { p in p.move(to: CGPoint(x: 19, y: 28.5)); p.addLine(to: CGPoint(x: 25, y: 34.5)); p.addLine(to: CGPoint(x: 37, y: 21.5)) }
                .trim(from: 0, to: check)
                .stroke(Palette.gold, style: StrokeStyle(lineWidth: 4, lineCap: .round, lineJoin: .round))
        }
        .frame(width: 56, height: 56)
        .accessibilityHidden(true)
        .onAppear {
            Haptics.success()
            if reduceMotion { ring = 1; check = 1; return }
            withAnimation(.timingCurve(0.22, 1, 0.36, 1, duration: 0.7)) { ring = 1 }
            withAnimation(.easeOut(duration: 0.32).delay(0.56)) { check = 1 }
        }
    }
}

/// Entrada suave con un pequeño rebote (`.soft-pop` de la web).
struct SoftPop: ViewModifier {
    var delay: Double = 0
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var shown = false
    func body(content: Content) -> some View {
        content.scaleEffect(shown || reduceMotion ? 1 : 0.6).opacity(shown || reduceMotion ? 1 : 0)
            .onAppear { withAnimation(.spring(response: 0.45, dampingFraction: 0.6).delay(delay)) { shown = true } }
    }
}
