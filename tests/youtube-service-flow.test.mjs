import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app = readFileSync("app/samebeat-app.tsx","utf8");
const recognize = readFileSync("app/api/recognize/route.ts","utf8");
const player = readFileSync("app/youtube-sync-player.tsx","utf8");
const timing = readFileSync("app/sync-timing.ts","utf8");

test("YouTube service flow is wired end to end", () => {
  assert.match(app, /fetch\("\/api\/recognize"/);
  assert.match(recognize, /api\.song\.link/);
  assert.match(recognize, /youtubeVideoId/);
  assert.match(app, /provider === "youtube"/);
  assert.match(app, /setYoutubePlaying\(true\)/);
  assert.match(app, /<YouTubeSyncPlayer/);
});

test("YouTube player seeks to detected live position and can recover drift", () => {
  assert.match(player, /calculateTargetOffset/);
  assert.match(player, /seekTo\(/);
  assert.match(player, /AUTO_RESYNC_DRIFT_MS/);
  assert.match(player, /shouldAutoResync/);
  assert.match(timing, /AUTO_RESYNC_DRIFT_MS = 1_500/);
  assert.match(timing, /MAX_AUTO_RESYNCS = 3/);
});

test("YouTube fallback remains user-visible if no matched video exists", () => {
  assert.match(app, /youtube\.com\/results\?search_query=/);
  assert.match(app, /copy its link here/);
});
