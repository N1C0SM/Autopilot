// Fotos reales de la biblioteca de ejercicios (Admin → Ejercicios), compartidas por
// la landing y la app para que ambas se reconozcan como el mismo producto.
const IMG = "https://enebrcdrdnfkyduzyrzm.supabase.co/storage/v1/object/public/site-assets/exercise-images/";

export const BRAND_PHOTOS = {
  gym: `${IMG}a31c7206-d2a4-4b31-856a-f5dec09b890e-1791475829849.png`,
  dumbbells: `${IMG}d5e30e05-0791-4886-84a0-7b2695728225-1791475865184.png`,
  home: `${IMG}14988835-a004-49d6-95c5-63978dbce978-1791475887313.png`,
  pullupBar: `${IMG}7ab0b27f-f296-4fa6-bf07-8f8b026b0832-1791475152675.png`,
} as const;
