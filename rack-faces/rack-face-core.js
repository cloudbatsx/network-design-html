"use strict";

// The rack faceplate drawing core. Shared, verbatim, by three consumers:
//
//   * tools/build-rack-faces.js, which expands it into an SVG sprite
//   * examples/rack-face-preview.html, the review page
//   * the design documents themselves, which inline this whole file and call
//     faceMarkup() at render time
//
// That last one is why the artwork is generated rather than stored: the
// expanded sprite is over 400 KB, and a document has to carry the entire
// catalogue so the data block can name any device without a download. The
// generator is 25 KB and draws the same picture.
//
// A rack elevation squeezes a faceplate hard: a 1U face lands in roughly
// 346 x 18 CSS pixels, so the artwork is stretched to about 45% horizontally
// and 26% vertically. Every shape here is therefore drawn coarse on purpose —
// fine detail survives neither the squeeze nor a 300dpi print. For the same
// reason no faceplate carries text: a glyph stretched like that is unreadable,
// so device names stay in the document data and are drawn by the page.
//
// Native geometry follows EIA-310: 19 inches wide, 1.75 inches per rack unit.
// 760 x 70 per U keeps that exact ratio, and lands on a tidy 40px per inch —
// so every port below is sized from its real-world dimension.
//
// The vendor-shaped faces reproduce port layout and chassis proportion, which
// is what makes a model recognisable in an elevation. They carry no logo, no
// wordmark and no vendor colour scheme, and they are named by family and role
// rather than by model number.
//
// This file must run unchanged in Node and in a browser: no require, no fs, no
// optional chaining on globals. Rebuild everything after editing it:
//
//   node tools/build-rack-faces.js

