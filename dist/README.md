# Generated output

This directory is intentionally excluded from Git except for this note.

Nothing here is required. The packager is source in the tree at
[`../tools/packager/network-design-packager.html`](../tools/packager/network-design-packager.html)
and needs no build step — open it, point it at `assets/`, and it produces a
portable file directly.

These maintainer commands regenerate the packaged examples and the QA report:

```text
npm run build:packager
npm run verify:packager
```

The outputs embed third-party artwork from `assets/`, which is why they stay
untracked and should not be redistributed without reading
[`../THIRD_PARTY_NOTICES.md`](../THIRD_PARTY_NOTICES.md).
