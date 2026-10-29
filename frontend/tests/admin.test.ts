import { describe, expect, it } from "vitest";
import {
  validateDraft,
  validateMp4,
  validateSourceUrl,
  validateDuration,
} from "../src/domain/validation";
import { createDemoService } from "../src/services/lineupService";
import type { LineupDraft } from "../src/domain/types";

const valid: LineupDraft = {
  title: "Teste de cadastro",
  mapId: "mirage",
  type: "smoke",
  side: "T",
  instructions: "Instruções fictícias para teste.",
  target: { x: 0.25, y: 0.75 },
  media: {
    kind: "link",
    sourceUrl: "https://www.youtube.com/shorts/abcdefghijk",
  },
};
const local: LineupDraft = {
  ...valid,
  media: {
    kind: "file",
    file: new File(
      [new Uint8Array([0, 0, 0, 20, 102, 116, 121, 112, 105, 115, 111, 109])],
      "teste.mp4",
      { type: "video/mp4" },
    ),
  },
};

describe("validação do formulário", () => {
  it("limita o vídeo a vinte segundos inclusive e rejeita duração inválida", () => {
    expect(validateDuration(20)).toBe(true);
    expect(validateDuration(20.01)).toBe(false);
    expect(validateDuration(0)).toBe(false);
    expect(validateDuration(Infinity)).toBe(false);
    expect(validateDuration(NaN)).toBe(false);
  });
  it("exige título, mapa, instruções e destino válido", () => {
    expect(validateDraft(valid, ["mirage"])).toEqual({});
    expect(
      validateDraft(
        { ...valid, title: " ", mapId: "x", instructions: "", target: null },
        ["mirage"],
      ),
    ).toMatchObject({
      title: expect.any(String),
      mapId: expect.any(String),
      instructions: expect.any(String),
      target: expect.any(String),
    });
    expect(
      validateDraft({ ...valid, target: { x: 0, y: Infinity } }, ["mirage"]),
    ).toHaveProperty("target");
  });
  it("aceita só URLs HTTPS de Shorts/TikTok com formato reconhecido", () => {
    expect(
      validateSourceUrl(
        valid.media.kind === "link" ? valid.media.sourceUrl : "",
      ),
    ).toBeNull();
    expect(
      validateSourceUrl(
        "https://www.tiktok.com/@teste/video/1234567890123456789",
      ),
    ).toBeNull();
    expect(validateSourceUrl("https://vm.tiktok.com/ABCDE/")).toBeNull();
    for (const url of [
      "javascript:alert(1)",
      "http://youtube.com/shorts/abcdefghijk",
      "https://youtube.com.evil.com/shorts/abcdefghijk",
      "https://user:pass@youtube.com/shorts/abcdefghijk",
      "https://youtube.com/watch?v=abcdefghijk",
      "https://127.0.0.1/test",
      "",
    ])
      expect(validateSourceUrl(url)).toEqual(expect.any(String));
  });
  it("verifica extensão, tamanho e assinatura de contêiner MP4", async () => {
    const mp4 = new File(
      [new Uint8Array([0, 0, 0, 20, 102, 116, 121, 112, 105, 115, 111, 109])],
      "teste.mp4",
      { type: "video/mp4" },
    );
    expect(await validateMp4(mp4)).toBeNull();
    expect(
      await validateMp4(
        new File(["not a video"], "teste.mp4", { type: "video/mp4" }),
      ),
    ).toEqual(expect.any(String));
    expect(await validateMp4(new File([""], "teste.txt"))).toEqual(
      expect.any(String),
    );
    expect(await validateMp4(new File([""], "teste.mp4"))).toEqual(
      expect.any(String),
    );
  });
});

describe("serviço de demonstração isolado", () => {
  it("cria, edita, exclui e não persiste em outra instância", async () => {
    const service = createDemoService();
    const created = await service.createLineup(local);
    expect(created.title).toBe(valid.title);
    expect(created.video.status).toBe("ready");
    expect(created.video.playbackUrl).toMatch(/^blob:/);
    const updated = await service.updateLineup(created.id, {
      ...valid,
      title: "Editado",
      media: { kind: "keep" },
    });
    expect(updated.id).toBe(created.id);
    expect(updated.title).toBe("Editado");
    expect(
      (await service.listLineups()).some((item) => item.id === created.id),
    ).toBe(true);
    expect(
      (await createDemoService().listLineups()).some(
        (item) => item.id === created.id,
      ),
    ).toBe(false);
    await service.deleteLineup(created.id);
    expect(
      (await service.listLineups()).some((item) => item.id === created.id),
    ).toBe(false);
    await expect(service.deleteLineup(created.id)).rejects.toThrow();
    service.dispose();
  });
  it("não publica link indisponível nem substitui vídeo anterior", async () => {
    const service = createDemoService();
    await expect(service.createLineup(valid)).rejects.toThrow(
      "PLATFORM_UNSUPPORTED",
    );
    const item = await service.createLineup(local);
    await expect(service.updateLineup(item.id, valid)).rejects.toThrow(
      "PLATFORM_UNSUPPORTED",
    );
    expect(
      (await service.listLineups()).find((current) => current.id === item.id),
    ).toEqual(item);
    service.dispose();
  });
  it("rejeita dados inválidos sem alterar cadastros existentes", async () => {
    const service = createDemoService();
    const before = await service.listLineups();
    await expect(
      service.createLineup({ ...valid, target: null }),
    ).rejects.toThrow();
    expect(await service.listLineups()).toEqual(before);
    await expect(service.updateLineup("inexistente", valid)).rejects.toThrow();
    service.dispose();
  });
});
