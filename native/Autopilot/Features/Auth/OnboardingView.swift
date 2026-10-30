import SwiftUI
import Supabase

/// Sin sesión: bienvenida (primer uso), acceso y el cuestionario que prepara la rutina antes de
/// pedir la cuenta, como `/onboarding` en la web. Con cuentas guardadas se abre el acceso.
struct SignedOutView: View {
    @EnvironmentObject private var session: SessionModel
    @EnvironmentObject private var accounts: AccountStore
    @State private var screen: Screen? = OnboardingDraft.pendingEmail == nil ? nil : .quiz
    enum Screen { case welcome, login, quiz }

    private var current: Screen {
        if session.addingAccount { return .login }
        return screen ?? (accounts.accounts.isEmpty ? .welcome : .login)
    }

    var body: some View {
        Group {
            switch current {
            case .welcome: WelcomeView(onStart: { go(.quiz) }, onLogin: { go(.login) })
            case .login: LoginView(onCreateAccount: session.addingAccount ? nil : { go(.quiz) })
            case .quiz: OnboardingQuizView(onExit: { go(accounts.accounts.isEmpty ? .welcome : .login) })
            }
        }
        .transition(.opacity)
    }

    private func go(_ s: Screen) {
        withAnimation(A11y.reduceMotion ? nil : .easeOut(duration: 0.2)) { screen = s }
    }
}

/// Bienvenida de la app (web `Welcome.tsx`): icono, tres razones y una sola acción principal.
struct WelcomeView: View {
    var onStart: () -> Void
    var onLogin: () -> Void

    var body: some View {
        VStack(spacing: 0) {
            ScrollView {
                VStack(spacing: 0) {
                    Image("Logo").resizable().scaledToFit().frame(width: 80, height: 80)
                        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous)).accessibilityHidden(true)
                    (Text("Te damos la bienvenida a\n") + Text("Autopilot").foregroundColor(Palette.gold))
                        .font(.apLargeTitle).tracking(-0.7).multilineTextAlignment(.center)
                        .padding(.top, 28).accessibilityAddTraits(.isHeader)
                    VStack(alignment: .leading, spacing: 24) {
                        feature("dumbbell.fill", "Entrenamiento", "Tu rutina se adapta cada semana a lo que haces y a cómo progresas.")
                        feature("fork.knife", "Nutrición", "Calorías, macros y comidas que encajan con tu objetivo y tu día.")
                        feature("sparkles", "En automático", "Tu plan se mantiene al día solo. Tú apareces, él se encarga del resto.")
                    }
                    .padding(.top, 40)
                }
                .frame(maxWidth: 420).padding(.horizontal, 24).padding(.top, 56)
                .frame(maxWidth: .infinity)
            }
            VStack(spacing: 12) {
                Button("Crear mi rutina gratis") { Haptics.tap(); onStart() }.buttonStyle(.pill)
                Button("Ya tengo cuenta") { Haptics.tap(); onLogin() }
                    .font(.apSubhead.weight(.semibold)).foregroundStyle(Palette.gold).frame(minHeight: 44)
                Text("Al continuar aceptas los [términos](https://autopilotplan.com/legal/terminos) y la [política de privacidad](https://autopilotplan.com/legal/privacidad).")
                    .font(.apCaption).foregroundStyle(Palette.muted).multilineTextAlignment(.center).tint(Palette.muted)
            }
            .frame(maxWidth: 420).padding(.horizontal, 24).padding(.bottom, 16)
        }
        .screenBackground()
    }

    private func feature(_ symbol: String, _ title: String, _ text: String) -> some View {
        HStack(alignment: .top, spacing: 16) {
            Image(systemName: symbol).font(.system(size: 26, weight: .semibold)).foregroundStyle(Palette.gold)
                .frame(width: 40).accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 4) {
                Text(title).font(.apHeadline)
                Text(text).font(.apSubhead).foregroundStyle(Palette.muted).fixedSize(horizontal: false, vertical: true)
            }
        }
        .accessibilityElement(children: .combine)
    }
}

