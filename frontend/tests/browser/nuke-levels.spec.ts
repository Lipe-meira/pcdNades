import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { mapLevelCatalog } from "../../src/domain/mapLevels";

const mp4 = fileURLToPath(new URL("../fixtures/test-pattern.mp4", import.meta.url));
const { viewport } = mapLevelCatalog.nuke;
const level1 = (page: Page) => page.getByRole("button", { name: /^Andar 1,/ });
const level2 = (page: Page) => page.getByRole("button", { name: /^Andar 2,/ });
const row = (page: Page, text: string) => page.locator(".lineup-row").filter({ hasText: text });

async function openMap(page: Page, name: string) {
  await page.goto("/");
  await page.getByRole("navigation", { name: "Selecionar mapa" }).getByRole("button", { name, exact: true }).click();
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
}
async function enterAdmin(page: Page) {
  await page.getByRole("link", { name: "Administração", exact: true }).click();
  await page.getByRole("button", { name: "Entrar na demonstração" }).click();
}
/** Centro de um marcador relativo ao retângulo visível do radar, em frações 0–1 do recorte. */
async function fractionInView(page: Page, marker: Locator) {
  const view = (await page.locator(".radar-image").first().boundingBox())!;
  const box = (await marker.boundingBox())!;
  return { x: (box.x + box.width / 2 - view.x) / view.width, y: (box.y + box.height / 2 - view.y) / view.height, view };
}
async function clickRadar(page: Page, x: number, y: number) {
  const radar = page.getByAltText(/Radar do mapa Nuke/);
  // Centraliza o radar: no celular a barra de ações fixa do editor cobre a parte de baixo da janela.
  await radar.evaluate((el) => el.scrollIntoView({ block: "center" }));
  const img = (await radar.boundingBox())!;
  await page.mouse.click(img.x + x * img.width, img.y + y * img.height);
}
async function pickMap(page: Page, id: string) {
  await page.getByLabel("Mapa", { exact: true }).selectOption(id);
}
async function fillBasics(page: Page, title: string, type = "smoke") {
  await page.getByRole("button", { name: "Nova granada", exact: true }).click();
  await page.getByLabel("Título", { exact: true }).fill(title);
  await page.getByLabel("Instruções", { exact: true }).fill("Instruções fictícias de teste da interface.");
  await pickMap(page, "nuke");
  await page.getByLabel("Tipo", { exact: true }).selectOption(type);
  await page.getByRole("button", { name: "Posicionamento" }).click();
}
async function finish(page: Page) {
  await page.getByRole("button", { name: "Vídeo e revisão" }).click();
  await page.getByLabel("Arquivo MP4", { exact: true }).setInputFiles(mp4);
  const preview = page.getByLabel("Prévia do MP4 selecionado");
  await expect.poll(() => preview.evaluate((v: HTMLVideoElement) => v.readyState)).toBeGreaterThanOrEqual(1);
  await page.getByRole("button", { name: "Salvar demonstração" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
}

test("botões 1 e 2 só existem na Nuke e alternam o radar sem recarregar", async ({ page }) => {
  await openMap(page, "Mirage");
  await expect(page.getByRole("group", { name: "Andar do radar" })).toHaveCount(0);
  await expect(page.locator(".radar-level-note")).toHaveCount(0);
  await page.getByRole("navigation", { name: "Selecionar mapa" }).getByRole("button", { name: "Nuke", exact: true }).click();
  await expect(page.getByRole("group", { name: "Andar do radar" })).toBeVisible();
  await expect(level1(page)).toHaveAttribute("aria-pressed", "true");
  await expect(level2(page)).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByAltText(/Radar do mapa Nuke, andar 1 \(superior\)/)).toHaveAttribute("src", "/maps/valve/nuke.png");
  await page.evaluate(() => { (window as unknown as { marcador: number }).marcador = 7; });
  await level2(page).click();
  await expect(level2(page)).toHaveAttribute("aria-pressed", "true");
  await expect(level1(page)).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByAltText(/Radar do mapa Nuke, andar 2 \(inferior\)/)).toHaveAttribute("src", "/maps/valve/nuke_lower.png");
  await expect(page.locator(".radar-level-note")).toContainText("Bomb B");
  expect(await page.evaluate(() => (window as unknown as { marcador: number }).marcador)).toBe(7); // sem recarregar
  // Trocar de mapa e voltar restaura o andar padrão.
  await page.getByRole("navigation", { name: "Selecionar mapa" }).getByRole("button", { name: "Mirage", exact: true }).click();
  await expect(page.getByRole("group", { name: "Andar do radar" })).toHaveCount(0);
  await page.getByRole("navigation", { name: "Selecionar mapa" }).getByRole("button", { name: "Nuke", exact: true }).click();
  await expect(level1(page)).toHaveAttribute("aria-pressed", "true");
});

