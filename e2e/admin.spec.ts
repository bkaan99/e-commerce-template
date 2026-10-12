import { expect, test } from "@playwright/test";

test.describe("yönetim paneli", () => {
  test("müşteri hesabı olmayan ziyaretçi admin alanına giremez", async ({
    page,
  }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/giris/);
  });

  test("personel giriş yapıp ürün, personel ve içe aktarma sayfalarını görür", async ({
    page,
  }) => {
    const email = process.env["E2E_ADMIN_EMAIL"]!;
    const password = process.env["E2E_ADMIN_PASSWORD"]!;

    await page.goto("/giris?callbackUrl=/admin");
    await page.getByLabel("E-posta").fill(email);
    await page.getByLabel("Parola").fill(password);
    await page.getByRole("button", { name: "Giriş yap" }).click();
    // callbackUrl sorgu dizgesinde de "/admin" geçtiğinden yalnızca yol kontrol edilir.
    await page.waitForURL((url) => url.pathname.startsWith("/admin"));

    await page.goto("/admin/urunler");
    await expect(
      page.getByRole("heading", { name: "Ürünler", level: 1 }),
    ).toBeVisible();

    await page.goto("/admin/urunler/ice-aktar");
    await expect(
      page.getByRole("heading", { name: "Ürün içe aktarma" }),
    ).toBeVisible();

    await page.goto("/admin/personel");
    await expect(
      page.getByRole("heading", { name: "Personel", level: 1 }),
    ).toBeVisible();

    await page.goto("/admin/roller");
    await expect(
      page.getByRole("heading", { name: "Roller ve yetkiler" }),
    ).toBeVisible();
  });
});