// MARK: - Respuestas del cuestionario

/// Lo mismo que guarda el configurador de la web (`Configurator.tsx`). Se conserva en el
/// dispositivo hasta que la cuenta está verificada, así no se pierde si se cierra la app.
struct OnboardingDraft: Codable, Equatable {
    var mode = "individual"
    var partnerEmail = ""
    var goal = ""
    var focus = ""
    var days: [Int] = []
    var minutes = 55
    var structure = "coach"
    var weight = ""

    private static let key = "onboarding-draft"
    private static let emailKey = "onboarding-pending-email"

    static func load() -> OnboardingDraft? {
        UserDefaults.standard.data(forKey: key).flatMap { try? JSONDecoder().decode(OnboardingDraft.self, from: $0) }
    }
    func save() { UserDefaults.standard.set(try? JSONEncoder().encode(self), forKey: Self.key) }
    static func clear() {
        UserDefaults.standard.removeObject(forKey: key)
        UserDefaults.standard.removeObject(forKey: emailKey)
    }
    /// Correo con la cuenta creada y el código aún sin introducir.
    static var pendingEmail: String? {
        get { UserDefaults.standard.string(forKey: emailKey) }
        set { UserDefaults.standard.set(newValue, forKey: emailKey) }
    }

    var duo: Bool { mode == "pareja" }
    var weightValue: Double? { Double(weight.replacingOccurrences(of: ",", with: ".")).flatMap { $0 > 30 ? $0 : nil } }
    var validStep0: Bool { !goal.isEmpty && !focus.isEmpty && (!duo || partnerEmail.contains("@") && partnerEmail.contains(".")) }

    /// Guarda las respuestas como la web, registra los consentimientos y prepara la rutina.
    func persist(userId: UUID) async throws {
        struct Availability: Encodable {
            let days: String; let hours: String; let training_days: [Int]; let session_minutes: Int; let structure: String
            let checkin_dow = 0; let checkin_time = "19:30"; let coach_style = "flexible"
            let training_mode: String; let partner_email: String?
        }
        struct Row: Encodable {
            let user_id: UUID; let goal: String; let primary_focus: String; let equipment_type: String
            let intensity_level = 7; let weight: Double?; let availability: Availability
        }
        struct Consent: Encodable {
            let user_id: UUID; let consent_type: String; let granted = true; let document_version = "1.0"
            let user_agent = "Autopilot nativa"; let metadata = ["source": "configurator"]
        }
        let row = Row(user_id: userId, goal: goal, primary_focus: focus,
                      equipment_type: focus == "gimnasio" ? "Gimnasio" : focus == "calistenia" ? "Calistenia" : "Mixto",
                      weight: weightValue,
                      availability: Availability(days: String(days.count), hours: String(format: "%g", (Double(minutes) / 60 * 100).rounded() / 100),
                                                 training_days: days, session_minutes: minutes, structure: structure,
                                                 training_mode: mode, partner_email: duo ? partnerEmail : nil))
        try await Backend.client.from("onboarding").upsert(row, onConflict: "user_id").execute()
        try? await Backend.client.from("user_consents")
            .insert(["terms", "privacy", "health_data"].map { Consent(user_id: userId, consent_type: $0) }).execute()
        try? await Backend.client.from("profiles").update(["plan_status": "plan_pending"]).eq("user_id", value: userId).execute()
        _ = await TrainingRepo.generateStarterPlan(userId: userId)
    }
}

// MARK: - Cuestionario (3 pasos) y cuenta al final

/// Opciones del configurador de la web, con los mismos valores que se guardan.
private enum Quiz {
    struct Option: Identifiable { let v: String; let l: String; var d: String? = nil; var id: String { v } }
    struct Day: Identifiable { let v: Int; let s: String; let l: String; var id: Int { v } }

