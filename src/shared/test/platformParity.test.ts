// @vitest-environment node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { ADMIN_NAV_GROUPS } from "@/app/components/admin/adminNav";
import { DETAIL_SECTIONS, EQUIPMENT, FILTER_GROUPS, MODALITIES } from "@/shared/lib/exerciseLibrary";

/**
 * Web y apps nativas son un solo producto: web grande = Mac, web pequeña = iPhone.
 * Este test falla si los menús se separan (una sección añadida o quitada solo en un lado).
 * El chat de cliente no cuenta: está detrás del corte de lanzamiento (`releaseScope.ts`).
 */
const root = resolve(__dirname, "../../..");
const read = (p: string) => readFileSync(resolve(root, p), "utf8");
const swift = read("native/Autopilot/Features/Shell/RootView.swift");

/** `case .x: "Título"` de un `switch` concreto de RootView.swift. */
const swiftTitles = (prop: "title" | "tabTitle") => {
  const body = swift.slice(swift.indexOf(`var ${prop}: String {`));
  const block = body.slice(0, body.indexOf("\n    }\n"));
  return Object.fromEntries([...block.matchAll(/case \.(\w+): "([^"]+)"/g)].map((m) => [m[1], m[2]]));
};
const swiftList = (name: string) => {
  const m = swift.match(new RegExp(`static let ${name}: \\[AppSection\\] = \\[([^\\]]*)\\]`));
  return (m?.[1] ?? "").split(",").map((s) => s.trim().replace(/^\./, "")).filter(Boolean);
};
const titles = swiftTitles("title");
const tabTitles = { ...titles, ...swiftTitles("tabTitle") };

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
    expect(webItems("src/app/components/UserSidebar.tsx", "NAV_ITEMS", "title", "section")).toEqual(mac);
  });

  it("web pequeña = iPhone: mismas pestañas, en el mismo orden", () => {
    const iphone = swiftList("userTabs").map((s) => tabTitles[s]);
    expect(iphone).toHaveLength(4);
    expect(webItems("src/app/components/mobile/MobileTabBar.tsx", "TABS", "label", "key")).toEqual(iphone);
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
    expect(app).toMatch(/if let url = photos\[Self\.dish\(meal\)\]/);
    expect(app).toMatch(/group\.addTask \{ \(dish, await AiCover\.ownMeal\(dish\)\) \}/);
  });

  it("Nutrición: cada comida con sus macros, que suman el objetivo y se suman al marcarlas, en la web y en la app", () => {
    const web = read("src/app/components/dashboard/MealsList.tsx");
    const app = read("native/Autopilot/Features/Other/OtherViews.swift");
    const note = "Al marcar una comida se suman sus macros del plan. Es una estimación: no se pesa lo que comes.";
    expect(web).toContain(note);
    expect(app).toContain(note);
    expect(web).toMatch(/kcal · P \{own\.protein\} g · C \{own\.carbs\} g · G \{own\.fats\} g/);
    expect(app).toMatch(/kcal · P \\\(own\.protein\) g · C \\\(own\.carbs\) g · G \\\(own\.fats\) g/);
    // El reparto exacto vive en mealMacros.ts y la app lo replica.
    expect(web).toMatch(/mealMacros\(meals, \{ kcal, protein: p, carbs: c, fats: f \}\)/);
    expect(app).toMatch(/static func splitExact\(_ total: Double, _ weights: \[Double\]\) -> \[Int\]/);
    // Ingredientes con su peso para pesarlos, en las dos.
    expect(web).toMatch(/const ingredients = mealIngredients\(meal\);/);
    expect(app).toMatch(/let weighed = meal\.weighed/);
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
      expect(src).toContain("Regenerando comidas…");
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
    const web = read("src/app/components/scan/ProgressScan.tsx");
    const plusCard = read("src/app/components/scan/ScanPlusCard.tsx");
    const app = read("native/Autopilot/Features/Scan/ScanView.swift");
    expect(read("src/app/pages/Dashboard.tsx")).toMatch(/<ProgressScan /);
    for (const text of [
      "AI SCAN", "Análisis físico con IA", "Foto de delante", "Foto de atrás", "Obligatoria", "Opcional", "Cambiar foto",
      "Tu objetivo", "Sin definir", "Se usa para personalizar el análisis.", "Cómo tomar las fotos",
      "Cuerpo entero, de pie y con el móvil en vertical", "Cámara a 2-3 m, a la altura del ombligo",
      "Luz natural frontal, sin contraluz ni flash", "Ropa ajustada y fondo liso y claro",
      "Para la de atrás, date la vuelta sin moverte",
      "Analizar mi físico",
      "Con una sola foto ya podemos analizarte: valoraremos solo lo que se vea en esa vista. Con las dos fotos el análisis es más completo.",
      "Privado: solo para tu análisis · Sin registro · Menos de 1 minuto",
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
      "Te damos la bienvenida a", "Crear mi rutina gratis", "Ya tengo cuenta",
      "Tu rutina se adapta cada semana a lo que haces y a cómo progresas.",
      "Calorías, macros y comidas que encajan con tu objetivo y tu día.",
      "Tu plan se mantiene al día solo. Tú apareces, él se encarga del resto.",
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
    // Acceso: la «A» con rayo y la palabra AUTOPILOT; campos con icono y ojo en la contraseña.
    const authWeb = read("src/app/components/auth/AuthScreenParts.tsx");
    const loginApp = read("native/Autopilot/Features/Auth/LoginView.swift");
    const signupApp = read("native/Autopilot/Features/Auth/OnboardingView.swift");
    expect(authWeb).toContain("<BrandMark size={44} />");
    expect(authWeb).toContain("AUTOPILOT</span>");
    for (const app of [loginApp, signupApp]) {
      expect(app).toContain("BrandMark(size: 44)");
      expect(app).toContain('Text("AUTOPILOT")');
    }
    expect(read("src/app/pages/Login.tsx")).toContain("icon={LockKeyhole}");
    expect(loginApp).toContain('icon: "lock")');
    expect(read("native/Autopilot/Design/Theme.swift")).toContain('reveal ? "Ocultar contraseña" : "Mostrar contraseña"');
    // Insignia Plus con candado en las secciones bloqueadas del scan.
    expect(read("src/app/components/scan/ScanPlusCard.tsx")).toContain("<PlusBadge />");
    expect(read("native/Autopilot/Features/Scan/ScanView.swift")).toContain("PlusBadge()");
    // Hoy: un círculo por día con check dorado si la sesión está hecha.
    const homeWeb = read("src/app/components/dashboard/HomeOverview.tsx");
    const homeApp = read("native/Autopilot/Features/Home/HomeView.swift");
    expect(homeWeb).toContain('"flex h-8 w-8 items-center justify-center rounded-full"');
    expect(homeApp).toContain(".frame(width: 32, height: 32)");
    expect(homeWeb).toContain("completedDays.includes(day)");
    expect(homeApp).toContain("snapshot?.doneDays");
    // Plan: el día elegido en dorado macizo y hoy con anillo dorado.
    expect(read("src/app/components/dashboard/TrainingPlanView.tsx")).toContain('? "bg-primary text-primary-foreground"');
    expect(read("native/Autopilot/Features/Train/TrainView.swift")).toContain("if isToday && !isExpanded { Circle().strokeBorder(Palette.gold");
    // Progreso: control segmentado con la sección activa en dorado.
    expect(read("src/app/pages/Dashboard.tsx")).toContain("data-[state=active]:bg-primary data-[state=active]:text-primary-foreground");
    expect(read("native/Autopilot/Features/Progress/ProgressScreen.swift")).toContain("selection: $tab, gold: true)");
    // Barra de pestañas con la activa en dorado, sin píldora.
    expect(read("src/app/components/mobile/FloatingMobileNav.tsx")).toContain('isActive ? "text-primary" : "text-muted-foreground"');
    expect(read("native/Autopilot/Design/Components.swift")).toContain(".foregroundStyle(active ? Palette.gold : Palette.muted)");
    // La semana de Hoy va en tarjeta en las dos.
    expect(homeWeb).toContain('rounded-[22px] border border-border bg-card p-4');
    expect(homeApp).toContain("return Card(padding: 16) {");
    // Hoy de ChatGPT: «Hoy» grande, sesión con foto a la derecha, «Tu progreso», «Tu plan», «Ver detalle» y Nutrición en tarjetas.
    for (const text of ['>Hoy<', "Entrenamiento de hoy", "Tu progreso", "Tu plan", "Revisa y ajusta tu plan de entrenamiento.", "Ver detalle"]) {
      expect(homeWeb, text).toContain(text);
    }
    for (const text of ['Text("Hoy")', "Entrenamiento de hoy", "Tu progreso", "Tu plan", "Revisa y ajusta tu plan de entrenamiento.", "Ver detalle"]) {
      expect(homeApp, text).toContain(text);
    }
    // Plan semanal de ChatGPT: título, subtítulo, iniciales en el selector y la semana en filas con foto.
    const planWeb = read("src/app/components/dashboard/TrainingPlanView.tsx");
    const planApp = read("native/Autopilot/Features/Train/TrainView.swift");
    expect(read("src/app/pages/Dashboard.tsx")).toContain('training: "Plan semanal"');
    expect(read("native/Autopilot/Features/Shell/RootView.swift")).toContain('case .train: "Plan semanal"');
    for (const src of [planWeb, read("native/Autopilot/Features/Train/TrainView.swift")]) {
      for (const text of ["Tu rutina de entrenamiento, día a día.", '"L", "M", "X", "J", "V", "S", "D"', "Recuperación", "Tu plan aún no tiene sesiones", "es día de descanso"]) {
        expect(src, text).toContain(text);
      }
    }
    expect(planWeb).toContain("<DayRow");
    expect(planApp).toContain("dayRow(day)");
    // La tarjeta de la rutina va bajo la semana en las dos.
    expect(planWeb).toContain("{tools}");
    expect(planApp).toContain("if let routineBar { routineBar }");
    // Progreso de ChatGPT: «Tu fuerza» con el último récord, la subida en kg y «Tu constancia» debajo.
    const progressWeb = read("src/app/components/dashboard/WorkoutProgress.tsx") + read("src/app/pages/Dashboard.tsx");
    const progressApp = read("native/Autopilot/Features/Progress/ProgressScreen.swift");
    for (const text of ["Tu fuerza", "Evolución de tus principales ejercicios.", "Último récord", "Ver todos mis ejercicios", "Ver menos ejercicios", "Tu constancia", "Evolución de tu fuerza, tu físico y tus récords."]) {
      expect(progressWeb, text).toContain(text);
      expect(progressApp, text).toContain(text);
    }
    expect(progressWeb).toContain("exerciseRecord(history)");
    expect(progressApp).toContain("static func record(_ entries: [ExerciseEntry])");
    // Nutrición de ChatGPT (Gratis): tarjeta de calorías con macros y «Más en Plus» con candados, sin pagos externos en la app.
    const nutritionWeb = read("src/app/components/dashboard/BasicNutrition.tsx") + read("src/app/components/dashboard/NutritionPlusSection.tsx");
    const nutritionApp = read("native/Autopilot/Features/Other/OtherViews.swift");
    for (const text of ["Plan de alimentación básico.", "Calorías diarias", "Carbohidratos", "Grasas", "Más en Plus", "Desbloquea tu plan de comidas completo y personalizado.",
      "Comidas de cada día", "Ajustadas a tus macros y a lo que te gusta.", "Seguimiento de macros", "Marca cada comida y se suman sus macros.", "Menú a tu gusto", "Regenera tus comidas cuando quieras.", "Incluido en Plus",
      "Estimación inicial según tus datos y objetivo. No sustituye una valoración nutricional individual."]) {
      expect(nutritionWeb, text).toContain(text);
      expect(nutritionApp, text).toContain(text);
    }
    expect(nutritionWeb).toContain("onUpgrade && !isIOSNative()");
    expect(nutritionApp).not.toContain("Descubre Autopilot Plus");
    // Ajustes de ChatGPT: índice agrupado con iconos que lleva a cada sección, en las dos.
    const settingsWeb = read("src/app/components/SettingsPanel.tsx");
    const settingsApp = read("native/Autopilot/Features/Account/AccountView.swift");
    for (const text of ["Gestiona tu cuenta, plan y preferencias.", "Mi cuenta", "Nombre, foto y privacidad", "Tus datos y objetivo", "Edad, peso, objetivo y disponibilidad", "Mi plan",
      "Preferencias", "Vista del entreno y descanso entre series", "Cambia tu contraseña", "Privacidad y legal", "Exporta tus datos y política de privacidad", "Términos, cookies y avisos"]) {
      expect(settingsWeb, text).toContain(text);
      expect(settingsApp, text).toContain(text);
    }
    for (const id of ["ajustes-perfil", "ajustes-datos", "ajustes-plan", "ajustes-entreno", "ajustes-contrasena", "ajustes-privacidad", "ajustes-legal"]) {
      expect(settingsWeb, id).toContain(`id="${id}"`);
      expect(settingsApp, id).toContain(`.id("${id}")`);
    }
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
    expect(read("src/app/components/ExerciseMedia.tsx")).toContain("fastImage(image, 192)");
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

  it("Entreno: toda la sesión en lista por defecto, carrusel arriba y foto grande en ejercicio a ejercicio, «···» con opciones claras y lo avanzado oculto", () => {
    const web = read("src/app/components/dashboard/WorkoutTracker.tsx");
    const prefs = read("src/shared/lib/workoutPreferences.ts");
    const app = read("native/Autopilot/Features/Train/WorkoutView.swift");
    expect(prefs).toContain('=== "focus" ? "focus" : "list"');
    expect(app).toContain('@AppStorage("workout-view") private var workoutView = "list"');
    expect(read("native/Autopilot/Features/Account/AccountView.swift")).toContain('forKey: "workout-view") ?? "list"');
    for (const text of ["Ver toda la sesión", "Ver ejercicio a ejercicio", "Más opciones por serie", "Descartar entrenamiento"]) {
      expect(web, text).toContain(text);
      expect(app, text).toContain(text);
    }
    // Bajada, calentamiento (y en la app RPE y fallo) solo con «Más opciones por serie».
    expect(web).toContain("si === firstPendingIndex && advanced && (");
    expect(app).toContain("if isCurrent && advanced {");
    expect(app).toContain('if advanced { Text("RPE")');
    // Carrusel antes que la foto, y la foto rellena el hueco.
    const webFocus = web.slice(web.indexOf("Carrusel arriba"));
    expect(webFocus.indexOf('role="tablist"')).toBeLessThan(webFocus.indexOf("fetchPriority"));
    expect(webFocus).toContain('loading="eager" className="h-full w-full object-cover"');
    const appFocus = app.slice(app.indexOf("struct FocusViewer"));
    expect(appFocus.indexOf("ScrollView(.horizontal")).toBeLessThan(appFocus.indexOf("CachedAsyncImage"));
    expect(appFocus).toContain(".frame(height: 220)");
    expect(web).toContain("aspect-[4/3] max-h-[26dvh]");
    // La foto no se repite: sin miniatura en la tarjeta del ejercicio en foco.
    expect(web).toMatch(/\{!focused && \(\s*<span className="relative shrink-0">\s*<ExerciseThumb/);
    expect(app).toMatch(/if !focused \{\s*WorkoutThumb\(url: exercise\.image_url/);
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
    // Serie y ejercicio hechos en verde, nunca en dorado.
    expect(web).toContain('"border-primary bg-primary text-primary-foreground"');
    expect(web).toContain('<span className="flex h-11 w-9 items-center justify-center text-primary">');
    expect(app).toContain("Circle().strokeBorder(set.done ? Palette.gold");
    expect(app).toContain('Image(systemName: "checkmark").font(.inter(size: 18, weight: .bold))');
    // Título del ejercicio, «Salir» y «···» en blanco.
    expect(app).toContain(".foregroundStyle(allDone ? Palette.muted : Palette.foreground)");
    expect(web).not.toMatch(/pl-0\.5 pr-2 text-primary/);
    expect(app).not.toContain('Image(systemName: "ellipsis").font(.inter(size: 15, weight: .bold)).foregroundStyle(Palette.gold)');
  });

  it("Entreno activo (diseño ChatGPT): cabecera con avance, ejercicios numerados y plegables, y barra Pausar · tiempo · Finalizar con pausa real", () => {
    const web = read("src/app/components/dashboard/WorkoutTracker.tsx");
    const app = read("native/Autopilot/Features/Train/WorkoutView.swift");
    const model = read("native/Autopilot/Features/Train/ActiveWorkout.swift");
    for (const text of ["Entrenamiento en curso", "Entrenamiento en pausa", "Pausar", "Reanudar", "Tiempo transcurrido", "En pausa", "Finalizar", "ejercicios"]) {
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
    const loop = read("native/Autopilot/Design/LoopingVideo.swift");
    expect(web).toContain("const loop = vid && isDirectFile(vid) && !prefersReducedMotion ? vid : null;");
    expect(web).toContain("autoPlay muted loop playsInline");
    expect(app).toContain("if !reduceMotion, let v = loops.urls[ex.name] { LoopingVideo(url: v) }");
    expect(loop).toContain("player.isMuted = true");
    expect(loop).toContain("AVPlayerLooper(");
    expect(loop).toContain('["mp4", "mov", "m4v"]');
  });

  it("Tu semana: la web y la app guardan los días elegidos (0 = domingo) y el plan entrena justo esos, no desde el lunes", () => {
    expect(read("src/app/pages/Configurator.tsx")).toContain("training_days: c.days");
    expect(read("native/Autopilot/Features/Auth/OnboardingView.swift")).toContain("training_days: days");
    const gen = read("supabase/functions/generate-plan/index.ts");
    expect(gen).toContain("availabilityObj.training_days");
    expect(gen).toContain("(n + 6) % 7");
    expect(gen).toContain("rules, skillProfile, chosenDays);");
    expect(gen).toContain("for (const dayIdx of order)");
  });

  it("Gratis y Plus no leen «tu entrenador» en el primer uso ni en Nutrición", () => {
    const web = read("src/app/pages/Dashboard.tsx");
    expect(web).not.toContain("No necesitas contratar un entrenador para empezar.");
    expect(web).not.toContain("hasta que tu entrenador calcule");
    expect(read("native/Autopilot/Features/Train/TrainView.swift")).not.toContain("En cuanto tengamos tu plan");
  });

  it("Scan: la misma ruedecita de espera en la web y en la app (anillo con %, mensajes y ritmo)", () => {
    const shared = read("src/shared/lib/scanLoading.ts");
    const view = read("src/app/components/scan/ScanAnalyzing.tsx");
    const app = read("native/Autopilot/Features/Scan/ScanView.swift");
    // El scan público y el de Progreso usan la misma pantalla; la app la calca.
    expect(read("src/app/pages/Scan.tsx")).toMatch(/<ScanAnalyzing progress=\{scanProgress\}/);
    expect(read("src/app/components/scan/ProgressScan.tsx")).toMatch(/<ScanAnalyzing progress=\{progress\} \/>/);
    expect(app).toMatch(/ScanAnalyzingView\(progress: progress\)/);
    const messages = [...shared.matchAll(/^\s+"([^"]+…)",$/gm)].map((m) => m[1]);
    expect(messages.length).toBe(6);
    for (const text of messages) expect(app, text).toContain(`"${text}"`);
    for (const text of ["Analizando tu físico", "Progreso del análisis"]) {
      expect(view, text).toContain(text);
      expect(app, text).toContain(text);
    }
    // Mismo ritmo de mensajes y misma curva: 95 % como tope y constante de 6 s.
    expect(shared).toMatch(/SCAN_MESSAGE_MS = 1600/);
    expect(app).toMatch(/messageInterval: Duration = \.milliseconds\(1600\)/);
    expect(shared).toMatch(/95 \* \(1 - Math\.exp\(-Math\.max\(0, elapsedMs\) \/ 6000\)\)/);
    expect(app).toMatch(/95 \* \(1 - exp\(-max\(0, seconds\) \/ 6\)\)/);
    // Anillo de 160 px y trazo 12 con la cifra en Big Shoulders.
    expect(view).toMatch(/size=\{160\} stroke=\{12\}/);
    expect(app).toMatch(/lineWidth: 12/);
    expect(app).toMatch(/\.frame\(width: 160, height: 160\)/);
    expect(view).toContain("type-figure");
    expect(app).toMatch(/\.font\(\.figure\(size: 34\)\)/);
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

  it("Biblioteca de ejercicios: misma entrada en Entrenar, mismos filtros y mismas secciones de ficha, en la web y en la app", () => {
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
    // Se abre desde la barra de la rutina, junto a «Editar», en los dos lados.
    expect(read("src/app/pages/Dashboard.tsx")).toMatch(/label: "Ejercicios",[^}]*setLibraryOpen\(true\)/);
    const train = read("native/Autopilot/Features/Train/TrainView.swift");
    expect(train).toMatch(/Label\("Ejercicios", image: "lu-book-open"\)/);
    expect(train).toContain("ExerciseLibraryView(userId: session.userId)");
    const web = read("src/app/components/library/ExerciseLibrarySheet.tsx");
    for (const text of ["Demostración en preparación", "Recientes", "Favoritos", "Quitar filtros"]) {
      expect(web).toContain(text);
      expect(app).toContain(text);
    }
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
});
