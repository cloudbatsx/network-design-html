# Third-party and artwork notices

## Cisco reference material

The optional local packaging workflow can consume Cisco topology icon JPGs, but
this repository is intentionally prepared without those downloaded binaries.
Cisco's Network Topology Icons page states that its icons may be used freely but
must not be altered. Cisco's copyright guidance separately describes permitted
use of unmodified networking-element icons. Those statements should be reviewed
in their current form for any intended distribution:

- <https://www.cisco.com/c/en/us/about/brand-center/network-topology-icons.html>
- <https://www.cisco.com/c/en/us/about/brand-center/copyright-use.html>

The SVG symbols in this project are experimental interpretations informed by
Cisco PMS 3015 silhouettes. They are not official Cisco-distributed SVG assets.
No conclusion is made here that the permission for unmodified Cisco icons covers
these interpretations. Public redistribution remains gated on a specific rights
review, permission, or replacement with a project-owned visual language.

Cisco and Cisco product names are trademarks of Cisco Systems, Inc. This project
is independent and is not affiliated with or endorsed by Cisco.

## Local rack images

Ten optional local front/rear rack PNGs are excluded under `vendor-local/`.
Project history associates their source material with the NetBox Device Type
Library at commit `5efffb4a613402a37a7daf616f081e56147662c0`, whose repository
publishes a CC0-1.0 license:

- <https://github.com/netbox-community/devicetype-library/tree/5efffb4a613402a37a7daf616f081e56147662c0>

Exact per-file lineage and any local transformations have not yet been recorded,
so those PNGs and generated HTML files that embed them should not be published as
part of this first repository version.

## Project license status

The original project code and documentation are released under the MIT License;
see [`LICENSE`](LICENSE).

That grant is deliberately scoped. It does not cover the vector symbol artwork
in `symbols/network-symbols.svg` or its synchronized copies in the template and
showcase, because the question raised above — whether interpretations informed
by Cisco reference silhouettes fall inside Cisco's permission for unmodified
icons — is not resolved. Licensing that geometry under MIT would purport to
grant rights that have not been established.

The clean resolution is to replace the 19 symbols with project-owned artwork.
That removes the question permanently and brings the whole repository under one
license. Until then, the exclusion in `LICENSE` stands.

Third-party materials, if locally supplied under `vendor-local/`, retain the
terms of their own sources.