    static let goals = [Option(v: "lose_weight", l: "Perder grasa"), Option(v: "gain_muscle", l: "Ganar músculo"),
                        Option(v: "recomp", l: "Recomposición"), Option(v: "general_health", l: "Fuerza y salud")]
    static let focuses = [Option(v: "gimnasio", l: "Gimnasio"), Option(v: "calistenia", l: "Calistenia"), Option(v: "mixto", l: "Mixto")]
    static let modes = [Option(v: "individual", l: "Individual", d: "Un plan solo para ti"),
                        Option(v: "pareja", l: "En pareja", d: "Entrenáis juntos con un plan para los dos")]
    static let durations = [Option(v: "40", l: "30–45 min"), Option(v: "55", l: "45–60 min"), Option(v: "75", l: "60–90 min")]
    static let structures = [Option(v: "full_body", l: "Full Body"), Option(v: "torso_pierna", l: "Torso / Pierna"),
                             Option(v: "ppl", l: "Empuje / Tirón / Pierna"), Option(v: "coach", l: "No lo sé, que Autopilot elija")]
    static let week = [Day(v: 1, s: "L", l: "Lunes"), Day(v: 2, s: "M", l: "Martes"), Day(v: 3, s: "X", l: "Miércoles"),
                       Day(v: 4, s: "J", l: "Jueves"), Day(v: 5, s: "V", l: "Viernes"), Day(v: 6, s: "S", l: "Sábado"),
                       Day(v: 0, s: "D", l: "Domingo")]
    /// Las mismas fotos de marca que la web (`brandPhotos.ts`).
    static func photo(_ focus: String) -> URL? {
        let file = ["gimnasio": "a31c7206-d2a4-4b31-856a-f5dec09b890e-1791475829849.png",
                    "calistenia": "7ab0b27f-f296-4fa6-bf07-8f8b026b0832-1791475152675.png",
                    "mixto": "d5e30e05-0791-4886-84a0-7b2695728225-1791475865184.png"][focus] ?? ""
        return URL(string: "https://enebrcdrdnfkyduzyrzm.supabase.co/storage/v1/object/public/site-assets/exercise-images/" + file)
    }
    static func label(_ options: [Option], _ v: String) -> String { options.first { $0.v == v }?.l ?? "—" }
}

/// `Configurator.tsx` de la web: objetivo, semana y el plan de arranque; la cuenta, al final.
struct OnboardingQuizView: View {
    var onExit: () -> Void
    @State private var c = OnboardingDraft.load() ?? OnboardingDraft()
    @State private var step = OnboardingDraft.load().map { d in !d.validStep0 ? 0 : d.days.count < 2 ? 1 : 2 } ?? 0
    @State private var accept = OnboardingDraft.pendingEmail != nil
    @State private var creatingAccount = OnboardingDraft.pendingEmail != nil

    private func t(_ solo: String, _ pair: String) -> String { c.duo ? pair : solo }
    private var titles: [String] { [t("¿Qué quieres conseguir?", "¿Qué queréis conseguir?"), t("Tu semana", "Vuestra semana juntos"), t("Tu plan Autopilot", "Vuestro plan conjunto")] }
    private var leads: [String] {
        [t("Cuéntanos tu objetivo y dónde entrenas.", "Un mismo calendario, con cargas adaptadas a cada uno."),
         t("Elige al menos dos días. Ajustamos el plan a tu semana.", "Elegid al menos dos días que os vengan bien a los dos."),
         t("Así queda con tus respuestas. Crea tu cuenta para guardar tu plan completo.", "Así queda vuestro plan. Crea tu cuenta para guardarlo.")]
    }
    private var valid: [Bool] { [c.validStep0, c.days.count >= 2, accept] }

    var body: some View {
        if creatingAccount {
            CreateAccountView(draft: c) { withAnimation { creatingAccount = false } }
        } else {
            quiz
        }
    }

