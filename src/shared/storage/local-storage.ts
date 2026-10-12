import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { FileStorage, StoredFile } from "./storage";

const CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

/** Yerel diske yazan depolama. Üretimde dizin kalıcı bir volume olmalıdır. */
export class LocalDiskStorage implements FileStorage {
  constructor(
    private readonly rootDir: string,
    private readonly publicBase = "/uploads",
  ) {}

  /** Anahtarın kök dizinin dışına çıkmasını (path traversal) engeller. */
  private resolve(key: string): string {
    const root = path.resolve(this.rootDir);
    const target = path.resolve(root, key);
    if (!target.startsWith(`${root}${path.sep}`)) {
      throw new Error("Geçersiz depolama anahtarı");
    }
    return target;
  }

  async put(key: string, data: Buffer): Promise<string> {
    const target = this.resolve(key);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, data);
    return `${this.publicBase}/${key}`;
  }

  async read(key: string): Promise<StoredFile | null> {
    try {
      const data = await readFile(this.resolve(key));
      const contentType =
        CONTENT_TYPES[path.extname(key).toLowerCase()] ??
        "application/octet-stream";
      return { data, contentType };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  }

  async remove(key: string): Promise<void> {
    await rm(this.resolve(key), { force: true });
  }
}
