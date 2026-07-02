// Enlaces a las tiendas de la app.
// Deja el string vacío ("") si la app aún no está publicada en esa tienda
// y el badge se ocultará automáticamente.
//
// Cuando publiques, pega aquí la URL final:
//   iOS  → https://apps.apple.com/app/id0000000000
//   And. → https://play.google.com/store/apps/details?id=app.lovable.aa0029da00154c05a2b503e61df0f87c
export const APP_STORE_URL = "";
export const PLAY_STORE_URL = "";

export const hasAnyStoreLink = () =>
  Boolean(APP_STORE_URL) || Boolean(PLAY_STORE_URL);