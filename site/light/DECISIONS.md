# Understanding Light & Colour — design & physics decisions

The model behind each interactive, what was simplified, and why. Same rule as the rest of the
library: **accurate enough to teach, simple enough to feel**. Where we exaggerate, the canvas says so.

## Architecture
- Static, no build, no dependencies. One module per chapter, loaded in isolation by the kit.
- `js/optics.js` holds the shared science: wavelengths, colour science, refractive indices, Mie,
  thin films, water optics. `js/sky.js` is the atmosphere. Chapters only visualise.
- **Every colour on screen that represents light is computed from a spectrum** (33 samples,
  390–710 nm, 10 nm; the sky uses 17 at 20 nm). None are hand-picked.
- The sky integrator runs in a **Web Worker** (`sky-worker.js`), one per scene, rendering
  progressively (coarse while you drag, finer once you stop). Synchronous fallback if module
  workers are unavailable. Canvas2D everywhere; no WebGL needed.

## Colour pipeline (`optics.js`)
- **CIE 1931 2° observer** via the multi-lobe Gaussian fit of Wyman, Sloan & Shirley (2013),
  within a few % of the tabulated CMFs. Avoids vendoring the table.
- XYZ → linear sRGB (D65 matrix) → sRGB gamma. Out-of-gamut colours are desaturated toward their
  own luminance (keeps hue; spectral colours are all outside sRGB).
- **Sunlight above the atmosphere = 5778 K black body.** It has no Fraunhofer lines and slightly
  more violet than the real Sun. Fine for colour.
- **White balance: sunlight in space is white.** So every tint on screen comes from the physics
  (air, water, films), not from a camera preset. Consequence: the noon Sun at ground level is
  very slightly warm, as it should be.
- Sanity: the 5778 K spectrum lands at xy = (0.326, 0.336), vs (0.327, 0.336) for the black-body
  locus. A pure-Rayleigh (λ⁻⁴ × sun) spectrum lands at xy = (0.237, 0.237), the textbook
  "Rayleigh sky" point.

## Hero + chapters 2–3: the computed sky (`sky.js`, `scene.js`)
- **Single scattering** in a spherical atmosphere (R⊕ 6371 km, top at 100 km):
  - Rayleigh: β(550 nm) = 13.3 × 10⁻⁶ m⁻¹ at sea level, ∝ λ⁻⁴, scale height 8 km, phase
    3/16π (1 + cos²θ). Zenith optical depth at 550 nm = 0.106 (measured ≈ 0.097; we use the
    pure λ⁻⁴ law instead of the λ⁻⁴·⁰⁸ that dispersion of air gives).
  - Aerosol (Mie): extinction set by AOD at 550 nm, Ångström exponent 1.3, scale height 1.2 km,
    single-scattering albedo 0.9, Henyey–Greenstein g = 0.76.
  - Ozone (Chappuis band): tent profile 10–40 km, peak absorption 2.4 × 10⁻⁶ m⁻¹ near 595 nm.
    Column optical depth ≈ 0.036 at 600 nm, matching ≈ 300 DU. Ozone is what keeps the
    twilight zenith blue after sunset (Hulburt 1953).
- Optical depth toward the Sun comes from a precomputed table of altitude × zenith angle. **Each
  altitude row ends at that altitude's own horizon**, so the steep change near the horizon is
  resolved and nothing interpolates into the ground. Sunlight below a point's horizon = Earth's
  shadow (this gives twilight and the shadowed lower sky).
- **Sanity: relative air mass** from the table vs Kasten & Young (1989):
  90° 1.00 / 1.00 · 30° 1.99 / 1.99 · 10° 5.55 / 5.59 · 5° 10.2 / 10.3 · 2° 18.7 / 19.4 ·
  0° 35.5 / 37.9. The last two are a few % low because we ignore refraction.
- Transmittance of the direct beam (AOD 0.1): Sun at 60° → 68% of 450 nm, 85% of 650 nm.
  At 5° → 3% and 23%. At 1° → < 0.1% and 1.4%. That is the red sunset.
- **Exposure (honest caveat):** a pure-Rayleigh sky at zenith is only ~1/40 of the brightness
  of white paper in sunlight. Real skies with ordinary haze run ~1/10 (CIE clear-sky zenith
  luminance with Linke turbidity ≈ 3), partly from aerosols and partly from multiple
  scattering, which we omit. We expose "like your eyes": exposure follows the light falling
  on the ground, but only partly (E ∝ G^−0.62), so dusk really gets darker. Tone mapping
  compresses luminance and keeps the colour's ratios, rolling very bright colours softly toward
  white. Without that, an over-exposed blue channel clips first and the whole sky turns white.
