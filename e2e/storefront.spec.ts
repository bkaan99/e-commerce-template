import { expect, test } from "@playwright/test";
import { E2E_PREFIX } from "./global-setup";

test.describe("vitrin", () => {
  test("ana sayfa ve kategori gezintisi çalışır", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Kategoriler" }),
    ).toBeVisible();

    await page.getByRole("link", { name: "Giyim" }).first().click();
    await expect(page).toHaveURL(/\/kategori\/giyim/);
    await expect(page.locator("a[href^='/urun/']").first()).toBeVisible();
  });

  test("misafir olarak ürünü sepete ekleyip sipariş verir (geliştirme ödemesi)", async ({
    page,
  }) => {
    await page.goto("/urun/deri-cuzdan");

    // Seçenek varsa ilk değeri seç; ardından sepete ekle.
    const optionButtons = page.locator("fieldset button[aria-pressed]");
    for (const fieldset of await page.locator("fieldset").all()) {
      await fieldset.locator("button:not(.line-through)").first().click();
    }
    expect(await optionButtons.count()).toBeGreaterThan(0);

    await page.getByRole("button", { name: "Sepete ekle" }).click();
    await expect(page.getByRole("status")).toContainText(/sepete/i);

    await page.goto("/sepet");
    await page.getByRole("link", { name: "Ödemeye geç" }).first().click();
    await expect(page).toHaveURL(/\/odeme/);

    await page.getByLabel("E-posta").fill(`${E2E_PREFIX}misafir@example.test`);
    await page.getByLabel("Ad", { exact: true }).fill("Test");
    await page.getByLabel("Soyad").fill("Müşteri");
    await page.getByLabel("Cep telefonu").fill("05321234567");
    await page.locator('select[name="shipping.city"]').selectOption("İstanbul");
    await page
      .locator('select[name="shipping.district"]')
      .selectOption("Kadıköy");
    await page
      .getByLabel("Açık adres")
      .fill("Test Mahallesi Deneme Sokak No 1 Daire 2");
    await page.getByLabel(/ön bilgilendirme formunu/i).check();
    await page.getByRole("button", { name: "Ödemeye geç" }).click();

    await expect(page).toHaveURL(/\/odeme\/(gelistirme|ode)\//);
    await page.getByRole("button", { name: "Ödemeyi başarılı say" }).click();

    await expect(page).toHaveURL(/\/siparis\//);
    await expect(
      page.getByText(/ödendi|alındı|hazırlan/i).first(),
    ).toBeVisible();
  });

  test("kayıt, giriş ve adres defteri akışı", async ({ page }) => {
    const email = `${E2E_PREFIX}musteri-${Date.now()}@example.test`;
    const password = `Test-${Date.now()}x1`;

    await page.goto("/kayit");
    await page.getByLabel("Ad", { exact: true }).fill("Ayşe");
    await page.getByLabel("Soyad").fill("Test");
    await page.getByLabel("E-posta").fill(email);
    await page.getByLabel("Parola").first().fill(password);
    await page.getByRole("button", { name: /kayıt ol|hesap oluştur/i }).click();
    await page.waitForURL((url) => url.pathname !== "/kayit");

    await page.goto("/giris");
    await page.getByLabel("E-posta").fill(email);
    await page.getByLabel("Parola").fill(password);
    await page.getByRole("button", { name: "Giriş yap" }).click();
    await page.waitForURL((url) => url.pathname.startsWith("/hesabim"));

    await page.goto("/hesabim/adresler");
    await expect(
      page.getByRole("heading", { name: /adres/i }).first(),
    ).toBeVisible();
  });
});
