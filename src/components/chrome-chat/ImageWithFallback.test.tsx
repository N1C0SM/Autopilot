import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ImageWithFallback, VideoWithFallback } from "./ImageWithFallback";

afterEach(cleanup);

describe("ImageWithFallback", () => {
  it("paints the composed placeholder when the URL is missing", () => {
    const { container } = render(<ImageWithFallback src="" alt="Portada" className="h-10 w-10" />);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("[aria-hidden='true']")).toHaveClass("bg-secondary", "h-10", "w-10");
  });

  it("renders the image while it loads and swaps in the placeholder when it fails", () => {
    const { container, queryByAltText } = render(<ImageWithFallback src="https://cdn.test/a.jpg" alt="Portada" />);
    const img = queryByAltText("Portada");
    expect(img).toHaveAttribute("src", "https://cdn.test/a.jpg");
    fireEvent.error(img!);
    expect(queryByAltText("Portada")).toBeNull();
    expect(container.querySelector("[aria-hidden='true']")).toHaveClass("bg-secondary");
  });

  it("tries again when the URL changes after a failure", () => {
    const { rerender, queryByAltText } = render(<ImageWithFallback src="https://cdn.test/a.jpg" alt="Portada" />);
    fireEvent.error(queryByAltText("Portada")!);
    expect(queryByAltText("Portada")).toBeNull();
    rerender(<ImageWithFallback src="https://cdn.test/b.jpg" alt="Portada" />);
    expect(queryByAltText("Portada")).toHaveAttribute("src", "https://cdn.test/b.jpg");
  });
});

describe("VideoWithFallback", () => {
  it("paints the placeholder instead of a black box when the URL is missing", () => {
    const { container } = render(<VideoWithFallback src="" className="h-10 w-10" />);
    expect(container.querySelector("video")).toBeNull();
    expect(container.querySelector("[aria-hidden='true']")).toHaveClass("bg-secondary");
  });

  it("swaps in the placeholder when the video fails to load", () => {
    const { container } = render(<VideoWithFallback src="https://cdn.test/a.mp4" />);
    const video = container.querySelector("video");
    expect(video).toHaveAttribute("src", "https://cdn.test/a.mp4");
    fireEvent.error(video!);
    expect(container.querySelector("video")).toBeNull();
    expect(container.querySelector("[aria-hidden='true']")).toBeInTheDocument();
  });
});
