import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { fileURLToPath } from "node:url";

const mp4 = fileURLToPath(new URL("../fixtures/test-pattern.mp4", import.meta.url));

async function enterAdmin(page: Page) {
  await page.getByRole("link", { name: "Administração", exact: true }).click();
  await page.getByRole("button", { name: "Entrar na demonstração" }).click();
}

async function createWithMp4(page: Page, title: string, type: string, x = "25", y = "75") {
  await page.getByRole("button", { name: "Nova granada", exact: true }).click();
  await page.getByLabel("Título", { exact: true }).fill(title);
  await page.getByLabel("Instruções", { exact: true }).fill("Instruções fictícias de teste da interface.");
  await page.getByLabel("Tipo", { exact: true }).selectOption(type);
  await page.getByRole("button", { name: "Posicionamento" }).click();
  await page.getByText("Ajustar coordenadas da origem").click();
  await page.getByText("Ajustar coordenadas do destino").click();
  await page.getByLabel("Origem X (%)", { exact: true }).fill("20");
  await page.getByLabel("Origem Y (%)", { exact: true }).fill("30");
  await page.getByLabel("Coordenada X (%)", { exact: true }).fill(x);
  await page.getByLabel("Coordenada Y (%)", { exact: true }).fill(y);
  await page.getByRole("button", { name: "Vídeo e revisão" }).click();
  await page.getByLabel("Arquivo MP4", { exact: true }).setInputFiles(mp4);
  const preview = page.getByLabel("Prévia do MP4 selecionado");
  await expect.poll(() => preview.evaluate((v: HTMLVideoElement) => v.readyState)).toBeGreaterThanOrEqual(1);
  // Prévia do upload: começa mutada e o usuário consegue desmutar pelos controles (propriedade do player).
  expect(await preview.evaluate((v: HTMLVideoElement) => v.muted)).toBe(true);
  await preview.evaluate((v: HTMLVideoElement) => { v.muted = false; });
  expect(await preview.evaluate((v: HTMLVideoElement) => v.muted)).toBe(false);
  await page.getByRole("button", { name: "Salvar demonstração" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Mirage", exact: true })).toBeVisible();
});

test("HE: cadastro, filtro com contagem, marcador no radar e vídeo mutado que pode ser desmutado", async ({ page }) => {
  await enterAdmin(page);
  await createWithMp4(page, "HE vídeo A", "he");
  await createWithMp4(page, "HE vídeo B", "he", "60", "40");
  await page.getByRole("link", { name: "Biblioteca", exact: true }).click();
  const filters = page.getByRole("group", { name: "Tipo de granada" });
  const heFilter = filters.getByRole("button", { name: "HE Grenade", exact: true });
  await expect(heFilter).toContainText("2 granadas");
  await expect(heFilter.locator("img.filter-asset")).toHaveAttribute("src", "/filter-icons/he.png");
  await heFilter.click();
  await expect(heFilter).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".radar-marker.he")).toHaveCount(2);
  await filters.getByRole("button", { name: "Smoke", exact: true }).click();
  await expect(page.getByRole("button", { name: /^HE vídeo A/ })).toHaveCount(0);
  await heFilter.click();

  const video = page.getByLabel("Vídeo da granada", { exact: true });
  await page.getByRole("button", { name: /^HE vídeo A HE Grenade/ }).click();
  await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.readyState)).toBeGreaterThanOrEqual(1);
  expect(await video.evaluate((v: HTMLVideoElement) => v.muted)).toBe(true);
  await video.evaluate((v: HTMLVideoElement) => { v.muted = false; v.volume = 0.4; });
  // A escolha do usuário não é desfeita depois de a reprodução continuar.
  await page.waitForTimeout(600);
  expect(await video.evaluate((v: HTMLVideoElement) => ({ m: v.muted, vol: v.volume }))).toEqual({ m: false, vol: 0.4 });
  // Outro vídeo começa mutado, mesmo depois de o anterior ter sido desmutado.
  await page.getByRole("button", { name: /^HE vídeo B HE Grenade/ }).click();
  await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.readyState)).toBeGreaterThanOrEqual(1);
  expect(await video.evaluate((v: HTMLVideoElement) => v.muted)).toBe(true);
});

test("Solo Exec aceita HE como destino e desenha marcador HE", async ({ page }) => {
  await enterAdmin(page);
  await page.getByRole("button", { name: "Nova granada", exact: true }).click();
  await page.getByLabel("Título", { exact: true }).fill("Solo com HE");
  await page.getByLabel("Instruções", { exact: true }).fill("Execução com HE e smoke.");
  await page.getByLabel("Tipo", { exact: true }).selectOption("solo_exec");
  await page.getByRole("button", { name: "Posicionamento" }).click();
  const radar = page.getByAltText(/Radar do mapa/);
  await radar.click({ position: { x: 60, y: 60 } });
  await radar.click({ position: { x: 120, y: 120 } });
  await page.getByLabel("Tipo do destino 1", { exact: true }).selectOption("he");
  await page.getByRole("button", { name: "Adicionar destino" }).click();
  await radar.click({ position: { x: 160, y: 160 } });
  await page.getByLabel("Tipo do destino 2", { exact: true }).selectOption("smoke");
  await page.getByRole("button", { name: "Vídeo e revisão" }).click();
  await page.getByLabel("Arquivo MP4", { exact: true }).setInputFiles(mp4);
  await page.getByRole("button", { name: "Salvar demonstração" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("link", { name: "Biblioteca", exact: true }).click();
  await page.getByRole("group", { name: "Tipo de granada" }).getByRole("button", { name: "Solo Exec", exact: true }).click();
  await expect(page.locator(".radar-marker.he")).toHaveCount(1);
  await expect(page.locator(".radar-marker.smoke")).toHaveCount(1);
});
