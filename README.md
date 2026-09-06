# SameBeat

SameBeat listens to a short sample of a nearby song, identifies the recording and its current timestamp, then starts the user's own legal stream near that same moment.

## Continue with an AI coding assistant

- Shared project state and roadmap: [`docs/AI_CONTINUATION_GUIDE.md`](docs/AI_CONTINUATION_GUIDE.md)
- ChatGPT/Codex: [`CHATGPT.md`](CHATGPT.md) and [`AGENTS.md`](AGENTS.md)
- GitHub Copilot: [`.github/copilot-instructions.md`](.github/copilot-instructions.md)
- Grok: [`GROK.md`](GROK.md)
- Perplexity: [`PERPLEXITY.md`](PERPLEXITY.md)

## What works in this MVP

- Installable web app for Android and desktop browsers.
- Eight-second microphone capture with explicit permission.
- Server-side AudD recognition; audio is not persisted by this codebase.
- Match result with track, artist, album art, duration, and estimated source offset.
- Live catch-up clock that keeps advancing after recognition.
- Network-delay catch-up calculation and half-second fine-sync controls.
- YouTube/YouTube Music resolution through Songlink/Odesli, with optional YouTube Data API fallback.
- In-page YouTube playback at the calculated timestamp with measured drift and one-tap resynchronization.
- Spotify Authorization Code + PKCE connection and Premium playback seek on an active Spotify device.
- Pandora exact-playback adapter boundary and honest partner-access fallback.

The public AudD `test` token is used only when `AUDD_API_TOKEN` is absent and is limited to 10 requests per day. Production use needs a dedicated token.

## Runtime settings

| Setting | Required | Purpose |
| --- | --- | --- |
| `AUDD_API_TOKEN` | Production | Recognizes the recording and returns a timecode. |
| `YOUTUBE_API_KEY` | Optional | Finds an official YouTube audio when cross-platform mapping has no result. |
| `SPOTIFY_CLIENT_ID` | Spotify only | Enables Spotify PKCE sign-in and precise seek for Premium users. |

For Spotify, add the deployed root URL with a trailing slash as an allowed redirect URI in the Spotify developer dashboard.

## Timing model

`playback target = recognized song offset + elapsed time after capture + user calibration`

Recognition APIs estimate a point in the sampled recording. Network and player startup latency are added before playback. YouTube starts at whole-second precision. The fine-sync controls compensate for different masters, music-video intros, room echo, and device buffering.

## Provider realities

- **YouTube Music / YouTube:** best MVP path. A matched YouTube Music URL is played through the official YouTube embedded player.
- **Spotify:** technically supports `position_ms`, but playback control requires Premium, an active device, developer configuration, and compliance review. Spotify's current platform rules make a public synchronized-listening product a policy risk; legal/platform review is required before public launch.
- **Pandora:** exposes search and playback APIs to approved partners. Public exact-seek launch depends on Pandora partner acceptance and certification.

## Android release path

The shipped PWA installs from Chrome on Android. A Play Store build can wrap the same deployed origin as a Trusted Web Activity after the production domain, icons, privacy policy, and API credentials are finalized. A native Kotlin capture client is a later option if background recognition, lower latency, or tighter audio control becomes necessary.

## Privacy baseline

- Capture begins only after a button press and system microphone approval.
- The app records approximately eight seconds.
- The app code does not save the clip, account history, or recognition result.
- A production privacy policy must also describe the recognition provider's processing and retention terms.