test("cada andar mostra só os marcadores dele e filtros e seleção sobrevivem à troca", async ({ page }) => {
  await openMap(page, "Nuke");
  // Demonstração: andar 1 → smoke e destino 1 do Solo Exec; andar 2 → flashbang, molotov (origem no 1) e HE do Solo Exec.
  await expect(page.locator(".radar-marker")).toHaveCount(2);
  await level2(page).click();
  await expect(page.locator(".radar-marker")).toHaveCount(3);
  await expect(page.locator(".radar-marker.he")).toHaveCount(1);
  await expect(page.locator(".radar-marker.flashbang")).toHaveCount(1);
  await expect(page.locator(".radar-marker.molotov")).toHaveCount(1);
  // O filtro de tipo não muda o andar e a troca de andar não muda o filtro.
  const types = page.getByRole("group", { name: "Tipo de granada" });
  await types.getByRole("button", { name: "HE Grenade", exact: true }).click();
  await expect(level2(page)).toHaveAttribute("aria-pressed", "true");
  await expect(types.getByRole("button", { name: "HE Grenade", exact: true })).toHaveAttribute("aria-pressed", "true");
  await level1(page).click();
  await expect(types.getByRole("button", { name: "HE Grenade", exact: true })).toHaveAttribute("aria-pressed", "true");
  // Contagens da biblioteca continuam as da lista completa, independentes do andar.
  await types.getByRole("button", { name: "Todas", exact: true }).click();
  await expect(types.getByRole("button", { name: "Todas", exact: true })).toContainText("4");
  await expect(page.locator(".lineup-row")).toHaveCount(4);
  // Granada que cruza andares: abre no andar do destino, avisa do outro andar, e a seleção é preservada ao alternar.
  await row(page, "origem no andar 1").click();
  await expect(level2(page)).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".radar-marker.molotov.selected")).toHaveCount(1);
  await expect(page.getByText("Origem no radar: 57,1%, 45,9%, andar 1 (superior).")).toBeVisible();
  await expect(page.locator(".origin-marker")).toHaveCount(0); // a origem está no andar 1
  await page.getByRole("button", { name: /Também usa o andar 1/ }).click();
  await expect(level1(page)).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".origin-marker")).toHaveCount(1);
  await expect(page.getByRole("heading", { name: /origem no andar 1, destino no andar 2/ })).toBeVisible();
  await expect(page.locator(".origin-connections line")).toHaveCount(0); // sem linha entre andares diferentes
});

for (const [name, width, height] of [["320px", 320, 700], ["390px", 390, 844], ["desktop", 1440, 1000]] as const) {
  test(`marcadores caem nas coordenadas certas em ${name}, em ambos os andares e no radar ampliado`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await openMap(page, "Nuke");
    const expected = (x: number, y: number) => ({ x: (x - viewport.x) / viewport.width, y: (y - viewport.y) / viewport.height });
    const near = (a: number, b: number, view: { width: number; height: number }, axis: "x" | "y") =>
      Math.abs(a - b) * (axis === "x" ? view.width : view.height) <= 1.5;
    const smoke = await fractionInView(page, page.locator(".radar-marker.smoke").first());
    const want = expected(0.571, 0.322);
    expect(near(smoke.x, want.x, smoke.view, "x") && near(smoke.y, want.y, smoke.view, "y")).toBe(true);
    await level2(page).click();
    const flash = await fractionInView(page, page.locator(".radar-marker.flashbang"));
    const wantFlash = expected(0.571, 0.508);
    expect(near(flash.x, wantFlash.x, flash.view, "x") && near(flash.y, wantFlash.y, flash.view, "y")).toBe(true);
    // A imagem inteira continua com a mesma razão: o recorte não distorce.
    const img = (await page.getByAltText(/Radar do mapa Nuke/).boundingBox())!;
    expect(Math.abs(img.width - img.height)).toBeLessThanOrEqual(1);
    // Radar ampliado: mesmos marcadores, mesma posição relativa, e os botões continuam funcionando.
    await page.getByRole("button", { name: "Ampliar radar" }).click();
    const dialog = page.getByRole("dialog", { name: /Radar ampliado: Nuke/ });
    await expect(dialog).toBeVisible();
    const zoomedFlash = await fractionInView(page, dialog.locator(".radar-marker.flashbang"));
    expect(near(zoomedFlash.x, wantFlash.x, zoomedFlash.view, "x") && near(zoomedFlash.y, wantFlash.y, zoomedFlash.view, "y")).toBe(true);
    await dialog.getByRole("button", { name: /^Andar 1,/ }).click();
    await expect(dialog.getByAltText(/andar 1 \(superior\)/)).toBeVisible();
    const zoomedSmoke = await fractionInView(page, dialog.locator(".radar-marker.smoke").first());
    expect(near(zoomedSmoke.x, want.x, zoomedSmoke.view, "x") && near(zoomedSmoke.y, want.y, zoomedSmoke.view, "y")).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(level1(page)).toHaveAttribute("aria-pressed", "true"); // o andar escolhido é mantido ao fechar
  });
}

