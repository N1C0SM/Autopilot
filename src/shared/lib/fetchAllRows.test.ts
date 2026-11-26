import { describe, expect, it } from "vitest";
import { ROWS_PER_PAGE, fetchAllRows } from "./fetchAllRows";

describe("fetchAllRows", () => {
  it("sigue pidiendo páginas hasta que una viene incompleta", async () => {
    const total = ROWS_PER_PAGE * 2 + 5;
    const calls: [number, number][] = [];
    const { data, error } = await fetchAllRows(async (from, to) => {
      calls.push([from, to]);
      return { data: Array.from({ length: Math.max(0, Math.min(to, total - 1) - from + 1) }, (_, i) => from + i), error: null };
    });
    expect(error).toBeNull();
    expect(data).toHaveLength(total);
    expect(calls).toEqual([[0, 999], [1000, 1999], [2000, 2999]]);
  });

  it("devuelve el error y lo leído hasta entonces", async () => {
    let n = 0;
    const { data, error } = await fetchAllRows(async () => (n++ === 0
      ? { data: Array(ROWS_PER_PAGE).fill(1), error: null }
      : { data: null, error: new Error("caída") }));
    expect(data).toHaveLength(ROWS_PER_PAGE);
    expect(String(error)).toContain("caída");
  });
});
