import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { fileURLToPath } from "node:url";

async function enterAdmin(page: Page) {
  await page.getByRole("link", { name: "Administração", exact: true }).click();
  await page.getByRole("button", { name: "Entrar na demonstração" }).click();
}

async function fillDraft(page: Page, title: string) {
  await page.getByLabel("Título", { exact: true }).fill(title);
  await page
    .getByLabel("Instruções", { exact: true })
    .fill("Instruções fictícias de teste da interface.");
  await page.getByLabel("Origem X (%)", { exact: true }).fill("20");
  await page.getByLabel("Origem Y (%)", { exact: true }).fill("30");
  await page.getByLabel("Coordenada X (%)", { exact: true }).fill("25");
  await page.getByLabel("Coordenada Y (%)", { exact: true }).fill("75");
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Mirage", exact: true }),
  ).toBeVisible();
});

test("filtros combinados, troca de mapa e estado vazio", async ({ page }) => {
  await expect(
    page.getByRole("button", { name: /^Exemplo de smoke Smoke/ }),
  ).toBeVisible();
  await page
    .getByRole("group", { name: "Tipo de granada" })
    .getByRole("button", { name: "Smoke", exact: true })
    .click();
  await page
    .getByRole("group", { name: "Lado do time" })
    .getByRole("button", { name: "CT", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: /^Outro exemplo de smoke Smoke/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /^Exemplo de smoke Smoke/ }),
  ).toHaveCount(0);
  await page
    .getByRole("group", { name: "Tipo de granada" })
    .getByRole("button", { name: "Flashbang", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Nenhuma granada por aqui" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Limpar filtros" }).click();
  await page.getByRole("navigation", { name: "Selecionar mapa" }).getByRole("button", { name: "Ancient", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Ancient", exact: true }),
  ).toBeVisible();
  await expect(page.getByAltText("Radar do mapa Ancient")).toHaveAttribute(
    "src",
    "/maps/ancient.svg",
  );
  await expect(
    page.getByRole("heading", { name: "Nenhuma granada por aqui" }),
  ).toBeVisible();
});

