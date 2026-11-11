import { expect, test } from "@playwright/test";

// Ajustes móveis: campo de filtro sem zoom automático no iOS e texto inteiro visível.
for (const width of [320, 375]) {
  test(`admin em ${width}px: filtro por mapa com 16px e texto inteiro`, async ({ page }) => {
    await page.setViewportSize({ width, height: 700 });
    await page.goto("/#admin");
    await page.getByRole("button", { name: "Entrar na demonstração" }).click();
    const select = page.getByLabel("Filtrar por mapa", { exact: true });
    await expect(select).toBeVisible();
    const metrics = await select.evaluate((element: HTMLSelectElement) => {
      const context = document.createElement("canvas").getContext("2d")!;
      context.font = getComputedStyle(element).font;
      return {
        fontSize: parseFloat(getComputedStyle(element).fontSize),
        boxWidth: element.getBoundingClientRect().width,
        textWidth: context.measureText(element.options[element.selectedIndex].text).width,
      };
    });
    expect(metrics.fontSize).toBeGreaterThanOrEqual(16);
    expect(metrics.boxWidth).toBeGreaterThan(metrics.textWidth + 40);
  });
}

test("biblioteca em 320px: sem rolagem horizontal da página", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto("/");
  await expect(page.getByRole("navigation", { name: "Selecionar mapa" })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
