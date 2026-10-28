import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ChatMessages from "@/app/components/chat/ChatMessages";

vi.mock("@/shared/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "me" } }) }));
vi.mock("@/shared/lib/storageSign", () => ({
  signedUrlsFor: (_bucket: string, urls: string[]) => Promise.resolve(new Map(urls.map((url) => [url, `https://signed.test/${url}`]))),
}));

afterEach(cleanup);

const at = "2026-10-09T12:00:00Z";

describe("chat messages", () => {
  it("hides the stored placeholder text under attachments but keeps real text", async () => {
    render(
      <ChatMessages
        onViewMedia={vi.fn()}
        messages={[
          { id: "1", sender_id: "me", content: "📷 Foto", media_url: "a.jpg", media_type: "image", created_at: at },
          { id: "2", sender_id: "other", content: "📹 Video", media_url: "b.mp4", media_type: "video", created_at: at },
          { id: "3", sender_id: "other", content: "Foto", media_url: "c.jpg", media_type: "image", created_at: at },
        ]}
      />,
    );
    await screen.findAllByAltText("Foto");
    expect(screen.queryByText("📷 Foto")).toBeNull();
    expect(screen.queryByText("📹 Video")).toBeNull();
    expect(screen.getByText("Foto")).toBeInTheDocument();
  });

  it("shows a placeholder, not a broken image, when the photo cannot be loaded", async () => {
    render(
      <ChatMessages
        onViewMedia={vi.fn()}
        messages={[{ id: "1", sender_id: "other", content: "Mira", media_url: "a.jpg", media_type: "image", created_at: at }]}
      />,
    );
    const photo = await screen.findByAltText("Foto");
    fireEvent.error(photo);
    expect(screen.queryByAltText("Foto")).toBeNull();
    expect(screen.getByRole("button", { name: "Ver foto adjunta" })).toBeInTheDocument();
  });

  it("opens the attachment with the signed URL", async () => {
    const onViewMedia = vi.fn();
    render(
      <ChatMessages
        onViewMedia={onViewMedia}
        messages={[{ id: "1", sender_id: "other", content: "📷 Foto", media_url: "a.jpg", media_type: "image", created_at: at }]}
      />,
    );
    await screen.findByAltText("Foto");
    fireEvent.click(screen.getByRole("button", { name: "Ver foto adjunta" }));
    expect(onViewMedia).toHaveBeenCalledWith({ url: "https://signed.test/a.jpg", type: "image" });
  });
});