test("destinos sobrepostos abrem lista de escolha e detalhes corretos", async ({
  page,
}) => {
  await page.getByRole("button", { name: "2 granadas neste destino" }).click();
  await expect(
    page.getByRole("heading", { name: "Neste destino 2" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /^Exemplo de molotov Molotov/ }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: /^Outro exemplo de smoke Smoke/ })
    .click();
  await expect(
    page.getByRole("heading", { name: "Outro exemplo de smoke", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Sem vídeo de demonstração", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Detalhes da granada" }),
  ).toContainText("Conteúdo fictício");
  await page.getByRole("button", { name: "Fechar detalhes" }).click();
  await expect(
    page.getByRole("region", { name: "Detalhes da granada" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Ver todas" }).click();
  await expect(page.getByRole("heading", { name: "Granadas 4" })).toBeVisible();
});

test("validação, seleção no radar e fechamento com restauração de foco", async ({
  page,
}) => {
  await enterAdmin(page);
  const trigger = page.getByRole("button", {
    name: "Nova granada",
    exact: true,
  });
  await trigger.click();
  await page.getByRole("button", { name: "Salvar demonstração" }).click();
  await expect(page.getByRole("alert").first()).toContainText(
    "Revise os campos",
  );
  await page.getByRole("button", { name: "Marcar destino", exact: true }).click();
  const image = page.getByAltText("Radar do mapa Mirage");
  const bounds = (await image.boundingBox())!;
  await image.click({
    position: { x: bounds.width * 0.5, y: bounds.height * 0.5 },
  });
  expect(
    Number(await page.getByLabel("Coordenada X (%)").inputValue()),
  ).toBeCloseTo(50, 0);
  expect(
    Number(await page.getByLabel("Coordenada Y (%)").inputValue()),
  ).toBeCloseTo(50, 0);
  await page.getByLabel("Mapa", { exact: true }).selectOption("inferno");
  await expect(page.getByLabel("Coordenada X (%)")).toHaveValue("");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test("importação indisponível mantém formulário e não publica cadastro", async ({
  page,
}) => {
  await enterAdmin(page);
  await page.getByRole("button", { name: "Nova granada", exact: true }).click();
  await fillDraft(page, "Teste link indisponível");
  await page
    .getByRole("button", { name: "Importar por link", exact: true })
    .click();
  await page
    .getByLabel("Link do YouTube Shorts, TikTok ou Instagram Reels")
    .fill("https://www.youtube.com/shorts/abcdefghijk");
  await page.getByRole("button", { name: "Verificar importação" }).click();
  await expect(page.getByRole("alert").first()).toContainText(
    "PLATFORM_UNSUPPORTED",
  );
  await expect(page.getByLabel("Título", { exact: true })).toHaveValue(
    "Teste link indisponível",
  );
  await expect(page.locator("iframe")).toHaveCount(0);
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Teste link indisponível" }),
  ).toHaveCount(0);
});

test("MP4 local: cadastro, player, edição, confirmação de exclusão e reload", async ({
  page,
}) => {
  await enterAdmin(page);
  await page.getByRole("button", { name: "Nova granada", exact: true }).click();
  await fillDraft(page, "Teste MP4 local");
  await page
    .getByLabel("Arquivo MP4", { exact: true })
    .setInputFiles(
      fileURLToPath(new URL("../fixtures/test-pattern.mp4", import.meta.url)),
    );
  const preview = page.getByLabel("Prévia do MP4 selecionado");
  await expect
    .poll(() => preview.evaluate((video: HTMLVideoElement) => video.readyState))
    .toBeGreaterThanOrEqual(1);
  await page.getByRole("button", { name: "Salvar demonstração" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Teste MP4 local", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Biblioteca", exact: true }).click();
  await page.getByRole("button", { name: /^Teste MP4 local Smoke/ }).click();
  const video = page.getByLabel("Vídeo da granada", { exact: true });
  await expect
    .poll(() => video.evaluate((el: HTMLVideoElement) => el.duration))
    .toBeGreaterThan(1);
  await video.evaluate(async (el: HTMLVideoElement) => {
    await el.play();
  });
  await expect
    .poll(() => video.evaluate((el: HTMLVideoElement) => el.currentTime))
    .toBeGreaterThan(0.1);
  await video.evaluate((el: HTMLVideoElement) => {
    el.pause();
    el.currentTime = 1;
  });
  await expect
    .poll(() => video.evaluate((el: HTMLVideoElement) => el.currentTime))
    .toBeGreaterThanOrEqual(0.9);
  await enterAdmin(page);
  await page
    .getByRole("button", { name: "Editar Teste MP4 local", exact: true })
    .click();
  await page.getByLabel("Título", { exact: true }).fill("Teste MP4 editado");
  await page.getByRole("button", { name: "Salvar demonstração" }).click();
  await page
    .getByRole("button", { name: "Excluir Teste MP4 editado", exact: true })
    .click();
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Teste MP4 editado", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Excluir Teste MP4 editado", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Excluir demonstração", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Teste MP4 editado", exact: true }),
  ).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Entrar na demonstração" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Entrar na demonstração" }).click();
  await expect(
    page.getByRole("heading", { name: "Exemplo de smoke", exact: true }),
  ).toHaveCount(2);
  await expect(
    page.getByRole("heading", { name: "Teste MP4 editado", exact: true }),
  ).toHaveCount(0);
});

test("layouts de 320px até desktop não transbordam; assets não falham", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect
      .poll(() =>
        page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      )
      .toBe(true);
  }
  await expect(page.getByAltText("Radar do mapa Mirage")).toBeVisible();
  expect(
    await page
      .getByAltText("Radar do mapa Mirage")
      .evaluate(
        (image: HTMLImageElement) =>
          image.complete && image.naturalWidth === 1024,
      ),
  ).toBe(true);
  expect(errors).toEqual([]);
});


