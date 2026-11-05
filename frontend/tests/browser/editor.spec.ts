import { test, expect } from "@playwright/test";
test("editor preserva etapas e recupera rascunho local", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Administração", exact: true }).click();
  await page.getByRole("button", { name: "Entrar na demonstração" }).click();
  await page.getByRole("button", { name: "Nova granada", exact: true }).click();
  await page.getByLabel("Título", { exact: true }).fill("Rascunho de teste");
  await page.getByRole("button", { name: "Salvar rascunho", exact: true }).click();
  await expect(page.getByText("Rascunho salvo neste navegador.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Origem e destino no radar" })).toBeVisible();
  await page.getByRole("button", { name: "Voltar", exact: true }).click();
  await expect(page.getByLabel("Título", { exact: true })).toHaveValue("Rascunho de teste");
  await page.getByRole("button", { name: "Fechar janela" }).click();
  await page.getByRole("button", { name: "Nova granada", exact: true }).click();
  await page.getByRole("button", { name: "Recuperar rascunho" }).click();
  await expect(page.getByLabel("Título", { exact: true })).toHaveValue("Rascunho de teste");
});

test("rascunho falha de quota não informa salvo e navegação não publica", async ({ page }) => {
  await page.addInitScript(() => { Storage.prototype.setItem = () => { throw new DOMException("quota", "QuotaExceededError"); }; });
  await page.goto("/");
  await page.getByRole("link", { name: "Administração", exact: true }).click();
  await page.getByRole("button", { name: "Entrar na demonstração" }).click();
  await page.getByRole("button", { name: "Nova granada", exact: true }).click();
  await page.getByRole("button", { name: "Salvar rascunho", exact: true }).click();
  await expect(page.getByText("Não foi possível salvar neste navegador. Seus dados continuam nesta janela.")).toBeVisible();
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Confira antes de salvar" })).toBeVisible();
  await expect(page.getByRole("dialog")).toBeVisible();
});

