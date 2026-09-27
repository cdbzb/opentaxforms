# Sharing the prototype

The repository contains application code and synthetic test examples. Taxpayer
drafts live in browser storage or user-downloaded JSON files; do not commit
those exports. Root-level `opentaxforms-*.json` files are ignored by Git.

## GitHub Pages

The manual **Publish demo** GitHub Actions workflow tests the application,
checks vendored source attribution, builds under the repository's URL prefix,
and publishes only `dist/`. Pushing code runs checks but does not deploy a site.

To enable publishing, select **GitHub Actions** as the source under the
repository's **Settings → Pages**. Then run **Actions → Publish demo → Run
workflow**. The completed deployment reports its public URL. This workflow
assumes a project site at `https://OWNER.github.io/REPOSITORY/`, not a custom
domain or a user-site repository.

The shared site is a limited prototype, not filing software. Visitors get their
own local draft. Sharing the URL does not share your saved return. Browser
storage belongs to the site's origin: the localhost draft does not automatically
appear on the hosted site, or vice versa. No taxpayer database, account, API
key, analytics, or AI connection is deployed.

The hosting provider still serves the site assets and can receive ordinary
web requests. The app keeps entered tax values in browser storage and performs
its calculations on the device. Do not add tax values to URLs or GitHub issues.

Before describing a release as browser-verified, complete the outstanding
visual, keyboard, print and network checks in `prototype-validation.md`.
