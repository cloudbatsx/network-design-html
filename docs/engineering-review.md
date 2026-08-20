# The engineering review

The helper's checkers prove a reply is *sound* — ids resolve, the rack adds
up, nothing hangs off the page. None of that proves the drawing is *plausible
as a network*. Free models misread pictures: they merge zones, drop the
firewall between the internet and the LAN, forget the second core. And
sometimes the picture genuinely shows an unusual network. The reviewer can
never know which — so it never blocks, never fixes, and never invents.

Each observation states a popular pattern, what this drawing shows instead,
and resolves one of three ways. **Copy the question** re-asks the AI (aimed
at the same chat that read the picture, when there was one). **Copy the fix
prompt** carries the correction: it aims the part picker, writes the request,
and copies the real edit prompt, so the reply lands back in the ordinary
Check loop - the step the first field test could not guess is now a button.
**Record as a gap** files the absence in the candour layer, staged and
change-listed like every other edit. And an observation the engine can repair
by arithmetic alone carries its own remedy button - the upside-down drawing
flips top-to-bottom with no AI involved. An observation whose territory the
findings already confess stands down — the candour layer outranks the
reviewer, so recording a gap makes its observation disappear in front of you.

## The wave-1 rules

| Rule | The engineering background | Fires when | Deliberately quiet when |
|---|---|---|---|
| **trust-skeleton** | Nearly every real topology separates outside from inside; 34 of the 36 calibration documents draw an external area. | No zones at all on a 5+ device drawing, or the internet drawn with no `external` zone anywhere. | Small sketches; drawings with an external area. |
| **undefended-edge** | Endpoints and servers do not sit raw on the internet — a firewall, router or tunnel stands between. | A cloud wired straight to an endpoint or server with no label saying VPN/tunnel. | The link is `backup`-kind, or the link or device says VPN, tunnel, encrypted, remote — roaming clients are real, and a label makes the drawing say so. |
| **exposed-service** | Every path from the internet to a server should cross the firewall. The reviewer walks the drawn links outward from each cloud; firewalls and VPN heads stop the walk, labelled tunnels are not crossed. | The walk reaches a server while a firewall exists elsewhere in the drawing. | No firewall drawn at all (that is trust-skeleton territory); the findings already confess the exposure. |
| **dmz-question** | Public-facing services conventionally live in a DMZ or screened segment, not in the trusted zone. | A firewall exists, a public-sounding server (web, mail, DNS, proxy, portal) sits inside, and no DMZ or perimeter zone is drawn. | A perimeter/DMZ zone exists, or the findings mention one. |
| **single-point** | Enterprise edges and cores are usually paired; one unit carrying every path is a risk worth a sentence. | Exactly one firewall or one core switch in a 10+ device drawing. | Smaller networks — a home office with one firewall is normal; a confessed redundancy risk. |
| **unjoined-pair** | Real HA pairs are joined — an HA line, a peer link, a stack cable. | Two same-stem firewalls/cores/WLCs sit **side by side** with **symmetric neighbours** and no line of any kind between them. | Routers (dual-ISP edges and iBGP-through-core are legitimately unjoined); stacked same-name firewalls in **series** — the Purdue iDMZ sandwich — whose neighbours barely overlap; any direct link of any kind. |
| **perimeter-band** | Edge security conventionally lives in a perimeter zone between outside and inside; the field test watched the model produce one on some runs and forget it on others. | A firewall sits fully inside an internal zone and no perimeter-kind zone exists. | A perimeter/DMZ zone drawn or confessed; firewalls not swallowed by the trusted zone. |
| **orientation** | Topologies flow top-down: internet and external services first, the organisation beneath. Flipping a canvas is pure arithmetic, so this one carries its own one-click remedy. | The external zone sits below the internal one, or the internet clouds sit well below the rest of the drawing. | Conventionally-oriented drawings; drawings whose findings keep the orientation deliberately. |
| **wireless-coverage** | Declared scope is a promise: a document that says it covers wireless must draw some. | `document.coverage` declares `wireless` and no access point, wireless router or WLAN controller is drawn. | Wireless drawn, wireless confessed in the findings, or the pack simply not declared. |
| **no-management** | Popular, not required: a management VLAN, out-of-band network or console path. One gentle line, said once. | Nothing mentions management, OOB or console - in an 8+ device drawing, or in ANY drawing that declares the management-oob pack (the wording then says so). | A management device or zone is drawn, or the findings confess the gap. |

## How it was calibrated

Every rule ran against all 36 corpus documents — the 11 shipped starters plus
the 25 archived free-model builds — and the acceptance bar was: **zero
observations on the accepted starters.** Getting there killed three naive
versions of the pair rule alone: "no ha-kind link" flagged core pairs joined
by aggregate peer-links; adding any-link still flagged router pairs that are
independent on purpose; and OT-001's enterprise-facing/plant-facing firewall
sandwich taught the symmetric-neighbours test. A rule that shouts at accepted
drawings is a rule people switch off.

Final fire rate: 36 observations across 36 documents (1.0 average), all on
model-built documents. Six were then judged against their source images:
one real AI extraction error caught, ten true gaps, zero noise.

## The roadmap (wave 2, unbuilt)

Architecture recognizers, gated on wave 1 proving its false-positive rate in
real use: classify the drawing (three-tier, collapsed core, spine-leaf,
hub-and-spoke, ring) with conservative thresholds, then ask
pattern-specific questions — leaf-to-leaf links in a Clos fabric, a broken
ring, endpoints hanging off a spine. Plus articulation-point analysis (the
true single-point-of-failure test) and naming-consistency tied to the
hostname anatomy.