test("faixa de mapas: teclado, seleção e limpeza de detalhes preservam filtros", async ({ page }) => {
  const rail = page.getByRole("navigation", { name: "Selecionar mapa" });
  const mirage = rail.getByRole("button", { name: "Mirage", exact: true });
  await expect(mirage).toHaveAttribute("aria-current", "true");
  await page.getByRole("button", { name: /^Exemplo de smoke Smoke/ }).click();
  await page.getByRole("group", { name: "Tipo de granada" }).getByRole("button", { name: "Smoke", exact: true }).click();
  await mirage.focus();
  await page.keyboard.press("End");
  const last = rail.getByRole("button").last();
  await expect(last).toBeFocused();
  await expect(mirage).toHaveAttribute("aria-current", "true");
  await page.keyboard.press("Enter");
  await expect(last).toHaveAttribute("aria-current", "true");
  await expect(page.getByRole("region", { name: "Detalhes da granada" })).toHaveCount(0);
  await expect(page.getByRole("group", { name: "Tipo de granada" }).getByRole("button", { name: "Smoke", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Home");
  await expect(mirage).toBeFocused();
  await page.keyboard.press("Space");
  await expect(mirage).toHaveAttribute("aria-current", "true");
  await page.keyboard.press("ArrowRight");
  await expect(rail.getByRole("button").nth(1)).toBeFocused();
  await page.keyboard.press("ArrowLeft");
  await expect(mirage).toBeFocused();
});

test("painel: contagens por mapa e lado preservam alternativas e zeros", async ({ page }, testInfo) => {
  const types = page.getByRole("group", { name: "Tipo de granada" });
  const sides = page.getByRole("group", { name: "Lado do time" });
  async function counts(all: number, smoke: number, molotov: number, flash: number) {
    for (const [name, count] of [["Todas", all], ["Smoke", smoke], ["Molotov", molotov], ["Flashbang", flash]] as const) {
      await expect(types.getByRole("button", { name, exact: true })).toHaveAccessibleDescription(`${count} granadas`);
    }
  }
  await counts(4, 2, 1, 1);
  await expect(types.getByRole("button", { name: "Todas", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: testInfo.outputPath("filter-panel.png"), fullPage: true });
  const ct = sides.getByRole("button", { name: "CT", exact: true });
  await ct.focus();
  await page.keyboard.press("Space");
  await expect(ct).toHaveAttribute("aria-pressed", "true");
  await counts(2, 1, 1, 0);
  const flash = types.getByRole("button", { name: "Flashbang", exact: true });
  await flash.focus();
  await page.keyboard.press("Enter");
  await expect(flash).toHaveAttribute("aria-pressed", "true");
  await counts(2, 1, 1, 0);
  await expect(page.getByRole("heading", { name: "Nenhuma granada por aqui" })).toBeVisible();
  await page.getByRole("navigation", { name: "Selecionar mapa" }).getByRole("button", { name: "Inferno", exact: true }).click();
  await counts(1, 0, 0, 1);
  await sides.getByRole("button", { name: "T", exact: true }).click();
  await counts(1, 1, 0, 0);
  await sides.getByRole("button", { name: "Ambos", exact: true }).click();
  await counts(2, 1, 0, 1);
  await page.getByRole("navigation", { name: "Selecionar mapa" }).getByRole("button", { name: "Ancient", exact: true }).click();
  await counts(0, 0, 0, 0);
  await page.getByRole("button", { name: "Limpar filtros", exact: true }).click();
  await expect(types.getByRole("button", { name: "Todas", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(sides.getByRole("button", { name: "Ambos", exact: true })).toHaveAttribute("aria-pressed", "true");
  await counts(0, 0, 0, 0);
});

test("PNGs dos filtros carregam e falhas preservam texto e teclado", async ({ page }, testInfo) => {
  const panel = page.getByRole("complementary", { name: "Filtros da biblioteca" });
  const types = page.getByRole("group", { name: "Tipo de granada" });
  const sides = page.getByRole("group", { name: "Lado do time" });
  await expect(types.getByRole("button")).toHaveCount(4);
  await expect(sides.getByRole("button")).toHaveCount(3);
  await expect(panel.locator("img")).toHaveCount(7);
  for (const [name, file, width] of [
    ["Todas", "all", 200], ["Smoke", "smoke", 200], ["Molotov", "molotov", 200],
    ["Flashbang", "flashbang", 200], ["Ambos", "both", 128], ["CT", "ct", 128], ["T", "t", 128],
  ] as const) {
    const image = panel.getByRole("button", { name, exact: true }).locator("img");
    await expect(image).toHaveAttribute("src", `/filter-icons/${file}.png`);
    await expect(image).toHaveAttribute("alt", "");
    await expect.poll(() => image.evaluate((node: HTMLImageElement) => node.naturalWidth)).toBe(width);
  }
  await expect(panel.locator("img[src$='/he.png']")).toHaveCount(0);
  await page.setViewportSize({ width: 320, height: 900 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: testInfo.outputPath("filter-png-320.png"), fullPage: true });
  await page.route("**/filter-icons/smoke.png", (route) => route.abort());
  await page.route("**/filter-icons/ct.png", (route) => route.abort());
  await page.reload();
  const smoke = types.getByRole("button", { name: "Smoke", exact: true });
  const ct = sides.getByRole("button", { name: "CT", exact: true });
  await expect(smoke.locator("img")).toHaveCount(0);
  await expect(ct.locator("img")).toHaveCount(0);
  await expect(smoke).toBeVisible();
  await expect(ct).toBeVisible();
  await ct.focus();
  await page.keyboard.press("Space");
  await smoke.focus();
  await page.keyboard.press("Enter");
  await expect(smoke).toHaveAttribute("aria-pressed", "true");
  await expect(ct).toHaveAttribute("aria-pressed", "true");
  await expect(smoke).toHaveAccessibleDescription("1 granadas");
  await expect(page.getByRole("button", { name: /^Outro exemplo de smoke Smoke/ })).toBeVisible();
});

test("origem e destino no formulário: modos, zeros, coordenadas da imagem e troca de mapa", async ({ page }, testInfo) => {
  await enterAdmin(page);
  await page.getByRole("button", { name: "Nova granada", exact: true }).click();
  await fillDraft(page, "Origem e destino QA");
  await page.getByLabel("Arquivo MP4", { exact: true }).setInputFiles(fileURLToPath(new URL("../fixtures/test-pattern.mp4", import.meta.url)));
  await expect.poll(() => page.getByLabel("Prévia do MP4 selecionado").evaluate((node: HTMLVideoElement) => node.readyState)).toBeGreaterThanOrEqual(1);
  const image = page.getByRole("dialog").getByAltText("Radar do mapa Mirage");
  await page.getByRole("button", { name: "Marcar origem", exact: true }).click();
  const bounds = (await image.boundingBox())!;
  await image.click({ position: { x: bounds.width * .2, y: bounds.height * .3 } });
  expect(Number(await page.getByLabel("Origem X (%)", { exact: true }).inputValue())).toBeCloseTo(20, 0);
  expect(Number(await page.getByLabel("Origem Y (%)", { exact: true }).inputValue())).toBeCloseTo(30, 0);
  await page.getByRole("button", { name: "Marcar destino", exact: true }).focus();
  await page.keyboard.press("Enter");
  await image.click({ position: { x: bounds.width * .7, y: bounds.height * .6 } });
  expect(Number(await page.getByLabel("Coordenada X (%)", { exact: true }).inputValue())).toBeCloseTo(70, 0);
  const marker = page.getByRole("dialog").locator(".origin-marker");
  const box = (await marker.boundingBox())!;
  const actual = (await image.boundingBox())!;
  expect((box.x + box.width / 2 - actual.x) / actual.width).toBeCloseTo(.2, 2);
  expect((box.y + box.height / 2 - actual.y) / actual.height).toBeCloseTo(.3, 2);
  await expect(page.getByRole("dialog").locator(".origin-connections line")).toHaveCount(1);
  await page.screenshot({ path: testInfo.outputPath("origin-form.png"), fullPage: true });
  await page.getByLabel("Mapa", { exact: true }).selectOption("inferno");
  for (const label of ["Origem X (%)", "Origem Y (%)", "Coordenada X (%)", "Coordenada Y (%)"])
    await expect(page.getByLabel(label, { exact: true })).toHaveValue("");
  await page.getByLabel("Mapa", { exact: true }).selectOption("mirage");
  await expect(page.getByLabel("Origem X (%)", { exact: true })).toHaveValue("");
  await page.getByLabel("Coordenada X (%)", { exact: true }).fill("70");
  await page.getByLabel("Coordenada Y (%)", { exact: true }).fill("60");
  await page.getByRole("button", { name: "Salvar demonstração", exact: true }).click();
  await expect(page.getByRole("alert").first()).toContainText("Marque onde o jogador lança");
  await page.getByLabel("Origem X (%)", { exact: true }).fill("0");
  await page.getByLabel("Origem Y (%)", { exact: true }).fill("100");
  await page.getByRole("button", { name: "Salvar demonstração", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("link", { name: "Biblioteca", exact: true }).click();
  await page.getByRole("button", { name: /^Origem e destino QA Smoke/ }).click();
  await expect(page.getByText("Origem no radar: 0%, 100%.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Origem de Origem e destino QA", exact: true })).toBeVisible();
});
