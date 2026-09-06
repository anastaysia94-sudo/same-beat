import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test, { after } from "node:test";
import { fileURLToPath } from "node:url";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

const root = fileURLToPath(new URL("..", import.meta.url));
const vite = await createServer({
  appType: "custom",
  configFile: false,
  root,
  resolve: { alias: { "@": root } },
  server: { middlewareMode: true },
});

after(async () => {
  await vite.close();
});

async function readCssTree(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const contents = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        return readCssTree(entryPath);
      }
      return entry.name.endsWith(".css") ? readFile(entryPath, "utf8") : "";
    }),
  );
  return contents.join("\n");
}

test("emits SameBeat's live-sync, motion, and reduced-motion styles", async () => {
  const css = await readCssTree(path.join(root, "dist"));

  assert.match(css, /\.live-sync-bar/);
  assert.match(css, /\.live-sync-bar\.synced/);
  assert.match(css, /\.version-warning/);
  assert.match(css, /\.manual-link\[open\]/);
  assert.match(css, /sync-pulse/);
  assert.match(css, /\.listen-orb/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
});

test("calculates catch-up timing and gates automatic drift recovery", async () => {
  const {
    calculateTargetOffset,
    detectDurationMismatch,
    shouldAutoResync,
  } = await vite.ssrLoadModule("/app/sync-timing.ts");

  assert.equal(
    calculateTargetOffset(
      { observedOffsetMs: 60_000, referenceTimestampMs: 100_000, durationMs: 180_000 },
      500,
      105_000,
    ),
    65_500,
  );
  assert.equal(
    calculateTargetOffset(
      { observedOffsetMs: 179_000, referenceTimestampMs: 100_000, durationMs: 180_000 },
      0,
      105_000,
    ),
    179_750,
  );

  assert.equal(shouldAutoResync({
    driftMs: -1_800,
    consecutiveLargeSamples: 3,
    timeSinceLastCorrectionMs: 8_000,
    isPlaying: true,
    correctionCount: 0,
  }), true);
  assert.equal(shouldAutoResync({
    driftMs: -1_800,
    consecutiveLargeSamples: 3,
    timeSinceLastCorrectionMs: 8_000,
    isPlaying: true,
    correctionCount: 3,
  }), false);

  assert.deepEqual(detectDurationMismatch(180_000, 205), {
    differenceMs: 25_000,
    direction: "longer",
  });
  assert.equal(detectDurationMismatch(180_000, 185), null);
});

test("forwards progress semantics to the primitive", async () => {
  const { Progress } = await vite.ssrLoadModule("/components/ui/progress.tsx");
  const html = renderToStaticMarkup(React.createElement(Progress, { value: 37 }));

  assert.match(html, /aria-valuenow="37"/);
  assert.match(html, /aria-valuetext="37%"/);
  assert.match(html, /data-state="loading"/);
});

test("emits chart themes for the starter's media dark mode", async () => {
  const { ChartStyle } = await vite.ssrLoadModule("/components/ui/chart.tsx");
  const html = renderToStaticMarkup(
    React.createElement(ChartStyle, {
      id: "contract",
      config: {
        latency: { theme: { light: "#ffffff", dark: "#000000" } },
      },
    }),
  );

  assert.match(html, /\[data-chart=contract\]/);
  assert.match(html, /@media \(prefers-color-scheme: dark\)/);
  assert.doesNotMatch(html, /\.dark/);
});

test("renders sidebar skeletons deterministically", async () => {
  const { SidebarMenuSkeleton } = await vite.ssrLoadModule(
    "/components/ui/sidebar.tsx",
  );
  const first = renderToStaticMarkup(React.createElement(SidebarMenuSkeleton));
  const second = renderToStaticMarkup(React.createElement(SidebarMenuSkeleton));

  assert.equal(first, second);
  assert.match(first, /--skeleton-width:70%/);
});
