import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ScanImage, StatRow } from "./ScanResultParts";

afterEach(cleanup);

describe("ScanImage", () => {
  it("shows the photo while it loads", () => {
    render(<ScanImage src="https://signed.test/a.jpg" alt="Scan anterior" className="h-10 w-10" />);
    expect(screen.getByRole("img", { name: "Scan anterior" }).tagName).toBe("IMG");
  });

  it("replaces a broken photo with a composed placeholder", () => {
    render(<ScanImage src="https://signed.test/broken.jpg" alt="Scan anterior" className="h-10 w-10" />);
    fireEvent.error(screen.getByRole("img", { name: "Scan anterior" }));
    const placeholder = screen.getByRole("img", { name: "Scan anterior" });
    expect(placeholder.tagName).toBe("DIV");
  });

  it("uses the placeholder when there is no URL", () => {
    render(<ScanImage src={null} alt="Scan actual" />);
    expect(screen.getByRole("img", { name: "Scan actual" }).tagName).toBe("DIV");
  });
});

describe("StatRow", () => {
  it("renders each figure with its label", () => {
    render(
      <StatRow
        stats={[
          { label: "Atractivo", value: "6.5", unit: "/10" },
          { label: "Potencial", value: "8.0", unit: "/10" },
        ]}
      />,
    );
    expect(screen.getByText("Atractivo")).toBeTruthy();
    expect(screen.getByText("8.0")).toBeTruthy();
  });
});
