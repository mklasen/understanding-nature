# Understanding Orbits — design & physics decisions

Sibling of understanding-waves. Guiding rule: **lead with what's true; label every exaggeration on screen.**
Each stage has a "To scale / Not to scale" note directly under its canvas.

## Architecture
- Static site, vanilla ES modules, **Canvas2D only** (no WebGL — renders the same everywhere, incl. the GPU-less
  test browser). nginx:alpine with `./site` bind-mounted. No build step, no CDN, no dependencies.
- One module per chapter, loaded in isolation by `main.js` (failures land in `window.__chapterErrors`).
  Animations run only while on screen (`visibleLoop`). Event bindings come *after* the helpers they call
  (`bindRange` fires immediately — this bit chapter 3 once).
- `astro.js` = all the astronomy; `draw.js` = tiny 3D camera, starfield, Sun, CPU-shaded globe; `land.js` = 1° land
  mask rasterised from Natural Earth 1:110m (public domain) so the globe shows real coastlines, not a fake texture.
- Each chapter exposes `window.__<chapter>` (state + draw) for scripted visual QA.

## Mobile-first (most readers are on phones)
- ≤960 px: the sticky two-column layout collapses; `.text` becomes `display: contents` and CSS `order` puts
  **intro → live stage + controls → "after" paragraphs, "Try it", takeaway**. Paragraphs marked `.after` are the
  *answers* — so the phone reading order is question → play → explanation.
