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
    /// Para «Ir a entrenar» desde Récords vacío (como `onNavigate` de Inicio).
    var onNavigate: (AppSection) -> Void = { _ in }
    @State private var tab = 0
    @State private var viewing: ProgressModel.Photo?
    /// «Scan» se monta la primera vez que se abre y se queda vivo: cambiar de pestaña no lo reinicia.
    @State private var scanMounted = false
    /// Ancho del contenido, medido con una preferencia (un `GeometryReader` envolviendo el scroll
    /// rompería el tamaño del contenido).


    // MARK: Disposición responsive (iPhone igual que siempre · iPad/Mac a todo el ancho)

    /// Escritorio (iPad horizontal/Mac): la web ocupa todo el ancho (`<main>` sin `max-w`).
    /// En iPhone (ancho compacto) siempre es `false`: la disposición actual queda intacta.
    private var isWide: Bool {
        sizeClass != .compact
    }

    /// En Mac el lienzo y su padding los pone `SectionView` (web: `<main>` con `lg:p-10`); así no
    /// se suma dos veces. En iPad el lienzo es de la propia pantalla, como antes.
    private var horizontalPadding: CGFloat {
        #if os(macOS)
        return 0
        #else
        return isWide ? 32 : 16
        #endif
    }

    /// Rejilla de fotos como la web: 3 columnas en iPhone, 4 en `md` y 6 en `lg`.
    private var photoColumns: [GridItem] {
        let count = isWide ? 4 : 3
        return Array(repeating: GridItem(.flexible(), spacing: 8), count: count)
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                // Subtítulo de la maqueta bajo el título grande; en Mac la barra ya lleva su pista.
                if !isWide {
                    Text("Evolución de tu fuerza, tu físico y tus récords.").font(.apSubhead).foregroundStyle(Palette.muted)
                }
                SegmentedPill(options: ["Fuerza", "Físico", "Récords", "Scan"], selection: $tab, gold: true)
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
            .padding(.horizontal, horizontalPadding).padding(.top, 8).padding(.bottom, isWide ? 16 : 96)
            .frame(maxWidth: .infinity)
        }
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
        VStack(alignment: .leading, spacing: 16) {
            strengthExercises
            if model.strengthLoaded && !(model.detailsLoaded && model.history.isEmpty) {
                Text("Tu constancia").font(.apTitle2).padding(.top, 8)
            }
            strengthHero
        }
    }

    /// Tarjeta del hero (cifras + barras), su esqueleto o el aviso de error.
    @ViewBuilder private var strengthHero: some View {
        if model.strengthLoaded {
            // Sin ningún entreno no se pinta «0 kg levantados» (desanima): solo la invitación de abajo, como la web.
            if !(model.detailsLoaded && model.history.isEmpty) { strengthCard }
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
                VStack(alignment: .leading, spacing: 4) {
                    Text("Tu fuerza").font(.apTitle2)
                    Text("Evolución de tus principales ejercicios.")
                        .font(.apSubhead).foregroundStyle(Palette.muted)
                }
                ExerciseProgressSection(history: model.history, images: model.exerciseImages, names: model.exerciseNames)
            } else {
                // Cuenta recién creada: portada con foto real y el camino a Entrenar.
                progressHero(photo: Self.brandPullupPhoto, eyebrow: "TU FUERZA", title: "Empieza a documentar tu progreso",
                             message: "Registra tus entrenamientos y observa cómo evoluciona tu fuerza con el tiempo.",
                             perks: Self.strengthPerks, button: "Registrar tu primer entrenamiento") { onNavigate(.home) }
            }
        } else if let error = model.detailsError {
            ProgressRetryCard(title: "No hemos podido cargar «Por ejercicio»", message: error) {
                Task { await model.load(userId: session.userId, force: true) }
            }
        } else {
            exerciseSkeleton
        }
    }

    /// Semanas con etiqueta: una sí y otra no, terminando en la actual (a 12 pt no se pisan, como la web).
    private var shownWeekLabels: Set<String> {
        Set(model.weekly.enumerated().filter { (model.weekly.count - 1 - $0.offset) % 2 == 0 }.map(\.element.label))
    }

    private var strengthCard: some View {
        let hasKg = model.kg4w > 0
        return VStack(alignment: .leading, spacing: 0) {
            // Eyebrow dorado
            Text("ÚLTIMAS 4 SEMANAS")
                .font(.apCaption.weight(.semibold))
                .tracking(1.6)
                .foregroundStyle(Palette.gold)

            // Cifra protagonista. Sin series con peso, «0 kg» desanimaba: se cuentan los entrenos.
            HStack(alignment: .firstTextBaseline, spacing: 6) {
                Text(hasKg ? NumberText.integer(model.kg4w) : "\(model.workouts4w)")
                    .font(.figure(size: 52))
                    .lineLimit(1).minimumScaleFactor(0.55)
                    .contentTransition(.numericText())
                    .animation(reduceMotion ? nil : .snappy, value: model.kg4w)
                Text(hasKg ? "kg levantados" : (model.workouts4w == 1 ? "entreno" : "entrenos"))
                    .font(.apTitle3)
                    .foregroundStyle(Palette.muted)
            }
            .padding(.top, 6)

            // 3 KPIs en fila
            HStack(alignment: .top, spacing: 12) {
                if hasKg { stat("\(model.workouts4w)", model.workouts4w == 1 ? "entreno" : "entrenos") }
                stat("\(model.streakWeeks)", model.streakWeeks == 1 ? "semana de racha" : "semanas de racha")
                if hasKg { stat(NumberText.integer(model.kgThisWeek), "kg esta semana") }
            }
            .padding(.top, 14)

            if !hasKg {
                Text("Registra series con peso y aquí verás tus kilos de cada semana.")
                    .font(.apSubhead).foregroundStyle(Palette.muted)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.top, 16)
            } else {

            // Gráfica de barras
            // Barras finas como la web: la semana actual en dorado y el resto en gris.
            Chart(model.weekly, id: \.label) { w in
                BarMark(
                    x: .value("Semana", w.label),
                    y: .value("kg", max(w.kg, model.maxWeekly * 0.02)),
                    width: .fixed(14)
                )
                .foregroundStyle(w.label == model.weekly.last?.label ? Palette.gold : Color.white.opacity(0.14))
                .cornerRadius(3)
            }
            .chartYAxis(.hidden)
            .chartXAxis {
                // Una fecha sí y otra no, terminando en la semana actual: a 12 pt no se pisan (como la web).
                AxisMarks { value in
                    if let label = value.as(String.self), shownWeekLabels.contains(label) {
                        AxisValueLabel { Text(label).font(.apCaption).foregroundStyle(Palette.muted) }
                    }
                }
            }
            .frame(height: 160)
            .padding(.top, 20)
            .accessibilityLabel("Kilos levantados por semana")
            }
        }
        .padding(20)
        .frame(maxWidth: .infinity, alignment: .leading)
        // Sobria como la web: sin halo dorado y con el mismo filo blanco que el resto de tarjetas.
        .background(Palette.card)
        .clipShape(RoundedRectangle(cornerRadius: Radius.hero, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radius.hero, style: .continuous)
                .strokeBorder(Palette.foreground.opacity(0.08), lineWidth: 1)
        )
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
                // Escritorio: comparación a todo el ancho y rejilla de fotos debajo.
                VStack(alignment: .leading, spacing: 24) {
                    comparisonBlock.frame(maxWidth: .infinity, alignment: .leading)
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
            ProgressPhotoViewer(photo: p) { viewing = nil }
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

    /// Sin fotos: portada con foto real y lo que tendrá aquí (como `ProgressPhotos` de la web).
    private var photosEmpty: some View {
        progressHero(photo: Self.brandGymPhoto, eyebrow: "TU FÍSICO", title: "Empieza a documentar tu progreso",
                     message: "Tus fotos se guardan solas cada vez que haces un análisis físico en Scan.",
                     perks: Self.physiquePerks, button: "Hacer mi primer scan") { tab = 3 }
    }

    /// Sin récords: portada con foto real y el camino a Entrenar.
    private var recordsEmpty: some View {
        recordsHeroEmpty
    }

    /// Portada de Récords vacío: foto real, eyebrow trofeo, título y perks con texto enriquecido.
    private var recordsHeroEmpty: some View {
        VStack(alignment: .leading, spacing: 0) {
            Color.clear.frame(height: 208)
                .overlay {
                    CachedAsyncImage(url: URL(string: Self.brandPullupPhoto)) { $0.resizable().scaledToFill() } placeholder: { Palette.secondary }
                }
                .clipped()
                .overlay { LinearGradient(colors: [.black.opacity(0.1), .black.opacity(0.45), Palette.card], startPoint: .top, endPoint: .bottom) }
                .overlay(alignment: .bottomLeading) {
                    VStack(alignment: .leading, spacing: 4) {
                        Label("TUS RÉCORDS", systemImage: "trophy")
                            .font(.apCaption.weight(.semibold)).tracking(1.6).foregroundStyle(Palette.gold)
                        Text("Empieza a conseguir\ntus primeras marcas")
                            .font(.inter(size: 26, weight: .bold)).foregroundStyle(.white)
                            .fixedSize(horizontal: false, vertical: true)
                            .accessibilityAddTraits(.isHeader)
                    }
                    .padding(.horizontal, 20).padding(.bottom, 12)
                }
            VStack(alignment: .leading, spacing: 12) {
                Text("Registra tus mejores resultados y sigue tu evolución en cada ejercicio.")
                    .font(.apSubhead).foregroundStyle(Palette.muted)
                    .fixedSize(horizontal: false, vertical: true)
                // Perk 1
                Label {
                    Text("Tu 1RM estimado").font(.apSubhead)
                } icon: {
                    Image(systemName: "arrow.up.right").foregroundStyle(Palette.gold)
                }
                // Perk 2
                Label {
                    (Text("Nuevas marcas y ") + Text("progresión").bold()).font(.apSubhead)
                } icon: {
                    Image(systemName: "chart.bar.fill").foregroundStyle(Palette.gold)
                }
                // Perk 3
                Label {
                    (Text("Récords personales ") + Text("por ejercicio").bold()).font(.apSubhead)
                } icon: {
                    Image(systemName: "trophy").foregroundStyle(Palette.gold)
                }
                Button("Registrar mi primer récord") { Haptics.tap(); onNavigate(.home) }
                    .buttonStyle(.pill).padding(.top, 8)
            }
            .padding(.horizontal, 20).padding(.top, 8).padding(.bottom, 20)
        }
        .background(Palette.card)
        .clipShape(RoundedRectangle(cornerRadius: Radius.hero, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: Radius.hero, style: .continuous).strokeBorder(Palette.gold.opacity(0.15), lineWidth: 1))
    }

    /// Portada de una sección vacía de Progreso: foto real, titular, lo que tendrá aquí (todo real) y una acción.
    private func progressHero(photo: String, eyebrow: String, title: String, message: String, perks: [Perk], button: String, action: @escaping () -> Void) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            Color.clear.frame(height: 208)
                .overlay {
                    CachedAsyncImage(url: URL(string: photo)) { $0.resizable().scaledToFill() } placeholder: { Palette.secondary }
                }
                .clipped()
                .overlay { LinearGradient(colors: [.black.opacity(0.1), .black.opacity(0.45), Palette.card], startPoint: .top, endPoint: .bottom) }
                .overlay(alignment: .bottomLeading) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(eyebrow).font(.apCaption.weight(.semibold)).tracking(1.6).foregroundStyle(Palette.gold)
                        Text(title).font(.inter(size: 26, weight: .bold)).foregroundStyle(.white)
                            .fixedSize(horizontal: false, vertical: true)
                            .accessibilityAddTraits(.isHeader)
                    }
                    .padding(.horizontal, 20).padding(.bottom, 12)
                }
            VStack(alignment: .leading, spacing: 12) {
                Text(message).font(.apSubhead).foregroundStyle(Palette.muted)
                    .fixedSize(horizontal: false, vertical: true)
                ForEach(perks, id: \.self) { perk in
                    Label {
                        Text(perk.text).font(.apSubhead)
                    } icon: {
                        Image(systemName: perk.symbol).foregroundStyle(Palette.gold)
                    }
                }
                Button(button) { Haptics.tap(); action() }
                    .buttonStyle(.pill).padding(.top, 8)
            }
            .padding(.horizontal, 20).padding(.top, 8).padding(.bottom, 20)
        }
        .background(Palette.card)
        .clipShape(RoundedRectangle(cornerRadius: Radius.hero, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: Radius.hero, style: .continuous).strokeBorder(Palette.gold.opacity(0.15), lineWidth: 1))
    }

    private static let brandGymPhoto = "https://enebrcdrdnfkyduzyrzm.supabase.co/storage/v1/object/public/site-assets/exercise-images/a31c7206-d2a4-4b31-856a-f5dec09b890e-1791475829849.png"
    private static let brandPullupPhoto = "https://enebrcdrdnfkyduzyrzm.supabase.co/storage/v1/object/public/site-assets/exercise-images/7ab0b27f-f296-4fa6-bf07-8f8b026b0832-1791475152675.png"
    private static let brandDumbbellsPhoto = "https://enebrcdrdnfkyduzyrzm.supabase.co/storage/v1/object/public/site-assets/exercise-images/d5e30e05-0791-4886-84a0-7b2695728225-1791475865184.png"
    /// Lo que guarda Físico: comparación del mismo ángulo, fotos por mes y fotos privadas.
    private struct Perk: Hashable { let symbol: String; let text: String }
    private static let physiquePerks = [
        Perk(symbol: "rectangle.split.2x1", text: "El antes y el ahora, lado a lado"),
        Perk(symbol: "calendar", text: "Tus fotos ordenadas por mes"),
        Perk(symbol: "lock", text: "Privadas: solo las ves tú"),
    ]
    /// Lo que tendrá Fuerza: evolución de marcas, volumen y objetivos por ejercicio.
    private static let strengthPerks = [
        Perk(symbol: "chart.bar.fill", text: "Evolución de tus marcas"),
        Perk(symbol: "arrow.up.and.down", text: "Volumen y repeticiones"),
        Perk(symbol: "scope", text: "Objetivos por ejercicio"),
    ]
    /// Lo que guarda Récords: la mejor marca de cada ejercicio, los nuevos del mes y su fecha.
    private static let recordPerks = [
        Perk(symbol: "trophy", text: "Tu mejor marca de cada ejercicio"),
        Perk(symbol: "sparkles", text: "Los récords nuevos de cada mes"),
        Perk(symbol: "calendar", text: "El día en que rompiste cada uno"),
    ]

    /// Aún sin pareja del mismo ángulo: su último scan en grande (foto real) y cómo conseguir la comparación.
    @ViewBuilder private var compareTeaser: some View {
        if let latest = model.photos.first {
            HStack(alignment: .top, spacing: 16) {
                Button { viewing = latest } label: {
                    Color.clear.frame(width: 112, height: 150)
                        .overlay { RemoteThumb(url: latest.url) { Palette.secondary } }
                        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Ver tu último scan, del \(latest.shortDate)")
                VStack(alignment: .leading, spacing: 0) {
                    Text("TU ÚLTIMO SCAN").font(.apCaption.weight(.semibold)).tracking(1.6).foregroundStyle(Palette.gold)
                    Text(latest.longDate.isEmpty ? "Sin fecha" : latest.longDate).font(.apFootnote.monospacedDigit()).foregroundStyle(Palette.muted).padding(.top, 4)
                    Text("Compara tu evolución").font(.apHeadline).padding(.top, 12)
                    Text("Con otro scan del mismo ángulo verás el antes y el ahora, lado a lado.").font(.apSubhead).foregroundStyle(Palette.muted)
                        .fixedSize(horizontal: false, vertical: true).padding(.top, 4)
                    Button("Hacer un scan") { Haptics.tap(); tab = 3 }
                        .buttonStyle(.pillSecondary).padding(.top, 14)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Palette.card, in: RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: Radius.card, style: .continuous).strokeBorder(Palette.foreground.opacity(0.08), lineWidth: 1))
        }
    }

    private func photoTile(_ p: ProgressModel.Photo, label: String) -> some View {
        Color.clear.aspectRatio(3/4, contentMode: .fit)
            .overlay { RemoteThumb(url: p.url) { Palette.secondary } }
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
            .overlay(alignment: .bottomLeading) {
                // Sin fecha legible no se pinta una píldora vacía.
                if !label.isEmpty {
                    Text(label).font(.apCaption.weight(.medium).monospacedDigit()).foregroundStyle(.white)
                        .padding(.horizontal, 8).padding(.vertical, 2).background(.black.opacity(0.55), in: Capsule()).padding(8)
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
                recordsEmpty
            } else if let best = model.bestRecord {
                if isWide {
                    // Escritorio como la web (`lg:grid-cols-[280px_1fr]`): la mejor marca fija a
                    // 280 pt y la lista ocupando el resto del ancho.
                    // Escritorio: la mejor marca a todo el ancho arriba y la lista debajo.
                    VStack(alignment: .leading, spacing: 24) {
                        recordsHero(best).frame(maxWidth: .infinity)
                        recordsStats
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
                        recordsStats
                        recordsHeader
                        recordsTable
                    }
                }
            }
        }
    }

    /// Tarjeta grande «Tu mejor marca» — foto a sangre, cifra 64pt, borde dorado.
    private func recordsHero(_ best: ProgressModel.Record) -> some View {
        ZStack(alignment: .bottomLeading) {
            // Foto a sangre
            Color.clear.frame(maxWidth: .infinity).frame(height: 260)
                .overlay {
                    CachedAsyncImage(url: best.image.flatMap(URL.init(string:))) {
                        $0.resizable().scaledToFill()
                    } placeholder: { Palette.card }
                }
                .clipped()

            // Degradados doble
            LinearGradient(
                colors: [.black.opacity(0.1), .clear],
                startPoint: .top, endPoint: .init(x: 0.5, y: 0.4)
            )
            LinearGradient(
                colors: [.clear, .black.opacity(0.92)],
                startPoint: .init(x: 0.5, y: 0.35), endPoint: .bottom
            )

            // Halo dorado
            RadialGradient(
                colors: [Palette.gold.opacity(0.1), .clear],
                center: .bottomLeading, startRadius: 0, endRadius: 200
            )
            .accessibilityHidden(true)

            // Contenido
            VStack(alignment: .leading, spacing: 5) {
                Label("Tu mejor marca", systemImage: "trophy")
                    .font(.apSubhead.weight(.semibold))
                    .foregroundStyle(Palette.gold)

                HStack(alignment: .firstTextBaseline, spacing: 5) {
                    Text(best.e1rmText)
                        .font(.figure(size: 64))
                        .lineLimit(1).minimumScaleFactor(0.5)
                        .allowsTightening(true)
                        .contentTransition(.numericText())
                    Text("kg")
                        .font(.apTitle3)
                        .foregroundStyle(.white.opacity(0.65))
                }

                Text("1RM estimado en \(best.name)")
                    .font(.apSubhead)
                    .foregroundStyle(.white.opacity(0.7))
                    .lineLimit(2)
            }
            .padding(20)
        }
        .clipShape(RoundedRectangle(cornerRadius: Radius.hero, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radius.hero, style: .continuous)
                .strokeBorder(Palette.gold.opacity(0.18), lineWidth: 1.5)
        )
        .accessibilityElement(children: .combine)
    }

    /// Cifras de los propios récords (como `PRsList` de la web): cuántos, nuevos este mes y el último.
    private var recordsStats: some View {
        let month = String(LocalDate.string().prefix(7))
        let thisMonth = model.records.filter { $0.day.hasPrefix(month) }.count
        let latest = model.records.max { $0.day < $1.day }
        return HStack(spacing: 8) {
            recordStat(String(model.records.count), "Ejercicios con récord")
            recordStat(String(thisMonth), "Nuevos este mes", accent: thisMonth > 0)
            recordStat(latest?.shortDateText ?? "—", "Último récord")
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Resumen de tus récords")
    }

    private func recordStat(_ value: String, _ label: String, accent: Bool = false) -> some View {
        VStack(spacing: 4) {
            Text(value).font(.figure(size: 26)).foregroundStyle(accent ? Palette.gold : Palette.foreground)
                .lineLimit(1).minimumScaleFactor(0.6)
            Text(label).font(.apCaption).foregroundStyle(Palette.muted)
                .multilineTextAlignment(.center).lineLimit(2)
        }
        .frame(maxWidth: .infinity).padding(.horizontal, 8).padding(.vertical, 16)
        .background(Palette.card, in: RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
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
                    if !pr.dateText.isEmpty {
                        HStack(spacing: 6) {
                            Text(pr.dateText).font(.apFootnote).foregroundStyle(Palette.muted)
                            if pr.day.hasPrefix(String(LocalDate.string().prefix(7))) {
                                Text("Nuevo").font(.inter(size: 11, weight: .semibold)).foregroundStyle(Palette.gold)
                                    .padding(.horizontal, 6).padding(.vertical, 1)
                                    .background(Palette.gold.opacity(0.15), in: Capsule())
                            }
                        }
                    }
                }
                Spacer(minLength: 8)
                VStack(alignment: .trailing, spacing: 4) {
                    Text("\(pr.weightText) kg × \(pr.reps)").font(.apBody.weight(.semibold).monospacedDigit())
                        .lineLimit(1).minimumScaleFactor(0.7).allowsTightening(true)
                    Text("1RM ~\(pr.e1rmText) kg").font(.apFootnote.monospacedDigit()).foregroundStyle(Palette.muted)
                        .lineLimit(1).minimumScaleFactor(0.7)
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
                    // Misma disposición que el contenido real (apilado): sin saltos al cargar.
                    VStack(alignment: .leading, spacing: 24) {
                        ProgressSkeletonBlock(height: 256, radius: Radius.hero)
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

// MARK: - Visor de fotos

/// Visor a pantalla completa de una foto de «Físico», como Fotos de Apple: deslizar hacia arriba
/// sube la foto y abre debajo la información de ese scan (fecha, cifras y resultados); hacia abajo
/// la esconde y, si ya estaba escondida, cierra el visor. El botón «i» hace lo mismo sin gesto
/// (Mac, VoiceOver). Mismo contenido y textos que `PhotoInfoPanel` en la web (`ProgressPhotos.tsx`).
struct ProgressPhotoViewer: View {
    let photo: ProgressModel.Photo
    var onClose: () -> Void
    @State private var showInfo = false
    /// Recorrido vertical del dedo mientras arrastra (negativo = hacia arriba).
    @State private var drag: CGFloat = 0
    @State private var scan: PhotoScanInfo.Load = .loading
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()
            GeometryReader { geo in
                // El panel ocupa algo más de media pantalla, como en Fotos.
                let panel = max(260, min(geo.size.height * 0.58, 620))
                // 0 = solo la foto, 1 = información abierta; sigue al dedo mientras arrastra.
                let progress = min(1, max(0, (showInfo ? 1 : 0) - drag / panel))
                // Con la información cerrada, arrastrar hacia abajo baja la foto para cerrarla.
                let pull = showInfo ? 0 : max(0, drag)
                ZStack(alignment: .top) {
                    VStack(spacing: 0) {
                        CachedAsyncImage(url: photo.url) { $0.resizable().scaledToFit() } placeholder: { BrandLoader() }
                            .frame(maxWidth: .infinity, maxHeight: .infinity)
                            .offset(y: pull)
                            .contentShape(Rectangle())
                            .onTapGesture { if showInfo { setInfo(false) } else { onClose() } }
                            .gesture(swipe(panel: panel))
                            .accessibilityElement()
                            .accessibilityLabel("Foto de progreso del \(photo.longDate)")
                            .accessibilityHint("Desliza hacia arriba para ver la información")
                            .accessibilityAction(named: showInfo ? "Ocultar información" : "Ver información") { setInfo(!showInfo) }
                        infoPanel(panel: panel, bottomInset: geo.safeAreaInsets.bottom)
                            .frame(height: panel)
                            .frame(height: panel * progress, alignment: .top)
                            .clipped()
                    }
                    topBar.opacity(pull > 0 ? 0 : 1)
                }
            }
            .ignoresSafeArea(edges: .bottom)
        }
        .task(id: photo.id) { scan = await PhotoScanInfo.load(scanId: photo.scanId) }
    }

    private var topBar: some View {
        HStack(spacing: 8) {
            Spacer()
            roundButton(showInfo ? "info.circle.fill" : "info.circle", label: showInfo ? "Ocultar información" : "Ver información", active: showInfo) {
                setInfo(!showInfo)
            }
            roundButton("xmark", label: "Cerrar visor") { Haptics.tap(); onClose() }
        }
        .padding(.horizontal, 16)
        .padding(.top, 8)
    }

    private func roundButton(_ symbol: String, label: String, active: Bool = false, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: symbol)
                .font(.system(size: 17, weight: .semibold))
                .foregroundStyle(active ? Color.black : Color.white)
                .frame(width: 44, height: 44)
                .background(active ? Palette.gold : Color.white.opacity(0.15), in: Circle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
    }

    /// Arriba abre la información; abajo la cierra o, si ya estaba cerrada, cierra el visor.
    private func swipe(panel: CGFloat) -> some Gesture {
        DragGesture(minimumDistance: 10)
            .onChanged { value in
                // Solo cuenta el gesto vertical: un deslizamiento lateral no mueve nada.
                guard abs(value.translation.height) > abs(value.translation.width) else { return }
                drag = value.translation.height
            }
            .onEnded { value in
                let moved = value.translation.height
                let flung = value.predictedEndTranslation.height
                if showInfo {
                    setInfo(!(moved > panel * 0.25 || flung > panel * 0.5))
                } else if moved < -panel * 0.2 || flung < -panel * 0.4 {
                    setInfo(true)
                } else if moved > 110 || flung > 320 {
                    onClose()
                } else {
                    setInfo(false)
                }
            }
    }

    private func setInfo(_ open: Bool) {
        if open != showInfo { Haptics.selection() }
        withAnimation(reduceMotion ? nil : .spring(response: 0.38, dampingFraction: 0.86)) {
            showInfo = open
            drag = 0
        }
    }

    private var poseLabel: String {
        switch photo.angle {
        case "front": "De frente"
        case "back": "De espalda"
        default: "Foto de progreso"
        }
    }

    private func infoPanel(panel: CGFloat, bottomInset: CGFloat) -> some View {
        VStack(spacing: 0) {
            // Asa y fecha: también se arrastran para bajar el panel.
            VStack(alignment: .leading, spacing: 2) {
                Capsule().fill(Palette.muted.opacity(0.4)).frame(width: 36, height: 5)
                    .frame(maxWidth: .infinity).padding(.bottom, 12)
                    .accessibilityHidden(true)
                Text(photo.longDate.isEmpty ? "Sin fecha" : photo.longDate).font(.apTitle3)
                    .accessibilityAddTraits(.isHeader)
                Text(poseLabel).font(.apSubhead).foregroundStyle(Palette.muted)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 20).padding(.top, 10).padding(.bottom, 16)
            .contentShape(Rectangle())
            .gesture(swipe(panel: panel))
            ScrollView {
                scanContent
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, 20)
                    .padding(.bottom, bottomInset + 24)
            }
            .scrollIndicators(.hidden)
        }
        .frame(maxWidth: 640, maxHeight: .infinity, alignment: .top)
        .background(Palette.card, in: UnevenRoundedRectangle(topLeadingRadius: Radius.hero, topTrailingRadius: Radius.hero, style: .continuous))
        .frame(maxWidth: .infinity)
    }

    @ViewBuilder private var scanContent: some View {
        switch scan {
        case .loading:
            BrandLoader().frame(maxWidth: .infinity).padding(.vertical, 24)
        case .noScan:
            Text("Esta foto no tiene análisis. Las fotos que guarda cada scan muestran aquí sus resultados.")
                .font(.apSubhead).foregroundStyle(Palette.muted).fixedSize(horizontal: false, vertical: true)
        case .failed:
            Text("No hemos podido cargar el análisis de esta foto.")
                .font(.apSubhead).foregroundStyle(Palette.muted).fixedSize(horizontal: false, vertical: true)
        case .loaded(let info):
            scanDetail(info)
        }
    }

    private func scanDetail(_ info: PhotoScanInfo) -> some View {
        VStack(alignment: .leading, spacing: 16) {
            Label("Scan", systemImage: "sparkles")
                .font(.apCaption.weight(.bold)).tracking(1.6).textCase(.uppercase)
                .foregroundStyle(Palette.gold)
            if info.physique != nil || info.potential != nil || info.bodyFat != nil {
                HStack(alignment: .top, spacing: 24) {
                    if let v = info.physique { figure(NumberText.decimal(v), unit: "/10", label: "Físico") }
                    if let v = info.potential { figure(NumberText.decimal(v), unit: "/10", label: "Potencial", accent: true) }
                    if let v = info.bodyFat { figure("~\(Int(v.rounded()))", unit: "%", label: "Grasa estimada") }
                }
            }
            if let text = info.headline { Text(text).font(.apHeadline).fixedSize(horizontal: false, vertical: true) }
            if let text = info.summary {
                Text(text).font(.apSubhead).foregroundStyle(Palette.muted).fixedSize(horizontal: false, vertical: true)
            }
            if let text = info.bottleneck {
                (Text("Lo que más te frena: ").foregroundStyle(Palette.muted) + Text(text))
                    .font(.apSubhead).fixedSize(horizontal: false, vertical: true)
            }
            if !info.improvements.isEmpty {
                VStack(alignment: .leading, spacing: 12) {
                    Text("Qué mejorar").font(.apHeadline).accessibilityAddTraits(.isHeader)
                    ForEach(Array(info.improvements.enumerated()), id: \.offset) { index, item in
                        HStack(alignment: .top, spacing: 12) {
                            Text("\(index + 1)")
                                .font(.apFootnote.weight(.bold).monospacedDigit())
                                .foregroundStyle(.black)
                                .frame(width: 24, height: 24)
                                .background(Palette.gold, in: Circle())
                                .accessibilityHidden(true)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(item.label ?? "").font(.apSubhead).fixedSize(horizontal: false, vertical: true)
                                if let priority = item.priority, !priority.isEmpty {
                                    Text("Prioridad \(priority.lowercased())").font(.apCaption.weight(.semibold)).foregroundStyle(Palette.gold)
                                }
                            }
                        }
                        .accessibilityElement(children: .combine)
                    }
                }
            }
            if info.isEmpty {
                Text("Este análisis no tiene detalles guardados.").font(.apSubhead).foregroundStyle(Palette.muted)
            }
            Text("Estimación orientativa a partir de la foto.").font(.apFootnote).foregroundStyle(Palette.muted)
        }
    }

    private func figure(_ value: String, unit: String, label: String, accent: Bool = false) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            HStack(alignment: .firstTextBaseline, spacing: 2) {
                Text(value).font(.apFigureSmall).foregroundStyle(accent ? Palette.gold : Palette.foreground)
                Text(unit).font(.apFootnote).foregroundStyle(Palette.muted)
            }
            .lineLimit(1).minimumScaleFactor(0.7)
            Text(label).font(.apFootnote).foregroundStyle(Palette.muted).lineLimit(1)
        }
        .accessibilityElement(children: .combine)
    }
}

