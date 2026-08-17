# Third-party and artwork notices

This repository ships third-party artwork so that the packager works from a
clone with nothing to install. Everything under `assets/` is included
**unmodified** and is **not** covered by this project's MIT licence.

## Cisco topology icons — `assets/icons/cisco-pms3015/`

294 Cisco topology icon JPGs, byte-for-byte as published, used to render
official device artwork in packaged output.

Cisco's Network Topology Icons page states that its icons may be used freely
but must not be altered, and Cisco's copyright guidance separately describes
permitted use of unmodified networking-element icons. Review both in their
current form before redistributing this repository or anything built from it:

- <https://www.cisco.com/c/en/us/about/brand-center/network-topology-icons.html>
- <https://www.cisco.com/c/en/us/about/brand-center/copyright-use.html>

What this project does and does not claim:

- The files are unmodified. Nothing in the pipeline recolours, crops, traces or
  restyles them; the packager verifies each file's signature and SHA-256 before
  embedding it, so a modified icon is a build failure rather than a silent
  change.
- Inclusion here is not a grant. Downstream redistribution is the redistributor's
  decision to make against Cisco's terms as they stand at that time.
- Removing them is a supported configuration. Delete `assets/`, and every design
  still renders completely with the project's own vector symbols; only the
  packaging step needs artwork, and it will ask for whatever folder you point it
  at — including one holding entirely your own images.

## Rack images — `assets/rack-assets/`

Ten front/rear rack face PNGs. Project history associates their source material
with the NetBox Device Type Library at commit
`5efffb4a613402a37a7daf616f081e56147662c0`, whose repository publishes a CC0-1.0
licence:

- <https://github.com/netbox-community/devicetype-library/tree/5efffb4a613402a37a7daf616f081e56147662c0>

Exact per-file lineage and any local transformations were never recorded. CC0
imposes no condition that this gap would breach, but the gap is real and stated
here rather than papered over.

One recorded transformation: `cisco-fpr4215-ngfw-k9.front.png` and
`cisco-fpr4215-ngfw-k9.rear.png` arrived as JPEG data carrying a `.png`
extension, which the packager correctly refuses to embed. On 2026-08-15 both
were re-encoded to genuine PNG at identical pixel dimensions (1800×186 and
1800×187) — a lossless container change of the decoded image, with no resize,
recrop or recolour. CC0 permits this without condition.

## The vector symbols are not third-party material

The 19 SVG symbols in `tools/symbols/network-symbols.svg`, and their synchronized
copies inside the template, the starter kits and the showcase, are the project
author's own drawings. They are **MIT licensed along with the rest of the
project** — take them, restyle them, ship them in your own work.

They are listed on this page only to answer the question directly, because they
sit next to genuine third-party artwork and depict the same kinds of equipment.
Two things follow from being original work:

- They are not Cisco files. No official vendor SVG is distributed here, and
  nothing in this repository is derived from one.
- Depicting a router as a cylinder with arrows, or a firewall as a brick wall,
  is the ordinary visual vocabulary of network diagrams. That vocabulary belongs
  to no vendor, and drawing in it is not derivation.

The symbols also carry no vendor branding, which is what keeps a design built on
them free of any trademark question: `assets/` is where vendor artwork enters,
and only if you choose to package with it.

## Project licence status

The project's code, documentation and vector symbol artwork are released under
the MIT License; see [`LICENSE`](LICENSE). The single exclusion is the
third-party artwork distributed under `assets/`, described above, together with
any file that embeds it.

Cisco and Cisco product names are trademarks of Cisco Systems, Inc. This project
is independent and is not affiliated with or endorsed by Cisco.