    private var quiz: some View {
        VStack(spacing: 0) {
            HStack {
                Button { Haptics.tap(); if step == 0 { onExit() } else { step -= 1 } } label: {
                    Image(systemName: "chevron.left").font(.system(size: 20, weight: .semibold)).frame(width: 44, height: 44)
                }
                .foregroundStyle(Palette.gold).accessibilityLabel("Atrás")
                Spacer()
                Text("\(step + 1) de \(titles.count)").font(.apHeadline)
                Spacer()
                Color.clear.frame(width: 44, height: 44)
            }
            .padding(.horizontal, 8)
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    ProgressView(value: Double(step + 1), total: Double(titles.count)).tint(Palette.gold)
                        .accessibilityLabel("Paso \(step + 1) de \(titles.count)")
                    Text(titles[step]).font(.apTitle1).padding(.top, 24).accessibilityAddTraits(.isHeader)
                    Text(leads[step]).font(.apSubhead).foregroundStyle(Palette.muted).padding(.top, 8)
                    VStack(alignment: .leading, spacing: 32) { content }.padding(.top, 32).padding(.bottom, 16)
                }
                .frame(maxWidth: 560).padding(.horizontal, 16).frame(maxWidth: .infinity)
            }
            .scrollDismissesKeyboard(.interactively)
            Group {
                if step < titles.count - 1 {
                    Button("Continuar") { Haptics.tap(); c.save(); step += 1 }.buttonStyle(.pill).disabled(!valid[step])
                } else {
                    Button("Guardar mi plan gratis") { Haptics.signature(); c.save(); withAnimation { creatingAccount = true } }
                        .buttonStyle(.pill).disabled(!accept)
                }
            }
            .frame(maxWidth: 560).padding(.horizontal, 16).padding(.vertical, 12)
        }
        .screenBackground()
        .animation(A11y.reduceMotion ? nil : .easeInOut(duration: 0.25), value: step)
    }

    @ViewBuilder private var content: some View {
        switch step {
        case 0:
            choices(nil, Quiz.modes, c.mode) { c.mode = $0 }
            if c.duo {
                group("Tu pareja de entreno") { PillField(label: "Email de tu pareja de entreno", text: $c.partnerEmail, contentType: .email) }
            }
            choices("Objetivo", Quiz.goals, c.goal) { c.goal = $0 }
            group(t("¿Dónde entrenas?", "¿Dónde entrenáis?")) {
                HStack(spacing: 10) { ForEach(Quiz.focuses) { photoChoice($0) } }
            }
        case 1:
            group(t("¿Qué días vas a entrenar?", "¿Qué días entrenáis juntos?")) {
                HStack(spacing: 4) {
                    ForEach(Quiz.week) { d in
                        let on = c.days.contains(d.v)
                        Button { Haptics.selection(); if on { c.days.removeAll { $0 == d.v } } else { c.days.append(d.v) } } label: {
                            Text(d.s).font(.apHeadline).foregroundStyle(on ? Palette.gold : Palette.foreground)
                                .frame(width: 44, height: 44)
                                .background(on ? Palette.gold.opacity(0.15) : Palette.card, in: Circle())
                        }
                        .buttonStyle(.plain).frame(maxWidth: .infinity)
                        .accessibilityLabel(d.l).accessibilityAddTraits(on ? .isSelected : [])
                    }
                }
            }
            choices("Tiempo por sesión", Quiz.durations, String(c.minutes)) { c.minutes = Int($0) ?? 55 }
            choices("Estructura", Quiz.structures, c.structure) { c.structure = $0 }
            group("Tu peso en kg (opcional)") { PillField(label: "Tu peso en kg", text: $c.weight).decimalKeyboard() }
        default:
            summary
            PlanPreviewView(focus: c.focus, goal: c.goal, weight: c.weightValue, days: c.days.count)
            HStack(alignment: .top, spacing: 12) {
                Button { Haptics.selection(); accept.toggle() } label: {
                    Image(systemName: accept ? "checkmark.circle.fill" : "circle").font(.inter(size: 22))
                        .foregroundStyle(accept ? Palette.gold : Palette.muted)
                }
                .buttonStyle(.plain).frame(minWidth: 44, minHeight: 44, alignment: .top)
                .accessibilityLabel("Acepto los términos, la privacidad y el tratamiento de mis datos de salud")
                .accessibilityValue(accept ? "Activado" : "Desactivado")
                Text("Acepto los [términos](https://autopilotplan.com/legal/terminos), la [privacidad](https://autopilotplan.com/legal/privacidad) y el tratamiento de mis datos de salud para preparar mi plan.")
                    .font(.apFootnote).foregroundStyle(Palette.muted).tint(Palette.gold).padding(.top, 2)
            }
            .padding(.horizontal, 4)
        }
    }

    private var summary: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(t("TU OBJETIVO", "VUESTRO OBJETIVO")).font(.apFootnote).tracking(0.6).foregroundStyle(Palette.gold)
            Text("\(Quiz.label(Quiz.goals, c.goal)) · \(Quiz.label(Quiz.focuses, c.focus))").font(.apTitle2).padding(.top, 4)
            HStack(spacing: 6) {
                ForEach(Quiz.week) { d in
                    let on = c.days.contains(d.v)
                    Text(d.s).font(.apHeadline).foregroundStyle(on ? Color.black : Palette.muted)
                        .frame(width: 36, height: 36)
                        .background(on ? Palette.gold : Palette.secondary, in: Circle()).frame(maxWidth: .infinity)
                }
            }
            .padding(.top, 20)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("Días de entreno: \(Quiz.week.filter { c.days.contains($0.v) }.map(\.l).joined(separator: ", "))")
            HStack(spacing: 8) {
                stat("Días", String(c.days.count))
                stat("Sesión", Quiz.label(Quiz.durations, String(c.minutes)))
                stat("Peso", c.weight.isEmpty ? "—" : "\(c.weight) kg")
            }
            .padding(.top, 20)
            Text((c.structure == "coach" ? "Distribución: Autopilot elige la mejor para \(c.days.count) días." : "Distribución: \(Quiz.label(Quiz.structures, c.structure)).")
                 + (c.duo ? " Mismo calendario, cargas adaptadas a cada uno." : ""))
                .font(.apSubhead).foregroundStyle(Palette.muted).padding(.top, 16)
        }
        .padding(20)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Palette.card, in: RoundedRectangle(cornerRadius: Radius.hero, style: .continuous))
    }

    private func stat(_ k: String, _ v: String) -> some View {
        VStack(spacing: 2) {
            Text(v).font(.apHeadline).lineLimit(1).minimumScaleFactor(0.7)
            Text(k).font(.apFootnote).foregroundStyle(Palette.muted)
        }
        .frame(maxWidth: .infinity).padding(.vertical, 12)
        .background(Palette.secondary, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        .accessibilityElement(children: .combine)
    }

    private func group<Content: View>(_ header: String, @ViewBuilder _ content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(header).font(.apFootnote.weight(.semibold)).foregroundStyle(Palette.muted).padding(.horizontal, 16)
                .accessibilityAddTraits(.isHeader)
            content()
        }
    }

    private func choices(_ header: String?, _ options: [Quiz.Option], _ value: String, _ set: @escaping (String) -> Void) -> some View {
        let list = VStack(spacing: 0) {
            ForEach(Array(options.enumerated()), id: \.element.id) { i, o in
                Button { Haptics.selection(); set(o.v) } label: {
                    HStack(spacing: 12) {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(o.l).font(.apHeadline)
                            if let d = o.d { Text(d).font(.apSubhead).foregroundStyle(Palette.muted) }
                        }
                        Spacer(minLength: 0)
                        Image(systemName: "checkmark").font(.system(size: 17, weight: .bold)).foregroundStyle(Palette.gold)
                            .opacity(o.v == value ? 1 : 0)
                    }
                    .padding(.horizontal, 16).frame(minHeight: 56).contentShape(Rectangle())
                    .overlay(alignment: .bottom) { if i < options.count - 1 { Palette.separator.frame(height: 0.5).padding(.leading, 16) } }
                }
                .buttonStyle(.plain)
                .accessibilityAddTraits(o.v == value ? .isSelected : [])
            }
        }
        .background(Palette.card, in: RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
        return Group { if let header { group(header) { list } } else { list } }
    }

    private func photoChoice(_ o: Quiz.Option) -> some View {
        let on = c.focus == o.v
        return Button { Haptics.selection(); c.focus = o.v } label: {
            ZStack(alignment: .bottomLeading) {
                CachedAsyncImage(url: Quiz.photo(o.v)) { $0.resizable().scaledToFill() } placeholder: { Palette.card }
                    .frame(maxWidth: .infinity).aspectRatio(4 / 5, contentMode: .fit).clipped()
                    .overlay { LinearGradient(colors: [.clear, .black.opacity(0.9)], startPoint: .center, endPoint: .bottom) }
                Text(o.l).font(.apHeadline).foregroundStyle(.white).padding(12)
            }
            .overlay(alignment: .topTrailing) {
                Image(systemName: "checkmark.circle.fill").font(.system(size: 24)).foregroundStyle(Color.black, Palette.gold)
                    .padding(8).opacity(on ? 1 : 0)
            }
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).stroke(on ? Palette.gold : .clear, lineWidth: 2))
        }
        .buttonStyle(.pressableCard)
        .accessibilityLabel(o.l).accessibilityAddTraits(on ? .isSelected : [])
    }
}

