# Generated output

This directory is intentionally excluded from Git except for this note.

With the optional local assets installed under `vendor-local/`, run:

```text
npm run build:packager
npm run verify:packager
```

The build creates the browser packager, self-contained `.portable.html` examples,
and a QA report here. Those files may embed third-party raster assets and should
not be committed or redistributed without a separate rights review.
