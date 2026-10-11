import Link from "next/link";
import { getCurrentUser } from "@/modules/auth/session";

export async function AccountLink() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <Link href="/giris" className="text-sm">
        Giriş yap
      </Link>
    );
  }

  return (
    <Link
      href={user.type === "STAFF" ? "/admin" : "/giris"}
      className="text-sm"
    >
      {user.name || user.email}
    </Link>
  );
}
