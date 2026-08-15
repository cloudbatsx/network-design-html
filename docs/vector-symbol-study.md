# Vector symbol study

[`../examples/vector-symbol-showcase.html`](../examples/vector-symbol-showcase.html)
is the retained visual study for the canonical 19-symbol library. It combines a
dense arbitrary topology with enlarged symbol cards so silhouette, orientation,
line weight, and small details can be reviewed independently.

## Result

For logical topology diagrams, reusable inline SVG symbols provide the strongest
default architecture found during the study:

- one self-contained editable HTML file;
- crisp scaling and printing without raster payloads;
- semantic keys suitable for lower-capability AI editors;
- reusable `<symbol>` definitions with small `<use>` instances;
- line-by-line source control for both topology data and artwork;
- an optional path to official raster substitution through the existing v2
  packager contract.

The canonical library currently contains cloud, routing, security, switching,
wireless, endpoint, voice, data, storage, management, and site-context symbols.
The older seven-symbol geometry study is retained only in the external project
archive; it is not another source of truth.

## Validation target

The repository validator confirms that the sprite embedded in the editable
template and this showcase matches `symbols/network-symbols.svg`, that all 19
symbol IDs are unique, and that neither source contains raster image payloads.

## Licence

The library is original work, MIT licensed with the rest of the project. It is
free to reuse on its own; see [`../symbols/README.md`](../symbols/README.md) for
how to inline it elsewhere. Only the vendor artwork under `assets/` sits outside
that grant — see [`../THIRD_PARTY_NOTICES.md`](../THIRD_PARTY_NOTICES.md).
