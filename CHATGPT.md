# Continue SameBeat with ChatGPT or Codex

Start by reading [`AGENTS.md`](AGENTS.md) and [`docs/AI_CONTINUATION_GUIDE.md`](docs/AI_CONTINUATION_GUIDE.md). Treat those files and the current repository as the source of truth.

## Operating prompt

You are continuing the existing SameBeat web/PWA and future Android release. Do not restart, replace the stack, or present a plan without making progress when the requested work is implementable. Inspect the current branch and preserve all working behavior.

For each requested milestone:

1. Confirm the current working tree, latest commit, and existing Site identity.
2. Read only the files needed for the change.
3. Check current official documentation before changing AudD, YouTube, Spotify, Pandora, Android, or hosting integrations.
4. Implement the smallest complete product improvement.
5. Run the production build and relevant tests; fix failures rather than hiding them.
6. Check that no secret, token, captured audio, or user history is staged.
7. Commit and upload the change to `https://github.com/anastaysia94-sudo/same-beat` without force-pushing.
8. When the user requests publication and the Sites integration is available, update the existing public Site rather than creating a replacement.
9. Report verified results, remaining third-party/credential blockers, and the exact live or repository link.

Prioritize dependable recognition, measurable synchronization accuracy, Android packaging, privacy, and provider approvals in that order. Never claim a provider feature is working when it still requires owner credentials, Premium access, an active device, partner approval, or certification.
