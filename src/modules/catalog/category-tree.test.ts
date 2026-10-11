import { describe, expect, it } from "vitest";
import type { CategoryNode } from "./catalog.types";
import {
  buildBreadcrumbs,
  buildCategoryTree,
  collectDescendantIds,
} from "./category-tree";

function node(id: string, parentId: string | null): CategoryNode {
  return {
    id,
    parentId,
    name: id.toUpperCase(),
    slug: id,
    description: null,
    imageUrl: null,
    seoTitle: null,
    seoDescription: null,
    sortOrder: 0,
  };
}

const categories = [
  node("giyim", null),
  node("erkek", "giyim"),
  node("tisort", "erkek"),
  node("ev", null),
];

describe("category tree", () => {
  it("ağacı kurar", () => {
    const tree = buildCategoryTree(categories);
    expect(tree.map((n) => n.id)).toEqual(["giyim", "ev"]);
    expect(tree[0]!.children[0]!.children[0]!.id).toBe("tisort");
  });

  it("alt kategori kimliklerini toplar", () => {
    expect(collectDescendantIds(categories, "giyim").sort()).toEqual([
      "erkek",
      "giyim",
      "tisort",
    ]);
    expect(collectDescendantIds(categories, "ev")).toEqual(["ev"]);
  });

  it("ekmek kırıntısını kökten başlatır", () => {
    expect(buildBreadcrumbs(categories, "tisort").map((b) => b.slug)).toEqual([
      "giyim",
      "erkek",
      "tisort",
    ]);
  });

  it("döngüsel veride sonsuz döngüye girmez", () => {
    const cyclic = [node("a", "b"), node("b", "a")];
    expect(buildBreadcrumbs(cyclic, "a")).toHaveLength(2);
  });
});