- **Known gaps of single scattering:** the horizon sky and deep twilight come out somewhat
  darker and more saturated than real; no multiple-scattering brightening near the horizon;
  no Belt of Venus contrast as strong as reality. Clouds are not modelled in the sky.
- The Sun disc is drawn at its **true colour, not its true brightness** (labelled in chapter 3).
  The glow around it is partly the computed aerosol aureole and partly a drawn glare halo.
- Ground: woods/fields albedo ≈ 4–6.5% (greener in green), lit by the computed Sun and sky.
  Distant hills fade into the horizon colour (aerial perspective, approximate).
- Hero defaults: clean country air (AOD 0.06). Chapter 2: AOD 0.1, Sun 35°. The "1/λⁿ" dial is
  labelled a thought experiment whenever n ≠ 4; "No air" sets all scattering to zero (Moon).
- **Chapter 3 side view**: the atmosphere is drawn ~×24 thicker than real (printed on canvas).
  The colour of the beam at each point uses the *real* optical depth of the whole path, shared
  out along the drawn path by the drawn density. So the endpoint colours are real and the
  in-between is a faithful sketch. Each photon dot's chance of being scattered on the way is
  exactly 1 − e^(−τ(λ)), so the share of blue that reaches "you" matches the readouts. Photons are
  an illustration: real light doesn't travel as visible dots.

## Chapter 1: prism
- Dense flint glass (SF11-like) via a Cauchy fit: n(400) = 1.807, n(700) = 1.766. 60° prism,
  beam aimed at minimum deviation for 550 nm, exact vector Snell refraction at both faces.
- Sanity: deviation 65.6° at 550 nm; red-to-violet spread 5.4° (real SF11 ≈ 5°).
- The fan beyond the prism is **exaggerated (×≈9, printed)** so the colours fill the card. The
  readout shows the real spread. The recombining lens is schematic.
