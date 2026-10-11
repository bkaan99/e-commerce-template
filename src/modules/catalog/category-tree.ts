import type { CategoryBreadcrumb, CategoryNode } from "./catalog.types";

export interface CategoryTreeNode extends CategoryNode {
  children: CategoryTreeNode[];
}

export function buildCategoryTree(
  categories: readonly CategoryNode[],
): CategoryTreeNode[] {
  const nodes = new Map<string, CategoryTreeNode>(
    categories.map((category) => [category.id, { ...category, children: [] }]),
  );
  const roots: CategoryTreeNode[] = [];

  for (const node of nodes.values()) {
    const parent = node.parentId ? nodes.get(node.parentId) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }

  return roots;
}

/** Kategorinin kendisi ve tüm alt kategorilerinin kimlikleri. */
export function collectDescendantIds(
  categories: readonly CategoryNode[],
  categoryId: string,
): string[] {
  const childrenByParent = new Map<string, string[]>();
  for (const category of categories) {
    if (!category.parentId) continue;
    const list = childrenByParent.get(category.parentId) ?? [];
    list.push(category.id);
    childrenByParent.set(category.parentId, list);
  }

  const result: string[] = [];
  const stack = [categoryId];
  while (stack.length > 0) {
    const id = stack.pop()!;
    result.push(id);
    stack.push(...(childrenByParent.get(id) ?? []));
  }

  return result;
}

/** Kökten kategoriye giden yol (ekmek kırıntısı). */
export function buildBreadcrumbs(
  categories: readonly CategoryNode[],
  categoryId: string,
): CategoryBreadcrumb[] {
  const byId = new Map(categories.map((category) => [category.id, category]));
  const trail: CategoryBreadcrumb[] = [];
  const visited = new Set<string>();

  let current = byId.get(categoryId);
  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    trail.unshift({ name: current.name, slug: current.slug });
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }

  return trail;
}