/// Análisis guardado de una foto de scan (`scan_history`), leído al abrir el visor. Nunca vuelve
/// a ejecutar el Scan. Mismos campos que el panel de la web.
struct PhotoScanInfo {
    enum Load { case loading, noScan, failed, loaded(PhotoScanInfo) }

    var physique: Double?
    var potential: Double?
    var bodyFat: Double?
    var headline: String?
    var summary: String?
    var bottleneck: String?
    var improvements: [ScanResult.Improvement]

    var isEmpty: Bool { headline == nil && summary == nil && bottleneck == nil && improvements.isEmpty }

    static func load(scanId: String?) async -> Load {
        guard let scanId else { return .noScan }
        /// Un JSON viejo o raro no tumba la fila: sin resultado legible quedan las cifras de las columnas.
        struct Lossy: Decodable {
            let value: ScanResult?
            init(from decoder: Decoder) throws { value = try? ScanResult(from: decoder) }
        }
        struct Row: Decodable { let physique: Double?; let potential: Double?; let result: Lossy? }
        let rows: [Row]
        do {
            rows = try await Backend.client.from("scan_history")
                .select("physique, potential, result")
                .eq("id", value: scanId)
                .limit(1)
                .execute().value
        } catch {
            return .failed
        }
        guard let row = rows.first else { return .noScan }
        let r = row.result?.value
        func text(_ s: String?) -> String? {
            let t = s?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            return t.isEmpty ? nil : t
        }
        return .loaded(PhotoScanInfo(
            physique: row.physique ?? r?.physique,
            potential: row.potential ?? r?.potential,
            bodyFat: r?.body_composition?.body_fat_pct,
            headline: text(r?.headline_diagnosis),
            summary: text(r?.summary),
            bottleneck: text(r?.bottleneck),
            improvements: Array((r?.improvements ?? []).filter { text($0.label) != nil }.prefix(4))))
    }
}

