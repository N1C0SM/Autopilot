import SwiftUI
#if os(iOS)
import UIKit
#else
import AppKit
#endif

/// Sesión en curso, calcada de `WorkoutTracker.tsx` (vista de lista): barra «Salir · título ·
/// tiempo · X de Y series · ···», tarjetas de ejercicio con la tabla Serie/Previa/Kg/Reps/✓,
/// «Añadir serie», y el pie con el descanso (−30 / +30 / Saltar) y «Terminar entrenamiento».
struct WorkoutView: View {
    @ObservedObject var workout: ActiveWorkout
    let userId: UUID
    var onClose: (_ finished: Bool) -> Void

    @State private var rpeOpen = false
    @State private var finishIncompleteOpen = false
    /// Encadenado de hojas: no se puede abrir una mientras la anterior se cierra; se hace en onDismiss.
    @State private var pendingRPE = false
    @State private var pendingSummary = false
    @State private var discardOpen = false
    @State private var rpe = 7
    @State private var summaryOpen = false
    /// Vista elegida en «···» o en Ajustes: ejercicio a ejercicio (por defecto) o lista vertical.
    @AppStorage("workout-view") private var workoutView = "focus"
    private var focusMode: Bool { workoutView != "list" }
    /// RPE, bajadas, calentamiento y fallo: ocultos por defecto para que anotar sea serie, kg y reps.
    @AppStorage("workout-advanced") private var advanced = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.scenePhase) private var scenePhase

    private var progress: Double { workout.totalSets > 0 ? Double(workout.doneSets) / Double(workout.totalSets) : 0 }

    var body: some View {
        VStack(spacing: 0) {
            ScrollView {
                // LazyVStack: con muchas tarjetas solo se crean las visibles y, al abrir la sesión,
                // no se lanzan las consultas de alternativas de todos los ejercicios a la vez.
                LazyVStack(alignment: .leading, spacing: 12) {
                    sessionStats
                    if focusMode, let i = Optional(min(workout.draft.currentExercise, max(workout.exercises.count - 1, 0))), let ex = workout.exercises[safe: i] {
                        FocusViewer(workout: workout, index: i)
                        SessionExerciseCard(workout: workout, exercise: ex, index: i, userId: userId)
                            .onAppear { workout.openExercises.insert(i) }
                            .id(ex.id)
                    } else {
                        ForEach(Array(workout.exercises.enumerated()), id: \.element.id) { i, ex in
                            SessionExerciseCard(workout: workout, exercise: ex, index: i, userId: userId)
                        }
                    }
                    if let error = workout.saveError {
                        Text(error).font(.apFootnote).foregroundStyle(Palette.destructive)
                    }
                }
                .padding(.horizontal, 16).padding(.top, 12).padding(.bottom, 24)
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .scrollDismissesKeyboard(.interactively)
            footer
        }
        .screenBackground()
        .task {
            // Calienta las miniaturas de la sesión: al hacer scroll ya están.
            let urls = workout.exercises.compactMap(\.image_url).compactMap(URL.init(string:))
            ImageCache.shared.prefetch(urls, maxSide: 140)
        }
        .navigationTitle(workout.draft.day.routine_name?.trimmingCharacters(in: .whitespaces).nilIfEmpty ?? workout.draft.day.title)
        #if os(iOS)
        .navigationBarTitleDisplayMode(.inline)
        .navigationBarBackButtonHidden()
        #endif
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button { Haptics.tap(); workout.persistNow(); onClose(false) } label: {
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
                            .contentTransition(.numericText())
                            .transaction { $0.animation = reduceMotion ? nil : .snappy }
                    }
                }
                .accessibilityElement(children: .combine)
            }
            ToolbarItem(placement: .primaryAction) {
                // Opciones claras: cambiar de vista y de detalle; descartar, al final y en rojo.
                Menu {
                    Button { Haptics.selection(); workoutView = focusMode ? "list" : "focus" } label: {
                        Label(focusMode ? "Ver toda la sesión" : "Ver ejercicio a ejercicio",
                              systemImage: focusMode ? "list.bullet" : "rectangle.portrait")
                    }
                    Toggle(isOn: $advanced) { Label("Más opciones por serie", systemImage: "slider.horizontal.3") }
                    Divider()
                    Button(role: .destructive) { discardOpen = true } label: {
                        Label("Descartar entrenamiento", systemImage: "trash")
                    }
                } label: {
                    Image(systemName: "ellipsis").font(.inter(size: 15, weight: .bold)).foregroundStyle(Palette.gold)
                        .frame(width: 30, height: 30).background(Palette.secondary, in: Circle())
                        .frame(width: 44, height: 44).contentShape(Rectangle())
                }
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
                // Primero el descanso (persiste) y después descartar: así ningún guardado
                // diferido resucita el borrador que acabamos de borrar.
                workout.skipRest()
                workout.discard()
                onClose(false)
            } onCancel: { discardOpen = false }
        }
        .sheet(isPresented: $finishIncompleteOpen, onDismiss: {
            if pendingRPE { pendingRPE = false; rpeOpen = true }
        }) {
            ChoiceSheet(title: "¿Terminar con series pendientes?",
                        message: "Te quedan \(workout.totalSets - workout.doneSets) de \(workout.totalSets) series. Puedes terminarlo igualmente o seguir entrenando.",
                        primary: "Terminar y guardar", destructive: false) {
                pendingRPE = true
                finishIncompleteOpen = false
            } onCancel: { finishIncompleteOpen = false }
        }
        .sheet(isPresented: $rpeOpen, onDismiss: {
            if pendingSummary { pendingSummary = false; summaryOpen = true }
        }) { rpeSheet }
        .sheet(isPresented: $summaryOpen, onDismiss: { onClose(true) }) { summarySheet }
        .onChange(of: scenePhase) { _, phase in
            // El borrador se guarda con retardo: al salir de la app se fuerza la escritura.
            if phase != .active { workout.persistNow() }
        }
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

    /// Cifras de la sesión en vivo, como el tracker de Hevy: duración, volumen y series.
    private var sessionStats: some View {
        TimelineView(.periodic(from: .now, by: 1)) { ctx in
            HStack(spacing: 0) {
                sessionStat("Duración", elapsed(ctx.date))
                sessionStat("Volumen", "\(NumberText.integer(Int(workout.volumeKg))) kg")
                sessionStat("Series", "\(workout.doneSets)/\(workout.totalSets)")
            }
            .padding(.horizontal, 4)
            .padding(.bottom, 4)
        }
        .accessibilityElement(children: .combine)
    }

    private func sessionStat(_ label: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 1) {
            Text(label).font(.apCaption).foregroundStyle(Palette.muted)
            Text(value).font(.inter(size: 18, weight: .bold).monospacedDigit())
                .lineLimit(1).minimumScaleFactor(0.7)
                .contentTransition(.numericText())
                .animation(reduceMotion ? nil : .snappy, value: value)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityLabel("\(label): \(value)")
    }

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
                if workout.saving { HStack { BrandLoader().tint(.black); Text("Guardando…") } } else { Text("Terminar entrenamiento") }
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
                Task {
                    if await workout.finish(userId: userId, rpe: rpe) {
                        pendingSummary = true
                        rpeOpen = false
                    }
                }
            } label: {
                if workout.saving { BrandLoader().tint(.black) } else { Text("Guardar") }
            }
            .buttonStyle(.pill)
            .disabled(workout.saving)
            if let error = workout.saveError { Text(error).font(.apFootnote).foregroundStyle(Palette.destructive) }
        }
        .padding(28)
        .frame(minWidth: 340)
        .presentationDetents([.medium])
        .presentationBackground(Palette.card)
        .interactiveDismissDisabled(workout.saving)
    }
}

