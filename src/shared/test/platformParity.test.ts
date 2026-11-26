// @vitest-environment node
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { ADMIN_NAV_GROUPS } from "@/app/components/admin/adminNav";
import { DETAIL_SECTIONS, EQUIPMENT, FILTER_GROUPS, MODALITIES, exerciseCount } from "@/shared/lib/exerciseLibrary";

/**
 * La web grande comparte el menú lateral de Mac; la navegación móvil web mantiene
 * solo Hoy, Nutrición y Progreso. Entrenar se abre desde Inicio.
 */
const root = resolve(__dirname, "../../..");
const read = (p: string) => readFileSync(resolve(root, p), "utf8");
const swift = read("native/Autopilot/Features/Shell/RootView.swift");

/** `case .x: "Título"` de un `switch` concreto de RootView.swift. */
const swiftTitles = (prop: "title") => {
  const body = swift.slice(swift.indexOf(`var ${prop}: String {`));
  const block = body.slice(0, body.indexOf("\n    }\n"));
  return Object.fromEntries([...block.matchAll(/case \.(\w+): "([^"]+)"/g)].map((m) => [m[1], m[2]]));
};
const swiftList = (name: string) => {
  const m = swift.match(new RegExp(`static let ${name}: \\[AppSection\\] = \\[([^\\]]*)\\]`));
  return (m?.[1] ?? "").split(",").map((s) => s.trim().replace(/^\./, "")).filter(Boolean);
};
const titles = swiftTitles("title");

/** Títulos visibles de una lista de la web (`{ title: "…", section: "…" }` o `{ key: "…", label: "…" }`). */
const webItems = (file: string, list: string, label: "title" | "label", key: "section" | "key") => {
  const src = read(file);
  const block = src.slice(src.indexOf(`const ${list}`)).split("];")[0];
  return [...block.matchAll(new RegExp(`${label}: "([^"]+)",\\s*${key}: "(\\w+)"|${key}: "(\\w+)",\\s*${label}: "([^"]+)"`, "g"))]
    .map((m) => ({ title: m[1] ?? m[4], section: m[2] ?? m[3] }))
    .filter((i) => i.section !== "chat")
    .map((i) => i.title);
};

describe("paridad web ↔ apps nativas", () => {
  it("web grande = Mac: mismo menú lateral, en el mismo orden", () => {
    const mac = swiftList("userSections").map((s) => titles[s]);
    expect(mac).toHaveLength(5);
    // El chat solo sale en la web cuando se publica (releaseScope); la app aún no lo tiene.
    expect(webItems("src/app/components/UserSidebar.tsx", "NAV_ITEMS", "title", "section").filter((t) => t !== "Chat")).toEqual(mac);
    expect(mac).toEqual(["Inicio", "Ejercicios", "Nutrición", "Mi progreso", "Ajustes"]);
  });

  it("web móvil = iPhone: Hoy, Ejercicios, Nutrición y Progreso en la navegación principal", () => {
    const tabs = ["Hoy", "Ejercicios", "Nutrición", "Progreso"];
    expect(webItems("src/app/components/mobile/MobileTabBar.tsx", "TABS", "label", "key")).toEqual(tabs);
    expect(webItems("src/web/components/LandingSections.tsx", "PHONE_TABS", "label", "key")).toEqual(tabs);
    expect(swiftList("userTabs").map((t) => (t === "home" ? "Hoy" : t === "progress" ? "Progreso" : titles[t]))).toEqual(tabs);
  });

  it("Admin: mismos grupos y secciones en la web y en la app", () => {
    const groups = [...swift.matchAll(/\("([^"]+)", \[([^\]]*)\]\)/g)].map((m) => ({
      label: m[1],
      items: m[2].split(",").map((s) => titles[s.trim().replace(/^\./, "")]).filter(Boolean),
    }));
    expect(groups.length).toBeGreaterThan(4);
    expect(ADMIN_NAV_GROUPS.map((g) => ({ label: g.label, items: g.items.map((i) => i.title) }))).toEqual(groups);
  });

  it("Nutrición: sin portada y cada comida con su foto propia o ninguna, en la web y en la app", () => {
    const web = read("src/app/components/dashboard/MealsList.tsx");
    const app = read("native/Autopilot/Features/Other/OtherViews.swift");
    expect(web).not.toMatch(/coverPhoto/);
    expect(app).not.toMatch(/coverCard/);
    // La foto de respaldo solo vale para las tarjetas vacías, nunca repetida en las filas.
    expect(web).toMatch(/const src = useMealPhoto\(dish\);\s*if \(!src\) return null;/);
    expect(app).toMatch(/let photoURL = photos\[Self\.dish\(meal\)\][\s\S]*?if let url = photoURL/);
    expect(app).toMatch(/group\.addTask \{ \(dish, await AiCover\.ownMeal\(dish\)\) \}/);
  });

  it("Nutrición web: comidas compactas y los cálculos de macros intactos en ambas plataformas", () => {
    const web = read("src/app/components/dashboard/MealsList.tsx");
    const app = read("native/Autopilot/Features/Other/OtherViews.swift");
    const note = "Al marcar una comida se suman sus macros del plan. Es una estimación: no se pesa lo que comes.";
    expect(web).toContain(note);
    expect(app).toContain(note);
    const webRow = web.slice(web.indexOf("<div className=\"space-y-3\">"), web.indexOf("Regenerar comidas"));
    const appRow = app.slice(app.indexOf("private func mealRow"), app.indexOf("private func toggle", app.indexOf("private func mealRow")));
    expect(webRow).toMatch(/min-h-\[60px\]/);
    expect(webRow).toMatch(/line-clamp-1/);
    expect(webRow).not.toContain("mealIngredients");
    expect(webRow).not.toMatch(/own\.(protein|carbs|fats)/);
    // Esta petición solo compacta la web: la fila nativa mantiene su diseño actual.
    expect(appRow).toContain("let weighed = meal.weighed");
    expect(appRow).toMatch(/own\.protein/);
    // El reparto exacto vive en mealMacros.ts y la app lo replica.
    expect(web).toMatch(/mealMacros\(meals, \{ kcal, protein: p, carbs: c, fats: f \}\)/);
    expect(app).toMatch(/static func splitExact\(_ total: Double, _ weights: \[Double\]\) -> \[Int\]/);
  });

  it("Nutrición: una sola columna (resumen arriba, comidas debajo) también en Mac, como la web", () => {
    const web = read("src/app/components/dashboard/MealsList.tsx");
    const app = read("native/Autopilot/Features/Other/OtherViews.swift");
    expect(web).not.toMatch(/(md|lg):grid-cols/);
    expect(app).not.toMatch(/NutritionGrid|LazyVGrid/);
  });

  it("Nutrición: «Regenerar comidas» con la misma confirmación en la web y en la app", () => {
    const web = read("src/app/components/dashboard/MealsList.tsx");
    const app = read("native/Autopilot/Features/Other/OtherViews.swift");
    const note = "Recalcularemos el plan de comidas con tus datos actuales y sustituirá a las comidas guardadas cuando termine. El plan de entrenamiento no cambia.";
    for (const src of [web, app]) {
      expect(src).toContain("¿Regenerar tus comidas?");
      expect(src).toContain(note);
      // «Regenerar» en la cabecera de «Comidas de hoy», como en el iPhone.
      expect(src).toContain("Regenerando…");
      expect(src).toContain("Comidas de hoy");
    }
  });

  it("Scan: mismos avisos de error en la web y en la app, nunca el mensaje técnico del servidor", () => {
    const errors = read("src/shared/lib/scanErrors.ts");
    const app = read("native/Autopilot/Features/Scan/ScanView.swift");
    for (const msg of [
      "Has hecho muchos análisis seguidos. Espera un rato y vuelve a intentarlo.",
      "El análisis con IA está pausado: el servicio no tiene saldo. Estamos en ello; inténtalo más tarde.",
      "Sin conexión. Comprueba tu internet e inténtalo de nuevo.",
      "No hemos podido analizar las fotos. Inténtalo de nuevo en unos segundos.",
    ]) {
      expect(errors).toContain(msg);
      expect(app).toContain(msg);
    }
    expect(app).not.toMatch(/self\.error = "[^"]*\\\(serverMessage\)/);
    for (const file of ["src/app/pages/Scan.tsx", "src/app/components/scan/ProgressScan.tsx"]) {
      expect(read(file)).toMatch(/scanErrorMessage\(e\)/);
    }
  });

  it("Scan con cuenta: la web pinta las mismas pantallas que la app (subida, carga y resultado con el detalle de Plus)", () => {
    // Progreso → Scan y sus piezas (subida, resultado y Plus) frente a `ScanView.swift`.
    const web = ["ProgressScan", "ScanUploadParts", "ScanResultView", "ScanPlusCard"]
      .map((f) => read(`src/app/components/scan/${f}.tsx`)).join("\n");
    const plusCard = read("src/app/components/scan/ScanPlusCard.tsx");
    const app = read("native/Autopilot/Features/Scan/ScanView.swift");
    expect(read("src/app/pages/Dashboard.tsx")).toMatch(/<ProgressScan /);
    for (const text of [
      "Análisis físico con IA", "Foto de delante", "Foto de atrás", "Recomendada", "Opcional", "Cambiar foto",
      "Tu objetivo", "Sin definir", "Se usa para personalizar el análisis.", "Cómo tomar las fotos",
      "Cuerpo entero, de pie y con el móvil en vertical", "Cámara a 2-3 m, a la altura del ombligo",
      "Luz natural frontal, sin contraluz ni flash", "Ropa ajustada y fondo liso y claro",
      "Para la de atrás, date la vuelta sin moverte",
      "Analizar mi físico",
      "Con una sola foto ya podemos analizarte: valoraremos solo lo que se vea en esa vista. Con las dos fotos el análisis es más completo.",
      "Privado: solo para tu análisis · Menos de 1 minuto",
      "Tu físico", "Puntuación global de tu físico", "Sin puntuación global", "Atractivo", "Potencial", "Estilo",
      "Qué mejorar", "Hacer otro scan",
      "El análisis no se pudo guardar en tu historial.", "Las fotos no se pudieron guardar en tu historial.",
      "Lectura estimada por IA", "Es una estimación visual, no un diagnóstico médico.",
      "Composición corporal estimada", "Masa magra", "Peso est.", "Somatotipo", "Estructura", "Distribución de grasa",
      "Lectura por grupo muscular", "Proporciones y simetría", "Ratio hombro/cintura", "Ideal ~1,60", "V-taper", "Simetría",
      "Balance", "Eslabón más débil", "Postura",
      "Rasgos visuales que juegan a tu favor (o en contra)", "Señales observadas en tus fotos: no es un estudio genético.",
      "Protocolo recomendado por la IA", "Días de entreno por semana", "Series del grupo prioritario", "Proteína por kg",
      "Calorías frente a mantenimiento", "Cardio por semana", "Ejercicios clave", "Evita",
    ]) {
      expect(web, text).toContain(text);
      expect(app, text).toContain(text);
    }
    // Rediseño de ChatGPT: «Análisis completo (Plus)» con cada sección en su tarjeta.
    for (const text of ["Análisis completo (Plus)", "Este es tu scan básico. Desbloquea el análisis avanzado de tu físico con recomendaciones personalizadas:"]) {
      expect(plusCard, text).toContain(text);
      expect(app, text).toContain(text);
    }
    // La app guarda el resultado entero (con el detalle de Plus), no solo lo que pinta.
    expect(app).toMatch(/let fullResult = try JSONDecoder\(\)\.decode\(AnyJSON\.self, from: raw\)/);
    // La foto se sube como archivo en la web y en el Mac (allí la fototeca puede no existir),
    // reducida a 1600 px en JPEG: el servidor reconoce la misma foto venga de donde venga.
    expect(web).toMatch(/type="file"\s+accept="image\/\*"/);
    expect(app).toMatch(/\.fileImporter\(isPresented: \$importingFile, allowedContentTypes: \[\.image\]\)/);
    expect(web).toMatch(/compressImage\(await toBrowserFriendlyImage\(input\), \{ maxDimension: 1600/);
    expect(app).toMatch(/PlatformImage\.downscaled\(from: data, maxSide: 1600\)/);
  });

  it("Sin rutina: la misma invitación con botón en la web y en la app (Inicio y Entrenar), nunca «descansa»", () => {
    const web = read("src/app/pages/Dashboard.tsx");
    const card = read("native/Autopilot/Design/Components.swift");
    for (const text of [
      "Prepara tu rutina inicial gratis", "Te la preparamos en unos segundos.", "Preparar mi rutina gratis",
      "Preparando…", "No se ha podido preparar la rutina. Vuelve a intentarlo.",
    ]) {
      expect(web, text).toContain(text);
      expect(card, text).toContain(text);
    }
    // Las dos llaman a generate-plan sin `force`: una rutina manual nunca se sustituye.
    expect(web).toMatch(/generatePlanGuarded\(supabase, \{ user_id: user\?\.id \}/);
    expect(read("native/Autopilot/Core/Training.swift")).toMatch(/"generate-plan", options: FunctionInvokeOptions\(body: \["user_id": /);
    expect(read("native/Autopilot/Features/Home/HomeView.swift")).toMatch(/s\.noPlan == true \{[\s\S]*?StarterRoutineCard/);
    expect(read("native/Autopilot/Features/Train/TrainView.swift")).toMatch(/model\.days\.isEmpty \{[\s\S]*?StarterRoutineCard/);
  });

  it("Primer uso sin cuenta: misma bienvenida y mismo cuestionario de 3 pasos, con la cuenta al final", () => {
    const welcome = read("src/app/pages/Welcome.tsx");
    const quiz = read("src/app/pages/Configurator.tsx");
    const preview = read("src/app/components/PlanPreview.tsx");
    const app = read("native/Autopilot/Features/Auth/OnboardingView.swift");
    for (const text of [
      "AUTOPILOT", "Entrenamiento adaptativo", "Tu entrenamiento,", "en piloto automático.",
      "Rutina adaptativa que sube las cargas cada semana", "Nutrición: macros y comidas del día",
      "Todo en automático, tú solo apareces", "Crear mi rutina gratis", "Ya tengo cuenta",
    ]) {
      expect(welcome, text).toContain(text);
      expect(app, text).toContain(text);
    }
    // La bienvenida lleva al cuestionario, no a registrarse primero (probar sin cuenta, como la app).
    expect(welcome).toMatch(/navigate\("\/onboarding"\)/);
    expect(app).toMatch(/WelcomeView\(onStart: \{ go\(\.quiz\) \}/);
    for (const text of [
      "¿Qué quieres conseguir?", "Tu semana", "Tu plan Autopilot", "Cuéntanos tu objetivo y dónde entrenas.",
      "Elige al menos dos días. Ajustamos el plan a tu semana.",
      "Así queda con tus respuestas. Crea tu cuenta para guardar tu plan completo.",
      "Perder grasa", "Ganar músculo", "Recomposición", "Fuerza y salud", "Gimnasio", "Calistenia", "Mixto",
      "Individual", "En pareja", "30–45 min", "45–60 min", "60–90 min",
      "Empuje / Tirón / Pierna", "No lo sé, que Autopilot elija", "Tiempo por sesión", "Tu peso en kg (opcional)",
      "Mismo calendario, cargas adaptadas a cada uno.", "Guardar mi plan gratis",
      "Tipo de entrenamiento", "Modalidad", "Tu plan incluirá", "Rutina de entrenamiento personalizada",
      "Progresión de cargas", "Recomendaciones de nutrición", "Seguimiento de tu progreso",
      "y el tratamiento de mis datos de salud para preparar mi plan.",
    ]) {
      expect(quiz, text).toContain(text);
      expect(app, text).toContain(text);
    }
    for (const text of ["Día 1 · Empuje (Gimnasio)", "Día 1 · Full body híbrido", "Pike push-ups", "Tu nutrición diaria",
      "sesiones que se completarán al crear el plan", "Menús y cantidades al generar el plan."]) {
      expect(preview, text).toContain(text);
      expect(app, text).toContain(text);
    }
    // «¿Dónde entrenas?»: tres fotos iguales en 4:5; en la app el hueco manda y la foto lo rellena.
    expect(quiz).toMatch(/grid grid-cols-3 gap-2\.5/);
    expect(quiz).toContain("aspect-[4/5]");
    expect(app).toMatch(/Color\.clear\.aspectRatio\(4 \/ 5, contentMode: \.fit\)[\s\S]*?\.background \{\s*CachedAsyncImage/);
    // Mismos datos guardados: tabla, conflicto y disponibilidad.
    expect(quiz).toMatch(/from\("onboarding"\)\.upsert\(/);
    expect(app).toMatch(/from\("onboarding"\)\.upsert\(row, onConflict: "user_id"\)/);
    for (const key of ["training_days", "session_minutes", "checkin_dow", "coach_style", "training_mode", "partner_email"]) {
      expect(quiz, key).toContain(key);
      expect(app, key).toContain(key);
    }
    // La cuenta se crea y se verifica con el código dentro de la app, como en la web.
    for (const text of ["Crea tu cuenta", "Introduce el código", "Reenviar código", "Este correo ya está registrado.",
      "El código no es válido o ha caducado. Pide uno nuevo."]) {
      expect(read("src/app/pages/Signup.tsx") + read("src/app/pages/VerifyEmail.tsx"), text).toContain(text);
      expect(app, text).toContain(text);
    }
    expect(app).toMatch(/verifyOTP\(email: email, token: code, type: \.signup\)/);
    expect(read("native/Autopilot/Features/Shell/RootView.swift")).toMatch(/SignedOutView\(\)/);
  });

  it("Acceso: «¿Olvidaste la contraseña?» y «Crear una cuenta gratis» llevan a lo mismo en la web y en la app", () => {
    const web = read("src/app/pages/Login.tsx");
    const app = read("native/Autopilot/Features/Auth/LoginView.swift");
    expect(web).toContain("¿Olvidaste la contraseña?");
    expect(app).toContain("¿Olvidaste la contraseña?");
    expect(web).toContain(`<Link to="/onboarding" onClick={() => void hapticTap()}`);
    for (const text of ["¿Aún no tienes cuenta?", "Crear una cuenta gratis"]) {
      expect(web, text).toContain(text);
      expect(app, text).toContain(text);
    }
    for (const text of ["Recuperar contraseña", "Te enviaremos un enlace a tu correo.", "Enviar enlace", "Revisa tu correo", "Volver al inicio de sesión"]) {
      expect(read("src/app/pages/ForgotPassword.tsx"), text).toContain(text);
      expect(app, text).toContain(text);
    }
    // Nada apunta al dominio antiguo desde el acceso.
    expect(app).not.toContain("autopilotplan.app");
  });

  it("Rediseño compartido: logo con AUTOPILOT, campos con icono, insignia Plus, semana en círculos y Progreso en dorado, igual en la web y en la app", () => {
    // Acceso: el icono de la app y la palabra AUTOPILOT; campos con icono y ojo en la contraseña.
    const authWeb = read("src/app/components/auth/AuthScreenParts.tsx");
    const loginApp = read("native/Autopilot/Features/Auth/LoginView.swift");
    const signupApp = read("native/Autopilot/Features/Auth/OnboardingView.swift");
    expect(authWeb).toContain("<AppIconMark size={64} />");
    expect(authWeb).toContain("AUTOPILOT</span>");
    for (const app of [loginApp, signupApp]) {
      expect(app).toContain("AppIconMark(size: 64)");
      expect(app).toContain('Text("AUTOPILOT")');
    }
    expect(read("src/app/pages/Login.tsx")).toContain("icon={LockKeyhole}");
    expect(loginApp).toContain('icon: "lock")');
    expect(read("native/Autopilot/Design/Theme.swift")).toContain('reveal ? "Ocultar contraseña" : "Mostrar contraseña"');
    // Insignia Plus con candado en las secciones bloqueadas del scan.
    expect(read("src/app/components/scan/ScanPlusCard.tsx")).toContain("<PlusBadge />");
    expect(read("native/Autopilot/Features/Scan/ScanView.swift")).toContain("PlusBadge()");
    // Hoy: la sesión de un día ya hecha esta semana se marca «Hecha» (lo hecho sale de `day_completions`).
    const homeWeb = read("src/app/components/dashboard/HomeOverview.tsx");
    const homeApp = read("native/Autopilot/Features/Home/HomeView.swift");
    expect(homeWeb).toContain("completedDays.includes(planned.day)");
    expect(homeApp).toContain("Set(s.doneDays ?? []).contains(planned.day)");
    // Entrenar: lo hecho esta semana en tramos dorados, uno por sesión.
    expect(read("src/app/components/dashboard/TrainingPlanView.tsx")).toContain('doneThisWeek.includes(session.day) ? "bg-primary" : "bg-secondary"');
    expect(read("native/Autopilot/Features/Train/TrainView.swift")).toContain("Capsule().fill(doneThisWeek.contains(plan.day) ? Palette.gold : Palette.secondary)");
    // Progreso: control segmentado con la sección activa en dorado.
    expect(read("src/app/pages/Dashboard.tsx")).toContain("data-[state=active]:bg-primary data-[state=active]:text-primary-foreground");
    expect(read("native/Autopilot/Features/Progress/ProgressScreen.swift")).toContain("selection: $tab, gold: true)");
    // Barra de pestañas con la activa en dorado, sin píldora.
    expect(read("src/app/components/mobile/FloatingMobileNav.tsx")).toContain('isActive ? "text-primary" : "text-muted-foreground"');
    expect(read("native/Autopilot/Design/Components.swift")).toContain(".foregroundStyle(active ? Palette.gold : Palette.muted)");
    // Hoy minimalista (26-11-2026): la fecha, el nombre grande y una línea; la semana en píldoras que se
    // tocan (la elegida en dorado, hoy con un aro discreto y un punto en los días entrenados); la tarjeta
    // del día con su píldora dorada y tres cifras (kcal, proteína y sesiones). Nada más.
    for (const text of ["La constancia crea el cambio.", "Esta semana", "Entrenamiento", "Calorías", "Proteína", "Sesiones", "Por calcular", "Ver plan", "entrenaste", "Empezar", "Hecha"]) {
      expect(homeWeb, text).toContain(text);
      expect(homeApp, text).toContain(text);
    }
    expect(homeWeb).toContain('["L", "lunes"], ["M", "martes"], ["X", "miércoles"]');
    expect(homeApp).toContain('("L", "lunes"), ("M", "martes"), ("X", "miércoles")');
    expect(homeWeb).toContain('isSelected ? "btn-gold bg-primary text-primary-foreground" : "bg-card text-foreground"');
    expect(homeApp).toContain("if isSelected { GoldFill(shape: Capsule()) } else { SurfaceBackground(shape: Capsule()) }");
    expect(homeWeb).toContain('!isSelected && day.isToday && "ring-[1.5px] ring-inset ring-foreground/30"');
    expect(homeApp).toContain("if day.isToday && !isSelected { Capsule().strokeBorder(Palette.foreground.opacity(0.3), lineWidth: 1.5) }");
    expect(homeWeb).toContain("<Play ");
    expect(homeApp).toContain('Image(systemName: "play.fill")');
    // La web ancha y el Mac son el iPhone en una columna centrada, sin bloques distintos por ancho.
    expect(homeWeb).toContain("mx-auto flex w-full max-w-[680px] flex-col");
    expect(homeWeb).not.toMatch(/lg:hidden|hidden lg:block/);
    expect(homeApp).toContain(".frame(maxWidth: 680, alignment: .leading)");
    expect(homeApp).toMatch(/greetingHeader\s*weekStrip\s*daySection\s*dayFigures\s*\}/);
    // Mismas cifras: sin objetivo legible (Gratis), el estimado del onboarding en las dos.
    expect(read("src/app/pages/Dashboard.tsx")).toContain("(nutrition ? macros : null) ?? macroEstimate");
    expect(homeApp).toContain("MacroEstimate.load(userId: userId)");
    // Cabecera de Hoy con el AP y AUTOPILOT en las dos.
    expect(read("src/app/components/mobile/MobileHeader.tsx")).toContain("leading={brand ? <BrandLockup /> : undefined}");
    expect(read("src/app/components/mobile/MobileAppShell.tsx")).toContain('brand={active === "home"}');
    expect(read("native/Autopilot/Features/Shell/RootView.swift")).toContain("if current == .home { BrandLockup() }");
    // Entrenar sin semana: cualquier sesión se hace cualquier día. Título «Entrenar», las sesiones
    // en orden con foto («Sesión N», la siguiente destacada) y lo hecho esta semana; sin L–D ni descansos.
    const planWeb = read("src/app/components/dashboard/TrainingPlanView.tsx");
    const planApp = read("native/Autopilot/Features/Train/TrainView.swift");
    expect(read("src/app/pages/Dashboard.tsx")).toContain('training: "Entrenar"');
    expect(read("native/Autopilot/Features/Shell/RootView.swift")).toContain('case .train: "Entrenar"');
    for (const src of [planWeb, planApp]) {
      for (const text of ["Tus sesiones en orden. Hazlas el día que te venga bien.", "Sesión ", "Siguiente", "Hecha", "esta semana", "Tu plan aún no tiene sesiones", "Edita tu rutina para añadir tus sesiones."]) {
        expect(src, text).toContain(text);
      }
      for (const text of ['"L", "M", "X", "J", "V", "S", "D"', "es día de descanso", "Recuperación"]) {
        expect(src, text).not.toContain(text);
      }
    }
    expect(planWeb).toContain("<SessionRow");
    expect(planApp).toContain("sessionRow(index + 1, plan)");
    // La siguiente sesión sale de la misma regla en las dos: la primera de la rutina que falta esta semana.
    expect(read("src/shared/lib/routineOrder.ts")).toContain("sessions.find((session) => !doneThisWeek.includes(session.day))");
    expect(read("native/Autopilot/Core/Training.swift")).toContain("sessions.first { !done.contains($0.day) }");
    for (const src of [read("src/app/components/dashboard/HomeOverview.tsx"), read("native/Autopilot/Features/Home/HomeView.swift")]) {
      expect(src).toContain("Semana completa");
      expect(src).toContain("El lunes empieza otra vuelta.");
      expect(src).not.toContain("Hoy toca descansar");
    }
    // La tarjeta de la rutina va bajo las sesiones en las dos.
    expect(planWeb).toContain("{tools}");
    expect(planApp).toContain("if let routineBar { routineBar }");
    // Progreso de ChatGPT: «Tu fuerza» con la mejor marca (no la última: es la serie de más 1RM), la subida en kg y «Tu constancia» debajo.
    const progressWeb = read("src/app/components/dashboard/WorkoutProgress.tsx") + read("src/app/pages/Dashboard.tsx");
    const progressApp = read("native/Autopilot/Features/Progress/ProgressScreen.swift");
    for (const text of ["Tu fuerza", "Mejor marca", "Ver todos mis ejercicios", "Ver menos ejercicios", "Tu constancia"]) {
      expect(progressWeb, text).toContain(text);
      expect(progressApp, text).toContain(text);
    }
    expect(progressWeb).toContain("exerciseRecord(history)");
    expect(progressApp).toContain("static func record(_ entries: [ExerciseEntry])");
    // Ajustes de ChatGPT: índice agrupado con iconos que lleva a cada sección, en las dos.
    const settingsWeb = read("src/app/components/SettingsPanel.tsx");
    const settingsApp = read("native/Autopilot/Features/Account/AccountView.swift");
    for (const text of ["Mi cuenta", "Perfil", "Tus datos y objetivo", "Mi plan", "Cuentas en este dispositivo",
      "Preferencias", "Tu forma de entrenar", "Contraseña", "Privacidad y legal", "Privacidad y mis datos", "Legal"]) {
      expect(settingsWeb, text).toContain(text);
      expect(settingsApp, text).toContain(text);
    }
    // Minimalista, como Ajustes de iOS: sin subtítulo de página ni de fila, en las dos.
    for (const text of ["Gestiona tu cuenta, plan y preferencias.", "Nombre, foto y privacidad", "Cierra tu sesión en este dispositivo."]) {
      expect(settingsWeb, text).not.toContain(text);
      expect(settingsApp, text).not.toContain(text);
    }
    // Cada fila del índice abre su página (sin la lista completa debajo): ids en la web, `SettingsPage` en la app.
    for (const id of ["ajustes-perfil", "ajustes-datos", "ajustes-plan", "ajustes-entreno", "ajustes-contrasena", "ajustes-privacidad", "ajustes-legal", "ajustes-cuentas"]) {
      expect(settingsWeb, id).toContain(`id="${id}"`);
    }
    expect(settingsApp).toContain("case perfil, datos, plan, entreno, contrasena, privacidad, legal, cuentas");
    // Sin banner de Plus arriba del índice, en ninguna de las dos.
    for (const src of [settingsWeb, settingsApp]) expect(src).not.toContain("Más análisis, nutrición y funciones.");
    // Nutrición Gratis: misma cuenta, mismos macros. Sin plan legible, grasas al 25 % de las kcal y el resto en carbohidratos en las dos.
    expect(read("src/shared/lib/nutrition.ts")).toContain("Math.round((kcal * 0.25) / 9)");
    expect(read("native/Autopilot/Design/Components.swift")).toContain("(kcal * 0.25 / 9).rounded()");
    expect(settingsApp).toContain(".navigationDestination(item: $openPage)");
    // Onboarding de ChatGPT: preguntas en negrita, opciones en tarjetas con icono y círculo de selección.
    const quizWeb = read("src/app/pages/Configurator.tsx");
    const quizApp = read("native/Autopilot/Features/Auth/OnboardingView.swift");
    for (const text of ["¿Cómo vas a entrenar?", "¿Cuál es tu objetivo principal?", "¿Dónde entrenas habitualmente?"]) {
      expect(quizWeb, text).toContain(text);
      expect(quizApp, text).toContain(text);
    }
    expect(quizWeb).toContain("<SelectMark on={on} />");
    expect(quizApp).toContain("selectMark(on)");
  });

  it("Nutrición de ChatGPT: anillo de calorías con macros al lado y Plus en un solo grupo, igual en la web y en la app", () => {
    // Nutrición de ChatGPT: anillo de calorías con las barras de macros al lado y «Registra tus comidas» (Plus) en un solo grupo con candados, sin pagos externos en la app.
    const nutritionWeb = read("src/app/components/dashboard/BasicNutrition.tsx") + read("src/app/components/dashboard/NutritionPlusSection.tsx") + read("src/app/components/dashboard/NutritionHero.tsx");
    const nutritionApp = read("native/Autopilot/Features/Other/OtherViews.swift");
    for (const text of ["Controla tu alimentación y alcanza tu objetivo.", "kcal al día", "Proteína", "Hidratos", "Grasas", "Registra tus comidas", "Disponible en Plus.",
      "Objetivo de", "Resumen de hoy",
      "Comidas de cada día", "Ajustadas a tus macros y a lo que te gusta.", "Seguimiento de macros", "Marca cada comida y se suman sus macros.", "Menú a tu gusto", "Regenera tus comidas cuando quieras.", "Incluido en Plus",
      "Estimación inicial según tus datos y objetivo. No sustituye una valoración nutricional individual."]) {
      expect(nutritionWeb, text).toContain(text);
      expect(nutritionApp, text).toContain(text);
    }
    expect(nutritionWeb).toContain("onUpgrade && !isIOSNative()");
    expect(nutritionApp).not.toContain("Descubre Autopilot Plus");
    expect(nutritionWeb).toContain("carbs: targets.carbs");
    expect(nutritionWeb).toContain("fats: targets.fats");
    // La misma cabecera en las dos: anillo de 136 con trazo 12 (reparto en oro, oro 60 % y oro 32 %, o lo marcado) y una tarjeta de 28.
    const hero = read("src/app/components/dashboard/NutritionHero.tsx");
    expect(hero).toMatch(/size=\{136\} stroke=\{12\}/);
    expect(hero).toContain('"hsl(var(--primary) / 0.6)", "hsl(var(--primary) / 0.32)"');
    expect(hero).toContain("rounded-[28px]");
    expect(nutritionApp).toContain("[Palette.gold, Palette.gold.opacity(0.6), Palette.gold.opacity(0.32)]");
    expect(nutritionApp).toMatch(/\.frame\(width: 136, height: 136\)/);
    expect(nutritionApp).toContain(".surface(Radius.hero)");
    expect(read("src/app/components/dashboard/MealsList.tsx")).toContain("<NutritionHero");
    expect(read("src/app/components/dashboard/BasicNutrition.tsx")).toContain("<NutritionHero");
    expect(nutritionApp).toContain("nutritionHero(kcal: kcal, p: p, c: c, f: f, eaten: hasMeals ? eatenToday : nil");
  });

  it("Web ancha, iPad y Mac: Hoy, Nutrición, Ejercicios y Progreso en la misma columna centrada de 680, como el iPhone ampliado", () => {
    const dash = read("src/app/pages/Dashboard.tsx");
    expect(dash).toContain('className="mx-auto w-full min-w-0 max-w-[680px] space-y-4"');
    expect(read("src/app/components/dashboard/MealsList.tsx")).toContain('className="mx-auto w-full max-w-[680px] space-y-8"');
    expect(read("src/app/components/dashboard/BasicNutrition.tsx")).toContain("mx-auto w-full max-w-[680px]");
    expect(read("src/app/components/library/ExerciseLibrarySheet.tsx")).toContain("mx-auto flex w-full max-w-[680px] flex-col");
    for (const file of ["native/Autopilot/Features/Other/OtherViews.swift", "native/Autopilot/Features/Train/ExerciseLibraryView.swift", "native/Autopilot/Features/Progress/ProgressScreen.swift", "native/Autopilot/Features/Home/HomeView.swift"]) {
      expect(read(file), file).toContain(".frame(maxWidth: 680");
    }
  });

  it("Ajustes: cada icono del índice en una losa redondeada de 32 (como las filas de Plus), en la web y en la app", () => {
    expect(read("src/app/components/SettingsPanel.tsx")).toContain('className="flex h-8 w-8 items-center justify-center rounded-[9px] bg-secondary"');
    expect(read("native/Autopilot/Features/Account/AccountView.swift")).toContain(".background(Palette.secondary, in: RoundedRectangle(cornerRadius: 9, style: .continuous))");
  });

  it("Nutrición sin peso: Gratis ve «Calcula tus macros» en la web y en la app, no solo la tarjeta de Plus", () => {
    const web = read("src/app/components/dashboard/BasicNutrition.tsx");
    const app = read("native/Autopilot/Features/Other/OtherViews.swift");
    for (const text of ["Calcula tus macros", "Dinos tu peso y te damos tus calorías y tu proteína del día. Gratis.", "Tu peso en kg", "Calcular mis macros", "No se pudo guardar tu peso. Vuelve a intentarlo.", "sync-nutrition-macros"]) {
      expect(web, text).toContain(text);
      expect(app, text).toContain(text);
    }
    expect(read("src/app/pages/Dashboard.tsx")).toContain("<BasicNutrition userId={user.id}");
    expect(app).toMatch(/if !hasMeals && kcal <= 0 \{[\s\S]*?MacrosWeightCard\(userId: id\)/);
  });

  it("Fotos: la web y la app piden a Supabase la versión reducida (WebP de pocos KB), nunca el PNG original", () => {
    const web = read("src/shared/lib/fastImage.ts");
    const app = read("native/Autopilot/Design/Components.swift");
    for (const part of ["/storage/v1/render/image/public/", "resize=contain&quality=55", "1000"]) {
      expect(web, part).toContain(part);
      expect(app, part).toContain(part);
    }
    expect(app).toContain('"image/webp,image/*"');
    expect(read("native/Autopilot/Features/Scan/ScanView.swift")).toContain("ImageCache.fastURL(url, maxSide: maxSide)");
    expect(read("src/shared/lib/brandPhotos.ts")).toContain("fastImage(");
    // Las miniaturas a 192 px (`THUMB_SIDE`, 64 pt × 3) y las portadas a 1000 (`HERO_SIDE`), los mismos
    // escalones en la web (`IMAGE_SIDES`) y en la app (`MediaSizing.sides`).
    expect(read("src/app/components/ExerciseMedia.tsx")).toContain("fastImage(image, THUMB_SIDE)");
    expect(web).toContain("export const IMAGE_SIDES = [96, 192, 384, 480, 640, 1000] as const;");
    expect(app).toContain("static let sides: [CGFloat] = [96, 192, 384, 480, 640, 1000]");
  });

  it("Código del alta: el correo sale en la misma petición y la función que lo envía ya está despierta, en la web y en la app", () => {
    const web = read("src/app/pages/Signup.tsx");
    const app = read("native/Autopilot/Features/Auth/OnboardingView.swift");
    for (const src of [web, app]) {
      expect(src).not.toContain('"check-availability", options');
      expect(src).toContain('"auth-email-hook"');
    }
    expect(web).not.toMatch(/await supabase\.functions\.invoke\("check-availability", \{\s*body: \{ email: email\.trim\(\) \},\s*\}\)/);
    expect(app).toContain("response.user.identities?.isEmpty == true");
    expect(read("src/shared/contexts/AuthContext.tsx")).toContain("exists: data?.user?.identities?.length === 0");
  });

  it("Entreno: ejercicio a ejercicio por defecto, carrusel arriba y foto grande en foco, «···» con opciones claras y lo avanzado oculto", () => {
    const web = read("src/app/components/dashboard/WorkoutTracker.tsx");
    const prefs = read("src/shared/lib/workoutPreferences.ts");
    const app = read("native/Autopilot/Features/Train/WorkoutView.swift");
    expect(prefs).toContain('=== "list" ? "list" : "focus"');
    expect(app).toContain('@AppStorage("workout-view") private var workoutView = "focus"');
    expect(read("native/Autopilot/Features/Account/AccountView.swift")).toContain('forKey: "workout-view") ?? "focus"');
    for (const text of ["Ver toda la sesión", "Ver ejercicio a ejercicio", "Más opciones por serie", "Descartar entrenamiento"]) {
      expect(web, text).toContain(text);
      expect(app, text).toContain(text);
    }
    // Bajada, calentamiento (y en la app RPE y fallo) solo con «Más opciones por serie».
    expect(web).toContain("isCurrent && advanced && (");
    expect(app).toContain("if isCurrent && advanced {");
    expect(app).toContain('if advanced { Text("RPE")');
    // Carrusel numerado antes que la foto, y la foto rellena el hueco.
    const webFocus = web.slice(web.indexOf("Carrusel numerado"));
    expect(webFocus.indexOf('role="tablist"')).toBeLessThan(webFocus.indexOf("fetchpriority"));
    expect(webFocus).toContain('loading="eager" className="h-full w-full object-cover"');
    const appFocus = app.slice(app.indexOf("struct FocusViewer"));
    expect(appFocus.indexOf("ScrollView(.horizontal")).toBeLessThan(appFocus.indexOf("CachedAsyncImage"));
    // El ejercicio en grande: 16:10 hasta un tercio de la pantalla en el móvil y 340 en ancho.
    expect(appFocus).toContain(".frame(height: mediaHeight)");
    expect(appFocus).toContain("sizeClass == .regular ? 340 : 230");
    expect(web).toContain("aspect-[16/10] max-h-[32dvh]");
    expect(web).toContain("md:max-h-[340px]");
    // La foto no se repite: sin miniatura en la cabecera del ejercicio en foco.
    expect(web).toMatch(/\{focused \? \(\s*<div className="flex items-start gap-2 pt-4">\s*\{exerciseText\}\s*\{exerciseMenu\}/);
    const focusedHeader = app.slice(app.indexOf("private var focusedHeader"), app.indexOf("private var listHeader"));
    expect(focusedHeader).not.toContain("WorkoutThumb");
    expect(app.slice(app.indexOf("private var listHeader"))).toMatch(/^private var listHeader[\s\S]*?WorkoutThumb\(url: exercise\.image_url/);
  });

  it("Nombre e icono de cada sesión: mismos emojis, misma sugerencia y mismo campo `session_icon`, en la web y en la app", () => {
    const web = read("src/shared/lib/sessionIdentity.ts");
    const app = read("native/Autopilot/Core/Training.swift");
    const list = (source: string, pattern: RegExp) => JSON.parse(`[${source.match(pattern)![1]}]`);
    expect(list(app, /static let emojis = \[([^\]]+)\]/)).toEqual(list(web, /SESSION_EMOJIS = \[([^\]]+)\]/));
    for (const name of ["Cuerpo completo", "Empuje", "Tirón", "Pierna", "Torso", "Entreno"]) {
      expect(web, name).toContain(`"${name}"`);
      expect(app, name).toContain(`"${name}"`);
    }
    expect(app).toContain("var session_icon: String?");
    expect(read("supabase/functions/_shared/training-types.ts")).toContain("session_icon?: string;");
    const train = read("native/Autopilot/Features/Train/TrainView.swift");
    const sheet = read("src/app/components/dashboard/SessionIdentitySheet.tsx");
    for (const text of ["Personalizar sesión", "Sugerido:", "La foto de la sesión o un emoji. El sugerido, con el punto dorado, sale de sus ejercicios."]) {
      expect(sheet, text).toContain(text);
      expect(train, text).toContain(text);
    }
    expect(read("src/app/components/dashboard/TrainingPlanView.tsx")).toContain("Nombre e icono");
    expect(train).toContain('Label("Nombre e icono", systemImage: "pencil")');
    // Solo se tocan esos dos campos: el modo del plan (custom) no cambia.
    expect(app).toContain('object["session_icon"] = .string(icon)');
    expect(read("src/app/pages/Dashboard.tsx")).toContain("withSessionIdentity(dayPlans, day, identity)");
  });

  it("«¿Quién entrena?» y el icono: misma cabecera que el login y el icono de la marca, en la web y en la app", () => {
    const web = read("src/shared/components/native/WhoIsTraining.tsx");
    const app = read("native/Autopilot/Features/Auth/WhoIsTrainingView.swift");
    for (const text of ["¿Quién entrena?", "Elige tu cuenta. Marca una como predeterminada y entrará sola al abrir la app.", "Añadir cuenta", "Otra persona en este dispositivo", "AUTOPILOT"]) {
      expect(web, text).toContain(text);
      expect(app, text).toContain(text);
    }
    expect(web).toContain("<AppIconMark size={64} />");
    expect(app).toContain("AppIconMark(size: 64)");
    expect(web).not.toContain("radial-gradient");
    // Los iconos salen de la misma geometría que `BrandMark`, con el negro y el dorado de la app.
    const icons = read("scripts/gen-icon.mjs");
    expect(icons).toContain('path("BRAND_A")');
    expect(icons).toContain('path("BRAND_P")');
    // El monograma AP (12-11-2026): misma geometría en la web y en nativo, sin el rayo de antes.
    const markGeometry = read("src/shared/components/ui/brand-mark.tsx");
    const nativeMark = read("native/Autopilot/Design/Components.swift");
    expect(markGeometry).not.toContain("BRAND_BOLT");
    for (const anchor of ["382 50", "396 34", "775 378", "770 148"]) expect(markGeometry, anchor).toContain(anchor);
    for (const anchor of ["pt(382, 50)", "pt(396, 34)", "pt(775, 211.5)", "pt(770, 210)"]) expect(nativeMark, anchor).toContain(anchor);
    expect(icons).toContain('const GOLD = "#D8B25E"');
    expect(read("native/Autopilot/Assets.xcassets/LaunchBackground.colorset/Contents.json")).toContain('"red":"0.042"');
    // El icono de las pantallas sale del mismo generador en los dos lados, con las
    // esquinas del iPhone; la bienvenida lo usa a 52 y el arranque, en el sitio del splash (110 de 240).
    const markWeb = read("src/shared/components/ui/app-icon-mark.tsx");
    const markApp = read("native/Autopilot/Design/Components.swift");
    expect(markWeb).toContain("BRAND_A");
    expect(markWeb).not.toContain(".png");
    expect(markApp).toMatch(/struct AppIconMark: View[\s\S]*?Image\("Logo"\)/);
    expect(markWeb).toContain("size * 0.2237");
    expect(markApp).toContain("size * 0.2237");
    expect(icons).toContain('"native/Autopilot/Assets.xcassets/Logo.imageset/logo.png"');
    expect(read("src/app/pages/Welcome.tsx")).toContain("<AppIconMark size={52} />");
    expect(read("native/Autopilot/Features/Auth/OnboardingView.swift")).toContain("AppIconMark(size: 52)");
    expect(icons).toContain("1024 * 110 / 240");
    expect(read("native/Autopilot/Features/Shell/RootView.swift")).toContain("AppIconMark(size: 110)");
  });

  it("App fluida: pestañas sin fundido, «Empezar» sin esperas fijas y Hoy pintado desde la caché en frío", () => {
    const components = read("native/Autopilot/Design/Components.swift");
    expect(components).not.toMatch(/withAnimation\([^)]*\)\s*\{\s*selection = tab/);
    const home = read("native/Autopilot/Features/Home/HomeView.swift");
    const root = read("native/Autopilot/Features/Shell/RootView.swift");
    expect(home).not.toContain("Task.sleep(for: .milliseconds(450))");
    expect(root).not.toContain("asyncAfter(deadline: .now() + 0.6)");
    expect(root).toContain("TrainView.pendingStart = true");
    // Primer fotograma: TodayCache cae al disco y se rehace tras terminar o editar (revisión local).
    expect(home).toContain("TrainingRepo.revision(userId: userId)");
    expect(home).toContain("HomeView.latestKey(userId)");
    const training = read("native/Autopilot/Core/Training.swift");
    expect(training).toContain("rows.append([day, date])");
    expect(read("native/Autopilot/Features/Train/PlanEditorView.swift")).toContain("TrainingRepo.storePlanLocally(userId: userId, clean)");
  });

  it("Campana de avisos: la web y las apps leen los mismos avisos, con contador y la misma hoja", () => {
    const web = read("src/app/components/NotificationsBell.tsx");
    const native = read("native/Autopilot/Features/Shell/NotificationsBell.swift");
    for (const text of ["Notificaciones", "Sin notificaciones", "Aquí verás los cambios en tu plan y los recordatorios."]) {
      expect(web).toContain(text);
      expect(native).toContain(text);
    }
    expect(native).toContain('from("notifications")');
    // En el móvil va junto al avatar (MobileHeader) y en escritorio, en la barra superior.
    expect(read("src/app/components/mobile/MobileHeader.tsx")).toContain("<NotificationsBell");
    expect(read("native/Autopilot/Design/Components.swift")).toContain("NotificationsBell()");
    expect(read("src/app/pages/Dashboard.tsx")).toContain("<NotificationsBell");
    expect(read("native/Autopilot/Features/Shell/RootView.swift")).toContain("ToolbarItem(placement: .primaryAction) { NotificationsBell() }");
  });

  it("Al abrir se entra directo con la última cuenta: «¿Quién entrena?» solo si está protegida, en la web y en la app", () => {
    expect(read("native/Autopilot/Core/Session.swift")).toContain("showPicker = currentLocked\n");
    expect(read("src/shared/components/native/WhoIsTraining.tsx")).toContain("if (!shown && currentLocked) showPicker();");
  });

  it("«¿Quién entrena?»: una tarjeta por persona (mismo correo = misma cuenta), al guardar y al leer, en la web y en la app", () => {
    const web = read("src/shared/lib/accounts.ts");
    const app = read("native/Autopilot/Core/Accounts.swift");
    expect(web).toContain("uniqueAccounts(raw.filter(");
    expect(web).toContain("const list = uniqueAccounts(all.map(");
    expect(app).toContain("return Self.unique((try? JSONDecoder()");
    expect(app).toContain("var list = Self.unique(accounts.map {");
    // Gana la que sigue valiendo y la contraseña opcional nunca se pierde.
    expect(web).toContain("const keep = a.expired && !out[j].expired ? out[j] : a;");
    expect(app).toContain("var keep = a.expired && !out[j].expired ? out[j] : a");
    expect(web).toContain("requirePassword: out[j].requirePassword || a.requirePassword");
    expect(app).toContain("keep.requirePassword = out[j].requirePassword || a.requirePassword");
  });

  it("Plan y progreso: portada de la sesión también en iPhone y, sin entrenos, una invitación en vez de «0 kg»", () => {
    const train = read("native/Autopilot/Features/Train/TrainView.swift");
    // Rediseño: la foto de cada sesión va en su fila del plan semanal.
    expect(train).toContain("CachedAsyncImage(url: URL(string: source), maxSide: 300)");
    const title = "Tu progreso empieza con tu primer entreno";
    const message = "Marca tus series al entrenar y aquí verás tus kilos, tu racha y tus récords.";
    for (const src of [read("src/app/components/dashboard/WorkoutProgress.tsx"), read("native/Autopilot/Features/Progress/ProgressScreen.swift")]) {
      expect(src).toContain(title);
      expect(src).toContain(message);
    }
    expect(read("native/Autopilot/Features/Progress/ProgressScreen.swift")).toContain("if !(model.detailsLoaded && model.history.isEmpty) { strengthCard }");
  });

  it("Ajustes: sin «Deportes» y sin nada de comida hasta tener Plus, en la web y en la app", () => {
    const web = read("src/app/components/SettingsPanel.tsx");
    const app = read("native/Autopilot/Features/Account/AccountView.swift");
    expect(web).not.toContain('header="Deportes"');
    expect(app).not.toContain('group("Deportes")');
    for (const text of ["Lo que te gusta", "Lo que no comes", "Preferencias nutricionales", "Alergias y otros alimentos a evitar"]) {
      expect(web.indexOf(text), text).toBeGreaterThan(web.indexOf("{hasPaidAccess && <>"));
      expect(app.indexOf(text), text).toBeGreaterThan(app.indexOf("if hasPlus {"));
    }
    expect(web.indexOf("{hasPaidAccess && <>")).toBeGreaterThan(0);
    expect(app.indexOf("if hasPlus {")).toBeGreaterThan(0);
    // Lo oculto tampoco se envía al guardar: un fallo al cargar no puede borrarlo.
    expect(web).toContain("...(hasPaidAccess ? { nutrition_preferences:");
    expect(web).not.toContain("sports: onboarding.sports");
    expect(app).toContain("nutrition_preferences: hasPlus ? nutritionPrefs : nil");
    expect(app).not.toContain("sports: sports,");
  });

  it("Color en el entreno: un solo dorado (serie actual y hecha) y «Finalizar» dorado en la barra inferior, en la web y en la app", () => {
    const web = read("src/app/components/dashboard/WorkoutTracker.tsx");
    const app = read("native/Autopilot/Features/Train/WorkoutView.swift");
    expect(web).not.toContain("allSetsDone");
    expect(app).toContain('barLabel("Finalizar", symbol: "checkmark", primary: true)');
    // Serie y ejercicio hechos en dorado (círculo relleno, fila y número del carrusel tintados), nunca en verde.
    expect(web).toContain(': "bg-primary text-primary-foreground"');
    expect(web).toContain('set.done && !isWarmup ? "bg-primary/15"');
    expect(web).toContain('done ? "bg-primary/15 text-primary"');
    expect(app).toContain("Circle().fill(set.done ? (isWarmup ? Palette.muted : Palette.gold) : Palette.secondary)");
    expect(app).toContain(".fill(set.done && !isWarmup ? Palette.gold.opacity(0.15) : .clear)");
    expect(app).toContain('Image(systemName: "checkmark").font(.inter(size: 18, weight: .bold))');
    // Título del ejercicio, «Salir» y «···» en blanco (en la lista, el ejercicio hecho en gris).
    expect(app).toContain(".foregroundStyle(allDone && !focused ? Palette.muted : Palette.foreground)");
    expect(web).not.toMatch(/pl-0\.5 pr-2 text-primary/);
    expect(app).not.toContain('Image(systemName: "ellipsis").font(.inter(size: 15, weight: .bold)).foregroundStyle(Palette.gold)');
  });

  it("Entreno activo (diseño ChatGPT): cabecera con avance, ejercicios numerados y plegables, y barra Pausar · tiempo · Finalizar con pausa real", () => {
    const web = read("src/app/components/dashboard/WorkoutTracker.tsx");
    const app = read("native/Autopilot/Features/Train/WorkoutView.swift");
    const model = read("native/Autopilot/Features/Train/ActiveWorkout.swift");
    for (const text of ["Pausar", "Reanudar", "En pausa", "Finalizar", "ejercicios"]) {
      expect(web, text).toContain(text);
      expect(app, text).toContain(text);
    }
    // La pausa se guarda en el borrador y, al reanudar, inicio y descanso se desplazan lo que duró.
    expect(read("src/shared/lib/activeWorkout.ts")).toContain("pausedAt?: number | null;");
    expect(web).toContain("setSessionStartedAt((start) => start === null ? start : start + shift);");
    expect(web).toContain("setRestEndsAt((end) => end === null ? end : end + shift);");
    expect(model).toContain("var pausedAt: Date? = nil");
    expect(model).toContain("draft.startedAt = draft.startedAt.addingTimeInterval(shift)");
    expect(model).toContain("let newEnd = end.addingTimeInterval(shift)");
    // En pausa el descanso se congela y la sesión no se puede anotar.
    expect(web).toContain("if (pausedAt !== null) { setRestTimerState(remainingRestSeconds(restEndsAt, pausedAt)); return; }");
    expect(app).toContain("end.timeIntervalSince(workout.draft.pausedAt ?? ctx.date)");
    expect(app).toContain(".disabled(workout.isPaused)");
    // Número de orden en la esquina y ejercicios plegables en la lista.
    expect(web).toContain("i === currentExerciseIndex ? \"bg-primary text-primary-foreground\"");
    expect(app).toContain("allDone || isCurrentExercise ? Palette.gold : Palette.secondary");
    expect(web).toContain("closedExercises.includes(i)");
    expect(app).toContain("workout.closedExercises.contains(index)");
  });

  it("Primer uso: Individual / En pareja son filas de una línea, como «Perder grasa», en la web y en la app", () => {
    for (const src of [read("src/app/pages/Configurator.tsx"), read("native/Autopilot/Features/Auth/OnboardingView.swift")]) {
      expect(src).not.toContain("Un plan solo para ti");
      expect(src).not.toContain("Entrenáis juntos con un plan para los dos");
    }
  });

  it("Ejercicio en movimiento: bucle corto, mudo y sin controles sobre la foto, y foto fija con «reducir movimiento», en la web y en la app", () => {
    const web = read("src/app/components/dashboard/WorkoutTracker.tsx");
    const app = read("native/Autopilot/Features/Train/WorkoutView.swift");
    const loopWeb = read("src/app/components/ExerciseLoop.tsx");
    const loopApp = read("native/Autopilot/Design/ExerciseLoopView.swift");
    expect(existsSync(resolve(root, "native/Autopilot/Design/LoopingVideo.swift"))).toBe(false);
    // Una sola pieza por plataforma: `ExerciseLoop` (web) y `ExerciseLoopView` (app).
    expect(loopWeb).toMatch(/<video[\s\S]*?autoPlay\s+muted\s+loop\s+playsInline[\s\S]*?controls=\{false\}/);
    expect(loopWeb).toContain("poster={poster ?? undefined}");
    expect(loopApp).toContain("player.isMuted = true");
    expect(loopApp).toContain("AVPlayerLooper(player: player, templateItem: item)");
    expect(loopApp).toContain(".allowsHitTesting(false)");
    // El visor del entreno usa la pieza común sobre la foto, nunca un <video> propio.
    expect(web).toContain("<ExerciseLoop key={vid ?? active.name} src={vid} poster={img} priority />");
    expect(web).not.toContain("<video");
    expect(app).toContain("ExerciseLoopView(url: current ? clip : nil, hero: true) {");
    expect(app).not.toContain("LoopingVideo(");
  });

  it("Ejercicio en movimiento: mismas reglas del bucle en la web y en la app (clip propio, foto debajo, solo en pantalla, seis vivos, foto fija con reducir movimiento, ahorro de datos o bajo consumo)", () => {
    const rules = read("src/shared/lib/exerciseLoop.ts");
    const loopWeb = read("src/app/components/ExerciseLoop.tsx");
    const loopApp = read("native/Autopilot/Design/ExerciseLoopView.swift");
    const num = (src: string, re: RegExp) => Number(src.match(re)?.[1]);
    // Solo clips directos propios: nunca GIF, YouTube ni imágenes de terceros.
    expect(rules).toContain('export const LOOP_EXTENSIONS = ["mp4", "mov", "m4v"] as const;');
    expect(loopApp).toContain('static let extensions = ["mp4", "mov", "m4v"]');
    for (const src of [rules, loopWeb, loopApp]) expect(src).not.toMatch(/\.gif|gifUrl|exercisedb|gymvisual/i);
    // Seis bucles vivos como mucho, dos en reserva y 150 ms de espera al entrar en pantalla.
    expect(num(rules, /MAX_LIVE_LOOPS = (\d+)/)).toBe(num(loopApp, /static let maxLive = (\d+)/));
    expect(num(rules, /MAX_WARM_LOOPS = (\d+)/)).toBe(num(loopApp, /static let maxWarm = (\d+)/));
    expect(num(rules, /LOOP_START_DELAY_MS = (\d+)/)).toBe(num(loopApp, /static let startDelayMs = (\d+)/));
    // Foto fija con reducir movimiento, ahorro de datos o bajo consumo (la misma regla en las dos).
    expect(rules).toContain("!reducedMotion && !saveData && !lowPower");
    expect(loopApp).toContain("!reduceMotion && !saveData && !lowPower");
    expect(loopWeb).toContain('"(prefers-reduced-motion: reduce)"');
    expect(loopWeb).toContain("saveData === true");
    expect(loopApp).toContain("ProcessInfo.processInfo.isLowPowerModeEnabled");
    expect(loopApp).toContain(".NSProcessInfoPowerStateDidChange");
    expect(loopApp).toContain("path.isConstrained");
    expect(loopApp).toContain("@Environment(\\.accessibilityReduceMotion)");
    // Solo se mueve lo que se ve: IntersectionObserver en la web, onAppear/onDisappear con reserva compartida en la app.
    expect(loopWeb).toContain("new IntersectionObserver(");
    expect(loopWeb).toContain('document.addEventListener("visibilitychange", sync)');
    expect(loopApp).toMatch(/\.onDisappear \{[\s\S]*?give\(\)/);
    expect(loopApp).toContain("final class ExerciseLoopPool");
    expect(loopApp).toContain("if !hero && live >= LoopRules.maxLive { return nil }");
    // La foto siempre debajo y el vídeo con fundido cuando su primer fotograma está listo (nunca negro).
    expect(loopWeb).toContain('ready ? "opacity-100" : "opacity-0"');
    expect(loopWeb).toContain("onPlaying={() => setReady(true)}");
    expect(loopApp).toContain("observe(\\.isReadyForDisplay");
    expect(loopApp).toContain(".opacity(ready ? 1 : 0)");
    expect(loopApp).toMatch(/ZStack \{\s*still\s*if let url, !paused/);
    expect(loopApp).toContain("videoGravity = .resizeAspectFill");
    // Siguiente ejercicio precargado en el entreno: cambiar es instantáneo.
    expect(rules).toContain("export const nextLoopIndex");
    expect(loopApp).toContain("static func next(after current: Int, total: Int) -> Int?");
    const web = read("src/app/components/dashboard/WorkoutTracker.tsx");
    const app = read("native/Autopilot/Features/Train/WorkoutView.swift");
    expect(web).toContain("nextLoopIndex(expandedExercise, currentPlan?.exercises?.length ?? 0)");
    expect(web).toContain("preloadExerciseLoop(upcomingVideo);");
    expect(app).toContain("let next = LoopRules.next(after: index, total: workout.exercises.count)");
    expect(app).toContain("ExerciseLoopPool.shared.preload(url)");
    // Sin vídeo, la foto sola (la huella dibujada se retiró en 9964e3ea); sin foto, la silueta con el
    // músculo del ejercicio en dorado, nunca un hueco. Ninguna de las dos pinta ya la huella.
    expect(web).not.toContain("ExerciseMotionBadge");
    expect(app).not.toContain("ExerciseMotionBadge");
    expect(web).toContain("<MuscleMap primary={activeMuscle ? [activeMuscle] : []} size={84} dots={false} />");
    expect(app).toContain("ExerciseSilhouette(muscleGroup: item.muscle_group).padding(.vertical, 12)");
    // El carrusel del entreno son números: solo se mueve el ejercicio grande.
    expect(web).toContain('aria-label={`${idx + 1}. ${swaps[item.name] || item.name}${done ? ", hecho" : ""}`}');
    expect(app).toContain('.accessibilityLabel("\\(i + 1). \\(workout.swaps[item.name] ?? item.name)\\(done ? ", hecho" : "")")');
  });

  it("Ejercicio en movimiento en todas partes: entreno (lista y visor), ficha, biblioteca, añadir ejercicios, Hoy, rutina y Mis rutinas, igual en la web y en la app", () => {
    const thumbWeb = read("src/app/components/ExerciseMedia.tsx");
    const thumbApp = read("native/Autopilot/Features/Train/TrainView.swift");
    // Las miniaturas comunes llevan el bucle (quietas si el ejercicio ya está hecho).
    expect(thumbWeb).toContain("<ExerciseLoop src={video} poster={photo} paused={completed} />");
    expect(thumbApp).toContain("ExerciseLoopView(url: clip, paused: completed) {");
    expect(read("native/Autopilot/Features/Train/ExerciseLibraryView.swift")).toContain("ExerciseLoopView(url: LoopRules.url(video)) {");
    expect(read("native/Autopilot/Features/Train/WorkoutView.swift")).toContain("ExerciseLoopView(url: video, paused: completed) {");
    // Cada sitio pasa el clip del ejercicio, en la web y en la app.
    const web: [string, string][] = [
      ["src/app/components/dashboard/WorkoutTracker.tsx", "video={exerciseVideo}"],
      ["src/app/components/library/ExerciseLibrarySheet.tsx", "video={e.video}"],
      ["src/app/components/dashboard/ExercisePicker.tsx", "video={r.video_url}"],
      ["src/app/components/dashboard/HomeOverview.tsx", "video={video}"],
      ["src/app/components/dashboard/HomeOverview.tsx", "<ExerciseLoop src={video} poster={photo} />"],
      ["src/app/components/dashboard/TrainingPlanView.tsx", "video={video}"],
      ["src/app/components/dashboard/MyRoutines.tsx", "video={meta?.video_url || first?.video_url}"],
      ["src/app/components/dashboard/MyRoutines.tsx", "video={meta?.video_url || exercise.video_url}"],
      ["src/app/components/dashboard/ExerciseRowEditor.tsx", "video={ex.video_url}"],
    ];
    for (const [file, text] of web) expect(read(file), `${file}: ${text}`).toContain(text);
    const app: [string, string][] = [
      ["native/Autopilot/Features/Train/WorkoutView.swift", "video: loops.video(exercise.name, plan: exercise.video_url))"],
      ["native/Autopilot/Features/Train/ExerciseLibraryView.swift", "video: e.video"],
      ["native/Autopilot/Features/Train/PlanEditorView.swift", "video: row.video_url)"],
      ["native/Autopilot/Features/Home/HomeView.swift", "video: ex.video_url)"],
      ["native/Autopilot/Features/Home/HomeView.swift", "NamedExerciseLoop(name: first?.name ?? \"\", plan: first?.video_url)"],
      ["native/Autopilot/Features/Train/TrainView.swift", "video: ex.video_url)"],
      ["native/Autopilot/Features/Train/RoutinesView.swift", "video: first?.video_url)"],
      ["native/Autopilot/Features/Train/RoutinesView.swift", "video: exercise.video_url)"],
      ["native/Autopilot/Features/Train/PlanEditorView.swift", "video: exercise.video_url)"],
    ];
    for (const [file, text] of app) expect(read(file), `${file}: ${text}`).toContain(text);
    // La biblioteca manda sobre lo guardado en el plan (las URL cambian al regenerar el clip).
    expect(read("src/app/components/dashboard/WorkoutTracker.tsx")).toContain("const exerciseVideo = metadata?.video_url || ex.video_url;");
    expect(read("native/Autopilot/Design/ExerciseLoopView.swift")).toContain("func video(_ name: String, plan: String? = nil) -> URL? { urls[name] ?? LoopRules.url(plan) }");
    // Ficha (biblioteca y técnica desde Entrenar): el clip en bucle sobre su foto, sin controles; con la foto
    // fija, «Ver vídeo» / «Parar vídeo», en la web y en la app.
    const hero = read("native/Autopilot/Features/Train/ExerciseLibraryView.swift");
    expect(thumbWeb).toContain("{clip && <ExerciseLoop src={clip} poster={still} priority force={manual} />}");
    expect(hero).toContain("ExerciseLoopView(url: videoURL, hero: true, force: playVideo) { still }");
    expect(read("native/Autopilot/Features/Train/WorkoutView.swift")).toMatch(/struct TechniqueSheet[\s\S]*?ExerciseHeroMedia\(/);
    expect(read("src/app/components/ExerciseFocus.tsx")).toContain("<ExerciseMedia key={name} video={exercise?.video}");
    for (const text of ["Ver vídeo", "Parar vídeo"]) {
      expect(thumbWeb).toContain(text);
      expect(hero).toContain(text);
    }
    expect(thumbWeb).not.toMatch(/<video[^>]*\bcontrols\b(?!=\{false\})/);
    // Ficha sin foto ni clip: la silueta con su músculo (nunca «próximamente» ni un hueco); con foto y
    // sin clip, la foto sola. Ya no hay «Ritmo / Foto» (la huella dibujada se retiró), en las dos.
    expect(thumbWeb).toContain('<MuscleMap primary={musclesOf(muscleGroup)} size={84} />');
    expect(hero).toContain("MuscleMapView(primary: (muscleGroup?.isEmpty == false) ? [muscleGroup!] : [], size: 84)");
    for (const text of ["Ritmo", "ExerciseMotionBadge", "ExerciseMotionHero"]) {
      expect(thumbWeb, text).not.toContain(text);
      expect(hero, text).not.toContain(text);
    }
    // Vista previa de Admin: el mismo héroe y una línea en positivo cuando falta el clip.
    expect(read("native/Autopilot/Features/Admin/AdminExercises.swift")).toContain("ExerciseHeroMedia(name: ex.name, image: ex.image_url, video: ex.video_url");
    for (const text of ["Vídeo de técnica por crear", "Créalo desde su ficha o con «Generar vídeos de los ejercicios de los planes»."]) {
      expect(read("src/app/components/ExercisePreviewSheet.tsx")).toContain(text);
      expect(read("native/Autopilot/Features/Admin/AdminExercises.swift")).toContain(text);
    }
    expect(read("src/app/components/ExercisePreviewSheet.tsx")).not.toContain("Todavía sin vídeo");
    // Progreso sigue con la foto quieta en los dos lados (la cifra es la protagonista).
    expect(read("src/app/components/dashboard/WorkoutProgress.tsx")).not.toContain("video=");
    expect(read("native/Autopilot/Features/Progress/ProgressScreen.swift")).toContain("moves: false");
  });

  it("Admin → Biblioteca: «Generar vídeos de los ejercicios de los planes» con la misma cuenta, el mismo coste, confirmación, uno a uno y «Parar», en la web y en la app", () => {
    const lib = read("src/shared/lib/planVideos.ts");
    const web = read("src/app/components/admin-library/PlanVideos.tsx");
    const app = read("native/Autopilot/Features/Admin/AdminPlanVideos.swift");
    // Mismos textos: los de la web salen de `PLAN_VIDEOS_COPY` y la app los repite literalmente.
    const copy = lib.slice(lib.indexOf("export const PLAN_VIDEOS_COPY"), lib.indexOf("} as const;"));
    const texts = [...copy.matchAll(/^\s+\w+: "([^"]+)",$/gm)].map((m) => m[1]);
    expect(texts).toEqual(expect.arrayContaining([
      "Vídeos de los planes", "Generar vídeos de los ejercicios de los planes", "Vídeos en pausa", "Parar",
      "Parando al terminar este vídeo…", "Para reintentar", "Ahora no",
    ]));
    for (const text of texts) expect(app, text).toContain(`"${text}"`);
    for (const text of [
      "en los planes · ", " con vídeo · ", " sin vídeo", " de 4 s · ≈", " créditos de Lovable (", " por vídeo)", "¿Generar ", "Generando ", " de ",
      "necesitan antes su foto (el vídeo parte de ella): créala desde su ficha y entrarán en la siguiente tanda.",
      "Se creará un clip de 4 s para cada ejercicio de los planes que aún no tiene vídeo, uno detrás de otro. Coste estimado: ≈",
      "Los que ya tienen vídeo se saltan y puedes parar cuando quieras.", "Parado: ", "Listo: ", "vídeos nuevos", "vídeos creados",
      "Mantén esta pantalla abierta: cada vídeo tarda de 1 a 3 minutos.", "Admin → Landing → Claves de IA → Vídeos de ejercicios",
    ]) {
      expect(lib + web, text).toContain(text);
      expect(app, text).toContain(text);
    }
    // 1,6 créditos por clip de 4 s, el mismo tope de espera y el mismo sondeo.
    expect(lib).toContain("export const CREDITS_PER_CLIP = 1.6;");
    expect(app).toContain("static let creditsPerClip = 1.6");
    expect(lib).toContain("PLAN_VIDEO_DEADLINE_MS = 10 * 60 * 1000");
    expect(app).toContain("static let deadline: TimeInterval = 10 * 60");
    expect(lib).toContain("PLAN_VIDEO_POLL_MS = 8000");
    expect(app).toContain("static let pollSeconds = 8");
    // Lee los planes y la biblioteca con los permisos del admin, por páginas, y salta los que ya tienen vídeo.
    for (const src of [web, app]) {
      expect(src).toContain('from("training_plan").select("workouts_json")');
      expect(src).toContain('from("exercises").select("id, name, image_url, video_url")');
    }
    expect(web).toContain(".range(from, from + PAGE - 1)");
    // App: con el ayudante común (`Backend.allRows`, páginas de 1.000 hasta la última).
    expect(app).toContain(".range(from: from, to: to)");
    expect(app).toContain("Backend.allRows {");
    expect(lib).toContain("const missing = used.filter((exercise) => !hasValue(exercise.video_url));");
    expect(app).toContain("let missing = used.filter { !has($0.video_url) }");
    // Confirmación antes de gastar créditos.
    expect(web).toContain("<AlertDialogTitle>{planVideoConfirmTitle(ready)}</AlertDialogTitle>");
    expect(app).toContain(".confirmationDialog(PlanVideos.confirmTitle(ready), isPresented: $confirming");
    // Uno a uno con `exercise-video` (create → check) y «Parar» al terminar el actual.
    expect(web).toContain('callVideo(exercise.id, "create")');
    expect(web).toContain('callVideo(exercise.id, "check")');
    expect(app).toContain('call(exercise.id, "create")');
    expect(app).toContain('call(exercise.id, "check")');
    expect(web).toContain("if (stopRef.current || !alive.current) { stopped = true; break; }");
    expect(app).toContain("if stopRequested || Task.isCancelled { stopped = true; break }");
    // En pausa (Claves de IA) lo dice y no lanza nada; nunca cambia la configuración.
    expect(web).toContain('.eq("key", "AI_VIDEO_ENABLED").maybeSingle()');
    expect(app).toContain('.eq("key", value: "AI_VIDEO_ENABLED")');
    for (const src of [web, app]) expect(src).not.toMatch(/\.upsert\(|app_secrets"\)\s*\.(update|insert|delete)\(/);
    expect(web).toContain("if (started.paused) { setPaused(true); stopped = true; break; }");
    expect(app).toContain("if started.paused == true { paused = true; stopped = true; break }");
    // Dentro de Admin → Biblioteca, junto al catálogo base.
    expect(read("src/app/components/admin/ExerciseLibrary.tsx")).toContain("<PlanVideos onChanged=");
    expect(read("native/Autopilot/Features/Admin/AdminExercises.swift")).toContain("AdminPlanVideosCard {");
  });

  it("Entreno sin foto: la silueta con el músculo del ejercicio en el visor y en cada miniatura (la huella dibujada se retiró), en la web y en la app", () => {
    const web = read("src/app/components/dashboard/WorkoutTracker.tsx");
    const app = read("native/Autopilot/Features/Train/WorkoutView.swift");
    const motionWeb = read("src/shared/lib/exerciseMotion.ts");
    const motionApp = read("native/Autopilot/Design/ExerciseMotion.swift");
    // Visor: la foto o, sin foto, la silueta con su músculo; nunca la barra de 48 px con un icono ni
    // un hueco. Mientras la foto llega, la tarjeta (no un dibujo que luego salta).
    expect(web).toContain("<MuscleMap primary={activeMuscle ? [activeMuscle] : []} size={84} dots={false} />");
    expect(web).not.toMatch(/img \|\| loop \? "h-\[140px\]" : "h-12"/);
    expect(app).toContain("placeholder: { Palette.card }");
    expect(app).toMatch(/\} else \{\s*ExerciseSilhouette\(muscleGroup: item\.muscle_group\)/);
    // Sin la huella ya no se piden patrón, estímulo y carga de cada ejercicio al empezar (eran 2 + 1 por tarjeta).
    expect(app).not.toContain("loadMotionMeta");
    expect(app).not.toContain("movement_pattern");
    // Lista y vista previa: cada ejercicio con su foto o su músculo; «Añadir ejercicio» en «···».
    expect(web).toContain("muscleGroup={exerciseCategory} completed={allDone} />");
    expect(app).toContain("WorkoutThumb(url: exercise.image_url, completed: allDone, muscleGroup: exercise.muscle_group,");
    expect(web).toContain("Añadir ejercicio\n");
    expect(app).toContain('Label("Añadir ejercicio", systemImage: "plus")');
    // Mismas pistas, en el mismo orden, y el mismo arco neutro sin pista.
    const hints = (block: string, re: RegExp) => [...block.matchAll(re)].map((m) => [m[1], m[2].split(",").map((h) => h.trim().replace(/"/g, ""))]);
    const webBlock = motionWeb.slice(motionWeb.indexOf("export const PATTERN_HINTS"), motionWeb.indexOf("];", motionWeb.indexOf("export const PATTERN_HINTS")));
    const appBlock = motionApp.slice(motionApp.indexOf("static let patternHints"), motionApp.indexOf("\n    ]", motionApp.indexOf("static let patternHints")));
    const webHints = hints(webBlock, /\["([^"]+)", \[([^\]]*)\]\]/g);
    expect(webHints).toHaveLength(5);
    expect(hints(appBlock, /\("([^"]+)", \[([^\]]*)\]\)/g)).toEqual(webHints);
    expect(motionWeb).toContain('export const FALLBACK_PATTERN: MotionPattern = "Core";');
    expect(motionApp).toContain('static let fallbackPattern = "Core"');
    expect(motionApp).toContain("static func specFor(name: String, pattern: String?, stimulus: String?, load: String?, muscleGroup: String?) -> Spec");
  });

  it("Entreno activo (rediseño): barra Pausar · tiempo · Finalizar en las dos vistas, columna de 680 y los mismos textos con su plural, en la web y en la app", () => {
    const web = read("src/app/components/dashboard/WorkoutTracker.tsx");
    const app = read("native/Autopilot/Features/Train/WorkoutView.swift");
    for (const text of ["En pausa", "Descanso", "Restar 15 segundos", "Sumar 15 segundos", "Saltar descanso", "Añadir ejercicio a esta sesión", "¿Terminar con series pendientes?", "Terminar y guardar", "Seguir entrenando", "¿Descartar entrenamiento?", "Superserie"]) {
      expect(web, text).toContain(text);
      expect(app, text).toContain(text);
    }
    // La barra de abajo ya no depende de la vista; arriba solo quedan «Salir» y «···».
    expect(web).not.toContain("(restTimer !== null || (started && focusMode))");
    expect(app).toContain("ToolbarItem(placement: .topBarTrailing) { moreMenu }");
    expect(app).not.toContain("HStack(spacing: 16) { moreMenu; finishButton }");
    // Descanso con la misma cuenta («0:45») en Big Shoulders.
    expect(web).toContain('<span className="type-figure text-[30px] leading-none text-foreground">{restClock(restTimer)}</span>');
    expect(app).toContain('Text("\\(left / 60):\\(String(format: "%02d", left % 60))")');
    // Columna centrada de 680 (web ancha, iPad y Mac), como Hoy y Nutrición.
    expect(web).toContain('"mx-auto w-full min-w-0 max-w-[680px]"');
    expect(web).toContain('<section className={started ? "mx-auto w-full max-w-[680px]"');
    expect(app).toContain(".frame(maxWidth: 680, alignment: .leading)");
    // Mismo texto con su plural.
    expect(web).toContain('{plural(ex.series, "serie", "series")} · {ex.reps} reps · {ex.rest}');
    expect(app).toContain('Text("\\(plural(exercise.series, "serie", "series")) · \\(exercise.reps) reps · \\(exercise.rest)")');
    // Terminar antes: en positivo, lo que llevas (nunca «te quedan»).
    expect(web).toContain("Llevas {seriesProgress}. Puedes terminar ahora y guardar lo hecho, o seguir entrenando.");
    expect(app).toContain('"Llevas \\(seriesProgress). Puedes terminar ahora y guardar lo hecho, o seguir entrenando."');
    expect(web + app).not.toContain("Te quedan");
    // Esfuerzo: la escala 1–10 y las dos salidas de la web también en la app.
    const rpe = read("src/app/components/dashboard/RPEDialog.tsx");
    for (const text of ["¿Cómo de duro fue?", "Marca tu esfuerzo percibido del 1 al 10. Así ajustamos tu próximo plan.", "Guardar esfuerzo y completar", "Completar sin valorar esfuerzo", "Apunta a un 7 u 8", "Casi al fallo", "Al fallo total"]) {
      expect(rpe, text).toContain(text);
      expect(app, text).toContain(text);
    }
    // Cambiar ejercicio sin alternativas: el mismo aviso en positivo (nunca «Buscando…» para siempre).
    for (const text of ["Sigue con este ejercicio", "Aún no hay alternativas para este movimiento en la biblioteca."]) {
      expect(read("src/app/components/dashboard/ExerciseSwap.tsx"), text).toContain(text);
      expect(app, text).toContain(text);
    }
    // Ejercicio hecho en la miniatura: atenuado y con el check dorado, nunca en verde.
    const thumb = read("src/app/components/ExerciseMedia.tsx");
    expect(thumb).not.toMatch(/bg-success|text-success/);
    expect(thumb).toContain('<Check className="!size-5 text-primary"');
    expect(app).toContain('Image(systemName: "checkmark").font(.inter(.headline).weight(.bold)).foregroundStyle(Palette.gold)');
    // La foto del visor se recorta a su página: «rellenar» no invade la foto vecina del carrusel.
    const photoPage = app.slice(app.indexOf("private func photoPage"), app.indexOf("private func photoPage") + 1600);
    expect(photoPage).toMatch(/^private func photoPage\(_ item: GymExercise, current: Bool\) -> some View \{[\s\S]*?Palette\.card\s*\.overlay \{[\s\S]*?scaledToFill\(\)[\s\S]*?\n {12}\}[\s\S]*?\.clipped\(\)/);
  });

  it("Entreno activo profesional (como Hevy y Fitness): un foco por pantalla, tabla Serie · Anterior · kg · Reps · ✓, descanso tranquilo con «Saltar» y lo secundario en «···», igual en la web y en la app", () => {
    const web = read("src/app/components/dashboard/WorkoutTracker.tsx");
    const app = read("native/Autopilot/Features/Train/WorkoutView.swift");
    const model = read("native/Autopilot/Features/Train/ActiveWorkout.swift");
    // Ejercicio a ejercicio: números arriba (44, aro dorado el que ves y check los hechos), el ejercicio
    // en una portada de 28 con la ficha a un toque, el nombre en Title 1 y solo su tabla.
    expect(web).toContain('"flex h-11 w-11 shrink-0 items-center justify-center rounded-full type-headline tabular-nums');
    expect(web).toContain('isActive ? "bg-card text-primary ring-2 ring-inset ring-primary"');
    expect(app).toContain(".frame(width: 44, height: 44)\n            .background(done && !active ? Palette.gold.opacity(0.15) : Palette.card, in: Circle())");
    expect(app).toContain("Circle().strokeBorder(Palette.gold, lineWidth: 2)");
    expect(web).toMatch(/aspect-\[16\/10\][^"]*rounded-sheet/);
    expect(app).toContain(".clipShape(RoundedRectangle(cornerRadius: Radius.hero, style: .continuous))");
    expect(web).toContain("aria-label={`Ver técnica de ${activeName}`}");
    expect(app).toContain('.accessibilityLabel("Ver técnica de \\(workout.swaps[ex.name] ?? ex.name)")');
    expect(web).toContain('focused ? "line-clamp-2 type-title1"');
    expect(app).toContain(".font(focused ? .apTitle1 : .apHeadline)");
    // Tabla como Hevy: mismas columnas y mismos anchos (32 · 64 · 1fr · 1fr · 44), celdas de 44 con
    // radio 14 y la anterior en «62,5 × 10» con espacios finos.
    for (const column of ["Serie", "Anterior"]) expect(web, column).toContain(`<span className="text-center">${column}</span>`);
    expect(web).toContain('/km/i.test(config.weightLabel) ? "km" : "kg"');
    expect(web).toContain(': "Reps",');
    for (const column of ["Serie", "Anterior", "kg", "Reps"]) expect(app, column).toContain(`Text("${column}")`);
    expect(web).toContain("{columns.load}");
    expect(web).toContain('"grid grid-cols-[32px_64px_minmax(0,1fr)_minmax(0,1fr)_44px] items-center gap-2"');
    expect(app).toContain("static let number: CGFloat = 32");
    expect(app).toContain("static let previous: CGFloat = 64");
    expect(app).toContain("static let check: CGFloat = 44");
    expect(web).toContain("h-11 w-full min-w-0 rounded-chip");
    expect(app).toContain(".frame(maxWidth: .infinity, minHeight: 44)\n            .background(done && !focused ? Color.clear : (focused ? Palette.accent : Palette.secondary),\n                        in: RoundedRectangle(cornerRadius: 14, style: .continuous))");
    expect(web).toContain('const TIMES = "\\u202F×\\u202F";');
    expect(app).toContain('"\\(weight)\\u{202F}×\\u{202F}\\(previous.reps)"');
    for (const text of ["Sin serie anterior", "Calentamiento: se guarda aparte de tus cifras.", "Calentamiento", "Bajada"]) {
      expect(web, text).toContain(text);
      expect(app, text).toContain(text);
    }
    // Hecha: la fila entera dorada y la cifra sin caja; la actual, con filo dorado; el calentamiento, «C».
    expect(web).toContain('const DONE_FIELD = "bg-transparent";');
    expect(web).toContain('isCurrent ? "ring-1 ring-inset ring-primary/30"');
    expect(app).toContain("strokeBorder(isCurrent && !set.done ? Palette.gold.opacity(0.3) : .clear, lineWidth: 1)");
    expect(web).toContain('<span aria-hidden="true">C</span><span className="sr-only">Calentamiento</span>');
    expect(app).toContain('Text("C")');
    // Descanso: una barra tranquila (sin anillo) encima de la barra de abajo, con −15 s, +15 s y «Saltar».
    for (const text of ["−15 s", "+15 s", "Saltar", "Saltar descanso", "Descanso"]) {
      expect(web, text).toContain(text);
      expect(app, text).toContain(text);
    }
    const restWeb = web.slice(web.indexOf('role="timer"'), web.indexOf('aria-label={paused ? "Reanudar" : "Pausar"}'));
    expect(restWeb).not.toContain("<circle");
    expect(restWeb).toContain("skipRest()");
    const restApp = app.slice(app.indexOf("struct RestTimerRow"), app.indexOf("extension Array {"));
    expect(restApp).not.toContain(".trim(from:");
    expect(restApp).toContain("workout.skipRest()");
    expect(restApp).toContain("Haptics.success(); workout.skipRest()");
    expect(model).toContain("if left > restTarget { restTarget = left }");
    // Barra de abajo: Pausar · tiempo · Finalizar (la única dorada) y, bajo el tiempo, «3 de 12 series».
    expect(web).toContain('const seriesProgress = `${completedSets.toLocaleString("es-ES")} de ${plural(totalSets, "serie", "series")}`;');
    expect(web).toContain('{paused ? "En pausa" : seriesProgress}');
    expect(app).toContain('"\\(NumberText.integer(workout.doneSets)) de \\(plural(workout.totalSets, "serie", "series"))"');
    expect(app).toContain('Text(workout.isPaused ? "En pausa" : seriesProgress)');
    // Lo secundario, detrás de «···»: el del ejercicio (técnica, cambiar, superserie) y el de la sesión.
    for (const text of ["Opciones de ", "Ver técnica", "Cambiar ejercicio", "Quitar de la superserie", "Superserie con ", "Añadir ejercicio", "Ver toda la sesión", "Ver ejercicio a ejercicio", "Más opciones por serie", "Descartar entrenamiento"]) {
      expect(web, text).toContain(text);
      expect(app, text).toContain(text);
    }
    expect(web).toContain("setSupersetLinks((links) => toggleSupersetLink(links, ex.name))");
    expect(read("src/app/components/dashboard/ExerciseSwap.tsx")).toContain("{trigger && <DialogTrigger asChild>");
    // Sin ruido: ni «Tiempo transcurrido», ni «Entrenamiento en curso», ni «Previa», ni la cuenta
    // «2 / 6» sobre la foto, ni el reloj de guardado girando en la barra; la carga, con el AP.
    for (const text of ["Tiempo transcurrido", "Entrenamiento en curso", "Entrenamiento en pausa", ">Previa<", 'Text("Previa")', "{expandedExercise + 1} / {total}", "ProgressView("]) {
      expect(web, text).not.toContain(text);
      expect(app, text).not.toContain(text);
    }
    expect(web).not.toContain('<Spinner size="sm" aria-live="polite"');
    // En el iPhone, mientras escribes, la barra del teclado ocupa el sitio de Pausar · tiempo · Finalizar.
    expect(app).toContain("if !editingField { controlBar }");
  });

  it("Resumen y tarjeta para compartir: mismos textos, solo se destacan las mejoras (nunca «−832 kg») y el AP al pie sin el nombre de la marca, en la web y en la app", () => {
    const summary = read("src/app/components/dashboard/WorkoutSummary.tsx");
    const share = read("src/app/components/dashboard/WorkoutStoryShare.tsx");
    const format = read("src/shared/lib/workoutSummaryFormat.ts");
    const app = read("native/Autopilot/Features/Train/WorkoutView.swift");
    const web = summary + share + format;
    for (const text of ["Completado · ", "Volumen total", "Series completadas", "kg más que la última vez", "Nuevo récord personal", "récords personales", "Músculos trabajados", "Frente a la última vez", "Próxima sesión", "Esta sesión será tu referencia para la próxima.", "Duración", "Esfuerzo", "Listo", "Compartir", "Nuevo récord · "]) {
      expect(web, text).toContain(text);
      expect(app, text).toContain(text);
    }
    // Sin restas que desanimen ni colores de alarma: la mejora en dorado y lo demás con la cifra de hoy.
    expect(web + app).not.toContain("respecto a la última vez");
    expect(summary).not.toMatch(/TrendingDown|text-warning|text-destructive|text-success/);
    expect(format).toContain('if (item.trend === "up") return { text: item.change, highlight: true };');
    expect(format).toContain("return { text: item.today, highlight: false };");
    expect(app).toContain("case .up: return (item.change, true)");
    expect(app).toContain("default: return (item.today, false)");
    expect(read("src/shared/lib/workoutReview.ts")).toContain("Mantén la carga y cuida descanso y técnica: la próxima sesión es para subir.");
    expect(app).toContain("Mantén la carga y cuida descanso y técnica: la próxima sesión es para subir.");
    // Cifras con punto de miles en los dos lados («2.366 kg»).
    expect(format).toContain('replace(/\\B(?=(\\d{3})+(?!\\d))/g, ".")');
    expect(read("native/Autopilot/Design/Theme.swift")).toContain("static func grouped(_ value: Double) -> String");
    // Sin kilos en una sesión de peso corporal: la cifra pasa a ser las series.
    expect(share).toContain('return { label: "Series completadas", value: fmt(p.sets), unit: p.sets === 1 ? "serie" : "series" };');
    expect(app).toContain('("Series completadas", NumberText.grouped(Double(sets)), sets == 1 ? "serie" : "series")');
    // Firma: el AP y la web, sin la palabra «Autopilot» ni el dominio antiguo.
    expect(share).not.toContain('ctx.fillText("Autopilot"');
    expect(share).toContain("drawSignature(ctx, W, H);");
    expect(app).toContain('Text("autopilotplan.com")');
    expect(app).toContain("BrandMark(size: 24)");
    expect(app).not.toContain("autopilotplan.app");
    expect(app).not.toContain('eyebrow("');
  });

  it("Tu semana: la web y la app guardan los días elegidos (0 = domingo) y el plan entrena justo esos, no desde el lunes", () => {
    expect(read("src/app/pages/Configurator.tsx")).toContain("training_days: c.days");
    expect(read("native/Autopilot/Features/Auth/OnboardingView.swift")).toContain("training_days: days");
    const gen = read("supabase/functions/generate-plan/index.ts");
    expect(gen).toContain("availabilityObj.training_days");
    expect(gen).toContain("(n + 6) % 7");
    // Las sesiones del piloto van a los días elegidos que no ocupan tus rutinas (`autopilotKeys` de planMerge).
    expect(gen).toContain("planAutopilotRun(currentPlan.days, { frequency, chosenDays, force })");
    expect(gen).toContain("rules, skillProfile, run.keys)");
    expect(read("supabase/functions/_shared/planMerge.ts")).toContain("chosenDays.includes(index) && !taken.has(index)");
    expect(gen).toContain("for (const dayIdx of order)");
  });

  it("Gratis y Plus no leen «tu entrenador» en el primer uso ni en Nutrición", () => {
    const web = read("src/app/pages/Dashboard.tsx");
    expect(web).not.toContain("No necesitas contratar un entrenador para empezar.");
    expect(web).not.toContain("hasta que tu entrenador calcule");
    expect(read("native/Autopilot/Features/Train/TrainView.swift")).not.toContain("En cuanto tengamos tu plan");
  });

  it("Scan: la misma espera en la web y en la app (tu foto, pasos reales con el AP y sin porcentajes inventados)", () => {
    const shared = read("src/shared/lib/scanLoading.ts");
    const view = read("src/app/components/scan/ScanAnalyzing.tsx");
    const app = read("native/Autopilot/Features/Scan/ScanView.swift");
    // El scan público y el de Progreso usan la misma pantalla con la foto que se analiza; la app la calca.
    expect(read("src/app/pages/Scan.tsx")).toMatch(/<ScanAnalyzing photo=\{currentImg \?\? backImg\} stage=\{scanStage\}/);
    expect(read("src/app/components/scan/ProgressScan.tsx")).toMatch(/<ScanAnalyzing photo=\{photo\} stage=\{stage\} saves \/>/);
    expect(app).toMatch(/ScanAnalyzingView\(photo: front \?\? back, stage: stage, saves: true\)/);
    // Mismos mensajes del paso activo, mismo ritmo y la misma pausa antes del resultado.
    const messages = [...shared.matchAll(/^\s+"([^"]+…)",$/gm)].map((m) => m[1]);
    expect(messages.length).toBe(6);
    for (const text of messages) expect(app, text).toContain(`"${text}"`);
    expect(shared).toMatch(/SCAN_MESSAGE_MS = 1600/);
    expect(app).toMatch(/messageInterval: Duration = \.milliseconds\(1600\)/);
    expect(shared).toMatch(/SCAN_REVEAL_MS = 600/);
    expect(app).toMatch(/revealDelay: Duration = \.milliseconds\(600\)/);
    // Con «reducir movimiento» no hay pausa antes del resultado, en los dos scans de la web y en la app.
    expect(read("src/app/pages/Scan.tsx")).toContain("const revealMs = reduceMotion ? 0 : SCAN_REVEAL_MS;");
    expect(read("src/app/components/scan/ProgressScan.tsx")).toContain("reduceMotion ? 0 : SCAN_REVEAL_MS");
    expect(app).toContain("if !reduceMotion { try? await Task.sleep(for: ScanLoading.revealDelay) }");
    // Mismos pasos, cada uno marcado cuando de verdad termina (la IA responde, se guarda, listo).
    for (const text of ["Fotos preparadas", "Análisis con IA", "Guardado en tu historial", "Tu resultado", "Suele tardar menos de un minuto."]) {
      expect(shared, text).toContain(`"${text}"`);
      expect(app, text).toContain(`"${text}"`);
    }
    expect(read("src/app/components/scan/ProgressScan.tsx")).toMatch(/setStage\("saving"\)[\s\S]*?setStage\("done"\)/);
    expect(app).toMatch(/stage = \.saving[\s\S]*?stage = \.done/);
    for (const text of ["Analizando tu físico", "Pasos del análisis"]) expect(view, text).toContain(text);
    expect(app).toContain('Text("Analizando tu físico").font(.apTitle1)');
    // Carga con el AP latiendo; nunca el anillo con un porcentaje que no mide nada.
    expect(view).toContain("<Spinner");
    expect(app).toContain("BrandMark(size: 20, beat: true)");
    for (const src of [view, shared]) expect(src).not.toMatch(/ProgressRing|scanProgressAt|Math\.exp/);
    expect(app).not.toMatch(/trim\(from: 0, to:|95 \* \(1 - exp/);
    // La línea dorada que recorre la foto: 2,4 s y nada con «reducir movimiento».
    expect(view).toContain("duration: 2.4");
    expect(app).toContain(".easeInOut(duration: 2.4)");
    expect(view).toMatch(/!reduceMotion && stage !== "done"/);
    expect(app).toMatch(/!reduceMotion && stage != \.done/);
  });

  it("Scan (rediseño): cabecera a la izquierda, tarjetas sin borde, cifras en Big Shoulders y el mismo resultado en el mismo orden, en la web y en la app", () => {
    const upload = read("src/app/components/scan/ScanUploadParts.tsx");
    const progress = read("src/app/components/scan/ProgressScan.tsx");
    const result = read("src/app/components/scan/ScanResultView.tsx");
    const format = read("src/shared/lib/scanResultFormat.ts");
    const app = read("native/Autopilot/Features/Scan/ScanView.swift");
    // Título alineado a la izquierda en Title 3, como «Tu fuerza» (antes iba centrado en Title 1).
    expect(upload).toContain('<h2 className="type-title3">{title}</h2>');
    expect(progress).not.toContain("text-center");
    expect(app).toMatch(/Text\("Análisis físico con IA"\)\.font\(\.apTitle3\)/);
    expect(app).not.toMatch(/Text\("Análisis físico con IA"\)\.font\(\.apTitle1\)/);
    // Sin bordes alrededor de las tarjetas: profundidad de `bg-card` / `.surface`.
    for (const f of ["ProgressScan", "ScanUploadParts", "ScanResultView", "ScanPlusCard", "ScanApplyPlanCard", "ScanCoverageCard", "ScanProgressPanel", "BeforeAfterCompare", "ProjectionTimeline", "LockedInsightsGrid", "SocialProofStrip"]) {
      const src = read(`src/app/components/scan/${f}.tsx`);
      expect(src, f).not.toMatch(/border border-border|border-foreground\/\[0\.08\]|border-dashed|rounded-media bg-card/);
      expect(src, f).not.toMatch(/text-xs|text-\[1[01]px\]|uppercase/);
    }
    expect(app).not.toContain("strokeBorder(Palette.foreground.opacity(0.08)");
    // Cifras protagonistas en Big Shoulders con su «/10» que nunca se parte.
    expect(result).toContain('type-figure text-[64px]');
    expect(result).toContain('type-figure text-[34px]');
    expect(app).toContain(".font(.figure(size: 64))");
    expect(app).toContain(".font(.figure(size: 34))");
    expect(result).toMatch(/whitespace-nowrap/);
    expect(app).toContain('Text("/10").font(.apTitle3).foregroundStyle(Palette.muted).fixedSize()');
    // Tu propia foto junto a la nota (el formulario la tiene): nunca una silueta.
    expect(progress).toContain("<ScanResultView result={result} photo={photo} objectivePhoto={objective} />");
    expect(app).toContain("ScanResultView(result: result, photo: front ?? back, objectiveImage: objectiveImage,");
    expect(read("src/app/pages/Scan.tsx")).not.toMatch(/pose-front|pose-back|poseFrontImg/);
    // El mismo orden: foto y nota, tres notas, objetivo, resumen, qué mejorar, lectura IA, Plus, compartir y otro scan.
    expect(result).toMatch(/<ScanHero[\s\S]*?label="Atractivo"[\s\S]*?label="Potencial"[\s\S]*?label="Estilo"[\s\S]*?Hasta tu físico objetivo[\s\S]*?result\.summary[\s\S]*?<ScanImprovements[\s\S]*?<ScanDetail[\s\S]*?<ScanPlusCard/);
    expect(progress).toMatch(/<ScanResultView[\s\S]*?<ScanShareButton[\s\S]*?Hacer otro scan/);
    expect(app).toMatch(/hero\s*HStack\(spacing: 12\) \{\s*ScoreTile\(label: "Atractivo"[\s\S]*?objectiveCard[\s\S]*?improvementsSection\s*if hasDetail \{ detail \}\s*if result\.basic == true \{ plusCard \}\s*shareButton\s*Button\("Hacer otro scan"\)/);
    // Mismos textos en los dos lados.
    const web = progress + upload + result + read("src/app/components/scan/ScanShareCard.tsx");
    for (const text of [
      "Tu físico objetivo", "Elige una referencia o sube tu foto. Solo con objetivo calculamos la similitud y los meses que te faltan.",
      "Subir foto", "Quitar", "Hasta tu físico objetivo", "Similitud con tu objetivo", "Lo que más te frena", "Qué mejorar",
      "Compartir resumen", "Hacer otro scan", "Sin puntuación global", "No se pudo abrir esa foto. Prueba con otra.",
    ]) {
      expect(web, text).toContain(text);
      expect(app, text).toContain(text);
    }
    expect(result).toContain("Con plan, frente a unos {monthsText(");
    expect(app).toContain("Con plan, frente a unos \\(ScanFormat.months(");
    // Mismas reglas de formato: plural de meses, kcal con signo, prioridad alta en dorado y objetivo solo con meses.
    expect(format).toContain('Math.round(n) === 1 ? "mes" : "meses"');
    expect(app).toContain('n == 1 ? "mes" : "meses"');
    expect(format).toContain('`${n > 0 ? "+" : ""}${groupedInt(n)} kcal`');
    expect(app).toContain('"\\(n > 0 ? "+" : "")\\(NumberText.grouped(n)) kcal"');
    expect(format).toMatch(/Math\.max\(withPlan \+ 1, Math\.round\(r\.months_without_plan\)\)/);
    expect(app).toMatch(/Swift\.max\(withPlan \+ 1, Int\(\$0\.rounded\(\)\)\)/);
    // Gravedad de postura y «Evita» sin el rojo de error.
    expect(result).not.toContain("text-destructive");
    expect(app.slice(app.indexOf("struct ScanResultView"), app.indexOf("private struct ScoreTile"))).not.toContain("Palette.destructive");
    // Web ancha y Mac: la columna de 680 de Progreso, sin el tope de 560 del formulario.
    expect(read("native/Autopilot/Features/Progress/ProgressScreen.swift")).not.toContain("isWide ? 560");
    expect(read("src/app/pages/Scan.tsx")).toContain('cn("mx-auto w-full max-w-[680px]"');
  });

  it("Scan: la misma imagen para compartir en la web y en la app, con el AP y autopilotplan.com al pie como el entreno", () => {
    const web = read("src/app/components/scan/ScanShareCard.tsx");
    const format = read("src/shared/lib/scanResultFormat.ts");
    const app = read("native/Autopilot/Features/Scan/ScanShareCardView.swift");
    const appFormat = read("native/Autopilot/Features/Scan/ScanView.swift");
    // Firma del entreno (e77db4e8): el AP de 72 px a 1080 (24 pt a ×3) y la web debajo; sin el nombre de la marca.
    expect(web).toContain("drawBrandA(ctx, W / 2 - 36, H - 224, 72)");
    expect(web).toContain('ctx.fillText("autopilotplan.com", W / 2, H - 120)');
    expect(app).toContain("BrandMark(size: 24)");
    expect(app).toContain('Text("autopilotplan.com")');
    for (const src of [web, app]) expect(src).not.toMatch(/>Autopilot<|Text\("Autopilot"\)|autopilot-logo|autopilotplan\.com\/scan"\)/);
    // Mismo lienzo (1080 × 1920 = 360 × 640 a ×3), misma cifra en Big Shoulders y mismos textos.
    expect(web).toContain("const W = 1080;");
    expect(web).toContain("const H = 1920;");
    expect(app).toContain(".frame(width: 360, height: 640)");
    expect(appFormat).toContain("renderer.scale = 3");
    expect(web).toContain('"Big Shoulders"');
    expect(app).toContain(".font(.figure(size: 80))");
    for (const [key, text] of [["title", "Mi análisis físico"], ["subtitle", "Estimación visual con IA"], ["hero", "Físico"], ["focus", "Foco"]]) {
      expect(format, text).toContain(`${key}: "${text}"`);
      expect(appFormat, text).toContain(`static let share${key[0].toUpperCase()}${key.slice(1)} = "${text}"`);
    }
    // Mismas tres cifras (con composición, la grasa) y el mismo foco y frase.
    expect(format).toContain('[["Potencial", r.potential], ["Grasa est.", fat], ["Atractivo", r.attractiveness]]');
    expect(appFormat).toContain('[("Potencial", r.potential), ("Grasa est.", fat), ("Atractivo", r.attractiveness)]');
    expect(format).toContain('[["Potencial", r.potential], ["Atractivo", r.attractiveness], ["Estilo", r.style]]');
    expect(appFormat).toContain('[("Potencial", r.potential), ("Atractivo", r.attractiveness), ("Estilo", r.style)]');
    expect(web).toContain("wrapText(ctx, headline, 1250, 58, 3)");
    expect(app).toContain(".lineLimit(3)");
    // La web la dibuja en un lienzo (como la historia del entreno), no capturando el DOM.
    expect(read("src/app/pages/Scan.tsx")).not.toContain("html-to-image");
  });

  it("Scan: solo Gratis y Plus, sin «tu entrenador» ni Coach, en la web y en la app", () => {
    const files = ["src/app/pages/Scan.tsx", ...["ProgressScan", "ScanResultView", "ScanPlusCard", "ScanApplyPlanCard", "ScanRecommendations", "ProjectionTimeline", "LockedInsightsGrid", "StickyConversionBar"].map((f) => `src/app/components/scan/${f}.tsx`),
      "native/Autopilot/Features/Scan/ScanView.swift", "native/Autopilot/Features/Scan/ScanShareCardView.swift"];
    for (const f of files) {
      const src = read(f).replace(/sent_to_coach/g, "");
      expect(src, f).not.toMatch(/[Cc]oach|entrenador|Nicolás/);
    }
  });

  it("Scan (detalles): insignias legibles en modo claro, foco con mayúscula, vibración al terminar y VoiceOver por pasos, en la web y en la app", () => {
    const upload = read("src/app/components/scan/ScanUploadParts.tsx");
    const analyzing = read("src/app/components/scan/ScanAnalyzing.tsx");
    const progress = read("src/app/components/scan/ProgressScan.tsx");
    const format = read("src/shared/lib/scanResultFormat.ts");
    const app = read("native/Autopilot/Features/Scan/ScanView.swift");
    // «Recomendada» / «Opcional»: cristal oscuro solo sobre la foto; sin foto, la píldora gris del sistema.
    expect(upload).toContain('image ? "bg-black/45" : "bg-secondary"');
    expect(upload).toContain('badge === "Recomendada" ? "text-primary" : image ? "text-white/80" : "text-muted-foreground"');
    expect(app).toContain("image != nil ? Color.black.opacity(0.45) : Palette.secondary");
    expect(app).toContain('badge == "Recomendada" ? Palette.gold : image != nil ? Color.white.opacity(0.8) : Palette.muted');
    // La foto propia del objetivo, con la misma profundidad que `bg-card` (nunca un relleno plano).
    expect(upload).toMatch(/rounded-chip bg-card text-center/);
    expect(app).toContain(".background(SurfaceBackground(shape: RoundedRectangle(cornerRadius: 14, style: .continuous)))");
    expect(app).not.toContain("RoundedRectangle(cornerRadius: 14, style: .continuous).fill(Palette.card)");
    // El foco de la imagen para compartir empieza en mayúscula («Foco · Espalda alta»).
    expect(format).toContain("return focus ? sentence(focus) : null;");
    expect(app).toContain("?? list.first)?.label { return sentence(label) }");
    // Vibración de éxito al enseñar el resultado y de error si falla, como la app.
    expect(progress).toMatch(/hapticNotify\("success"\);\s*setResult\(r\);/);
    expect(progress).toMatch(/catch \(e\) \{\s*void hapticNotify\("error"\);/);
    expect(read("src/app/pages/Scan.tsx")).toMatch(/void hapticNotify\("success"\);\s*setResult\(r\);/);
    expect(app).toMatch(/Haptics\.success\(\)\s*result = r/);
    expect(app).toMatch(/Haptics\.error\(\)/);
    // VoiceOver: se anuncia el paso cuando cambia (no cada mensaje que rota) y el fin del análisis.
    expect(analyzing).toContain('<p role="status" className="sr-only">{active ? `${active.label}: en curso` : "Análisis terminado"}</p>');
    expect(analyzing).not.toMatch(/key=\{msg\}\s*role="status"/);
    expect(app).toContain('A11y.announce(active.map { "\\($0.label): en curso" } ?? "Análisis terminado")');
    // «Tu objetivo» con el nombre real del objetivo guardado (también «Recomposición» y «Fuerza y salud»), nunca su id.
    const webGoals = [...format.slice(format.indexOf("SCAN_GOAL_LABELS")).matchAll(/^\s+(\w+): "([^"]+)",$/gm)].map((m) => `${m[1]}=${m[2]}`);
    const appGoals = [...app.slice(app.indexOf("static let goalLabels")).matchAll(/^\s+"(\w+)": "([^"]+)",$/gm)].map((m) => `${m[1]}=${m[2]}`);
    expect(webGoals.slice(0, 5)).toEqual(["lose_weight=Perder peso", "gain_muscle=Ganar músculo", "improve_endurance=Mejorar resistencia", "recomp=Recomposición", "general_health=Fuerza y salud"]);
    expect(appGoals.slice(0, 5)).toEqual(webGoals.slice(0, 5));
    expect(progress).toContain('setGoal(SCAN_GOAL_LABELS[data.goal ?? ""] ?? "")');
    expect(app).toContain('let target = ScanFormat.goalLabels[o.goal ?? ""] ?? ""');
    // La nota de privacidad no se parte mal: «Menos de 1 minuto» entero y el «·» nunca al empezar línea (la misma regla).
    expect(upload).toContain("{keepTogether(text)}");
    expect(format).toContain('part.length <= 24 ? part.replace(/ /g, "\\u00A0") : part.replace(/ (\\d[\\d.,]*) /g, "\\u00A0$1\\u00A0")');
    expect(format).toContain('.join("\\u00A0· ")');
    expect(app).toContain('Text(ScanFormat.keepTogether("Privado: solo para tu análisis · Menos de 1 minuto"))');
    expect(app).toContain('part.count <= 24');
    expect(app).toContain('#" (\\d[\\d.,]*) "#, with: "\\u{00A0}$1\\u{00A0}"');
    expect(app).toContain('.joined(separator: "\\u{00A0}· ")');
    // Progreso → Scan se monta al abrirlo y queda oculto en las otras pestañas: cambiar de pestaña
    // no pierde las fotos, el análisis en curso ni el resultado (la app ya lo hacía).
    const dashboard = read("src/app/pages/Dashboard.tsx");
    expect(dashboard).toContain('<TabsContent value="scan" forceMount tabIndex={-1} className="mt-0 data-[state=inactive]:hidden">');
    expect(dashboard).toContain('{(scanMounted || progressTab === "scan") && <ProgressScan ');
    expect(read("native/Autopilot/Features/Progress/ProgressScreen.swift")).toContain("if scanMounted || tab == 3 {");
  });

  it("Fotos de Físico: deslizar la foto hacia arriba abre su información, como en Fotos, en la web y en la app", () => {
    const web = read("src/app/components/dashboard/ProgressPhotos.tsx");
    const poses = read("src/app/components/progress/progressPhotos.ts");
    const app = read("native/Autopilot/Features/Progress/ProgressScreen.swift");
    // La foto enlaza con su scan y el visor lee ese análisis (nunca vuelve a ejecutar el Scan).
    expect(web).toMatch(/scan_history_id/);
    expect(app).toMatch(/\.select\("id, photo_url, taken_at, created_at, note, scan_history_id"\)/);
    expect(app).toMatch(/from\("scan_history"\)\s*\.select\("physique, potential, result"\)/);
    // Mismo gesto: vertical sobre la foto; arriba abre, abajo cierra o, si ya estaba cerrada, cierra el visor.
    expect(app).toMatch(/ProgressPhotoViewer\(photo: p\) \{ viewing = nil \}/);
    expect(app).toMatch(/DragGesture\(minimumDistance: 10\)/);
    expect(web).toMatch(/drag="y"/);
    expect(web).toMatch(/if \(showInfo\) setShowInfo\(false\);\s*else setViewingPhoto\(null\);/);
    // Mismo reparto de pantalla: la foto sube al 42 % y el panel ocupa el 58 %, con esquinas de 28 (`sheet` = `Radius.hero`).
    expect(app).toMatch(/geo\.size\.height \* 0\.58/);
    expect(app).toMatch(/topLeadingRadius: Radius\.hero/);
    expect(web).toMatch(/height: showInfo \? "42%" : "100%"/);
    expect(web).toMatch(/h-\[58%\][^"]*rounded-t-sheet/);
    // Mismos textos en los dos lados.
    for (const text of [
      "Ver información", "Ocultar información", "Cerrar visor", "Desliza hacia arriba para ver la información",
      "Físico", "Potencial", "Grasa estimada", "Lo que más te frena: ", "Qué mejorar", "Prioridad ",
      "Esta foto no tiene análisis. Las fotos que guarda cada scan muestran aquí sus resultados.",
      "No hemos podido cargar el análisis de esta foto.",
      "Este análisis no tiene detalles guardados.",
      "Estimación orientativa a partir de la foto.",
    ]) {
      expect(web, text).toContain(text);
      expect(app, text).toContain(text);
    }
    for (const text of ["De frente", "De espalda", "Foto de progreso"]) {
      expect(poses, text).toContain(`"${text}"`);
      expect(app, text).toContain(`"${text}"`);
    }
  });

  it("Físico vacío y Récords (diseño premium): mismos textos y cifras en la web y en la app", () => {
    const app = read("native/Autopilot/Features/Progress/ProgressScreen.swift");
    const photos = read("src/app/components/dashboard/ProgressPhotos.tsx");
    const records = read("src/app/components/dashboard/PRsList.tsx");
    expect(app).toContain('eyebrow: "TU FÍSICO"');
    expect(app).toContain('eyebrow: "TUS RÉCORDS"');
    for (const text of ["Empieza a documentar", "El antes y el ahora, lado a lado", "Tus fotos ordenadas por mes", "Privadas: solo las ves tú", "Hacer mi primer scan"]) {
      expect(photos, text).toContain(text);
      expect(app, text).toContain(text);
    }
    for (const text of ["Ejercicios con récord", "Nuevos este mes", "Último récord", "Nuevo"]) {
      expect(records, text).toContain(text);
      expect(app, text).toContain(text);
    }
  });

  it("Sin aire infantil: descanso con foto real, Scan sin siluetas y portadas de Progreso iguales en la web y en la app", () => {
    const restApp = read("native/Autopilot/Design/Components.swift");
    const homeWeb = read("src/app/components/dashboard/HomeOverview.tsx");
    // Descanso y semana completa: título y una línea sobre la foto de marca tenue, sin antetítulo en mayúsculas.
    expect(restApp).toContain("var photo = BrandPhotos.string(.gym)");
    expect(restApp).not.toContain("DÍA DE DESCANSO");
    expect(homeWeb).toContain('<img src={BRAND_PHOTOS.gym} alt="" aria-hidden="true"');
    expect(homeWeb).toContain('{ kind: "rest", title: "Semana completa"');
    expect(restApp).not.toContain("Circle().frame(width: 77, height: 77)");
    const scanApp = read("native/Autopilot/Features/Scan/ScanView.swift");
    const scanWeb = read("src/app/components/scan/ProgressScan.tsx");
    expect(scanApp).not.toContain("dash: [6, 6]");
    expect(scanWeb).not.toContain("border-dashed border-primary/35");
    const progressApp = read("native/Autopilot/Features/Progress/ProgressScreen.swift");
    const progressWeb = read("src/app/components/dashboard/WorkoutProgress.tsx") + read("src/app/components/dashboard/ProgressPhotos.tsx");
    for (const text of ["Tu fuerza en cada ejercicio", "Tu racha de semanas entrenando", "Tus récords personales", "Empezar a entrenar", "Compara tu evolución", "Con otro scan del mismo ángulo verás el antes y el ahora, lado a lado."]) {
      expect(progressWeb, text).toContain(text);
      expect(progressApp, text).toContain(text);
    }
    expect(progressApp).toContain('eyebrow: "TU FUERZA"');
    // Tu constancia sin series con peso: entrenos en vez de «0 kg» y sin gráfica vacía.
    const noKg = "Registra series con peso y aquí verás tus kilos de cada semana.";
    expect(read("src/app/components/dashboard/TrainingOverviewCard.tsx")).toContain(noKg);
    expect(progressApp).toContain(noKg);
    expect(progressApp).toContain('Text("TU ÚLTIMO SCAN")');
    expect(progressWeb).toContain(">Tu último scan<");
  });

  it("Biblioteca de ejercicios: misma entrada en la rutina, mismos filtros y mismas secciones de ficha, en la web y en la app", () => {
    const app = read("native/Autopilot/Features/Train/ExerciseLibraryView.swift");
    const swiftArray = (name: string) => {
      const m = app.match(new RegExp(`static let ${name} = \\[([^\\]]*)\\]`));
      return [...(m?.[1] ?? "").matchAll(/"([^"]+)"/g)].map((x) => x[1]);
    };
    expect(swiftArray("groups")).toEqual([...FILTER_GROUPS]);
    expect(swiftArray("equipment")).toEqual([...EQUIPMENT]);
    expect(swiftArray("modalities")).toEqual([...MODALITIES]);
    expect(swiftArray("detailSections")).toEqual([...DETAIL_SECTIONS]);
    expect(FILTER_GROUPS).toHaveLength(12);
    expect(EQUIPMENT).toHaveLength(11);
    expect(MODALITIES).toHaveLength(5);
    // Pestaña «Ejercicios» en la navegación de los dos lados (sin «Cerrar», como pantalla propia).
    expect(read("src/app/pages/Dashboard.tsx")).toMatch(/section === "library" && user[\s\S]{0,120}<ExerciseLibraryPage userId=\{user\.id\} \/>/);
    expect(read("native/Autopilot/Features/Shell/RootView.swift")).toContain("case .library: ExerciseLibraryView(userId: session.userId, embedded: true)");
    const web = read("src/app/components/library/ExerciseLibrarySheet.tsx");
    for (const text of ["Recientes", "Favoritos", "Quitar filtros", "Técnica, músculos y variantes de cada ejercicio.", "Principal", "Secundarios"]) {
      expect(web).toContain(text);
      expect(app).toContain(text);
    }
    // Rediseño: cabeceras de sección en Title 3 (sin mayúsculas), filas en un grupo sin borde con chevron,
    // pasos con el número en un círculo dorado tenue y la columna de 680, igual en las dos.
    expect(web).toContain('<h3 className="mb-2.5 type-title3">{children}</h3>');
    expect(app).toContain("Text(text).font(.apTitle3)");
    expect(web).toContain('<ul className="overflow-hidden rounded-[22px] bg-card">');
    expect(app.slice(app.indexOf("private struct ExerciseRows"))).toMatch(/chevron\.right[\s\S]*?\.surface\(\)/);
    expect(web).toContain("rounded-full bg-primary/15 type-footnote font-bold tabular-nums text-primary");
    expect(app).toContain(".frame(width: 24, height: 24).background(Palette.gold.opacity(0.15), in: Circle())");
    expect(web).toContain("max-w-[680px]");
    expect(app).toContain(".frame(maxWidth: 680)");
  });

  it("Biblioteca de ejercicios: la foto subida manda sobre la silueta y la lista se refresca en cada apertura, en la web y en la app", () => {
    const thumb = read("src/app/components/ExerciseMedia.tsx");
    expect(thumb).toMatch(/\{photo \? \([\s\S]*?\) : \([\s\S]*?<MuscleMap primary=\{musclesOf\(muscleGroup\)\}/);
    const app = read("native/Autopilot/Features/Train/ExerciseLibraryView.swift");
    const appThumb = app.slice(app.indexOf("private struct ExerciseThumbView"));
    expect(appThumb).toMatch(/if let url, let u = URL\(string: url\) \{\s*CachedAsyncImage[^\n]*\s*\} else \{\s*fallback/);
    expect(appThumb).toContain("ExerciseSilhouette(muscleGroup: muscleGroup)");
    expect(app).toContain("if let image, !image.isEmpty, let url = URL(string: image) {");
    expect(app).not.toContain("if Self.cache == nil");
    const lib = read("src/shared/hooks/useExerciseLibrary.ts");
    expect(lib).toMatch(/if \(cache\) setItems\(cache\);/);
    // Lista, favoritos y recientes llegan juntos y salen de la caché al volver: «Recientes» no empuja las tarjetas.
    expect(lib).toContain("Promise.all([refreshCatalog(), personalTask])");
    expect(lib).toContain("useState<LibraryExercise[] | null>(() => cache)");
    expect(app).toContain("_model = StateObject(wrappedValue: ExerciseLibraryModel(userId: userId))");
    expect(app).toContain("private static var personalCache");
  });

  it("Ejercicios (rediseño): nunca un bloque vacío ni «próximamente»; tarjetas de grupo, recientes y fichas con foto o la silueta con su músculo, en la web y en la app", () => {
    const web = read("src/app/components/library/ExerciseLibrarySheet.tsx");
    const media = read("src/app/components/ExerciseMedia.tsx");
    const app = read("native/Autopilot/Features/Train/ExerciseLibraryView.swift");
    const train = read("native/Autopilot/Features/Train/TrainView.swift");
    // Sin cajas de «Demostración en preparación» ni «Sin vídeo de técnica todavía»: la silueta ocupa su sitio.
    for (const src of [web, media, app]) {
      for (const text of ["Demostración en preparación", "Sin vídeo de técnica todavía", "emptyLabel", "lu-dumbbell"]) expect(src, text).not.toContain(text);
    }
    expect(media).not.toMatch(/<Dumbbell|<Video /);
    // Miniaturas: foto → sin foto, la silueta con su músculo en dorado (la huella dibujada se retiró
    // en 9964e3ea y ya no pinta nada), igual en las dos. Nunca un cuadro gris vacío.
    expect(media).toContain("<MuscleMap primary={musclesOf(muscleGroup)} size={SILHOUETTE[aspect === \"video\" ? \"video\" : size]} dots={false} />");
    expect(app.slice(app.indexOf("private struct ExerciseThumbView"))).toContain("ExerciseSilhouette(muscleGroup: muscleGroup)");
    expect(train).toContain("ExerciseSilhouette(muscleGroup: muscleGroup)");
    for (const src of [media, app, train]) {
      for (const text of ["ExerciseMotionGlyph", "ExerciseMotionHero", "ExerciseMotionBadge", "showRhythm"]) expect(src, text).not.toContain(text);
    }
    // Ficha sin foto: la silueta a todo el héroe, en una tarjeta de 28; mientras carga la foto, la tarjeta.
    expect(app).toContain("MuscleMapView(primary: (muscleGroup?.isEmpty == false) ? [muscleGroup!] : [], size: 84)");
    expect(app).toContain("placeholder: { Palette.card }");
    expect(app).toContain(".surface(Radius.hero)");
    expect(web).toContain('className="rounded-sheet bg-card"');
    // Ya no hay «Ritmo / Foto»: sin huella, con foto y sin clip se ve la foto sola.
    expect(media).not.toContain("Ritmo");
    expect(app).not.toContain("Ritmo");
    // Tarjetas de grupo: la foto real con su degradado o la silueta con ese músculo, nunca un bloque oscuro vacío.
    expect(web).toContain("<MuscleMap primary={[group]} size={40} dots={false} />");
    expect(app).toContain("let glyph = ExerciseSilhouette(muscleGroup: name)\n            .frame(height: 62)");
    // La foto de la tarjeta, la misma petición (640 px) en las dos.
    expect(web).toContain("fastImage(photo, 500)");
    expect(app).toContain("CachedAsyncImage(url: photo, maxSide: 210)");
    expect(web).toContain("aria-label={`${group}, ${exerciseCount(count)}`}");
    expect(app).toContain('.accessibilityLabel("\\(name), \\(ExerciseLibraryCatalog.count(count))")');
    // Rejilla de grupos: 2 columnas en el iPhone y 3 en iPad, Mac y web ancha.
    expect(web).toContain('grid grid-cols-2 gap-3 sm:grid-cols-3');
    expect(app).toContain("let count = sizeClass == .regular ? 3 : 2");
    expect(app).toContain("LazyVGrid(columns: groupColumns, spacing: 12)");
    expect(app).not.toContain("GridItem(.adaptive(minimum: 150)");
    // Nombre de la ficha en Title 1 (28) que crece con el tamaño de letra, en la biblioteca y desde Entrenar.
    expect(web).toContain('<h2 className="break-words type-title1">{e.name}</h2>');
    expect(read("src/app/components/ExerciseFocus.tsx")).toContain('<DialogTitle className="break-words type-title1 sm:type-title1">{name}</DialogTitle>');
    expect(app).toContain("Text(exercise.name).font(.apTitle1).tracking(-0.4)");
    expect(read("native/Autopilot/Features/Train/WorkoutView.swift")).toContain("Text(exercise.name).font(.apTitle1).tracking(-0.4)");
    expect(web + read("src/app/components/ExerciseFocus.tsx")).not.toContain("text-[28px]");
    // Recientes con la huella deducida si no hay foto (el grupo viaja con el ejercicio).
    expect(web).toContain('muscleGroup={e.groups[0]} aspect="video"');
    expect(app).toContain("muscleGroup: e.groups.first, video: e.video, width: 112, height: 63)");
  });

  it("Ejercicios (rediseño): mismos textos, cifras con su plural, estados vacíos, de error y de carga, y zonas de 44, en la web y en la app", () => {
    const web = read("src/app/components/library/ExerciseLibrarySheet.tsx");
    const app = read("native/Autopilot/Features/Train/ExerciseLibraryView.swift");
    for (const text of [
      "Buscar ejercicio", "Grupos musculares", "Recientes", "Favoritos", "Quitar filtros", "Cargando ejercicios",
      "No hemos podido cargar los ejercicios", "Revisa tu conexión y vuelve a intentarlo.", "Reintentar",
      "Prueba con otro nombre", "Busca por ejercicio o músculo, o quita algún filtro.",
      "Quitar de favoritos", "Añadir a favoritos", "Cómo se hace", "Variantes", "Alternativas",
    ]) {
      expect(web, text).toContain(text);
      expect(app, text).toContain(text);
    }
    // Lo que había antes y desanimaba: fuera de las dos.
    for (const text of ["Ningún ejercicio coincide", "No se pudo cargar la biblioteca."]) {
      expect(web, text).not.toContain(text);
      expect(app, text).not.toContain(text);
    }
    // «1 ejercicio», «12 ejercicios», «1.234 ejercicios»: una sola regla, con punto de miles.
    expect(exerciseCount(1)).toBe("1 ejercicio");
    expect(exerciseCount(12)).toBe("12 ejercicios");
    expect(exerciseCount(1234)).toBe("1.234 ejercicios");
    expect(exerciseCount(0)).toBe("0 ejercicios");
    expect(app).toContain('static func count(_ n: Int) -> String { "\\(NumberText.grouped(Double(max(0, n)))) \\(n == 1 ? "ejercicio" : "ejercicios")" }');
    for (const src of [web, app]) expect(src).not.toMatch(/count === 1 \? "ejercicio"|count == 1 \? "ejercicio"|results\.count == 1/);
    expect(web).toContain("{exerciseCount(results.length)}");
    expect(app).toContain("Text(ExerciseLibraryCatalog.count(results.count))");
    // Filtros que se leen bien con VoiceOver: «Grupo: 2 filtros».
    expect(web).toContain('`${label}: ${count} ${count === 1 ? "filtro" : "filtros"}`');
    expect(app).toContain('"\\(f.label): \\(count) \\(count == 1 ? "filtro" : "filtros")"');
    // Carga con el AP latiendo, nunca bloques grises ni la rueda del sistema.
    expect(web).toContain('<Spinner size="lg" label="Cargando ejercicios" />');
    expect(app).toContain('BrandLoader(size: 28).accessibilityLabel("Cargando ejercicios")');
    expect(web).not.toContain("animate-pulse");
    expect(app).not.toMatch(/RoundedRectangle\(cornerRadius: 16\)\.fill\(Palette\.card\)\.frame\(height: 56\)|ProgressView/);
    // Estados con el componente común de cada lado.
    expect(web).toContain("<EmptyState");
    expect(app).toContain("EmptyStateView(");
    // Buscador compartido (mismo alto, «Borrar» con 44) y botones de 44.
    expect(web).toContain('<SearchPill value={filters.query} onChange={(query) => setFilters((f) => ({ ...f, query }))} placeholder="Buscar ejercicio" />');
    expect(app).toContain('SearchPill(prompt: "Buscar ejercicio", text: $filters.query)');
    const pillWeb = read("src/shared/components/ui/search-pill.tsx");
    const pillApp = read("native/Autopilot/Design/Components.swift");
    expect(pillWeb).toContain('aria-label="Borrar búsqueda"');
    expect(pillWeb).toContain("flex h-11 w-11 shrink-0 items-center justify-center");
    expect(pillApp).toContain("struct SearchPill: View");
    expect(pillApp).toContain(".frame(width: 44, height: 44).contentShape(Rectangle())");
    expect(pillApp).toContain('.accessibilityLabel("Borrar búsqueda")');
    expect(web).toContain("flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-secondary");
    expect(app).toContain(".frame(width: 44, height: 44).background(Palette.secondary, in: Circle())");
    expect(web).toContain('"flex h-10 shrink-0 items-center gap-1.5 rounded-full px-4');
    expect(app).toContain(".padding(.horizontal, 16).frame(height: 40)");
    // Autor y licencia solo cuando la licencia lo exige, a 13 (el suelo de la interfaz).
    expect(web).toContain('<p className="px-1 type-footnote text-muted-foreground">');
    expect(app).toContain(".font(.apFootnote).foregroundStyle(Palette.muted).padding(.horizontal, 4)");
    expect(web + app).not.toMatch(/type-caption1|\.apCaption/);
  });

  it("Añadir ejercicios: mismo buscador, mismos filtros, filas con huella, orden en el círculo y un solo botón dorado, en la web y en la app", () => {
    const web = read("src/app/components/dashboard/ExercisePicker.tsx");
    const app = read("native/Autopilot/Features/Train/PlanEditorView.swift");
    const picker = app.slice(app.indexOf("struct ExercisePickerView"));
    for (const text of [
      "Añadir ejercicios", "Toca todos los que quieras y añádelos de una vez.", "Buscar por nombre o músculo",
      "Ya en la sesión", "Elige ejercicios", "Cargando ejercicios…", "No hemos podido cargar los ejercicios",
      "Revisa tu conexión y vuelve a intentarlo.", "Reintentar", "Prueba con otro nombre", "Busca por ejercicio o músculo, o quita algún filtro.",
    ]) {
      expect(web, text).toContain(text);
      expect(picker, text).toContain(text);
    }
    // Mismas modalidades y grupos, en el mismo orden.
    const webList = (name: string) => [...(web.match(new RegExp(`const ${name} = \\[([^\\]]*)\\]`))?.[1] ?? "").matchAll(/"([^"]+)"/g)].map((m) => m[1]);
    const appList = (name: string) => [...(picker.match(new RegExp(`static let ${name} = \\[([^\\]]*)\\]`))?.[1] ?? "").matchAll(/"([^"]+)"/g)].map((m) => m[1]);
    expect(appList("types")).toEqual(webList("TYPES"));
    expect(appList("groups")).toEqual(webList("GROUPS"));
    expect(webList("GROUPS")[0]).toBe("Todos");
    // «Añadir 3 ejercicios» con la regla común de plural y miles.
    expect(web).toContain("`Añadir ${exerciseCount(picked.length)}`");
    expect(picker).toContain('"Añadir \\(ExerciseLibraryCatalog.count(selected.count))"');
    // Filas: miniatura con huella, «grupo · modalidad», círculo dorado con el orden; lo que ya está, atenuado y sin repetir.
    expect(web).toContain("muscleGroup={r.muscle_group} size=\"md\"");
    expect(picker).toContain("pattern: row.movement_pattern, stimulus: row.stimulus_type, load: row.load_level, video: row.video_url)");
    expect(web).toContain("disabled={inSession}");
    expect(picker).toContain(".disabled(inSession)");
    expect(web).toContain('sel >= 0 ? "bg-primary text-primary-foreground" : "border-[1.5px] border-muted-foreground/40"');
    expect(picker).toContain("Circle().strokeBorder(Palette.muted.opacity(0.4), lineWidth: 1.5)");
    // Carga con el AP y buscador compartido; nada de la rueda del sistema ni del buscador del sistema.
    expect(picker).not.toMatch(/ProgressView|\.searchable\(/);
    expect(picker).toContain('SearchPill(prompt: "Buscar por nombre o músculo", text: $query)');
    expect(web).toContain('<SearchPill value={q} onChange={setQ} placeholder="Buscar por nombre o músculo" />');
    expect(web).not.toContain("animate-pulse");
    // Lo elegido sobrevive a cambiar de filtro: se añade aunque ya no se vea en la lista.
    expect(picker).toContain("selected.compactMap { picked[$0] }");
    expect(app).toContain('static let columns = "id,name,muscle_group,image_url,exercise_type,movement_pattern,stimulus_type,load_level,video_url"');
    expect(web).toContain('.select("id,name,muscle_group,exercise_type,movement_pattern,stimulus_type,load_level,image_url,video_url,tracking_mode,fatigue_level")');
  });

  it("Editar rutina y sesión: la misma fila plegable (series y reps con − / +, peso, descanso, subir, bajar y quitar), en la web y en la app", () => {
    const web = read("src/app/components/dashboard/ExerciseRowEditor.tsx");
    const editor = read("src/app/components/dashboard/PlanEditor.tsx");
    const app = read("native/Autopilot/Features/Train/PlanEditorView.swift");
    const sheet = read("native/Autopilot/Features/Home/RoutineDetailSheet.swift");
    // Una sola fila en la app para «Editar mi rutina» y «Editar sesión».
    expect(app).toContain("struct PlanExerciseRow: View");
    expect(app).toContain("PlanExerciseRow(exercise: ex, index: index, total: exercises.count,");
    expect(sheet).toContain("PlanExerciseRow(exercise: ex, index: index, total: exercises.count,");
    expect(sheet).not.toContain("struct ExerciseEditRow");
    for (const text of ["Series", "Repeticiones", "Peso", "Descanso", "Quitar", "Subir ", "Bajar ", "Reducir ", "Aumentar ", "kg"]) {
      expect(web, text).toContain(text);
      expect(app, text).toContain(text);
    }
    // Mismos descansos rápidos (en segundos) y el mismo resumen con su plural.
    const restsWeb = (web.match(/export const RESTS = \[([^\]]*)\]/)?.[1] ?? "").split(",").map((n) => Number(n.trim()));
    const restsApp = (app.match(/static let rests = \[([^\]]*)\]/)?.[1] ?? "").split(",").map((n) => Number(n.trim()));
    expect(restsWeb).toEqual([60, 90, 120, 180]);
    expect(restsApp).toEqual(restsWeb);
    const values = read("src/shared/lib/planEditorValues.ts");
    expect(values).toContain('`${n} ${n === 1 ? "serie" : "series"}`');
    expect(app).toContain('"\\(n) \\(n == 1 ? "serie" : "series")"');
    expect(values).toContain('`${figure} ${v.kind === "fixed" && v.value === 1 ? "rep" : "reps"}`');
    expect(app).toContain('"\\(n) \\(n == 1 ? "rep" : "reps")"');
    // Tarjeta sin borde, filo dorado tenue al abrirla, sin etiquetas en mayúsculas ni cristal.
    expect(web).not.toMatch(/uppercase|tracking-\[|backdrop-blur|border-border/);
    expect(web).toContain("rounded-[22px] bg-card");
    expect(web).toContain("ring-primary/30");
    expect(app).toContain("Palette.gold.opacity(open ? 0.3 : 0)");
    // Zonas de 44 en − / + y en subir / bajar / quitar.
    expect(web).toContain("grid h-11 w-11 shrink-0 place-items-center rounded-full");
    expect(app).toContain(".frame(width: 44, height: 44).contentShape(Circle())");
    // Plurales del día («4 ejercicios · 12 series») sin abreviaturas.
    expect(editor).not.toContain("ejerc.");
    expect(editor).toContain("${exerciseCount(n)} · ${sets} ${sets === 1 ? \"serie\" : \"series\"}");
    expect(app).toContain('"\\(ExerciseLibraryCatalog.count(list.count)) · \\(sets) \\(sets == 1 ? "serie" : "series")"');
    for (const text of ["Día de descanso", "Añadir ejercicios", "Convertir en día de fuerza"]) {
      expect(editor, text).toContain(text);
      expect(app, text).toContain(text);
    }
    // «Editar sesión»: una sola acción dorada (Guardar), sin jerga («SF Symbols») ni negativas.
    expect(sheet.match(/\.buttonStyle\(\.pill\)/g)?.length).toBe(1);
    expect(sheet).not.toMatch(/SF Symbols|Sin ejercicios\. Añade el primero\.|strokeBorder\(Palette\.foreground\.opacity|strokeBorder\(Color\.white/);
    expect(sheet).toContain("Añade el primer ejercicio de esta sesión.");
  });

  it("Ajustes → Mi plan: fila siempre en su sitio y el plan en una insignia, en la web y en la app", () => {
    const app = read("native/Autopilot/Features/Account/AccountView.swift");
    const web = read("src/app/components/SettingsPanel.tsx");
    expect(app).not.toMatch(/if profileLoaded \{\s*hubRow\("crown"/);
    expect(app).toContain('hubRow("crown", "Mi plan", to: .plan)');
    expect(app).toContain("SubscriptionBadge(name: planKnown ? planName : nil, paid: paid)");
    expect(app).toContain("CachedProfile.load(id)");
    expect(web).toContain("value: <SubscriptionBadge name={planName} paid={hasPaidAccess} />");
    expect(read("native/Autopilot/Design/Components.swift")).toContain("struct SubscriptionBadge: View");
    expect(read("src/shared/components/ui/plus-badge.tsx")).toContain("export function SubscriptionBadge(");
  });

  it("Fotos de marca: se piden por ejercicio (la URL cambia al regenerarla), nunca fijas, en la web y en la app", () => {
    const deadUrl = /site-assets\/exercise-images\/[0-9a-f-]{36}-\d+\.(png|webp)/;
    for (const file of [
      "src/shared/lib/brandPhotos.ts", "src/web/components/FeatureGallery.tsx", "src/web/components/previewData.ts",
      "src/web/components/ProductPreview.tsx", "native/Autopilot/Features/Progress/ProgressScreen.swift",
      "native/Autopilot/Features/Home/HomeView.swift", "native/Autopilot/Features/Auth/OnboardingView.swift",
      "native/Autopilot/Design/Components.swift", "native/Autopilot/Features/Train/TrainView.swift",
    ]) expect(read(file), file).not.toMatch(deadUrl);
    const web = read("src/shared/lib/brandPhotos.ts");
    const app = read("native/Autopilot/Design/BrandPhotos.swift");
    for (const id of ["a31c7206-d2a4-4b31-856a-f5dec09b890e", "d5e30e05-0791-4886-84a0-7b2695728225", "14988835-a004-49d6-95c5-63978dbce978", "7ab0b27f-f296-4fa6-bf07-8f8b026b0832"]) {
      expect(web).toContain(id);
      expect(app).toContain(id);
      expect(read("drizzle/migrations/0020_brand_photos_public.sql")).toContain(id);
    }
    expect(web).toContain('"get_brand_photos_public"');
    expect(app).toContain('rpc("get_brand_photos_public")');
    expect(read("native/Autopilot/App/AutopilotApp.swift")).toContain("BrandPhotos.shared.refresh(");
    // Ninguna portada queda vacía: sin foto en la biblioteca, la web usa hero-athlete.jpg y la app la misma foto incluida.
    expect(web).toContain('import fallbackPhoto from "@/shared/assets/landing/hero-athlete.jpg"');
    expect(app).toContain('Bundle.main.url(forResource: "brand-fallback", withExtension: "jpg")');
    expect(app).toMatch(/static func string\(_ kind: Kind\) -> String \{ shared\.urls\[kind\.rawValue\] \?\? fallbackURL\?\.absoluteString/);
    expect(existsSync(resolve(root, "native/Autopilot/Resources/brand-fallback.jpg"))).toBe(true);
  });

  it("Hoy: el «+» de la cabecera, junto a la campana, lleva a «Entreno vacío», «Nueva rutina», «Mis rutinas» y «Editar plan» en la web, el iPhone y el Mac (Entrenar no es pestaña)", () => {
    // Entrenar no está en la barra de pestañas ni en la barra lateral: Hoy es la única puerta.
    expect(swiftList("userTabs")).not.toContain("train");
    expect(swiftList("userSections")).not.toContain("train");
    const tabsWeb = read("src/app/components/mobile/MobileTabBar.tsx");
    expect(tabsWeb.slice(tabsWeb.indexOf("export const TABS"), tabsWeb.indexOf("const ITEMS"))).not.toContain('"training"');
    // Las mismas cuatro opciones, en el mismo orden y con el mismo nombre del botón.
    const menuWeb = read("src/app/components/dashboard/HomeQuickMenu.tsx");
    const components = read("native/Autopilot/Design/Components.swift");
    const menuApp = components.slice(components.indexOf("struct HomeQuickMenu"), components.indexOf("/// Barra flotante de la web"));
    const order = ["Entreno vacío", "Nueva rutina", "Mis rutinas", "Editar plan"];
    const positions = (src: string) => order.map((label) => src.indexOf(`> ${label}`) >= 0 ? src.indexOf(`> ${label}`) : src.indexOf(`item("${label}"`));
    for (const [name, src] of [["web", menuWeb], ["app", menuApp]] as const) {
      const at = positions(src);
      expect(at.every((n) => n >= 0), name).toBe(true);
      expect([...at].sort((a, b) => a - b), name).toEqual(at);
      expect(src, name).toContain("Entrenar y rutinas");
    }
    // Web: en la cabecera del móvil (junto a la campana) y en la barra de escritorio, solo en Hoy.
    const dash = read("src/app/pages/Dashboard.tsx");
    expect(dash).toContain('headerAction={section === "home" ? homeQuickMenu : undefined}');
    expect(dash).toMatch(/\{section === "home" && homeQuickMenu\}\s*\{user && <NotificationsBell/);
    expect(read("src/app/components/mobile/MobileAppShell.tsx")).toContain("action={headerAction}");
    expect(read("src/app/components/mobile/MobileHeader.tsx")).toMatch(/\{action\}\s*\{userId && <NotificationsBell/);
    // Web: cada opción abre lo suyo, y esas hojas viven fuera de las pestañas (se abren desde Hoy).
    expect(dash).toContain("onEmptyWorkout={() => setFreeOpen(true)}");
    expect(dash).toContain("onNewRoutine={() => setRoutineEditor({ day: null })}");
    expect(dash).toContain("onOpenRoutines={() => openTraining(true)}");
    expect(dash).toContain("onEditPlan={() => setEditorOpen(true)}");
    const sheets = dash.slice(dash.indexOf("const sharedSheets"), dash.indexOf("const pageContent"));
    for (const open of ["open={editorOpen}", "open={routineEditor !== null}", "open={freeOpen}"]) expect(sheets, open).toContain(open);
    expect(dash).toMatch(/const openTraining = \(routines = false\) => \{[\s\S]{0,200}setRoutinesFocus\(routines\);\s*setSection\("training"\)/);
    // iPhone: en la cabecera de Hoy, delante de la campana; Mac (y iPad): en la barra de la ventana, solo en Hoy.
    const root = read("native/Autopilot/Features/Shell/RootView.swift");
    expect(root).toContain("quickMenu: current == .home) { showSettings = true }");
    expect(components).toMatch(/if quickMenu \{ HomeQuickMenu\(\) \}\s*\/\/[^\n]*\n\s*NotificationsBell\(\)/);
    expect(root).toMatch(/if \(selection \?\? defaultSection\) == \.home \{\s*ToolbarItem\(placement: \.primaryAction\) \{ HomeQuickMenu\(\) \}\s*\}\s*ToolbarItem\(placement: \.primaryAction\) \{ NotificationsBell\(\) \}/);
    // App: Hoy recibe cada opción y abre la misma hoja o Entrenar.
    const app = read("native/Autopilot/Features/Home/HomeView.swift");
    expect(app).toContain("publisher(for: .homeQuickAction)");
    expect(app).toContain("case .emptyWorkout: startEmpty()");
    expect(app).toContain("case .newRoutine: newRoutineOpen = true");
    expect(app).toMatch(/case \.myRoutines:\s*TrainView\.focusRoutines = true\s*onNavigate\(\.train\)/);
    expect(app).toContain("case .editPlan: planEditorOpen = true");
    for (const sheet of [".sheet(isPresented: $pickingEmpty)", ".sheet(isPresented: $newRoutineOpen)", ".sheet(isPresented: $planEditorOpen)"]) expect(app, sheet).toContain(sheet);
    // «Ver plan» (y la cifra de Sesiones) también llevan a Entrenar.
    expect(read("src/app/components/dashboard/HomeOverview.tsx")).toContain("onOpenPlan?.()");
    expect(dash).toContain("onOpenPlan={() => openTraining()}");
    expect(app).toMatch(/Button \{ Haptics\.tap\(\); onNavigate\(\.train\) \} label: \{\s*HStack\(spacing: 2\) \{\s*Text\("Ver plan"\)/);
    // Mismo nombre del entreno guardado en los dos lados.
    expect(dash).toContain('routine_name: "Entrenamiento libre"');
    expect(app).toContain('routine_name: "Entrenamiento libre"');
    expect(read("src/app/components/dashboard/FreeSessionBuilder.tsx")).toContain('title="Entreno vacío"');
    expect(read("src/app/components/dashboard/HomeOverview.tsx")).not.toContain("Tu rutina semanal");
  });

  it("Hoy minimalista: la semana en píldoras que se tocan y cambian la tarjeta según el plan, una sola tarjeta y tres cifras, igual en la web y en la app", () => {
    const web = read("src/app/components/dashboard/HomeOverview.tsx");
    const app = read("native/Autopilot/Features/Home/HomeView.swift");
    const rest = read("native/Autopilot/Design/Components.swift");
    // Solo el saludo, la semana, la tarjeta del día y las cifras: fuera «Tu plan», «Mis rutinas», los botones y la oferta de Plus.
    expect(web).toMatch(/<header>[\s\S]*<ol aria-label="Esta semana"[\s\S]*<section aria-labelledby="hoy-dia">[\s\S]*<section aria-label="Tu día"/);
    for (const gone of ["RoutinesPreview", "Tu plan</h3>", "Entreno vacío", "Nueva rutina", "Entrenar igualmente", "HECHO HOY", "Sin datos", "sesiones completadas"]) {
      expect(web, gone).not.toContain(gone);
    }
    for (const gone of ["planSection", "emptyWorkoutButton", "routinesSection", "RoutinesPreview(", 'Text("Tu plan")', "Entrenar igualmente", "HECHO HOY", "Sin datos", ".textCase(.uppercase)"]) {
      expect(app, gone).not.toContain(gone);
    }
    expect(read("src/app/pages/Dashboard.tsx")).not.toContain("<CoachingOffer");
    // Cada píldora es un botón de 44 o más que cambia el día elegido (vibración de selección en la app).
    expect(web).toMatch(/<button\s+type="button"\s+onClick=\{\(\) => selectDay\(day\)\}\s+aria-pressed=\{isSelected\}/);
    expect(web).toContain("flex h-16 w-full min-w-11");
    expect(web).toMatch(/const selectDay = \(day: WeekDay\) => \{[\s\S]{0,120}void hapticSelection\(\);/);
    expect(app).toMatch(/Button \{ select\(day\) \}[\s\S]{0,1200}\.frame\(maxWidth: \.infinity, minHeight: 64\)/);
    expect(app).toContain("isSelected ? [.isButton, .isSelected] : .isButton");
    expect(app).toMatch(/private func select\(_ day: WeekDay\) \{[\s\S]{0,160}Haptics\.selection\(\)/);
    // Cambiar de día no pide nada a la red: solo cambia la tarjeta, con un fundido corto (quieto con «reducir movimiento»).
    const selectWeb = web.slice(web.indexOf("const selectDay"), web.indexOf("return (", web.indexOf("const selectDay")));
    const selectApp = app.slice(app.indexOf("private func select(_ day: WeekDay)"), app.indexOf("// MARK: La tarjeta del día"));
    for (const src of [selectWeb, selectApp]) {
      for (const network of ["supabase", "fetch", "load(", "Backend."]) expect(src, network).not.toContain(network);
    }
    expect(web).toContain('slideFrom && "animate-in fade-in-0 duration-300 ease-out motion-reduce:animate-none"');
    expect(app).toContain("withAnimation(reduceMotion ? nil : .snappy(duration: 0.3)) { selectedDate = day.key }");
    expect(app).toContain(".transition(reduceMotion ? .opacity : .asymmetric(");
    // La misma regla para la tarjeta: hoy, la siguiente sesión que falta (nunca descanso por el día de la semana);
    // otro día, lo hecho esa fecha o la sesión del plan para ese día de la semana; sin sesión, descanso.
    expect(web).toContain('if (todayPlan) return { kind: "session", plan: todayPlan, status: "start" };');
    expect(app).toContain("return .session(plan, status: s.resumable ? .resume : .start, doneOn: nil, detail: s.resumable ? resumeDetail : nil)");
    // Un entreno a medias de hoy: «Continuar» y lo hecho en series, sin calentamientos («3 de 12 series»).
    expect(web).toContain('detail: `${sets.filter((set) => set.done).length} de ${plural(sets.length, "serie", "series")}`');
    expect(app).toContain('"\\(sets.filter(\\.done).count) de \\(plural(sets.count, "serie", "series"))"');
    expect(web).toContain("const planned = sessions.find((session) => session.day === day.planKey);");
    expect(app).toContain("if let planned = sessions.first(where: { $0.day == day.planKey }) {");
    expect(web).toContain("planKey: ROUTINE_KEYS[index]");
    expect(app).toContain("planKey: DayNames.all[index]");
    // Qué se hizo cada fecha, de la misma tabla (`day_completions`), en las dos.
    expect(read("src/app/pages/Dashboard.tsx")).toContain("byDate[row.completed_at] = [...(byDate[row.completed_at] ?? []), row.day_label]");
    expect(app).toContain("let doneByDate = Dictionary(grouping: week, by: \\.date).mapValues { rows in rows.map(\\.day) }");
    // Mismos textos en las tarjetas, los títulos de día y la hoja.
    for (const text of [
      "Hoy", "Ayer", "Mañana", "Ver plan", "Entrenamiento", "Actividad", "Empezar", "Continuar", "Ver actividad", "Hecha",
      "Descanso", "Recuperar también forma parte del plan.", "Semana completa", "El lunes empieza otra vuelta.",
      "Sesión completada", "Ya cuenta en tu semana.", "Buen trabajo. Hoy toca recuperar.", "Siguiente: ",
      "Tu plan aún no tiene sesiones", "Edita tu rutina para añadir tus sesiones.", "Editar plan",
      "Sesión ", "Completado ", "Empezar entrenamiento", "Continuar entreno", "Marcar actividad como hecha", "Ver mi progreso",
      "Añade ejercicios a esta sesión desde Entrenar.", "Libre",
      "Calorías", "Proteína", "Sesiones", "kcal al día", "g al día", "esta semana", "Por calcular", "Por planificar",
      "comida hecha", "comidas hechas", "ejercicio", "ejercicios",
    ]) {
      expect(web + read("src/app/pages/Dashboard.tsx"), text).toContain(text);
      expect(app + rest, text).toContain(text);
    }
    // La cifra y su unidad nunca se separan al partir la línea («7 ejercicios», «40 min»): espacio que no se parte.
    expect(web).toContain("`${count}\\u00a0${count === 1 ? one : many}`");
    expect(app).toContain('"\\(count)\\u{00A0}\\(count == 1 ? one : many)"');
    expect(web).toContain("`${minutes}\\u00a0min`");
    expect(app).toContain('"\\($0)\\u{00A0}min"');
    // Misma duración orientativa (45 s por serie más su descanso, a 5 min) y los mismos músculos sin repetir.
    expect(web).toContain("Math.max(5, Math.round(seconds / 300) * 5)");
    expect(app).toContain("max(5, Int((Double(seconds) / 300).rounded()) * 5)");
    expect(web).toContain('formatTrainingTitle(null, groups.join(", "))');
    expect(app).toContain('DayPlan.formatFocus(shown.joined(separator: ", "))');
    // Tarjetas de 28 sin borde y con profundidad, de la misma altura en todos los estados (la pantalla no salta).
    expect(web.match(/min-h-\[196px\]/g)?.length).toBeGreaterThanOrEqual(3);
    expect(web).toContain("sm:min-h-[248px]");
    expect(app).toContain("private var cardHeight: CGFloat { wideLayout ? 248 : 196 }");
    expect(rest).toContain(".frame(maxWidth: .infinity, minHeight: wide ? 248 : 196, alignment: .topLeading)");
    expect(rest.slice(rest.indexOf("struct RestCard"), rest.indexOf("struct DoneChip"))).not.toContain("strokeBorder");
    // Un solo dorado de acción: la píldora de la tarjeta; «Hecha» va en gris con el check dorado.
    expect(web).toContain("btn-gold absolute bottom-5 left-5 flex h-11");
    expect(app).toContain(".background(GoldFill(shape: Capsule()))");
    expect(rest).toContain("Text(\"Hecha\").font(.apSubhead.weight(.semibold)).foregroundStyle(Palette.foreground)");
    // Cifras en Big Shoulders con punto de miles («2.230»), y la unidad debajo, nunca partida.
    expect(web).toContain('type-figure text-[34px] text-foreground sm:text-[44px]');
    expect(app).toContain(".font(.figure(size: wideLayout ? 44 : 34))");
    // Con la letra grande la unidad baja de línea, nunca se corta («kcal al…»).
    expect(web).toContain('className="mt-1 line-clamp-2 max-w-full break-words type-footnote text-muted-foreground">{unit}');
    expect(app).toMatch(/Text\(unit\)\.font\(\.apFootnote\)\.foregroundStyle\(Palette\.muted\)\s*\.lineLimit\(2\)/);
    expect(web).toContain("groupedInt(calorieTarget)");
    expect(app).toContain("NumberText.grouped(Double($0))");
    // La carga de Hoy (tirar para actualizar) es el AP, nunca las aspas.
    const shell = read("src/app/components/mobile/MobileAppShell.tsx");
    expect(shell).toContain('<Spinner size="md" />');
    expect(shell).not.toContain("Loader2");
  });

  it("Rutinas propias: «Nueva rutina», «Mis rutinas», «Duplicar» con «(copia)», «Borrar» con confirmación y «Guardar como rutina», con el mismo texto y el mismo guardado en la web y en la app", () => {
    const web = [
      "src/app/components/dashboard/MyRoutines.tsx", "src/app/components/dashboard/RoutineEditor.tsx",
      "src/app/components/dashboard/SaveRoutineSheet.tsx", "src/app/components/dashboard/HomeOverview.tsx", "src/app/pages/Dashboard.tsx",
    ].map(read).join("\n");
    const app = [
      "native/Autopilot/Features/Train/RoutinesView.swift", "native/Autopilot/Features/Train/TrainView.swift",
      "native/Autopilot/Features/Home/HomeView.swift", "native/Autopilot/Features/Train/WorkoutView.swift",
    ].map(read).join("\n");
    // Mismos textos en las pantallas: editor, lista, acciones, confirmación de borrar y guardar tras el entreno vacío.
    for (const text of [
      "Nueva rutina", "Editar rutina", "Ponle nombre, elige los ejercicios y ajusta series, repeticiones y descanso.", "Nombre",
      "Ej.: Pierna pesada", "Ejercicios", "Añadir ejercicios", "Busca por nombre o filtra por músculo", "Guardar rutina", "Guardando…",
      "Tienes cambios sin guardar en esta rutina.", "Descartar cambios", "Seguir editando", "No se pudo guardar la rutina. Inténtalo de nuevo.",
      "Mis rutinas", "rutina tuya", "rutinas tuyas", "Crea tu primera rutina", "Elige tus ejercicios, series y descansos, y empiézala cuando quieras.",
      "Empezar", "Continuar entreno", "Hecha hoy", "Editar", "Duplicar", "Borrar", "Más acciones de ", "Ver todas",
      "¿Borrar «", "Se quita de tu plan. Tu historial y tus récords se quedan como están.", "Borrar rutina", "Borrando…", "Cancelar",
      "Guardar como rutina", "Guardada en Mis rutinas", "tal como las has hecho.", "Entreno vacío",
    ]) {
      expect(web, text).toContain(text);
      expect(app, text).toContain(text);
    }
    // Mismas reglas y mismo guardado: sesiones de `training_plan.workouts_json` (sin migración), la siguiente
    // clave libre, `custom: true` solo en la rutina tocada, «<nombre> (copia)» y el límite de siete dicho en claro.
    const lib = read("src/shared/lib/customRoutines.ts");
    const core = read("native/Autopilot/Core/Training.swift");
    for (const text of [
      "Tienes 7 sesiones: borra o edita una para añadir otra", "Mi rutina", " (copia)", "Entrenamiento libre", "Piloto automático",
      "Rutina personalizada", "Creada por ti.", "Preparada por Autopilot.", "Preparada por Autopilot, con ", "rutina tuya", "rutinas tuyas", " más",
    ]) {
      expect(lib, text).toContain(text);
      expect(core, text).toContain(text);
    }
    expect(lib).toContain('type: "gimnasio",\n    routine_name: cleanName(routine.name) || DEFAULT_ROUTINE_NAME,\n    muscle_focus: "",');
    expect(lib).toContain("custom: true");
    expect(core).toContain('DayPlan(day: day, type: "gimnasio", routine_name: clean(name).isEmpty ? defaultName : clean(name),');
    expect(core).toContain('muscle_focus: "", exercises: exercises, custom: true)');
    expect(lib).toContain('ROUTINE_KEYS.find((key) => !plans.some((plan) => plan?.day === key))');
    expect(core).toContain("DayNames.all.first { key in !plans.contains { $0.day == key } }");
    // Se guarda sobre el plan del servidor (sin fila, se crea con la rutina; RLS deja insertar la propia).
    expect(lib).toContain('.select("workouts_json").eq("user_id", userId).maybeSingle()');
    expect(lib).toContain('{ onConflict: "user_id" }');
    expect(core).toContain("do { current = try await fetchPlan(userId: userId) } catch { return .failed }");
    expect(core).toContain('updated_at: ISO8601DateFormatter().string(from: Date())), onConflict: "user_id")');
    // El editor de rutina marca solo los días que cambian, en las dos.
    expect(read("src/shared/lib/planEditorValues.ts")).toContain("markEditedDays(normalizePlan([...original]), normalizePlan(draft))");
    const planEditorApp = read("native/Autopilot/Features/Train/PlanEditorView.swift");
    expect(planEditorApp).toContain("CustomRoutines.markEdited(original: Self.normalized(original), next: Self.normalized(draft))");
    expect(planEditorApp).not.toContain("p.custom = true; return p }");
    // «Editar sesión» de la app: el icono y la portada no la hacen tuya (como «Personalizar» en la web).
    expect(read("native/Autopilot/Features/Home/RoutineDetailSheet.swift")).toContain("before.session_icon = nil; before.cover_url = nil");
    // El editor de rutina se rellena al abrir, no en cada recarga del plan (volver a la app no borra lo editado).
    expect(read("src/app/components/dashboard/RoutineEditor.tsx")).toContain("}, [open, routineDay]);");
    // «Nueva rutina» en Entrenar y en el «+» de Hoy, también sin plan; «Mis rutinas» en Entrenar y a un toque desde el «+».
    expect(read("src/app/pages/Dashboard.tsx")).toMatch(/Preparar mi rutina gratis[\s\S]{0,400}setRoutineEditor\(\{ day: null \}\)[\s\S]{0,120}Nueva rutina/);
    expect(read("native/Autopilot/Features/Train/TrainView.swift")).toMatch(/StarterRoutineCard \{ await load\(\) \}[\s\S]{0,200}Text\("Nueva rutina"\)/);
    expect(read("src/app/components/dashboard/HomeQuickMenu.tsx")).toMatch(/Entreno vacío[\s\S]{0,400}Nueva rutina[\s\S]{0,400}Mis rutinas/);
    expect(read("native/Autopilot/Design/Components.swift")).toMatch(/item\("Entreno vacío"[\s\S]{0,200}item\("Nueva rutina"[\s\S]{0,300}item\("Mis rutinas"/);
    expect(read("native/Autopilot/Features/Home/HomeView.swift")).toMatch(/case \.myRoutines:\s*TrainView\.focusRoutines = true\s*onNavigate\(\.train\)/);
    expect(read("src/app/pages/Dashboard.tsx")).toContain("onOpenRoutines={() => openTraining(true)}");
    expect(read("src/app/components/dashboard/TrainingPlanView.tsx")).toContain("{routines}");
    expect(read("native/Autopilot/Features/Train/TrainView.swift")).toContain("if let routines { routines }");
    // «Empezar» usa el mismo entreno que una sesión del plan (mismo tracker y mismo borrador).
    expect(read("src/app/pages/Dashboard.tsx")).toMatch(/const startRoutine = \(day: string\) => \{[\s\S]{0,200}readActiveWorkout\(user\.id\)/);
    expect(read("native/Autopilot/Features/Train/TrainView.swift")).toContain("onStart: { day in Task { await open(day) } }");
    // «Guardar como rutina» solo tras el entreno vacío, con lo hecho (series hechas, reps y el peso más alto).
    expect(read("src/app/pages/Dashboard.tsx")).toContain("plan.routine_name === FREE_WORKOUT_NAME");
    expect(read("src/app/components/dashboard/WorkoutTracker.tsx")).toContain("routineFromWorkout(activePlan?.exercises ?? [], exerciseLogs)");
    expect(read("native/Autopilot/Features/Train/WorkoutView.swift")).toContain("workout.draft.day.routine_name == CustomRoutines.freeWorkoutName");
    expect(read("native/Autopilot/Features/Train/WorkoutView.swift")).toContain("CustomRoutines.fromWorkout(workout.exercises, logs: workout.draft.logs)");
    // Borrar siempre pasa por la hoja de confirmación.
    expect(read("src/app/components/dashboard/MyRoutines.tsx")).toContain("<Drawer open={deleting !== null}");
    expect(read("native/Autopilot/Features/Train/RoutinesView.swift")).toContain('.sheet(item: $deleting) { routine in');
    // Un plan con rutinas tuyas: el piloto automático las respeta y solo adapta sus sesiones (siguiente prueba).
    expect(read("src/app/components/dashboard/PlanShieldDialog.tsx")).toContain("keptRoutinesTitle(notice.count)");
    expect(read("src/app/pages/MySchedule.tsx")).toContain("keptRoutinesTitle(planRes.keptCustom)");
    // Sin rutina en Hoy: la invitación con su botón, nunca un aviso de «tu entrenador».
    expect(read("src/app/components/dashboard/HomeOverview.tsx")).not.toContain("Tu entrenador está preparando tu plan");
  });

  it("Autopiloto con rutinas propias: nunca se pierde una rutina tuya y el piloto solo adapta sus sesiones, dicho igual en la web y en la app", () => {
    const merge = read("supabase/functions/_shared/planMerge.ts");
    const gen = read("supabase/functions/generate-plan/index.ts");
    // El servidor mezcla: tus rutinas intactas y las del piloto en las claves libres (lógica pura, probada en planMerge.test.ts).
    expect(gen).toContain('from "../_shared/planMerge.ts"');
    expect(gen).toContain("planAutopilotRun(currentPlan.days, { frequency, chosenDays, force })");
    expect(gen).toContain("mergePlan(latestPlan.days, weeklyPlan as unknown as DayPlan[], frequency)");
    expect(gen).toContain("kept_custom: finalRun.kept.length, autopilot_days: autopilotCount, custom_full: finalRun.full");
    expect(gen).not.toContain("protected: true");
    // La cuenta gratis con solo rutinas propias (o vacía) recibe su rutina inicial alrededor de las suyas.
    expect(gen).toContain("currentPlan.exists && hasAutopilotSessions(currentPlan.days)");
    expect(merge).not.toMatch(/https:\/\/|npm:|Deno\./);
    // Mismas claves de orden que la web y que el generador.
    expect(merge).toContain('["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]');
    expect(gen).toContain('const DAYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];');
    // Los clientes llaman una vez y nunca con `force`; ya no hay nada que elegir ni copias que guardar.
    const shield = read("src/shared/lib/planShield.ts");
    expect(shield).toContain('client.functions.invoke("generate-plan", { body })');
    expect(shield).not.toMatch(/force:\s*true|saveBackup|askShield/);
    const dialog = read("src/app/components/dashboard/PlanShieldDialog.tsx");
    for (const gone of ["Conservar mi plan", "Guardar copia", "Cambiarlo sin copia", "salen del plan", "sin tu permiso"]) {
      expect(dialog, gone).not.toContain(gone);
      expect(shield, gone).not.toContain(gone);
    }
    // Con tus rutinas cubriendo tus días, el piloto puede quitar sus sesiones viejas: no se promete «tal cual».
    expect(shield).toContain('full: "Tus rutinas ya cubren tus días de entreno, así que tu semana se hace con ellas."');
    expect(dialog).toContain("SHIELD_COPY.description");
    expect(dialog).toContain("notice.full ? SHIELD_COPY.full : SHIELD_COPY.body");
    expect(dialog).toContain("{SHIELD_COPY.done}");
    expect(read("src/app/pages/MySchedule.tsx")).not.toContain("Tu plan tiene rutinas tuyas y se queda tal cual");
    // Mismos textos en la web y en la app: «Hemos respetado tus N rutinas» y lo que hace el piloto.
    const core = read("native/Autopilot/Core/Training.swift");
    expect(shield).toContain('count === 1 ? "Hemos respetado tu rutina" : `Hemos respetado tus ${count} rutinas`');
    expect(core).toContain('count == 1 ? "Hemos respetado tu rutina" : "Hemos respetado tus \\(count) rutinas"');
    const webDescription = shield.match(/description: "([^"]+)"/)?.[1];
    expect(webDescription).toBe("El piloto automático solo adapta sus propias sesiones.");
    expect(core).toContain(`static let description = "${webDescription}"`);
    // La app lee la misma respuesta y lo dice al preparar la rutina (como la web).
    expect(core).toContain("let kept_custom: Int?");
    expect(core).toContain("return max(r.kept_custom ?? 0, 0)");
    expect(read("native/Autopilot/Design/Components.swift")).toContain('if kept > 0 { A11y.announce("\\(PlanShield.keptTitle(kept)). \\(PlanShield.description)") }');
  });

  it("«Completar con el autopiloto» en Mis rutinas: mismo texto, misma regla para enseñarlo, la misma llamada a generate-plan y «Hemos respetado tus N rutinas», en la web y en la app", () => {
    const lib = read("src/shared/lib/customRoutines.ts");
    const core = read("native/Autopilot/Core/Training.swift");
    const web = read("src/app/components/dashboard/MyRoutines.tsx");
    const app = read("native/Autopilot/Features/Train/RoutinesView.swift");
    const dashboard = read("src/app/pages/Dashboard.tsx");
    const train = read("native/Autopilot/Features/Train/TrainView.swift");
    // Mismos textos: la acción, lo que hace, la carga y el aviso de error con «Reintentar».
    const copy = lib.slice(lib.indexOf("export const AUTOPILOT_FILL = {"), lib.indexOf("} as const;", lib.indexOf("export const AUTOPILOT_FILL = {")));
    const texts = Object.fromEntries([...copy.matchAll(/(\w+): "([^"]+)"/g)].map((m) => [m[1], m[2]]));
    expect(texts.action).toBe("Completar con el autopiloto");
    expect(texts.retry).toBe("Reintentar");
    const swiftNames: Record<string, string> = {
      action: "fillAction", detail: "fillDetail", running: "fillRunning", errorTitle: "fillErrorTitle", errorDetail: "fillErrorDetail", retry: "fillRetry",
    };
    for (const [key, name] of Object.entries(swiftNames)) {
      expect(texts[key], key).toBeTruthy();
      expect(core, key).toContain(`static let ${name} = "${texts[key]}"`);
      expect(web, key).toContain(`AUTOPILOT_FILL.${key}`);
      expect(app, key).toContain(`CustomRoutines.${name}`);
    }
    // Lo que cubren tus rutinas, con su singular.
    expect(lib).toContain("? `Tu rutina cubre 1 de tus ${frequency} días de entreno`");
    expect(lib).toContain(": `Tus rutinas cubren ${own} de tus ${frequency} días de entreno`;");
    expect(core).toContain('? "Tu rutina cubre 1 de tus \\(frequency) días de entreno"');
    expect(core).toContain(': "Tus rutinas cubren \\(own) de tus \\(frequency) días de entreno"');
    // Misma regla: hay rutinas tuyas, el plan es todo tuyo (sin sesiones del piloto) y no llega a tus días (máximo 7).
    expect(lib).toContain("myRoutines(plans).length === 0");
    expect(core).toContain("guard let frequency, !mine(plans).isEmpty else { return false }");
    expect(lib).toContain("if (!sessions.every((plan) => plan.custom === true)) return false;");
    expect(core).toContain("guard sessions.allSatisfy({ $0.custom == true }) else { return false }");
    expect(lib).toContain("return sessions.length < Math.min(Math.max(Math.floor(frequency), 0), MAX_ROUTINE_SESSIONS);");
    expect(core).toContain("return sessions.count < min(max(frequency, 0), DayNames.all.count)");
    // Free y Plus en las dos (generate-plan solo lo rechaza con Coach): la web no lo esconde a Plus.
    expect(dashboard).toContain('autopilot={consumerPlan !== "coach" && canCompleteWithAutopilot(dayPlans, trainingDays)');
    expect(dashboard).not.toContain("autopilot={!coaching");
    expect(train).toContain("guard CustomRoutines.canCompleteWithAutopilot(model.days, frequency: trainingDays), let trainingDays else { return nil }");
    // Los días se leen también con el plan vacío (como la web, que siempre los lee): al crear tu primera
    // rutina la fila ya puede salir, y tras guardar el editor de rutina se vuelven a leer.
    expect(train).toContain("guard let userId = session.userId, model.sessions.allSatisfy({ $0.custom == true }) else { return }");
    expect(train).toContain("PlanEditorView(original: model.days) { saved in model.days = saved; Task { await loadTrainingDays() } }");
    // Tus días de entreno, contados como generate-plan: «Mi horario» manda sobre el cuestionario y, sin nada, 4.
    const availability = read("src/shared/lib/availability.ts");
    expect(availability).toContain("export function planTrainingDays(availability: unknown, gymSlots?: unknown): number");
    expect(availability).toContain('Number.parseInt(String(record.days || "4"), 10)');
    expect(core).toContain('leadingInt(record["days"]) ?? 4');
    expect(dashboard).toContain('supabase.from("user_schedule").select("gym_slots").eq("user_id", user.id).maybeSingle()');
    expect(dashboard).toContain("planTrainingDays(onb.availability, scheduleResult.data?.gym_slots)");
    expect(core).toContain('Backend.client.from("user_schedule").select("gym_slots")');
    expect(core).toContain("CustomRoutines.trainingFrequency(availability: row.availability, gymSlots: slots.first?.gym_slots)");
    // La misma llamada que respeta tus rutinas (sin `force`) y el plan se vuelve a leer.
    expect(dashboard).toMatch(/const completeWithAutopilot = async \(\): Promise<number \| null> => \{[\s\S]{0,200}generatePlanGuarded\(supabase, \{ user_id: user\.id \}\)[\s\S]{0,120}await fetchData\(\);\s*return keptCustom;/);
    expect(train).toMatch(/private func completeWithAutopilot\(\) async -> Int\? \{[\s\S]{0,160}TrainingRepo\.generateStarterPlan\(userId: userId\)[\s\S]{0,60}await load\(\)\s*return kept/);
    // Carga con el AP, éxito con el texto del escudo y error con «Reintentar», en una fila secundaria (no dorada).
    // El AP en su gris de carga en las dos (`Spinner` sin color propio, `BrandLoader`).
    expect(web).toContain('<Spinner size="sm" aria-hidden="true" />');
    expect(app).toContain("BrandLoader(size: 18).accessibilityHidden(true)");
    expect(app).not.toContain("ProgressView");
    expect(web).toContain("{keptRoutinesTitle(kept)}");
    expect(web).toContain("{SHIELD_COPY.description}");
    expect(app).toContain("Text(PlanShield.keptTitle(kept))");
    expect(app).toContain("Text(PlanShield.description)");
    expect(web).toContain('<IconTile icon={TriangleAlert} size="md" tone="destructive" />');
    expect(app).toContain('IconTile(symbol: "exclamationmark.triangle", size: 40, tint: Palette.destructive)');
    const webCard = web.slice(web.indexOf("const AutopilotFillCard"), web.indexOf("export const RoutinesPreview"));
    const appCard = app.slice(app.indexOf("private var autopilotCard: some View"), app.indexOf("private func completeWithAutopilot"));
    expect(webCard.match(/variant="secondary"/g)).toHaveLength(2);
    expect(webCard).not.toMatch(/variant="(default|hero)"|btn-gold|bg-primary /);
    expect(appCard.match(/\.buttonStyle\(\.pillSecondary\)/g)).toHaveLength(2);
    expect(appCard).not.toContain(".buttonStyle(.pill)");
    // La fila va bajo tus rutinas, en la misma tarjeta que el resto de la sección.
    expect(web).toMatch(/\{showFill && \(\s*<AutopilotFillCard/);
    expect(app).toContain("if showFill { autopilotCard }");
  });

  it("Admin → Biblioteca: el catálogo base se importa, redacta y publica igual en la web y en la app", () => {
    const web = read("src/app/components/admin-library/CatalogImport.tsx");
    const app = read("native/Autopilot/Features/Admin/AdminCatalogImport.swift");
    for (const text of [
      "Catálogo base",
      "Ejercicios con datos abiertos (licencia MIT), sin imágenes de terceros. Entran como borrador, la IA los reescribe con la voz de Autopilot y los publicas tú. El planificador no los usa hasta que los marques como aptos.",
      "Revisar importación", "Redactar con IA", "Publicar redactados", "como borrador", "variantes repetidas", "ya están en tu biblioteca",
      "Pendientes de revisar", "no se pudieron redactar",
    ]) {
      expect(web).toContain(text);
      expect(app).toContain(text);
    }
    for (const action of ["status", "preview", "import", "draft", "publish"]) {
      expect(web).toContain(`action: "${action}"`);
      expect(app).toContain(`action: "${action}"`);
    }
    // Las fichas importadas no llevan marca ajena: solo CC BY / BY-SA obliga a citar en la ficha.
    expect(read("src/shared/lib/exerciseLibrary.ts")).toContain('!/^CC BY/i.test(e.license ?? "")');
    expect(read("native/Autopilot/Features/Train/ExerciseLibraryView.swift")).toContain('(license ?? "").uppercased().hasPrefix("CC BY")');
    expect(read("src/app/components/admin/ExerciseLibrary.tsx")).toContain("<CatalogImport ");
    expect(read("native/Autopilot/Features/Admin/AdminExercises.swift")).toContain("AdminCatalogImportCard {");
  });

  it("Profundidad: tarjetas con luz arriba y sombra, dorado y segmentos con relieve y barra flotante de cristal, igual en la web y en la app", () => {
    const css = read("src/index.css");
    const theme = read("native/Autopilot/Design/Theme.swift");
    const components = read("native/Autopilot/Design/Components.swift");
    // Tarjeta: la luz se apaga a los 140 px/pt con el mismo 5,5 % de blanco, filo arriba y sombra difusa.
    expect(css).toContain("--surface-sheen: linear-gradient(180deg, hsl(0 0% 100% / 0.055) 0, hsl(0 0% 100% / 0) 140px);");
    expect(css).toMatch(/\.bg-card \{\s*background-image: var\(--surface-sheen\);\s*box-shadow: var\(--surface-shadow\);/);
    expect(theme).toContain("static let sheen = dynamic(dark: (1, 1, 1, 0.055)");
    expect(theme).toMatch(/struct SurfaceBackground[\s\S]*?140 \/ max/);
    expect(theme).toMatch(/struct Card<Content: View>[\s\S]*?\.surface\(radius\)/);
    // Ninguna tarjeta nativa vuelve al relleno plano.
    for (const file of ["Home/HomeView.swift", "Train/TrainView.swift", "Progress/ProgressScreen.swift", "Other/OtherViews.swift"]) {
      expect(read(`native/Autopilot/Features/${file}`), file).not.toContain(".background(Palette.card, in: RoundedRectangle(");
    }
    // Botones: dorado y secundario con relieve en los dos lados.
    const button = read("src/shared/components/ui/button.tsx");
    expect(button).toContain('const filled = "btn-gold bg-primary');
    expect(button).toContain('secondary: "btn-raised bg-secondary');
    expect(theme).toContain("case .primary: GoldFill(shape: Capsule())");
    expect(theme).toContain("case .secondary: RaisedFill(shape: Capsule())");
    // Segmento activo y barra de pestañas.
    expect(css).toContain('[role="tab"][data-state="active"]');
    expect(components).toContain("if gold { GoldFill(shape: Capsule()) } else { RaisedFill(shape: Capsule(), fill: Palette.accent) }");
    expect(read("src/app/components/mobile/FloatingMobileNav.tsx")).toContain("nav-chrome rounded-full");
    expect(components).toContain("LinearGradient(colors: [Palette.chromeTop, Palette.chromeBottom]");
  });

  it("Identidad visual: la paleta nativa (iPhone y Mac) tiene los mismos valores que los tokens de la web", () => {
    // Tokens del :root de `@layer base` (antes están los de «Aumentar contraste»).
    const css = read("src/index.css");
    const base = css.slice(css.indexOf("@layer base"));
    const token = (name: string) => {
      const m = base.match(new RegExp(`--${name}:\\s*([\\d.]+)\\s+([\\d.]+)%\\s+([\\d.]+)%;`));
      expect(m, `--${name}`).not.toBeNull();
      const [h, s, l] = [Number(m![1]), Number(m![2]) / 100, Number(m![3]) / 100];
      const k = (n: number) => (n + h / 30) % 12;
      const a = s * Math.min(l, 1 - l);
      return [0, 8, 4].map((n) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1)));
    };
    const swift = read("native/Autopilot/Design/Theme.swift");
    const palette = (name: string) => {
      if (new RegExp(`static let ${name} = Color\\.white\\b`).test(swift)) return [1, 1, 1];
      // La paleta es dinámica (oscuro / claro): se compara el valor del modo oscuro, el de la web.
      let m = swift.match(new RegExp(`static let ${name} = dynamic\\(dark: \\(([\\d.]+),\\s*([\\d.]+),\\s*([\\d.]+)(?:,\\s*[\\d.]+)?\\)`));
      if (m) return [Number(m[1]), Number(m[2]), Number(m[3])];
      m = swift.match(new RegExp(`static let ${name} = Color\\(red: ([\\d.]+), green: ([\\d.]+), blue: ([\\d.]+)\\)`));
      expect(m, `Palette.${name}`).not.toBeNull();
      return [Number(m![1]), Number(m![2]), Number(m![3])];
    };
    const close = (label: string, a: number[], b: number[]) =>
      a.forEach((v, i) => expect(Math.abs(v - b[i]), `${label} canal ${i}`).toBeLessThanOrEqual(0.004));
    const pairs: Array<[string, string]> = [
      ["background", "background"], ["foreground", "foreground"], ["card", "card"], ["secondary", "secondary"],
      ["muted", "muted-foreground"], ["accent", "accent"], ["border", "border"], ["separator", "border"],
      ["gold", "primary"], ["success", "success"],
    ];
    pairs.forEach(([p, t]) => close(`Palette.${p} ↔ --${t}`, palette(p), token(t)));
    // El tinte del sistema (interruptores, cursor, enlaces) es el mismo dorado.
    const accent = JSON.parse(read("native/Autopilot/Assets.xcassets/AccentColor.colorset/Contents.json")).colors[0].color.components;
    close("AccentColor ↔ --primary", [accent.red, accent.green, accent.blue].map(Number), token("primary"));
    // Cifra del esfuerzo con la firma de marca y en dorado en los dos lados.
    expect(read("src/app/components/dashboard/RPEDialog.tsx")).toContain("type-figure text-[64px] font-bold leading-none tabular-nums text-primary");
    expect(read("native/Autopilot/Features/Train/WorkoutView.swift")).toContain('Text("\\(rpe)").font(.figure(size: 64)).foregroundStyle(Palette.gold)');
  });

  it("Velocidad: caché de 30 días, rutina siempre fresca de la red y comidas con IA solas una vez al día, en la web y en la app", () => {
    const screenCache = read("src/shared/lib/screenCache.ts");
    const snapshots = read("native/Autopilot/Core/Snapshots.swift");
    expect(screenCache).toContain("SCREEN_CACHE_TTL = 30 * 24 * 60 * 60 * 1000");
    expect(snapshots).toContain("maxAge: TimeInterval = 30 * 24 * 60 * 60");
    // La copia en disco solo pinta el primer fotograma; el plan se pide a la red y, sin red, se usa la copia.
    const training = read("native/Autopilot/Core/Training.swift");
    expect(training).toMatch(/do \{\s*fetched = try await fetchPlan\(userId: userId\)\s*\} catch \{\s*if !force, let disk = Snapshots\.load/);
    // Generar comidas con IA cuesta dinero: lo automático, como mucho una vez al día (los botones, siempre).
    expect(read("src/app/components/dashboard/MealsList.tsx")).toContain("claimMealsAutoGenerate(userId)");
    const nutritionApp = read("native/Autopilot/Features/Other/OtherViews.swift");
    expect(nutritionApp).toContain("if Self.claimAutoGenerate(id) { await generateMeals() } else { generateFailed = true }");
    expect(nutritionApp).toContain('"meals-autogen.');
    // Hoy en la web: una sola tanda de consultas y la sesión guardada pinta sin esperar a renovarse.
    const dashboard = read("src/app/pages/Dashboard.tsx");
    expect(dashboard).not.toContain('await supabase.functions.invoke("check-subscription")');
    expect(read("src/shared/contexts/AuthContext.tsx")).toContain("useState(readStoredSession)");
  });

  it("Editar rutina: unas reps «8-12» o un descanso «75 s» se abren y se guardan tal cual, en la web y en la app", () => {
    const web = read("src/app/components/dashboard/ExerciseRowEditor.tsx");
    const editor = read("src/app/components/dashboard/PlanEditor.tsx");
    const app = read("native/Autopilot/Features/Train/PlanEditorView.swift");
    // Se leen las reps guardadas (número, rango o texto) y lo que no se entiende se enseña tal cual.
    expect(web).toContain("const reps = parseReps(ex.reps);");
    expect(web).toContain('text={reps.kind === "text" ? reps.text : undefined}');
    expect(app).toContain("let reps = PlanEditorValues.parseReps(exercise.reps)");
    expect(app).toContain("text: reps.storedText");
    expect(app).not.toContain("value: exercise.repsTarget");
    // Un descanso que no es de los rápidos se ve como «Otro» elegido y no se toca.
    expect(web).toContain("const otherRest = customRest || !restIsQuick(ex.rest, RESTS);");
    expect(app).toContain("let other = customRest || !PlanEditorValues.restIsQuick(exercise.rest, quick: Self.rests)");
    // Tocar el descanso que ya estaba elegido no lo reescribe («90 s» sigue siendo «90 s»).
    expect(web).toContain("if (rest !== s) onChange({ ...ex, rest: restValue(s) });");
    expect(app).toContain("if seconds != s { var e = exercise; e.rest = PlanEditorValues.restValue(s); onChange(e) }");
    // El Mac reescribe el texto al salir del campo: eso no cuenta como cambio (contador y peso).
    expect(app).toContain("guard v != display else { return }");
    expect(app).toContain('guard v != exercise.weight.replacingOccurrences(of: ".", with: ",") else { return }');
    // Peso: coma en pantalla (también si se guardó como número) y una sola coma decimal al escribir.
    expect(web).toContain("value={weightText(ex.weight)}");
    expect(web).toContain("onChange={(e) => onChange({ ...ex, weight: typedWeight(e.target.value) })}");
    expect(app).toContain("e.weight = PlanEditorValues.typedWeight(v)");
    expect(read("src/shared/lib/planEditorValues.ts")).toContain('return decimals.length ? `${whole}.${decimals.join("")}` : whole;');
    expect(app).toContain('return parts.count > 1 ? "\\(whole).\\(parts.dropFirst().joined())" : String(whole)');
    // Guardar no convierte nada y la app no pierde los datos del plan que no edita.
    // Solo los días que cambian pasan a `custom: true` (antes se marcaban todos al guardar).
    expect(editor).toContain("const clean = planToSave(draft, dayPlans);");
    expect(read("native/Autopilot/Core/Training.swift")).toContain("case tracking_mode, video_url, exercise_type, fatigue_level");
  });

  it("Editar rutina: rangos de repeticiones («Fijo» / «Rango») y descanso libre («Otro»), con los mismos textos y el mismo formato que el generador, en la web y en la app", () => {
    const web = read("src/app/components/dashboard/ExerciseRowEditor.tsx");
    const values = read("src/shared/lib/planEditorValues.ts");
    const app = read("native/Autopilot/Features/Train/PlanEditorView.swift");
    const row = app.slice(app.indexOf("struct PlanExerciseRow: View"), app.indexOf("struct ExercisePickerRow"));
    // Mismos textos: control segmentado «Fijo | Rango», mínimo y máximo, isométricos en «Tiempo» y descanso «Otro».
    for (const text of [
      "Fijo", "Rango", "Mínimo", "Máximo", "Repeticiones", "Tiempo", "Segundos", "Otro", "Otro descanso",
      "Descanso en segundos", "Descanso de ", "Tipo de ", "Mínimo de ", "Máximo de ", "Reducir ", "Aumentar ",
    ]) {
      expect(web, text).toContain(`${text}`);
      expect(row, text).toContain(`${text}`);
    }
    // Control segmentado común (Tabs en la web, SegmentedPill en la app), nunca uno hecho a mano.
    expect(web).toContain('<TabsTrigger value="range" className="flex-1" aria-controls={undefined}>Rango</TabsTrigger>');
    expect(row).toContain('SegmentedPill(options: ["Fijo", "Rango"], selection: Binding(');
    // Mismos patrones para leer reps y descansos («8-12», «20-60s», «180s», «2 min», «1:30»).
    const webPattern = (name: string) => values.match(new RegExp(`export const ${name} = /(.+)/i?;`))?.[1];
    const appPattern = (name: string) => app.match(new RegExp(`static let ${name} = #"(.+)"#`))?.[1];
    expect(webPattern("REPS_PATTERN")).toBeTruthy();
    expect(appPattern("repsPattern")).toBe(webPattern("REPS_PATTERN"));
    expect(appPattern("restClock")).toBe(webPattern("REST_CLOCK"));
    expect(appPattern("restMinutes")).toBe(webPattern("REST_MINUTES"));
    expect(appPattern("restPlain")).toBe(webPattern("REST_PLAIN"));
    // Misma serialización: reps «10», «8-12», «30s», «20-60s» y descansos «90s», «180s», como el generador.
    expect(values).toContain('`${v.kind === "fixed" ? v.value : `${v.min}-${v.max}`}${v.unit}`');
    expect(app).toContain('case let .fixed(n, unit): return "\\(n)\\(unit)"');
    expect(app).toContain('case let .range(low, high, unit): return "\\(low)-\\(high)\\(unit)"');
    expect(values).toContain("export const restValue = (seconds: number): string => `${seconds}s`;");
    expect(app).toContain('static func restValue(_ seconds: Int) -> String { "\\(seconds)s" }');
    const generator = read("supabase/functions/generate-plan/index.ts");
    expect(generator).toContain('reps_fuerza: "4-8", reps_hipertrofia: "8-15", reps_resistencia: "15-25", reps_isometrico: "20-60s"');
    expect(generator).toContain('rest_fuerza: "180s", rest_hipertrofia: "90s", rest_resistencia: "45s", rest_isometrico: "60s"');
    // Mismos márgenes: reps de 1 en 1 (1–100), segundos de 5 en 5 (5–600) y «Otro» de 15 en 15 (10 s–10 min).
    expect(values).toContain('unit === "s" ? { min: 5, max: 600, step: 5, spread: 10 } : { min: 1, max: 100, step: 1, spread: 2 }');
    expect(app).toContain('unit == "s" ? (min: 5, max: 600, step: 5, spread: 10) : (min: 1, max: 100, step: 1, spread: 2)');
    expect(values).toContain("export const REST_LIMITS = { min: 10, max: 600, step: 15 } as const;");
    expect(app).toMatch(/static let restMin = 10\s+static let restMax = 600\s+static let restStep = 15/);
    // Rango ↔ fijo igual: abrir ±spread y volver al centro con la misma cuenta entera.
    expect(values).toContain("Math.floor((v.min + v.max + 1) / 2)");
    expect(app).toContain("(low + high + 1) / 2");
    // Mismo descanso en pantalla («2,5 min») y para VoiceOver («descanso de 75 segundos»).
    expect(values).toContain('seconds < 120 || seconds % 30 !== 0 ? `${seconds} s` : `${Math.floor(seconds / 60)}${seconds % 60 ? ",5" : ""} min`');
    expect(app).toContain('seconds < 120 || seconds % 30 != 0 ? "\\(seconds) s" : "\\(seconds / 60)\\(seconds % 60 != 0 ? ",5" : "") min"');
    expect(values).toContain("`${ex.name}: ${seriesLabel(ex.series)}, ${repsSpoken(ex.reps)}, descanso de ${restSpoken(ex.rest)}`");
    expect(app).toContain('"\\(e.name): \\(seriesLabel(e.series)), \\(repsSpoken(e.reps)), descanso de \\(restSpoken(e.rest))"');
    // Mismo peso escrito: coma decimal en pantalla y punto al guardarlo, sin una segunda coma.
    expect(web).toContain("onChange({ ...ex, weight: typedWeight(e.target.value) })");
    expect(app).toContain("e.weight = PlanEditorValues.typedWeight(v)");
    expect(values).toContain('text.replace(/[^\\d.,]/g, "").replace(/,/g, ".").split(".")');
    expect(app).toContain('.replacingOccurrences(of: ",", with: ".")\n        let parts = clean.split(separator: ".", omittingEmptySubsequences: false)');
    // Con un texto guardado («AMRAP», «60-90 s»), escribir su número de partida también lo cambia.
    expect(web).toContain("if (n !== value || text !== undefined) onChange(n);");
    expect(app).toContain("if next != value || text != nil { onChange(next) }");
    // Zonas de 44 en los descansos y una sola cifra pegada a su unidad («20 s»).
    expect(web).toContain('"h-11 min-w-0 truncate rounded-full px-1 type-footnote font-semibold tabular-nums transition-colors"');
    expect(row).toContain(".frame(maxWidth: .infinity, minHeight: 44)");
    // Al subir o bajar una fila abierta, sigue abierta: clave por ejercicio, no por posición.
    expect(read("src/app/components/dashboard/PlanEditor.tsx")).toContain("<ExerciseRowEditor key={keys[i]} ex={ex}");
    expect(app).toContain("ForEach(PlanEditorValues.keyed(exercises)) { row in");
    // Sin ruedas del sistema ni etiquetas en mayúsculas en la fila.
    expect(row).not.toMatch(/ProgressView|\bStepper\(|\.textCase\(\.uppercase\)/);
    expect(web).not.toMatch(/uppercase|<select/);
  });

  it("Progreso con el lenguaje nuevo: Title 3, tarjetas sin borde, carga con el AP, mismos avisos y cifras en Big Shoulders, en la web y en la app", () => {
    const strengthWeb = read("src/app/components/dashboard/WorkoutProgress.tsx");
    const chartWeb = read("src/app/components/dashboard/ExerciseProgressChart.tsx");
    const overviewWeb = read("src/app/components/dashboard/TrainingOverviewCard.tsx");
    const recordsWeb = read("src/app/components/dashboard/PRsList.tsx");
    const photosWeb = read("src/app/components/dashboard/ProgressPhotos.tsx");
    const heroWeb = read("src/app/components/progress/ProgressHero.tsx");
    const web = strengthWeb + chartWeb + overviewWeb + recordsWeb + photosWeb + heroWeb;
    const app = read("native/Autopilot/Features/Progress/ProgressScreen.swift");
    // Títulos de sección en Title 3 con solo la primera en mayúscula.
    expect(strengthWeb).toContain('<h3 className="type-title3">Tu fuerza</h3>');
    expect(strengthWeb).toContain('type-title3">Tu constancia</h3>');
    expect(recordsWeb).toContain('<h3 id="records-list-title" className="mb-2.5 type-title3">Tus récords personales</h3>');
    expect(app).toContain('Text("Tu fuerza").font(.apTitle3)');
    expect(app).toContain('Text("Tu constancia").font(.apTitle3)');
    expect(app).toContain('Text("Tus récords personales").font(.apTitle3)');
    expect(app).not.toContain("TUS RÉCORDS PERSONALES");
    // Carga con el AP latiendo, nunca bloques grises.
    for (const label of ["Cargando tu progreso", "Cargando tus fotos", "Cargando tus récords"]) {
      expect(web, label).toContain(`<Spinner size="lg" label="${label}" />`);
      expect(app, label).toContain(`progressLoader("${label}")`);
    }
    expect(app).toContain("BrandLoader(size: 28).accessibilityLabel(label)");
    expect(web).not.toMatch(/<Skeleton/);
    expect(app).not.toMatch(/ProgressSkeleton|ProgressView\(/);
    // Mismos avisos de error, con «Reintentar» en píldora secundaria.
    for (const text of [
      "No hemos podido cargar tu progreso", "Revisa tu conexión y vuelve a intentarlo. Tus entrenos siguen guardados.",
      "No hemos podido cargar tus fotos", "Revisa tu conexión y vuelve a intentarlo. Tus fotos siguen guardadas.",
      "No hemos podido cargar tus récords", "Revisa tu conexión y vuelve a intentarlo. Tus marcas siguen guardadas.",
    ]) {
      expect(web, text).toContain(text);
      expect(app, text).toContain(text);
    }
    expect(app).toContain('EmptyStateView(symbol: "wifi.exclamationmark", title: title, message: message)');
    // Tarjetas sin borde: profundidad de los tokens, ni filos dorados ni blancos.
    expect(strengthWeb + overviewWeb + recordsWeb + heroWeb).not.toMatch(/border border-border|ring-1 ring-primary/);
    expect(photosWeb).not.toContain("rounded-[22px] border border-border");
    expect(app).not.toMatch(/strokeBorder\(Palette\.(gold|foreground)\.opacity|\.background\(Palette\.card, in: card\)/);
    // Cifras protagonistas en Big Shoulders, con su unidad que nunca se separa.
    for (const [w, a] of [["type-figure text-[64px]", ".figure(size: 64)"], ["type-figure text-[34px]", ".figure(size: 34)"], ["type-figure text-[40px]", ".figure(size: 40)"], ["type-figure text-[52px]", ".figure(size: 52)"], ["type-figure text-[28px]", ".figure(size: 28)"]]) {
      expect(web, w).toContain(w);
      expect(app, a).toContain(a);
    }
    expect(heroWeb + strengthWeb + chartWeb + overviewWeb + recordsWeb).not.toMatch(/text-xs|text-\[12px\]|type-caption/);
    // La subida en dorado, como el resumen del entreno, y sin «vs. último registro» (es desde la primera sesión).
    expect(strengthWeb).toContain("bg-primary/15");
    expect(app).toContain("Palette.gold.opacity(0.15), in: Capsule())");
    for (const src of [strengthWeb, app]) {
      expect(src).toContain("kg desde tu primera sesión");
      expect(src).not.toContain("vs. último registro");
    }
    // Pie de la tarjeta: 1RM estimado y la última sesión (sin «Objetivo» inventado).
    for (const text of ["1RM estimado", "Última sesión", "Añade peso a tus series", "En Reps ya ves tu evolución.", "Máximo "]) {
      expect(strengthWeb + chartWeb, text).toContain(text);
      expect(app, text).toContain(text);
    }
    expect(app).not.toContain('Text("Objetivo")');
    // Gráfica: línea dorada, rejilla tenue y el último punto resaltado.
    expect(chartWeb).toContain("strokeOpacity={0.07}");
    expect(chartWeb).toContain("r={9}");
    expect(app).toContain("AxisGridLine().foregroundStyle(Palette.foreground.opacity(0.07))");
    expect(app).toContain(".symbolSize(260)");
    // Sin foto del ejercicio, su huella; nunca un cuadro gris.
    expect(strengthWeb).toContain("<ExerciseThumb image={exerciseImages[selectedExercise]} name={selectedExercise} size=\"lg\" />");
    expect(app).toContain("ExerciseThumb(url: images[name], size: size, name: name, moves: false)");
    // Récords vacío: misma portada, textos y acción en las dos.
    for (const text of ["Tu primer récord está a un entreno", "Cada vez que registras una serie con peso, guardamos tu mejor marca de ese ejercicio.", "Ir a entrenar",
      "Tu mejor marca de cada ejercicio", "Los récords nuevos de cada mes", "El día en que rompiste cada uno"]) {
      expect(recordsWeb, text).toContain(text);
      expect(app, text).toContain(text);
    }
    // Antes y ahora: título con las semanas de evolución en las dos.
    expect(read("src/app/components/progress/progressPhotos.ts")).toContain("semanas de evolución");
    expect(app).toContain('"\\(Int((Double(days) / 7).rounded())) semanas de evolución"');
    // Pista de la cabecera de escritorio sin funciones que no hay («peso»).
    expect(read("src/app/pages/Dashboard.tsx")).toContain('progress: "Tu fuerza, tu físico y tus récords"');
    expect(read("native/Autopilot/Features/Shell/RootView.swift")).toContain('case .progress: "Tu fuerza, tu físico y tus récords"');
    // La cifra nunca se parte (PART 1 compartida con la otra rama).
    expect(strengthWeb).toContain('<span className="whitespace-nowrap">Mejor marca:</span>');
    expect(app).toContain('Text("Mejor marca:").lineLimit(1)');
  });

  it("Récords sin huecos: récords con título de sección e icono cuando falta la foto, y la mejor marca sin partir, en la web y en la app", () => {
    // (La figura dorada de los grupos sin foto se sustituyó por la huella dorada de la biblioteca rediseñada.)
    const recordsWeb = read("src/app/components/dashboard/PRsList.tsx");
    expect(recordsWeb).toContain('className="mb-2.5 type-title3">Tus récords personales</h3>');
    expect(recordsWeb).toContain('<Dumbbell className="h-[18px] w-[18px] text-muted-foreground" strokeWidth={1.75} />');
    const progressApp = read("native/Autopilot/Features/Progress/ProgressScreen.swift");
    expect(progressApp).toMatch(/Text\("Tus récords personales"\)\s*\.font\(\.apTitle3\)/);
    expect(progressApp).not.toContain('Text("TUS RÉCORDS PERSONALES")');
    expect(read("src/app/components/dashboard/WorkoutProgress.tsx")).toContain('<span className="whitespace-nowrap">Mejor marca:</span> <span className="whitespace-nowrap">{best.label}</span>');
    expect(progressApp).toContain('Text("Mejor marca:").lineLimit(1)');
  });

  it("Ajustes: cada sección abierta lleva su nombre como título grande y «‹ Ajustes» para volver, con los mismos títulos que la app", () => {
    const titles = read("src/shared/lib/settingsPages.ts");
    const app = read("native/Autopilot/Features/Account/AccountView.swift");
    for (const title of ["Perfil", "Tus datos y objetivo", "Mi plan", "Tu forma de entrenar", "Contraseña", "Privacidad y mis datos", "Legal", "Cuentas en este dispositivo"]) {
      expect(titles, title).toContain(`"${title}"`);
      expect(app, title).toContain(`"${title}"`);
    }
    expect(app).toContain(".navigationTitle(page.title)");
    const dashboard = read("src/app/pages/Dashboard.tsx");
    expect(dashboard).toContain("title={settingsTitle ?? MOBILE_TITLES[section]}");
    expect(dashboard).toContain('back={settingsTitle ? { label: "Ajustes"');
    // Un solo «Guardar datos» en «Tus datos y objetivo», como el iPhone.
    expect(read("src/app/components/SettingsPanel.tsx")).not.toContain('"Guardar cambios"}');
  });

  it("Velocidad de fotos y clips: mismos tamaños, misma precarga (Hoy, entreno, Entrenar), caché de clips con tope y medida de la primera foto, en la web y en la app", () => {
    const sizesWeb = read("src/shared/lib/fastImage.ts");
    const components = read("native/Autopilot/Design/Components.swift");
    const prefetchWeb = read("src/shared/lib/mediaPrefetch.ts");
    const loopApp = read("native/Autopilot/Design/ExerciseLoopView.swift");
    const sw = read("public/sw.js");
    // Cada hueco pide su escalón (puntos × 3): miniaturas 192 px y portadas 1000, iguales en las dos.
    expect(sizesWeb).toContain("export const IMAGE_SCALE = 3;");
    expect(components).toContain("static let scale: CGFloat = 3");
    expect(sizesWeb).toContain("export const THUMB_POINTS = 64;");
    expect(components).toContain("static let thumb: CGFloat = 64");
    expect(sizesWeb).toContain("export const HERO_POINTS = 400;");
    expect(components).toContain("static let hero: CGFloat = 400");
    // La caché de la app usa el escalón como clave: la miniatura de 48 y la de 64 pt son la misma foto.
    expect(components).toContain('"\\(url.absoluteString)|#\\(Int(MediaSizing.pixels(maxSide)))" as NSString');
    // Miniaturas al tamaño pintado, nunca la foto de 1000 px (comidas, récords, rutinas, entreno, biblioteca).
    expect(read("src/app/components/dashboard/MealsList.tsx")).toContain("fastImage(src, THUMB_SIDE)");
    expect(read("src/app/components/dashboard/PRsList.tsx")).toContain("fastImage(images[pr.exercise_name], THUMB_SIDE)");
    expect(read("src/app/components/dashboard/TrainingPlanView.tsx")).toContain("fastImage(cover, THUMB_SIDE)");
    expect(read("native/Autopilot/Features/Other/OtherViews.swift")).toContain("CachedAsyncImage(url: url, maxSide: MediaSizing.thumb)");
    expect(read("native/Autopilot/Features/Train/WorkoutView.swift")).toContain("CachedAsyncImage(url: u, maxSide: MediaSizing.thumbSide(size))");
    expect(read("native/Autopilot/Features/Train/TrainView.swift")).toContain("CachedAsyncImage(url: u, maxSide: MediaSizing.thumbSide(size))");
    // Qué se precarga: Hoy 1 clip, el entreno 2; siempre por detrás.
    expect(prefetchWeb).toContain("export const TODAY_VIDEOS = 1;");
    expect(prefetchWeb).toContain("export const WORKOUT_VIDEOS = 2;");
    expect(loopApp).toContain("static let todayVideos = 1");
    expect(loopApp).toContain("static let workoutVideos = 2");
    expect(read("src/app/components/dashboard/HomeOverview.tsx")).toContain("prefetchMedia(todayMedia(items))");
    expect(read("native/Autopilot/Features/Home/HomeView.swift")).toMatch(/prefetchToday\(\)\s*await load\(\)\s*prefetchToday\(\)/);
    expect(read("src/app/components/dashboard/WorkoutTracker.tsx")).toContain("prefetchMedia(workoutMedia(items))");
    expect(read("native/Autopilot/Features/Train/WorkoutView.swift")).toMatch(/prefetchWorkout\(\)\s*await ExerciseLoops\.shared\.load\(workout\.exercises\.map\(\\\.name\)\)\s*prefetchWorkout\(\)/);
    expect(read("src/shared/hooks/useExerciseMetadata.ts")).toContain("prefetchImages(thumbs);");
    expect(read("native/Autopilot/Features/Train/TrainView.swift")).toContain("MediaPrefetch.thumbnails(urls)");
    // Nunca bloquea: la web espera a que el navegador esté libre; la app, prioridad baja de tres en tres.
    expect(prefetchWeb).toContain("requestIdleCallback");
    expect(prefetchWeb).toContain("const PARALLEL = 3;");
    expect(components).toContain("Task(priority: .utility)");
    expect(components).toContain("stride(from: 0, to: pending.count, by: 3)");
    // Clips: la web los guarda en el service worker con tope (40) y la app en disco con tope (300 MB, LRU).
    expect(sw).toContain('const VIDEO_CACHE = "autopilot-video-v1";');
    expect(sw).toContain("const VIDEO_MAX = 40;");
    expect(sw).toContain("const MEDIA_MAX = 400;");
    expect(sw).toContain('url.pathname.startsWith("/storage/v1/render/image/public/")');
    expect(sw).toContain('url.pathname.includes("/exercise-videos/")');
    expect(loopApp).toContain("nonisolated static let capacity: Int64 = 300_000_000");
    expect(loopApp).toContain("entries.sort { $0.used < $1.used }");
    expect(loopApp).toContain("let item = AVPlayerItem(url: ExerciseVideoCache.local(url) ?? url)");
    // Nada pesado en public/: el service worker no guarda vídeos propios ni fotos de alta resolución.
    expect(sw).not.toMatch(/\.mp4["']/);
    // Medida de la primera foto: marcas solo en desarrollo o con el modo de medida (web) y os_signpost (app).
    const timingWeb = read("src/shared/lib/mediaTiming.ts");
    expect(timingWeb).toContain("import.meta.env.DEV");
    expect(timingWeb).toContain('localStorage.getItem("ap:perf") === "1"');
    expect(timingWeb).toContain("performance.measure(`first-image ${screen}`");
    expect(components).toContain('OSSignposter(subsystem: "app.autopilotplan", category: "media")');
    expect(components).toContain('signposter.beginInterval("first-image"');
    expect(read("src/app/components/dashboard/HomeOverview.tsx")).toContain('beginFirstImage("hoy")');
    expect(read("native/Autopilot/Features/Home/HomeView.swift")).toContain('MediaTiming.begin("Hoy")');
    expect(read("src/app/components/dashboard/WorkoutTracker.tsx")).toContain('beginFirstImage("entreno")');
    expect(read("native/Autopilot/Features/Train/WorkoutView.swift")).toContain('MediaTiming.begin("Entreno")');
  });

  it("Admin → Ejercicios en el iPhone: la ficha con las mismas secciones, textos y valores de partida que la web, sin «Patrón», y que cabe a 393 pt y con letra grande", () => {
    const web = read("src/app/components/admin/ExerciseLibrary.tsx");
    const app = read("native/Autopilot/Features/Admin/AdminExercises.swift");
    const rules = read("native/Autopilot/Features/Admin/AdminRules.swift");
    // Mismas secciones y campos, en el mismo orden.
    const sections = ["Información básica", "Clasificación", "Parámetros de generación", "Criterios obligatorios", "Imagen del ejercicio", "Vídeo del ejercicio", "Alternativa"];
    const order = (src: string) => sections.map((title) => src.indexOf(`"${title}"`) >= 0 ? src.indexOf(`"${title}"`) : src.indexOf(`>${title}<`));
    for (const src of [web, app]) {
      const positions = order(src);
      expect(positions.every((p) => p >= 0), String(positions)).toBe(true);
      expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    }
    for (const label of ["Grupo muscular", "Tipo", "Estímulo", "Nivel", "Prioridad", "Carga", "Fatiga", "Orden", "Clasificar", "Estable", "Progresable", "Alta tensión",
      "Escribe el nombre y pulsa Clasificar para rellenar los campos con IA.",
      "Si alguno está desactivado, el ejercicio no se incluirá en los planes generados.",
      "Se mostrará al usuario en su plan. Las fotos generadas con IA usan siempre el mismo estilo que los vídeos.",
      "Guarda el ejercicio y después podrás generar su vídeo con IA.",
      "Pega cualquier URL de YouTube (incluye Shorts), Vimeo o un .mp4 directo, o genera el vídeo con IA.",
      "YouTube, Vimeo o MP4 directo (https://…)", "Cambiar imagen", "Subir imagen", "Otra foto con IA", "Generar foto con IA", "Quitar imagen",
      "Generar otro vídeo con IA", "Generar vídeo con IA", "Eliminar ejercicio", "Nuevo ejercicio", "Editar ejercicio"]) {
      expect(web, label).toContain(label);
      expect(app, label).toContain(label);
    }
    // El campo «Patrón» y la huella se retiraron de la ficha (9964e3ea): en ninguna de las dos.
    expect(web).not.toContain('label="Patrón"');
    expect(app).not.toContain('"Patrón"');
    expect(app).not.toContain("ExerciseMotion");
    // Mismos valores de partida de un ejercicio nuevo (los criterios no pueden ir vacíos en la base de datos).
    expect(web).toContain("level: 1, priority: 2, stimulus_type:\"\", load_level:\"\", fatigue_level:\"\", recommended_order: 2");
    expect(web).toContain("is_stable: true, is_progressable: true, high_tension: true");
    expect(app).toContain("e.level = 1; e.priority = 2; e.recommended_order = 2");
    expect(app).toContain("e.is_stable = true; e.is_progressable = true; e.high_tension = true");
    // Sin valor, el criterio se ve activado en las dos (`?? true`).
    expect(web).toContain("checked={form[key] ?? true}");
    expect(app).toContain("exercise[keyPath: key] ?? true");
    // Cabe a 393 pt y con letra grande: nombre y «Clasificar» se apilan; los valores bajan bajo su
    // etiqueta si no caben; los filtros se apilan; nada de anchos mínimos en el iPhone.
    expect(app).toMatch(/if typeSize\.isAccessibilitySize \{\s*VStack\(alignment: \.leading, spacing: 8\) \{ nameField; classifyButton \}/);
    expect(app).toMatch(/if typeSize\.isAccessibilitySize \{\s*VStack\(alignment: \.leading, spacing: 8\) \{ filters \}/);
    expect(rules).toMatch(/struct AdminPickerRow[\s\S]*?ViewThatFits\(in: \.horizontal\)/);
    expect(app).toMatch(/#if os\(iOS\)\s*\.presentationDragIndicator\(\.visible\)[\s\S]*?#else\s*\.frame\(minWidth: 560, minHeight: 720\)/);
    expect(app).toMatch(/#if os\(iOS\)[\s\S]*?#else\s*\.frame\(minWidth: 480, minHeight: 420\)/);
    // Secciones con título en Title 3 (no versalitas), columna de 680 en el Mac y el AP latiendo al trabajar.
    expect(app).toContain("SectionTitle(title: title)");
    expect(app).toContain(".frame(maxWidth: 680, alignment: .leading)");
    expect(app).toContain("BrandLoader()");
    expect(app).not.toContain("ProgressView()");
    // Cifras con punto de miles y plural correcto: «1 ejercicio», «1.240 ejercicios».
    expect(app).toContain('"\\(NumberText.grouped(Double(n))) \\(n == 1 ? "ejercicio" : "ejercicios")"');
    // Sin foto, la miniatura y el héroe enseñan el músculo del ejercicio, nunca un hueco.
    expect(app).toContain("ExerciseHeroMedia(name: ex.name, image: ex.image_url, video: ex.video_url, muscleGroup: ex.muscle_group)");
  });

  it("Biblioteca completa: la web y la app leen todas las filas de ejercicios por páginas de 1.000, con orden estable", () => {
    // El mismo tamaño de página (el corte de PostgREST) y la misma regla: se pide hasta una página corta.
    const helperWeb = read("src/shared/lib/fetchAllRows.ts");
    const backend = read("native/Autopilot/Core/Backend.swift");
    expect(helperWeb).toContain("export const ROWS_PER_PAGE = 1000;");
    expect(backend).toContain("static let rowsPerPage = 1000");
    expect(helperWeb).toContain("if (!data || data.length < ROWS_PER_PAGE) return { data: rows, error: null };");
    expect(backend).toContain("if chunk.count < rowsPerPage { return rows }");
    expect(backend).toContain("let chunk = try await page(from, from + rowsPerPage - 1)");
    // Web: Admin → Ejercicios, el Drive y el selector de ejercicios; app: Admin → Ejercicios, el selector,
    // la biblioteca y los vídeos del plan. Todas por páginas y por nombre y después id.
    for (const file of ["src/app/components/admin/ExerciseLibrary.tsx", "src/app/components/admin/LibraryDrive.tsx", "src/app/components/dashboard/ExercisePicker.tsx"]) {
      const src = read(file);
      expect(src, file).toContain('fetchAllRows((from, to) => supabase');
      expect(src, file).toMatch(/\.order\("name"\)\.order\("id"\)\s*\.range\(from, to\)/);
    }
    // La biblioteca (Ejercicios) pagina con su propio bucle, con el mismo orden estable que la de la app.
    expect(read("src/shared/hooks/useExerciseLibrary.ts")).toContain('.order("name").order("id").range(from, from + PAGE - 1)');
    const appFiles = [
      "native/Autopilot/Features/Admin/AdminExercises.swift",
      "native/Autopilot/Features/Train/PlanEditorView.swift",
      "native/Autopilot/Features/Train/ExerciseLibraryView.swift",
      "native/Autopilot/Features/Admin/AdminPlanVideos.swift",
    ];
    for (const file of appFiles) {
      const src = read(file);
      expect(src, file).toContain("Backend.allRows {");
      expect(src, file).toMatch(/\.order\("name"\)\.order\("id"\)\s*\.range\(from: from, to: to\)/);
    }
    // El selector de la app ya no se queda en 200: el catálogo (y su copia sin red) es la biblioteca entera.
    const picker = read("native/Autopilot/Features/Train/PlanEditorView.swift");
    expect(picker).not.toMatch(/from\("exercises"\)[^\n]*\n?[^\n]*\.limit\(200\)/);
    expect(picker).toContain("if let rows = try? await fetchAll(), !rows.isEmpty {");
    expect(picker).toContain("return try await ExerciseCatalogStore.fetchAll { base in");
    // Cualquier otra lectura de la tabla entera en la app (sin `.in`, `.limit` ni `.single`) también va por páginas.
    const swiftFiles = [
      ...appFiles,
      "native/Autopilot/Design/BrandPhotos.swift",
      "native/Autopilot/Design/ExerciseLoopView.swift",
      "native/Autopilot/Core/Training.swift",
      "native/Autopilot/Features/Progress/ProgressScreen.swift",
      "native/Autopilot/Features/Train/WorkoutView.swift",
    ];
    for (const file of swiftFiles) {
      const src = read(file);
      for (const match of src.matchAll(/from\("exercises"\)\s*\.select\(/g)) {
        const chain = src.slice(match.index, src.indexOf(".execute()", match.index));
        if (/\.in\(|\.limit\(|\.single\(/.test(chain)) continue;
        expect(chain, file).toContain(".range(from: from, to: to)");
        expect(chain, file).toContain('.order("id")');
      }
    }
  });
});
