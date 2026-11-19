import { Search, X } from "lucide-react";
import { cn } from "@/shared/lib/utils";

/**
 * Buscador en píldora, plano (sin relieve): lupa, texto y «Borrar» con zona táctil de 44 px.
 * Lo usan la biblioteca de ejercicios y los buscadores de ejercicios. Es `SearchPill` en la app
 * (`Components.swift`): mismo alto, mismos márgenes y mismas etiquetas.
 */
export function SearchPill({ value, onChange, placeholder, className }: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  className?: string;
}) {
  return (
    <label className={cn("flex h-11 shrink-0 items-center gap-2 rounded-full bg-card bg-none pl-4 pr-1 shadow-none", className)}>
      <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      <input
        type="search"
        enterKeyHint="search"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="min-w-0 flex-1 bg-transparent type-body outline-none placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:appearance-none"
      />
      {value ? (
        <button
          type="button"
          aria-label="Borrar búsqueda"
          onClick={() => onChange("")}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground active:opacity-60"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      ) : <span aria-hidden className="w-3 shrink-0" />}
    </label>
  );
}
