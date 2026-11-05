# Brief: Understanding Weather  (explainer id: `weather`, theme: `sky`)

Part of the **Understanding Nature** library. Read `../README.md` and `../CONTRIBUTING.md` first, and
look at `site/waves/` and `site/orbits/` for the house style. Inspiration, not a rigid spec.

## The curiosity to answer
- **Why does the wind blow at all?** The Sun heats the ground unevenly → warm air rises, pressure
  differences → air flows from high to low pressure. Sea breeze by day, land breeze at night is the
  perfect first interactive (heat the land/sea, watch the circulation start).
- **Why do storms spin, and why the opposite way in each hemisphere?** The Coriolis effect from
  Earth's rotation (cross-link → `orbits#day`). Show air "aiming" for a low and being deflected.
- **Why is wind faster high up / over sea, and why gusty?** Friction with the surface.
- **How do clouds form?** Rising air cools (adiabatic lapse rate) until it hits the dew point —
  cloud base. A rising parcel you can push (humidity, temperature) is the core sim.
- **Weather fronts and why a low brings rain.** Warm vs cold fronts as a cross-section.
- **Seasons drive the weather** (← `orbits#seasons`) and **wind makes waves** (→ `waves#wind`).
- Optional: why you can see your breath, thunderstorms, global circulation cells / trade winds.

## Suggested chapters (adjust freely)
1. Sun heats unevenly → pressure → wind (sea-breeze cell simulation)
2. High and low pressure; isobars; wind speed from the pressure gradient
3. Coriolis: why storms spin (rotating-frame toy)
4. Rising air and clouds (parcel, lapse rate, dew point, cloud base)
5. Fronts and rain
6. The global engine (Hadley cells, trade winds, jet stream)
7. Summary: weather vs climate in one breath

## Notes
- Real physics where it teaches (ideal gas, lapse rate ~9.8 °C/km dry / ~6 °C/km moist, Coriolis
  f = 2Ω sin φ), honest labels for exaggeration, DECISIONS.md with sanity checks.
- Mobile first. Canvas2D (no WebGL in the test browser).
- Add your chapter ids to `site/kit/catalog.js` (status stays `building` until the user says live).