/// Tarjeta de ejercicio en sesión: cabecera (miniatura, nombre, «N series · R reps · descanso», ✓)
/// y, abierta, la tabla de series.
struct SessionExerciseCard: View {
    @ObservedObject var workout: ActiveWorkout
    let exercise: GymExercise
    let index: Int
    let userId: UUID

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @AppStorage("workout-advanced") private var advanced = false

    private var sets: [SetLog] { workout.draft.logs[exercise.name] ?? [] }
    private var allDone: Bool { !sets.isEmpty && sets.allSatisfy(\.done) }
    /// El ejercicio siempre está desplegado: se anota sin pulsar antes (menos fricción).
    private var isOpen: Bool { true }
    private var firstPending: Int? { sets.firstIndex { !$0.done } }
    @State private var technique = false
    /// Celebración breve al completar todas las series del ejercicio.
    @State private var justCompleted = false
    @State private var swapSheet = false
    @State private var swapOptions: [String] = []

    private func metaChip(icon: String, text: String) -> some View {
        HStack(spacing: 4) {
            Image(systemName: icon).font(.inter(size: 10, weight: .semibold))
            Text(text).font(.apCaption).lineLimit(1)
        }
        .foregroundStyle(Palette.muted)
        .padding(.horizontal, 8)
        .padding(.vertical, 3)
        .background(Palette.secondary, in: Capsule())
        .accessibilityElement(children: .combine)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 12) {
                    WorkoutThumb(url: exercise.image_url, completed: allDone)
                    VStack(alignment: .leading, spacing: 5) {
                        Text(workout.swaps[exercise.name] ?? exercise.name)
                            .font(.apHeadline)
                            .lineLimit(2)
                            .foregroundStyle(allDone ? Palette.muted : Palette.gold)
                        if workout.swaps[exercise.name] != nil {
                            Text("En lugar de \(exercise.name)").font(.apFootnote).foregroundStyle(Palette.muted).lineLimit(1)
                        }
                        // Chips como en Hevy: descanso y prescripción, legibles de un vistazo.
                        FlowRow(spacing: 6) {
                            metaChip(icon: "clock", text: "Descanso \(exercise.rest)")
                            metaChip(icon: "dumbbell", text: "\(exercise.series) × \(exercise.reps)")
                            if let pos = workout.supersetPosition(of: exercise.name) {
                                metaChip(icon: "link", text: "Superset \(pos.letter)")
                                    .foregroundStyle(Palette.gold)
                            }
                        }
                    }
                    Spacer(minLength: 0)
                    if allDone {
                        Image(systemName: "checkmark").font(.inter(size: 18, weight: .bold)).foregroundStyle(Palette.gold)
                            .frame(width: 36, height: 44)
                            .scaleEffect(justCompleted && !reduceMotion ? 1.25 : 1)
                            .animation(reduceMotion ? nil : .spring(response: 0.3, dampingFraction: 0.45), value: justCompleted)
                            .accessibilityLabel("ejercicio completado")
                    } else {
                        ExerciseSwapMenu(workout: workout, exercise: exercise)
                    }
                    Button { technique = true } label: { Image(systemName: "info.circle").font(.inter(size: 19)) }
                        .buttonStyle(.plain).foregroundStyle(Palette.muted).frame(width: 44, height: 44)
                        .accessibilityLabel("Ver ficha de técnica de \(exercise.name)")
                }
            .padding(.leading, 12).padding(.trailing, 8).frame(minHeight: 68)

