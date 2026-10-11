"use client";

import {
  mergeWishlistAction,
  setWishlistItemAction,
} from "@/app/(storefront)/favoriler/actions";

const STORAGE_KEY = "wishlist-guest";

interface Snapshot {
  ids: ReadonlySet<string>;
  authenticated: boolean;
}

let snapshot: Snapshot = { ids: new Set(), authenticated: false };
const listeners = new Set<() => void>();
let initialized = false;

function emit(next: Snapshot): void {
  snapshot = next;
  listeners.forEach((listener) => listener());
}

function readLocal(): string[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === "string")
      : [];
  } catch {
    return [];
  }
}

function writeLocal(ids: Iterable<string>): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
  } catch {
    // Depolama kapalıysa favoriler yalnızca bu oturumda tutulur.
  }
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSnapshot(): Snapshot {
  return snapshot;
}

const SERVER_SNAPSHOT: Snapshot = { ids: new Set(), authenticated: false };
export function getServerSnapshot(): Snapshot {
  return SERVER_SNAPSHOT;
}

/** Sunucudan gelen oturum bilgisiyle depoyu başlatır; misafir favorilerini taşır. */
export async function initWishlist(
  authenticated: boolean,
  serverIds: string[],
): Promise<void> {
  if (!authenticated) {
    emit({ ids: new Set(readLocal()), authenticated: false });
    initialized = true;
    return;
  }

  emit({ ids: new Set(serverIds), authenticated: true });
  const local = readLocal();
  initialized = true;

  if (local.length > 0) {
    const result = await mergeWishlistAction(local);
    if (result.ok && result.ids) {
      writeLocal([]);
      emit({ ids: new Set(result.ids), authenticated: true });
    }
  }
}

export function isInitialized(): boolean {
  return initialized;
}

export async function toggleWishlist(productId: string): Promise<void> {
  const favorite = !snapshot.ids.has(productId);
  const next = new Set(snapshot.ids);
  if (favorite) next.add(productId);
  else next.delete(productId);

  emit({ ids: next, authenticated: snapshot.authenticated });

  if (!snapshot.authenticated) {
    writeLocal(next);
    return;
  }

  const result = await setWishlistItemAction(productId, favorite);
  if (!result.ok) {
    // Başarısızsa iyimser değişikliği geri al.
    const reverted = new Set(snapshot.ids);
    if (favorite) reverted.delete(productId);
    else reverted.add(productId);
    emit({ ids: reverted, authenticated: true });
  }
}
