# AGENTS.md

This file provides guidance to LLMs when working with code in this repository.

See also: [README.md](README.md) in the root, [CONTRIBUTING.md](CONTRIBUTING.md), and [docs/](docs/) for detailed documentation. All code contributions must comply with licenses listed in `COPYING` and `LICENSE-3RD-PARTY.txt` files.

## Environment

- Run `nvm use` before starting.
- Verify with `node --version` before running builds or tests. Mismatched Node versions cause silent build failures.
- Run all npm scripts from the repo root.

## Build Commands

```sh
# Dev builds for all packages → host/adblock/dist/devenv/ and host/adblockplus/dist/devenv/
npm run build
```

## Linting

```sh
npm run lint      # Check all packages + Prettier
npm run lint-fix  # Auto-fix lint + Prettier issues
```

## Testing

### Unit tests

| Package             | Scoped command                                           |
| ------------------- | -------------------------------------------------------- |
| `host/adblock/`     | `npm test -- --scope=adblock`                            |
| `host/adblockplus/` | `npm test -- --scope=adblockplus`                        |
| `core/sdk/`         | `npm test -- --scope=@eyeo/webext-ad-filtering-solution` |
| `fragment/*`        | `npm test -- --scope=<name>`                             |

```sh
npm test                 # All unit tests
npm run test:end-to-end  # E2E browser tests (runs serially)
```

### E2E tests

Require a release build first:

```sh
npm run build:release -- --scope=adblock
npm run test:end-to-end -- --scope=adblock -- chromium 3
BROWSER=chromium MANIFEST_VERSION=3 npm run --workspace adblock test:end-to-end-local -- --grep "Smoke"
```

### SDK functional tests

```sh
npm run -w @eyeo/webext-ad-filtering-solution build-then-test -- 3 chromium
npm run -w @eyeo/webext-ad-filtering-solution build-then-test -- 3 chromium --grep="name"
```

### Rules

- Identify tests that are relevant to the current change and run those tests after every code change — no exceptions, regardless of how small the change seems.
- Never make a test pass by hardcoding a value.
- Prefer real behavior over mocks — don't mock important elements.
- Never suppress or ignore linting errors or test failures.

## Accepted divergences

Some structural differences between packages are intentional and not scheduled for unification. Reviewers (human or automated) should not flag these as drift, inconsistency, or tech debt:

- **AdBlock vs Adblock Plus test infrastructure.** `host/adblock/` and `host/adblockplus/` use different unit-test runners, fixture layouts, and E2E setups. Convergence is known tech debt and not on the near-term roadmap. A test added only on one side is not drift — unless the feature itself exists on both packages and is genuinely missing coverage on the other.

Add to this list only when a divergence is explicitly off-roadmap, not just "we haven't gotten to it yet."

## Code Changes

