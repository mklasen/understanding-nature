# Understanding Weather — design & physics decisions

The model behind each interactive, what was simplified, and why.
Guiding rule (house style): **accurate enough to teach, simple enough to feel.** Every exaggeration
is labelled on the canvas. Numbers below come from running the models headless in node.

## Architecture
- Static, vanilla ES modules, Canvas2D only (the test browser has no WebGL; phones are the main
  audience). One module per chapter, loaded in isolation by `kit/chapters.js`; loops run only while
  visible (`visibleLoop`).
- Physics lives in no-DOM modules (`breeze-sim.js`, …) so it can be checked in node.

## Hero + chapter 1 — the sea breeze (`breeze-sim.js`, `breeze-view.js`)
A genuine (small) fluid model, not an animation: nobody scripts the sea breeze, it emerges.
- **2-D vertical slice across a coast, Boussinesq, vorticity–streamfunction:**
  `Dζ/Dt = −∂b/∂x + f ∂v/∂z + K∇²ζ − ζ/τf`, `Dv/Dt = −f u + K∇²v − v/τf`,
  `Db/Dt = −N² w + Q − b/τr + K∇²b`, `∇²ψ = ζ`. Buoyancy `b = g θ'/θ0`.
  The along-coast wind `v` makes it "2½-D", so Earth's spin (f = 2Ω sin φ, 45°N) turns the breeze
  during the afternoon — and, importantly, stops it running inland forever (without f, a 2-D
  sea breeze keeps going until it hits the wall).
- **Grid** 128 × 40 nodes over 150 km × 2.4 km (dx 1.2 km, dz 60 m); closed box, free slip.
  We **draw only 15–115 km** (sea 45 km, land 55 km) so the walls — where air piles up
  unrealistically — are never on screen. The canvas says "100 km across · 2.4 km high · heights ×N".
- **Poisson solve is exact**: sine transform (DST-I) in x + tridiagonal solve in z (ψ = 0 on walls).
  The DST runs as a radix-2 FFT of the odd extension, two rows per complex FFT (each odd extension
  has a purely imaginary transform, so they separate cleanly into Re/Im) — 3× faster than the
  matrix form, bit-for-bit the same diagnostics. Semi-Lagrangian advection (midpoint back-trace),
  explicit diffusion. Step 40 s; ~1.3 ms/step in node (Poisson 0.6 ms).
