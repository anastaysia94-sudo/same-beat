# SameBeat agent instructions

These instructions apply to the entire repository. ChatGPT, Codex, and any other coding agent must read [`docs/AI_CONTINUATION_GUIDE.md`](docs/AI_CONTINUATION_GUIDE.md) before changing the project.

## Working rules

- Continue the existing product; do not scaffold a replacement app.
- Preserve the Vinext/Next.js-compatible structure, Cloudflare Worker output, package manager, lockfile, and `.openai/hosting.json` project identity.
- Treat the microphone-to-synchronized-playback flow as the primary product. Keep it visible and usable on the first screen.
- Never commit API keys, OAuth secrets, access tokens, captured audio, or user listening history.
- Do not claim Pandora exact seeking works without approved Pandora partner access.
- Do not claim Spotify playback works without a configured client ID, Premium account, active device, and any required platform approval.
- Do not replace legal provider playback with copied, proxied, downloaded, or redistributed music.
- Keep microphone capture opt-in and stop every media track after each short sample.
- Use current official provider documentation before changing an external API integration.
- Make focused changes, run the build and tests, and report failures honestly.
- Never force-push or rewrite `main` unless the owner explicitly requests it.

## Required validation

```bash
npm ci
npm run build
node --test tests/*.test.mjs
```

For changes to capture or playback, also manually verify the HTTPS app on Android Chrome with microphone permission, a clearly audible song, and the embedded YouTube player.

## Platform handoffs

- ChatGPT/Codex: [`CHATGPT.md`](CHATGPT.md)
- GitHub Copilot: [`.github/copilot-instructions.md`](.github/copilot-instructions.md)
- Grok: [`GROK.md`](GROK.md)
- Perplexity: [`PERPLEXITY.md`](PERPLEXITY.md)
