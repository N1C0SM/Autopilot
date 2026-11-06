export type StoreLinks = { ios: string; android: string; mac: string };

const valid = (u: string) => /^https?:\/\/\S+$/i.test(u.trim());

/** La sección de descargas solo se muestra con los tres enlaces de tienda válidos. */
export const storeLinksComplete = (l: StoreLinks) => valid(l.ios) && valid(l.android) && valid(l.mac);
