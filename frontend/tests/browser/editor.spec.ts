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
