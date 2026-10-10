import { jsonObject, jsonString } from "./runtimeValues";

export type Recommendation = {
  id?: string;
  title: string;
  description: string;
  image_url: string;
  url: string;
  badge: string;
};

/** Settings are JSON, so malformed entries must not crash public pages. */
export const parseRecommendations = (value: unknown): Recommendation[] => {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    const item = jsonObject(entry);
    if (typeof item.title !== "string") return [];
    return [{
      ...(typeof item.id === "string" ? { id: item.id } : {}),
      title: item.title,
      description: jsonString(item.description),
      image_url: jsonString(item.image_url),
      url: jsonString(item.url),
      badge: jsonString(item.badge),
    }];
  });
};
