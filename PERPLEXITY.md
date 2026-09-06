# Continue SameBeat with Perplexity

Read [`AGENTS.md`](AGENTS.md) and [`docs/AI_CONTINUATION_GUIDE.md`](docs/AI_CONTINUATION_GUIDE.md) first.

Use Perplexity's research strength to support implementation, not to replace it with a generic report. For any external API, platform policy, Android requirement, or privacy claim:

- Prefer current first-party documentation.
- Record the source URL and access date in the work summary when it materially affects a decision.
- Mark conclusions as verified fact, implementation observation, inference, or open requirement.
- Do not infer provider approval, credentials, quotas, pricing, or legal permission.

Then continue the codebase directly:

1. Inspect the current branch and relevant implementation files.
2. Choose the highest-priority unblocked milestone from the canonical guide.
3. Preserve the existing Vinext/Cloudflare/PWA architecture and visual design.
4. Implement, build, and run `node --test tests/*.test.mjs`.
5. Check for secrets and generated artifacts.
6. Commit and push to `https://github.com/anastaysia94-sudo/same-beat` without force-pushing.
7. Clearly distinguish the GitHub upload from the separate live Sites deployment.

If Sites access is unavailable, do not claim the public app was updated. Leave a clean GitHub commit and provide exact deployment steps or identify the required owner action.
