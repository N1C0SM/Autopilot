// @vitest-environment node
import { deflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { groupClipFiles, matchExercise, normalizeName, readZip, type ClipSource } from "./clipImport";

const source = (path: string): ClipSource => ({ path, size: 1, read: async () => new Blob([path]) });

/** Un .zip mínimo como los del Finder: entradas «deflate» y «sin comprimir». */
const buildZip = (entries: { name: string; data: string; deflate: boolean }[]): Blob => {
  const chunks: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name, "utf8");
    const raw = Buffer.from(entry.data, "utf8");
    const body = entry.deflate ? deflateRawSync(raw) : raw;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(entry.deflate ? 8 : 0, 8);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(name.length, 26);
    const head = Buffer.alloc(46);
    head.writeUInt32LE(0x02014b50, 0);
    head.writeUInt16LE(entry.deflate ? 8 : 0, 10);
    head.writeUInt32LE(body.length, 20);
    head.writeUInt32LE(raw.length, 24);
    head.writeUInt16LE(name.length, 28);
    head.writeUInt32LE(offset, 42);
    chunks.push(local, name, body);
    central.push(head, name);
    offset += local.length + name.length + body.length;
  }
  const directory = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return new Blob([Buffer.concat([...chunks, directory, end])]);
};

describe("clipImport", () => {
  it("agrupa una carpeta por ejercicio e ignora el material oculto o de borrador", () => {
    const groups = groupClipFiles([
      source("ejercicios/Peck Deck/video.mp4"),
      source("ejercicios/Peck Deck/miniatura.png"),
      source("ejercicios/Extensión de cuádriceps/_video_raw.mp4"),
      source("ejercicios/Extensión de cuádriceps/_frames/in/00001.png"),
      source("ejercicios/Extensión de cuádriceps/miniatura.png"),
      source("__MACOSX/ejercicios/Peck Deck/._video.mp4"),
      source("ejercicios/.DS_Store"),
      source("Remo con pecho apoyado.mp4"),
    ]);
    expect(groups.map((g) => [g.folder, g.video?.path ?? null, g.thumb?.path ?? null])).toEqual([
      ["Extensión de cuádriceps", null, "ejercicios/Extensión de cuádriceps/miniatura.png"],
      ["Peck Deck", "ejercicios/Peck Deck/video.mp4", "ejercicios/Peck Deck/miniatura.png"],
      ["Remo con pecho apoyado", "Remo con pecho apoyado.mp4", null],
    ]);
  });

  it("une nombres con tildes en forma descompuesta (macOS) y compuesta", () => {
    const groups = groupClipFiles([
      source("x/Jalón al pecho/video.mp4"),
      source("x/Jalón al pecho/miniatura.png"),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].video && groups[0].thumb).toBeTruthy();
  });

  it("empareja por nombre exacto, sugiere solo nombres muy parecidos y si no, ninguno", () => {
    const exercises = [
      { id: "a", name: "Jalón al pecho con agarre ancho" },
      { id: "b", name: "Pec deck" },
      { id: "c", name: "Press inclinado con mancuernas" },
    ];
    expect(matchExercise("Jalon al pecho con agarre ancho", exercises)).toEqual({ id: "a", kind: "exact" });
    expect(matchExercise("Peck Deck", exercises)).toEqual({ id: "b", kind: "suggested" });
    expect(matchExercise("Press inclinado con barra", exercises)).toEqual({ id: null, kind: "none" });
    expect(normalizeName("  Elevación  lateral (polea) ")).toBe("elevacion lateral polea");
  });

  it("lee un .zip con entradas comprimidas y sin comprimir", async () => {
    const files = await readZip(buildZip([
      { name: "ejercicios/", data: "", deflate: false },
      { name: "ejercicios/Peck Deck/video.mp4", data: "clip ".repeat(200), deflate: true },
      { name: "ejercicios/Peck Deck/miniatura.png", data: "png", deflate: false },
    ]));
    expect(files.map((f) => f.path)).toEqual(["ejercicios/Peck Deck/video.mp4", "ejercicios/Peck Deck/miniatura.png"]);
    expect(await (await files[0].read()).text()).toBe("clip ".repeat(200));
    expect(await (await files[1].read()).text()).toBe("png");
  });

  it("rechaza un archivo que no es un .zip", async () => {
    await expect(readZip(new Blob(["no soy un zip"]))).rejects.toThrow(".zip");
  });
});
