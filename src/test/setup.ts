import "@testing-library/jest-dom";
import { configure } from "@testing-library/react";

// Las consultas asíncronas (findBy*) esperan 1 s por defecto. Con la suite
// completa corriendo en paralelo eso provoca fallos intermitentes por carga, no
// por lógica: subimos el margen para que el resultado sea determinista.
configure({ asyncUtilTimeout: 5000 });

class ResizeObserverMock implements ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

globalThis.ResizeObserver = ResizeObserverMock;

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});
