import { connection } from "next/server";
import { getPrivacyService } from "@/modules/account/container";
import { getCurrentUser } from "@/modules/auth/session";

/** KVKK: kullanıcının kendi verilerini JSON olarak indirmesi. */
export async function GET() {
  await connection();

  const user = await getCurrentUser();
  if (!user) return new Response("Giriş gerekli", { status: 401 });

  const data = await getPrivacyService().exportData(user.id);
  const stamp = new Date().toISOString().slice(0, 10);

  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="verilerim-${stamp}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
