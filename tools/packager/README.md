# The packager

`network-design-packager.html` **is** the packager. Open it in a browser — no
build, no server, no install. It reads `assets/` from the checkout when you point
it at the folder, and embeds only the images the chosen design actually asks for.

That is a deliberate reversal of how this used to work. The packager was once
generated with every icon baked inside it as Base64, which made it a 17 MB build
artifact: absent from a fresh clone, unusable without Node, and impossible to
commit without growing the history by another copy on every rebuild. Reading the
folder at runtime costs one extra click and removes all three problems.

## What it guarantees

- Only two regions ever change: `NETWORK-ASSET-VAULT` and `EDITABLE-SOURCE-CAPSULE`.
  Every other byte is compared before you can download the result.
- The editable source is recovered from the file it just built and compared to the
  input, so a packaged file can always hand back the design that made it.
- Each image is checked against its own file signature and SHA-256 before it is
  embedded. A JPEG offered where a PNG belongs is refused by name.
- Missing and ambiguous artwork is reported as a list up front, never at build time
  and never silently.

## Maintainer scripts

Optional, and not needed by anyone using the packager:

```bash
npm run build:packager     # regenerate dist/examples/*.portable.html from assets/
npm run verify:packager    # QA report: byte parity, capsule recovery, blob hashes
```

`build-packager.js` packages two fixtures the same way the browser does, so a
contract change that the browser would break also fails in CI. `verify-packager.js`
additionally asserts the packager has not drifted back into a built artifact: no
build tokens, no embedded artwork, and a byte ceiling.

Both write into `dist/`, which is Git-ignored — those outputs embed third-party
artwork from `assets/` and are reproducible from the tree. Do not redistribute
them without reading [`../../THIRD_PARTY_NOTICES.md`](../../THIRD_PARTY_NOTICES.md) first.