test("botões de andar têm alvo de toque de 44px e funcionam pelo teclado", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openMap(page, "Nuke");
  for (const button of [level1(page), level2(page)]) {
    const box = (await button.boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
  }
  await level1(page).focus();
  await page.keyboard.press("Tab");
  await expect(level2(page)).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(level2(page)).toHaveAttribute("aria-pressed", "true");
  await level1(page).focus();
  await page.keyboard.press("Space");
  await expect(level1(page)).toHaveAttribute("aria-pressed", "true");
});

test("editor: origem no andar 1 e destino no andar 2, salvar, reabrir e editar", async ({ page }) => {
  await openMap(page, "Mirage");
  await enterAdmin(page);
  await fillBasics(page, "Cruza andares");
  await expect(page.getByRole("group", { name: /Andar exibido/ })).toBeVisible();
  await expect(page.getByRole("group", { name: "Andar da origem" })).toBeVisible();
  // Origem no andar 1 (padrão), depois destino no andar 2.
  await clickRadar(page, 0.571, 0.46);
  await expect(page.getByRole("radio", { name: "1 · Superior" }).first()).toBeChecked();
  await page.getByRole("button", { name: "Marcar destino", exact: true }).click();
  await level2(page).click();
  await clickRadar(page, 0.575, 0.5);
  await expect(page.getByText(/Origem: andar 1 \(superior\) · Destino: andar 2 \(inferior\)\. A granada muda de andar\./)).toBeVisible();
  await page.getByRole("button", { name: "Marcar origem", exact: true }).click();
  await expect(level1(page)).toHaveAttribute("aria-pressed", "true"); // volta ao andar da origem
  await expect(page.locator(".origin-marker")).toHaveCount(1);
  await finish(page);
  // Biblioteca: abre no andar do destino e informa a origem no outro.
  await page.getByRole("link", { name: "Biblioteca", exact: true }).click();
  await page.getByRole("navigation", { name: "Selecionar mapa" }).getByRole("button", { name: "Nuke", exact: true }).click();
  await row(page, "Cruza andares").click();
  await expect(level2(page)).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText(/Origem no radar: .*andar 1 \(superior\)\./)).toBeVisible();
  // Editar: pontos recuperados nos andares certos; trocar o andar do destino e salvar.
  await enterAdmin(page);
  await page.getByRole("button", { name: "Editar Cruza andares", exact: true }).click();
  await page.getByRole("button", { name: "Posicionamento" }).click();
  await expect(page.getByRole("radio", { name: "1 · Superior" }).first()).toBeChecked();
  await expect(page.getByText(/Origem: andar 1 \(superior\) · Destino: andar 2 \(inferior\)/)).toBeVisible();
  await page.getByRole("button", { name: "Marcar destino", exact: true }).click();
  await expect(level2(page)).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("radio", { name: "1 · Superior" }).nth(1).check();
  await expect(page.getByText(/Destino: andar 1 \(superior\)/)).toBeVisible();
  await expect(page.getByText(/A granada muda de andar/)).toHaveCount(0);
  await page.getByRole("button", { name: "Vídeo e revisão" }).click();
  await page.getByRole("button", { name: "Salvar demonstração" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("link", { name: "Biblioteca", exact: true }).click();
  await page.getByRole("navigation", { name: "Selecionar mapa" }).getByRole("button", { name: "Nuke", exact: true }).click();
  await row(page, "Cruza andares").click();
  await expect(level1(page)).toHaveAttribute("aria-pressed", "true");
});

test("editor: Solo Exec com destinos em andares diferentes preserva os tipos", async ({ page }) => {
  await openMap(page, "Mirage");
  await enterAdmin(page);
  await fillBasics(page, "Solo entre andares", "solo_exec");
  await clickRadar(page, 0.684, 0.508); // origem, andar 1
  await page.getByRole("button", { name: "Marcar destino", exact: true }).click();
  await clickRadar(page, 0.6, 0.34); // destino 1, andar 1
  await page.getByLabel("Tipo do destino 1", { exact: true }).selectOption("smoke");
  await page.getByRole("button", { name: "Adicionar destino" }).click();
  await level2(page).click();
  await clickRadar(page, 0.64, 0.58); // destino 2, andar 2
  await page.getByLabel("Tipo do destino 2", { exact: true }).selectOption("he");
  await expect(page.getByText("andar 2 (inferior)", { exact: true }).first()).toBeVisible();
  await finish(page);
  await page.getByRole("link", { name: "Biblioteca", exact: true }).click();
  await page.getByRole("navigation", { name: "Selecionar mapa" }).getByRole("button", { name: "Nuke", exact: true }).click();
  await page.getByRole("group", { name: "Tipo de granada" }).getByRole("button", { name: "Solo Exec", exact: true }).click();
  await row(page, "Solo entre andares").click();
  await expect(level1(page)).toHaveAttribute("aria-pressed", "true"); // abre no andar do primeiro destino
  await expect(page.locator(".radar-marker.smoke")).toHaveCount(2); // inclui o exemplo da demonstração
  await expect(page.locator(".radar-marker.he")).toHaveCount(0);
  await page.getByRole("button", { name: /Também usa o andar 2/ }).click();
  await expect(page.locator(".radar-marker.he")).toHaveCount(2);
  const summary = page.locator(".solo-destination-summary");
  await expect(summary).toContainText("Smoke");
  await expect(summary).toContainText("HE Grenade");
  await expect(summary).toContainText("andar 1 (superior)");
  await expect(summary).toContainText("andar 2 (inferior)");
});

test("editor de outros mapas não mostra andares e a troca de mapa limpa os pontos", async ({ page }) => {
  await openMap(page, "Mirage");
  await enterAdmin(page);
  await page.getByRole("button", { name: "Nova granada", exact: true }).click();
  await page.getByRole("button", { name: "Posicionamento" }).click();
  await expect(page.getByRole("group", { name: "Andar da origem" })).toHaveCount(0);
  await expect(page.getByRole("group", { name: /Andar exibido/ })).toHaveCount(0);
  await page.getByRole("button", { name: "Informações" }).click();
  await pickMap(page, "nuke");
  await page.getByRole("button", { name: "Posicionamento" }).click();
  await expect(page.getByRole("group", { name: "Andar da origem" })).toBeVisible();
  await page.getByRole("button", { name: "Informações" }).click();
  await pickMap(page, "dust2");
  await page.getByRole("button", { name: "Posicionamento" }).click();
  await expect(page.getByRole("group", { name: "Andar da origem" })).toHaveCount(0);
});

test("regressão: os sete mapas carregam o radar e só a Nuke tem andares", async ({ page }) => {
  await page.goto("/");
  const maps = ["Mirage", "Inferno", "Ancient", "Cache", "Nuke", "Dust II", "Anubis"];
  for (const name of maps) {
    await page.getByRole("navigation", { name: "Selecionar mapa" }).getByRole("button", { name, exact: true }).click();
    await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
    const radar = page.getByAltText(new RegExp(`Radar do mapa ${name}`));
    await expect(radar).toBeVisible();
    await expect.poll(() => radar.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth)).toBe(1024);
    await expect(page.getByRole("group", { name: "Andar do radar" })).toHaveCount(name === "Nuke" ? 1 : 0);
    await expect(page.locator(".radar-image.is-cropped")).toHaveCount(name === "Nuke" ? 1 : 0);
    const box = (await radar.boundingBox())!;
    expect(Math.abs(box.width - box.height)).toBeLessThanOrEqual(1); // quadrado: nenhum recorte nos mapas de um andar
  }
});
