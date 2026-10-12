import "server-only";
import path from "node:path";
import { getEnv } from "../env";
import { LocalDiskStorage } from "./local-storage";
import type { FileStorage } from "./storage";

let storage: FileStorage | undefined;

/** Uygulamanın dosya deposu. Farklı bir depolama için burada adaptör değiştirilir. */
export function getFileStorage(): FileStorage {
  storage ??= new LocalDiskStorage(
    path.resolve(/* turbopackIgnore: true */ getEnv().UPLOAD_DIR ?? "uploads"),
  );
  return storage;
}
