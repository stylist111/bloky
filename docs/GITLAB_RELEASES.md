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
release's builds to the stores. They replace the upload steps of the
[Host release process](https://gitlab.com/eyeo/browser-extensions-and-premium/extensions/extensions/-/wikis/Host-release-process);
submitting for review still happens in each store's dashboard. If a job isn't
available or fails, upload by hand as described in the wiki.

The jobs become available once `create_release` and the `adblock` and
`adblockplus` child pipelines have passed, because the child pipelines check
the extensions' permissions.

## Chrome Web Store

1. In the tag pipeline, start the `upload_chrome_web_store` job.
2. The job downloads `<PRODUCT ID>-chrome-<VERSION>-mv3.zip` from the
   GitLab release, checks that its `manifest.json` has `<VERSION>`, and
   uploads it as a draft.
3. In the [developer dashboard](https://chrome.google.com/webstore/developer/dashboard),
   check that the new version is shown and submit it for review.

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