- Recombined colour = sunlight × mask through the full colour pipeline (blocking 400–520 nm →
  yellow; blocking green → magenta; that's subtractive filtering of an additive mixture).

## Chapter 4: clouds (Mie theory)
- **Full Mie series** (Bohren & Huffman BHMIE, real refractive index of water from the same
  Cauchy fit). Logarithmic-derivative downward recurrence, Riccati–Bessel upward.
- Averaged over a ±30% spread of radii (real clouds and hazes are never monodisperse; this also
  removes the sharp ripple structure of a single sphere).
- Sanity: Q_sca(x = 0.1) matches the Rayleigh limit (8/3)x⁴|(m²−1)/(m²+2)|² to 1%; Q_sca → 2
  (the extinction paradox) for large x. Blue/red (450/650) scattering ratio: 4.5 for tiny
  particles (λ⁻⁴ plus water's dispersion), 3.2 at 0.1 µm, 2.0 at 0.25 µm, ≈ 1.0 for 0.5 µm
  and up. Cloud droplets (5–10 µm radius) scatter white.
- The "air-sized speck" preset is a 0.5 nm water sphere. The point is that *size*, not material,
  sets the colour dependence. The text says "well, bigger" because real N₂ is ~0.3 nm across.
- Not shown: multiple scattering in clouds (why cloud bases go grey), the "blue moon" window
  near 0.5 µm. Both are mentioned in the text only.

## Chapter 5: rainbows
- Water n(λ) = 1.3240 + 3046/λ² (λ in nm): n(400) = 1.343, n(700) = 1.330, within ±0.001 of
  measured at 20 °C (brief: 1.331–1.343 ✓).
- **Sanity, rainbow angles** (maximum of 4r − 2i, and minimum of 180° + 2i − 6r):
  primary 400 nm 40.6°, 550 nm 41.9°, 650 nm 42.3°, 700 nm 42.5° · secondary 650 nm 50.4°,
  400 nm 53.5°. Textbook: primary ≈ 40.6–42.4°, secondary ≈ 50–53.5°, dark band ≈ 8°.
- Drop view: exact Snell + reflection in a circle; light leaking out at the back is drawn faint
  (most light leaves there). The inset plots exit angle vs aim: the flat top at 42° is the
  pile-up.
- Sky view: for each of 31 wavelengths, 40,000 impact parameters are binned (0.05°) by exit
  angle. Each is weighted by its area (b·db) and by unpolarised Fresnel factors, T² for entry and
  exit, R for each internal reflection. Bins are divided by sin θ (solid angle), then smeared
  over the 0.53° solar disc. The bright interior, **Alexander's dark band** and the reversed,
  fainter secondary all *emerge*; none is painted in.
- Bow brightness relative to the rain curtain is illustrative. No supernumerary bows (needs wave
  optics / Airy theory). The landscape is schematic.

## Chapter 6: the sea
- Pure-water absorption a_w(λ) after **Pope & Fry (1997)**, rounded, 10 nm steps, with the 390 nm
  value from Morel et al. Values were transcribed by hand and are good to ~10%. Molecular
  scattering of sea water b_w = 0.0029 m⁻¹ at 500 nm ∝ λ⁻⁴·³² (Morel 1974), half backward.
- Plankton (simplified): chlorophyll absorption with peaks at 440 and 675 nm scaled as
  0.06·C^0.65 (Bricaud-style), CDOM ∝ e^(−0.014(λ−440)), particle backscatter
  0.0035·C^0.62·(550/λ).
- Light at depth: E(z) = E₀ e^(−Kd z), Kd ≈ 1.16 (a + b_b) (sun ~30° high, refracted).
- Seen from above: two-flow shallow-water reflectance R = R∞(1 − e^(−2Kd z)) + A_bed e^(−2Kd z),
  R∞ ≈ 0.33 b_b/(a + b_b) (Gordon/Morel), plus 2% Fresnel reflection of a blue sky.
- **Sanity:** clear-ocean Kd(490) ≈ 0.025–0.028 m⁻¹ at the default (C ≈ 0.03–0.05); Morel's clearest waters ≈ 0.022, typical open ocean ≈ 0.03 ✓. Red (650 nm)
  left at 1 / 5 / 10 / 30 m = 67% / 14% / 1.9% / ~0%; blue (450 nm) = 98% / 88% / 78% / 47%.
  Matches the diver's rule that red is gone by ~10 m. At C = 1 mg m⁻³, Kd(490) ≈ 0.08 vs Morel
  & Maritorena's ≈ 0.09 (close enough for the lesson).
- Depth axis is squeezed (√z) and labelled. The red wetsuit is lit by the light at the diver's
  depth and re-exposed like a diver's adapted eye.

## Chapter 7: thin films
- Exact single-layer **Airy reflectance** at normal incidence, unpolarised, for each wavelength,
  lit by sunlight, against black. Soap: n = 1.33 in air; oil: n = 1.47 on water (1.33).
- Sanity: soap R_max = 7.7%, matching the two-beam limit 4r²/(1+r²)² = 7.5% (r = 0.14). Thickness
  < ~30 nm reflects < 20% of the maximum, which is the "black film" just before popping. Colour
  sequence with thickness follows Newton's series (white → magenta near 200 nm → green near
  300 nm → magenta ≈ 400 nm …).
- Oil on water: the two reflections have unequal strength (r = 0.19 vs 0.05), so the
  cancellation is never complete. No black, washed-out colours, as on a real road.
- The thickness field (draining wedge + swirl; oil lens) is a plausible sketch, not a fluid
  simulation. Films "live" a minute then re-form. Colours are exposed ×9 (soap) / ×16 (oil),
  because films reflect only a few % of the light.
- Wave rows: amplitudes r₁ and (1−r₁²)r₂ with the extra path 2nd. The phase flip at the front
  surface is carried by the sign of r₁. Wavelength on screen is schematic.

## Chapter 8: cones
- Cone responses L, M, S from the CIE observer via the **Hunt–Pointer–Estevez** matrix, each
  normalised to a peak of 1. These are close to, but not the same as, the Stockman–Sharpe cone
  fundamentals. Fine for the shapes and the lesson, not for colorimetry.
- Lamps at 630 / 532 / 450 nm, **balanced like a screen** (solved so that all three at full = white).
- "Looks like pure X nm" test: nearest point on the spectral locus in cone chromaticity
  (L, S)/(L+M+S), within 0.012. Otherwise, L and S active with M quiet → "not in the rainbow"
  (magenta / pink).

## Mobile
- At ≤ 960 px each chapter shows its first two paragraphs, then the interactive, then the rest
  (`.after`), the try-it and the takeaway. The hero starts the Sun at 14° on phones so it isn't
  hidden behind the headline. Mouse users can drag the Sun on the hero; touch keeps scrolling
  (the slider moves it).

## QA notes
- The shared test browser (~1.5 fps, no GPU) often can't take full-page screenshots of the
  pages with animated canvases. QA was done by grabbing canvases with `toDataURL`, plus
  headless node runs of all the physics above.

## Next
- Polarisation chapter (sunglasses, the polarised sky at 90° from the Sun, Brewster angle).
- Green flash; why the Moon's sky is black (partly covered by the "No air" button).
- Multiple-scattering approximation for a brighter horizon and twilight.
- Card / OG images (`card.jpg`, `og.jpg`) rendered from the hero at sunset.
