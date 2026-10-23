import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

/**
 * Entrega a `children` la URL de la imagen, o `null` si esa URL ha fallado al cargar,
 * para que el componente compartido pinte su hueco compuesto en vez del icono de
 * imagen rota. Escucha `error` en fase de captura porque no burbujea.
 */
export const WithImageFallback = ({
  image,
  children,
}: {
  image?: string | null;
  children: (image: string | null | undefined) => ReactNode;
}) => {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const ref = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node || !image) return;
    const onError = (event: Event) => {
      if (event.target instanceof HTMLImageElement) setFailedUrl(image);
    };
    node.addEventListener("error", onError, true);
    return () => node.removeEventListener("error", onError, true);
  }, [image]);

  return (
    <span ref={ref} className="contents">
      {children(image && failedUrl === image ? null : image)}
    </span>
  );
};
