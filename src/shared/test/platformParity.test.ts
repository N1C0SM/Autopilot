// @vitest-environment node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { ADMIN_NAV_GROUPS } from "@/app/components/admin/adminNav";

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
      "AI SCAN", "Tu análisis corporal", "Delante", "Atrás", "Obligatoria", "Opcional", "Cambiar foto",
      "Tu objetivo", "Sin definir", "Se usa para personalizar el análisis.", "Cómo tomar las fotos",
      "Cámara a 2-3 m, a la altura del ombligo, cuerpo entero y móvil en vertical.",
      "Luz natural frontal y uniforme, sin contraluz ni flash, con fondo liso y claro.",
      "Ropa ajustada, pies a la anchura de los hombros y brazos relajados. Para la de atrás, date la vuelta sin moverte.",
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
    expect(plusCard).toContain("Tu scan completo, con Plus");
    expect(app).toContain("Tu scan completo, con Plus");
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
    // La bienvenida lleva al cuestionario, no a registrarse primero.
    expect(welcome).toMatch(/navigate\("\/onboarding"\)/);
    expect(app).toMatch(/WelcomeView\(onStart: \{ go\(\.quiz\) \}/);
    for (const text of [
      "¿Qué quieres conseguir?", "Tu semana", "Tu plan Autopilot", "Cuéntanos tu objetivo y dónde entrenas.",
      "Elige al menos dos días. Ajustamos el plan a tu semana.",
      "Así queda con tus respuestas. Crea tu cuenta para guardar tu plan completo.",
      "Perder grasa", "Ganar músculo", "Recomposición", "Fuerza y salud", "Gimnasio", "Calistenia", "Mixto",
      "Un plan solo para ti", "Entrenáis juntos con un plan para los dos", "30–45 min", "45–60 min", "60–90 min",
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
    expect(web).toContain(`<Link to="/onboarding" onClick={() => void hapticTap()}>Crear una cuenta gratis</Link>`);
    expect(app).toContain("Crear una cuenta gratis");
    for (const text of ["Recuperar contraseña", "Te enviaremos un enlace a tu correo.", "Enviar enlace", "Revisa tu correo", "Volver al inicio de sesión"]) {
      expect(read("src/app/pages/ForgotPassword.tsx"), text).toContain(text);
      expect(app, text).toContain(text);
    }
    // Nada apunta al dominio antiguo desde el acceso.
    expect(app).not.toContain("autopilotplan.app");
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

  it("Entreno: ejercicio a ejercicio por defecto, carrusel arriba y foto grande, «···» con opciones claras y lo avanzado oculto", () => {
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
    expect(web).toContain("si === firstPendingIndex && advanced && (");
    expect(app).toContain("if isCurrent && advanced {");
    expect(app).toContain('if advanced { Text("RPE")');
    // Carrusel antes que la foto, y la foto rellena el hueco.
    const webFocus = web.slice(web.indexOf("Carrusel arriba"));
    expect(webFocus.indexOf('role="tablist"')).toBeLessThan(webFocus.indexOf("fetchPriority"));
    expect(webFocus).toContain('loading="eager" className="h-full w-full object-cover"');
    const appFocus = app.slice(app.indexOf("struct FocusViewer"));
    expect(appFocus.indexOf("ScrollView(.horizontal")).toBeLessThan(appFocus.indexOf("CachedAsyncImage"));
    expect(appFocus).toContain(".frame(height: 300)");
  });

  it("Al abrir se entra directo con la última cuenta: «¿Quién entrena?» solo si está protegida, en la web y en la app", () => {
    expect(read("native/Autopilot/Core/Session.swift")).toContain("showPicker = currentLocked\n");
    expect(read("src/shared/components/native/WhoIsTraining.tsx")).toContain("if (!shown && currentLocked) showPicker();");
  });

  it("Plan y progreso: portada de la sesión también en iPhone y, sin entrenos, una invitación en vez de «0 kg»", () => {
    const train = read("native/Autopilot/Features/Train/TrainView.swift");
    expect(train).toContain("            if plan.isGym {\n                sessionCover(plan)");
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
});
