// The library's single source of truth: every explainer, live or planned.
// The landing grid, the "more explainers" footer and cross-link chips all read this.
//   status: 'live' | 'building' | 'planned'
//   chapters: id → title, so cross-links can say where they lead.

export const CATEGORIES = [
  { id: 'earth', name: 'Oceans & Earth', blurb: 'Water, rock and the forces that shape the planet.' },
  { id: 'space', name: 'Sky & Space', blurb: 'How we move, and what moves around us.' },
  { id: 'weather', name: 'Weather & Climate', blurb: 'Air, heat and water on the move.' },
  { id: 'light', name: 'Light & Sound', blurb: 'The waves we see and hear.' },
  { id: 'life', name: 'Life', blurb: 'The physics of living things.' },
];

export const EXPLAINERS = [
  {
    id: 'waves', path: 'waves/', status: 'live', category: 'earth', theme: 'ocean',
    title: 'Understanding Waves', short: 'Waves & tides',
    hook: "There's never the same wave twice.",
    blurb: 'Wind, swell, tsunamis, the beach — and why the tide is something else entirely.',
    image: 'waves/card.jpg',
    chapters: {
      crowd: 'Every wave is a crowd', wind: 'Making waves', energy: 'Energy, not water', swell: 'Swell',
      tsunami: 'Tsunamis', tides: 'Tides', beach: 'The beach', ripples: 'Ripples', summary: 'Waves, tsunamis, tides',
    },
  },
  {
    id: 'orbits', path: 'orbits/', status: 'live', category: 'space', theme: 'space',
    title: 'Understanding Orbits', short: 'Earth, Moon & Sun',
    hook: 'You are not sitting still.',
    blurb: 'Day and night, seasons, the Moon, eclipses, orbits — and the corkscrew you trace through space.',
    image: 'orbits/card.jpg',
    chapters: {
      day: 'Day & night', seasons: 'Seasons', moon: 'The Moon', eclipses: 'Eclipses', falling: 'Falling sideways',
      kepler: "Kepler's laws", retrograde: 'Backwards planets', speed: 'How fast are we going?', summary: 'Motion is relative',
    },
  },
  {
    id: 'weather', path: 'weather/', status: 'building', category: 'weather', theme: 'sky',
    title: 'Understanding Weather', short: 'Wind, clouds & storms',
    hook: 'Why does the wind blow?',
    blurb: 'Pressure, sea breezes, why storms spin, and how clouds form.',
    chapters: {
      breeze: 'The sea breeze', pressure: 'Highs and lows', spin: 'Why storms spin', friction: 'Friction and gusts',
      clouds: 'How clouds form', fronts: 'Fronts and rain', global: 'The global engine', summary: 'Weather vs climate',
    },
  },
  {
    id: 'light', path: 'light/', status: 'building', category: 'light', theme: 'light',
    title: 'Understanding Light & Colour', short: 'Why the sky is blue',
    hook: 'Why is the sky blue — and sunsets red?',
    blurb: 'Scattering, rainbows at 42°, the colour of the sea, and light as a wave.',
  },
  { id: 'sound', status: 'planned', category: 'light', title: 'Sound & Music', short: 'Waves you can hear', hook: 'Why does a flute sound different from a guitar?', blurb: 'Harmonics, echoes, and the passing siren.' },
  { id: 'quakes', status: 'planned', category: 'earth', title: 'Earthquakes & Moving Continents', short: 'The restless ground', hook: 'Why do the biggest quakes happen where they do?', blurb: 'Plates, faults, volcanoes and seismic waves.' },
  { id: 'currents', status: 'planned', category: 'earth', title: 'Ocean Currents', short: 'The great conveyor', hook: 'Why is Western Europe so mild?', blurb: "The planet's heat pump, from the Gulf Stream to the deep ocean." },
  { id: 'aurora', status: 'planned', category: 'space', title: 'Northern Lights', short: "Earth's magnetic shield", hook: 'What is the sky actually doing?', blurb: 'The solar wind meets the magnetosphere.' },
  { id: 'snow', status: 'planned', category: 'weather', title: 'Snowflakes', short: 'No two alike', hook: 'Why is every snowflake different?', blurb: 'Crystals, humidity and temperature — growth you can steer.' },
  { id: 'scale', status: 'planned', category: 'life', title: 'Why Animals Are the Size They Are', short: 'Scaling laws', hook: 'Why can an ant fall from any height?', blurb: 'Square–cube law, bones, heat and flight.' },
];

export const byId = (id) => EXPLAINERS.find((e) => e.id === id);

// Cross-links between explainers, kept here (not in each page) so they survive re-syncs
// and can be curated in one place. Each one is appended to the end of a chapter's text.
//   from: explainer id · chapter: section id there · x: 'explainer#chapter' · text: the hook
export const XLINKS = [
  { from: 'waves', chapter: 'wind', x: 'weather', text: 'But where does the wind itself come from?' },
  { from: 'waves', chapter: 'tsunami', x: 'quakes', text: 'Why does the seafloor jump?' },
  { from: 'waves', chapter: 'tides', x: 'orbits#moon', text: 'How the Moon moves, and why it changes shape' },
  { from: 'waves', chapter: 'ripples', x: 'light', text: 'Light is a wave too' },
  { from: 'orbits', chapter: 'moon', x: 'waves#tides', text: 'The Moon also stretches the oceans into tides' },
  { from: 'orbits', chapter: 'day', x: 'waves#tides', text: "Earth's spin under the Moon gives us two tides a day" },
  { from: 'orbits', chapter: 'seasons', x: 'weather', text: 'How the seasons drive the weather' },
  { from: 'weather', chapter: 'spin', x: 'orbits#day', text: 'The spinning Earth underneath the wind' },
  { from: 'weather', chapter: 'friction', x: 'waves#wind', text: 'What the wind does to the sea' },
  { from: 'weather', chapter: 'clouds', x: 'light', text: 'Why are clouds white, and the sky blue?' },
  { from: 'weather', chapter: 'global', x: 'orbits#seasons', text: 'Why the Sun shifts north and south through the year' },
];
