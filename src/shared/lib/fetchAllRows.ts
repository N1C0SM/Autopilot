/** Filas por petición: PostgREST corta cada respuesta en 1.000 aunque haya más. */
export const ROWS_PER_PAGE = 1000;

type Page<T> = PromiseLike<{ data: T[] | null; error: unknown }>;

/**
 * Lee una tabla entera por páginas (`range`) hasta la última, para que listas como la biblioteca
 * de ejercicios no se queden en las primeras 1.000 filas. La consulta debe tener un orden estable.
 */
export const fetchAllRows = async <T>(page: (from: number, to: number) => Page<T>): Promise<{ data: T[]; error: unknown }> => {
  const rows: T[] = [];
  for (let from = 0; ; from += ROWS_PER_PAGE) {
    const { data, error } = await page(from, from + ROWS_PER_PAGE - 1);
    if (error) return { data: rows, error };
    rows.push(...(data ?? []));
    if (!data || data.length < ROWS_PER_PAGE) return { data: rows, error: null };
  }
};