test("Solo Exec e mídia sobrevivem às etapas e rascunho recupera pontos", async ({ page }) => {
  await page.goto("/"); await page.getByRole("link", { name: "Administração", exact: true }).click();
  await page.getByRole("button", { name: "Entrar na demonstração" }).click(); await page.getByRole("button", { name: "Nova granada", exact: true }).click();
  await page.getByLabel("Título", { exact: true }).fill("Solo de treino"); await page.getByLabel("Instruções", { exact: true }).fill("Instruções da execução"); await page.getByLabel("Tipo", { exact: true }).selectOption("solo_exec");
  await page.getByRole("button", { name: "Salvar rascunho", exact: true }).click(); await page.getByRole("button", { name: "Continuar", exact: true }).click();
  const radar = page.getByAltText(/Radar do mapa/); await radar.click({position:{x:60,y:60}}); await radar.click({position:{x:120,y:120}});
  await page.getByRole("button", { name: "Adicionar destino" }).click(); await radar.click({position:{x:160,y:160}}); await expect(page.getByRole("button", { name: "Destino 2", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Salvar rascunho", exact: true }).click(); await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await page.getByLabel("Arquivo MP4", { exact: true }).setInputFiles("tests/fixtures/test-pattern.mp4"); const preview = page.getByLabel("Prévia do MP4 selecionado"); await expect.poll(() => preview.evaluate((v: HTMLVideoElement) => v.readyState)).toBeGreaterThanOrEqual(1);
  const original = await preview.elementHandle(); await page.getByRole("button", { name: "Salvar rascunho", exact: true }).click(); await page.getByRole("button", { name: "Voltar", exact: true }).click();
  await expect(page.getByRole("button", { name: "Destino 2", exact: true })).toBeVisible(); await page.getByRole("button", { name: "Continuar", exact: true }).click(); expect(await preview.evaluate((node, handle) => node === handle, original)).toBe(true);
  await page.reload(); await page.getByRole("button", { name: "Entrar na demonstração" }).click(); await page.getByRole("button", { name: "Nova granada", exact: true }).click(); await page.getByRole("button", { name: "Recuperar rascunho" }).click();
  await expect(page.getByText(/Selecione o MP4 novamente/)).toBeVisible(); await expect(page.getByLabel("Arquivo MP4", { exact: true })).toHaveValue(""); await page.getByRole("button", { name: "Voltar", exact: true }).click(); await expect(page.getByRole("button", { name: "Destino 2", exact: true })).toBeVisible();
});

test("edição salva apenas rascunho e mantém cadastro existente", async ({ page }) => {
  await page.goto("/"); await page.getByRole("link", { name: "Administração", exact: true }).click(); await page.getByRole("button", { name: "Entrar na demonstração" }).click();
  const edit = page.getByRole("button", { name: /^Editar Exemplo de smoke/ }).first(); await edit.click(); await page.getByLabel("Título", { exact: true }).fill("Alteração somente local");
  await page.getByRole("button", { name: "Salvar rascunho", exact: true }).click(); await page.getByRole("button", { name: "Fechar janela" }).click();
  await expect(page.getByRole("heading", { name: "Alteração somente local" })).toHaveCount(0); await expect(page.getByRole("heading", { name: "Exemplo de smoke", exact: true }).first()).toBeVisible();
  await edit.click(); await page.getByRole("button", { name: "Recuperar rascunho" }).click(); await expect(page.getByLabel("Título", { exact: true })).toHaveValue("Alteração somente local");
  await page.getByRole("button", { name: "Vídeo e revisão" }).click(); await expect(page.getByText("Vídeo existente mantido")).toBeVisible();
});

test("validação final direciona para campo obrigatório", async ({ page }) => {
  await page.goto("/"); await page.getByRole("link", { name: "Administração", exact: true }).click(); await page.getByRole("button", { name: "Entrar na demonstração" }).click(); await page.getByRole("button", { name: "Nova granada", exact: true }).click();
  await page.getByRole("button", { name: "Vídeo e revisão" }).click(); await page.getByRole("button", { name: "Salvar demonstração" }).click(); await expect(page.getByLabel("Título", { exact: true })).toBeVisible(); await expect(page.getByText("Informe um título de até 120 caracteres.")).toBeVisible();
});

test("cadastro e edição concluem com MP4 da demonstração", async ({ page }) => {
  await page.goto("/"); await page.getByRole("link", { name: "Administração", exact: true }).click(); await page.getByRole("button", { name: "Entrar na demonstração" }).click(); await page.getByRole("button", { name: "Nova granada", exact: true }).click();
  await page.getByLabel("Título", { exact: true }).fill("Smoke local editor"); await page.getByLabel("Instruções", { exact: true }).fill("Instruções de teste"); await page.getByRole("button", { name: "Continuar", exact: true }).click();
  const radar = page.getByAltText(/Radar do mapa/); await radar.click({ position: { x: 60, y: 60 } }); await radar.click({ position: { x: 120, y: 120 } }); await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await page.getByLabel("Arquivo MP4", { exact: true }).setInputFiles("tests/fixtures/test-pattern.mp4"); await expect.poll(() => page.getByLabel("Prévia do MP4 selecionado").evaluate((v: HTMLVideoElement) => v.readyState)).toBeGreaterThanOrEqual(1);
  await page.getByRole("button", { name: "Salvar demonstração" }).click(); await expect(page.getByRole("heading", { name: "Smoke local editor", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Editar Smoke local editor" }).click(); await page.getByLabel("Título", { exact: true }).fill("Smoke local editada"); await page.getByRole("button", { name: "Vídeo e revisão" }).click(); await page.getByRole("button", { name: "Salvar demonstração" }).click(); await expect(page.getByRole("heading", { name: "Smoke local editada", exact: true })).toBeVisible();
});
