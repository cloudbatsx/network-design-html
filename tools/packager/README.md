# Optional packager build

`packager-template.html` is the source-controlled browser UI. The build script
inserts the clean editable fixtures and the ignored local binary vault to produce
`../../dist/network-design-packager.html`.

From the repository root, with `vendor-local/` populated:

```text
npm run build:packager
npm run verify:packager
```

The verifier confirms exact editable-source recovery, preservation of all bytes
outside the protected vault/capsule regions, embedded blob hashes, and expected
asset counts. All outputs and the QA report stay under the ignored `dist/` tree.
