import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

async function readJavaScriptTree(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const contents = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) return readJavaScriptTree(entryPath);
      return entry.name.endsWith(".js") ? readFile(entryPath, "utf8") : "";
    }),
  );
  return contents.join("\n");
}

test("builds the SameBeat product, recognition routes, and live-sync player", async () => {
  const worker = await readFile(path.join(root, "dist/server/index.js"), "utf8");
  const client = await readJavaScriptTree(path.join(root, "dist/client"));
  const manifest = JSON.parse(await readFile(path.join(root, "dist/client/manifest.webmanifest"), "utf8"));

  assert.match(worker, /SameBeat — join the song already playing/);
  assert.match(worker, /\/api\/recognize/);
  assert.match(worker, /\/api\/spotify\/token/);
  assert.match(client, /Resync now/);
  assert.match(client, /Auto-correcting/);
  assert.match(client, /Possible version mismatch/);
  assert.match(client, /Use a different YouTube version/);
  assert.match(client, /YouTube playback synchronized by SameBeat/);
  assert.match(client, /Friend is near/);
  assert.equal(manifest.name, "SameBeat — Join the Song");
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.start_url, "/");
});
