import SwiftUI
#if os(iOS)
import UIKit
#else
import AppKit
#endif

/// Campo enfocado en la sesión: identifica el input activo para la barra del teclado.
struct WorkoutField: Hashable {
    enum Kind { case weight, reps }
    let exercise: String
    let set: Int
    let kind: Kind
    var drop: Int? = nil

    var rowID: String { "\(exercise)_\(set)" }
}

/// «1 serie» / «3 series»: el plural va con la cifra (como `plural` en `WorkoutTracker.tsx`).
func plural(_ n: Int, _ one: String, _ many: String) -> String {
    "\(NumberText.integer(n)) \(n == 1 ? one : many)"
}

/// Sesión en curso, calcada de `WorkoutTracker.tsx`: barra «Salir · título · X de Y series · ···»,
/// carrusel y foto grande (ejercicio a ejercicio) o tarjetas numeradas y plegables (toda la sesión)
/// con la tabla Serie/Previa/Kg/Reps/✓, y el pie fijo con el descanso y Pausar · tiempo · Finalizar.
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
    /// Esfuerzo guardado al cerrar (nil = «Completar sin valorar esfuerzo»): lo enseña el resumen.
    @State private var savedRpe: Int?
    @State private var summaryOpen = false
    /// Campo numérico enfocado: mueve la barra del teclado (anterior/siguiente, ± y «Listo»)
    /// y permite centrar la serie sin que el teclado la tape.
    @FocusState private var focus: WorkoutField?
    @State private var addingExercise = false
    /// Vista elegida en «···» o en Ajustes: lista de toda la sesión (por defecto) o ejercicio a ejercicio.
    @AppStorage("workout-view") private var workoutView = "focus"
    @AppStorage("workout-layout") private var workoutLayout = "rows"
    private var focusMode: Bool { workoutView == "focus" }
    /// RPE, bajadas, calentamiento y fallo: ocultos por defecto para que anotar sea serie, kg y reps.
    @AppStorage("workout-advanced") private var advanced = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.scenePhase) private var scenePhase

    private var progress: Double { workout.totalSets > 0 ? Double(workout.doneSets) / Double(workout.totalSets) : 0 }

    private func handleScenePhase(_ phase: ScenePhase) {
        if phase != .active { workout.persistNow() }
    }

    private func handleFinishWorkout(_ n: Notification) { finish() }
    private func handleSkipRest(_ n: Notification) { workout.skipRest() }
    private func handleRestPlus(_ n: Notification) { workout.adjustRest(by: 30) }
    private func handleRestMinus(_ n: Notification) { workout.adjustRest(by: -30) }

    private var sessionScrollView: some View {
        ScrollView {
            // Columna centrada de 680 en iPad y Mac, como Hoy y Nutrición (y la web ancha).
            LazyVStack(alignment: .leading, spacing: 12) {
                sessionContent
            }
            .padding(.horizontal, 16)
            .padding(.top, 12)
            .padding(.bottom, 24)
            .frame(maxWidth: 680, alignment: .leading)
            .frame(maxWidth: .infinity)
        }
        .scrollDismissesKeyboard(.interactively)
    }

    private var addingExerciseChoice: some View {
        ExercisePickerView(existing: Set(workout.exercises.map(\.name))) { workout.addExercises($0) }
    }

    @ViewBuilder private var exerciseCards: some View {
        let exercises = Array(workout.exercises.enumerated())
        if workoutLayout == "columns" {
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 340), spacing: 12)], spacing: 12) {
                ForEach(exercises, id: \.element.id) { i, ex in
                    SessionExerciseCard(workout: workout, exercise: ex, index: i, userId: userId)
                }
            }
        } else {
            ForEach(exercises, id: \.element.id) { i, ex in
                SessionExerciseCard(workout: workout, exercise: ex, index: i, userId: userId)
            }
        }
    }

    private var discardChoice: some View {
        ChoiceSheet(title: "¿Descartar entrenamiento?",
                    message: "Se borrarán las series de esta sesión y no contará como hecha. Podrás empezarla de nuevo cuando quieras.",
                    primary: "Descartar entrenamiento", destructive: true) {
            discardOpen = false
            workout.skipRest()
            workout.discard()
            onClose(false)
        } onCancel: { discardOpen = false }
    }

    private var progressLine: some View {
        GeometryReader { geo in
            Rectangle().fill(Palette.gold).frame(width: geo.size.width * progress, height: 2)
        }
        .frame(height: 2)
        .accessibilityLabel("Progreso de la sesión")
        .accessibilityValue(String(Int(progress * 100)) + " %")
    }

    private var finishIncompleteMessage: String {
        let left = workout.totalSets - workout.doneSets
        return "\(left == 1 ? "Te queda" : "Te quedan") \(left) de \(plural(workout.totalSets, "serie", "series")). Puedes terminarlo igualmente o seguir entrenando."
    }

    private func handleFinishIncompleteDismiss() {
        if pendingRPE { pendingRPE = false; rpeOpen = true }
    }

    private func handleRpeDismiss() {
        if pendingSummary { pendingSummary = false; summaryOpen = true }
    }

    private func handleSummaryDismiss() { onClose(true) }

    /// Fotos y clips del entreno, con lo más nuevo de la biblioteca si ya llegó (`ExerciseLoops`).
    private func prefetchWorkout() {
        let loops = ExerciseLoops.shared
        MediaPrefetch.workout(
            photos: workout.exercises.compactMap { (loops.images[$0.name] ?? $0.image_url).flatMap(URL.init(string:)) },
            videos: workout.exercises.compactMap { loops.video($0.name, plan: $0.video_url) })
    }

    private var finishIncompleteChoice: some View {
        ChoiceSheet(title: "¿Terminar con series pendientes?",
                    message: finishIncompleteMessage,
                    primary: "Terminar y guardar", destructive: false) {
            pendingRPE = true
            finishIncompleteOpen = false
        } onCancel: { finishIncompleteOpen = false }
    }
    private var sessionTitle: String {
        workout.draft.day.routine_name?.trimmingCharacters(in: .whitespaces).nilIfEmpty ?? workout.draft.day.title
    }
    private var doneExercises: Int {
        workout.exercises.filter { ex in
            let sets = workout.draft.logs[ex.name] ?? []
            return !sets.isEmpty && sets.allSatisfy(\.done)
        }.count
    }

    var body: some View {
        VStack(spacing: 0) {
            sessionScrollView
            footer
        }
        .screenBackground()
        .task {
            // Entreno que empieza: todas sus fotos (miniatura y grande) y los dos primeros clips, por
            // detrás; primero con lo que guarda el plan y, en cuanto llega, con lo de la biblioteca.
            // Como `workoutMedia` en la web. Y, con Instruments, el tiempo hasta su primera foto.
            MediaTiming.begin("Entreno")
            prefetchWorkout()
            await ExerciseLoops.shared.load(workout.exercises.map(\.name))
            prefetchWorkout()
        }
        .navigationTitle(workout.draft.day.routine_name?.trimmingCharacters(in: .whitespaces).nilIfEmpty ?? workout.draft.day.title)
        #if os(iOS)
        .navigationBarTitleDisplayMode(.inline)
        .navigationBarBackButtonHidden()
        #endif
        .toolbar { workoutToolbar }
        .overlay(alignment: .top) { progressLine }
        // Hojas que suben desde abajo, como los Drawer de la web (y siempre con «Seguir entrenando»).
        .sheet(isPresented: $discardOpen) { discardChoice }
        .sheet(isPresented: $finishIncompleteOpen, onDismiss: handleFinishIncompleteDismiss) {
            finishIncompleteChoice
        }
        .sheet(isPresented: $rpeOpen, onDismiss: handleRpeDismiss) { rpeSheet }
        .sheet(isPresented: $summaryOpen, onDismiss: handleSummaryDismiss) { summarySheet }
        .sheet(isPresented: $addingExercise) { addingExerciseChoice }
        .onChange(of: scenePhase) { _, phase in handleScenePhase(phase) }
        .onReceive(NotificationCenter.default.publisher(for: .finishWorkout), perform: handleFinishWorkout)
        .onReceive(NotificationCenter.default.publisher(for: .skipRest), perform: handleSkipRest)
        .onReceive(NotificationCenter.default.publisher(for: .restPlus), perform: handleRestPlus)
        .onReceive(NotificationCenter.default.publisher(for: .restMinus), perform: handleRestMinus)
    }

    /// «05:12» o «1:05:12», como `formatElapsed` en la web; en pausa se queda quieto.
    private func elapsed(_ now: Date) -> String {
        let reference = workout.draft.pausedAt ?? now
        let total = max(0, Int(reference.timeIntervalSince(workout.draft.startedAt)))
        let h = total / 3600, m = (total % 3600) / 60, sec = total % 60
        return h > 0 ? String(format: "%d:%02d:%02d", h, m, sec) : String(format: "%02d:%02d", m, sec)
    }

    private func finish() {
        guard workout.doneSets > 0 else { return }
        Haptics.tap()
        // Terminar en pausa la reanuda antes: la duración no cuenta el tiempo parado.
        if workout.isPaused { workout.togglePause() }
        if workout.doneSets < workout.totalSets { finishIncompleteOpen = true } else { rpeOpen = true }
    }

    /// Píldora de la barra inferior con icono; la dorada es «Finalizar» (la única dorada de la pantalla).
    private func barLabel(_ title: String, symbol: String, primary: Bool = false) -> some View {
        HStack(spacing: 6) {
            Image(systemName: symbol).font(.inter(size: 15, weight: .bold))
            Text(title).font(.apHeadline).lineLimit(1)
        }
        .foregroundStyle(primary ? Palette.background : Palette.foreground)
        .padding(.horizontal, 20)
        .frame(height: 50)
        .background {
            if primary { GoldFill(shape: Capsule()) } else { RaisedFill(shape: Capsule()) }
        }
        .contentShape(Capsule())
    }

    /// «Finalizar» en la barra de abajo, a la derecha del tiempo (como la web).
    private var finishButton: some View {
        Button { finish() } label: {
            if workout.saving {
                BrandLoader().tint(Palette.background)
                    .frame(width: 128, height: 50)
                    .background(GoldFill(shape: Capsule()))
            } else {
                barLabel("Finalizar", symbol: "checkmark", primary: true)
            }
        }
        .buttonStyle(.plain)
        .disabled(workout.saving || workout.doneSets == 0)
        .opacity(workout.saving || workout.doneSets == 0 ? 0.45 : 1)
        .accessibilityLabel("Finalizar entrenamiento")
        .keyboardShortcut(.return, modifiers: .command)
    }

    /// Pausa real: congela el tiempo y el descanso y se guarda en el borrador.
    private var pauseButton: some View {
        Button { Haptics.tap(); workout.togglePause() } label: {
            Image(systemName: workout.isPaused ? "play.fill" : "pause.fill")
                .font(.inter(size: 18, weight: .bold))
                .foregroundStyle(Palette.foreground)
                .frame(width: 50, height: 50)
                .background(RaisedFill(shape: Circle()))
                .contentShape(Circle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(workout.isPaused ? "Reanudar" : "Pausar")
        .accessibilityHint(workout.isPaused ? "Vuelven a correr el tiempo y el descanso" : "Se congelan el tiempo y el descanso")
    }

    /// Pausar · tiempo · Finalizar (diseño ChatGPT), igual en las dos vistas.
    private var controlBar: some View {
        HStack(spacing: 12) {
            pauseButton
            TimelineView(.periodic(from: .now, by: 1)) { context in
                VStack(spacing: 2) {
                    Text(elapsed(context.date))
                        .font(.figure(size: 28))
                        .foregroundStyle(Palette.foreground)
                        .lineLimit(1).minimumScaleFactor(0.7)
                    Text(workout.isPaused ? "En pausa" : "Tiempo transcurrido")
                        .font(workout.isPaused ? .apFootnote.weight(.semibold) : .apFootnote)
                        .foregroundStyle(workout.isPaused ? Palette.gold : Palette.muted)
                        .lineLimit(1).minimumScaleFactor(0.8)
                }
                .frame(maxWidth: .infinity)
                .accessibilityElement(children: .ignore)
                .accessibilityLabel("Tiempo de sesión \(elapsed(context.date))\(workout.isPaused ? ", en pausa" : "")")
            }
            finishButton
        }
    }

    /// Opciones claras: cambiar de vista y de detalle; descartar, al final y en rojo.
    private var moreMenu: some View {
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
            Image(systemName: "ellipsis").font(.inter(size: 15, weight: .bold)).foregroundStyle(Palette.foreground)
                .frame(width: 30, height: 30).background(RaisedFill(shape: Circle()))
                .frame(width: 44, height: 44).contentShape(Rectangle())
        }
        .accessibilityLabel("Más acciones")
    }

    // MARK: Teclado (‹ › y ±)

    private var orderedFields: [WorkoutField] {
        var out: [WorkoutField] = []
        let indices = focusMode
            ? [min(workout.draft.currentExercise, max(workout.exercises.count - 1, 0))]
            : Array(workout.exercises.indices).filter { !workout.closedExercises.contains($0) }
        for i in indices where workout.exercises.indices.contains(i) {
            let name = workout.exercises[i].name
            for (si, set) in (workout.draft.logs[name] ?? []).enumerated() {
                out.append(WorkoutField(exercise: name, set: si, kind: .weight))
                out.append(WorkoutField(exercise: name, set: si, kind: .reps))
                for di in 0..<(set.drops?.count ?? 0) {
                    out.append(WorkoutField(exercise: name, set: si, kind: .weight, drop: di))
                    out.append(WorkoutField(exercise: name, set: si, kind: .reps, drop: di))
                }
            }
        }
        return out
    }

    private func moveFocus(_ direction: Int) {
        let fields = orderedFields
        guard !fields.isEmpty else { return }
        let current = focus.flatMap { fields.firstIndex(of: $0) }
        let next = min(max((current ?? -1) + direction, 0), fields.count - 1)
        Haptics.selection()
        focus = fields[next]
    }

    private func adjustFocused(_ direction: Int) {
        guard let field = focus else { return }
        let name = field.exercise
        let si = field.set
        guard var sets = workout.draft.logs[name], sets.indices.contains(si) else { return }
        if field.kind == .weight {
            let current = Double(sets[si].weight) ?? 0
            let next = max(0, current + Double(direction) * 2.5)
            sets[si].weight = next > 0 ? String(next) : "0"
        } else {
            let current = sets[si].reps
            sets[si].reps = max(1, current + direction)
        }
        workout.draft.logs[name] = sets
    }

    // MARK: Cabecera de la lista (diseño ChatGPT): estado, título grande y avance

    private var listHeader: some View {
        VStack(alignment: .leading, spacing: 6) {
            Label(workout.isPaused ? "Entrenamiento en pausa" : "Entrenamiento en curso",
                  systemImage: workout.isPaused ? "pause.fill" : "dumbbell.fill")
                .font(.apFootnote.weight(.semibold))
                .foregroundStyle(workout.isPaused ? Palette.muted : Palette.gold)
            Text(sessionTitle)
                .font(.apTitle1)
                .lineLimit(2)
                .accessibilityAddTraits(.isHeader)
            Text("\(plural(workout.exercises.count, "ejercicio", "ejercicios")) · \(workout.doneSets) de \(plural(workout.totalSets, "serie", "series"))")
                .font(.apSubhead.monospacedDigit())
                .foregroundStyle(Palette.muted)
            // Avance por ejercicios; el tiempo y «Pausar» viven en la barra de abajo.
            HStack(spacing: 12) {
                GeometryReader { geo in
                    ZStack(alignment: .leading) {
                        Capsule().fill(Palette.secondary)
                        Capsule().fill(Palette.gold).frame(width: geo.size.width * progress)
                    }
                }
                .frame(height: 6)
                .accessibilityLabel("Avance de la sesión")
                .accessibilityValue("\(Int(progress * 100)) por ciento")
                Text("\(doneExercises) de \(plural(workout.exercises.count, "ejercicio", "ejercicios"))")
                    .font(.apFootnote.monospacedDigit())
                    .foregroundStyle(Palette.muted)
                    .lineLimit(1)
                    .fixedSize()
            }
            .padding(.top, 6)
        }
        .padding(.horizontal, 4).padding(.bottom, 4)
    }

    // MARK: Contenido de la sesión

    @ViewBuilder private var sessionContent: some View {
        if !focusMode { listHeader }
        let currentIdx = min(workout.draft.currentExercise, max(workout.exercises.count - 1, 0))
        if focusMode, let ex = workout.exercises[safe: currentIdx] {
            FocusViewer(workout: workout, index: currentIdx, onAdd: { Haptics.selection(); addingExercise = true })
            SessionExerciseCard(workout: workout, exercise: ex, index: currentIdx, userId: userId, focused: true)
                .onAppear { workout.openExercises.insert(currentIdx) }
                .id(ex.id)
        } else {
            exerciseCards
            // En la lista, «Añadir ejercicio» va al final (en foco, es el «+» del carrusel).
            Button { Haptics.selection(); addingExercise = true } label: {
                Label("Añadir ejercicio a esta sesión", systemImage: "plus")
            }
            .buttonStyle(.pillSecondary)
            .disabled(workout.isPaused)
            .padding(.top, 4)
        }
        if let error = workout.saveError {
            Text(error).font(.apFootnote).foregroundStyle(Palette.destructive)
        }
    }

    // MARK: Toolbar

    @ToolbarContentBuilder private var workoutToolbar: some ToolbarContent {
        ToolbarItem(placement: .cancellationAction) {
            Button { Haptics.tap(); workout.persistNow(); onClose(false) } label: {
                HStack(spacing: 2) { Image(systemName: "chevron.left").fontWeight(.semibold); Text("Salir") }
            }
            .foregroundStyle(Palette.foreground)
            .accessibilityHint("El entrenamiento queda guardado")
        }
        ToolbarItem(placement: .principal) {
            if focusMode {
                VStack(spacing: 0) {
                    Text(sessionTitle).font(.apHeadline).lineLimit(1)
                    Text("\(workout.doneSets) de \(plural(workout.totalSets, "serie", "series"))")
                        .font(.apFootnote.monospacedDigit()).foregroundStyle(Palette.muted)
                        .contentTransition(.numericText())
                }
                .accessibilityElement(children: .combine)
            }
        }
        // «Finalizar» vive en la barra de abajo: arriba solo quedan «Salir» y «···».
        #if os(iOS)
        ToolbarItem(placement: .topBarTrailing) { moreMenu }
        #else
        ToolbarItem(placement: .primaryAction) { moreMenu }
        #endif
    }

    // MARK: Pie fijo: descanso + Pausar · tiempo · Finalizar

    @ViewBuilder private var footer: some View {
        VStack(spacing: 12) {
            if let end = workout.draft.restEndsAt {
                RestTimerRow(end: end, workout: workout)
                    .disabled(workout.isPaused)
                    .opacity(workout.isPaused ? 0.4 : 1)
                    .transition(reduceMotion ? .opacity : .move(edge: .bottom).combined(with: .opacity))
            }
            controlBar
            if focus != nil {
                HStack(spacing: 8) {
                    Button { moveFocus(-1) } label: {
                        Label("Anterior", systemImage: "chevron.left")
                            .font(.apSubhead.weight(.medium))
                            .padding(.horizontal, 14).frame(height: 40)
                            .background(RaisedFill(shape: Capsule()))
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Campo anterior")
                    Button { moveFocus(1) } label: {
                        Label("Siguiente", systemImage: "chevron.right")
                            .font(.apSubhead.weight(.medium))
                            .padding(.horizontal, 14).frame(height: 40)
                            .background(RaisedFill(shape: Capsule()))
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Campo siguiente")
                    Spacer(minLength: 0)
                    Button { Haptics.tap(); focus = nil } label: {
                        Text("Listo")
                            .font(.apSubhead.weight(.semibold))
                            .foregroundStyle(Palette.gold)
                            .padding(.horizontal, 16).frame(height: 40)
                            .background(RaisedFill(shape: Capsule()))
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Cerrar el teclado")
                }
                .foregroundStyle(Palette.foreground)
                .transition(.opacity)
            }
        }
        .frame(maxWidth: 680)
        .padding(.horizontal, 16).padding(.top, 12).padding(.bottom, 12)
        .frame(maxWidth: .infinity)
        .background(.ultraThinMaterial)
        .overlay(alignment: .top) { Rectangle().fill(Palette.separator).frame(height: 0.5) }
        .animation(reduceMotion ? nil : .spring(response: 0.35, dampingFraction: 0.9), value: workout.draft.restEndsAt)
    }

    // MARK: Resumen final (WorkoutSummary)

    private var summarySheet: some View {
        WorkoutSummaryView(workout: workout, rpe: savedRpe,
                           onSaveRoutine: workout.draft.day.routine_name == CustomRoutines.freeWorkoutName ? { name, exercises in
                               await TrainingRepo.commitRoutine(userId: userId) { CustomRoutines.add($0, name: name, exercises: exercises) }
                           } : nil,
                           routineLimitReached: !CustomRoutines.canAdd(TrainingRepo.cachedPlan(userId: userId) ?? [])) { summaryOpen = false }
            .frame(minWidth: 380)
            #if os(macOS)
            // Solo en el Mac la hoja toma el tamaño del contenido; en el iPhone, un mínimo fijo
            // dejaría «Compartir» fuera de la hoja en pantallas bajas.
            .frame(minHeight: 640)
            #endif
            .presentationDetents([.large])
            .presentationBackground(Palette.card)
    }

    // MARK: Esfuerzo (RPEDialog): mismos textos, escala 1–10 y las dos salidas de la web

    private static let rpeLabels: [Int: String] = [
        1: "Muy fácil", 2: "Muy fácil", 3: "Fácil", 4: "Algo fácil", 5: "Moderado",
        6: "Algo duro", 7: "Duro", 8: "Muy duro", 9: "Casi al fallo", 10: "Al fallo total",
    ]

    private func complete(rpe value: Int?) {
        Haptics.tap()
        Task {
            savedRpe = value
            if await workout.finish(userId: userId, rpe: value) {
                pendingSummary = true
                rpeOpen = false
            }
        }
    }

    private var rpeSheet: some View {
        ScrollView {
            VStack(spacing: 22) {
                VStack(spacing: 6) {
                    Text("¿Cómo de duro fue?").font(.apTitle2).multilineTextAlignment(.center).accessibilityAddTraits(.isHeader)
                    Text("Marca tu esfuerzo percibido del 1 al 10. Así ajustamos tu próximo plan.")
                        .font(.apSubhead).foregroundStyle(Palette.muted).multilineTextAlignment(.center)
                }
                VStack(spacing: 6) {
                    Text("\(rpe)").font(.figure(size: 64)).foregroundStyle(Palette.gold).accessibilityHidden(true)
                    Text(Self.rpeLabels[rpe] ?? "").font(.apHeadline).foregroundStyle(Palette.gold)
                }
                .accessibilityElement(children: .combine)
                LazyVGrid(columns: Array(repeating: GridItem(.fixed(52), spacing: 12), count: 5), spacing: 12) {
                    ForEach(1...10, id: \.self) { value in
                        let selected = value == rpe
                        Button { if !selected { Haptics.selection(); rpe = value } } label: {
                            Text("\(value)")
                                .font(.apHeadline.monospacedDigit())
                                .foregroundStyle(selected ? Palette.gold : Palette.foreground)
                                .frame(width: 52, height: 52)
                                .background(selected ? Palette.gold.opacity(0.15) : Palette.secondary, in: Circle())
                                .overlay(Circle().strokeBorder(selected ? Palette.gold : .clear, lineWidth: 2))
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("\(value), \((Self.rpeLabels[value] ?? "").lowercased())")
                        .accessibilityAddTraits(selected ? .isSelected : [])
                    }
                }
                HStack(alignment: .top, spacing: 16) {
                    IconTile(symbol: "target")
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Apunta a un 7 u 8").font(.apHeadline)
                        Text("Es lo ideal en la mayoría de sesiones. Si llevas tres días seguidos en 9 o 10, tu próximo plan bajará un poco la intensidad.")
                            .font(.apSubhead).foregroundStyle(Palette.muted)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    Spacer(minLength: 0)
                }
                VStack(spacing: 8) {
                    Button { complete(rpe: rpe) } label: {
                        if workout.saving { BrandLoader().tint(Palette.background) } else { Text("Guardar esfuerzo y completar") }
                    }
                    .buttonStyle(.pill)
                    .disabled(workout.saving)
                    Button { complete(rpe: nil) } label: {
                        Text("Completar sin valorar esfuerzo").font(.apHeadline).foregroundStyle(Palette.gold)
                            .frame(maxWidth: .infinity, minHeight: 50)
                    }
                    .buttonStyle(.plain)
                    .disabled(workout.saving)
                }
                if let error = workout.saveError { Text(error).font(.apFootnote).foregroundStyle(Palette.destructive).multilineTextAlignment(.center) }
            }
            .padding(.horizontal, 24).padding(.top, 28).padding(.bottom, 16)
        }
        .frame(minWidth: 360)
        .presentationDetents([.large])
        .presentationBackground(Palette.card)
        .interactiveDismissDisabled(true)
    }
}

/// Tarjeta de ejercicio en sesión: cabecera (miniatura, nombre, «N series · R reps · descanso», ✓)
/// y, abierta, la tabla de series.
struct SessionExerciseCard: View {
    @ObservedObject var workout: ActiveWorkout
    let exercise: GymExercise
    let index: Int
    let userId: UUID
    /// En «ejercicio a ejercicio» la foto ya está arriba: sin miniatura repetida (como la web).
    var focused = false

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @AppStorage("workout-advanced") private var advanced = false

    private var sets: [SetLog] { workout.draft.logs[exercise.name] ?? [] }
    private var allDone: Bool { !sets.isEmpty && sets.allSatisfy(\.done) }
    /// Desplegado por defecto (se anota sin pulsar antes); en la lista se puede plegar.
    private var isOpen: Bool { focused || !workout.closedExercises.contains(index) }
    /// El primer ejercicio con series pendientes: su número va en dorado.
    private var isCurrentExercise: Bool {
        workout.exercises.firstIndex { ex in
            let s = workout.draft.logs[ex.name] ?? []
            return s.isEmpty || !s.allSatisfy(\.done)
        } == index
    }
    private var firstPending: Int? { sets.firstIndex { !$0.done } }
    @State private var technique = false
    @ObservedObject private var loops = ExerciseLoops.shared
    /// Celebración breve al completar todas las series del ejercicio.
    @State private var justCompleted = false
    @State private var swapSheet = false
    @State private var swapOptions: [String] = []

    private var indexBadge: some View {
        Text("\(index + 1)")
            .font(.apFootnote.weight(.bold).monospacedDigit())
            .foregroundStyle(allDone || isCurrentExercise ? Palette.background : Palette.foreground)
            .frame(width: 24, height: 24)
            .background(allDone || isCurrentExercise ? Palette.gold : Palette.secondary, in: Circle())
            .overlay(Circle().strokeBorder(Palette.card, lineWidth: 2))
            .offset(x: -6, y: -6)
            .accessibilityHidden(true)
    }

    /// Cabecera de la tarjeta: miniatura, nombre, chips y acciones.
    /// Extraída del body para que el compilador no falle por complejidad.
    private var cardHeader: some View {
        HStack(spacing: 12) {
            if !focused {
                WorkoutThumb(url: exercise.image_url, completed: allDone, muscleGroup: exercise.muscle_group,
                             video: loops.video(exercise.name, plan: exercise.video_url))
                    .overlay(alignment: .topLeading) { indexBadge }
            }
            exerciseInfo
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
                .buttonStyle(.plain)
                .foregroundStyle(Palette.muted)
                .frame(width: 44, height: 44)
                .accessibilityLabel("Técnica: \(exercise.name)")
            if !focused {
                Button {
                    Haptics.selection()
                    withAnimation(reduceMotion ? nil : .snappy) { workout.toggleCollapsed(index) }
                } label: {
                    Image(systemName: "chevron.down").font(.inter(size: 15, weight: .semibold))
                        .rotationEffect(.degrees(isOpen ? 180 : 0))
                }
                .buttonStyle(.plain).foregroundStyle(Palette.muted).frame(width: 32, height: 44)
                .accessibilityLabel(isOpen ? "Plegar \(exercise.name)" : "Desplegar \(exercise.name)")
            }
        }
    }

    /// Nombre, «En lugar de…», «4 series · 10 reps · 90 s» y la superserie, como la web.
    private var exerciseInfo: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 8) {
                Text(workout.swaps[exercise.name] ?? exercise.name)
                    .font(focused ? .apTitle2 : .apHeadline)
                    .lineLimit(2)
                    .foregroundStyle(allDone ? Palette.muted : Palette.foreground)
                if let pos = workout.supersetPosition(of: exercise.name) {
                    Text("Superserie \((pos.members.firstIndex(of: exercise.name) ?? 0) + 1)/\(pos.members.count)")
                        .font(.apFootnote.weight(.medium).monospacedDigit())
                        .foregroundStyle(Palette.muted)
                        .padding(.horizontal, 10).padding(.vertical, 2)
                        .background(Palette.secondary, in: Capsule())
                        .fixedSize()
                }
            }
            if workout.swaps[exercise.name] != nil {
                Text("En lugar de \(exercise.name)").font(.apFootnote).foregroundStyle(Palette.muted).lineLimit(1)
            }
            Text("\(plural(exercise.series, "serie", "series")) · \(exercise.reps) reps · \(exercise.rest)")
                .font((focused ? Font.apSubhead : Font.apFootnote).monospacedDigit())
                .foregroundStyle(Palette.muted)
                .lineLimit(1).minimumScaleFactor(0.85)
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            cardHeader
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
                    .surface()

                    Button { workout.addSet(exercise.name) } label: {
                        Label("Añadir serie", systemImage: "plus")
                            .font(.apHeadline)
                            .foregroundStyle(Palette.gold)
                            .frame(maxWidth: .infinity, minHeight: 44)
                            .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                }
                .padding(.horizontal, 8).padding(.bottom, 12).padding(.top, 4)
            }
        }
        .surface()
        .overlay {
            // Aviso visual breve (1,2 s) al completar el ejercicio; sin animación con Reduce Motion.
            RoundedRectangle(cornerRadius: Radius.card, style: .continuous)
                .strokeBorder(Palette.gold.opacity(justCompleted ? 0.85 : 0), lineWidth: 1.5)
                .animation(reduceMotion ? nil : .easeOut(duration: 0.25), value: justCompleted)
                .allowsHitTesting(false)
        }
        .sensoryFeedback(.success, trigger: allDone) { _, done in done }
        .onChange(of: allDone) { _, done in
            guard done else { justCompleted = false; return }
            withAnimation(reduceMotion ? nil : .snappy) { justCompleted = true }
            if focused, workout.exercises.indices.contains(index) {
                let count = workout.exercises.count
                let candidates = Array((index + 1)..<count) + Array(0..<index)
                if let next = candidates.first(where: { candidate in
                    let pending = workout.draft.logs[workout.exercises[candidate].name] ?? []
                    return pending.isEmpty || !pending.allSatisfy(\.done)
                }) {
                    workout.draft.currentExercise = next
                    workout.openExercises.insert(next)
                    workout.persist()
                }
            }
            Task {
                try? await Task.sleep(for: .seconds(1.2))
                withAnimation(reduceMotion ? nil : .easeOut(duration: 0.3)) { justCompleted = false }
            }
        }
        .contextMenu {
            Button { technique = true } label: { Label("Ficha de técnica", systemImage: "info.circle") }
            Button { Task { await openSwapSheet() } } label: { Label("Cambiar ejercicio", systemImage: "arrow.left.arrow.right") }
            if workout.supersetPosition(of: exercise.name) != nil {
                Button { Haptics.selection(); workout.toggleSuperset(exercise.name) } label: { Label("Quitar de la superserie", systemImage: "link") }
            } else if let i = workout.exercises.firstIndex(where: { $0.name == exercise.name }), i + 1 < workout.exercises.count {
                Button { Haptics.selection(); workout.toggleSuperset(exercise.name) } label: {
                    Label("Superserie con \(workout.exercises[i + 1].name)", systemImage: "link")
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
        .accessibilityHint("Mantén pulsado para cambiar el ejercicio o hacer una superserie")
        .sheet(isPresented: $technique) { TechniqueSheet(exercise: exercise) }
        .sheet(isPresented: $swapSheet) { swapSheetContent }
        .task(id: exercise.name) { loops.want(exercise.name) }
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
                        // Las alternativas ya se cargaron al abrir: sin ninguna, el mismo aviso que la web.
                        EmptyStateView(symbol: "dumbbell", title: "Sigue con este ejercicio",
                                       message: "Aún no hay alternativas para este movimiento en la biblioteca.")
                    }
                }
                .surface()
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
    /// Salida sin hacer nada («Seguir entrenando» en el entreno, «Cancelar» al borrar una rutina).
    var cancel: String = "Seguir entrenando"
    var onPrimary: () -> Void
    var onCancel: () -> Void

    var body: some View {
        VStack(spacing: 14) {
            Text(title).font(.apTitle3).multilineTextAlignment(.center).accessibilityAddTraits(.isHeader)
            Text(message).font(.apSubhead).foregroundStyle(Palette.muted).multilineTextAlignment(.center)
            Button(primary) { Haptics.tap(); onPrimary() }
                .buttonStyle(destructive ? .pillDestructive : .pill)
                .padding(.top, 8)
            Button(cancel) { Haptics.selection(); onCancel() }
                .font(.apHeadline).foregroundStyle(Palette.foreground).frame(maxWidth: .infinity, minHeight: 50)
                .buttonStyle(.plain)
        }
        .padding(.horizontal, 24).padding(.top, 28).padding(.bottom, 12)
        .presentationDetents([.height(320)])
        .presentationDragIndicator(.visible)
        .presentationBackground(Palette.card)
    }
}

/// Modo foco: carrusel de toda la sesión arriba y el ejercicio activo en grande debajo (desliza
/// para cambiar), como el visor de `WorkoutTracker.tsx`. Sin foto, el ejercicio por su músculo.
struct FocusViewer: View {
    @ObservedObject var workout: ActiveWorkout
    let index: Int
    var onAdd: () -> Void = {}
    @ObservedObject private var loops = ExerciseLoops.shared
    @ObservedObject private var policy = LoopPolicy.shared
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    /// Página visible del carrusel. Se sincroniza en los dos sentidos con el ejercicio actual.
    @State private var page: Int?

    private func go(_ i: Int) {
        guard workout.exercises.indices.contains(i), i != workout.draft.currentExercise else { return }
        workout.draft.currentExercise = i
        workout.openExercises.insert(i)
        workout.persist()
        Haptics.selection()
    }

    var body: some View {
        let ex = workout.exercises[index]
        VStack(spacing: 12) {
            // Carrusel arriba: cada ejercicio con su foto o su huella y su número; «+» al final.
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 10) {
                    ForEach(workout.exercises.indices, id: \.self) { i in
                        let item = workout.exercises[i]
                        let sets = workout.draft.logs[item.name] ?? []
                        let done = !sets.isEmpty && sets.allSatisfy(\.done)
                        Button { go(i) } label: {
                            WorkoutThumb(url: loops.images[item.name] ?? item.image_url, completed: done, size: 48, muscleGroup: item.muscle_group)
                                .padding(2)
                                .overlay(
                                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                                        .strokeBorder(i == index ? Palette.gold : .clear, lineWidth: 2)
                                )
                                .overlay(alignment: .topLeading) {
                                    // Número de orden: dorado el que estás haciendo y los hechos.
                                    Text("\(i + 1)")
                                        .font(.apCaption.weight(.bold).monospacedDigit())
                                        .foregroundStyle(i == index || done ? Palette.background : Palette.foreground)
                                        .frame(minWidth: 20, minHeight: 20)
                                        .background(i == index || done ? Palette.gold : Palette.secondary, in: Capsule())
                                        .overlay(Capsule().strokeBorder(Palette.background, lineWidth: 2))
                                        .offset(x: -4, y: -4)
                                }
                                .opacity(i == index ? 1 : 0.6)
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("\(i + 1). \(workout.swaps[item.name] ?? item.name)\(done ? " · hecho" : "")")
                        .accessibilityAddTraits(i == index ? .isSelected : [])
                    }
                    Button { onAdd() } label: {
                        Image(systemName: "plus").font(.system(size: 20, weight: .semibold)).foregroundStyle(Palette.gold)
                            .frame(width: 48, height: 48)
                            .background(Palette.secondary, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                            .padding(2)
                    }
                    .buttonStyle(.plain)
                    .disabled(workout.isPaused)
                    .accessibilityLabel("Añadir ejercicio a esta sesión")
                }
                .padding(.top, 6).padding(.bottom, 2).padding(.leading, 4)
            }

            // Carrusel paginado nativo: al deslizar, la página sigue al dedo y encaja sola
            // (sin gestos que esperan al final del arrastre). Una foto por ejercicio.
            ScrollView(.horizontal) {
                LazyHStack(spacing: 0) {
                    ForEach(Array(workout.exercises.enumerated()), id: \.element.id) { i, item in
                        photoPage(item, current: i == index)
                            .containerRelativeFrame(.horizontal)
                            .id(i)
                    }
                }
                .scrollTargetLayout()
            }
            .scrollIndicators(.hidden)
            .scrollTargetBehavior(.paging)
            .scrollPosition(id: $page)
            .frame(height: 220)
            .clipShape(RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
            .overlay(alignment: .bottomTrailing) {
                Text("\(index + 1) / \(workout.exercises.count)")
                    .font(.apFootnote.weight(.semibold).monospacedDigit())
                    .foregroundStyle(Palette.foreground)
                    .padding(.horizontal, 10).padding(.vertical, 4)
                    .background(.ultraThinMaterial, in: Capsule())
                    .padding(10)
                    .allowsHitTesting(false)
                    .accessibilityHidden(true)
            }
            .onAppear { if page == nil { page = index } }
            // Deslizar cambia de ejercicio sin rehacer la vista entera: solo la tarjeta de abajo.
            .onChange(of: page) { _, new in
                guard let new, new != index else { return }
                go(new)
            }
            // Tocar un número (o el ajuste de VoiceOver) mueve el carrusel con una animación corta.
            .onChange(of: index) { _, new in
                guard page != new else { return }
                withAnimation(reduceMotion ? nil : .snappy) { page = new }
            }
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("\(workout.swaps[ex.name] ?? ex.name). Desliza para cambiar de ejercicio")
            .accessibilityAdjustableAction { direction in
                switch direction {
                case .increment: go(index + 1)
                case .decrement: go(index - 1)
                default: break
                }
            }
            .task(id: index) {
                // Las fotos vecinas ya están decodificadas: el deslizamiento no espera a la red.
                let urls = [-1, 0, 1].compactMap { offset -> URL? in
                    guard workout.exercises.indices.contains(index + offset) else { return nil }
                    return workout.exercises[index + offset].image_url.flatMap(URL.init(string:))
                }
                ImageCache.shared.prefetch(urls, maxSide: MediaSizing.hero)
                preloadNext()
            }
        }
        .task {
            await loops.load(workout.exercises.map(\.name))
            preloadNext()
        }
    }

    /// El siguiente ejercicio ya tiene el principio de su vídeo cargado: pasar a él es instantáneo
    /// (como `preloadExerciseLoop` en la web). Con la foto fija (reducir movimiento…), nada.
    private func preloadNext() {
        guard policy.allows(reduceMotion: reduceMotion),
              let next = LoopRules.next(after: index, total: workout.exercises.count) else { return }
        let item = workout.exercises[next]
        if let url = loops.video(item.name, plan: item.video_url) { ExerciseLoopPool.shared.preload(url) }
    }

    /// Una página del carrusel: la foto del ejercicio a todo el visor (1000 px, la que precargó el
    /// inicio del entreno) o, sin foto, la silueta con su músculo. El ejercicio actual se mueve encima
    /// en bucle (mudo, sin controles) en cuanto su primer fotograma está listo; sin vídeo, la foto
    /// sola. Como la web.
    /// La foto va en un `overlay` del fondo: así «rellenar» se recorta al tamaño de la página y no
    /// invade la foto vecina del carrusel.
    @ViewBuilder private func photoPage(_ item: GymExercise, current: Bool) -> some View {
        let photo = (loops.images[item.name] ?? item.image_url).flatMap(URL.init(string:))
        let clip = loops.video(item.name, plan: item.video_url)
        Palette.card
            .overlay {
                ExerciseLoopView(url: current ? clip : nil, hero: true) {
                    if let url = photo {
                        CachedAsyncImage(url: url, maxSide: MediaSizing.hero) { $0.resizable().scaledToFill() } placeholder: { Palette.card }
                    } else {
                        ExerciseSilhouette(muscleGroup: item.muscle_group).padding(.vertical, 12)
                    }
                }
            }
            .clipped()
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
                Button("Quitar de la superserie") { Haptics.selection(); workout.toggleSuperset(exercise.name) }
            } else if let i = workout.exercises.firstIndex(where: { $0.name == exercise.name }), i + 1 < workout.exercises.count {
                Button("Superserie con \(workout.exercises[i + 1].name)") {
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
    @ObservedObject private var loops = ExerciseLoops.shared
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                // El mismo héroe que la ficha de la biblioteca: el clip en bucle sobre su foto, la foto o,
                // sin foto, la silueta con su músculo; nunca un bloque vacío.
                ExerciseHeroMedia(
                    name: exercise.name,
                    image: loops.images[exercise.name] ?? exercise.image_url,
                    video: loops.video(exercise.name, plan: exercise.video_url)?.absoluteString,
                    muscleGroup: exercise.muscle_group
                )
                Text(exercise.name).font(.apTitle1).tracking(-0.4)
                    .fixedSize(horizontal: false, vertical: true)
                    .accessibilityAddTraits(.isHeader)
                if let g = exercise.muscle_group { Text(g).font(.apSubhead).foregroundStyle(Palette.muted) }

                // Mapa muscular: mismo comportamiento que en la web (MuscleMap.tsx)
                let muscles = musclesForExercise(name: exercise.name, muscleGroup: exercise.muscle_group)
                if !muscles.primary.isEmpty {
                    HStack(spacing: 16) {
                        MuscleMapView(primary: muscles.primary, synergists: muscles.synergists, size: 80)
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Músculos").font(.apCaption).foregroundStyle(Palette.muted)
                            Text(muscles.primary.joined(separator: ", ")).font(.apHeadline)
                            if !muscles.synergists.isEmpty {
                                Text("Sinergistas: \(muscles.synergists.joined(separator: ", "))")
                                    .font(.apSubhead).foregroundStyle(Palette.muted)
                            }
                        }
                        Spacer(minLength: 0)
                    }
                    .padding(14)
                    .background(Palette.secondary, in: RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
                }

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
        .task { await loops.load([exercise.name]) }
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
                    // Calentamiento: la llama en gris, como la web (no cuenta en tus métricas).
                    Image(systemName: "flame")
                        .font(.inter(size: 15, weight: .semibold))
                        .foregroundStyle(Palette.muted)
                        .frame(width: 24, height: 24)
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
                .accessibilityLabel("Previa: " + (previous.map { $0.done ? "\($0.weight.replacingOccurrences(of: ".", with: ",")) kilos por \($0.reps)" : "sin datos" } ?? "sin datos"))
            NumberField(value: set.weight,
                        placeholder: (previous?.weight.nilIfEmpty ?? exercise.weight.nilIfEmpty ?? "kg").replacingOccurrences(of: ".", with: ","),
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
                    Circle().strokeBorder(set.done ? Palette.gold : Palette.muted.opacity(0.4), lineWidth: 2.5)
                        .background(Circle().fill(set.done ? Palette.gold : .clear))
                    Image(systemName: "checkmark").font(.inter(size: 18, weight: .bold))
                        .foregroundStyle(set.done ? Color.black : Palette.muted.opacity(0.4))
                        .scaleEffect(set.done ? 1 : 0.6)
                        .animation(.spring(response: 0.25, dampingFraction: 0.6), value: set.done)
                }
                .frame(width: 40, height: 40)
                .frame(width: 48, height: 48)
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
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .fill(isCurrent ? .clear : (set.done && !isWarmup ? Palette.gold.opacity(0.15) : .clear))
                .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).strokeBorder(isCurrent ? Palette.gold.opacity(0.4) : .clear, lineWidth: 1))
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

/// Miniatura de ejercicio de la sesión: misma apariencia que `ExerciseThumb` (TrainView.swift) y la
/// misma foto de 192 px (`MediaSizing.thumbSide`), decodificada a ese tamaño: la que ya precargó
/// `MediaPrefetch.workout` al empezar, sin volver a la red ni decodificar fotos grandes.
private struct WorkoutThumb: View {
    let url: String?
    var completed = false
    var size: CGFloat = 52
    /// Grupo muscular: sin foto, la silueta con ese músculo (nunca un hueco ni un icono repetido).
    var muscleGroup: String? = nil
    /// Clip de técnica: en la lista de la sesión el ejercicio se mueve sobre su foto (hecho, quieto).
    var video: URL? = nil

    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 12, style: .continuous).fill(Palette.secondary)
            ExerciseLoopView(url: video, paused: completed) {
                if let u = url.flatMap(URL.init(string:)) {
                    CachedAsyncImage(url: u, maxSide: MediaSizing.thumbSide(size)) { $0.resizable().scaledToFill() } placeholder: { Color.clear }
                } else {
                    fallback
                }
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

    private var fallback: some View {
        ExerciseSilhouette(muscleGroup: muscleGroup)
            .padding(.vertical, size * 0.1)
            .opacity(completed ? 0.6 : 1)
    }
}

/// Descanso: anillo dorado con la cuenta atrás («0:45», en Big Shoulders) y «Descanso», y −15 s / +15 s
/// a los lados, como la web. Al llegar a cero, aviso y fuera.
struct RestTimerRow: View {
    let end: Date
    @ObservedObject var workout: ActiveWorkout

    private func stepButton(_ title: String, by seconds: Int, label: String) -> some View {
        Button(title) { Haptics.selection(); workout.adjustRest(by: seconds) }
            .font(.apHeadline.monospacedDigit())
            .foregroundStyle(Palette.foreground)
            .frame(minWidth: 76, minHeight: 44)
            .background(RaisedFill(shape: Capsule()))
            .accessibilityLabel(label)
    }

    var body: some View {
        TimelineView(.periodic(from: .now, by: 1)) { ctx in
            // En pausa el descanso se congela en la marca de pausa.
            let left = max(0, Int(end.timeIntervalSince(workout.draft.pausedAt ?? ctx.date).rounded(.up)))
            let target = max(workout.restTarget, 1)
            let progress = min(1.0, Double(left) / Double(target))

            HStack(spacing: 20) {
                stepButton("−15 s", by: -15, label: "Restar 15 segundos")

                ZStack {
                    Circle().stroke(Palette.secondary, lineWidth: 4)
                    Circle()
                        .trim(from: 0, to: progress)
                        .stroke(Palette.gold, style: StrokeStyle(lineWidth: 4, lineCap: .round))
                        .rotationEffect(.degrees(-90))
                        .animation(.linear(duration: 1), value: progress)
                    VStack(spacing: 2) {
                        Text("\(left / 60):\(String(format: "%02d", left % 60))")
                            .font(.figure(size: 30))
                            .foregroundStyle(Palette.foreground)
                            .contentTransition(.numericText(countsDown: true))
                            .transaction { $0.animation = nil }
                        Text("Descanso").font(.apFootnote).foregroundStyle(Palette.muted)
                    }
                }
                .frame(width: 92, height: 92)
                .accessibilityElement(children: .ignore)
                .accessibilityLabel("Descanso, quedan \(left) segundos")

                stepButton("+15 s", by: 15, label: "Sumar 15 segundos")
            }
            .buttonStyle(.plain)
            .frame(maxWidth: .infinity)
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


/// Resumen final calcado de `WorkoutSummary.tsx`: «Listo» arriba, páginas que se deslizan
/// (Resumen, Músculos y Comparar) con sus puntos y «Compartir» dorado abajo. Solo se celebran las
/// mejoras: con menos volumen que la última vez, la cifra de hoy habla sola (nada de «−832 kg»).
struct WorkoutSummaryView: View {
    @ObservedObject var workout: ActiveWorkout
    let rpe: Int?
    var onDone: () -> Void
    /// Entreno vacío: «Guardar como rutina» guarda lo hecho en «Mis rutinas» (nil en una sesión del plan).
    var onSaveRoutine: ((String, [GymExercise]) async -> TrainingRepo.RoutineCommit)? = nil
    /// Ya hay siete sesiones en el plan: «Guardar como rutina» lo explica.
    var routineLimitReached = false
    @State private var page = 0
    /// PNG de la historia (1080×1920) de la página visible, listo para compartir.
    @State private var shareURL: URL?
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    /// El confeti solo se lanza una vez por resumen (y nunca con «Reducir movimiento»).
    @State private var confettiDone = false

    init(workout: ActiveWorkout, rpe: Int?, onSaveRoutine: ((String, [GymExercise]) async -> TrainingRepo.RoutineCommit)? = nil,
         routineLimitReached: Bool = false, onDone: @escaping () -> Void) {
        self.workout = workout
        self.rpe = rpe
        self.onDone = onDone
        self.onSaveRoutine = onSaveRoutine
        self.routineLimitReached = routineLimitReached
        #if DEBUG
        // Solo para capturas de QA: `-summaryPage=2` abre esa página del resumen.
        if let arg = ProcessInfo.processInfo.arguments.first(where: { $0.hasPrefix("-summaryPage=") }),
           let n = Int(arg.dropFirst("-summaryPage=".count)) {
            _page = State(initialValue: min(max(n, 0), 2))
        }
        #endif
    }

    enum Trend { case up, same, down, new }
    struct Item { let name: String; let change: String; let today: String; let trend: Trend; let proposal: String }
    private enum Page: Hashable { case summary, muscles, compare }

    // MARK: Datos

    private var title: (String, String) {
        let parts = workout.draft.day.title.components(separatedBy: " · ")
        return (parts.first ?? "", parts.dropFirst().joined(separator: " · "))
    }
    /// «18 de noviembre», como la web.
    private var dateLabel: String { Date().formatted(.dateTime.day().month(.wide).locale(Locale(identifier: "es_ES"))) }
    private var volume: Double { workout.volumeKg }
    private var hasVolume: Bool { volume > 0 }
    private var previousVolume: Double {
        workout.previous.values.joined().filter { $0.done && $0.isWarmup != true }
            .reduce(0) { $0 + Double($1.reps) * (Double($1.weight.replacingOccurrences(of: ",", with: ".")) ?? 0) }
    }
    /// Solo lo que sube: si hoy hay menos volumen, no se resta nada.
    private var gain: Double { previousVolume > 0 && hasVolume ? volume - previousVolume : 0 }
    /// Ejercicios con todas sus series hechas, como `completedExercises` en la web.
    private var completedExercises: Int {
        workout.exercises.filter { ex in
            let sets = workout.draft.logs[ex.name] ?? []
            return !sets.isEmpty && sets.allSatisfy(\.done)
        }.count
    }
    /// Series por músculo (sinergistas a la mitad), como `addExerciseLoad` en la web.
    private var muscleCounts: [String: Double] {
        var counts: [String: Double] = [:]
        for ex in workout.exercises {
            let n = Double((workout.draft.logs[ex.name] ?? []).filter { $0.done && $0.isWarmup != true }.count)
            guard n > 0 else { continue }
            let m = musclesForExercise(name: workout.swaps[ex.name] ?? ex.name, muscleGroup: ex.muscle_group)
            for p in m.primary { counts[p, default: 0] += n }
            for s in m.synergists { counts[s, default: 0] += n * 0.5 }
        }
        return counts
    }
    private var muscles: [String] { muscleCounts.sorted { $0.value > $1.value }.map(\.key) }
    /// «Pecho, hombros y tríceps»: los tres con más series (`muscleLine` en la web).
    private var muscleLine: String {
        let top = muscles.prefix(3).enumerated().map { $0.offset == 0 ? $0.element : $0.element.lowercased() }
        guard let last = top.last else { return "" }
        return top.count > 1 ? "\(top.dropLast().joined(separator: ", ")) y \(last)" : last
    }
    private func fmt(_ n: Double) -> String { NumberText.decimal(n, digits: n.rounded() == n ? 0 : 1) }

    /// «48 min» o «1:05 h», como `durationParts` en la web.
    private var durationParts: (value: String, unit: String)? {
        guard workout.finishedAt != nil else { return nil }
        let minutes = max(1, Int((workout.duration / 60).rounded()))
        return minutes < 60 ? ("\(minutes)", "min") : ("\(minutes / 60):\(String(format: "%02d", minutes % 60))", "h")
    }

    /// `buildWorkoutReview` de la web, con la cifra de hoy para lo que no mejora.
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
                : (delta ?? 0) < 0 ? "Mantén la carga y cuida descanso y técnica: la próxima sesión es para subir."
                : (delta ?? 0) > 0 ? "Si la técnica fue sólida, sube un poco la carga en la próxima sesión."
                : "Mantener el plan como referencia y reunir otra sesión comparable."
            let trend: Trend = delta == nil ? .new : delta! > 0 ? .up : delta! < 0 ? .down : .same
            let today = weighted(now) && top(now) > 0 ? "\(fmt(top(now))) kg" : "\(reps(now)) reps"
            return Item(name: workout.swaps[ex.name] ?? ex.name, change: trend == .same ? "=" : change, today: today, trend: trend, proposal: proposal)
        }
    }

    /// Etiqueta de «Frente a la última vez»: las mejoras en dorado; lo demás, la cifra de hoy en gris
    /// (`compareTag` en la web).
    static func compareTag(_ item: Item) -> (text: String, highlight: Bool) {
        switch item.trend {
        case .up: return (item.change, true)
        case .new: return ("Nuevo", false)
        default: return (item.today, false)
        }
    }

    private var pages: [Page] { muscles.isEmpty ? [.summary, .compare] : [.summary, .muscles, .compare] }
    private var currentPage: Page { pages[min(page, pages.count - 1)] }

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Spacer()
                Button { Haptics.success(); onDone() } label: {
                    Text("Listo").font(.apHeadline).foregroundStyle(Palette.gold).frame(minWidth: 44, minHeight: 44)
                }
                .buttonStyle(.plain)
                .keyboardShortcut(.defaultAction)
            }
            .padding(.horizontal, 12)
            pager
            saveRoutine
            shareButton
        }
        .background(Palette.card)
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
        .task(id: page) { shareURL = renderStory() }
    }

    // MARK: Páginas

    @ViewBuilder private var pager: some View {
        #if os(iOS)
        TabView(selection: $page) {
            ForEach(Array(pages.enumerated()), id: \.offset) { i, p in
                ScrollView { pageBody(p).padding(.horizontal, 16).padding(.bottom, 8) }
                    .scrollIndicators(.hidden)
                    .tag(i)
            }
        }
        .tabViewStyle(.page(indexDisplayMode: .never))
        dots
        #else
        // En el Mac las tres páginas, una debajo de otra; «Compartir» usa la del resumen.
        ScrollView {
            VStack(alignment: .leading, spacing: 28) { ForEach(pages, id: \.self) { pageBody($0) } }
                .padding(.horizontal, 24).padding(.bottom, 16)
                .frame(maxWidth: 560)
                .frame(maxWidth: .infinity)
        }
        #endif
    }

    @ViewBuilder private func pageBody(_ p: Page) -> some View {
        switch p {
        case .summary: summaryPage
        case .muscles: musclesPage
        case .compare: comparePage
        }
    }

    private func tile<C: View>(@ViewBuilder _ content: () -> C) -> some View {
        content()
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(16)
            .background(Palette.secondary, in: RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
    }

    private var summaryPage: some View {
        VStack(spacing: 0) {
            VStack(spacing: 4) {
                Text("Completado · \(dateLabel)").font(.apSubhead).foregroundStyle(Palette.muted)
                Text(title.0).font(.apLargeTitle).multilineTextAlignment(.center).lineLimit(2).accessibilityAddTraits(.isHeader)
                if !title.1.isEmpty {
                    Text(title.1).font(.apHeadline).foregroundStyle(Palette.muted).lineLimit(1)
                }
            }
            .frame(maxWidth: .infinity)

            // Una cifra protagonista: el volumen de hoy (o las series, si es peso corporal).
            VStack(spacing: 4) {
                Text(hasVolume ? "Volumen total" : "Series completadas").font(.apFootnote).foregroundStyle(Palette.muted)
                HStack(alignment: .firstTextBaseline, spacing: 6) {
                    Text(hasVolume ? NumberText.grouped(volume) : NumberText.integer(workout.doneSets))
                        .font(.figure(size: 64))
                        .foregroundStyle(Palette.gold)
                    Text(hasVolume ? "kg" : (workout.doneSets == 1 ? "serie" : "series"))
                        .font(.apTitle3).foregroundStyle(Palette.muted)
                }
                .lineLimit(1).minimumScaleFactor(0.6)
                if gain > 0 {
                    Label("+\(NumberText.grouped(gain)) kg más que la última vez", systemImage: "chart.line.uptrend.xyaxis")
                        .font(.apSubhead.weight(.semibold).monospacedDigit())
                        .foregroundStyle(Palette.gold)
                        .padding(.horizontal, 12).padding(.vertical, 4)
                        .background(Palette.gold.opacity(0.15), in: Capsule())
                        .padding(.top, 8)
                }
            }
            .frame(maxWidth: .infinity)
            .padding(.top, 24)
            .background {
                // Halo dorado muy tenue detrás de la cifra.
                RadialGradient(colors: [Palette.gold.opacity(0.14), .clear], center: .center, startRadius: 0, endRadius: 140)
                    .allowsHitTesting(false)
            }
            .accessibilityElement(children: .combine)

            if !workout.records.isEmpty { recordsBlock.padding(.top, 24) }

            statsGrid.padding(.top, 24)
        }
        .padding(.top, 4)
    }

    private var recordsBlock: some View {
        tile {
            VStack(alignment: .leading, spacing: 8) {
                Label(workout.records.count == 1 ? "Nuevo récord personal" : "\(workout.records.count) récords personales",
                      systemImage: "trophy.fill")
                    .font(.apTitle3)
                    .labelStyle(GoldIconLabelStyle())
                VStack(spacing: 0) {
                    ForEach(Array(workout.records.enumerated()), id: \.offset) { i, name in
                        let now = bestWeight(workout.draft.logs[name])
                        let before = bestWeight(workout.previous[name])
                        HStack(spacing: 12) {
                            Text(name).font(.apBody).lineLimit(1)
                            Spacer(minLength: 8)
                            VStack(alignment: .trailing, spacing: 0) {
                                if now > 0 { Text("\(fmt(now)) kg").font(.apHeadline.monospacedDigit()).foregroundStyle(Palette.gold) }
                                if now > 0, before > 0, now > before {
                                    Text("+\(fmt(now - before)) kg").font(.apFootnote.monospacedDigit()).foregroundStyle(Palette.muted)
                                }
                            }
                            .fixedSize()
                        }
                        .frame(minHeight: 44)
                        .overlay(alignment: .bottom) {
                            if i < workout.records.count - 1 { Rectangle().fill(Palette.separator).frame(height: 0.5) }
                        }
                    }
                }
            }
        }
    }

    private func bestWeight(_ sets: [SetLog]?) -> Double {
        (sets ?? []).filter { $0.done && $0.isWarmup != true }
            .compactMap { Double($0.weight.replacingOccurrences(of: ",", with: ".")) }.max() ?? 0
    }

    private var stats: [(label: String, value: String, unit: String?)] {
        var out: [(label: String, value: String, unit: String?)] = [
            ("Series", NumberText.grouped(Double(workout.doneSets)), nil),
            ("Ejercicios", "\(completedExercises)", "/\(workout.exercises.count)"),
        ]
        if let d = durationParts { out.append(("Duración", d.value, d.unit)) }
        if let rpe { out.append(("Esfuerzo", "\(rpe)", "/10")) }
        if out.count % 2 == 1 && !muscles.isEmpty { out.append(("Músculos", "\(muscles.count)", nil)) }
        return out
    }

    private var statsGrid: some View {
        let items = stats
        return LazyVGrid(columns: [GridItem(.flexible(), spacing: 12), GridItem(.flexible(), spacing: 12)], spacing: 12) {
            ForEach(Array(items.enumerated()), id: \.offset) { _, stat in
                VStack(spacing: 6) {
                    Text(stat.label).font(.apFootnote).foregroundStyle(Palette.muted)
                    HStack(alignment: .firstTextBaseline, spacing: 2) {
                        Text(stat.value).font(.figure(size: 36))
                        if let unit = stat.unit { Text(unit).font(.apHeadline).foregroundStyle(Palette.muted) }
                    }
                    .lineLimit(1).minimumScaleFactor(0.6)
                }
                .frame(maxWidth: .infinity)
                .padding(16)
                .background(Palette.secondary, in: RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
                .accessibilityElement(children: .combine)
            }
        }
    }

    private var musclesPage: some View {
        let counts = muscleCounts
        let strong = muscles.filter { (counts[$0] ?? 0) >= 3 }
        let light = muscles.filter { (counts[$0] ?? 0) < 3 }
        return VStack(alignment: .leading, spacing: 4) {
            Text("Músculos trabajados").font(.apTitle3).accessibilityAddTraits(.isHeader)
            if !muscleLine.isEmpty { Text(muscleLine).font(.apFootnote).foregroundStyle(Palette.muted) }
            HStack(spacing: 4) {
                MuscleBodyFigure(back: false, primary: strong, synergists: light)
                MuscleBodyFigure(back: true, primary: strong, synergists: light)
            }
            .frame(maxWidth: .infinity, minHeight: 256, maxHeight: 340)
            .padding(.horizontal, 12).padding(.vertical, 16)
            .background(Palette.secondary, in: RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
            .padding(.top, 12)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("Músculos trabajados: \(muscles.joined(separator: ", "))")
        }
    }

    private var comparePage: some View {
        let items = Array(review.prefix(6))
        return VStack(alignment: .leading, spacing: 0) {
            Text("Frente a la última vez").font(.apTitle3).accessibilityAddTraits(.isHeader)
            if items.isEmpty {
                Text("Esta sesión será tu referencia para la próxima.")
                    .font(.apSubhead).foregroundStyle(Palette.muted).padding(.top, 14)
            } else {
                VStack(spacing: 0) {
                    ForEach(Array(items.enumerated()), id: \.offset) { i, it in
                        let tag = Self.compareTag(it)
                        HStack(spacing: 12) {
                            Text(it.name).font(.apSubhead).lineLimit(1).frame(maxWidth: .infinity, alignment: .leading)
                            Text(tag.text)
                                .font(.apFootnote.weight(.semibold).monospacedDigit())
                                .foregroundStyle(tag.highlight ? Palette.gold : Palette.muted)
                                .padding(.horizontal, 10).padding(.vertical, 2)
                                .background(tag.highlight ? Palette.gold.opacity(0.15) : Palette.foreground.opacity(0.1), in: Capsule())
                                .fixedSize()
                        }
                        .padding(.horizontal, 16)
                        .frame(minHeight: 44)
                        .overlay(alignment: .bottom) {
                            if i < items.count - 1 { Rectangle().fill(Palette.separator).frame(height: 0.5) }
                        }
                    }
                }
                .padding(.vertical, 4)
                .background(Palette.secondary, in: RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
                .padding(.top, 16)
            }
            HStack(alignment: .top, spacing: 12) {
                Image(systemName: "target").font(.inter(size: 18, weight: .semibold)).foregroundStyle(Palette.gold)
                    .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 2) {
                    Text("Próxima sesión").font(.apHeadline)
                    Text(items.first?.proposal ?? "Mantén tu plan como referencia para la próxima sesión.")
                        .font(.apSubhead).foregroundStyle(Palette.muted)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Spacer(minLength: 0)
            }
            .padding(16)
            .background(Palette.secondary, in: RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
            .padding(.top, 12)
        }
    }

    // MARK: Guardar como rutina, puntos y compartir

    /// Entreno vacío terminado: lo hecho (ejercicios con series hechas) se guarda como rutina.
    @ViewBuilder private var saveRoutine: some View {
        let performed = CustomRoutines.fromWorkout(workout.exercises, logs: workout.draft.logs)
        if let onSaveRoutine, !performed.isEmpty {
            SaveRoutineButton(exercises: performed,
                              suggestedName: SessionIdentity.suggestedName(DayPlan(day: "", type: "gimnasio", exercises: performed)),
                              limitReached: routineLimitReached, onSave: onSaveRoutine)
                .padding(.horizontal, 20).padding(.top, 4).padding(.bottom, 8)
        }
    }

    private var dots: some View {
        HStack(spacing: 0) {
            ForEach(pages.indices, id: \.self) { i in
                Capsule()
                    .fill(i == page ? Palette.gold : Palette.foreground.opacity(0.25))
                    .frame(width: i == page ? 16 : 7, height: 7)
                    .frame(width: 28, height: 44)
                    .contentShape(Rectangle())
                    .onTapGesture { Haptics.selection(); withAnimation(reduceMotion ? nil : .snappy) { page = i } }
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Página \(page + 1) de \(pages.count)")
        .accessibilityAdjustableAction { direction in
            switch direction {
            case .increment: page = min(page + 1, pages.count - 1)
            case .decrement: page = max(page - 1, 0)
            default: break
            }
        }
    }

    /// La única acción dorada: compartir la historia de la página visible (resumen o músculos).
    @ViewBuilder private var shareButton: some View {
        Group {
            if let shareURL {
                ShareLink(item: shareURL) { Label("Compartir", systemImage: "square.and.arrow.up") }
            } else {
                Button {} label: { Label("Compartir", systemImage: "square.and.arrow.up") }.disabled(true)
            }
        }
        .buttonStyle(.pill)
        .padding(.horizontal, 20)
        .padding(.top, 4)
        .padding(.bottom, 20)
    }

    /// Historia de 1080 × 1920 con la misma composición que `WorkoutStoryShare` en la web.
    @MainActor
    private func renderStory() -> URL? {
        let card = WorkoutShareCard(
            variant: currentPage == .muscles ? .musculos : .resumen,
            title: workout.draft.day.title, date: dateLabel, volumeKg: volume, sets: workout.doneSets,
            exercises: completedExercises, records: workout.records, muscles: muscles, muscleCounts: muscleCounts,
            previousVolumeKg: previousVolume
        )
        let renderer = ImageRenderer(content: card)
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
            try? data.write(to: docs.appendingPathComponent("autopilot-entreno.png"))
        }
        #endif
        let url = FileManager.default.temporaryDirectory.appendingPathComponent("autopilot-entreno.png")
        do { try data.write(to: url); return url } catch { return nil }
    }
}

/// Icono dorado y texto en el color del título (para «Nuevo récord personal»).
private struct GoldIconLabelStyle: LabelStyle {
    func makeBody(configuration: Configuration) -> some View {
        HStack(spacing: 8) {
            configuration.icon.foregroundStyle(Palette.gold)
            configuration.title
        }
    }
}

/// Imagen para compartir el entreno (historia 9:16), espejo de `renderStory` en la web: fecha arriba,
/// título y músculos, la cifra protagonista en Big Shoulders con su unidad, el logro (solo si sube),
/// tres cifras y el AP pequeño al pie, sin el nombre de la marca.
struct WorkoutShareCard: View {
    enum Variant { case resumen, musculos }
    let variant: Variant
    let title: String
    let date: String
    let volumeKg: Double
    let sets: Int
    let exercises: Int
    let records: [String]
    let muscles: [String]
    let muscleCounts: [String: Double]
    let previousVolumeKg: Double

    private let secondary = Color(red: 0.659, green: 0.659, blue: 0.682)

    /// Volumen de hoy, o las series si es peso corporal: nunca «0 kg».
    private var hero: (label: String, value: String, unit: String) {
        volumeKg > 0
            ? ("Volumen total", NumberText.grouped(volumeKg), "kg")
            : ("Series completadas", NumberText.grouped(Double(sets)), sets == 1 ? "serie" : "series")
    }

    /// Un récord o lo que sube el volumen; nunca una bajada (`sessionHighlight` en la web).
    private var highlight: String? {
        if let first = records.first { return "Nuevo récord · \(first)" }
        let gain = volumeKg - previousVolumeKg
        return previousVolumeKg > 0 && gain > 0 ? "+\(NumberText.grouped(gain)) kg más que la última vez" : nil
    }

    private var subtitle: String {
        let top = muscles.prefix(3).enumerated().map { $0.offset == 0 ? $0.element : $0.element.lowercased() }
        guard let last = top.last else { return "Sesión completada" }
        return top.count > 1 ? "\(top.dropLast().joined(separator: ", ")) y \(last)" : last
    }

    var body: some View {
        ZStack(alignment: .top) {
            Color.black
            RadialGradient(colors: [Palette.gold.opacity(0.14), .clear], center: UnitPoint(x: 0.5, y: 0.05), startRadius: 0, endRadius: 217)
            VStack(spacing: 0) {
                Text("Completado · \(date)")
                    .font(.inter(size: 13, weight: .medium)).foregroundStyle(secondary)
                    .padding(.top, 36)
                if variant == .resumen { resumen } else { musculos }
                Spacer(minLength: 0)
                BrandMark(size: 24)
                Text("autopilotplan.com")
                    .font(.inter(size: 13, weight: .medium)).foregroundStyle(secondary)
                    .padding(.top, 10).padding(.bottom, 34)
            }
            .padding(.horizontal, 25)
        }
        .frame(width: 360, height: 640)
        .environment(\.colorScheme, .dark)
    }

    private var titleBlock: some View {
        VStack(spacing: 6) {
            Text(title.isEmpty ? "Sesión de hoy" : title)
                .font(.inter(size: 28, weight: .heavy)).foregroundStyle(.white)
                .lineLimit(1).minimumScaleFactor(0.5)
            Text(subtitle).font(.inter(size: 15, weight: .medium)).foregroundStyle(secondary).lineLimit(1)
        }
    }

    private func bigFigure(size: CGFloat) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 6) {
            Text(hero.value).font(.figure(size: size)).foregroundStyle(.white)
            Text(hero.unit).font(.inter(size: size * 0.27, weight: .semibold)).foregroundStyle(secondary)
        }
        .lineLimit(1).minimumScaleFactor(0.4)
    }

    @ViewBuilder private var highlightCapsule: some View {
        if let highlight {
            Text(highlight)
                .font(.inter(size: 11.5, weight: .semibold)).foregroundStyle(Palette.gold)
                .lineLimit(1).minimumScaleFactor(0.6)
                .padding(.horizontal, 12).frame(height: 23)
                .background(Palette.gold.opacity(0.14), in: Capsule())
        }
    }

    private var resumen: some View {
        VStack(spacing: 0) {
            titleBlock.padding(.top, 136)
            Text(hero.label).font(.inter(size: 11.5, weight: .semibold)).foregroundStyle(secondary).padding(.top, 44)
            bigFigure(size: 80)
            highlightCapsule.padding(.top, 8)
            HStack(spacing: 0) {
                stat(NumberText.grouped(Double(sets)), "Series")
                Rectangle().fill(.white.opacity(0.12)).frame(width: 0.7, height: 43)
                stat("\(exercises)", "Ejercicios")
                Rectangle().fill(.white.opacity(0.12)).frame(width: 0.7, height: 43)
                stat("\(muscles.count)", "Músculos")
            }
            .padding(.top, 70)
        }
    }

    private var musculos: some View {
        let strong = muscles.filter { (muscleCounts[$0] ?? 0) >= 3 }
        let light = muscles.filter { (muscleCounts[$0] ?? 0) < 3 }
        return VStack(spacing: 0) {
            titleBlock.padding(.top, 46)
            highlightCapsule.padding(.top, 12)
            HStack(spacing: 20) {
                MuscleBodyFigure(back: false, primary: strong, synergists: light)
                MuscleBodyFigure(back: true, primary: strong, synergists: light)
            }
            .frame(height: 220)
            .padding(.top, 20)
            Text(hero.label).font(.inter(size: 11.5, weight: .semibold)).foregroundStyle(secondary).padding(.top, 24)
            bigFigure(size: 63)
            Text("\(sets) \(sets == 1 ? "serie" : "series") · \(exercises) \(exercises == 1 ? "ejercicio" : "ejercicios")")
                .font(.inter(size: 11.5, weight: .medium)).foregroundStyle(secondary).padding(.top, 4)
        }
    }

    private func stat(_ value: String, _ label: String) -> some View {
        VStack(spacing: 4) {
            Text(value).font(.figure(size: 32)).foregroundStyle(.white).lineLimit(1).minimumScaleFactor(0.6)
            Text(label).font(.inter(size: 13, weight: .medium)).foregroundStyle(secondary)
        }
        .frame(maxWidth: .infinity)
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
        let palette: [Color] = [Palette.gold, Palette.gold.opacity(0.65), Palette.foreground,
                                Palette.muted, Palette.gold.opacity(0.4)]
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
