# Releasing

Use this checklist to publish a release manually.

1. Merge the release preparation pull request into `master`.
2. Confirm `package.json` and `package-lock.json` contain the intended version.
3. Run `npm ci` and `npm run check` from a clean checkout of `master`.
4. Review `CHANGELOG.md` and confirm the CI checks for the merge commit pass.
5. Create an annotated tag on that exact merge commit. For this release, use
   `v1.0.0`, then push the tag.
6. Run `npm pack --dry-run` and inspect the files that will ship.
7. Publish manually with npm. Use provenance if it is available for the account.
8. Verify the published package in a fresh consumer project, then create the
   matching GitHub release from the `v1.0.0` tag.

Do not reuse the unpublished `0.4.0` version or create a release tag before the
release pull request has merged.
