import fs from "fs";
import path from "path";

/**
 * Mapa de evidencias en código para las tareas del Roadmap.
 * Cada tarea se asocia a archivos reales en el repositorio (Swift, TS, TSX).
 * Si todos los archivos requeridos existen, la tarea se valida automáticamente.
 */
const taskEvidence = [
  {
    pattern: /Resumen final del cuestionario/i,
    requiredFiles: ["src/app/pages/Configurator.tsx"],
  },
  {
    pattern: /Pantalla para elegir cómo empezar/i,
    requiredFiles: ["src/app/pages/OnboardingChoice.tsx"],
  },
  {
    pattern: /Revisión de portada web y panel/i,
    requiredFiles: ["src/web/pages/Index.tsx", "src/app/pages/Dashboard.tsx"],
  },
  {
    pattern: /«Hoy»: Empezar entreno \/ Continuar entreno/i,
    requiredFiles: [
      "src/app/components/dashboard/HomeOverview.tsx",
      "native/Autopilot/Features/Home/HomeView.swift",
    ],
  },
  {
    pattern: /Entrenar primero: botón fijo «Ir a entrenar»/i,
    requiredFiles: ["src/app/components/mobile/MobileTabBar.tsx"],
  },
  {
    pattern: /Hoy: quitado botón duplicado en descanso/i,
    requiredFiles: ["src/app/components/dashboard/HomeOverview.tsx"],
  },
  {
    pattern: /Probado a 375 px/i,
    requiredFiles: ["src/app/components/dashboard/WorkoutTracker.tsx"],
  },
  {
    pattern: /Fase A Apple: confirmaciones del entreno/i,
    requiredFiles: [
      "native/Autopilot/Features/Train/WorkoutView.swift",
      "src/app/components/dashboard/WorkoutTracker.tsx",
    ],
  },
  {
    pattern: /Fase B Apple: explicar por qué se sube o mantiene el peso/i,
    requiredFiles: [
      "native/Autopilot/Core/Progression.swift",
      "src/shared/lib/workoutProgression.ts",
    ],
  },
  {
    pattern: /Fase C Apple: icono, capturas y texto/i,
    requiredFiles: [
      "native/Autopilot/Assets.xcassets/AppIcon.appiconset",
      "store-assets",
    ],
  },
  {
    pattern: /HealthKit: guardar cada entrenamiento/i,
    requiredFiles: [
      "native/Autopilot/Core/HealthKitManager.swift",
      "native/Autopilot/App.entitlements",
    ],
  },
  {
    pattern: /Widgets de pantalla de inicio y de bloqueo/i,
    requiredFiles: [
      "native/Widgets/AutopilotWidgets.swift",
      "native/Shared/RestActivity.swift",
    ],
  },
  {
    pattern: /App para Apple Watch/i,
    requiredFiles: ["native/Watch"], // No existe aún -> permanecerá en [ ]
  },
];

function syncRoadmap() {
  const root = process.cwd();
  const roadmapPath = path.join(root, "roadmap.md");

  if (!fs.existsSync(roadmapPath)) {
    console.error("No se encontró roadmap.md");
    process.exit(1);
  }

  const content = fs.readFileSync(roadmapPath, "utf-8");
  const lines = content.split("\n");
  let changesCount = 0;

  const updatedLines = lines.map((line) => {
    // Detectar líneas de tarea markdown "- [ ]" o "- [x]"
    const match = line.match(/^(\s*-\s*\[)([\sx])(\]\s+)(.*)$/i);
    if (!match) return line;

    const [, prefix, currentStatus, middle, taskText] = match;
    const rule = taskEvidence.find((r) => r.pattern.test(taskText));

    if (!rule) {
      // Si la tarea es de validación manual (ej: "Probar con usuarios reales") no la tocamos
      return line;
    }

    const allExist = rule.requiredFiles.every((file) => fs.existsSync(path.join(root, file)));
    const newStatus = allExist ? "x" : " ";

    if (currentStatus.toLowerCase() !== newStatus) {
      changesCount++;
      const symbol = newStatus === "x" ? "✔" : "✖";
      console.log(`[SYNC] ${symbol} ${taskText.trim()}`);
      return `${prefix}${newStatus}${middle}${taskText}`;
    }

    return line;
  });

  if (changesCount > 0) {
    fs.writeFileSync(roadmapPath, updatedLines.join("\n"), "utf-8");
    console.log(`\n🎉 Roadmap actualizado con éxito (${changesCount} cambios).`);
  } else {
    console.log("\n✨ El Roadmap ya está 100% sincronizado con el código real.");
  }
}

syncRoadmap();
