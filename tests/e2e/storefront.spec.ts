import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("responsive home and visible catalog", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "A little green. A lot of joy." }),
  ).toBeVisible();
  await expect(page.locator(".product-card")).toHaveCount(4);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `test-results/home-${test.info().project.name}.png`,
    fullPage: true,
  });
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations).toEqual([]);
});
test("product, persisted cart, demo COD checkout", async ({ page }) => {
  await page.goto("/products/monstera-deliciosa");
  await page.getByRole("button", { name: "Ceramic pot · +₹200" }).click();
  await page.getByRole("button", { name: "Add to your bag" }).click();
  await page.goto("/cart");
  await expect(
    page.getByRole("heading", { name: "Monstera Deliciosa" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Monstera Deliciosa" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Continue to checkout" }).click();
  await page
    .getByRole("button", { name: "Use fictional sample address" })
    .click();
  await page.getByRole("radio", { name: "Cash on delivery" }).check();
  await page.getByRole("button", { name: "Place demo order" }).click();
  await expect(
    page.getByText("Demo order confirmed — payment due on delivery."),
  ).toBeVisible();
  expect(
    await page.evaluate(() => localStorage.getItem("kg-cart")),
  ).not.toContain("Demo Plant Lover");
});
test("payment failure preserves bag and lazy zoom works", async ({ page }) => {
  await page.goto("/products/snake-plant-laurentii");
  await page.getByRole("button", { name: "Enlarge product image" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.getByRole("button", { name: "Add to your bag" }).click();
  await page.getByRole("link", { name: /Shopping bag/ }).click();
  await page.getByRole("link", { name: "Continue to checkout" }).click();
  await page
    .getByRole("button", { name: "Use fictional sample address" })
    .click();
  await page.getByRole("button", { name: "Continue to demo payment" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Simulate failure" }).click();
  await expect(
    page.getByText(
      "Demo payment was unsuccessful or dismissed. Your bag has been preserved.",
    ),
  ).toBeVisible();
  await page.getByRole("link", { name: /Shopping bag/ }).click();
  await expect(
    page.getByRole("heading", { name: "Snake Plant Laurentii" }),
  ).toBeVisible();
});
test("legacy tracking shows status without inventing delivery coordinates", async ({
  page,
}) => {
  await page.goto("/track-order/KG-SAMPLE-001");
  await expect(
    page.getByText("Out for demo delivery", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("No delivery pin saved for this order."),
  ).toBeVisible();
  await expect(
    page.getByText(
      "No delivery-agent location is available for this demo order.",
    ),
  ).toBeVisible();
  await expect(page.locator(".map-placeholder")).toHaveCount(0);
});
