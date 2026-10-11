import { connection } from "next/server";

/** Liveness: uygulama süreci ayakta mı? Bağımlılıkları kontrol etmez. */
export async function GET() {
  await connection();
  return Response.json({ status: "ok" });
}