            // Siempre desplegado: cero fricción para anotar (nada de tocar dos veces).
            if isOpen {
                VStack(spacing: 6) {
                    HStack(spacing: 8) {
                        Text("Serie").frame(width: 24)
                        Text("Previa").frame(width: 52)
                        Text("Kg").frame(maxWidth: .infinity)
                        Text("Reps").frame(maxWidth: .infinity)
                        if advanced { Text("RPE").frame(width: 44) }
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
                        Label("Añadir serie", systemImage: "plus")
                            .font(.apBody.weight(.medium))
                            .foregroundStyle(Palette.foreground)
                            .frame(maxWidth: .infinity, minHeight: 44)
                            .background(Palette.secondary, in: Capsule())
                    }
                    .buttonStyle(.plain)
                }
                .padding(.horizontal, 8).padding(.bottom, 12).padding(.top, 4)
            }
        }
        .background(Palette.card, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
        .overlay {
            // Aviso visual breve (1,2 s) al completar el ejercicio; sin animación con Reduce Motion.
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .strokeBorder(Palette.gold.opacity(justCompleted ? 0.85 : 0), lineWidth: 1.5)
                .animation(reduceMotion ? nil : .easeOut(duration: 0.25), value: justCompleted)
                .allowsHitTesting(false)
        }
        .sensoryFeedback(.success, trigger: allDone) { _, done in done }
        .onChange(of: allDone) { _, done in
            guard done else { justCompleted = false; return }
            withAnimation(reduceMotion ? nil : .snappy) { justCompleted = true }
            Task {
                try? await Task.sleep(for: .seconds(1.2))
                withAnimation(reduceMotion ? nil : .easeOut(duration: 0.3)) { justCompleted = false }
            }
        }
        .contextMenu {
            Button { technique = true } label: { Label("Ficha de técnica", systemImage: "info.circle") }
            Button { Task { await openSwapSheet() } } label: { Label("Cambiar ejercicio", systemImage: "arrow.left.arrow.right") }
            if workout.supersetPosition(of: exercise.name) != nil {
                Button { Haptics.selection(); workout.toggleSuperset(exercise.name) } label: { Label("Quitar del superset", systemImage: "link") }
            } else if let i = workout.exercises.firstIndex(where: { $0.name == exercise.name }), i + 1 < workout.exercises.count {
                Button { Haptics.selection(); workout.toggleSuperset(exercise.name) } label: {
                    Label("Superset con \(workout.exercises[i + 1].name)", systemImage: "link")
                }
            }
            Divider()
            Button { Haptics.tap(); workout.addSet(exercise.name) } label: { Label("Añadir serie", systemImage: "plus") }
            if allDone {
                Button { Haptics.tap(); sets.indices.forEach { si in workout.update(exercise.name, set: si) { $0.done = false } } } label: {
                    Label("Desmarcar todas las series", systemImage: "arrow.uturn.backward")
                }
            } else {
                Button { Haptics.success(); sets.indices.forEach { si in workout.update(exercise.name, set: si) { $0.done = true } } } label: {
                    Label("Marcar todas las series", systemImage: "checkmark.circle")
                }
            }
        }
        .accessibilityHint("Mantén pulsado para cambiar el ejercicio o hacer un superset")
        .sheet(isPresented: $technique) { TechniqueSheet(exercise: exercise) }
        .sheet(isPresented: $swapSheet) { swapSheetContent }
    }

    private func openSwapSheet() async {
        if let group = exercise.muscle_group {
            swapOptions = await ExerciseSwapMenu.options(for: group).filter { $0 != exercise.name }
        }
        Haptics.tap()
        swapSheet = true
    }

    private func applySwap(_ name: String?) {
        Haptics.selection()
        workout.swap(exercise.name, to: name, userId: userId)
        swapSheet = false
    }

    private var swapSheetContent: some View {
        VStack(spacing: 0) {
            Text("Cambiar \(exercise.name)").font(.apTitle3).multilineTextAlignment(.center)
                .padding(.top, 22).padding(.horizontal, 20)
                .accessibilityAddTraits(.isHeader)
            ScrollView {
                VStack(spacing: 0) {
                    if workout.swaps[exercise.name] != nil {
                        swapRow("Volver a \(exercise.name)") { applySwap(nil) }
                    }
                    ForEach(swapOptions, id: \.self) { name in
                        swapRow(name, selected: workout.swaps[exercise.name] == name) { applySwap(name) }
                    }
                    if swapOptions.isEmpty {
                        Text("Buscando alternativas…").font(.apSubhead).foregroundStyle(Palette.muted).padding(20)
                    }
                }
                .background(Palette.card, in: RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
                .padding(16)
            }
            Button("Cerrar") { Haptics.tap(); swapSheet = false }.buttonStyle(.pillSecondary).padding(20)
        }
        .presentationDetents([.medium, .large])
        .presentationBackground(Palette.card)
    }

    private func swapRow(_ title: String, selected: Bool = false, action: @escaping () -> Void) -> some View {
        Button { action() } label: {
            HStack(spacing: 12) {
                Text(title).font(.apBody).multilineTextAlignment(.leading)
                Spacer(minLength: 8)
                if selected {
                    Image(systemName: "checkmark").font(.inter(size: 13, weight: .bold)).foregroundStyle(Palette.gold)
                }
            }
            .padding(.horizontal, 16)
            .frame(maxWidth: .infinity, minHeight: 50, alignment: .leading)
            .contentShape(Rectangle())
            .overlay(alignment: .bottom) { Rectangle().fill(Palette.separator).frame(height: 0.5).padding(.leading, 16) }
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(selected ? .isSelected : [])
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
            // Carrusel arriba y el movimiento en grande debajo: se ve en qué ejercicio estás.
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(Array(workout.exercises.enumerated()), id: \.element.id) { i, item in
                        let sets = workout.draft.logs[item.name] ?? []
                        let done = !sets.isEmpty && sets.allSatisfy(\.done)
                        Button { go(i) } label: {
                            WorkoutThumb(url: item.image_url, completed: done)
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
            // La foto rellena un hueco fijo (overlay): no empuja el ancho de la pantalla.
            Palette.card
                .frame(maxWidth: .infinity).frame(height: 300)
                .overlay {
                    if let i = ex.image_url, let u = URL(string: i) {
                        CachedAsyncImage(url: u) { $0.resizable().scaledToFill() } placeholder: { BrandLoader() }
                    } else {
                        Image(systemName: "dumbbell").font(.inter(.title)).foregroundStyle(Palette.muted)
                    }
                }
                .clipShape(RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
            .gesture(DragGesture(minimumDistance: 30).onEnded { v in
                if v.translation.width < -60 { go(index + 1) } else if v.translation.width > 60 { go(index - 1) }
            })
            .accessibilityLabel("\(ex.name). Desliza para cambiar de ejercicio")
            .accessibilityAdjustableAction { dir in
                switch dir { case .increment: go(index + 1); case .decrement: go(index - 1); default: break }
            }
        }
    }
}

/// Alternativas por grupo muscular: cada tarjeta pedía su lista al aparecer (varias consultas
/// repetidas al abrir la sesión). Ahora se comparten por grupo, con dedupe de la petición en vuelo.
private final class ExerciseSwapCache: @unchecked Sendable {
    static let shared = ExerciseSwapCache()

    private let lock = NSLock()
    private var values: [String: (names: [String], at: Date)] = [:]
    private var inflight: [String: Task<[String], Never>] = [:]
    private let ttl: TimeInterval = 10 * 60

    func cached(_ group: String) -> [String]? {
        lock.lock(); defer { lock.unlock() }
        guard let entry = values[group], Date().timeIntervalSince(entry.at) < ttl else { return nil }
        return entry.names
    }

    func store(_ names: [String], group: String) {
        lock.lock(); defer { lock.unlock() }
        values[group] = (names, Date())
    }

    func inflight(_ group: String) -> Task<[String], Never>? {
        lock.lock(); defer { lock.unlock() }
        return inflight[group]
    }

    func setInflight(_ task: Task<[String], Never>, group: String) {
        lock.lock(); defer { lock.unlock() }
        inflight[group] = task
    }

    func clearInflight(group: String) {
        lock.lock(); defer { lock.unlock() }
        inflight[group] = nil
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
            Divider()
            if workout.supersetPosition(of: exercise.name) != nil {
                Button("Quitar del superset") { Haptics.selection(); workout.toggleSuperset(exercise.name) }
            } else if let i = workout.exercises.firstIndex(where: { $0.name == exercise.name }), i + 1 < workout.exercises.count {
                Button("Superset con \(workout.exercises[i + 1].name)") {
                    Haptics.selection()
                    workout.toggleSuperset(exercise.name)
                }
            }
        } label: {
            Image(systemName: "arrow.left.arrow.right").font(.inter(size: 16, weight: .semibold)).frame(width: 44, height: 44)
        }
        .menuStyle(.borderlessButton).fixedSize()
        .foregroundStyle(Palette.muted)
        .accessibilityLabel("Cambiar \(exercise.name)")
        .task {
            guard let group = exercise.muscle_group else { return }
            let names = await Self.options(for: group)
            options = names.filter { $0 != exercise.name }
        }
    }

    static func options(for group: String) async -> [String] {
        let cache = ExerciseSwapCache.shared
        if let hit = cache.cached(group) { return hit }
        let task: Task<[String], Never>
        if let existing = cache.inflight(group) {
            task = existing
        } else {
            task = Task { await fetchOptions(for: group) }
            cache.setInflight(task, group: group)
        }
        let names = await task.value
        cache.clearInflight(group: group)
        cache.store(names, group: group)
        return names
    }

    private static func fetchOptions(for group: String) async -> [String] {
        struct E: Decodable { let name: String }
        let rows: [E] = (try? await Backend.client.from("exercises").select("name")
            .eq("muscle_group", value: group).limit(40).execute().value) ?? []
        return rows.map(\.name)
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
    @AppStorage("workout-advanced") private var advanced = false

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
        HStack(spacing: 8) {
            Group {
                if isWarmup {
                    Text("W")
                        .font(.inter(size: 13, weight: .heavy))
                        .foregroundStyle(Color.black)
                        .frame(width: 24, height: 24)
                        .background(Palette.gold, in: RoundedRectangle(cornerRadius: 7, style: .continuous))
                } else {
                    Text("\(index + 1)")
                        .font(.inter(.headline).monospacedDigit())
                        .foregroundStyle(self.set.failure == true ? Palette.destructive : (isCurrent ? Palette.gold : Palette.muted))
                        .frame(width: 24)
                        .overlay(alignment: .bottom) {
                            if self.set.failure == true {
                                Circle().fill(Palette.destructive).frame(width: 4, height: 4).offset(y: 5)
                            }
                        }
                }
            }
                .accessibilityHidden(true)
            Text(previous.map { $0.done ? "\($0.weight.isEmpty ? "—" : $0.weight.replacingOccurrences(of: ".", with: ","))×\($0.reps)" : "—" } ?? "—")
                .font(.inter(.caption).monospacedDigit()).foregroundStyle(Palette.muted).lineLimit(1).minimumScaleFactor(0.7)
                .frame(width: 52)
                .accessibilityLabel("Previa: " + (previous.map { "\($0.weight) kilos por \($0.reps)" } ?? "sin datos"))
            NumberField(value: set.weight,
                        placeholder: previous?.weight.nilIfEmpty ?? exercise.weight.nilIfEmpty ?? "kg",
                        big: isCurrent, decimal: true) { v in
                workout.update(exercise.name, set: index) { $0.weight = v }
            }
                .accessibilityLabel("Peso de la serie \(index + 1) de \(exercise.name)")
            NumberField(value: set.reps > 0 ? String(set.reps) : "",
                        placeholder: String(exercise.repsTarget),
                        big: isCurrent, decimal: false) { v in
                if let n = Int(v) { workout.update(exercise.name, set: index) { $0.reps = n } }
            }
                .accessibilityLabel("Repeticiones de la serie \(index + 1) de \(exercise.name)")
            if advanced {
            Menu {
                ForEach(6...10, id: \.self) { v in
                    Button("RPE \(v)") {
                        Haptics.selection()
                        workout.update(exercise.name, set: index) { $0.rpe = v }
                    }
                }
                if set.rpe != nil {
                    Divider()
                    Button("Quitar RPE", role: .destructive) {
                        workout.update(exercise.name, set: index) { $0.rpe = nil }
                    }
                }
            } label: {
                Text(set.rpe.map(String.init) ?? "—")
                    .font(.inter(size: 12, weight: .semibold).monospacedDigit())
                    .foregroundStyle(set.rpe == nil ? Palette.muted.opacity(0.6) : Palette.gold)
                    .contentTransition(.numericText())
                    .frame(width: 40, height: 32)
                    .background(set.rpe == nil ? Palette.secondary : Palette.gold.opacity(0.16), in: Capsule())
                    .frame(width: 44, height: 44)
                    .contentShape(Rectangle())
            }
            .accessibilityLabel("RPE de la serie \(index + 1) de \(exercise.name)")
            .accessibilityValue(set.rpe.map { "\($0) de 10" } ?? "sin definir")
            }
            Button { workout.toggleDone(exercise, set: index) } label: {
                ZStack {
                    Circle().strokeBorder(set.done ? Palette.success : Palette.muted.opacity(0.4), lineWidth: 2)
                        .background(Circle().fill(set.done ? Palette.success : .clear))
                    Image(systemName: "checkmark").font(.inter(size: 14, weight: .heavy))
                        .foregroundStyle(set.done ? Color.white : Palette.muted.opacity(0.4))
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
                NumberField(value: drop.weight, placeholder: "kg", big: false, decimal: true) { v in
                    workout.updateDrop(exercise.name, set: index, drop: di) { $0.weight = v }
                }
                    .accessibilityLabel("Peso de la bajada \(di + 1) de la serie \(index + 1)")
                NumberField(value: drop.reps > 0 ? String(drop.reps) : "", placeholder: "reps", big: false, decimal: false) { v in
                    if let n = Int(v) { workout.updateDrop(exercise.name, set: index, drop: di) { $0.reps = n } }
                }
                    .accessibilityLabel("Repeticiones de la bajada \(di + 1) de la serie \(index + 1)")
                if advanced { Color.clear.frame(width: 44, height: 1) }
                Button { workout.removeDrop(exercise.name, set: index, drop: di) } label: {
                    Image(systemName: "xmark").font(.inter(size: 11, weight: .bold)).frame(width: 26, height: 26).background(Palette.secondary, in: Circle())
                        .frame(width: 44, height: 44)
                }
                .buttonStyle(.plain).foregroundStyle(Palette.muted)
                .accessibilityLabel("Quitar la bajada \(di + 1) de la serie \(index + 1)")
            }
        }
        if isCurrent && advanced {
            HStack(spacing: 8) {
                Button { Haptics.tap(); workout.addDrop(exercise.name, set: index) } label: {
                    Label("Bajada", systemImage: "plus").font(.apSubhead.weight(.medium)).lineLimit(1)
                        .frame(maxWidth: .infinity, minHeight: 44)
                        .background(Palette.secondary, in: Capsule())
                }
                .accessibilityLabel("Añadir una bajada a la serie \(index + 1)")
                Button { Haptics.selection(); workout.toggleWarmup(exercise.name, set: index) } label: {
                    Label("Calent.", systemImage: isWarmup ? "flame.fill" : "flame").font(.apSubhead.weight(.medium)).lineLimit(1)
                        .frame(maxWidth: .infinity, minHeight: 44)
                        .foregroundStyle(isWarmup ? Palette.gold : Palette.foreground)
                        .background(isWarmup ? Palette.gold.opacity(0.15) : Palette.secondary, in: Capsule())
                }
                .accessibilityLabel("\(isWarmup ? "Quitar" : "Marcar") la serie \(index + 1) como calentamiento")
                .accessibilityAddTraits(isWarmup ? .isSelected : [])
                Button { Haptics.selection(); workout.update(exercise.name, set: index) { $0.failure = (set.failure == true) ? nil : true } } label: {
                    Label("Fallo", systemImage: "bolt.fill").font(.apSubhead.weight(.medium)).lineLimit(1)
                        .frame(maxWidth: .infinity, minHeight: 44)
                        .foregroundStyle(set.failure == true ? Palette.destructive : Palette.foreground)
                        .background(set.failure == true ? Palette.destructive.opacity(0.15) : Palette.secondary, in: Capsule())
                }
                .accessibilityLabel("\(set.failure == true ? "Quitar" : "Marcar") la serie \(index + 1) como llevada al fallo")
                .accessibilityAddTraits(set.failure == true ? .isSelected : [])
            }
            .buttonStyle(.plain)
        }
        if isWarmup && !set.done {
            Text("Calentamiento: no cuenta en volumen, récords ni series completadas.").font(.apFootnote).foregroundStyle(Palette.muted)
        }
        }
        .padding(.leading, 12).padding(.trailing, 8).padding(.vertical, 8)
        .background(
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .fill(isCurrent ? Palette.gold.opacity(0.05) : (set.done && !isWarmup ? Palette.success.opacity(0.14) : .clear))
                .overlay(RoundedRectangle(cornerRadius: 10, style: .continuous).strokeBorder(isCurrent ? Palette.gold.opacity(0.5) : .clear, lineWidth: 1))
        )
        .overlay(alignment: .top) { if separator && !isCurrent { Rectangle().fill(Palette.separator).frame(height: 0.5).padding(.leading, 12) } }
        .accessibilityAction(named: "Quitar serie") { workout.removeSet(exercise.name, at: index) }
        .contextMenu {
            Button(role: .destructive) { Haptics.warning(); workout.removeSet(exercise.name, at: index) } label: {
                Label("Quitar serie", systemImage: "trash")
            }
            Button { Haptics.selection(); workout.toggleWarmup(exercise.name, set: index) } label: {
                Label(isWarmup ? "Quitar calentamiento" : "Marcar como calentamiento", systemImage: "flame")
            }
            Button { Haptics.selection(); workout.update(exercise.name, set: index) { $0.failure = (set.failure == true) ? nil : true } } label: {
                Label(set.failure == true ? "Quitar fallo" : "Marcar al fallo", systemImage: "bolt.fill")
            }
            if set.done {
                Button { Haptics.tap(); workout.toggleDone(exercise, set: index) } label: {
                    Label("Desmarcar serie", systemImage: "arrow.uturn.backward")
                }
            }
        }
    }
}

/// Campo numérico (NUMBER_FIELD): gris, 10 pt de radio, cifra redondeada; la serie actual, más grande.
///
/// Mantiene su propio texto mientras se escribe y avisa al modelo 350 ms después de la última
/// pulsación. Antes cada tecla publicaba la sesión entera (JSON incluido) y redibujaba todas las
/// series: era el principal tirón al anotar kg/reps.
struct NumberField: View {
    /// Valor del modelo, ya formateado a texto.
    let value: String
    let placeholder: String
    let big: Bool
    let decimal: Bool
    var onCommit: (String) -> Void

    @State private var text: String
    @State private var commitTask: Task<Void, Never>?
    @FocusState private var focused: Bool

    init(value: String, placeholder: String, big: Bool, decimal: Bool, onCommit: @escaping (String) -> Void) {
        self.value = value
        self.placeholder = placeholder
        self.big = big
        self.decimal = decimal
        self.onCommit = onCommit
        _text = State(initialValue: value)
    }

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
            .focused($focused)
            .onChange(of: text) { _, newValue in scheduleCommit(newValue) }
            .onChange(of: focused) { _, isFocused in if !isFocused { commitNow() } }
            .onChange(of: value) { _, newValue in
                // El modelo cambió desde fuera (p. ej. «Aplicar» progresión): sincroniza sin editar.
                guard !focused, text != newValue else { return }
                commitTask?.cancel()
                commitTask = nil
                text = newValue
            }
            .onDisappear { commitNow() }
    }

    private func scheduleCommit(_ newValue: String) {
        commitTask?.cancel()
        let commit = onCommit
        commitTask = Task {
            try? await Task.sleep(nanoseconds: 350_000_000)
            guard !Task.isCancelled else { return }
            commit(newValue)
        }
    }

    private func commitNow() {
        commitTask?.cancel()
        commitTask = nil
        onCommit(text)
    }
}

/// Miniatura de ejercicio de la sesión: misma apariencia que `ExerciseThumb` (TrainView), pero
/// decodificando a tamaño de miniatura en vez de los ~2700 px de `CachedAsyncImage`. Con 6-8
/// tarjetas abiertas eso eran cientos de MB de decodificado y tirones al abrir la sesión.
private struct WorkoutThumb: View {
    let url: String?
    var completed = false
    var size: CGFloat = 52

    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 12, style: .continuous).fill(Palette.secondary)
            if let u = url.flatMap(URL.init(string:)) {
                RemoteThumb(url: u, maxSide: max(140, size * 2)) { Color.clear }
            } else {
                Image(systemName: "dumbbell").foregroundStyle(Palette.muted)
            }
            if completed {
                Color.black.opacity(0.5)
                Image(systemName: "checkmark").font(.inter(.headline).weight(.bold)).foregroundStyle(Palette.gold)
            }
        }
        .frame(width: size, height: size)
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        .accessibilityHidden(true)
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
    /// PNG de la tarjeta visible, listo para compartir como imagen.
    @State private var shareURL: URL?
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    /// El confeti solo se lanza una vez por resumen (y nunca con «Reducir movimiento»).
    @State private var confettiDone = false

    init(workout: ActiveWorkout, rpe: Int?, onDone: @escaping () -> Void) {
        self.workout = workout
        self.rpe = rpe
        self.onDone = onDone
        #if DEBUG
        // Solo para capturas de QA: `-summaryPage=2` abre esa tarjeta del resumen.
        if let arg = ProcessInfo.processInfo.arguments.first(where: { $0.hasPrefix("-summaryPage=") }),
           let n = Int(arg.dropFirst("-summaryPage=".count)) {
            _page = State(initialValue: min(max(n, 0), 4))
        }
        #endif
    }

    private struct Item { let name: String; let change: String; let trend: Int; let proposal: String }
    private struct ExRow: Identifiable { let id: String; let name: String; let sets: Int }

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

    private var durationText: String {
        let secs = max(0, Int(Date().timeIntervalSince(workout.draft.startedAt)))
        let h = secs / 3600, m = (secs % 3600) / 60
        if h > 0 { return "\(h) h \(m) min" }
        if m > 0 { return "\(m) min" }
        return "\(secs) s"
    }

    /// Ejercicios con series hechas, en orden de la sesión (para la tarjeta de resumen).
    private var exerciseRows: [ExRow] {
        workout.exercises.compactMap { ex in
            let done = (workout.draft.logs[ex.name] ?? []).filter { $0.done && $0.isWarmup != true }
            guard !done.isEmpty else { return nil }
            return ExRow(id: ex.id, name: workout.swaps[ex.name] ?? ex.name, sets: done.count)
        }
    }

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
            header
            cards
            dots
            actions
        }
        .background(Palette.background)
        .overlay(alignment: .top) {
            if !workout.records.isEmpty && !confettiDone {
                CelebrationConfetti()
                    .onAppear {
                        Haptics.success()
                        Task {
                            try? await Task.sleep(for: .seconds(3.2))
                            confettiDone = true
                        }
                    }
            }
        }
        .task(id: page) { shareURL = renderCard() }
    }

    // MARK: - Cabecera

    private var header: some View {
        ZStack(alignment: .topTrailing) {
            VStack(spacing: 6) {
                Text("¡Buen trabajo!").font(.apLargeTitle).accessibilityAddTraits(.isHeader)
                Text("\(title.0) · \(dateLabel)")
                    .font(.apSubhead)
                    .foregroundStyle(Palette.muted)
                    .lineLimit(1)
            }
            .frame(maxWidth: .infinity)
            .padding(.top, 22)
            .padding(.horizontal, 56)

            Button {
                Haptics.selection()
                withAnimation(reduceMotion ? nil : .snappy) { page = (page + 1) % 5 }
            } label: {
                Image(systemName: "party.popper.fill")
                    .font(.inter(size: 18))
                    .foregroundStyle(Palette.gold)
                    .frame(width: 44, height: 44)
                    .background(Palette.secondary, in: Circle())
            }
            .buttonStyle(.plain)
            .padding(.trailing, 20)
            .padding(.top, 14)
            .accessibilityLabel("Siguiente tarjeta")
        }
    }

    // MARK: - Tarjetas deslizantes

    private var cards: some View {
        #if os(iOS)
        TabView(selection: $page) {
            summaryCard.tag(0)
            statsCard.tag(1)
            funCard.tag(2)
            recordsCard.tag(3)
            compareCard.tag(4)
        }
        .tabViewStyle(.page(indexDisplayMode: .never))
        .frame(height: 430)
        .padding(.top, 8)
        #else
        ScrollView {
            VStack(spacing: 12) { summaryCard; statsCard; funCard; recordsCard; compareCard }
                .padding(.horizontal, 20)
                .padding(.vertical, 12)
        }
        #endif
    }

    @ViewBuilder
    private func cardFor(_ i: Int) -> some View {
        switch i {
        case 0: summaryCard
        case 1: statsCard
        case 2: funCard
        case 3: recordsCard
        default: compareCard
        }
    }

    /// Renderiza la tarjeta visible a PNG (1080×1350) para compartirla como imagen.
    @MainActor
    private func renderCard() -> URL? {
        // Mismo fondo negro y mismos márgenes que en pantalla: la imagen es idéntica a la tarjeta.
        let view = cardFor(page)
            .frame(width: 360, height: 450)
            .background(Palette.background)
            // Sin esto, ImageRenderer usa el esquema claro y los textos salen negros sobre negro.
            .environment(\.colorScheme, .dark)
        let renderer = ImageRenderer(content: view)
        renderer.scale = 3
        #if os(iOS)
        guard let image = renderer.uiImage, let data = image.pngData() else { return nil }
        #else
        guard let image = renderer.nsImage,
              let tiff = image.tiffRepresentation,
              let rep = NSBitmapImageRep(data: tiff),
              let data = rep.representation(using: .png, properties: [:]) else { return nil }
        #endif
        #if DEBUG
        // Solo QA: `-saveCard` deja una copia en Documents para poder inspeccionarla desde el Mac.
        if ProcessInfo.processInfo.arguments.contains("-saveCard"),
           let docs = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first {
            try? data.write(to: docs.appendingPathComponent("autopilot-card.png"))
        }
        #endif
        let url = FileManager.default.temporaryDirectory.appendingPathComponent("autopilot-card.png")
        do { try data.write(to: url); return url } catch { return nil }
    }

    private func card<C: View>(@ViewBuilder _ content: () -> C) -> some View {
        content()
            .padding(24)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .background {
                LinearGradient(colors: [Palette.card, Color.black.opacity(0.94)], startPoint: .topLeading, endPoint: .bottomTrailing)
            }
            .clipShape(RoundedRectangle(cornerRadius: 28, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: 28, style: .continuous)
                    .strokeBorder(Palette.gold.opacity(0.35), lineWidth: 1)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 6)
    }

    private var brandFooter: some View {
        HStack {
            Text("AUTOPILOT").font(.apCaption.weight(.bold)).tracking(2).foregroundStyle(Palette.foreground)
            Spacer()
            Text("autopilotplan.app").font(.apCaption).foregroundStyle(Palette.muted)
        }
    }

    private func eyebrow(_ text: String) -> some View {
        Text(text)
            .font(.apCaption.weight(.bold))
            .tracking(2)
            .foregroundStyle(Palette.gold)
    }

    private var summaryCard: some View {
        card {
            VStack(alignment: .leading, spacing: 0) {
                eyebrow("AUTOPILOT")
                Spacer(minLength: 10)
                Text(title.0)
                    .font(.figure(size: 42))
                    .lineLimit(2)
                    .minimumScaleFactor(0.7)
                if !title.1.isEmpty {
                    Text(title.1)
                        .font(.apSubhead)
                        .foregroundStyle(Palette.muted)
                        .lineLimit(2)
                        .padding(.top, 4)
                }
                Text("\(dateLabel) · \(durationText)")
                    .font(.apFootnote)
                    .foregroundStyle(Palette.muted)
                    .padding(.top, 8)
                Spacer(minLength: 14)
                VStack(alignment: .leading, spacing: 7) {
                    ForEach(Array(exerciseRows.prefix(6).enumerated()), id: \.element.id) { _, row in
                        HStack(alignment: .firstTextBaseline, spacing: 8) {
                            Text("\(row.sets)×")
                                .font(.apFootnote.weight(.bold).monospacedDigit())
                                .foregroundStyle(Palette.gold)
                            Text(row.name).font(.apSubhead).lineLimit(1)
                        }
                    }
                    if exerciseRows.count > 6 {
                        Text("+\(exerciseRows.count - 6) ejercicios").font(.apFootnote).foregroundStyle(Palette.muted)
                    }
                }
                Spacer(minLength: 0)
                brandFooter.padding(.top, 12)
            }
        }
    }

    private var statsCard: some View {
        card {
            VStack(alignment: .leading, spacing: 0) {
                eyebrow("CIFRAS")
                LazyVGrid(columns: [GridItem(.flexible(), spacing: 14), GridItem(.flexible(), spacing: 14)], spacing: 22) {
                    figure("Volumen", "\(NumberText.integer(Int(workout.volumeKg))) kg", accent: true)
                    figure("Series", "\(workout.doneSets)")
                    figure("Duración", durationText)
                    figure("Ejercicios", "\(completedExercises)/\(workout.exercises.count)")
                    if let rpe { figure("Esfuerzo", "\(rpe)/10") }
                }
                .padding(.top, 28)
                Spacer(minLength: 12)
                if previousVolume > 0, workout.volumeKg > 0 {
                    let diff = workout.volumeKg - previousVolume
                    Text("\(diff >= 0 ? "+" : "−")\(NumberText.integer(Int(abs(diff)))) kg respecto a la última vez")
                        .font(.apFootnote)
                        .foregroundStyle(diff >= 0 ? Palette.success : Palette.muted)
                        .padding(.bottom, 10)
                }
                brandFooter
            }
        }
    }

    private func figure(_ label: String, _ value: String, accent: Bool = false) -> some View {
        VStack(alignment: .leading, spacing: 1) {
            Text(label).font(.apFootnote).foregroundStyle(Palette.muted)
            Text(value)
                .font(.inter(size: 26, weight: .bold).monospacedDigit())
                .foregroundStyle(accent ? Palette.gold : Palette.foreground)
                .lineLimit(1)
                .minimumScaleFactor(0.6)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .combine)
    }

    // MARK: - Tarjeta de dato sorprendente (estilo Hevy «has levantado un camión»)

    private var funData: (symbol: String, headline: String, detail: String) {
        let kg = Int(workout.volumeKg.rounded())
        guard kg > 0 else {
            return ("figure.strengthtraining.traditional", "Primer paso dado", "Cada sesión suma.")
        }
        if kg >= 12000 {
            let trucks = max(1, Int((Double(kg) / 12000).rounded()))
            return ("truck.box.fill", "Has movido \(NumberText.integer(kg)) kg",
                    trucks == 1 ? "El equivalente a un camión." : "El equivalente a \(trucks) camiones.")
        }
        if kg >= 5000 {
            let elephants = max(1, Int((Double(kg) / 5000).rounded()))
            return ("figure.walk", "Has movido \(NumberText.integer(kg)) kg",
                    elephants == 1 ? "El equivalente a un elefante." : "El equivalente a \(elephants) elefantes.")
        }
        if kg >= 1500 {
            let cars = max(1, Int((Double(kg) / 1500).rounded()))
            return ("car.fill", "Has movido \(NumberText.integer(kg)) kg",
                    cars == 1 ? "El equivalente a un coche." : "El equivalente a \(cars) coches.")
        }
        return ("scalemass.fill", "Has movido \(NumberText.integer(kg)) kg",
                "Más de lo que parece desde dentro.")
    }

    private var funCard: some View {
        let f = funData
        return card {
            VStack(alignment: .leading, spacing: 0) {
                eyebrow("DATO CURIOSO")
                Spacer()
                Image(systemName: f.symbol)
                    .font(.inter(size: 64, weight: .semibold))
                    .foregroundStyle(Palette.gold)
                    .accessibilityHidden(true)
                Text(f.headline)
                    .font(.inter(size: 32, weight: .bold))
                    .lineLimit(2)
                    .minimumScaleFactor(0.7)
                    .padding(.top, 16)
                Text(f.detail)
                    .font(.apTitle3)
                    .foregroundStyle(Palette.muted)
                    .padding(.top, 4)
                Spacer()
                brandFooter
            }
        }
    }

    private var recordsCard: some View {
        card {
            VStack(alignment: .leading, spacing: 0) {
                eyebrow("RÉCORDS")
                Spacer(minLength: 16)
                if workout.records.isEmpty {
                    VStack(alignment: .leading, spacing: 0) {
                        Image("lu-trophy")
                            .renderingMode(.template)
                            .resizable()
                            .frame(width: 44, height: 44)
                            .foregroundStyle(Palette.gold.opacity(0.55))
                        Text("Hoy no ha caído ningún récord").font(.apTitle3).padding(.top, 14)
                        Text("La próxima sesión es otra oportunidad.")
                            .font(.apSubhead).foregroundStyle(Palette.muted).padding(.top, 2)
                    }
                } else {
                    VStack(alignment: .leading, spacing: 14) {
                        ForEach(workout.records.prefix(6), id: \.self) { r in
                            HStack(spacing: 10) {
                                Image("lu-trophy")
                                    .renderingMode(.template)
                                    .resizable()
                                    .frame(width: 22, height: 22)
                                    .foregroundStyle(Palette.gold)
                                Text(r).font(.apTitle3).lineLimit(1).minimumScaleFactor(0.7)
                            }
                        }
                    }
                }
                Spacer(minLength: 16)
                brandFooter
            }
        }
    }

    private var compareCard: some View {
        card {
            VStack(alignment: .leading, spacing: 0) {
                eyebrow("FRENTE A LA ÚLTIMA VEZ")
                let items = Array(review.prefix(5))
                if items.isEmpty {
                    Text("Esta sesión será tu referencia para la próxima.")
                        .font(.apSubhead)
                        .foregroundStyle(Palette.muted)
                        .padding(.top, 14)
                } else {
                    VStack(spacing: 0) {
                        ForEach(Array(items.enumerated()), id: \.offset) { i, it in
                            HStack(spacing: 10) {
                                Text(it.name).font(.apSubhead).lineLimit(1).frame(maxWidth: .infinity, alignment: .leading)
                                let color: Color = it.trend == 1 ? Palette.success : it.trend == -1 ? Palette.destructive : Palette.muted
                                Text(it.change)
                                    .font(.apFootnote.weight(.semibold).monospacedDigit())
                                    .foregroundStyle(color)
                                    .padding(.horizontal, 8).padding(.vertical, 2)
                                    .background((it.trend == 1 || it.trend == -1 ? color.opacity(0.15) : Palette.foreground.opacity(0.1)), in: Capsule())
                            }
                            .padding(.vertical, 7)
                            .overlay(alignment: .bottom) {
                                if i < items.count - 1 { Rectangle().fill(Palette.separator).frame(height: 0.5) }
                            }
                        }
                    }
                    .padding(.top, 10)
                }
                Spacer(minLength: 8)
                HStack(alignment: .top, spacing: 10) {
                    Image("lu-target").renderingMode(.template).resizable().frame(width: 18, height: 18).foregroundStyle(Palette.gold).padding(.top, 2)
                    VStack(alignment: .leading, spacing: 2) {
                        Text("PRÓXIMA SESIÓN").font(.apCaption.weight(.bold)).tracking(1.6).foregroundStyle(Palette.gold)
                        Text(items.first?.proposal ?? "Mantén tu plan como referencia para la próxima sesión.")
                            .font(.apSubhead)
                            .foregroundStyle(Palette.foreground.opacity(0.85))
                    }
                }
                brandFooter.padding(.top, 14)
            }
        }
    }

    // MARK: - Puntos y acciones

    private var dots: some View {
        HStack(spacing: 2) {
            ForEach(0..<5, id: \.self) { i in
                Circle()
                    .fill(i == page ? Palette.gold : Palette.foreground.opacity(0.22))
                    .frame(width: i == page ? 8 : 6, height: i == page ? 8 : 6)
                    .frame(width: 44, height: 44)
                    .contentShape(Rectangle())
                    .onTapGesture { Haptics.selection(); withAnimation(reduceMotion ? nil : .snappy) { page = i } }
            }
        }
        .accessibilityHidden(true)
    }

    private var actions: some View {
        VStack(spacing: 10) {
            if let shareURL {
                ShareLink(item: shareURL) {
                    Label("Compartir tarjeta", systemImage: "square.and.arrow.up")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.pillSecondary)
            } else {
                Button {} label: {
                    Label("Compartir tarjeta", systemImage: "square.and.arrow.up")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.pillSecondary)
                .disabled(true)
            }
            Button { Haptics.success(); onDone() } label: {
                Text("Listo").frame(maxWidth: .infinity)
            }
            .buttonStyle(.pill)
        }
        .padding(.horizontal, 20)
        .padding(.top, 2)
        .padding(.bottom, 24)
    }

}

