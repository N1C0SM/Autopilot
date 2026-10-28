import SwiftUI
import Charts
import ImageIO
import Supabase

/// Progreso, calcado de la web: pestañas Fuerza · Físico · Récords · Scan.
/// Fuerza: «Últimas 4 semanas», kg levantados, entrenos, racha, kg esta semana, barras de 8 semanas y «Por ejercicio».
///
/// Rendimiento (objetivo: «todo hiper fluido»):
/// - Las consultas independientes van en paralelo (`async let`) y, cuando se puede, en una sola llamada.
/// - La decodificación de series, el volumen, las fechas y los formateos se calculan fuera del MainActor
///   (`Task.detached`) y solo se publican resultados ya listos: el hilo principal solo dibuja.
/// - Caché en memoria por usuario: volver a la pestaña o cambiar de cuenta y volver pinta al instante
///   y refresca en segundo plano (sin esqueleto ni parpadeo).
/// - Carga por fases: primero Fuerza (cifras + barras), después «Por ejercicio» y Récords.
///   Las fotos solo se piden al abrir «Físico».
/// - Formateadores `static` compartidos (nunca dentro de bucles), skeletons ligeros y listas perezosas.
struct ProgressScreen: View {
    @EnvironmentObject private var session: SessionModel
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.horizontalSizeClass) private var sizeClass
    @StateObject private var model = ProgressModel()
    @State private var tab = 0
    @State private var viewing: ProgressModel.Photo?
    /// «Scan» se monta la primera vez que se abre y se queda vivo: cambiar de pestaña no lo reinicia.
    @State private var scanMounted = false
    /// Ancho del contenido, medido con una preferencia (un `GeometryReader` envolviendo el scroll
    /// rompería el tamaño del contenido).
    @State private var contentWidth: CGFloat = 0

    // MARK: Disposición responsive (iPhone igual que siempre · iPad/Mac a todo el ancho)

    /// Escritorio (iPad horizontal/Mac): la web ocupa todo el ancho (`<main>` sin `max-w`).
    /// En iPhone (ancho compacto) siempre es `false`: la disposición actual queda intacta.
    private var isWide: Bool {
        guard sizeClass != .compact else { return false }
        // Antes de medir (primer fotograma) se asume escritorio: Mac/iPad no parpadean al abrir.
        return contentWidth == 0 || contentWidth >= 700
    }

    /// En Mac el lienzo y su padding los pone `SectionView` (web: `<main>` con `lg:p-10`); así no
    /// se suma dos veces. En iPad el lienzo es de la propia pantalla, como antes.
    private var horizontalPadding: CGFloat {
        #if os(macOS)
        return 0
        #else
        return 16
        #endif
    }

    /// Rejilla de fotos como la web: 3 columnas en iPhone, 4 en `md` y 6 en `lg`.
    private var photoColumns: [GridItem] {
        let count = isWide ? (contentWidth >= 944 ? 6 : 4) : 3
        return Array(repeating: GridItem(.flexible(), spacing: 8), count: count)
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                SegmentedPill(options: ["Fuerza", "Físico", "Récords", "Scan"], selection: $tab)
                switch tab {
                case 0: strength
                case 1: physique
                case 2: records
                default: EmptyView()
                }
                // «Scan» se monta la primera vez que se abre y queda oculto (0 pt, sin toques) en
                // el resto de pestañas: así conserva la foto elegida, el análisis y el estado.
                if scanMounted || tab == 3 {
                    ScanView(onScanned: { model.invalidatePhotos() })
                        // En escritorio el formulario no se estira: se acota y se centra (web: max-w-md).
                        .frame(maxWidth: isWide ? 560 : .infinity)
                        .frame(minHeight: tab == 3 ? 400 : 0)
                        .frame(height: tab == 3 ? nil : 0)
                        .frame(maxWidth: .infinity, alignment: .center)
                        .clipped()
                        .opacity(tab == 3 ? 1 : 0)
                        .allowsHitTesting(tab == 3)
                        .accessibilityHidden(tab != 3)
                }
            }
            .padding(.horizontal, horizontalPadding).padding(.top, 8).padding(.bottom, 16)
            // La web va a todo el ancho (solo la barra de pestañas está acotada, y ya lo hace
            // `SegmentedPill`): sin tope de 800 ni centrado.
            .background {
                GeometryReader { geo in
                    Color.clear.preference(key: ProgressContentWidthKey.self, value: geo.size.width)
                }
            }
            .frame(maxWidth: .infinity)
        }
        .onPreferenceChange(ProgressContentWidthKey.self) { contentWidth = $0 }
        .screenBackground()
        .refreshable {
            // El gesto espera la descarga (el indicador debe durar lo que tarda) y renueva también
            // las fotos si estamos en «Físico».
            await model.load(userId: session.userId, force: true)
            if tab == 1 { await model.loadPhotos(userId: session.userId, force: true) }
        }
        // `task(id:)` reinicia la carga al cambiar de cuenta y no repite el trabajo al volver a la pestaña:
        // si hay caché, se pinta al instante y el refresco va en segundo plano.
        .task(id: session.userId) { await model.load(userId: session.userId) }
        .onChange(of: tab) { _, newValue in
            // El cambio de pestaña no lanza cargas: los datos ya están en el snapshot y «Físico»
            // se precarga en segundo plano. Solo se reintenta si esa precarga falló.
            if newValue == 3 { scanMounted = true }
            if newValue == 1, !model.photosLoaded {
                Task { await model.loadPhotos(userId: session.userId) }
            }
        }
        .onReceive(NotificationCenter.default.publisher(for: .refreshSection)) { _ in
            Task {
                await model.load(userId: session.userId, force: true)
                if tab == 1 { await model.loadPhotos(userId: session.userId, force: true) }
            }
        }
    }

    // MARK: Fuerza

    private var strength: some View {
        // Como la web (`WorkoutProgress`): una sola columna a todo el ancho, hero arriba y
        // «Por ejercicio» debajo (también en escritorio; antes iban en dos columnas de 320).
        VStack(alignment: .leading, spacing: 16) {
            strengthHero
            strengthExercises
        }
    }

    /// Tarjeta del hero (cifras + barras), su esqueleto o el aviso de error.
    @ViewBuilder private var strengthHero: some View {
        if model.strengthLoaded {
            strengthCard
        } else if let error = model.strengthError {
            // Sin conexión y sin datos previos: se explica en vez de dejar latiendo el esqueleto
            // (o de pintar «0 kg», que parecería que no has entrenado).
            ProgressRetryCard(title: "No hemos podido cargar tu progreso", message: error) {
                Task { await model.load(userId: session.userId, force: true) }
            }
        } else {
            // Esqueleto con la altura real de la tarjeta: al llegar los datos no salta el layout.
            strengthSkeleton
        }
    }

    /// «Por ejercicio» (o su esqueleto / aviso de error).
    @ViewBuilder private var strengthExercises: some View {
        if model.detailsLoaded {
            if !model.history.isEmpty {
                VStack(alignment: .leading, spacing: 16) {
                    Text("Por ejercicio").font(.apTitle3).padding(.top, 8)
                    ExerciseProgressSection(history: model.history, images: model.exerciseImages, names: model.exerciseNames)
                }
            } else {
                // Cuenta recién creada: sin esto la pestaña parecía rota (solo la tarjeta a 0 kg).
                EmptyStateView(symbol: "chart.line.uptrend.xyaxis", title: "Aún no hay progreso",
                               message: "Cuando registres tus primeros entrenos verás aquí la evolución por ejercicio.")
                    .background(Palette.card, in: RoundedRectangle(cornerRadius: Radius.hero, style: .continuous))
            }
        } else if let error = model.detailsError {
            ProgressRetryCard(title: "No hemos podido cargar «Por ejercicio»", message: error) {
                Task { await model.load(userId: session.userId, force: true) }
            }
        } else {
            exerciseSkeleton
        }
    }

    private var strengthCard: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("Últimas 4 semanas").font(.apSubhead.weight(.semibold)).foregroundStyle(Palette.gold)
            HStack(alignment: .firstTextBaseline, spacing: 6) {
                Text(NumberText.integer(model.kg4w)).font(.inter(size: 56, weight: .bold).monospacedDigit())
                    // Cifra grande: que no se corte con Dynamic Type o números largos.
                    .lineLimit(1).minimumScaleFactor(0.6)
                    .contentTransition(.numericText())
                    .animation(reduceMotion ? nil : .snappy, value: model.kg4w)
                Text("kg levantados").font(.apTitle3).foregroundStyle(Palette.muted)
            }
            // Tres columnas iguales: las cifras nunca empujan el texto fuera del margen.
            HStack(alignment: .top, spacing: 12) {
                stat("\(model.workouts4w)", model.workouts4w == 1 ? "entreno" : "entrenos")
                stat("\(model.streakWeeks)", model.streakWeeks == 1 ? "semana de racha" : "semanas de racha")
                stat(NumberText.integer(model.kgThisWeek), "kg esta semana")
            }
            .padding(.top, 12)
            Chart(model.weekly, id: \.label) { w in
                BarMark(x: .value("Semana", w.label), y: .value("kg", max(w.kg, model.maxWeekly * 0.02)))
                    .foregroundStyle(w.kg > 0 ? Palette.gold : Palette.gold.opacity(0.25))
                    .cornerRadius(8)
            }
            .chartYAxis(.hidden)
            .chartXAxis { AxisMarks { _ in AxisValueLabel().font(.inter(.caption2)).foregroundStyle(Palette.muted) } }
            .frame(height: 160)
            .padding(.top, 20)
            .accessibilityLabel("Kilos levantados por semana")
        }
        .padding(20)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(alignment: .topTrailing) {
            RadialGradient(colors: [Palette.gold.opacity(0.18), .clear], center: .topTrailing, startRadius: 0, endRadius: 260)
        }
        .background(Palette.card)
        .clipShape(RoundedRectangle(cornerRadius: Radius.hero, style: .continuous))
    }

    private func stat(_ value: String, _ label: String) -> some View {
        VStack(alignment: .leading, spacing: 1) {
            Text(value)
                .font(.inter(.title3).weight(.bold))
                .monospacedDigit()
                .lineLimit(1)
                .minimumScaleFactor(0.7)
                .contentTransition(.numericText())
            Text(label)
                .font(.apFootnote)
                .foregroundStyle(Palette.muted)
                .lineLimit(2)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .combine)
    }

    // MARK: Físico (ProgressPhotos de la web)

    private var physique: some View {
        Group {
            if !model.photosLoaded, let error = model.photosError {
                // Las fotos son lo único que hay en esta pestaña: sin conexión se avisa y se reintenta.
                ProgressRetryCard(title: "No hemos podido cargar tus fotos", message: error) {
                    Task { await model.loadPhotos(userId: session.userId, force: true) }
                }
            } else if !model.photosLoaded {
                // Primera vez en «Físico»: esqueleto mientras llegan las filas y se firman las fotos.
                physiqueSkeleton
            } else if isWide {
                // Escritorio como la web: comparación acotada (`max-w-xl`) y rejilla de fotos más ancha.
                VStack(alignment: .leading, spacing: 24) {
                    comparisonBlock.frame(maxWidth: 576, alignment: .leading)
                    photoMonths
                }
            } else {
                // iPhone: una columna, exactamente como hasta ahora.
                VStack(alignment: .leading, spacing: 24) {
                    comparisonBlock
                    photoMonths
                }
            }
        }
        .fullScreenCoverCompat(item: $viewing) { p in
            ZStack {
                Color.black.ignoresSafeArea()
                CachedAsyncImage(url: p.url) { $0.resizable().scaledToFit() } placeholder: { ProgressView() }
            }
            .onTapGesture { viewing = nil }
            .accessibilityLabel("Foto de progreso del \(p.shortDate). Toca para cerrar")
        }
    }

    /// Comparación «antes/ahora» y avisos (sin fotos / faltan dos del mismo ángulo).
    @ViewBuilder private var comparisonBlock: some View {
        if model.photos.isEmpty {
            // Sin ninguna foto, «Compara tu evolución» no tenía sentido: se explica de
            // dónde salen las fotos (las guarda cada scan), como en la web.
            photosEmpty
        } else if let before = model.comparison.last, let after = model.comparison.first {
            VStack(spacing: 16) {
                HStack(spacing: 8) { photoTile(before, label: "Antes"); photoTile(after, label: "Ahora") }
                // Abre la foto más reciente a pantalla completa (la comparación ya se ve arriba,
                // lado a lado): antes el texto prometía algo que la hoja no hacía.
                Button("Ver la última foto") { viewing = after }.buttonStyle(.pill)
            }
        } else {
            // Hacen falta dos fotos del mismo ángulo: el mismo aviso que en la web.
            compareTeaser
        }
    }

    /// Fotos agrupadas por mes. Sigue siendo perezoso: solo se construyen las celdas visibles.
    private var photoMonths: some View {
        LazyVStack(alignment: .leading, spacing: 24) {
            ForEach(model.photoGroups) { group in
                VStack(alignment: .leading, spacing: 12) {
                    Text(group.month).font(.apHeadline)
                    LazyVGrid(columns: photoColumns, spacing: 8) {
                        ForEach(group.photos) { p in
                            Button { viewing = p } label: { photoTile(p, label: p.shortDate) }
                                .buttonStyle(.plain)
                                .accessibilityLabel("Progreso: ver foto del \(p.shortDate)")
                        }
                    }
                }
            }
        }
    }

    private var photosEmpty: some View {
        HStack(alignment: .top, spacing: 14) {
            IconTile(symbol: "sparkles")
            VStack(alignment: .leading, spacing: 4) {
                Text("Empieza a documentar tu progreso").font(.apHeadline)
                Text("Tus fotos se guardan solas cada vez que haces un análisis en Scan.").font(.apSubhead).foregroundStyle(Palette.muted)
                Button("Hacer mi primer scan") { Haptics.tap(); tab = 3 }
                    .font(.apHeadline).foregroundStyle(Palette.gold).buttonStyle(.plain).frame(minHeight: 44)
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Palette.card, in: RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
    }

    private var compareTeaser: some View {
        HStack(alignment: .top, spacing: 14) {
            IconTile(symbol: "rectangle.split.2x1")
            VStack(alignment: .leading, spacing: 4) {
                Text("Compara tu evolución").font(.apHeadline)
                Text("Con dos scans del mismo ángulo verás el antes y el después lado a lado.").font(.apSubhead).foregroundStyle(Palette.muted)
                Button("Hacer un scan") { Haptics.tap(); tab = 3 }
                    .font(.apHeadline).foregroundStyle(Palette.gold).buttonStyle(.plain).frame(minHeight: 44)
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Palette.card, in: RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
    }

    private func photoTile(_ p: ProgressModel.Photo, label: String) -> some View {
        Color.clear.aspectRatio(3/4, contentMode: .fit)
            .overlay { RemoteThumb(url: p.url) { Palette.secondary } }
            .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
            .overlay(alignment: .bottomLeading) {
                // Sin fecha legible no se pinta una píldora vacía.
                if !label.isEmpty {
                    Text(label).font(.inter(.caption2).weight(.medium).monospacedDigit()).foregroundStyle(.white)
                        .padding(.horizontal, 6).padding(.vertical, 2).background(.black.opacity(0.55), in: Capsule()).padding(6)
                }
            }
    }

    // MARK: Récords (como la web: tarjeta «Tu mejor marca» y lista «Tus récords personales»)

    private var records: some View {
        Group {
            if !model.recordsLoaded, let error = model.recordsError {
                ProgressRetryCard(title: "No hemos podido cargar tus récords", message: error) {
                    Task { await model.load(userId: session.userId, force: true) }
                }
            } else if !model.recordsLoaded {
                recordsSkeleton
            } else if model.records.isEmpty {
                EmptyStateView(symbol: "trophy", title: "Sin récords aún", message: "Registra tus entrenos con peso y rompe tu primer récord personal.")
                    .background(Palette.card, in: RoundedRectangle(cornerRadius: Radius.hero, style: .continuous))
            } else if let best = model.bestRecord {
                if isWide {
                    // Escritorio como la web (`lg:grid-cols-[280px_1fr]`): la mejor marca fija a
                    // 280 pt y la lista ocupando el resto del ancho.
                    HStack(alignment: .top, spacing: 32) {
                        recordsHero(best).frame(width: 280)
                        VStack(alignment: .leading, spacing: 16) {
                            recordsHeader
                            recordsTable
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                    }
                } else {
                    // iPhone: una columna, exactamente como hasta ahora.
                    VStack(alignment: .leading, spacing: 16) {
                        recordsHero(best)
                        recordsHeader
                        recordsTable
                    }
                }
            }
        }
    }

    /// Tarjeta grande «Tu mejor marca».
    private func recordsHero(_ best: ProgressModel.Record) -> some View {
        ZStack(alignment: .bottomLeading) {
            Color.clear.frame(maxWidth: .infinity).frame(height: 256)
                .overlay { CachedAsyncImage(url: best.image.flatMap(URL.init(string:))) { $0.resizable().scaledToFill() } placeholder: { Palette.card } }
                .clipped()
            LinearGradient(colors: [.black.opacity(0.9), .black.opacity(0.45), .black.opacity(0.1)], startPoint: .bottom, endPoint: .top)
            VStack(alignment: .leading, spacing: 4) {
                Label("Tu mejor marca", systemImage: "trophy").font(.apSubhead.weight(.semibold)).foregroundStyle(Palette.gold)
                HStack(alignment: .firstTextBaseline, spacing: 4) {
                    Text(best.e1rmText).font(.inter(size: 64, weight: .bold))
                        .lineLimit(1).minimumScaleFactor(0.6)
                        .contentTransition(.numericText())
                    Text("kg").font(.apTitle3).foregroundStyle(.white.opacity(0.7))
                }
                Text("1RM estimado en \(best.name)").font(.apSubhead).foregroundStyle(.white.opacity(0.75))
            }
            .padding(20)
        }
        .clipShape(RoundedRectangle(cornerRadius: Radius.hero, style: .continuous))
        .accessibilityElement(children: .combine)
    }

    private var recordsHeader: some View {
        Text("TUS RÉCORDS PERSONALES")
            .font(.apFootnote).foregroundStyle(Palette.muted)
            // En escritorio la cabecera abre su columna; en iPhone conserva su aire sobre la lista.
            .padding(.top, isWide ? 0 : 12)
    }

    /// Lista de récords: `LazyVStack` en iPhone (como hasta ahora) y pila normal en la celda de
    /// escritorio, donde el alto debe ser determinista para que el layout no salte.
    private var recordsTable: some View {
        Group {
            if isWide {
                VStack(spacing: 0) { recordsRows }
            } else {
                LazyVStack(spacing: 0) { recordsRows }
            }
        }
        .background(Palette.card, in: RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
    }

    @ViewBuilder private var recordsRows: some View {
        ForEach(Array(model.records.enumerated()), id: \.element.name) { i, pr in
            HStack(spacing: 14) {
                ProgressRecordThumb(url: pr.image, size: 44)
                VStack(alignment: .leading, spacing: 2) {
                    Text(pr.name).font(.apBody)
                    // Sin fecha (dato raro en el servidor) no se deja una línea vacía.
                    if !pr.dateText.isEmpty { Text(pr.dateText).font(.apFootnote).foregroundStyle(Palette.muted) }
                }
                Spacer(minLength: 8)
                VStack(alignment: .trailing, spacing: 4) {
                    Text("\(pr.weightText) kg × \(pr.reps)").font(.apBody.weight(.semibold).monospacedDigit())
                    Text("1RM ~\(pr.e1rmText) kg").font(.apFootnote.monospacedDigit()).foregroundStyle(Palette.muted)
                }
            }
            .padding(.horizontal, 16).padding(.vertical, 14)
            .overlay(alignment: .top) { if i > 0 { Rectangle().fill(Palette.separator).frame(height: 0.5).padding(.leading, 82) } }
            .accessibilityElement(children: .combine)
        }
    }

    // MARK: Esqueletos de carga

    private var strengthSkeleton: some View {
        ProgressSkeletonPulse {
            VStack(alignment: .leading, spacing: 12) {
                ProgressSkeletonBlock(height: 14, radius: 7, width: 148)
                ProgressSkeletonBlock(height: 56, radius: 12, width: 236)
                HStack(spacing: 20) {
                    ProgressSkeletonBlock(height: 16, radius: 8, width: 74)
                    ProgressSkeletonBlock(height: 16, radius: 8, width: 96)
                    ProgressSkeletonBlock(height: 16, radius: 8, width: 88)
                }
                .padding(.top, 8)
                ProgressSkeletonBlock(height: 160, radius: 14).padding(.top, 20)
            }
            .padding(20)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Palette.card, in: RoundedRectangle(cornerRadius: Radius.hero, style: .continuous))
        }
    }

    private var exerciseSkeleton: some View {
        ProgressSkeletonPulse {
            VStack(alignment: .leading, spacing: 12) {
                Text("Por ejercicio").font(.apTitle3).padding(.top, 8).opacity(0.5)
                ProgressSkeletonBlock(height: 176, radius: 28)
                ProgressSkeletonBlock(height: 256, radius: 16)
            }
        }
    }

    private var physiqueSkeleton: some View {
        ProgressSkeletonPulse {
            VStack(alignment: .leading, spacing: 24) {
                // En escritorio la comparación va acotada, igual que el contenido real.
                ProgressSkeletonBlock(height: 96, radius: Radius.card)
                    .frame(maxWidth: isWide ? 576 : .infinity, alignment: .leading)
                // Mismas columnas que la rejilla real (6 en escritorio, 3 en iPhone).
                LazyVGrid(columns: photoColumns, spacing: 8) {
                    ForEach(0..<6, id: \.self) { _ in
                        Color.clear.aspectRatio(3/4, contentMode: .fit)
                            .overlay { RoundedRectangle(cornerRadius: 10, style: .continuous).fill(Palette.secondary) }
                    }
                }
            }
        }
    }

    private var recordsSkeleton: some View {
        ProgressSkeletonPulse {
            Group {
                if isWide {
                    // Misma disposición que el contenido real (280 + resto): sin saltos al cargar.
                    HStack(alignment: .top, spacing: 32) {
                        ProgressSkeletonBlock(height: 256, radius: Radius.hero).frame(width: 280)
                        VStack(alignment: .leading, spacing: 16) {
                            ProgressSkeletonBlock(height: 12, radius: 6, width: 188)
                            recordsSkeletonRows
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                    }
                } else {
                    VStack(alignment: .leading, spacing: 16) {
                        ProgressSkeletonBlock(height: 256, radius: Radius.hero)
                        ProgressSkeletonBlock(height: 12, radius: 6, width: 188).padding(.horizontal, 16).padding(.top, 12)
                        recordsSkeletonRows
                    }
                }
            }
        }
    }

    private var recordsSkeletonRows: some View {
        VStack(spacing: 0) {
            ForEach(0..<3, id: \.self) { _ in
                HStack(spacing: 14) {
                    ProgressSkeletonBlock(height: 44, radius: 12, width: 44)
                    VStack(alignment: .leading, spacing: 6) {
                        ProgressSkeletonBlock(height: 12, radius: 6, width: 132)
                        ProgressSkeletonBlock(height: 10, radius: 5, width: 82)
                    }
                    Spacer(minLength: 8)
                    ProgressSkeletonBlock(height: 12, radius: 6, width: 92)
                }
                .padding(.horizontal, 16).padding(.vertical, 14)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Palette.card, in: RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
    }
}

// MARK: - Modelo

/// Estado de la pantalla. Todo lo que se publica ya viene calculado y formateado: la vista no hace trabajo.
@MainActor
final class ProgressModel: ObservableObject {
    struct Week { let label: String; let kg: Double }
    struct Weight { let date: Date; let kg: Double }

    struct Record {
        let name: String; let weight: Double; let reps: Int; let e1rm: Double
        /// Fecha y cifras ya formateadas al cargar: la lista de récords no formatea al redibujar.
        let dateText: String
        let weightText: String
        let e1rmText: String
        let image: String?
    }

    struct Photo: Identifiable, Hashable {
        let id: String; let url: URL?; let takenAt: String
        let date: Date?
        /// Ángulo de la foto (`front`/`back`), deducido de `note` como en la web.
        let angle: String?
        /// Mes y día ya formateados: formatear dentro del `body` cuesta caro al hacer scroll.
        let month: String
        let shortDate: String
    }

    /// Fotos agrupadas por mes, en el mismo orden en que llegan del servidor (más recientes primero).
    struct PhotoGroup: Identifiable {
        let month: String
        var photos: [Photo]
        var id: String { month }
    }

    struct ExerciseStat { let name: String; let sessions: Int; let bestVolume: Double }

    /// Todo lo que pinta la pantalla, ya calculado. Un único `@Published` → un solo redibujado por fase
    /// (antes cada propiedad publicaba por su cuenta y la vista se rehacía varias veces por carga).
    struct Snapshot {
        var weekly: [Week] = []
        var maxWeekly: Double = 1
        var kg4w = 0
        var kgThisWeek = 0
        var workouts4w = 0
        var streakWeeks = 0
        var byExercise: [ExerciseStat] = []

        var history: [String: [ExerciseEntry]] = [:]
        /// Nombres del menú «Por ejercicio» ordenados fuera del hilo principal.
        var exerciseNames: [String] = []
        var exerciseImages: [String: String] = [:]
        var records: [Record] = []
        var bestRecord: Record?
        var weights: [Weight] = []

        var photos: [Photo] = []
        var photoGroups: [PhotoGroup] = []
        /// Fotos de un mismo ángulo para el «antes/después» (más recientes primero). Como en la web,
        /// no se compara una foto de frente con una de espalda: eso no dice nada del progreso.
        var comparison: [Photo] = []

        /// Marca de tiempo de cada fase: `nil` = todavía no cargada (se muestra esqueleto).
        var strengthAt: Date?
        var detailsAt: Date?
        var photosAt: Date?
        /// Fallo de red de cada fase. Sin esto, un `try?` convertía «sin conexión» en «0 kg» o en
        /// un esqueleto que no terminaba nunca; ahora se distingue error de vacío donde importa.
        var strengthError: String?
        var detailsError: String?
        var recordsError: String?
        var photosError: String?
    }

    @Published private(set) var snapshot = Snapshot()

    // MARK: Accesos de solo lectura que usa la vista

    var weekly: [Week] { snapshot.weekly }
    var maxWeekly: Double { snapshot.maxWeekly }
    var kg4w: Int { snapshot.kg4w }
    var kgThisWeek: Int { snapshot.kgThisWeek }
    var workouts4w: Int { snapshot.workouts4w }
    var streakWeeks: Int { snapshot.streakWeeks }
    var byExercise: [ExerciseStat] { snapshot.byExercise }
    var history: [String: [ExerciseEntry]] { snapshot.history }
    var exerciseNames: [String] { snapshot.exerciseNames }
    var exerciseImages: [String: String] { snapshot.exerciseImages }
    var records: [Record] { snapshot.records }
    var bestRecord: Record? { snapshot.bestRecord }
    var weights: [Weight] { snapshot.weights }
    var photos: [Photo] { snapshot.photos }
    var photoGroups: [PhotoGroup] { snapshot.photoGroups }
    var comparison: [Photo] { snapshot.comparison }

    var strengthError: String? { snapshot.strengthError }
    var detailsError: String? { snapshot.detailsError }
    var recordsError: String? { snapshot.recordsError }
    var photosError: String? { snapshot.photosError }

    /// Fases ya disponibles en pantalla (para elegir entre esqueleto y contenido).
    var strengthLoaded: Bool { snapshot.strengthAt != nil }
    var detailsLoaded: Bool { snapshot.detailsAt != nil }
    var recordsLoaded: Bool { snapshot.detailsAt != nil }
    var photosLoaded: Bool { snapshot.photosAt != nil }

    // MARK: Estado interno

    private var currentUserId: UUID?
    /// Se incrementa al cambiar de cuenta: una carga antigua no puede publicar encima de la nueva.
    private var generation = 0
    private var loadTask: Task<Void, Never>?
    private var photosFetching = false

    /// Caché en memoria compartida entre visitas. `ProgressScreen` se recrea al cambiar de pestaña,
    /// así que la caché vive en el tipo y no en la instancia del modelo.
    private static var cache: [UUID: Snapshot] = [:]
    private static var cacheOrder: [UUID] = []
    private static let cacheLimit = 3

    // MARK: Carga

    /// Carga inicial o al volver a la pestaña. Con caché pinta al instante; el refresco va aparte.
    func load(userId: UUID?, force: Bool = false) async {
        guard let userId else { return }
        prepare(userId: userId)
        let gen = generation

        if force {
            // Pull-to-refresh / «Actualizar»: se espera para que el indicador dure lo que la descarga.
            loadTask?.cancel()
            loadTask = nil
            await refresh(userId: userId, gen: gen)
            return
        }

        // Datos recién traídos: volver a la pestaña no vuelve a pedir red.
        if let at = snapshot.strengthAt, Date().timeIntervalSince(at) < 20 { return }
        // Con datos en pantalla el refresco no bloquea la vista ni muestra esqueletos.
        startBackgroundRefresh(userId: userId, gen: gen)
        // «Físico» se prepara en segundo plano (filas, firmas y primeras miniaturas): cambiar a esa
        // pestaña no dispara ninguna carga.
        if snapshot.photosAt == nil { startPhotoPrefetch(userId: userId) }
    }

    /// Fotos de progreso: filas + una URL firmada por foto. Se precargan en segundo plano al cargar
    /// la pantalla (y de nuevo al abrir «Físico» si la precarga falló), para que el cambio de pestaña
    /// no dispare ninguna carga.
    func loadPhotos(userId: UUID?, force: Bool = false) async {
        guard let userId else { return }
        prepare(userId: userId)
        let gen = generation

        // Las URL firmadas caducan a la hora: se renuevan como mucho cada 45 min.
        if !force, let at = snapshot.photosAt, Date().timeIntervalSince(at) < 45 * 60 { return }
        if photosFetching { return }
        photosFetching = true
        defer { photosFetching = false }
        // Al reintentar se vuelve al esqueleto para que el botón responda.
        if snapshot.photosError != nil { apply { $0.photosError = nil } }

        guard let rows = await Self.photoRows(userId: userId) else {
            guard !isStale(gen) else { return }
            // Sin conexión: se avisa en «Físico» en vez de dejar el esqueleto para siempre.
            if snapshot.photosAt == nil { apply { $0.photosError = Self.offlineMessage } }
            return
        }
        let paths = rows.map(\.photo_url).filter { !$0.hasPrefix("http") }
        let signed = await Self.signedURLs(paths: paths)
        guard !isStale(gen) else { return }
        let built = await Task.detached(priority: .utility) {
            ProgressCompute.photos(rows: rows, signed: signed)
        }.value
        guard !isStale(gen) else { return }

        apply { shot in
            shot.photos = built.photos
            shot.photoGroups = built.groups
            shot.comparison = built.comparison
            shot.photosAt = Date()
            shot.photosError = nil
        }
        // Las miniaturas de la primera pantalla de la rejilla ya quedan en memoria.
        prefetchPhotoThumbnails(built.photos)
    }

    /// Precarga de «Físico» en segundo plano (no bloquea ni dispara cargas al cambiar de pestaña).
    private func startPhotoPrefetch(userId: UUID) {
        guard !photosFetching else { return }
        Task { await loadPhotos(userId: userId) }
    }

    /// Miniaturas de las fotos que caben en la primera pantalla (rejilla de 3 columnas).
    private func prefetchPhotoThumbnails(_ photos: [Photo]) {
        let urls = photos.prefix(9).compactMap(\.url)
        guard !urls.isEmpty else { return }
        Task {
            for url in urls { _ = await ThumbnailCache.shared.load(url, maxSide: photoThumbSide) }
        }
    }

    /// Cambio de cuenta: se descarta lo anterior, se cancela lo que estuviera en vuelo y se
    /// restaura la caché del usuario nuevo (si existe).
    private func prepare(userId: UUID) {
        guard currentUserId != userId else { return }
        currentUserId = userId
        generation &+= 1
        loadTask?.cancel()
        loadTask = nil
        photosFetching = false
        snapshot = Self.cache[userId] ?? Snapshot()
    }

    private func startBackgroundRefresh(userId: UUID, gen: Int) {
        guard loadTask == nil || loadTask?.isCancelled == true else { return }
        loadTask = Task { [weak self] in
            guard let self else { return }
            await self.refresh(userId: userId, gen: gen)
            if self.generation == gen { self.loadTask = nil }
        }
    }

    private func isStale(_ gen: Int) -> Bool { gen != generation || Task.isCancelled }

    // MARK: Fases de carga

    private func refresh(userId: UUID, gen: Int) async {
        let startedAt = Date()
        let calendar = Calendar(identifier: .iso8601)
        let thisMonday = calendar.dateInterval(of: .weekOfYear, for: Date())?.start ?? Date()
        let eightWeeksAgo = calendar.date(byAdding: .weekOfYear, value: -7, to: thisMonday) ?? thisMonday

        // Al reintentar se vuelve al esqueleto: el error deja de mostrarse en cuanto hay petición.
        if snapshot.strengthError != nil || snapshot.detailsError != nil || snapshot.recordsError != nil {
            apply { shot in
                shot.strengthError = nil
                shot.detailsError = nil
                shot.recordsError = nil
            }
        }

        // ── Fase 1 · Fuerza: las dos consultas son independientes y van en paralelo ──
        async let logsFetch = Self.strengthLogs(userId: userId, since: LocalDate.string(eightWeeksAgo))
        async let completionsFetch = TrainingRepo.completions(userId: userId, since: LocalDate.daysAgo(27))
        let (logs, completions) = await (logsFetch, completionsFetch)
        guard !isStale(gen) else { return }

        guard let logs else {
            // Sin conexión: no se publican ceros (parecería «no has entrenado»). Si ya había datos
            // en pantalla se quedan; si no, se explica el fallo con un botón para reintentar.
            if snapshot.strengthAt == nil { apply { $0.strengthError = Self.offlineMessage } }
            return
        }

        // Volumen, semanas, racha y «Por ejercicio»: fuera del MainActor.
        let strength = await Task.detached(priority: .userInitiated) {
            ProgressCompute.strength(logs: logs, workouts4w: completions.count, thisMonday: thisMonday)
        }.value
        guard !isStale(gen) else { return }
        apply { shot in
            shot.weekly = strength.weekly
            shot.maxWeekly = strength.maxWeekly
            shot.kg4w = strength.kg4w
            shot.kgThisWeek = strength.kgThisWeek
            shot.workouts4w = strength.workouts4w
            shot.streakWeeks = strength.streakWeeks
            shot.byExercise = strength.byExercise
            shot.strengthAt = startedAt
            shot.strengthError = nil
        }

        // ── Fase 2 · «Por ejercicio», Récords y peso corporal: también en paralelo ──
        async let allFetch = Self.allLogs(userId: userId)
        async let recordsFetch = Self.recordRows(userId: userId)
        async let weightsFetch = Self.weightRows(userId: userId)
        let (allLogs, recordRows, weightRows) = await (allFetch, recordsFetch, weightsFetch)
        guard !isStale(gen) else { return }

        // Si falló la red, «Por ejercicio» y «Récords» se quedaban en esqueleto para siempre.
        guard let allLogs, let recordRows else {
            if snapshot.detailsAt == nil {
                apply { shot in
                    shot.detailsError = Self.offlineMessage
                    shot.recordsError = Self.offlineMessage
                }
            }
            return
        }

        let detail = await Task.detached(priority: .utility) {
            ProgressCompute.detail(allLogs: allLogs, recordRows: recordRows, weightRows: weightRows ?? [])
        }.value
        guard !isStale(gen) else { return }

        // Una sola consulta de imágenes para el historial y los récords (antes eran dos).
        var images: [String: String] = [:]
        let imageNames = Array(Set(detail.historyNames).union(detail.recordNames))
        if !imageNames.isEmpty { images = await Self.exerciseImages(names: imageNames) }
        guard !isStale(gen) else { return }

        let records = await Task.detached(priority: .utility) {
            ProgressCompute.records(rows: recordRows, images: images)
        }.value
        guard !isStale(gen) else { return }

        apply { shot in
            shot.history = detail.history
            shot.exerciseNames = detail.exerciseNames
            shot.exerciseImages = images
            shot.records = records
            shot.bestRecord = records.max { $0.e1rm < $1.e1rm }
            shot.weights = detail.weights
            shot.detailsAt = Date()
            shot.detailsError = nil
            shot.recordsError = nil
        }

        // Con Fuerza y Récords ya publicados se prepara «Físico» en segundo plano.
        if snapshot.photosAt == nil { startPhotoPrefetch(userId: userId) }
    }

    // MARK: Publicación y caché

    /// Fotos nuevas (p. ej. después de un scan): se descarta la marca de la caché estática para que
    /// la próxima vista de «Físico» vuelva a pedirlas en vez de esperar 45 minutos.
    static func invalidatePhotoCache(userId: UUID) {
        guard var shot = cache[userId] else { return }
        shot.photosAt = nil
        shot.photosError = nil
        cache[userId] = shot
    }

    /// Un scan nuevo hecho dentro de esta misma pantalla: «Físico» se refresca solo.
    func invalidatePhotos() {
        apply { shot in
            shot.photosAt = nil
            shot.photosError = nil
        }
        if let userId = currentUserId { Task { await loadPhotos(userId: userId, force: true) } }
    }

    /// Aplica un cambio sobre la instantánea actual y la publica una sola vez.
    private func apply(_ change: (inout Snapshot) -> Void) {
        var shot = snapshot
        change(&shot)
        snapshot = shot
        Self.store(shot, for: currentUserId)
    }

    private static func store(_ snapshot: Snapshot, for userId: UUID?) {
        guard let userId else { return }
        cache[userId] = snapshot
        cacheOrder.removeAll { $0 == userId }
        cacheOrder.append(userId)
        while cacheOrder.count > cacheLimit {
            cache.removeValue(forKey: cacheOrder.removeFirst())
        }
    }

    // MARK: Consultas (red y decodificación fuera del hilo principal)

    /// Texto común de error de red. Las consultas devuelven `nil` al fallar (no `[]`): así la pantalla
    /// puede distinguir «sin conexión» de «de verdad no hay datos».
    static let offlineMessage = "Revisa tu conexión y vuelve a intentarlo. Tus datos siguen guardados."

    private nonisolated static func strengthLogs(userId: UUID, since: String) async -> [ProgressCompute.StrengthLog]? {
        let rows: [ProgressCompute.StrengthLog]? = try? await Backend.client.from("workout_logs")
            .select("exercise_name, sets_completed, logged_at")
            .eq("user_id", value: userId)
            .gte("logged_at", value: since)
            .execute().value
        return rows
    }

    private nonisolated static func allLogs(userId: UUID) async -> [ProgressCompute.AllLog]? {
        let rows: [ProgressCompute.AllLog]? = try? await Backend.client.from("workout_logs")
            .select("exercise_name, sets_completed, logged_at")
            .eq("user_id", value: userId)
            .order("logged_at", ascending: true)
            .limit(2000).execute().value
        return rows
    }

    private nonisolated static func recordRows(userId: UUID) async -> [ProgressCompute.RecordRow]? {
        let rows: [ProgressCompute.RecordRow]? = try? await Backend.client.from("personal_records")
            .select("exercise_name, weight, reps, estimated_1rm, achieved_at")
            .eq("user_id", value: userId)
            .order("estimated_1rm", ascending: false)
            .limit(50).execute().value
        return rows
    }

    private nonisolated static func weightRows(userId: UUID) async -> [ProgressCompute.WeightRow]? {
        let rows: [ProgressCompute.WeightRow]? = try? await Backend.client.from("weight_logs")
            .select("weight, logged_at")
            .eq("user_id", value: userId)
            .order("logged_at", ascending: true)
            .limit(120).execute().value
        return rows
    }

    private nonisolated static func exerciseImages(names: [String]) async -> [String: String] {
        struct Row: Decodable { let name: String; let image_url: String? }
        guard !names.isEmpty else { return [:] }
        let rows: [Row] = (try? await Backend.client.from("exercises")
            .select("name, image_url")
            .in("name", values: names)
            .execute().value) ?? []
        var images: [String: String] = [:]
        images.reserveCapacity(rows.count)
        for row in rows {
            if let url = row.image_url, images[row.name] == nil { images[row.name] = url }
        }
        return images
    }

    private nonisolated static func photoRows(userId: UUID) async -> [ProgressCompute.PhotoRow]? {
        let rows: [ProgressCompute.PhotoRow]? = try? await Backend.client.from("progress_photos")
            .select("id, photo_url, taken_at, created_at, note")
            .eq("user_id", value: userId)
            .order("taken_at", ascending: false)
            .order("created_at", ascending: false)
            .execute().value
        return rows
    }

    /// Firma las rutas de las fotos con concurrencia limitada (6 a la vez): en serie eran
    /// una ida y vuelta al servidor por cada foto.
    private nonisolated static func signedURLs(paths: [String]) async -> [String: URL] {
        guard !paths.isEmpty else { return [:] }
        let limit = 6
        var result: [String: URL] = [:]
        result.reserveCapacity(paths.count)
        await withTaskGroup(of: (String, URL?).self) { group in
            var pending = paths.makeIterator()
            for _ in 0..<min(limit, paths.count) {
                guard let path = pending.next() else { break }
                group.addTask { (path, await signedURL(path: path)) }
            }
            while let (path, url) = await group.next() {
                if let url { result[path] = url }
                if let path = pending.next() { group.addTask { (path, await signedURL(path: path)) } }
            }
        }
        return result
    }

    private nonisolated static func signedURL(path: String) async -> URL? {
        try? await Backend.client.storage.from("progress-photos").createSignedURL(path: path, expiresIn: 3600)
    }
}

// MARK: - Cálculos puros (fuera del MainActor)

/// Nada de este enum toca estado observable: se ejecuta con `Task.detached` y devuelve
/// estructuras ya listas para pintar (incluidos los textos con fecha formateada).
private enum ProgressCompute {
    // Formateadores compartidos: crear `DateFormatter` por elemento (o por semana) era una de las
    // causas de la lentitud. Son inmutables y se reutilizan en todas las cargas.
    static let ymd: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.calendar = Calendar(identifier: .gregorian)
        f.dateFormat = "yyyy-MM-dd"
        return f
    }()

    static let dayMonthStyle: Date.FormatStyle = .dateTime.day().month(.abbreviated).locale(Locale(identifier: "es_ES"))
    static let recordDateStyle: Date.FormatStyle = .dateTime.day().month(.abbreviated).year().locale(Locale(identifier: "es_ES"))
    static let monthYearStyle: Date.FormatStyle = .dateTime.month(.wide).year().locale(Locale(identifier: "es_ES"))

    // MARK: Filas de Supabase

    /// Las series se decodifican de forma tolerante: una fila con forma rara no invalida todo el lote.
    struct StrengthLog: Decodable {
        let exercise_name: String
        let sets_completed: [SetLog]?
        let logged_at: String
        enum CodingKeys: String, CodingKey { case exercise_name, sets_completed, logged_at }
        init(from decoder: Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            exercise_name = try c.decode(String.self, forKey: .exercise_name)
            logged_at = try c.decode(String.self, forKey: .logged_at)
            sets_completed = try? c.decode([SetLog].self, forKey: .sets_completed)
        }
    }

    struct AllLog: Decodable {
        let exercise_name: String
        let sets_completed: [SetLog]?
        let logged_at: String
        enum CodingKeys: String, CodingKey { case exercise_name, sets_completed, logged_at }
        init(from decoder: Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            exercise_name = try c.decode(String.self, forKey: .exercise_name)
            logged_at = try c.decode(String.self, forKey: .logged_at)
            sets_completed = try? c.decode([SetLog].self, forKey: .sets_completed)
        }
    }

    struct RecordRow: Decodable {
        let exercise_name: String
        let weight: Double?
        let reps: Int?
        let estimated_1rm: Double?
        let achieved_at: String?
    }

    struct WeightRow: Decodable { let weight: Double?; let logged_at: String? }

    struct PhotoRow: Decodable {
        let id: String
        let photo_url: String
        let taken_at: String?
        let created_at: String
        /// «Scan · frente» / «Scan · espalda»: de aquí sale el ángulo de la foto.
        let note: String?
    }

    // MARK: Resultados

    struct Strength {
        var weekly: [ProgressModel.Week] = []
        var maxWeekly: Double = 1
        var kg4w = 0
        var kgThisWeek = 0
        var workouts4w = 0
        var streakWeeks = 0
        var byExercise: [ProgressModel.ExerciseStat] = []
    }

    struct Detail {
        var history: [String: [ExerciseEntry]] = [:]
        var exerciseNames: [String] = []
        var historyNames: [String] = []
        var recordNames: [String] = []
        var weights: [ProgressModel.Weight] = []
    }

    struct Photos {
        var photos: [ProgressModel.Photo] = []
        var groups: [ProgressModel.PhotoGroup] = []
        var comparison: [ProgressModel.Photo] = []
    }

    // MARK: Utilidades

    /// Volumen de un registro: solo series hechas, sin calentamiento (como `volume` de la web).
    static func volume(_ sets: [SetLog]?) -> Double {
        var total = 0.0
        for s in sets ?? [] where s.done && s.isWarmup != true {
            let load = Double(s.weight.replacingOccurrences(of: ",", with: ".")) ?? 0
            // Un peso ilegible o no finito no debe envenenar la suma (o romper el `Int(...)` de
            // «kg levantados»): se ignora la serie.
            guard load.isFinite, load > 0, s.reps > 0 else { continue }
            total += Double(s.reps) * load
        }
        return total.isFinite ? total : 0
    }

    /// «6 oct» (sin puntos), el mismo texto de semana y de sesión que antes.
    static func dayLabel(_ date: Date) -> String {
        dayMonthStyle.format(date).replacingOccurrences(of: ".", with: "")
    }

    static func recordDate(_ raw: String) -> String {
        guard !raw.isEmpty, let date = ymd.date(from: String(raw.prefix(10))) else { return "" }
        return recordDateStyle.format(date)
    }

    // MARK: Fase 1 · Fuerza

    static func strength(logs: [StrengthLog], workouts4w: Int, thisMonday: Date) -> Strength {
        var result = Strength()

        // Se interpreta e suma el volumen una sola vez por registro: antes se hacía una vez por
        // semana (8 veces) y otra vez para «Por ejercicio».
        struct Row {
            let name: String
            let day: Date
            let dayKey: String
            let kg: Double
        }
        var rows: [Row] = []
        rows.reserveCapacity(logs.count)
        for log in logs {
            let dayKey = String(log.logged_at.prefix(10))
            guard let day = ymd.date(from: dayKey) else { continue }
            rows.append(Row(name: log.exercise_name, day: day, dayKey: dayKey, kg: volume(log.sets_completed)))
        }

        let calendar = Calendar(identifier: .iso8601)
        var weekly: [ProgressModel.Week] = []
        weekly.reserveCapacity(8)
        for i in 0..<8 {
            guard let weekStart = calendar.date(byAdding: .weekOfYear, value: i - 7, to: thisMonday),
                  let weekEnd = calendar.date(byAdding: .day, value: 7, to: weekStart) else { continue }
            var kg = 0.0
            for row in rows where row.day >= weekStart && row.day < weekEnd { kg += row.kg }
            weekly.append(ProgressModel.Week(label: dayLabel(weekStart), kg: kg))
        }
        result.weekly = weekly
        result.maxWeekly = weekly.map(\.kg).max() ?? 1
        result.kg4w = Int(weekly.suffix(4).reduce(0) { $0 + $1.kg })
        result.kgThisWeek = Int(weekly.last?.kg ?? 0)
        var streak = 0
        for week in weekly.reversed() { if week.kg > 0 { streak += 1 } else { break } }
        result.streakWeeks = streak
        result.workouts4w = workouts4w

        // Sesiones y mejor volumen por ejercicio (mismo criterio que la web).
        var stats: [String: (days: Set<String>, best: Double)] = [:]
        for row in rows where row.kg > 0 {
            var entry = stats[row.name] ?? (days: [], best: 0)
            entry.days.insert(row.dayKey)
            entry.best = max(entry.best, row.kg)
            stats[row.name] = entry
        }
        result.byExercise = stats
            .map { ProgressModel.ExerciseStat(name: $0.key, sessions: $0.value.days.count, bestVolume: $0.value.best) }
            .sorted { $0.bestVolume > $1.bestVolume }
        return result
    }

    // MARK: Fase 2 · Historial, récords y peso

    static func detail(allLogs: [AllLog], recordRows: [RecordRow], weightRows: [WeightRow]) -> Detail {
        var result = Detail()

        // Historial por ejercicio como `buildExerciseHistory` de la web: una entrada por día.
        var byDay: [String: [String: ExerciseEntry]] = [:]
        for log in allLogs {
            let dayKey = String(log.logged_at.prefix(10))
            guard let date = ymd.date(from: dayKey) else { continue }
            let sets = (log.sets_completed ?? []).filter { $0.done && $0.isWarmup != true && $0.reps > 0 }
            guard !sets.isEmpty else { continue }
            let weighted = sets.compactMap { set -> (Double, Int)? in
                guard let kg = Double(set.weight.replacingOccurrences(of: ",", with: ".")), kg.isFinite, kg > 0 else { return nil }
                return (kg, set.reps)
            }
            let e1rm = weighted.map { $0.0 * (1 + Double($0.1) / 30) }.max().map { ($0 * 10).rounded() / 10 }
            var entry = byDay[log.exercise_name]?[dayKey]
                ?? ExerciseEntry(date: date, label: dayLabel(date), volumeKg: 0, reps: 0, loadedSets: 0, best1Rm: nil)
            entry.volumeKg += weighted.reduce(0) { $0 + $1.0 * Double($1.1) }
            entry.reps += sets.reduce(0) { $0 + $1.reps }
            entry.loadedSets += weighted.count
            if let value = e1rm, value > (entry.best1Rm ?? 0) { entry.best1Rm = value }
            byDay[log.exercise_name, default: [:]][dayKey] = entry
        }
        result.history = byDay.mapValues { $0.values.sorted { $0.date < $1.date } }
        result.historyNames = Array(result.history.keys)
        // Orden del menú «Por ejercicio»: más sesiones primero y, a igualdad, por nombre.
        result.exerciseNames = result.history.keys.sorted {
            (result.history[$0]?.count ?? 0, $1) > (result.history[$1]?.count ?? 0, $0)
        }

        // Nombres de récords: el mejor de cada ejercicio, en el orden del servidor.
        var seen = Set<String>()
        result.recordNames = recordRows.filter { seen.insert($0.exercise_name).inserted }.map(\.exercise_name)

        // Peso corporal: misma consulta en paralelo, sin alargar la primera fase.
        result.weights = weightRows.compactMap { row in
            guard let kg = row.weight,
                  let date = ymd.date(from: String((row.logged_at ?? "").prefix(10))) else { return nil }
            return ProgressModel.Weight(date: date, kg: kg)
        }
        return result
    }

    static func records(rows: [RecordRow], images: [String: String]) -> [ProgressModel.Record] {
        var seen = Set<String>()
        let best = rows.filter { seen.insert($0.exercise_name).inserted }
        return best.compactMap { row in
            guard let weight = row.weight else { return nil }
            let reps = row.reps ?? 1
            let e1rm = row.estimated_1rm ?? weight * (1 + Double(reps) / 30)
            return ProgressModel.Record(
                name: row.exercise_name,
                weight: weight,
                reps: reps,
                e1rm: e1rm,
                dateText: recordDate(row.achieved_at ?? ""),
                weightText: Progression.kgText(weight),
                e1rmText: Progression.kgText(e1rm),
                image: images[row.exercise_name])
        }
    }

    // MARK: Fase 3 · Fotos

    static func photos(rows: [PhotoRow], signed: [String: URL]) -> Photos {
        var result = Photos()
        result.photos.reserveCapacity(rows.count)
        for row in rows {
            let takenAt = row.taken_at ?? row.created_at
            let date = ymd.date(from: String(takenAt.prefix(10)))
            let url = row.photo_url.hasPrefix("http") ? URL(string: row.photo_url) : signed[row.photo_url]
            result.photos.append(ProgressModel.Photo(
                id: row.id,
                url: url,
                takenAt: takenAt,
                date: date,
                angle: angle(row.note),
                month: date.map { monthYearStyle.format($0).progressCapitalizedFirst } ?? "",
                shortDate: date.map { dayMonthStyle.format($0).replacingOccurrences(of: ".", with: "") } ?? ""))
        }
        // Agrupación por mes en el mismo orden de llegada (la vista ya no filtra en cada redibujado).
        var index: [String: Int] = [:]
        for photo in result.photos {
            if let position = index[photo.month] {
                result.groups[position].photos.append(photo)
            } else {
                index[photo.month] = result.groups.count
                result.groups.append(ProgressModel.PhotoGroup(month: photo.month, photos: [photo]))
            }
        }
        // «Antes/Después» con el mismo ángulo (igual que `ProgressPhotos.tsx`): con dos de frente se
        // comparan esas; si no, dos de espalda. Mezclar ángulos no muestra progreso real.
        let fronts = result.photos.filter { $0.angle == "front" }
        let backs = result.photos.filter { $0.angle == "back" }
        result.comparison = fronts.count >= 2 ? fronts : (backs.count >= 2 ? backs : [])
        return result
    }

    /// Ángulo según `note` (mismo criterio que la web: espalda/dorsal/back y frente/pecho/front).
    static func angle(_ note: String?) -> String? {
        let text = (note ?? "").lowercased()
        if text.contains("espalda") || text.contains("dorsal") || text.contains("back") { return "back" }
        if text.contains("frente") || text.contains("pecho") || text.contains("front") { return "front" }
        return nil
    }
}

// MARK: - Gráfica «Por ejercicio»

struct ExerciseEntry: Hashable { let date: Date; let label: String; var volumeKg: Double; var reps: Int; var loadedSets: Int; var best1Rm: Double? }

/// «Por ejercicio» de `WorkoutProgress.tsx` + `ExerciseProgressChart.tsx`: portada con la foto del ejercicio
/// (tocable para cambiar) y la gráfica con 1RM / Volumen / Reps.
struct ExerciseProgressSection: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    let history: [String: [ExerciseEntry]]
    let images: [String: String]
    /// Nombres ya ordenados por el modelo (fuera del hilo principal): la vista no reordena en cada dibujado.
    let names: [String]
    @State private var selected = ""
    @State private var metric = 0

    private func value(_ e: ExerciseEntry) -> Double? {
        switch metric { case 1: e.loadedSets > 0 ? e.volumeKg.rounded() : nil; case 2: Double(e.reps); default: e.best1Rm }
    }
    private func r(_ v: Double) -> String { NumberText.decimal(v, digits: (v * 10).rounded().truncatingRemainder(dividingBy: 10) == 0 ? 0 : 1) }

    var body: some View {
        // Si el ejercicio elegido desaparece de los datos (borrado, otra cuenta…), no se queda
        // seleccionado uno que ya no existe: se cae al primero de la lista.
        let name = names.contains(selected) ? selected : (names.first ?? "")
        let entries = history[name] ?? []
        VStack(alignment: .leading, spacing: 12) {
            Menu {
                Picker("Ejercicio", selection: Binding(get: { name }, set: { Haptics.selection(); selected = $0 })) {
                    ForEach(names, id: \.self) { n in Text("\(n) · \(history[n]?.count ?? 0) \(history[n]?.count == 1 ? "sesión" : "sesiones")").tag(n) }
                }
            } label: { cover(name, count: entries.count) }
            .menuStyle(.button).buttonStyle(.plain)
            chart(name, entries).padding(16)
                .background(Palette.card, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        }
    }

    private func cover(_ name: String, count: Int) -> some View {
        let img = images[name].flatMap(URL.init(string:))
        return HStack(alignment: .bottom, spacing: 8) {
            VStack(alignment: .leading, spacing: 2) {
                Text("\(count) \(count == 1 ? "sesión" : "sesiones")").font(.apFootnote.weight(.semibold)).foregroundStyle(Palette.gold)
                Text(name).font(.inter(size: 26, weight: .bold)).foregroundStyle(.white).multilineTextAlignment(.leading)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            Image(systemName: "chevron.up.chevron.down").font(.inter(size: 16, weight: .semibold)).foregroundStyle(.white.opacity(0.7)).padding(.bottom, 4)
        }
        .padding(20)
        .frame(maxWidth: .infinity, minHeight: img == nil ? 0 : 176, alignment: .bottomLeading)
        .background {
            if let img {
                Color.clear.overlay {
                    RemoteThumb(url: img, maxSide: 360) { Palette.card }
                }
                .overlay { LinearGradient(colors: [.black.opacity(0.85), .black.opacity(0.3), .clear], startPoint: .bottom, endPoint: .top) }
                .clipped()
            } else { Palette.card }
        }
        .clipShape(RoundedRectangle(cornerRadius: 28, style: .continuous))
        .contentShape(Rectangle())
    }

    @ViewBuilder private func chart(_ name: String, _ history: [ExerciseEntry]) -> some View {
        let data = Array(history.suffix(16))
        let values = data.compactMap(value)
        let latest = history.last.flatMap(value)
        let first = values.first
        let best = values.max()
        let change = (latest != nil && (first ?? 0) > 0) ? (latest! - first!) / first! * 100 : nil
        let unit = metric == 2 ? "reps" : "kg"
        let hasLine = values.count > 1
        let sessions = "\(history.count) \(history.count == 1 ? "sesión" : "sesiones")"
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .firstTextBaseline, spacing: 12) {
                VStack(alignment: .leading, spacing: 6) {
                    (Text(latest.map(r) ?? "—").font(.inter(size: 32, weight: .bold).monospacedDigit()) + Text(" \(unit)").font(.apSubhead).foregroundColor(Palette.muted))
                        .lineLimit(1).minimumScaleFactor(0.7)
                        .contentTransition(.numericText())
                        .animation(reduceMotion ? nil : .snappy, value: metric)
                    HStack(spacing: 0) {
                        if hasLine, let change {
                            Text("\(change > 0 ? "+" : "")\(r(change))%").fontWeight(.medium).foregroundStyle(change >= 0 ? Palette.success : Palette.foreground)
                            Text(" · ")
                        }
                        if hasLine, let best { Text("\(r(best)) \(unit) · ") }
                        Text(sessions)
                    }
                    .font(.apFootnote.monospacedDigit()).foregroundStyle(Palette.muted)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                HStack(spacing: 0) {
                    ForEach(Array(["1RM", "Volumen", "Reps"].enumerated()), id: \.offset) { i, l in
                        Button {
                            Haptics.selection()
                            withAnimation(reduceMotion ? nil : .snappy) { metric = i }
                        } label: {
                            Text(l).font(.apFootnote.weight(i == metric ? .semibold : .medium))
                                .padding(.horizontal, 10)
                                // 44 pt de alto mínimo: el selector se toca cómodo con el pulgar.
                                .frame(minWidth: 44, minHeight: 44)
                                .background { if i == metric { RoundedRectangle(cornerRadius: 7, style: .continuous).fill(Palette.accent) } }
                                .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("Ver \(l)")
                        .accessibilityAddTraits(i == metric ? .isSelected : [])
                    }
                }
                .padding(3).background(Palette.secondary, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
            }
            if hasLine {
                let lo = values.min() ?? 0, pad = max(1, ((best ?? 0) - lo) * 0.15)
                Chart(Array(data.enumerated()), id: \.offset) { i, e in
                    if let v = value(e) {
                        AreaMark(x: .value("Sesión", i), yStart: .value("Base", lo - pad), yEnd: .value(unit, v))
                            .foregroundStyle(LinearGradient(colors: [Palette.gold.opacity(0.35), Palette.gold.opacity(0)], startPoint: .top, endPoint: .bottom))
                            .interpolationMethod(.monotone)
                        LineMark(x: .value("Sesión", i), y: .value(unit, v))
                            .foregroundStyle(Palette.gold).lineStyle(StrokeStyle(lineWidth: 2.5)).interpolationMethod(.monotone)
                    }
                }
                .chartYScale(domain: (lo - pad)...((best ?? 1) + pad))
                .chartXAxis {
                    AxisMarks(values: [0, data.count - 1]) { v in
                        AxisValueLabel { if let i = v.as(Int.self), data.indices.contains(i) { Text(data[i].label) } }
                            .font(.inter(.caption)).foregroundStyle(Palette.muted)
                    }
                }
                .chartYAxis { AxisMarks(position: .trailing) { _ in AxisGridLine().foregroundStyle(Palette.foreground.opacity(0.07)); AxisValueLabel().font(.inter(.caption)).foregroundStyle(Palette.muted) } }
                .frame(height: 256)
                .accessibilityLabel("Gráfica de \(name)")
                .accessibilityValue(latest.map { "Último: \(r($0)) \(unit) en \(sessions)" } ?? "Sin datos")
            } else if values.isEmpty && !history.isEmpty && metric != 2 {
                VStack(spacing: 6) {
                    Image(systemName: "dumbbell").font(.inter(size: 24)).foregroundStyle(Palette.muted)
                    Text("Sin carga registrada").font(.apHeadline)
                    Text("El 1RM y el volumen salen de las series con peso. En Reps ves tu evolución.").font(.apSubhead).foregroundStyle(Palette.muted).multilineTextAlignment(.center)
                }
                .frame(maxWidth: .infinity).padding(.vertical, 24)
            } else {
                VStack(alignment: .leading, spacing: 12) {
                    Canvas { ctx, size in
                        let sx = size.width / 300, sy = size.height / 120
                        for y in [30.0, 60, 90] { var p = Path(); p.move(to: CGPoint(x: 0, y: y * sy)); p.addLine(to: CGPoint(x: size.width, y: y * sy)); ctx.stroke(p, with: .color(.white.opacity(0.07)), lineWidth: 1) }
                        var c = Path(); c.move(to: CGPoint(x: 40 * sx, y: 80 * sy))
                        c.addCurve(to: CGPoint(x: 260 * sx, y: 34 * sy), control1: CGPoint(x: 110 * sx, y: 76 * sy), control2: CGPoint(x: 170 * sx, y: 58 * sy))
                        ctx.stroke(c, with: .color(Palette.gold.opacity(0.35)), style: StrokeStyle(lineWidth: 2.5, lineCap: .round, dash: [2, 7]))
                        let p0 = CGPoint(x: 40 * sx, y: 80 * sy)
                        ctx.fill(Path(ellipseIn: CGRect(x: p0.x - 11, y: p0.y - 11, width: 22, height: 22)), with: .color(Palette.gold.opacity(0.2)))
                        ctx.fill(Path(ellipseIn: CGRect(x: p0.x - 6, y: p0.y - 6, width: 12, height: 12)), with: .color(Palette.gold))
                        let p1 = CGPoint(x: 260 * sx, y: 34 * sy)
                        ctx.stroke(Path(ellipseIn: CGRect(x: p1.x - 6, y: p1.y - 6, width: 12, height: 12)), with: .color(Palette.gold.opacity(0.4)), style: StrokeStyle(lineWidth: 2, dash: [3, 3]))
                    }
                    .frame(height: 140).accessibilityHidden(true)
                    let start = (data.first { value($0) != nil } ?? history.last)?.label
                    Text(start.map { "Punto de partida · \($0)" } ?? "Punto de partida").font(.apHeadline)
                    Text(history.count < 2 ? "Registra otra sesión de este ejercicio y aquí verás tu línea de progreso." : "Registra otra sesión con peso y aquí verás tu línea de progreso.")
                        .font(.apSubhead).foregroundStyle(Palette.muted)
                }
            }
        }
    }
}

// MARK: - Esqueletos de carga

/// Ancho del contenido de Progreso: decide entre la disposición de iPhone y la rejilla de escritorio.
private struct ProgressContentWidthKey: PreferenceKey {
    static var defaultValue: CGFloat = 0
    static func reduce(value: inout CGFloat, nextValue: () -> CGFloat) { value = nextValue() }
}

/// Error de red con reintento: mismo patrón que el resto de la app (tarjeta + «Reintentar» en píldora).
/// Sin esto, un fallo de conexión dejaba un esqueleto eterno (o ceros que parecían datos reales).
private struct ProgressRetryCard: View {
    let title: String
    let message: String
    let retry: () -> Void

    var body: some View {
        Card(padding: 20) {
            HStack(spacing: 10) {
                Image(systemName: "wifi.exclamationmark").font(.inter(size: 20)).foregroundStyle(Palette.gold)
                    .accessibilityHidden(true)
                Text(title).font(.apTitle3).accessibilityAddTraits(.isHeader)
            }
            Text(message).font(.apSubhead).foregroundStyle(Palette.muted).fixedSize(horizontal: false, vertical: true)
            Button(action: retry) { Text("Reintentar") }
                .buttonStyle(.pill)
                .padding(.top, 6)
                .accessibilityHint("Vuelve a pedir tus datos de progreso")
        }
    }
}

/// Un solo pulso de opacidad por esqueleto (una animación barata, no una por bloque) y respeto
/// por «Reducir movimiento».
private struct ProgressSkeletonPulse<Content: View>: View {
    @ViewBuilder var content: Content
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var dimmed = false

    var body: some View {
        content
            .opacity(dimmed ? 0.55 : 1)
            .animation(reduceMotion ? nil : .easeInOut(duration: 0.9).repeatForever(autoreverses: true), value: dimmed)
            .onAppear { if !reduceMotion { dimmed = true } }
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("Cargando progreso")
    }
}

private struct ProgressSkeletonBlock: View {
    var height: CGFloat
    var radius: CGFloat = 12
    var width: CGFloat?

    var body: some View {
        RoundedRectangle(cornerRadius: radius, style: .continuous)
            .fill(Palette.secondary)
            .frame(width: width, height: height)
    }
}

private extension String {
    /// Primera letra en mayúscula (los meses en español vienen en minúscula).
    var progressCapitalizedFirst: String { prefix(1).uppercased() + dropFirst() }
}

// MARK: - Miniaturas de Progreso

/// Lado máximo (pt) de las miniaturas de la rejilla de fotos; la caché decodifica a `×3` píxeles.
private let photoThumbSide: CGFloat = 200

/// Miniatura de ejercicio de la lista de récords: misma apariencia que `ExerciseThumb` (44 pt),
/// pero decodificando a tamaño de miniatura.
private struct ProgressRecordThumb: View {
    let url: String?
    var size: CGFloat = 44

    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 12, style: .continuous).fill(Palette.secondary)
            if let u = url.flatMap(URL.init(string:)) {
                RemoteThumb(url: u, maxSide: 140) { Color.clear }
            } else {
                Image(systemName: "dumbbell").foregroundStyle(Palette.muted)
            }
        }
        .frame(width: size, height: size)
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
    }
}