- **Forcing.** Over land only (sea's daily swing is tiny: huge heat capacity, mixes metres deep).
  Day: sensible heat flux `H = 340 W/m² · sun · sin(π(h−6)/12)`, spread over an e-folding depth
  of 260 m. Night: −70 W/m² (scaled down under cloud), confined to 110 m — the shallow nocturnal
  inversion. `N² = 1.2e-4 s⁻²`, `Kh = 1200`, `Kv = 15 m²/s`, spin-down `τf = 5 h`, radiative
  relaxation `τr = 30 h`.
- **Pressure** shown as H/L is the hydrostatic surface pressure, `p'(0) = −ρ∫b dz`, relative to the
  mean. **Tint** = warmer/cooler than the average air *at the same height* (that horizontal
  difference is what drives the flow).
- **Cumulus** are drawn where w > 0.25 m/s between 0.5 and 1.5 km — at the sea-breeze front, as in
  reality. Cloud base fixed at 1 km (illustrative; chapter 5 does cloud base properly).

### Sanity checks (45°N, sunny, after a spin-up day)
| | model | typical real sea breeze |
|---|---|---|
| onset | ~09:00 | mid-morning |
| peak onshore wind at 60 m | 4.4 m/s (15:00) | 3–7 m/s |
| depth of onshore layer | 600–850 m | 0.5–1 km |
| land–sea air contrast | ~3–3.5 °C (25 km inland vs offshore) | 3–10 °C at 2 m |
| surface pressure difference | 0.6 hPa | ~0.5–1 hPa |
| inland reach | 40 → 55+ km by late afternoon | 20–60 km, 100+ in hot climates |
| updraft at the front | 1–1.5 m/s | 1–3 m/s |
| veering (NH) | along-coast wind −1.6 m/s by 17:00 (turns clockwise) | turns clockwise in NH |
| land breeze | 1–1.6 m/s, from ~21:00–22:00 | 1–3 m/s, weaker & shallower than the sea breeze |
Known weaknesses: the land–sea contrast at 60 m is smaller than at 2 m (no surface layer); land
breeze sets in a little late; the sea-side air slowly warms ~1.5 °C over the day (return flow).

### Views
- Chapter 1 shows the full 100 km window. The hero uses a narrower, lower window on phones
  (48 km × 1.5 km) so the circulation isn't hidden under the headline.
- Time-lapse: 1 day ≈ 1 min by default (slow/fast options). At most 6 steps per frame; on slow
  devices model time is dropped rather than letting frames pile up.

## Chapters 2 & 3 — pressure maps and Coriolis (`map-sim.js`, `map-view.js`, `pressure.js`, `spin.js`)
- **Pressure field**: a sum of Gaussian highs/lows, `p = 1013 + Σ Δp·exp(−r²/2R²)` (hPa), analytic
  gradient. Isobars every 2 hPa (marching squares on a 90×N grid, cached until the field changes);
  every 8 hPa drawn bolder and labelled.
- **Parcels** obey the horizontal momentum equations exactly as in a textbook:
  `du/dt = −(1/ρ)∂p/∂x + f v − k u`, `dv/dt = −(1/ρ)∂p/∂y − f u − k v`, `f = 2Ω sin φ`.
  Integrator: half push/friction, exact rotation by `f·dt`, half push/friction (Coriolis does no
  work, so no numerical energy gain). Map 3,000–3,200 km wide; time-lapse 1 s ≈ 1.2 h (ch. 2) / 3 h (ch. 3), labelled on the canvas.
- **Chapter 2 deliberately switches Coriolis off** (canvas says "No Earth spin yet"); a little
  friction (k = 1.2e-5 /s) keeps parcels from oscillating forever. Parcels fade in the centre of the
  low ("air piles in… and rises"). Readouts at the midpoint: slope (hPa/100 km), push = |∇p|/ρ as
  "km/h gained per hour", and the *real* wind such a slope gives — geostrophic at 50° × 0.7 for
  surface friction (a common forecaster's rule; ch. 4 shows 50–70%).
- **Chapter 3 friction** `k = c·f(45°)` with c = 0 (aloft), 0.36 (sea), 0.8 (land) — chosen so that in
  steady state `tan α = k/f` gives ~20° over sea and ~38° over land at 45°, matching the textbook
  ranges (10–20° sea, 25–45° land). k is fixed in physical units, so at low latitudes the air crosses
  the isobars more steeply — as it really does.
- **Sanity (node)**, the chapter's low (Δp = −24 hPa, R = 560 km), air released at rest 1,250 km out,
  50°N: frictionless air never reaches the centre (it is turned aside and circles, closest approach
  1,135 km). With sea friction it spirals in over ~4–5 days, with land friction ~2.5–3 days — real
  lows also fill over days. 50°S: same, clockwise. Equator: straight in within ~17 h at up to
  38 m/s, sloshing through the middle (no balance is possible). Slope at R: 2.6 hPa/100 km →
  geostrophic 19 m/s at 50° — a vigorous but ordinary low. Map time-lapse: 1 s ≈ 3 h.
- **Merry-go-round**: the ball moves in a straight line in the ground frame; the chalk track is
  recorded in disc coordinates. "Riding it" counter-rotates the picture. The disc spins anticlockwise
  for northern latitudes, clockwise for southern, and stops at the equator (local vertical spin
  Ω sin φ = 0 there).
- The sink-drain myth gets one line: Coriolis acceleration at 1 m/s ~1e-4 m/s², versus the sink's
  own asymmetries — irrelevant at that scale.

## Chapter 4 — friction and gusts (`friction.js`)
- **Neutral log-law profile** `u(z) = (u*/κ) ln(z/z0)`, capped at the free-atmosphere wind G.
  **u\* from the geostrophic drag law** (Rossby-number similarity, A = 1.8, B = 4.5, κ = 0.4,
  f at 45°), which also gives the **cross-isobar angle** `sin α = B u*/(κ G)`.
- Roughness z0: sea 0.0002 m (Charnock-ish), grass 0.03 m, forest 0.5 m, city 1.0 m (EN 1991-1-4
  categories ~0/II/III/IV). For forest and city, "10 m" means 10 m above the displacement height
  (the treetops/rooftops) — stated in the text.
- **Gusts**: turbulence intensity `I = 1/ln(z/z0)`; peak gust `U·√(1 + 7I)` (Eurocode peak
  velocity pressure). The trace is synthetic turbulence — 28 sines with a −5/3 spectrum, scaled
  to σ = I·U — not a measurement.
- **Sanity (node)**, G = 10 / 20 m/s:

| surface | u10 / G | angle | gust factor | rule of thumb |
|---|---|---|---|---|
| sea | 71% / 68% | 17° / 16° | 1.28 | ~70%, 10–20°, ~1.2–1.3 |
| grass | 53% / 51% | 24° / 23° | 1.49 | ~50%, 20–30°, ~1.4–1.5 |
| forest | 31% / 29% | 33° / 31° | 1.95 | 30–40°, ~1.8–2 |
| city | 24% / 23% | 35° / 33° | 2.15 | ~2 |

- Drawing: heights on a square-root scale (labelled "heights stretched near the ground") so the
  bottom 100 m is visible; the streaks' speeds are a time-lapse.

## Chapter 6 — fronts and rain (`fronts.js`)
**Schematic, not simulated.** A kinematic cross-section: the frontal surface, clouds and rain are
fixed shapes in the front's frame of reference, and the front slides past a town at a constant
speed. Everything you read at the town comes from where the town sits relative to the front.
The canvas says "schematic · N km across · 11 km high · heights ×N" (×≈100 on desktop, ×≈110 on phones).
Winds are northern-hemisphere (SE → SW at a warm front, SW → NW at a cold front).

| | used | real-world range |
|---|---|---|
| warm-front speed | 20 km/h | 15–25 km/h (about half to two-thirds of a cold front's speed) |
| warm-front slope | 1:150 | 1:100 – 1:300 |
| cirrus ahead of a warm front | 800–1,090 km, 8.4–10 km up | first cirrus ~1,000 km / 24–36 h ahead, 8–12 km |
| cirrostratus / altostratus | 560–860 / 260–660 km ahead | thickening, lowering sheet in the last ~600 km |
| nimbostratus + steady rain | last ~300 km (≈ 15 h at 20 km/h) | rain belt ~200–400 km wide ahead of the surface front |
| cold-front speed | 30 km/h | 25–40 km/h |
| cold-front slope | ~1:70 overall, steep "nose" (1.5 km within ~40 km) | 1:50 – 1:100; the nose is blunter from surface friction |
| cumulonimbus | base 0.8 km, top ~10 km, anvil streaming ~170 km ahead | tops 8–15 km (tropopause); anvils 100+ km |
| heavy rain band | ~55 km wide (≈ 2 h) + patchy showers behind | typically 1–3 h of heavy rain, then showers |
| town temperatures | warm front 7 → 15 °C; cold front 16 → 9 °C | 3–10 °C jumps are typical |
| pressure | falls ~13 hPa over ~50 h ahead of the warm front (0.2–0.5 hPa/h); minimum at the cold front, then rises 0.7–1 hPa/h | falling 1–3 hPa per 3 h ahead of a warm front; sharp rise after a cold front |

- **Air motes** move in the front's frame: warm air overtakes a warm front at +14 km/h and glides up
  parallel to the frontal surface; it turns white ("cloudy") once lifted ≥ 0.9 km — the lift needed
  to cool moist air (dew-point depression ~7 °C) to saturation at ~9.8 °C/km (chapter 5). At a
  cold front, warm air is run into at 20 km/h, rises at ~10 m/s in the storm (strong but real
  thunderstorm updrafts are 10–30 m/s), then streams ahead in the anvil.
- Cloud placement, rain intensity and the town's weather are hand-shaped from the classic
  Norwegian cyclone model (Bjerknes) and standard textbook cross-sections, not computed.
  Real fronts vary hugely (split fronts, ana/kata fronts, occlusions): **not modelled**.
- Time-lapse: warm front 6 model-hours per second, cold front 3. When paused, the air keeps
  drifting gently so the lifting stays visible.

## Chapter 7 — the global engine (`global.js`)
A **schematic, zonally averaged** three-cell model, not a simulation: belts and winds are written
down analytically from climatology. No continents (we show no coastlines, and say so on the canvas:
"no continents"), so monsoons and the big land/sea contrasts are described in text, not drawn.

- **Belts** (latitude of each boundary), driven by the month `m` (0 = 1 Jan):
  `ITCZ = 5 + 6.5·cos(2π(m − 7.5)/12)` → 5°N mean, −1.5° in mid-Feb, 11.5°N in mid-Aug (lags the Sun
  by ~2 months). Other boundaries follow with smaller swings, `d = ITCZ − 5`:
  subtropical highs `±30 + 0.6d` (≈ 26–34°), polar front `±60 + 0.5d` (≈ 57–63°).
  Reality: zonal-mean ITCZ ≈ 5–6°N annual mean, migrating roughly 0–2°S (Jan–Feb) to 10–12°N
  (Aug) over the oceans (e.g. Schneider, Bischoff & Haug 2014); over land far more (≈15°S over southern
  Africa/Amazonia in January, 20–25°N with the Asian monsoon) — mentioned in the readout text.
  Hadley-cell edge 25–35° with season; storm track ~45–60°.
- **Surface wind** per belt, `sin(π·t)` across each belt (so it dies away at the boundaries — the
  doldrums and horse latitudes fall out naturally), peak values:
  trades u = −6.5, v = ±2.8 m/s toward the ITCZ (≈ from ENE / ESE, ~23° off east; observed trades
  5–8 m/s, ENE/ESE); NH westerlies u = 7, v = 2.2 (from WSW); SH westerlies u = 8.5, v = −2.4
  ("roaring forties", observed 8–12 m/s over the Southern Ocean); polar easterlies u = −3.5,
  v = 1.2 toward the equator. Zonal means hide the day-to-day storms, which is the point.
- Readouts use a 16-point compass on the direction the wind comes **from**; "doldrums" / "horse
  latitudes" (within 5° of the ITCZ / subtropical highs) read "light and variable".
- **No-spin toggle**: Hadley's (1735) single cell per hemisphere — surface air flows straight toward
  the thermal equator (v up to 5 m/s, u = 0), rising at the ITCZ, sinking at the poles. Fields blend
  smoothly (e-folding ~0.3 s) so you can watch the trades straighten out.
- **Globe**: orthographic, viewed from 10°N, fixed (it does *not* spin on screen, to keep the wind
  direction readable). Texture rendered per pixel (180–240 px, cached until month/spin changes):
  ocean, ITCZ thunderstorm clusters (value noise), sandy tint for the dry subtropical belts, grey
  swirls on the storm tracks, trade cumulus, ice caps >72°, soft sunlight from the solar declination
  (summer hemisphere brighter). The colour bands mean "typically wet/dry", **not** land.
  Particles drift with the surface wind, time-lapse **1 s ≈ 3 days** (on canvas).
- **Cross-section**: pole to pole, 0–18 km, tropopause `8.5 + 8/(1+e^((|φ|−35)/6))` km (≈16.5 km at
  the equator, ≈9 km at 60°). Cells are ellipses with dots circulating in the right sense (rising at
  the ITCZ and the polar front, sinking at the subtropical highs and the poles). Viewed facing west,
  so the eastward jet streams point at you (⊙): subtropical jet at the Hadley edge ~12 km, polar jet
  at the polar front ~9.5 km; symbol size grows in each hemisphere's winter (jets are stronger then).
  Canvas says "schematic · heights ×N" (computed live: ≈ ×240 on a desktop, ×390 on a phone).
- Tap the globe to set "your latitude" (inverse orthographic projection).