var RACK_FACE_CORE = (function () {
  "use strict";

  /* -- geometry ------------------------------------------------------------ */

  const W = 760;          // 19 inches
  const U = 70;           // 1.75 inches per rack unit
  const PPI = 40;         // pixels per inch — every port below is sized from this
  const EAR = 30;         // rack ear width
  const BODY_X = EAR;
  const BODY_W = W - EAR * 2;

  /* -- primitives ---------------------------------------------------------- */

  const n = value => (Math.round(value * 100) / 100).toString();

  function tag(name, attributes, children) {
    const parts = Object.entries(attributes)
      .filter(([, value]) => value !== undefined && value !== null && value !== "")
      .map(([key, value]) => ` ${key}="${value}"`)
      .join("");
    if (!children || !children.length) return `<${name}${parts}/>`;
    return `<${name}${parts}>${children.join("")}</${name}>`;
  }

  const rect = (x, y, w, h, cls, rx) =>
    tag("rect", { class: cls, x: n(x), y: n(y), width: n(w), height: n(h), rx: rx ? n(rx) : undefined });

  const circle = (cx, cy, r, cls) =>
    tag("circle", { class: cls, cx: n(cx), cy: n(cy), r: n(r) });

  const path2 = (d, cls) => tag("path", { class: cls, d });

  const group = (cls, children) => tag("g", { class: cls }, children);

  /* -- chassis ------------------------------------------------------------- */

  // Mounting ears. Two oblong holes per U, which is what a real panel has.
  function ears(units) {
    const height = U * units;
    const shapes = [rect(0, 0, EAR, height, "rf-ear"), rect(W - EAR, 0, EAR, height, "rf-ear")];
    for (let u = 0; u < units; u++) {
      const base = u * U;
      [base + 20, base + 50].forEach(y => {
        shapes.push(rect(9, y - 3, 12, 6, "rf-ear-hole", 3));
        shapes.push(rect(W - 21, y - 3, 12, 6, "rf-ear-hole", 3));
      });
    }
    return group("rf-ears", shapes);
  }

  function body(units, tone = "light", view = "front") {
    const height = U * units;
    return group("rf-chassis", [
      rect(BODY_X, 0, BODY_W, height, `rf-body rf-body--${tone}${view === "rear" ? "-rear" : ""}`),
      rect(BODY_X, 0, BODY_W, 2.5, "rf-body-hi"),
      rect(BODY_X, height - 2.5, BODY_W, 2.5, "rf-body-lo")
    ]);
  }

  /* -- ports --------------------------------------------------------------- */

  // RJ45 jack, 0.45in x 0.53in. `flip` puts the retention-clip slot at the
  // bottom, the way the lower row of a two-row bank is always mounted.
  function rj45(x, y, w = 16, h = 21, flip = false) {
    const tabW = w * 0.34;
    const tabH = h * 0.22;
    return group("rf-jack", [
      rect(x, y, w, h, "rf-cage", 1.5),
      rect(x + 1.8, y + 1.8, w - 3.6, h - 3.6, "rf-port-hole", 1),
      rect(x + (w - tabW) / 2, flip ? y + h - 1.8 - tabH : y + 1.8, tabW, tabH, "rf-port-tab")
    ]);
  }

  function rj45Bank({ x, y, w = 16, h = 21, rows = 2, cols, pitch = 19, rowGap = 6, groupOf = 6, groupGap = 5 }) {
    const shapes = [];
    for (let row = 0; row < rows; row++) {
      const rowY = y + row * (h + rowGap);
      for (let col = 0; col < cols; col++) {
        shapes.push(rj45(x + col * pitch + Math.floor(col / groupOf) * groupGap, rowY, w, h, row % 2 === 1));
      }
    }
    return group("rf-bank", shapes);
  }

  // Pluggable optic cage. SFP is 0.55in wide, QSFP 0.72in — the width difference
  // is the only thing that tells a 10G port from a 40/100G one at a glance, so
  // it is drawn to scale.
  function cage(x, y, w, h, wide) {
    const inset = wide ? 2.6 : 2.2;
    return group("rf-optic", [
      rect(x, y, w, h, "rf-cage", 1.5),
      rect(x + inset, y + inset, w - inset * 2, h - inset * 2, "rf-port-hole", 1),
      rect(x + inset + 1.5, y + h / 2 - 1, w * 0.2, 2, "rf-cage-latch")
    ]);
  }

  function cageBank({ x, y, w, h, rows = 1, cols, pitch, rowGap = 6, wide = false }) {
    const cw = w !== undefined ? w : (wide ? 29 : 22);
    const ch = h !== undefined ? h : (wide ? 22 : 20);
    const cp = pitch !== undefined ? pitch : cw + 3;
    const shapes = [];
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        shapes.push(cage(x + col * cp, y + row * (ch + rowGap), cw, ch, wide));
      }
    }
    return group("rf-optics", shapes);
  }

  // Serial console, USB, and the small D-sub video connector on a server.
  const miniPort = (x, y, w = 20, h = 13) => group("rf-mini", [
    rect(x, y, w, h, "rf-cage", 2),
    rect(x + 2.5, y + 2.5, w - 5, h - 5, "rf-port-hole", 1)
  ]);

  const usbPort = (x, y) => group("rf-usb", [
    rect(x, y, 15, 8, "rf-cage", 1),
    rect(x + 2, y + 2, 11, 4, "rf-port-hole")
  ]);

  /* -- indicators ---------------------------------------------------------- */

  function ledColumn(x, y, states, size = 5, gap = 3) {
    return group("rf-leds", states.map((state, index) =>
      rect(x, y + index * (size + gap), size, size, `rf-led rf-led--${state}`, 1)));
  }

  function ledRow(x, y, states, size = 5, gap = 4) {
    return group("rf-leds", states.map((state, index) =>
      rect(x + index * (size + gap), y, size, size, `rf-led rf-led--${state}`, 1)));
  }

  // A blank nameplate — the vendor badge area, deliberately left empty.
  const nameplate = (x, y, w, h) => rect(x, y, w, h, "rf-plate", 2);

  // Status display. Two bars stand in for content: anything finer disappears.
  const lcd = (x, y, w, h) => group("rf-lcd", [
    rect(x, y, w, h, "rf-cage", 2),
    rect(x + 3, y + 3, w - 6, h - 6, "rf-screen", 1),
    rect(x + 8, y + 8, (w - 16) * 0.7, Math.max(3, h * 0.14), "rf-screen-line"),
    rect(x + 8, y + 8 + h * 0.3, (w - 16) * 0.45, Math.max(3, h * 0.14), "rf-screen-line")
  ]);

  const button = (x, y, r = 4) => circle(x, y, r, "rf-button");

  /* -- panels and modules -------------------------------------------------- */

  function vent({ x, y, w, h, cols = 8, rows = 3 }) {
    const shapes = [];
    const slotW = w / cols * 0.62;
    const slotH = h / rows * 0.55;
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        shapes.push(rect(x + col * (w / cols), y + row * (h / rows), slotW, slotH, "rf-vent", slotH / 2));
      }
    }
    return group("rf-vents", shapes);
  }

  // Fan module: a hub, a ring and six blades.
  function fan(cx, cy, r) {
    const blades = [];
    for (let i = 0; i < 6; i++) {
      const a1 = (i * 60 + 8) * Math.PI / 180;
      const a2 = (i * 60 + 52) * Math.PI / 180;
      blades.push(path2(
        `M${n(cx + Math.cos(a1) * r * 0.34)} ${n(cy + Math.sin(a1) * r * 0.34)}` +
        `L${n(cx + Math.cos(a1) * r * 0.9)} ${n(cy + Math.sin(a1) * r * 0.9)}` +
        `L${n(cx + Math.cos(a2) * r * 0.9)} ${n(cy + Math.sin(a2) * r * 0.9)}` +
        `L${n(cx + Math.cos(a2) * r * 0.34)} ${n(cy + Math.sin(a2) * r * 0.34)}Z`, "rf-fan-blade"));
    }
    return group("rf-fan", [circle(cx, cy, r, "rf-fan-ring"), ...blades, circle(cx, cy, r * 0.3, "rf-fan-hub")]);
  }

  // IEC C14 appliance inlet.
  function iecInlet(x, y, w = 30, h = 20) {
    return group("rf-inlet", [
      rect(x, y, w, h, "rf-cage", 2),
      rect(x + 3, y + 3, w - 6, h - 6, "rf-port-hole", 1.5),
      rect(x + 6.5, y + 7, 4, 6, "rf-inlet-pin"),
      rect(x + w / 2 - 2, y + 6, 4, 4, "rf-inlet-pin"),
      rect(x + w - 10.5, y + 7, 4, 6, "rf-inlet-pin")
    ]);
  }

  // Hot-swap power supply bay: handle, latch LED, inlet, exhaust.
  function psuBay({ x, y, w, h, inlet = true }) {
    const shapes = [
      rect(x, y, w, h, "rf-module", 2),
      rect(x + 3, y + 3, 8, h - 6, "rf-handle", 2),
      ledColumn(x + 14, y + h / 2 - 2.5, ["green"], 5, 3)
    ];
    if (inlet) shapes.push(iecInlet(x + 22, y + h / 2 - 10));
    shapes.push(vent({ x: x + 58, y: y + 4, w: Math.max(12, w - 62), h: h - 8, cols: 6, rows: 3 }));
    return group("rf-psu", shapes);
  }

  // A line-card / supervisor / uplink slot. `filled` draws ports into it;
  // otherwise it is a blank slot cover, which is what half a chassis usually is.
  function moduleSlot({ x, y, w, h, contents = [] }) {
    return group("rf-slot", [
      rect(x, y, w, h, "rf-module", 2),
      rect(x + 3, y + 3, 7, h - 6, "rf-handle", 2),
      rect(x + w - 10, y + 3, 7, h - 6, "rf-handle", 2),
      ...contents
    ]);
  }

  // PCIe expansion bracket on a server rear.
  const pcieBracket = (x, y, w, h) => group("rf-pcie", [
    rect(x, y, w, h, "rf-module", 1.5),
    vent({ x: x + 4, y: y + 4, w: w - 8, h: h - 8, cols: 5, rows: 3 })
  ]);

  // Hot-swap drive carrier: latch, handle, activity LEDs.
  const driveBay = (x, y, w, h) => group("rf-drive", [
    rect(x, y, w, h, "rf-module", 1.5),
    rect(x + 2, y + 2, w * 0.28, h - 4, "rf-handle", 1),
    rect(x + w * 0.42, y + 3, w * 0.42, h - 6, "rf-drive-face", 1),
    rect(x + w * 0.46, y + h - 9, w * 0.14, 4, "rf-led rf-led--green", 1)
  ]);

  function driveGrid({ x, y, w, h, cols, rows = 1, pitchX, pitchY }) {
    const px = pitchX !== undefined ? pitchX : w + 2;
    const py = pitchY !== undefined ? pitchY : h + 3;
    const shapes = [];
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) shapes.push(driveBay(x + col * px, y + row * py, w, h));
    }
    return group("rf-drives", shapes);
  }

  // Panel-mounted keystone jack — a patch panel port, framed by its bezel.
  const keystone = (x, y, w = 22, h = 26) => group("rf-keystone", [
    rect(x, y, w, h, "rf-module", 1.5),
    rect(x + 2.5, y + 2.5, w - 5, h - 5, "rf-cage", 1),
    rect(x + 4.5, y + 4.5, w - 9, h - 9, "rf-port-hole", 1),
    rect(x + w / 2 - 3, y + 4.5, 6, 4, "rf-port-tab")
  ]);

  function keystoneBank({ x, y, w = 22, h = 26, rows = 1, cols, pitch = 25, rowGap = 8, groupOf = 6, groupGap = 6 }) {
    const shapes = [];
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        shapes.push(keystone(x + col * pitch + Math.floor(col / groupOf) * groupGap, y + row * (h + rowGap), w, h));
      }
    }
    return group("rf-keystones", shapes);
  }

  // Duplex LC fibre adapter.
  const lcDuplex = (x, y, w = 22, h = 14) => group("rf-lc", [
    rect(x, y, w, h, "rf-module", 1.5),
    rect(x + 2, y + 2.5, w / 2 - 3.5, h - 5, "rf-port-hole", 1),
    rect(x + w / 2 + 1.5, y + 2.5, w / 2 - 3.5, h - 5, "rf-port-hole", 1)
  ]);

  // A fibre cassette: the removable module a patch panel is loaded with.
  function fibreCassette({ x, y, w, h, adapters = 6 }) {
    const pitch = (w - 16) / adapters;
    const shapes = [rect(x, y, w, h, "rf-module", 2), rect(x + 3, y + 3, 6, h - 6, "rf-handle", 1.5)];
    for (let i = 0; i < adapters; i++) shapes.push(lcDuplex(x + 12 + i * pitch, y + h / 2 - 7, pitch - 3));
    return group("rf-cassette", shapes);
  }

  // NEMA 5-15R outlet, 1.3in across.
  const outlet = (x, y, w = 48, h = 44) => group("rf-outlet", [
    rect(x, y, w, h, "rf-module", 3),
    rect(x + w * 0.24, y + h * 0.18, w * 0.1, h * 0.32, "rf-port-hole", 1),
    rect(x + w * 0.66, y + h * 0.18, w * 0.1, h * 0.32, "rf-port-hole", 1),
    circle(x + w / 2, y + h * 0.72, w * 0.09, "rf-port-hole")
  ]);

  function outletBank({ x, y, w = 48, h = 44, rows = 1, cols, pitch = 55, rowGap = 8 }) {
    const shapes = [];
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) shapes.push(outlet(x + col * pitch, y + row * (h + rowGap), w, h));
    }
    return group("rf-outlets", shapes);
  }

  const breaker = (x, y, w = 20, h = 30) => group("rf-breaker", [
    rect(x, y, w, h, "rf-module", 2),
    rect(x + 4, y + 5, w - 8, h * 0.45, "rf-port-hole", 1.5)
  ]);

  const groundLug = (x, y) => group("rf-ground-lug", [
    rect(x, y, 22, 18, "rf-ground", 2),
    circle(x + 5.5, y + 9, 2.6, "rf-port-hole"),
    circle(x + 16.5, y + 9, 2.6, "rf-port-hole")
  ]);

  // Cable-manager finger duct. The fingers are tall and squared off — rounding
  // them to their own width turns the whole panel into a row of buttons.
  function fingerDuct({ x, y, w, h, fingers = 8 }) {
    const pitch = w / fingers;
    const shapes = [rect(x, y, w, h, "rf-module", 2)];
    for (let i = 0; i < fingers; i++) {
      shapes.push(rect(x + i * pitch + pitch * 0.28, y + 3, pitch * 0.44, h - 6, "rf-duct-finger", 3));
    }
    return group("rf-duct", shapes);
  }

  // Brush grommet — the cable pass-through on the back of a fibre panel. Drawn
  // as bristles rather than a hole, because an unbroken black slab at rack scale
  // reads as a missing device rather than an opening.
  function brushGrommet(x, y, w, h, strips = 14) {
    const pitch = (w - 8) / strips;
    const bristles = [];
    for (let i = 0; i < strips; i++) {
      bristles.push(rect(x + 4 + i * pitch, y + 4, pitch * 0.55, h - 8, "rf-bristle", 1));
    }
    return group("rf-grommet", [
      rect(x, y, w, h, "rf-cage", 3),
      rect(x + 3, y + 3, w - 6, h - 6, "rf-port-hole", 2),
      ...bristles
    ]);
  }

  // A stacking-bus connector: the wide, shallow back-panel socket that marks a
  // stackable switch.
  const stackPort = (x, y, w, h) => group("rf-stack", [
    rect(x, y, w, h, "rf-module", 3),
    rect(x + 6, y + (h - 16) / 2, w - 12, 16, "rf-cage", 2),
    rect(x + 9, y + (h - 16) / 2 + 3, w - 18, 10, "rf-port-hole", 1),
    rect(x + w / 2 - 1.5, y + (h - 16) / 2 + 3, 3, 10, "rf-module")
  ]);

  // Drawer latch on a console / KVM tray.
  const drawerLatch = (x, y, w = 26, h = 34) => group("rf-latch", [
    rect(x, y, w, h, "rf-module", 2),
    rect(x + 5, y + h * 0.3, w - 10, h * 0.4, "rf-port-hole", 2)
  ]);

  /* -- device schedule ----------------------------------------------------- */
  //
  // Two families. `generic` is house artwork with no vendor in mind — reach for
  // these first. The vendor-shaped entries exist because port layout is what an
  // engineer actually recognises in an elevation; they carry no branding.

  const DEVICES = [

    /* ---- generic: switching and routing ---- */
    {
      key: "generic-switch-48p-1u",
      label: "Generic 48-port access switch",
      family: "generic", role: "access-switch", units: 1, tone: "light",
      front: () => [
        body(1), nameplate(40, 18, 78, 34), ledColumn(46, 22, ["green", "green", "amber", "off"]),
        rj45Bank({ x: 128, y: 11, rows: 2, cols: 24, pitch: 19 }),
        cageBank({ x: 612, y: 25, cols: 4, pitch: 25 }),
        vent({ x: 716, y: 14, w: 12, h: 42, cols: 2, rows: 6 })
      ],
      rear: () => [
        body(1, "light", "rear"),
        psuBay({ x: 40, y: 12, w: 170, h: 46 }), psuBay({ x: 218, y: 12, w: 170, h: 46 }),
        fan(430, 35, 22), fan(486, 35, 22), fan(542, 35, 22),
        rj45(600, 24), miniPort(626, 28), groundLug(672, 26)
      ]
    },
    {
      key: "generic-switch-24p-1u",
      label: "Generic 24-port access switch",
      family: "generic", role: "access-switch", units: 1, tone: "light",
      front: () => [
        body(1), nameplate(40, 18, 78, 34), ledColumn(46, 22, ["green", "green", "off", "off"]),
        rj45Bank({ x: 132, y: 11, rows: 2, cols: 12, pitch: 21 }),
        cageBank({ x: 420, y: 25, cols: 4, pitch: 25 }),
        vent({ x: 540, y: 14, w: 188, h: 42, cols: 12, rows: 4 })
      ],
      rear: () => [
        body(1, "light", "rear"),
        vent({ x: 40, y: 12, w: 260, h: 46, cols: 14, rows: 4 }),
        fan(340, 35, 22), fan(396, 35, 22),
        iecInlet(440, 25, 34, 22), rj45(500, 24), miniPort(526, 28), groundLug(580, 26)
      ]
    },
    {
      key: "generic-router-1u",
      label: "Generic WAN router",
      family: "generic", role: "router", units: 1, tone: "light",
      front: () => [
        body(1), nameplate(40, 18, 64, 34), ledColumn(46, 22, ["green", "amber", "off", "off"]),
        rj45Bank({ x: 116, y: 24, rows: 1, cols: 4, pitch: 20, groupOf: 4 }),
        cageBank({ x: 204, y: 25, cols: 2, pitch: 25 }),
        miniPort(262, 28), usbPort(288, 31),
        moduleSlot({ x: 318, y: 12, w: 196, h: 46, contents: [rj45Bank({ x: 336, y: 24, rows: 1, cols: 4, pitch: 20, groupOf: 4 })] }),
        moduleSlot({ x: 522, y: 12, w: 196, h: 46, contents: [vent({ x: 542, y: 20, w: 156, h: 30, cols: 8, rows: 2 })] })
      ],
      rear: () => [
        body(1, "light", "rear"),
        vent({ x: 40, y: 12, w: 300, h: 46, cols: 16, rows: 4 }),
        fan(380, 35, 22), fan(436, 35, 22),
        iecInlet(480, 25, 34, 22), miniPort(540, 28), groundLug(590, 26)
      ]
    },
    {
      key: "generic-firewall-1u",
      label: "Generic 1U firewall",
      family: "generic", role: "firewall", units: 1, tone: "light",
      front: () => [
        body(1), nameplate(40, 18, 66, 34), ledColumn(46, 22, ["green", "green", "amber", "off"]),
        rj45Bank({ x: 122, y: 11, rows: 2, cols: 8, pitch: 19, groupOf: 4 }),
        cageBank({ x: 292, y: 11, rows: 2, cols: 4, pitch: 25 }),
        miniPort(404, 28), usbPort(434, 31),
        vent({ x: 466, y: 12, w: 260, h: 46, cols: 14, rows: 4 })
      ],
      rear: () => [
        body(1, "light", "rear"),
        vent({ x: 40, y: 12, w: 300, h: 46, cols: 16, rows: 4 }),
        fan(378, 35, 23), fan(434, 35, 23),
        psuBay({ x: 470, y: 12, w: 124, h: 46 }), psuBay({ x: 600, y: 12, w: 124, h: 46 })
      ]
    },
    {
      key: "generic-security-appliance-3u",
      label: "Generic 3U security appliance",
      family: "generic", role: "firewall", units: 3, tone: "light",
      front: () => [
        body(3),
        // Supervisor strip: management, status, and the two system SSDs.
        nameplate(40, 16, 68, 36), lcd(122, 14, 118, 40),
        ledColumn(254, 18, ["green", "green", "amber", "off"]),
        rj45(284, 22), miniPort(310, 26), usbPort(340, 29),
        driveGrid({ x: 370, y: 12, w: 46, h: 44, cols: 2, pitchX: 52 }),
        vent({ x: 486, y: 14, w: 236, h: 40, cols: 12, rows: 3 }),
        // Two loaded network module bays over one blank.
        moduleSlot({ x: 38, y: 70, w: 340, h: 58, contents: [cageBank({ x: 60, y: 89, cols: 8, pitch: 25 })] }),
        moduleSlot({ x: 386, y: 70, w: 336, h: 58, contents: [cageBank({ x: 408, y: 88, cols: 4, pitch: 34, wide: true })] }),
        moduleSlot({ x: 38, y: 138, w: 340, h: 58, contents: [vent({ x: 60, y: 150, w: 296, h: 34, cols: 14, rows: 2 })] }),
        vent({ x: 386, y: 140, w: 336, h: 54, cols: 16, rows: 4 })
      ],
      rear: () => [
        body(3, "light", "rear"),
        psuBay({ x: 38, y: 12, w: 330, h: 56 }), psuBay({ x: 386, y: 12, w: 330, h: 56 }),
        fan(90, 118, 32), fan(170, 118, 32), fan(250, 118, 32),
        fan(330, 118, 32), fan(410, 118, 32), fan(490, 118, 32),
        vent({ x: 38, y: 158, w: 620, h: 44, cols: 24, rows: 3 }), groundLug(680, 172)
      ]
    },
    {
      key: "generic-chassis-switch-4u",
      label: "Generic modular chassis switch",
      family: "generic", role: "core-switch", units: 4, tone: "light",
      front: () => {
        const slots = [];
        const contentFor = index => {
          if (index === 0) return [vent({ x: 60, y: 10, w: 640, h: 22, cols: 22, rows: 2 })];
          if (index === 1 || index === 2) {
            return [nameplate(60, 12, 60, 18), miniPort(132, 15), usbPort(162, 17),
              cageBank({ x: 196, y: 11, cols: 4, pitch: 25 }), ledRow(310, 16, ["green", "amber", "off"])];
          }
          return [rj45Bank({ x: 60, y: 8, rows: 1, cols: 24, pitch: 25, h: 22 })];
        };
        for (let i = 0; i < 6; i++) {
          const y = 6 + i * 45;
          const raw = contentFor(i);
          slots.push(moduleSlot({
            x: 38, y, w: 684, h: 40,
            contents: raw.map(shape => tag("g", { transform: `translate(0 ${n(y)})` }, [shape]))
          }));
        }
        return [body(4), ...slots];
      },
      rear: () => [
        body(4, "light", "rear"),
        psuBay({ x: 40, y: 10, w: 330, h: 60 }), psuBay({ x: 384, y: 10, w: 330, h: 60 }),
        psuBay({ x: 40, y: 78, w: 330, h: 60 }), psuBay({ x: 384, y: 78, w: 330, h: 60 }),
        vent({ x: 40, y: 150, w: 674, h: 60, cols: 24, rows: 4 }),
        fan(120, 240, 30), fan(200, 240, 30), fan(280, 240, 30), fan(360, 240, 30),
        fan(440, 240, 30), fan(520, 240, 30), groundLug(660, 232)
      ]
    },
    {
      key: "generic-wlan-controller-1u",
      label: "Generic wireless LAN controller",
      family: "generic", role: "wlan-controller", units: 1, tone: "light",
      front: () => [
        body(1), nameplate(40, 18, 58, 34), lcd(110, 16, 120, 38),
        ledColumn(244, 20, ["green", "green", "amber", "off"]),
        cageBank({ x: 276, y: 25, cols: 8, pitch: 25 }),
        rj45(490, 24), miniPort(516, 28), usbPort(546, 31),
        vent({ x: 580, y: 14, w: 148, h: 42, cols: 9, rows: 4 })
      ],
      rear: () => [
        body(1, "light", "rear"),
        psuBay({ x: 40, y: 12, w: 190, h: 46 }), psuBay({ x: 238, y: 12, w: 190, h: 46 }),
        fan(470, 35, 22), fan(526, 35, 22), fan(582, 35, 22), groundLug(660, 26)
      ]
    },

    /* ---- generic: compute and storage ---- */
    {
      key: "generic-server-1u",
      label: "Generic 1U rack server",
      family: "generic", role: "server", units: 1, tone: "light",
      front: () => [
        body(1),
        driveGrid({ x: 46, y: 6, w: 24, h: 58, cols: 10, pitchX: 26 }),
        vent({ x: 326, y: 10, w: 300, h: 50, cols: 16, rows: 4 }),
        nameplate(640, 12, 42, 46),
        button(700, 22, 7), usbPort(692, 38), ledRow(692, 52, ["green", "amber"])
      ],
      rear: () => [
        body(1, "light", "rear"),
        psuBay({ x: 40, y: 12, w: 150, h: 46 }), psuBay({ x: 198, y: 12, w: 150, h: 46 }),
        pcieBracket(360, 12, 110, 46), pcieBracket(478, 12, 110, 46),
        rj45Bank({ x: 598, y: 24, rows: 1, cols: 4, pitch: 19, groupOf: 4 }),
        miniPort(682, 28), usbPort(682, 46), rj45(706, 8, 14, 18)
      ]
    },
    {
      key: "generic-server-2u",
      label: "Generic 2U rack server",
      family: "generic", role: "server", units: 2, tone: "light",
      front: () => [
        body(2),
        driveGrid({ x: 46, y: 20, w: 24, h: 100, cols: 24, pitchX: 26 }),
        nameplate(676, 26, 34, 88),
        button(693, 40, 8), usbPort(686, 62), ledRow(686, 82, ["green", "amber"])
      ],
      rear: () => [
        body(2, "light", "rear"),
        psuBay({ x: 40, y: 14, w: 200, h: 52 }), psuBay({ x: 248, y: 14, w: 200, h: 52 }),
        pcieBracket(470, 14, 120, 52), pcieBracket(598, 14, 120, 52),
        pcieBracket(40, 76, 120, 52), pcieBracket(168, 76, 120, 52),
        rj45Bank({ x: 306, y: 90, rows: 1, cols: 4, pitch: 19, groupOf: 4 }),
        cageBank({ x: 392, y: 91, cols: 2, pitch: 25 }),
        miniPort(452, 94), usbPort(482, 96), rj45(510, 88, 14, 18), groundLug(560, 92)
      ]
    },
    {
      key: "generic-storage-array-2u",
      label: "Generic 12-bay storage array",
      family: "generic", role: "storage-array", units: 2, tone: "light",
      front: () => [
        body(2),
        driveGrid({ x: 38, y: 6, w: 160, h: 40, cols: 4, rows: 3, pitchX: 168, pitchY: 44 }),
        ledColumn(716, 46, ["green", "green", "amber"])
      ],
      rear: () => [
        body(2, "light", "rear"),
        moduleSlot({
          x: 38, y: 8, w: 340, h: 60, contents: [
            cageBank({ x: 60, y: 26, cols: 4, pitch: 25 }), rj45(180, 26), miniPort(208, 30),
            ledColumn(240, 24, ["green", "amber"])]
        }),
        moduleSlot({
          x: 386, y: 8, w: 336, h: 60, contents: [
            cageBank({ x: 408, y: 26, cols: 4, pitch: 25 }), rj45(528, 26), miniPort(556, 30),
            ledColumn(588, 24, ["green", "amber"])]
        }),
        psuBay({ x: 38, y: 76, w: 330, h: 56 }), psuBay({ x: 386, y: 76, w: 330, h: 56 })
      ]
    },
    {
      key: "generic-kvm-console-1u",
      label: "Generic KVM console drawer",
      family: "generic", role: "console", units: 1, tone: "light",
      front: () => [
        body(1),
        drawerLatch(40, 18), drawerLatch(694, 18),
        rect(76, 30, 612, 4, "rf-seam", 2),
        rect(76, 12, 612, 14, "rf-plate", 2),
        ledRow(360, 44, ["green", "off"]),
        button(410, 46.5, 5)
      ],
      rear: () => [
        body(1, "light", "rear"),
        vent({ x: 40, y: 12, w: 400, h: 46, cols: 20, rows: 4 }),
        miniPort(470, 28, 26, 16), usbPort(510, 31), usbPort(532, 31),
        rj45(566, 24), iecInlet(610, 25, 34, 22), groundLug(676, 26)
      ]
    },

    /* ---- generic: passive and power ---- */
    {
      key: "generic-patch-panel-24-1u",
      label: "Generic 24-port copper patch panel",
      family: "generic", role: "patch-panel", units: 1, tone: "light",
      front: () => [
        body(1),
        rect(38, 6, 684, 9, "rf-plate", 1.5),
        keystoneBank({ x: 42, y: 20, cols: 24, pitch: 25 }),
        rect(38, 56, 684, 8, "rf-plate", 1.5)
      ],
      rear: () => [
        body(1, "light", "rear"),
        rect(42, 14, 676, 42, "rf-module", 2),
        vent({ x: 52, y: 20, w: 656, h: 30, cols: 24, rows: 2 })
      ]
    },
    {
      key: "generic-patch-panel-48-2u",
      label: "Generic 48-port copper patch panel",
      family: "generic", role: "patch-panel", units: 2, tone: "light",
      front: () => [
        body(2),
        rect(38, 8, 684, 9, "rf-plate", 1.5),
        keystoneBank({ x: 42, y: 22, rows: 2, cols: 24, pitch: 25, rowGap: 26 }),
        rect(38, 124, 684, 9, "rf-plate", 1.5)
      ],
      rear: () => [
        body(2, "light", "rear"),
        rect(42, 16, 676, 50, "rf-module", 2), vent({ x: 52, y: 24, w: 656, h: 34, cols: 24, rows: 2 }),
        rect(42, 76, 676, 50, "rf-module", 2), vent({ x: 52, y: 84, w: 656, h: 34, cols: 24, rows: 2 })
      ]
    },
    {
      key: "generic-fibre-panel-1u",
      label: "Generic 4-cassette fibre panel",
      family: "generic", role: "patch-panel", units: 1, tone: "light",
      front: () => [
        body(1),
        fibreCassette({ x: 38, y: 12, w: 166, h: 46 }),
        fibreCassette({ x: 212, y: 12, w: 166, h: 46 }),
        fibreCassette({ x: 386, y: 12, w: 166, h: 46 }),
        fibreCassette({ x: 560, y: 12, w: 162, h: 46 })
      ],
      rear: () => [
        body(1, "light", "rear"),
        rect(42, 12, 676, 46, "rf-module", 2),
        brushGrommet(60, 20, 180, 30), brushGrommet(280, 20, 180, 30), brushGrommet(500, 20, 180, 30)
      ]
    },
    {
      key: "generic-blanking-panel-1u",
      label: "Generic blanking panel",
      family: "generic", role: "blank", units: 1, tone: "light",
      front: () => [body(1), rect(38, 32, 684, 5, "rf-seam", 2)],
      rear: () => [body(1, "light", "rear"), rect(38, 32, 684, 5, "rf-seam", 2)]
    },
    {
      key: "generic-cable-manager-1u",
      label: "Generic horizontal cable manager",
      family: "generic", role: "cable-management", units: 1, tone: "light",
      front: () => [body(1), fingerDuct({ x: 38, y: 10, w: 684, h: 50, fingers: 10 })],
      rear: () => [body(1, "light", "rear"), fingerDuct({ x: 38, y: 10, w: 684, h: 50, fingers: 10 })]
    },
    {
      key: "generic-pdu-1u",
      label: "Generic 8-outlet rack PDU",
      family: "generic", role: "pdu", units: 1, tone: "light",
      front: () => [
        body(1), breaker(40, 20), ledColumn(70, 24, ["green", "off"]),
        outletBank({ x: 96, y: 13, cols: 8, pitch: 72, w: 60, h: 44 }),
        rect(682, 20, 36, 30, "rf-module", 3), circle(700, 35, 8, "rf-port-hole")
      ],
      rear: () => [
        body(1, "light", "rear"),
        vent({ x: 40, y: 16, w: 600, h: 38, cols: 26, rows: 3 }),
        rect(660, 20, 58, 30, "rf-module", 3), circle(689, 35, 9, "rf-port-hole")
      ]
    },
    {
      key: "generic-ups-2u",
      label: "Generic 2U rack UPS",
      family: "generic", role: "ups", units: 2, tone: "light",
      front: () => [
        body(2), lcd(40, 26, 168, 88),
        ledColumn(224, 34, ["green", "green", "amber", "off"], 8, 8),
        button(258, 40, 8), button(258, 70, 8), button(258, 100, 8),
        nameplate(292, 30, 96, 80),
        vent({ x: 404, y: 20, w: 318, h: 100, cols: 14, rows: 6 })
      ],
      rear: () => [
        body(2, "light", "rear"),
        outletBank({ x: 40, y: 14, rows: 2, cols: 4, pitch: 66, w: 56, h: 50, rowGap: 12 }),
        breaker(320, 30, 26, 40),
        rect(360, 22, 40, 26, "rf-module", 3), circle(380, 35, 9, "rf-port-hole"),
        moduleSlot({ x: 430, y: 14, w: 150, h: 50, contents: [rj45(470, 30), miniPort(500, 34)] }),
        fan(630, 40, 30), fan(630, 104, 30), groundLug(690, 96)
      ]
    },

    /* ---- vendor-shaped: Cisco ---- */
    {
      key: "cisco-catalyst-48p-1u",
      label: "Cisco-style stackable 48-port switch",
      family: "cisco", role: "access-switch", units: 1, tone: "light",
      front: () => [
        body(1), ledColumn(40, 14, ["green", "green", "amber", "off", "off"], 5, 4),
        button(56, 52, 5), nameplate(52, 12, 30, 32),
        rj45Bank({ x: 92, y: 11, rows: 2, cols: 24, pitch: 19 }),
        moduleSlot({
          x: 570, y: 10, w: 140, h: 50,
          contents: [cageBank({ x: 590, y: 25, cols: 4, pitch: 25 })]
        }),
        vent({ x: 714, y: 14, w: 12, h: 42, cols: 2, rows: 6 })
      ],
      rear: () => [
        body(1, "light", "rear"),
        psuBay({ x: 38, y: 12, w: 150, h: 46 }), psuBay({ x: 196, y: 12, w: 150, h: 46 }),
        // The pair of wide stacking-bus connectors that identify this family.
        stackPort(360, 16, 116, 38), stackPort(486, 16, 116, 38),
        fan(628, 35, 20), fan(674, 35, 20), miniPort(706, 28, 16, 14)
      ]
    },
    {
      key: "cisco-isr-router-1u",
      label: "Cisco-style modular branch router",
      family: "cisco", role: "router", units: 1, tone: "light",
      front: () => [
        body(1), nameplate(38, 16, 34, 38), ledColumn(80, 16, ["green", "amber", "off", "off"]),
        rj45Bank({ x: 104, y: 24, rows: 1, cols: 3, pitch: 20, groupOf: 3 }),
        cageBank({ x: 168, y: 25, cols: 2, pitch: 25 }),
        miniPort(224, 28), usbPort(250, 31), usbPort(250, 43),
        moduleSlot({ x: 280, y: 10, w: 216, h: 50, contents: [rj45Bank({ x: 300, y: 24, rows: 1, cols: 4, pitch: 20, groupOf: 4 })] }),
        moduleSlot({ x: 504, y: 10, w: 214, h: 50, contents: [cageBank({ x: 524, y: 25, cols: 4, pitch: 25 })] })
      ],
      rear: () => [
        body(1, "light", "rear"),
        psuBay({ x: 38, y: 12, w: 190, h: 46 }), psuBay({ x: 236, y: 12, w: 190, h: 46 }),
        fan(470, 35, 22), fan(526, 35, 22),
        usbPort(570, 31), miniPort(600, 28), groundLug(660, 26)
      ]
    },
    {
      key: "cisco-nexus-48sfp-1u",
      label: "Cisco-style 48-port SFP28 data-centre switch",
      family: "cisco", role: "dc-switch", units: 1, tone: "light",
      front: () => [
        body(1), ledColumn(40, 16, ["green", "green", "amber"]),
        cageBank({ x: 60, y: 11, rows: 2, cols: 24, w: 18, h: 20, pitch: 20, rowGap: 8 }),
        cageBank({ x: 548, y: 24, cols: 6, w: 27, h: 22, pitch: 30, wide: true })
      ],
      rear: () => [
        body(1, "light", "rear"),
        psuBay({ x: 38, y: 12, w: 150, h: 46 }), psuBay({ x: 196, y: 12, w: 150, h: 46 }),
        // Management and console live on the back of this family, not the front.
        rj45(360, 24), miniPort(386, 28), usbPort(416, 31),
        fan(470, 35, 21), fan(516, 35, 21), fan(562, 35, 21), fan(608, 35, 21),
        groundLug(660, 26)
      ]
    },

    /* ---- vendor-shaped: Juniper ---- */
    {
      key: "juniper-ex-48p-1u",
      label: "Juniper-style 48-port access switch",
      family: "juniper", role: "access-switch", units: 1, tone: "dark",
      front: () => [
        body(1, "dark"), nameplate(38, 18, 46, 34),
        ledColumn(94, 16, ["green", "green", "amber", "off"]),
        rj45(114, 24), miniPort(140, 28), usbPort(168, 31),
        rj45Bank({ x: 198, y: 11, rows: 2, cols: 24, pitch: 21 }),
        vent({ x: 716, y: 14, w: 12, h: 42, cols: 2, rows: 6 })
      ],
      rear: () => [
        body(1, "dark", "rear"),
        // The uplinks are a rear module on this family — that is the tell.
        moduleSlot({ x: 38, y: 10, w: 190, h: 50, contents: [cageBank({ x: 58, y: 24, cols: 4, w: 29, h: 22, pitch: 32, wide: true })] }),
        psuBay({ x: 238, y: 12, w: 160, h: 46 }), psuBay({ x: 406, y: 12, w: 160, h: 46 }),
        fan(600, 35, 21), fan(646, 35, 21), groundLug(690, 26)
      ]
    },
    {
      key: "juniper-srx-firewall-1u",
      label: "Juniper-style services gateway",
      family: "juniper", role: "firewall", units: 1, tone: "dark",
      front: () => [
        body(1, "dark"), nameplate(38, 18, 46, 34),
        ledColumn(94, 16, ["green", "amber", "off", "off"]),
        rj45(114, 24), miniPort(140, 28), usbPort(168, 31),
        rj45Bank({ x: 198, y: 11, rows: 2, cols: 8, pitch: 21, groupOf: 4 }),
        cageBank({ x: 388, y: 11, rows: 2, cols: 4, pitch: 25 }),
        vent({ x: 500, y: 12, w: 226, h: 46, cols: 12, rows: 4 })
      ],
      rear: () => [
        body(1, "dark", "rear"),
        vent({ x: 38, y: 12, w: 300, h: 46, cols: 16, rows: 4 }),
        fan(376, 35, 22), fan(432, 35, 22),
        psuBay({ x: 470, y: 12, w: 124, h: 46 }), psuBay({ x: 600, y: 12, w: 124, h: 46 })
      ]
    },

    /* ---- vendor-shaped: Palo Alto, Fortinet, Arista ---- */
    {
      key: "palo-alto-ngfw-1u",
      label: "Palo Alto style next-generation firewall",
      family: "palo-alto", role: "firewall", units: 1, tone: "dark",
      front: () => [
        body(1, "dark"), nameplate(40, 20, 62, 30), ledRow(46, 54, ["green", "green", "amber", "off"], 5, 6),
        rj45(112, 24), rj45(134, 24), miniPort(158, 28, 16, 14),
        rj45Bank({ x: 186, y: 11, rows: 2, cols: 8, pitch: 19, groupOf: 4 }),
        cageBank({ x: 356, y: 11, cols: 4, pitch: 25 }),
        cageBank({ x: 356, y: 38, cols: 4, w: 29, h: 22, pitch: 32, wide: true }),
        vent({ x: 500, y: 12, w: 226, h: 46, cols: 12, rows: 4 })
      ],
      rear: () => [
        body(1, "dark", "rear"),
        vent({ x: 40, y: 12, w: 300, h: 46, cols: 16, rows: 4 }),
        fan(378, 35, 23), fan(434, 35, 23),
        psuBay({ x: 470, y: 12, w: 124, h: 46 }), psuBay({ x: 600, y: 12, w: 124, h: 46 })
      ]
    },
    {
      key: "fortinet-ngfw-1u",
      label: "Fortinet-style next-generation firewall",
      family: "fortinet", role: "firewall", units: 1, tone: "light",
      front: () => [
        body(1), lcd(38, 16, 110, 38),
        button(162, 24, 5), button(162, 46, 5), button(180, 35, 5), button(144, 35, 5),
        ledColumn(198, 18, ["green", "green", "amber", "off"]),
        rj45Bank({ x: 220, y: 11, rows: 2, cols: 8, pitch: 19, groupOf: 4 }),
        cageBank({ x: 390, y: 11, rows: 2, cols: 4, pitch: 25 }),
        cageBank({ x: 502, y: 24, cols: 4, w: 29, h: 22, pitch: 32, wide: true }),
        miniPort(640, 28), usbPort(670, 31),
        vent({ x: 698, y: 14, w: 26, h: 42, cols: 3, rows: 6 })
      ],
      rear: () => [
        body(1, "light", "rear"),
        vent({ x: 40, y: 12, w: 320, h: 46, cols: 18, rows: 4 }),
        fan(398, 35, 23), fan(454, 35, 23),
        psuBay({ x: 492, y: 12, w: 110, h: 46 }), psuBay({ x: 610, y: 12, w: 110, h: 46 })
      ]
    },
    {
      key: "arista-32qsfp-1u",
      label: "Arista-style 32-port QSFP28 spine switch",
      family: "arista", role: "dc-switch", units: 1, tone: "black",
      front: () => [
        body(1, "black"), ledColumn(38, 16, ["green", "green", "amber"]),
        cageBank({ x: 56, y: 10, rows: 2, cols: 16, w: 27, h: 22, pitch: 29, rowGap: 6, wide: true }),
        rj45(540, 24), miniPort(566, 28), usbPort(596, 31),
        vent({ x: 626, y: 12, w: 100, h: 46, cols: 6, rows: 4 })
      ],
      rear: () => [
        body(1, "black", "rear"),
        psuBay({ x: 38, y: 12, w: 160, h: 46 }), psuBay({ x: 206, y: 12, w: 160, h: 46 }),
        fan(410, 35, 21), fan(456, 35, 21), fan(502, 35, 21), fan(548, 35, 21),
        vent({ x: 590, y: 14, w: 90, h: 42, cols: 5, rows: 4 }), groundLug(694, 26)
      ]
    }
  ];

  /* -- public interface ---------------------------------------------------- */

  const BY_KEY = new Map(DEVICES.map(device => [device.key, device]));

  // The shapes of one face, as SVG markup with no wrapper. Callers supply the
  // <symbol> or <svg> around it, because the sprite and the live document need
  // different wrappers around identical contents.
  function faceMarkup(key, view) {
    const device = BY_KEY.get(key);
    if (!device || (view !== "front" && view !== "rear")) return null;
    return [...device[view](), ears(device.units)].join("");
  }

  function faceInfo(key) {
    const device = BY_KEY.get(key);
    if (!device) return null;
  return { key: device.key, label: device.label, family: device.family, role: device.role, units: device.units };
  }

  const viewBoxFor = key => {
    const device = BY_KEY.get(key);
    return device ? `0 0 ${W} ${U * device.units}` : null;
  };

  const STYLE = `
      :root{
        --rf-ear:#78848c; --rf-body:#c2ccd2; --rf-metal:#3d454c; --rf-hole:#12171b;
      }
      .rf-ear{fill:var(--rf-ear)}
      .rf-ear-hole{fill:#39424a}
      .rf-body{fill:var(--rf-body)}
      .rf-body--light{fill:var(--rf-body)}
      .rf-body--light-rear{fill:#aab5bc}
      .rf-body--dark{fill:#33393e}
      .rf-body--dark-rear{fill:#2b3136}
      .rf-body--black{fill:#24272a}
      .rf-body--black-rear{fill:#1d2023}
      .rf-body-hi{fill:#fff;opacity:.35}
      .rf-body-lo{fill:#000;opacity:.18}
      .rf-cage{fill:var(--rf-metal)}
      .rf-cage-latch{fill:#78848c}
      .rf-port-hole{fill:var(--rf-hole)}
      .rf-port-tab{fill:#6d7a84}
      .rf-plate{fill:#e9eef1;opacity:.5}
      .rf-seam{fill:#000;opacity:.22}
      .rf-vent{fill:#6f7b83;opacity:.75}
      .rf-module{fill:#96a2aa}
      .rf-handle{fill:#5d6871}
      .rf-drive-face{fill:#b9c3ca}
      .rf-duct-finger{fill:#5d6871}
      .rf-bristle{fill:#7c878f;opacity:.9}
      .rf-ground{fill:#8b959c}
      .rf-inlet-pin{fill:#8b959c}
      .rf-button{fill:#5d6871}
      .rf-screen{fill:#16323b}
      .rf-screen-line{fill:#54c8b8;opacity:.85}
      .rf-fan-ring{fill:#5d6871}
      .rf-fan-blade{fill:#9aa5ad}
      .rf-fan-hub{fill:#39424a}
      .rf-led{fill:#6d777f}
      .rf-led--green{fill:#4fd07a}
      .rf-led--amber{fill:#f0a33a}
      .rf-led--off{fill:#6d777f}`;

  return { W, U, PPI, STYLE, DEVICES, faceMarkup, faceInfo, viewBoxFor, has: key => BY_KEY.has(key), keys: () => DEVICES.map(device => device.key) };
})();

if (typeof module !== "undefined" && module.exports) module.exports = RACK_FACE_CORE;