// MARK: - Celebración

/// Confeti ligero y determinista para el resumen con récords: SwiftUI puro, sin dependencias.
/// Con «Reducir movimiento» no se lanza (nada de partículas ni parpadeos).
struct CelebrationConfetti: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var fall = false

    private struct Piece: Identifiable {
        let id: Int
        let x: CGFloat
        let delay: Double
        let duration: Double
        let size: CGFloat
        let spin: Double
        let drift: CGFloat
        let color: Color
    }

    /// Reparto determinista (sin `random` en cada dibujado): mismo confeti en cada apertura.
    private let pieces: [Piece] = (0..<26).map { i in
        let palette: [Color] = [Palette.gold, Palette.gold.opacity(0.65), Palette.success,
                                Palette.foreground.opacity(0.9), Palette.gold.opacity(0.45)]
        return Piece(id: i,
                     x: (CGFloat(i) * 0.618).truncatingRemainder(dividingBy: 1),
                     delay: Double(i % 7) * 0.09,
                     duration: 1.9 + Double(i % 5) * 0.16,
                     size: 5 + CGFloat(i % 4),
                     spin: Double(i % 3 == 0 ? 540 : -420),
                     drift: CGFloat(i % 2 == 0 ? 1 : -1) * CGFloat(14 + (i % 5) * 8),
                     color: palette[i % palette.count])
    }

    var body: some View {
        GeometryReader { geo in
            ZStack(alignment: .topLeading) {
                ForEach(pieces) { piece in
                    RoundedRectangle(cornerRadius: 2, style: .continuous)
                        .fill(piece.color)
                        .frame(width: piece.size, height: piece.size * 1.7)
                        .rotationEffect(.degrees(fall ? piece.spin : 0))
                        .offset(x: geo.size.width * piece.x + (fall ? piece.drift : 0),
                                y: fall ? geo.size.height * 1.05 : -32)
                        .opacity(fall ? 0 : 1)
                        .animation(reduceMotion ? nil : .easeIn(duration: piece.duration).delay(piece.delay), value: fall)
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        }
        .allowsHitTesting(false)
        .accessibilityHidden(true)
        .onAppear { if !reduceMotion { fall = true } }
    }
}
