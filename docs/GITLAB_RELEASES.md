# What should happen

- Releases should automatically be created based on a pushed tag (adblock-x.x.x or adblockplus-x.x.x)
- This release is created by the Gitlab CI pipeline (create_release) for the tag
- You should have a release in the repo's releases page that contains assets and the correct release notes

# If something goes wrong you can manually create the release by following these steps

1. Publish [new GitLab release](https://gitlab.com/eyeo/extensions/extensions/-/releases/new).
1. Enter information:
   - Tag name: `<PRODUCT ID>-<VERSION>` (e.g. `adblock-6.1.0`)
   - Release title: `<PRODUCT NAME> <VERSION>` (e.g. `AdBlock 6.1.0`)
   - Release date: Today's date
   - Release notes: Release notes summary and items from host/\<PRODUCT ID\>/RELEASE_NOTES.md file
   - Add release assets
     - Add a "## Builds" heading to the end of the current release notes.
     - Drag and drop the release artifacts under the "## Builds" heading. This should upload the files and put a URL in the text area.
     - Add a link/asset for each artifact into the "Release assets" section. The URL would be the URL generated in the previous step.
1. Click "Create release" button.

# Uploading to the stores from the release pipeline

Once the release exists, the tag pipeline offers manual jobs that upload the
release's builds to the stores and submit them for review. They replace the
upload and submit steps of the
[Host release process](https://gitlab.com/eyeo/browser-extensions-and-premium/extensions/extensions/-/wikis/Host-release-process).
If a job isn't available or fails, upload by hand as described in the wiki.

The jobs become available once `create_release` has passed.

Stores sometimes fail an upload without giving a reason and accept the same
package on a later attempt. The jobs therefore try an upload up to 10 times,
a minute apart, and log every failed attempt. Errors that won't go away, like
an expired API key or a package with the wrong version, fail the job at once.

## Chrome Web Store

1. In the tag pipeline, start the `upload_chrome_web_store` job.
2. The job downloads `<PRODUCT ID>-chrome-<VERSION>-mv3.zip` from the
   GitLab release, checks that its `manifest.json` has `<VERSION>`, uploads
   it and submits it for review. The version is published automatically once
   it's approved.
3. In the [developer dashboard](https://chrome.google.com/webstore/developer/dashboard),
   check that the item's status is "Pending review".

## Microsoft Edge Add-ons

1. In the tag pipeline, start the `upload_edge_add_ons` job.
2. The job downloads `<PRODUCT ID>-chrome-<VERSION>-mv3.zip` from the
   GitLab release, checks that its `manifest.json` has `<VERSION>`, uploads
   it to the product's draft, waits until Edge has verified the package and
   publishes the draft, without notes for testers. Edge then starts the
   certification.
3. In [Partner Center](https://partner.microsoft.com/en-us/dashboard/microsoftedge/overview),
   check that the review has started.

Edge authenticates with an API key instead of a service account. The secrets
`edge-adblock-credentials` and `edge-abp-credentials` hold a JSON object with
the product ID, client ID and API key; see
`tools/release/stores/edge/config.js`. **API keys expire after 72 days.** To
rotate one, create a new key in Partner Center → Microsoft Edge → Publish API
and add a new secret version with the whole object.

| The error mentions                             | Likely cause                                                                                                |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `api.addons.microsoftedge.microsoft.com` (401) | The API key has expired or is wrong                                                                         |
| `[edge] InProgressSubmission`                  | The previous version is still in certification; publish the uploaded draft in Partner Center once it's done |
| `[edge] FailedWithoutCode`                     | Edge failed all 10 attempts without a reason; upload in Partner Center                                      |
| `[edge] <other code>`                          | Edge rejected the package; check Partner Center                                                             |

## Firefox Add-ons

Not needed for rules-only releases.

1. In the tag pipeline, start the `upload_firefox_add_ons` job.
2. The job downloads `<PRODUCT ID>-firefox-<VERSION>-mv2.xpi` and
   `<PRODUCT ID>-<VERSION>.tar.gz` from the GitLab release, checks that the
   xpi's `manifest.json` has `<VERSION>`, uploads it and waits for AMO's
   validation.
3. If there are no validation errors and only the accepted warnings (see
   `tools/release/stores/firefox/upload.js`), the job submits the
   version for review. It sets the release notes from `RELEASE_NOTES.md`,
   the notes for reviewers from `STORE_LISTING.md` and, for Adblock Plus,
   Firefox for Android compatibility, then attaches the source code.
4. Check the version in the
   [AMO developer hub](https://addons.mozilla.org/en-US/developers/addons).

AMO has no drafts, so the job checks everything it can before submitting.

Both add-ons are uploaded with the API key of one AMO account, so a single
secret, `amo-credentials`, holds the JWT issuer and secret and each host's
add-on; see `tools/release/stores/firefox/config.js`. The account has to have
accepted AMO's distribution agreement.

| The error mentions                 | Likely cause                                                           |
| ---------------------------------- | ---------------------------------------------------------------------- |
| `addons.mozilla.org` (401)         | The JWT issuer or secret is wrong, or the runner's clock is off        |
| `addons.mozilla.org` (429)         | AMO throttled the uploads; try again later                             |
| `[amo] ValidationFailed`           | The package has validation errors; nothing was submitted               |
| `[amo] UnexpectedWarnings`         | Validation reported a new kind of warning; nothing was submitted       |
| `attaching the source code failed` | Upload the `.tar.gz` to the version in the developer hub before review |

## How the jobs authenticate

The jobs hold no store credentials. GitLab issues each job an ID token,
which the Google Cloud project `eyeo-extensions` accepts only for protected
`adblock-*` and `adblockplus-*` tags of this project (Workload Identity
Federation). With it, the job reads the host's store configuration from
Secret Manager and, for the Chrome Web Store, acts as the host's service
account.

| Store            | Secret                                           | Service account          |
| ---------------- | ------------------------------------------------ | ------------------------ |
| Chrome Web Store | `cws-adblock-credentials`, `cws-abp-credentials` | `cws-adblock`, `cws-abp` |

Each secret holds a JSON object with the publisher ID, item ID and service
account; see `tools/release/stores/chrome/config.js`. Each service account
has to be added to its publisher in the developer dashboard.

## Troubleshooting

| The error mentions                            | Likely cause                                                           |
| --------------------------------------------- | ---------------------------------------------------------------------- |
| `sts.googleapis.com`                          | The pipeline isn't for a protected release tag of this project         |
| `secretmanager.googleapis.com` (403 or 404)   | The job's identity can't read the secret, or the secret has no version |
| `iamcredentials.googleapis.com` (403)         | The job's identity can't act as the service account                    |
| `chromewebstore.googleapis.com` (403)         | The service account isn't added to the publisher                       |
| `contains version X, but Y is being released` | The release has the wrong build; don't upload it                       |
| `[chrome-web-store] FAILED`                   | The store rejected the package; check the developer dashboard          |
