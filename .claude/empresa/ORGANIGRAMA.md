# Agentes de Autopilot

Autopilot funciona como una empresa con IA. Esta carpeta define quién es quién y cómo se reparte el trabajo. Las reglas de autoridad y aprobaciones siguen siendo las de [`ATLAS.md`](ATLAS.md); aquí está el organigrama y los agentes ejecutables.

## Organigrama

```
CEO — Nicolás (humano)
 │  pone objetivos, prioridades, presupuesto y aprueba lo sensible
 ▼
Co-CEO — Atlas (IA: la sesión principal de Claude Code)
 │  traduce el objetivo en departamentos, abre/cierra departamentos,
 │  lanza a los empleados que piden los directores y rinde cuentas al CEO
 ▼
Directores de departamento (IA) — SOLO planifican y delegan
 │  convierten el encargo del co-CEO en tareas con criterio de aceptación
 │  y eligen qué empleado hace cada una. Nunca escriben código ni contenido.
 ▼
Empleados (IA) — construyen
    ejecutan una tarea concreta, la verifican y entregan evidencia
```

## Flujo de un objetivo

1. **CEO** escribe el objetivo (p. ej. «≥ 100 € netos en libros este mes»).
2. **Co-CEO** lo descompone (ciclo de ATLAS), decide qué departamentos hacen falta y lo anota en `.claude/empresa/ESTADO.md › Organización`.
3. Por cada departamento, el co-CEO invoca a su **director** con el encargo. El director devuelve un **plan de delegación**: tareas, empleado asignado, criterio de aceptación y orden/dependencias.
4. El co-CEO lanza a los **empleados** con esas tareas (en paralelo cuando no dependen entre sí).
5. Cada empleado entrega su resultado con evidencia (`[VERIFICADO]` + método). El director revisa contra su criterio y da el visto bueno o pide corrección.
6. El co-CEO consolida, pide al CEO las aprobaciones necesarias (publicar, gastar, precios…) y cierra o reorganiza departamentos.

> Límite técnico: en Claude Code un subagente no puede lanzar otro subagente. Por eso la delegación de director → empleado la ejecuta el co-CEO siguiendo el plan del director. El director decide; el co-CEO ejecuta su decisión.

## Departamentos

Los departamentos son **funciones que se abren por objetivo**, no puestos fijos (ATLAS › Organización adaptativa). Los definidos hoy:

| Departamento | Director (delega) | Empleados (construyen) |
|---|---|---|
| Diseño | `director-diseno` | `disenador-ui` |
| Producto e Ingeniería | `director-producto` | `dev-frontend`, `dev-backend`, `dev-nativo` |
| Crecimiento (marketing y ventas) | `director-crecimiento` | `copywriter`, `analista-datos` |
| Calidad | `director-calidad` | `qa-tester` |

Para crear un departamento o empleado nuevo, copia [`plantillas/director.md`](plantillas/director.md) o [`plantillas/empleado.md`](plantillas/empleado.md) a `.claude/agents/` y añádelo a esta tabla.

## Dónde viven

- `.claude/agents/*.md` — agentes ejecutables (subagentes de Claude Code, se cargan solos).
- `.claude/empresa/co-ceo.md` — el papel del co-CEO (lo cumple la sesión principal; no es un subagente).
- `.claude/empresa/plantillas/` — plantillas para crear directores y empleados.

## Reglas para todos

- Nada de afirmar trabajo que no se ejecutó; etiquetas de ATLAS (`[HECHO]`, `[HIPÓTESIS]`, `[VERIFICADO]`…).
- Toda pantalla respeta [`.claude/design`](../design/README.md) y pasa su checklist.
- Lo que requiere aprobación del CEO (ATLAS) se pide; nunca se hace por cuenta propia.
