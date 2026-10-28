import { act, fireEvent, render, screen } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PULL_THRESHOLD, usePullToRefresh } from "@/shared/hooks/usePullToRefresh";

const Harness = ({ onRefresh }: { onRefresh: () => Promise<void> | void }) => {
  const ref = useRef<HTMLDivElement>(null);
  const pull = usePullToRefresh(ref, { onRefresh });
  return (
    <div
      ref={ref}
      data-testid="scroller"
      data-offset={pull.offset}
      data-refreshing={pull.refreshing ? "true" : "false"}
    />
  );
};

const touch = (clientY: number) => [{ clientX: 100, clientY }];

describe("usePullToRefresh", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

  it("refresca al soltar por encima del umbral y vuelve a su sitio", async () => {
    const onRefresh = vi.fn(async () => {});
    render(<Harness onRefresh={onRefresh} />);
    const scroller = screen.getByTestId("scroller");

    fireEvent.touchStart(scroller, { touches: touch(100) });
    fireEvent.touchMove(scroller, { touches: touch(100 + 16 + PULL_THRESHOLD / 0.55) });
    expect(Number(scroller.dataset.offset)).toBeGreaterThanOrEqual(PULL_THRESHOLD);
    fireEvent.touchEnd(scroller);

    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(scroller.dataset.refreshing).toBe("true");

    await act(async () => { await vi.advanceTimersByTimeAsync(500); });
    expect(scroller.dataset.refreshing).toBe("false");
    expect(scroller.dataset.offset).toBe("0");
  });

  it("no refresca con un tirón corto", () => {
    const onRefresh = vi.fn();
    render(<Harness onRefresh={onRefresh} />);
    const scroller = screen.getByTestId("scroller");

    fireEvent.touchStart(scroller, { touches: touch(100) });
    fireEvent.touchMove(scroller, { touches: touch(140) });
    fireEvent.touchEnd(scroller);

    expect(onRefresh).not.toHaveBeenCalled();
    expect(scroller.dataset.offset).toBe("0");
  });

  it("ignora un gesto horizontal", () => {
    const onRefresh = vi.fn();
    render(<Harness onRefresh={onRefresh} />);
    const scroller = screen.getByTestId("scroller");

    fireEvent.touchStart(scroller, { touches: [{ clientX: 10, clientY: 100 }] });
    fireEvent.touchMove(scroller, { touches: [{ clientX: 160, clientY: 104 }] });
    fireEvent.touchEnd(scroller);

    expect(onRefresh).not.toHaveBeenCalled();
  });

  it("no se activa si la lista ya está desplazada", () => {
    const onRefresh = vi.fn();
    render(<Harness onRefresh={onRefresh} />);
    const scroller = screen.getByTestId("scroller");
    scroller.scrollTop = 200;

    fireEvent.touchStart(scroller, { touches: touch(100) });
    fireEvent.touchMove(scroller, { touches: touch(300) });
    fireEvent.touchEnd(scroller);

    expect(onRefresh).not.toHaveBeenCalled();
  });
});