/// `PlanPreview.tsx` de la web: un día de ejemplo y la nutrición estimada con el peso.
struct PlanPreviewView: View {
    let focus: String
    let goal: String
    let weight: Double?
    let days: Int

    private var sample: (title: String, muscle: String, exercises: [(String, String)]) {
        switch focus {
        case "calistenia":
            return ("Día 1 · Empuje (Calistenia)", "Pecho · Hombro · Tríceps",
                    [("Flexiones lastradas", "4 × 8"), ("Fondos en paralelas", "4 × 6"), ("Pike push-ups", "3 × 10"), ("Plancha lastrada", "3 × 45s")])
        case "mixto":
            return ("Día 1 · Full body híbrido", "Cuerpo completo",
                    [("Sentadilla con barra", "4 × 6"), ("Dominadas lastradas", "4 × 6"), ("Press militar", "3 × 8"), ("L-sit / Core", "3 × 30s")])
        default:
            return ("Día 1 · Empuje (Gimnasio)", "Pecho · Hombro · Tríceps",
                    [("Press banca", "4 × 6-8"), ("Press militar", "4 × 8"), ("Aperturas con mancuerna", "3 × 10"), ("Extensiones de tríceps", "3 × 12")])
        }
    }

    var body: some View {
        let s = sample
        let n = weight.flatMap { MacroEstimate.estimate(weight: $0, sex: nil, goal: goal) }
        VStack(alignment: .leading, spacing: 32) {
            VStack(alignment: .leading, spacing: 8) {
                Text(s.title).font(.apFootnote.weight(.semibold)).foregroundStyle(Palette.muted).padding(.horizontal, 16)
                VStack(spacing: 0) {
                    ForEach(Array(s.exercises.enumerated()), id: \.offset) { i, ex in
                        HStack(spacing: 12) {
                            Image(systemName: "dumbbell.fill").foregroundStyle(Palette.muted).accessibilityHidden(true)
                            Text(ex.0).font(.apBody)
                            Spacer(minLength: 8)
                            Text(ex.1).font(.apBody).monospacedDigit().foregroundStyle(Palette.muted)
                        }
                        .padding(.horizontal, 16).frame(minHeight: 50)
                        .overlay(alignment: .bottom) { if i < s.exercises.count - 1 { Palette.separator.frame(height: 0.5).padding(.leading, 16) } }
                        .accessibilityElement(children: .combine)
                    }
                }
                .background(Palette.card, in: RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
                Text("\(s.muscle) · +\(max(days - 1, 2)) sesiones que se completarán al crear el plan")
                    .font(.apFootnote).foregroundStyle(Palette.muted).padding(.horizontal, 16)
            }
            HStack(alignment: .top, spacing: 16) {
                Image(systemName: "fork.knife").font(.system(size: 24, weight: .semibold)).foregroundStyle(Palette.gold)
                    .frame(width: 28).accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 0) {
                    Text("Tu nutrición diaria").font(.apHeadline)
                    if let n {
                        HStack(spacing: 32) {
                            figure(NumberText.integer(Int(n.kcal)), "kcal al día")
                            figure("\(Int(n.p)) g", "proteína")
                        }
                        .padding(.top, 8)
                        Text("Menús y cantidades al generar el plan.").font(.apSubhead).foregroundStyle(Palette.muted).padding(.top, 12)
                    } else {
                        Text("Añade tu peso para ver kcal y proteína personalizadas. Menús y cantidades al generar el plan.")
                            .font(.apSubhead).foregroundStyle(Palette.muted).padding(.top, 4)
                    }
                }
            }
            .padding(.horizontal, 16)
        }
    }