// MARK: - Modelo

/// Estado de la pantalla. Todo lo que se publica ya viene calculado y formateado: la vista no hace trabajo.
@MainActor
final class ProgressModel: ObservableObject {
    struct Week: Codable { let label: String; let kg: Double }
    struct Weight: Codable { let date: Date; let kg: Double }

    struct Record: Codable {
        let name: String; let weight: Double; let reps: Int; let e1rm: Double
        /// Fecha y cifras ya formateadas al cargar: la lista de récords no formatea al redibujar.
        let dateText: String
        let weightText: String
        let e1rmText: String
        let image: String?
        /// Día del récord («yyyy-MM-dd») para «Nuevos este mes» y «Último récord».
        var day: String = ""
        var shortDateText: String = ""
    }

    struct Photo: Identifiable, Hashable, Codable {
        let id: String; let url: URL?; let takenAt: String
        let date: Date?
        /// Ángulo de la foto (`front`/`back`), deducido de `note` como en la web.
        let angle: String?
        /// Mes y día ya formateados: formatear dentro del `body` cuesta caro al hacer scroll.
        let month: String
        let shortDate: String
        /// «1 de noviembre de 2026»: cabecera del panel de información del visor.
        let longDate: String
        /// Scan que guardó la foto (`scan_history`); `nil` en las fotos subidas a mano.
        let scanId: String?
    }

