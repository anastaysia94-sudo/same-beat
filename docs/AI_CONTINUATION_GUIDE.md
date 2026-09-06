# SameBeat AI continuation guide

This is the canonical handoff for any AI or developer continuing SameBeat. Read the repository before proposing a rebuild.

## Product goal

SameBeat listens to a short sample of a song already playing nearby, identifies the recording and its current position, then starts the user's own authorized provider playback near that same point. The core timing model is:

```text
target position = recognized song position + elapsed time since capture + user fine adjustment
```

The user should be able to open the app, choose a provider, tap the microphone once, receive a match, and join the song without navigating through a marketing page.

## Current verified state — September 6, 2026

- Public web/PWA: https://samebeat-sync.anastaysia98.chatgpt.site
- GitHub: https://github.com/anastaysia94-sudo/same-beat
- Default branch: `main`
- Installable from Chrome on Android as a PWA.
- Captures about eight seconds only after explicit microphone approval.
- Sends the clip server-side to AudD for identification and timestamp estimation.
- Resolves provider links through Songlink/Odesli, with optional YouTube Data API fallback.
- Computes network-delay catch-up continuously after recognition.
- Embeds YouTube with the official IFrame Player API.
- Reads actual YouTube player time, reports drift, supports half-second nudges, and provides one-tap resynchronization.
- Supports Spotify Authorization Code with PKCE and `position_ms` playback when configured and allowed.
- Opens Pandora matches/search honestly; exact automatic Pandora seeking is not implemented without partner approval.
- Does not persist captured audio, recognition results, or listening history in this codebase.
- The production build passes and the product-specific test suite passes.

The public app may fall back to AudD's shared `test` token, which is limited to 10 requests per day. That is suitable only for limited evaluation, not dependable production use.

## Architecture

| Area | Main files | Responsibility |
| --- | --- | --- |
| Product UI | `app/samebeat-app.tsx` | Capture flow, provider selection, match display, timing target, Spotify flow, install prompt |
| Live YouTube sync | `app/youtube-sync-player.tsx` | IFrame API loading, player creation, drift measurement, nudging, resync |
| Recognition API | `app/api/recognize/route.ts` | AudD request, timecode parsing, metadata, Songlink resolution, YouTube fallback |
| Public runtime config | `app/api/config/route.ts` | Returns only the Spotify client ID when configured |
| Spotify token exchange | `app/api/spotify/token/route.ts` | PKCE authorization-code exchange and redirect-origin validation |
| Brand/responsive UI | `app/globals.css` | Mobile/desktop layout, capture animation, results, player and sync states |
| PWA | `public/manifest.webmanifest`, `public/sw.js`, `app/pwa-register.tsx` | Installation and service-worker registration |
| Hosting identity | `.openai/hosting.json` | Existing ChatGPT Sites project identity; preserve it |
| Verification | `tests/*.test.mjs` | Built product, route, PWA, sync UI, and component checks |

Hosted server code runs as a Cloudflare Worker. Keep `export const runtime = "edge"` where needed and preserve the existing Worker-compatible build.

## Environment variables

Names belong in `.env.example`; real values must stay in local or hosting secrets.

| Variable | Status | Purpose |
| --- | --- | --- |
| `AUDD_API_TOKEN` | Required for dependable production recognition | Identifies the recording and returns a timecode |
| `YOUTUBE_API_KEY` | Optional | Finds an official YouTube audio when mapped links are missing |
| `SPOTIFY_CLIENT_ID` | Required only for Spotify connection | Enables public-client PKCE authorization; this is not a client secret |

Never add `SPOTIFY_CLIENT_SECRET`. This implementation is intentionally a public PKCE client. Never return recognition or provider secrets from `/api/config`.

For Spotify, the exact deployed root URL with a trailing slash must be registered as an allowed redirect URI:

```text
https://samebeat-sync.anastaysia98.chatgpt.site/
```

## Non-negotiable behavior

