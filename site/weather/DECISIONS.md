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
- **Poisson solve is exact**: sine transform in x + tridiagonal solve in z (ψ = 0 on walls).
  Semi-Lagrangian advection (midpoint back-trace), explicit diffusion. Step 40 s; ~1–4 ms/step.
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