    /// Fotos agrupadas por mes, en el mismo orden en que llegan del servidor (más recientes primero).
    struct PhotoGroup: Identifiable, Codable {
        let month: String
        var photos: [Photo]
        var id: String { month }
    }

    struct ExerciseStat: Codable { let name: String; let sessions: Int; let bestVolume: Double }

    /// Todo lo que pinta la pantalla, ya calculado. Un único `@Published` → un solo redibujado por fase
    /// (antes cada propiedad publicaba por su cuenta y la vista se rehacía varias veces por carga).
    struct Snapshot: Codable {
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
        // Solo si también llegaron «Por ejercicio» y Récords: si no, se quedarían en esqueleto.
        if let at = snapshot.strengthAt, snapshot.detailsAt != nil, Date().timeIntervalSince(at) < 20 { return }
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
        persist(userId)
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
        // Memoria → disco → vacío. Así Progreso también abre sin conexión con lo último que se
        // descargó (antes solo vivía en memoria y sin red se quedaba en el aviso de error).
        snapshot = Self.cache[userId] ?? Snapshots.load(Snapshot.self, Self.cacheKey(userId)) ?? Snapshot()
    }

    /// Copia de la pantalla para abrir sin red. Se guarda tras cada fase y no bloquea la UI.
    private nonisolated static func cacheKey(_ id: UUID) -> String { "progress|\(id.uuidString.lowercased())" }

