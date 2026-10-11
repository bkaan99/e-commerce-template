import { describe, expect, it } from "vitest";
import { canBeParent, flattenWithDepth } from "./category.logic";

const categories = [
  { id: "a", parentId: null, sortOrder: 0, name: "A" },
  { id: "b", parentId: "a", sortOrder: 0, name: "B" },
  { id: "c", parentId: "b", sortOrder: 0, name: "C" },
  { id: "d", parentId: null, sortOrder: 1, name: "D" },
];

describe("canBeParent", () => {
  it("kök olmaya izin verir", () => {
    expect(canBeParent(categories, "b", null)).toBe(true);
  });

  it("kendisini ve alt kategorilerini üst olarak reddeder", () => {
    expect(canBeParent(categories, "a", "a")).toBe(false);
    expect(canBeParent(categories, "a", "b")).toBe(false);
    expect(canBeParent(categories, "a", "c")).toBe(false);
  });

  it("ilgisiz kategoriyi üst olarak kabul eder", () => {
    expect(canBeParent(categories, "c", "d")).toBe(true);
    expect(canBeParent(categories, "b", "d")).toBe(true);
  });
});

describe("flattenWithDepth", () => {
  it("ağacı derinlikle ve sırayla düzleştirir", () => {
    expect(
      flattenWithDepth(categories).map((c) => `${c.depth}:${c.id}`),
    ).toEqual(["0:a", "1:b", "2:c", "0:d"]);
  });
});