1. Ask for microphone access only after a clear user gesture.
2. Stop all `MediaStream` tracks after capture, failure, or cancellation.
3. Do not store or log the audio sample.
4. Keep upstream error messages understandable and avoid exposing provider internals or credentials.
5. Clamp calculated positions to valid track bounds.
6. Account for the time spent recognizing, resolving, loading, and buffering before playback.
7. Keep an honest distinction between estimated source time and measured player time.
8. Preserve a manual YouTube-link fallback when automatic version matching fails.
9. Keep provider limitations visible; do not simulate unsupported success.
10. Use authorized embeds/APIs and comply with provider terms.

## Known limitations

- Recognition reliability is constrained by room noise, volume, microphone quality, and AudD quota.
- AudD's timecode is an estimate; different masters, live recordings, edits, and music-video intros can create a fixed offset.
- YouTube seeks near the requested position and may land on a nearby keyframe.
- Browser autoplay rules can require the user to tap the native YouTube play control.
- Numerical drift compares provider playback time with the calculated target; it does not acoustically compare two devices in real time.
- Spotify requires Premium and an active Spotify playback device, and public product use may require platform review.
- Pandora exact playback/seek requires approved partner access.
- A Play Store APK/AAB has not yet replaced the installable Android PWA.

## Priority roadmap

Work in this order unless the owner changes priorities.

### P0 — Production recognition

- Obtain an owner-provided AudD production token; never fabricate or expose one.
- Configure it in the hosted environment and test real recognition across several clean recordings.
- Add clear quota/availability diagnostics without revealing the credential.

### P1 — Sync accuracy and recovery

- Test recognized timecodes against multiple official recordings.
- Detect or explain likely version mismatches, especially videos with long intros.
- Improve calibration only with measured evidence; do not claim acoustic lock-step synchronization without implementing it.
- Preserve manual half-second nudging and one-tap resync.

### P1 — Android release

- Package the verified HTTPS PWA as a Trusted Web Activity only after the production domain and app identity are stable.
- Add Digital Asset Links, Android microphone/network declarations, signing configuration, privacy disclosures, and store assets.
- Produce both a signed release-ready AAB and a directly installable APK when signing credentials and release ownership are available.
- Do not hardcode provider secrets in the Android package.

### P1 — Privacy and launch operations

- Publish a privacy policy that covers SameBeat plus AudD/provider processing and retention.
- Add user-facing support and provider-status guidance.
- Add privacy-preserving operational monitoring only if requested; do not collect audio or listening history by default.

### P2 — Provider expansion

- Finish Spotify configuration and approval work with an owner-controlled developer application.
- Implement Pandora exact seeking only after documented partner authorization.
- Add another provider only through its official supported playback path.

## Development workflow

Use Node.js 22.13 or newer and preserve `package-lock.json`.

```bash
npm ci
npm run build
node --test tests/*.test.mjs
```

Useful checks before committing:

```bash
git diff --check
git status --short
git diff --stat
```

Do not edit `dist/` manually. It is build output. Do not commit `node_modules`, `.env`, access tokens, captured samples, or temporary archives.

## GitHub and deployment rules

- Commit focused changes to `main` or a short-lived feature branch.
- Pull/reconcile current work before updating shared branches.
- Never force-push or erase history without explicit owner approval.
- Scan the staged change for credentials before pushing.
- GitHub and the live Site are separate publication surfaces. A GitHub commit does not prove that the Site deployed.
- ChatGPT Work with the Sites integration should preserve the existing project ID, build, save a new version, deploy it to the current public audience, and verify a successful deployment response.
- An AI without access to Sites should commit and push to GitHub, then state clearly that the live deployment was not changed.
- Never invent a successful build, test, upload, provider approval, or deployment.

## Definition of done for any milestone

- The core tap-to-listen flow remains obvious on mobile and desktop.
- The project builds successfully.
- Relevant tests pass and reflect SameBeat rather than unused starter behavior.
- No secrets or user audio are committed.
- README and this guide are updated when behavior or limitations change.
- GitHub contains the exact intended source changes.
- If deployment was requested, the Sites response confirms success at the public URL.
- The handoff states what changed, what was verified, and what still requires owner credentials or third-party approval.
