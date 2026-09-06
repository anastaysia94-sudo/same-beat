# GitHub Copilot instructions for SameBeat

Read `AGENTS.md` and `docs/AI_CONTINUATION_GUIDE.md` before proposing edits.

- Work inside the existing Vinext/React/TypeScript application.
- Preserve the Cloudflare Worker build, `.openai/hosting.json`, `package-lock.json`, PWA behavior, and current visual system.
- Keep the tap-to-listen and join flow as the first-screen product surface.
- Reuse the timing calculation and the YouTube IFrame API integration; do not create a competing player implementation.
- Keep browser-only APIs inside client components and provider credentials inside server runtime bindings.
- Never suggest or generate committed secrets, client secrets, copied music, audio storage, unsupported Pandora seek behavior, or Spotify capability claims that exceed the official API.
- Prefer explicit TypeScript types, small pure timing helpers, bounded network timeouts, understandable errors, accessible labels, and touch-friendly controls.
- Clean up media streams, intervals, global callbacks, and player instances on unmount or failure.
- Add or update product-specific tests when behavior changes. Avoid tests for unused starter components.
- Validate with `npm run build` and `node --test tests/*.test.mjs`.
- Keep commits focused and never force-push `main`.

Current core files:

- `app/samebeat-app.tsx`
- `app/youtube-sync-player.tsx`
- `app/api/recognize/route.ts`
- `app/api/spotify/token/route.ts`
- `app/globals.css`