- ≤620 px: readout grids become label/value rows; canvases size from the viewport width; every canvas lays out
  for narrow aspect ratios (e.g. seasons stacks orbit-view over close-up; day/night starts the Earth at the bottom
  of its orbit where there's room).
- QA: `site/_mobile.html` frames the page at 390×844 so media queries apply (the `browser` CLI can't set a viewport).
  Dev-only; exclude it when publishing.

## Hero — living orrery
- Inner planets at their **real positions for today** from J2000 mean elements (Kepler's equation; ≲1° error
  near 2000–2050). Moon at its real phase angle. Fast-forward 12 days/s.
- Distances to scale; planet sizes ×~300–1,200 (computed and printed live). "True scale" morphs sizes to reality
  (Earth ≈ 0.01 px) with locator rings — the emptiness is the lesson.

## 1 — Day & night (solar vs sidereal)
- Spin rate vs the stars fixed at 23 h 56 m 4 s; year length is the slider. `1/T_sol = 1/T_sid ∓ 1/Y`.
  Real Earth → 24 h 00 m 00 s. "Spin the other way" (retrograde, like Venus) makes the solar day *shorter*.
- Timeline with a magnifier for the 3.9-minute gap. Tilt and equation of time deliberately left out (mean solar day).

## 2 — Seasons
- Earth on its real Kepler orbit (e = 0.0167, perihelion ~3 Jan); axis fixed in space, leaning toward the Sun at the
  June solstice. Declination `asin(sin ε · sin λ☉)`; day length from the sunset hour angle (no refraction — real
  days are ~5–10 min longer); daily top-of-atmosphere insolation with the 1/r² factor.
- Close-up looks at Earth from the side (Sun to the left, 24° above) and draws your latitude circle yellow (day) /
  blue (night) — the day-length fraction made visible. Tropics and polar circles are drawn *at the tilt angle* and
  move with the slider.
- Chart: your latitude and its mirror in the other hemisphere → opposite seasons is the misconception-killer.
- Facts checked: perihelion/aphelion 147.1/152.1 M km → ~7% more sunlight in January.

## 3 — Moon
- Top-down (Sun far left), phase = elongation. Seen-from-Earth disc is ray-cast per pixel with maria at their
  real selenographic positions (approximate circles) + Tycho, earthshine floor.
- "Stop the Moon spinning": orientation fixed vs the stars → sub-Earth longitude sweeps by the elongation and we'd
  see the far side at full Moon. "Tonight's Moon" uses a mean synodic month from a known new Moon (±~0.5 day).
- Earth's umbra drawn tapering to 0.72 Earth-widths at the Moon's distance. Rise/transit times: mean-motion rule
  of thumb (transit ≈ 12:00 + elongation × 24 h), labelled "around".

### 3b — "In your sky" (which side is lit?)
- Answers "why is the half Moon lit on the bottom / top / left / right?". Rule shown, not told: the lit side points
  along the great circle towards the Sun, even below the horizon (dashed arc).
- Geometry: Sun from Earth's real orbit (today), Moon at the chapter's elongation on the ecliptic (its ±5°
  latitude ignored), equatorial vectors → East/North/Up at the observer from local *solar* time (LST = RA☉ + H☉).
  Disc is rendered then rotated so its lit limb follows the projected arc; lunar north ≈ ecliptic north, so the
  maria tilt correctly too (Sydney sees the Moon "upside down").
- Ground view: gnomonic (pinhole) projection, drag to look around, zoom = field of view (78° → 2°). The Moon is
  enlarged until you zoom in far enough to reach its true 0.52°, and the caption says which. Sky colour, stars and
  sunset glow follow the Sun's altitude; the unlit part of the Moon is transparent in daylight.
- From-space view: Earth with the real map turned to the right local time, a "you" pin with your horizon plane,
  Moon at true relative size (distance squeezed ~25×). Presets: half Moon at dusk (Amsterdam / Sydney),
  evening crescent at the equator (a "smile"), half Moon at dawn.
- Checked: Amsterdam dusk first quarter → lit right; Sydney → lit left; equator crescent → lit bottom.

## Perspective & zoom (all 3D views)
- `attachZoom`: pinch on touch, ctrl/⌘-wheel or trackpad pinch on desktop, plus +/−/reset buttons. Plain wheel is
  left to page scrolling (no scroll-jacking). The orrery zooms towards Earth; nothing is ever drawn *smaller* than
  true size while zoomed, so at true scale you can zoom until the Earth–Moon pair appears.

## 4 — Eclipses
- Moon on an inclined orbit (slider, real 5.145°), nodes regress once per 18.6 yr, Sun from Earth's real orbit,
  mean lunations. Eclipse test at each syzygy: β = asin(sin i · sin(λ − Ω)); solar |β| < 1.5° (partial or
  better somewhere), lunar |β| < 1.0° (umbral — penumbral eclipses are barely noticeable, so not counted).
- Validation: reproduces all solar and partial/total lunar eclipses of 2026–2027 (12 Aug 2026 comes out as
  13 Aug — mean lunation). Century averages: 2.2 solar, 1.5 lunar per year (real ≈ 2.4, ≈ 1.5).
- Time slows near eclipses so the alignment can be seen.

## 5 — Newton's cannonball
- Real GM and radius, launch 400 km up (ISS altitude — above the air, so no drag needed), horizontal.
  Velocity Verlet at dt = 1 s. Drawn at true scale with auto-zoom to frame the ellipse. Outcome text
  from the energy equation (lands / ellipse / circular / escapes); landing distance from the integrated path.

## 6 — Kepler
- Exact Kepler motion; 12 equal-time slices (equal areas by construction — that's the point); vis-viva speed;
  log–log T vs a with the 8 planets. Presets incl. Halley (a 17.8 AU, e 0.967).
- Corrected during fact-check: the "week shorter" half-year is equinox-to-equinox (Sep→Mar 179 d vs Mar→Sep 186 d),
  not solstice-to-solstice.

## 7 — Retrograde
- Real Earth + Mars elements, including Mars's 1.85° inclination, so the sky strip shows true loops / zig-zags.
  Sky strip: east to the left (as seen in the sky), latitude ×4. Opposition finder (bisection) gives
  19 Feb 2027 — matches the real date. "Seen from the Sun" removes the loops.

## 8 — How fast? (frames of reference)
- Rows of the speed table are the frame switch (Earth / Sun / galaxy / CMB) with live "distance since you
  opened the page" counters.
- Directions converted from galactic coords: rotation (l 90°, b 0°) → ecliptic λ 347°, β +59.6°;
  CMB dipole (l 264°, b 48°) → λ 172°, β −11°. Speeds: 230 km/s (literature 220–240), 369.8 km/s (Planck).
- Corkscrew at **true proportions by default**: 49 AU per coil vs 2 AU across → a gently wavy line. "Squeeze the
  coils" slows the Sun 20×, clearly labelled. Explicitly corrects the "comet-tail vortex" videos (orbit is tilted
  ~60° to the motion; coils ~25× longer than wide).
- Vector-sum readout: Sun-vs-CMB + Earth's real orbital velocity today → 340–400 km/s annual swing.
- Ignored: solar peculiar motion (~20 km/s), galactic curvature over a few years, the Moon's wobble.

## Not done yet / ideas
- Precession (North Star over 26,000 years); Lagrange points; Moon recession chapter linked to waves' tides.
- Local sky view (Sun's path across your sky by season) in chapter 2.
- OG image + GitHub Pages publish (recipe in CONTEXT.md) — waiting for the user to ask.
