export interface CategoryLike {
  id: string;
  parentId: string | null;
}

/**
 * Bir kategorinin üst kategorisi olarak `candidateParentId` seçilebilir mi?
 * Kendisi veya kendi alt kategorilerinden biri üst olamaz (döngü oluşur).
 */
export function canBeParent(
  categories: readonly CategoryLike[],
  categoryId: string,
  candidateParentId: string | null,
): boolean {
  if (candidateParentId === null) return true;
  if (candidateParentId === categoryId) return false;

  const parentOf = new Map(categories.map((c) => [c.id, c.parentId]));
  const visited = new Set<string>();
  let current: string | null | undefined = candidateParentId;

  while (current) {
    if (current === categoryId) return false;
    if (visited.has(current)) return false;
    visited.add(current);
    current = parentOf.get(current);
  }

  return true;
}

/** Ağaçta girintili gösterim için kategorileri derinlik bilgisiyle sıralar. */
export function flattenWithDepth<
  T extends CategoryLike & { sortOrder: number; name: string },
>(categories: readonly T[]): (T & { depth: number })[] {
  const children = new Map<string | null, T[]>();
  for (const category of categories) {
    const list = children.get(category.parentId) ?? [];
    list.push(category);
    children.set(category.parentId, list);
  }

  const result: (T & { depth: number })[] = [];
  const walk = (parentId: string | null, depth: number, seen: Set<string>) => {
    const items = [...(children.get(parentId) ?? [])].sort(
      (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "tr"),
    );
    for (const item of items) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      result.push({ ...item, depth });
      walk(item.id, depth + 1, seen);
    }
  };
  walk(null, 0, new Set());

  return result;
}
