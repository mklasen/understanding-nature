# Brief: Understanding Light & Colour  (explainer id: `light`, theme: `light`)

Part of the **Understanding Nature** library. Read `../README.md` and `../CONTRIBUTING.md` first, and
look at `site/waves/` and `site/orbits/` for the house style. Inspiration, not a rigid spec.

## The curiosity to answer
- **Why is the sky blue — and sunsets red?** Rayleigh scattering ∝ 1/λ⁴; path length through the
  atmosphere at low Sun (cross-link ← `orbits#day`). A "move the Sun" sky renderer is the hero.
- **Why are clouds white?** Mie scattering by droplets ≈ wavelength-independent.
- **Rainbows:** why always ~42° from the point opposite the Sun, why the colours are ordered,
  the double rainbow and the dark band between (Alexander's band). Ray-trace a droplet you can aim.
- **Why is the sea blue / turquoise?** Water absorbs red; shallow sand reflects (← `waves`).
- **Light is a wave:** wavelength ↔ colour, interference (soap bubbles, oil films), the link to
  water waves' superposition (← `waves#crowd`).
- **What colour really is:** three cone types, additive mixing, why "pink" isn't in the rainbow.
- Optional: polarisation (sunglasses, the sky), why the Moon's sky is black, green flash.

## Suggested chapters (adjust freely)
1. White light is all colours (prism / spectrum)
2. Why the sky is blue (scattering)
3. Sunsets (path length)
4. Clouds are white
5. Rainbows (droplet ray-tracing, 42°)
6. Interference and colours from thin films
7. How we see colour (cones)
8. Summary

## Notes
- Real physics where it teaches, honest labels, DECISIONS.md with sanity checks (e.g. rainbow
  angle from Snell + n(λ) for water ≈ 1.331–1.343 across the visible range).
- Mobile first. Canvas2D (no WebGL in the test browser).
- Add your chapter ids to `site/kit/catalog.js` (status stays `building` until the user says live).
