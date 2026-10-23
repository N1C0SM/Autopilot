import { describe, expect, it } from "vitest";
import { socialLinkList, socialUrl } from "@/shared/lib/socialLinks";

describe("socialLinks", () => {
  it("turns an @handle into the network link", () => {
    expect(socialUrl("instagram", "@autopilot")).toBe("https://instagram.com/autopilot");
  });
  it("keeps only digits for WhatsApp", () => {
    expect(socialUrl("whatsapp", "+34 600 000 000")).toBe("https://wa.me/34600000000");
  });
  it("hides networks left empty", () => {
    expect(socialLinkList({ instagram: "a", x: "" }).map((l) => l.key)).toEqual(["instagram"]);
  });
});
