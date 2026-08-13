# Local vendor assets

This directory holds optional raster inputs used to build official-asset portable
HTML files. Its contents are intentionally excluded from Git.

Expected local layout:

```text
vendor-local/
  icons/cisco-pms3015/   # Cisco JPG icon set
  rack-assets/           # front/rear rack PNGs
```

The editable template and vector showcase do not need these files. Keep original
filenames and capitalization because the packaging contract treats asset IDs as
case-sensitive.