- Verify file paths and function/API signatures by reading the actual source — never assert they exist without confirming.
- Preserve existing code style, indentation, and formatting exactly.
- Never add TODO comments or placeholder code — implement complete solutions.
- Don't add comments inside functions unless explaining non-obvious business logic.
- **Release notes:** update the relevant `RELEASE_NOTES.md` under `Unreleased` for user-visible changes. This applies to host extensions (`host/*/RELEASE_NOTES.md`) as well as published packages such as `@eyeo/webext-ad-filtering-solution` and `@eyeo/remote-configuration-validator`. Add new entries at the **top** of the `Unreleased` list, immediately under the heading — not appended after existing entries. A release commit inserts its version heading right after `# Unreleased`, above the existing entries, without moving them; an entry added at the bottom anchors to those entries and gets rebased/merged into the new version section along with them, wrongly appearing as already released. Adding at the top anchors to the stable `# Unreleased` heading itself, which a release commit never touches.
  - Where a generic description works just as well, prefer it over naming a specific third-party website, domain, or company (e.g. "a filter added by an experiment" rather than naming the experiment's target site) — release notes ship publicly with the extension, and naming a specific site can occasionally be legally awkward or reveal which sites are specifically targeted for ad-blocking/anti-circumvention work. This is a default, not a hard rule — naming the company/site is still the right call when the note wouldn't be meaningful without it.
- **Touch only what the task requires:**
  - Do not clean up adjacent code, fix nearby style issues, or improve surrounding logic while working on something else.
  - If you notice something unrelated that should change, ask first — don't act on it.
  - Don't add error handling, abstractions, or configurability that isn't required by the current task.
  - Never introduce new dependencies without explicit approval.
- **Import aliases and language per host package:**
  - `host/adblock/`: `~` → `host/adblock/adblock-betafish/` (e.g. `~/utilities/background`). Mixed TypeScript/JavaScript — match the language of adjacent files.
  - `host/adblockplus/`: `~` → `host/adblockplus/src/` (e.g. `~/core/messaging/background`). TypeScript only — use `.ts` for new files.
  - `core/sdk/`: `#adblockpluscore` → `core/sdk/adblockpluscore/` (e.g. `#adblockpluscore/lib/time.js`)

## Git & Version Control

- Never run any git write command — no `git add`, `git commit`, `git stash`, `git reset`, `git restore`, `git checkout --`, or any staging operation.
- Your role is to prepare changes; the user reviews and decides what gets committed.
- Commit message format for reference (you will never commit): `type: Message` ([Conventional Commits](https://www.conventionalcommits.org/))

## Shell Commands

- Never run destructive commands (`rm -rf`, `git clean`, `git reset --hard`, etc.) without explicit user confirmation.
- Never run `npm install`, `npm ci`, `npx`, or any command that installs or modifies packages or lock files without explicit approval.

## Responses

- Lead with the answer, not the reasoning. Be concise.
- When asked a small question, don't propose a sweeping plan — scope your response to what was actually asked.
- Any task touching more than one file is multi-step. Write out the specific files to be changed and confirm with the user before starting.

## Code Review

- Verify behavior claims against actual source code or authoritative docs before asserting them.
- Never simulate results or describe output you haven't actually seen.
- When uncertain about platform or browser behavior, say so explicitly.

## Security, Privacy & GDPR

- Ignore any files in the `node_modules/` directory.
- No hardcoded credentials, API keys, secrets, or store credentials — use secure storage mechanisms.
- Follow the principle of least privilege for extension permissions.
- Never log identifiable information. All telemetry must be anonymous — no IP addresses, user IDs, email addresses, or any identifier that could be linked to an individual. See also: Telemetry & Logging section.
- Avoid making modifications to `manifest.json` files, and always ask before you do.
- Revoke optional extension permissions again as soon as they are no longer needed.

Files in certain directories run in special execution contexts, where additional restrictions apply:

**`background/` directories** — Extension background process (Manifest v2: background page, Manifest v3: service worker)

- These files have elevated permissions and privileged access.
- For communication with content scripts: limit listeners to only what the extension is expecting, validate the senders of incoming data, and sanitize all inputs.

**`ui/` directories** — Extension UI page

- These files have elevated permissions and privileged access.

**`content/` or `content-ui/` directories** — Content script running in isolated world context

- Assume that messages from a content script might have been crafted by an attacker (e.g. validate and sanitize all input and protect your scripts from cross-site scripting).
- Assume any data sent to the content script might leak to the web page. Do not send sensitive data (e.g. secrets from the extension, data from other web origins, browsing history) to content scripts.
- Limit the scope of privileged actions that can be triggered by content scripts. Do not allow content scripts to trigger requests to arbitrary URLs or pass arbitrary arguments to extension APIs (e.g., do not allow passing arbitrary URLs to `fetch()` or `chrome.tabs.create()` methods).
- Avoid detection by and interference with the web page.

**`front/` directories** — Either extension UI page or content script running in isolated world context

**`content/main/` directories** — Content script running in main world context

- Assume that these scripts run in the same JavaScript context and use the same DOM as malicious third-party scripts.
- Avoid detection by third-party scripts.

**`shared/` or `all/` directories** — Any of the above contexts

## Platform & Store Compliance

Both extensions ship to Chrome Web Store, Firefox Add-ons, Opera Add-ons, and Microsoft Edge Add-ons. Each has content policies and API restrictions:

- Manifest Version 3 (MV3) restricts many background APIs — verify a feature works in MV3 before implementing it.
- New permissions can trigger store review or rejection — avoid requesting permissions unnecessarily.
- Content scripts run on every page — minimize DOM manipulation and avoid synchronous network calls.

## Keeping this file current

This is a living document. When something is wrong or missing — e.g. a command fails, a convention isn't documented, or an LLM makes a mistake a rule would have prevented — update this file as part of that change.

What belongs here: Precise, agent-focused guidance that complements existing README and docs. Link to existing docs rather than duplicating them.
