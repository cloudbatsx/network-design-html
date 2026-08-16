# Official artwork

This is the folder you point the packager at.

```text
assets/
  icons/cisco-pms3015/   294 Cisco topology icon JPGs
  rack-assets/            10 front/rear rack face PNGs
```

Nothing here is needed to *design*. Every template and starter renders completely
on its own vector symbols, offline, with no images at all. This artwork exists for
one step: [`../packager.html`](../packager.html)
embeds it into a `.portable.html` so the finished document carries official
pictures instead of vector stand-ins.

## The two folder names are part of the contract

Every compliant design declares an immutable mapping in its contract block:

```json
"assetUriSchemes": { "cisco": "icons/cisco-pms3015/", "rack": "rack-assets/" }
```

That is why the directory names above are not a matter of taste. `asset:cisco/x.jpg`
resolves to `icons/cisco-pms3015/x.jpg`; `asset:rack/y.png` resolves to
`rack-assets/y.png`. The packager finds those two folders wherever the checkout
lives, so the path above them does not matter.

**Filenames are case-sensitive**, spaces and all — `layer 3 switch.jpg` is a real
and correct name. Never rename, URL-encode, or add directories to an identifier.

## Adding your own artwork

Two ways, both supported:

- **Drop it into the packager.** Add loose `.jpg` / `.png` files in step 1. They are
  matched to identifiers by exact filename, wherever they came from.
- **Keep it in these folders.** A `.jpg` here is reachable as `asset:cisco/<name>.jpg`
  and a `.png` in `rack-assets/` as `asset:rack/<name>.png`.

Then point one device at it, leaving every other device alone:

```json
{ "id": "core-sw-01", "icon": "core-switch", "iconAsset": "asset:cisco/acme-9500.jpg" }
```

`icon` still drives the vector drawing you edit with; `iconAsset` only changes what
the packaged file shows. If two different files share one filename, the packager
says so instead of guessing.

## Replacing the Cisco set entirely

Delete both folders and supply your own. Designs keep rendering — they never load
these images while you are editing — and the packager will happily build from a
folder containing nothing but your artwork, as long as the filenames match the
identifiers the design asks for.

## Licensing

This artwork is **not** covered by the project's MIT licence. It is included
unmodified from third-party sources. Read [`../THIRD_PARTY_NOTICES.md`](../THIRD_PARTY_NOTICES.md)
before redistributing this repository or anything built from it.
