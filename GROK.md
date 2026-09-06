# Continue SameBeat with Grok

Read [`AGENTS.md`](AGENTS.md) and [`docs/AI_CONTINUATION_GUIDE.md`](docs/AI_CONTINUATION_GUIDE.md) completely before acting.

Continue the existing repository on its current branch. Base technical claims about AudD, YouTube, Spotify, Pandora, Android, and Cloudflare Workers on current official documentation. Separate verified behavior from proposed behavior and from features blocked by credentials or provider approval.

When asked to continue:

1. Inspect the repository and identify the highest-impact unfinished item in the canonical roadmap.
2. Implement it in the current architecture without discarding working UI or provider fallbacks.
3. Protect microphone privacy, credentials, legal playback paths, and honest provider limitations.
4. Build and run the test suite.
5. Review the staged diff for secrets and unintended generated files.
6. Commit and push to `https://github.com/anastaysia94-sudo/same-beat` without rewriting history.
7. State exactly what was verified and what still depends on the owner or a third party.

Do not equate numerical player drift with real acoustic synchronization. Do not promise exact Pandora playback, universal Spotify playback, or production AudD capacity until each is actually configured and verified.