    private func persist(_ userId: UUID) {
        let shot = snapshot
        Task.detached(priority: .utility) {
            Snapshots.save(shot, Self.cacheKey(userId))
        }
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
        persist(userId)

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
        persist(userId)

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
            .select("id, photo_url, taken_at, created_at, note, scan_history_id")
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
    static let longDateStyle: Date.FormatStyle = .dateTime.day().month(.wide).year().locale(Locale(identifier: "es_ES"))

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
        let scan_history_id: String?
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

    /// «28 oct», para la cifra «Último récord».
    static func recordShortDate(_ raw: String) -> String {
        guard !raw.isEmpty, let date = ymd.date(from: String(raw.prefix(10))) else { return "" }
        return date.formatted(.dateTime.day().month(.abbreviated).locale(Locale(identifier: "es_ES")))
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
            let bestSet = weighted.max { $0.0 * (1 + Double($0.1) / 30) < $1.0 * (1 + Double($1.1) / 30) }
            let e1rm = bestSet.map { (($0.0 * (1 + Double($0.1) / 30)) * 10).rounded() / 10 }
            var entry = byDay[log.exercise_name]?[dayKey]
                ?? ExerciseEntry(date: date, label: dayLabel(date), volumeKg: 0, reps: 0, loadedSets: 0, best1Rm: nil)
            entry.volumeKg += weighted.reduce(0) { $0 + $1.0 * Double($1.1) }
            entry.reps += sets.reduce(0) { $0 + $1.reps }
            entry.loadedSets += weighted.count
            if let value = e1rm, let bestSet, value > (entry.best1Rm ?? 0) {
                entry.best1Rm = value
                entry.bestKg = bestSet.0
                entry.bestReps = bestSet.1
            }
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
                image: images[row.exercise_name],
                day: String((row.achieved_at ?? "").prefix(10)),
                shortDateText: recordShortDate(row.achieved_at ?? ""))
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
                shortDate: date.map { dayMonthStyle.format($0).replacingOccurrences(of: ".", with: "") } ?? "",
                longDate: date.map { longDateStyle.format($0) } ?? "",
                scanId: row.scan_history_id))
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

