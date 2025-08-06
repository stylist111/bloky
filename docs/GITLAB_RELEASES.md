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
