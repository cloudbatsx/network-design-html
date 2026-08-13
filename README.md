# Network Design HTML

Create readable, self-contained network diagrams as ordinary HTML files. The
default workflow uses an inline SVG symbol library, so an editable diagram opens
directly in a browser, travels as one lightweight file, prints cleanly, and
produces useful line-by-line Git history.

The same semantic diagram data can optionally be sent through the local packager
to replace vector placeholders with embedded official raster assets. This keeps
the easy editing workflow separate from the heavier publication workflow.

## Start here

1. Copy [`templates/network-design-template.edit.html`](templates/network-design-template.edit.html).
2. Change the clearly marked diagram data, labels, layout, and styles. For an AI
   editor, also supply [`docs/gemini-editing-rules.md`](docs/gemini-editing-rules.md).
3. Open the resulting `.edit.html` in any current browser. It needs no server,
   package install, adjacent icon folder, or network connection.
4. Run `npm test` before sharing a template change.

Topology nodes choose stable semantic keys such as `access-switch`, `router`, or
`wlan-controller`. Detailed SVG geometry and official asset filenames stay
outside the ordinary editing surface.

## Optional official-asset build

Official Cisco JPGs and local rack PNGs are not part of this repository. If you
have reviewed and supplied them under `vendor-local/`, run:

```text
npm run build:packager
npm run verify:packager
```

This creates `dist/network-design-packager.html` and tested self-contained
`.portable.html` examples. Both `vendor-local/` and generated `dist/` artifacts
are Git-ignored because they may contain third-party binary artwork.

## Repository layout

```text
templates/             canonical editable hybrid template
symbols/               canonical SVG sprite and semantic map
examples/              source-controlled vector showcase
docs/                  architecture and AI-editing contract
tools/packager/         reproducible optional packager source
tools/                  local Cisco filename catalog
scripts/                source validation
tests/fixtures/         alternate editable contract fixture
vendor-local/           optional untracked binary inputs
dist/                   generated untracked outputs
```

See [`docs/architecture.md`](docs/architecture.md) for the protected packaging
contract and synchronization rules, and [`CONTRIBUTING.md`](CONTRIBUTING.md)
before changing symbol geometry.

## Publication status

This is a pre-release working repository. The vector symbols are experimental
interpretations informed by Cisco reference silhouettes, not official
Cisco-distributed SVG files. No project license has been selected, and the
third-party/artwork review is not complete. Do not treat the current tree as
permission to redistribute Cisco artwork or close derivatives; see
[`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).

This project is independent and is not affiliated with or endorsed by Cisco.
