# Architecture

## One semantic model, two renderers

The editable template stores topology intent as semantic data. A node chooses a
key such as `core-switch`; it does not contain SVG paths or construct an official
filename. The protected icon map gives that key two explicit render targets:

```text
semantic key -> inline SVG symbol       (editable mode)
             -> literal asset:cisco ID  (portable mode)
```

Editable mode is the default. It renders the inline SVG symbol library and CSS
rack faces without loading external files, and is a finished deliverable in its
own right. Portable mode is enabled only when the packager inserts an asset
vault; it renders the corresponding embedded raster bytes instead.

## Sources of truth

- `symbols/network-symbols.svg` is the canonical vector geometry.
- `symbols/symbol-map.json` is the reviewable semantic-to-renderer mapping.
- `starters/network-design-template.edit.html` is the canonical user template
  and carries synchronized runtime copies of both.
- `examples/vector-symbol-showcase.html` is a synchronized visual QA surface.
- `packager.html` is the packager itself: source in
  the tree, opened directly, with no build step and no artwork inside it.
- `assets/` is the shipped official artwork the packager reads at runtime.

There is deliberately no runtime dependency from the editable HTML to the
standalone sprite or map.

## Protected v2 contract

Every `.edit.html` accepted by the packager must retain these three marker pairs,
in order and exactly once:

```text
NETWORK-PACKAGER-CONTRACT:BEGIN / NETWORK-PACKAGER-CONTRACT:END
NETWORK-ASSET-VAULT:BEGIN       / NETWORK-ASSET-VAULT:END
EDITABLE-SOURCE-CAPSULE:BEGIN   / EDITABLE-SOURCE-CAPSULE:END
```

The script IDs are `network-packager-contract`, `network-asset-vault`, and
`editable-source-capsule`. The immutable contract values are:

```json
{
  "schema": "network-design-package/v2",
  "assetReferences": "asset-uri/v1",
  "assetUriSchemes": {
    "cisco": "icons/cisco-pms3015/",
    "rack": "rack-assets/"
  }
}
```

An editable file keeps the vault exactly `{}` and the capsule empty. A portable
build inserts only the referenced assets into the vault and stores the exact
clean editable source in the capsule for lossless recovery.

Official asset IDs must appear as complete string literals, for example
`asset:cisco/workgroup switch.jpg`. Dynamically assembled filenames are not
discoverable by the packager scanner and are therefore unsupported.

## Artwork boundary

The immutable logical directories in the contract do not dictate repository
layout. They are resolved against whichever artwork root the packager is given:

```text
icons/cisco-pms3015/  -> <artwork root>/icons/cisco-pms3015/
rack-assets/          -> <artwork root>/rack-assets/
```

In this repository that root is `assets/`, which ships populated so a clone can
package immediately. It is not privileged: the packager matches the two canonical
folders by path suffix, so any checkout depth works, and any file supplied by name
resolves even when it sits outside them. That is the supported path for a user's
own artwork, and for replacing the Cisco set entirely.

Resolution order for one identifier is: the official file at its canonical path,
then a uniquely named file anywhere in the selection, then failure. Two different
files sharing a name is reported rather than resolved, because picking one would
silently change what a document depicts.

Portable examples belong under the ignored `dist/` directory because those HTML
files embed the same binary bytes.

## Symbol maintenance

A geometry change is one logical change across three files: canonical sprite,
template, and showcase. A semantic mapping change also updates `symbol-map.json`
and the template map. Run `npm test` after either change. Run the packager build
and verification when local vendor inputs are available.
