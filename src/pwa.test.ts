import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

type ManifestIcon = {
  src: string;
  sizes: string;
  type: string;
};

type AppManifest = {
  display: string;
  start_url: string;
  icons: ManifestIcon[];
};

async function readPngDimensions(path: string): Promise<[number, number]> {
  const png = await readFile(`public${path}`);
  expect(png.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  return [png.readUInt32BE(16), png.readUInt32BE(20)];
}

describe("installable app metadata", () => {
  it("launches in standalone mode with valid home-screen icons", async () => {
    const manifest = JSON.parse(
      await readFile("public/manifest.webmanifest", "utf8"),
    ) as AppManifest;

    expect(manifest.display).toBe("standalone");
    expect(manifest.start_url).toBe("/");
    expect(manifest.icons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sizes: "192x192", type: "image/png" }),
        expect.objectContaining({ sizes: "512x512", type: "image/png" }),
      ]),
    );

    for (const icon of manifest.icons) {
      const expectedSize = Number(icon.sizes.split("x")[0]);
      expect(await readPngDimensions(icon.src)).toEqual([expectedSize, expectedSize]);
    }
  });

  it("declares Apple installation and safe-area viewport support", async () => {
    const root = await readFile("src/routes/__root.tsx", "utf8");
    const css = await readFile("src/styles.css", "utf8");
    const [titleLogo, appIcon] = await Promise.all([
      readFile("public/resources/speedtracker-title.svg", "utf8"),
      readFile("public/resources/icons/speedtracker.svg", "utf8"),
    ]);

    expect(root).toContain('name: "apple-mobile-web-app-capable"');
    expect(root).toContain("viewport-fit=cover");
    expect(root).toContain('rel: "apple-touch-icon"');
    expect(css).toContain("env(safe-area-inset-top)");
    expect(appIcon.match(/<defs>[\s\S]*?<\/defs>/)?.[0]).toBe(
      titleLogo.match(/<defs>[\s\S]*?<\/defs>/)?.[0],
    );
    expect(appIcon).toContain('href="#lettering"');
  });
});