struct ExerciseEntry: Hashable, Codable {
    let date: Date; let label: String; var volumeKg: Double; var reps: Int; var loadedSets: Int; var best1Rm: Double?
    /// Mejor serie del día (por 1RM estimado), como `bestSetLabel` de la web: kg y reps.
    var bestKg: Double? = nil
    var bestReps: Int? = nil
}

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
    @State private var showAll = false

    private func value(_ e: ExerciseEntry) -> Double? {
        switch metric { case 1: e.loadedSets > 0 ? e.volumeKg.rounded() : nil; case 2: Double(e.reps); default: e.best1Rm }
    }
    private func r(_ v: Double) -> String { NumberText.decimal(v, digits: (v * 10).rounded().truncatingRemainder(dividingBy: 10) == 0 ? 0 : 1) }

    var body: some View {
        // Si el ejercicio elegido desaparece de los datos (borrado, otra cuenta…), no se queda
        // seleccionado uno que ya no existe: se cae al primero de la lista.
        let name = names.contains(selected) ? selected : (names.first ?? "")
        let entries = history[name] ?? []
        let others = names.filter { $0 != name }
        let shownOthers = showAll ? others : Array(others.prefix(3))
        let card = RoundedRectangle(cornerRadius: Radius.card, style: .continuous)
        VStack(alignment: .leading, spacing: 12) {
            // Ejercicio principal: foto, mejor marca (la serie de más 1RM) y su subida, con la gráfica en la misma tarjeta.
            VStack(alignment: .leading, spacing: 16) {
                Menu {
                    Picker("Ejercicio", selection: Binding(get: { name }, set: { Haptics.selection(); selected = $0 })) {
                        ForEach(names, id: \.self) { n in Text("\(n) · \(history[n]?.count ?? 0) \(history[n]?.count == 1 ? "sesión" : "sesiones")").tag(n) }
                    }
                } label: { header(name, entries) }
                .menuStyle(.button).buttonStyle(.plain)
                chart(name, entries)
                statsRow(entries)
            }
            .padding(16)
            .background(Palette.card, in: card)
            .overlay(card.strokeBorder(Palette.foreground.opacity(0.08), lineWidth: 1))
            ForEach(shownOthers, id: \.self) { other in otherRow(other) }
            if others.count > 3 {
                Button {
                    Haptics.tap()
                    withAnimation(reduceMotion ? nil : .snappy) { showAll.toggle() }
                } label: {
                    HStack(spacing: 12) {
                        Image(systemName: "chart.bar").font(.system(size: 18, weight: .medium))
                        Text(showAll ? "Ver menos ejercicios" : "Ver todos mis ejercicios").font(.apSubhead.weight(.semibold))
                            .frame(maxWidth: .infinity, alignment: .leading)
                        Image(systemName: "chevron.right").font(.system(size: 14, weight: .semibold))
                            .rotationEffect(.degrees(showAll ? -90 : 0))
                    }
                    .foregroundStyle(Palette.gold)
                    .padding(.horizontal, 16).frame(minHeight: 52)
                    .overlay(card.strokeBorder(Palette.gold.opacity(0.5), lineWidth: 1))
                    .contentShape(card)
                }
                .buttonStyle(.plain)
            }
        }
    }

    /// Récord del ejercicio y su subida en kg desde la primera sesión con peso (`exerciseRecord` de la web).
    static func record(_ entries: [ExerciseEntry]) -> (label: String?, gain: Double?) {
        let weighted = entries.filter { $0.best1Rm != nil && $0.bestKg != nil }
        guard let first = weighted.first,
              let best = weighted.max(by: { ($0.best1Rm ?? 0) < ($1.best1Rm ?? 0) }) else { return (nil, nil) }
        // Mismo empate que la web: ante igual 1RM gana el primero.
        let top = weighted.first { $0.best1Rm == best.best1Rm } ?? best
        let kg = top.bestKg ?? 0
        let label = "\(kg.rounded() == kg ? String(Int(kg)) : String(kg).replacingOccurrences(of: ".", with: ",")) kg × \(top.bestReps ?? 0)"
        let gain = ((kg - (first.bestKg ?? 0)) * 10).rounded() / 10
        return (label, top != first && gain > 0 ? gain : nil)
    }

    /// Subida en kg en verde (chip de la maqueta); nada si no ha subido.
    @ViewBuilder private func gainChip(_ gain: Double?) -> some View {
        if let gain {
            Label("+\(r(gain)) kg", systemImage: "arrow.up")
                .font(.inter(size: 12, weight: .bold).monospacedDigit())
                .foregroundStyle(Palette.gold)
                .padding(.horizontal, 10).padding(.vertical, 5)
                .background(Palette.gold.opacity(0.18), in: Capsule())
                .fixedSize()
        }
    }

    /// Fila inferior de la tarjeta: 1RM estimado y objetivo próximo, separados por un divisor.
    @ViewBuilder private func statsRow(_ entries: [ExerciseEntry]) -> some View {
        let best1rm = entries.compactMap(\.best1Rm).max()
        if let e1rm = best1rm {
            // Objetivo: siguiente múltiplo de 5 por encima del 1RM actual (mínimo +2.5 kg).
            let rawGoal = (e1rm / 5).rounded(.up) * 5
            let goal = rawGoal > e1rm ? rawGoal : rawGoal + 5
            let divider = Palette.foreground.opacity(0.08)
            HStack(spacing: 0) {
                // 1RM estimado
                HStack(spacing: 8) {
                    Image(systemName: "chart.bar").font(.system(size: 16, weight: .medium)).foregroundStyle(Palette.gold)
                        .accessibilityHidden(true)
                    VStack(alignment: .leading, spacing: 1) {
                        Text("1RM estimado").font(.apFootnote).foregroundStyle(Palette.muted)
                        Text("\(r(e1rm)) kg").font(.inter(.title3).weight(.bold)).monospacedDigit()
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                divider.frame(width: 1).padding(.vertical, 4)
                // Objetivo próximo
                HStack(spacing: 8) {
                    Image(systemName: "scope").font(.system(size: 16, weight: .medium)).foregroundStyle(Palette.gold)
                        .accessibilityHidden(true)
                    VStack(alignment: .leading, spacing: 1) {
                        Text("Objetivo").font(.apFootnote).foregroundStyle(Palette.muted)
                        Text("\(r(goal)) kg").font(.inter(.title3).weight(.bold)).monospacedDigit()
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.leading, 16)
                Image(systemName: "chevron.right").font(.system(size: 13, weight: .semibold)).foregroundStyle(Palette.muted)
                    .accessibilityHidden(true)
            }
            .padding(.top, 4)
            .overlay(alignment: .top) { divider.frame(height: 1) }
        }
    }

    private func photo(_ name: String, size: CGFloat) -> some View {
        let shape = RoundedRectangle(cornerRadius: size > 56 ? 16 : 12, style: .continuous)
        return Palette.secondary
            .overlay {
                if let url = images[name].flatMap(URL.init(string:)) {
                    // Con su URL como identidad: nunca se queda la foto del ejercicio anterior.
                    RemoteThumb(url: url, maxSide: 200) { Image(systemName: "dumbbell").foregroundStyle(Palette.muted) }
                        .id(url)
                } else {
                    Image(systemName: "dumbbell").foregroundStyle(Palette.muted)
                }
            }
            .frame(width: size, height: size)
            .clipShape(shape)
            .accessibilityHidden(true)
    }

    private func header(_ name: String, _ entries: [ExerciseEntry]) -> some View {
        let best = Self.record(entries)
        return HStack(alignment: .top, spacing: 14) {
            photo(name, size: 64)
            VStack(alignment: .leading, spacing: 2) {
                HStack(alignment: .top, spacing: 8) {
                    Text(name).font(.apHeadline).foregroundStyle(Palette.foreground).lineLimit(2)
                        .multilineTextAlignment(.leading).frame(maxWidth: .infinity, alignment: .leading)
                    Image(systemName: "chevron.up.chevron.down").font(.inter(size: 14, weight: .semibold)).foregroundStyle(Palette.muted)
                }
                if let label = best.label {
                    Text("Mejor marca").font(.apFootnote).foregroundStyle(Palette.muted).padding(.top, 2)
                    HStack(spacing: 10) {
                        Text(label).font(.inter(size: 26, weight: .bold).monospacedDigit()).foregroundStyle(Palette.foreground)
                            .lineLimit(1).minimumScaleFactor(0.7)
                        if let gain = best.gain {
                            HStack(spacing: 6) {
                                gainChip(gain)
                                Text("vs. último registro").font(.apFootnote).foregroundStyle(Palette.muted)
                            }
                        }
                    }
                } else {
                    // Sin peso no hay marca que enseñar: se dice cuántas sesiones lleva, sin guiones.
                    Text("\(entries.count) \(entries.count == 1 ? "sesión registrada" : "sesiones registradas")")
                        .font(.apSubhead).foregroundStyle(Palette.muted).padding(.top, 2)
                }
            }
        }
        .contentShape(Rectangle())
    }

    private func otherRow(_ name: String) -> some View {
        let entries = history[name] ?? []
        let best = Self.record(entries)
        let card = RoundedRectangle(cornerRadius: Radius.card, style: .continuous)
        return Button {
            Haptics.selection()
            withAnimation(reduceMotion ? nil : .snappy) { selected = name }
        } label: {
            HStack(spacing: 14) {
                photo(name, size: 48)
                VStack(alignment: .leading, spacing: 2) {
                    Text(name).font(.apHeadline).foregroundStyle(Palette.foreground).lineLimit(1)
                    Text(best.label.map { "Mejor marca: \($0)" } ?? "\(entries.count) \(entries.count == 1 ? "sesión" : "sesiones")")
                        .font(.apFootnote.monospacedDigit()).foregroundStyle(Palette.muted).lineLimit(2)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                gainChip(best.gain)
                Image(systemName: "chevron.right").font(.system(size: 14, weight: .semibold)).foregroundStyle(Palette.muted)
                    .accessibilityHidden(true)
            }
            .padding(.leading, 12).padding(.trailing, 16).padding(.vertical, 12)
            .frame(maxWidth: .infinity, minHeight: 72)
            .background(Palette.card, in: card)
            .overlay(card.strokeBorder(Palette.foreground.opacity(0.08), lineWidth: 1))
            .contentShape(card)
        }
        .buttonStyle(.plain)
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
            // Sin series con peso no se pinta «— kg»: ya lo explica el aviso de abajo.
            if !values.isEmpty {
                VStack(alignment: .leading, spacing: 6) {
                    (Text(latest.map(r) ?? "—").font(.inter(size: 32, weight: .bold).monospacedDigit()) + Text(" \(unit)").font(.apSubhead).foregroundColor(Palette.muted))
                        .lineLimit(1).minimumScaleFactor(0.7)
                        .contentTransition(.numericText())
                        .animation(reduceMotion ? nil : .snappy, value: metric)
                    HStack(spacing: 0) {
                        if hasLine, let change {
                            Text("\(change > 0 ? "+" : "")\(r(change))%").fontWeight(.medium).foregroundStyle(change >= 0 ? Palette.gold : Palette.muted)
                            Text(" · ")
                        }
                        if hasLine, let best { Text("\(r(best)) \(unit) · ") }
                        Text(sessions)
                    }
                    .font(.apFootnote.monospacedDigit()).foregroundStyle(Palette.muted)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            // Selector en su propia fila, como la web: «Volumen» ya no se parte en dos líneas.
            SegmentedPill(options: ["1RM", "Volumen", "Reps"], selection: $metric)
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