    private func figure(_ value: String, _ caption: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(value).font(.figure(size: 28))
            Text(caption).font(.apSubhead).foregroundStyle(Palette.muted)
        }
        .accessibilityElement(children: .combine)
    }
}

/// La cuenta, después de ver el plan (web `Signup.tsx` + `VerifyEmail.tsx`), sin salir de la app.
struct CreateAccountView: View {
    let draft: OnboardingDraft
    var onBack: () -> Void
    @EnvironmentObject private var session: SessionModel
    @State private var name = ""
    @State private var email = OnboardingDraft.pendingEmail ?? ""
    @State private var password = ""
    @State private var code = ""
    @State private var codeSent = OnboardingDraft.pendingEmail != nil
    @State private var loading = false
    @State private var error: String?
    @State private var notice: String?

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Button { Haptics.tap(); if codeSent { codeSent = false; OnboardingDraft.pendingEmail = nil } else { onBack() } } label: {
                    Image(systemName: "chevron.left").font(.system(size: 20, weight: .semibold)).frame(width: 44, height: 44)
                }
                .foregroundStyle(Palette.gold).accessibilityLabel("Atrás")
                Spacer()
            }
            .padding(.horizontal, 8)
            ScrollView {
                VStack(spacing: 28) {
                    VStack(spacing: 12) {
                        Image(systemName: codeSent ? "envelope.badge" : "sparkles").font(.system(size: 36, weight: .semibold))
                            .foregroundStyle(Palette.gold).accessibilityHidden(true)
                        Text(codeSent ? "Introduce el código" : "Crea tu cuenta").font(.apLargeTitle).accessibilityAddTraits(.isHeader)
                        Text(codeSent ? "Te hemos enviado un código de 8 dígitos a \(email). Escríbelo aquí para activar tu cuenta."
                                      : "Último paso para desbloquear tu plan.")
                            .font(.apSubhead).foregroundStyle(Palette.muted).multilineTextAlignment(.center)
                    }
                    VStack(spacing: 12) {
                        if codeSent {
                            PillField(label: "Código de verificación", text: $code).oneTimeCode()
                                .onChange(of: code) { _, v in
                                    let digits = String(v.filter(\.isNumber).prefix(8))
                                    if digits != v { code = digits }
                                }
                        } else {
                            PillField(label: "Nombre", text: $name)
                            PillField(label: "Correo electrónico", text: $email, contentType: .email)
                            PillField(label: "Contraseña, mínimo 6 caracteres", text: $password, secure: true, contentType: .password)
                        }
                        if let error {
                            Text(error).font(.apFootnote).foregroundStyle(Palette.destructive)
                                .frame(maxWidth: .infinity, alignment: .leading).padding(.horizontal, 8)
                        } else if let notice {
                            Text(notice).font(.apFootnote).foregroundStyle(Palette.muted)
                                .frame(maxWidth: .infinity, alignment: .leading).padding(.horizontal, 8)
                        }
                    }
                    VStack(spacing: 12) {
                        Button { Task { if codeSent { await verify() } else { await create() } } } label: {
                            if loading { BrandLoader().tint(.black).accessibilityHidden(true) }
                            else { Text(codeSent ? "Verificar cuenta" : "Crear cuenta gratis") }
                        }
                        .buttonStyle(.pill)
                        .disabled(loading || (codeSent ? ![6, 8].contains(code.count) : (email.isEmpty || password.count < 6)))
                        .accessibilityLabel(loading ? (codeSent ? "Verificando" : "Creando cuenta…") : (codeSent ? "Verificar cuenta" : "Crear cuenta gratis"))
                        if codeSent {
                            Button("Reenviar código") { Task { await resend() } }
                                .font(.apSubhead).foregroundStyle(Palette.gold).frame(minHeight: 44).disabled(loading)
                        }
                    }
                }
                .frame(maxWidth: 420).padding(.horizontal, 24).padding(.top, 16).frame(maxWidth: .infinity)
            }
            .scrollDismissesKeyboard(.interactively)
        }
        .screenBackground()
        .onChange(of: error) { _, text in
            if let text { A11y.announce("Error: \(text)") }
        }
    }

    private func create() async {
        guard !loading else { return }
        error = nil
        let mail = email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !name.trimmingCharacters(in: .whitespaces).isEmpty else { return fail("El nombre es obligatorio.") }
        loading = true
        defer { loading = false }
        struct Availability: Decodable { let emailTaken: Bool? }
        if let a: Availability = try? await Backend.client.functions.invoke("check-availability", options: FunctionInvokeOptions(body: ["email": mail])),
           a.emailTaken == true {
            return fail("Este correo ya está registrado.")
        }
        do {
            _ = try await Backend.client.auth.signUp(email: mail, password: password,
                                                     data: ["display_name": .string(name.trimmingCharacters(in: .whitespaces)),
                                                            "is_free": "true", "selected_plan": ""])
            email = mail
            OnboardingDraft.pendingEmail = mail
            codeSent = true
            Haptics.success()
        } catch {
            fail(AccountStore.isNetworkError(error)
                 ? "No hemos podido crear tu cuenta. Comprueba tu conexión y vuelve a intentarlo."
                 : String(describing: error).contains("weak_password") ? "La contraseña debe tener al menos 6 caracteres."
                 : "No hemos podido crear tu cuenta. Revisa el correo y la contraseña.")
        }
    }

    private func verify() async {
        guard !loading else { return }
        error = nil
        loading = true
        // Mientras se guardan las respuestas, la app no salta al panel con la rutina vacía.
        session.finishingSignup = true
        defer { loading = false; session.finishingSignup = false }
        do {
            let response = try await Backend.client.auth.verifyOTP(email: email, token: code, type: .signup)
            // Si algo falla al guardar, Inicio ofrece «Preparar mi rutina gratis»: nunca queda vacío.
            try? await draft.persist(userId: response.user.id)
            OnboardingDraft.clear()
            Haptics.success()
        } catch {
            let text = String(describing: error).lowercased()
            fail(text.contains("too many") || text.contains("rate") || text.contains("429")
                 ? "Demasiados intentos. Espera un minuto y vuelve a intentarlo."
                 : AccountStore.isNetworkError(error) ? "No hemos podido verificar el código. Comprueba la conexión e inténtalo de nuevo."
                 : "El código no es válido o ha caducado. Pide uno nuevo.")
        }
    }

    private func resend() async {
        error = nil
        do {
            try await Backend.client.auth.resend(email: email, type: .signup)
            notice = "Código reenviado. Revisa tu correo."
        } catch {
            fail("No hemos podido reenviar el código. Espera un momento y vuelve a intentarlo.")
        }
    }

    private func fail(_ message: String) {
        error = message
        Haptics.error()
    }
}

extension View {
    /// Teclado numérico con coma (solo iPhone/iPad).
    @ViewBuilder func decimalKeyboard() -> some View {
        #if os(iOS)
        self.keyboardType(.decimalPad)
        #else
        self
        #endif
    }

    /// Campo de código: el iPhone ofrece el que llega por correo encima del teclado.
    @ViewBuilder func oneTimeCode() -> some View {
        #if os(iOS)
        self.textContentType(.oneTimeCode).keyboardType(.numberPad)
        #else
        self
        #endif
    }
}
