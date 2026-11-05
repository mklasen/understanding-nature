# Understanding Nature

A growing library of **interactive explainers** about how the natural world works —
play with the ingredients, see the consequences.

**▶ https://mklasen.github.io/understanding-nature/**

| Explainer | Category | Status |
|---|---|---|
| [Waves & tides](site/waves/) — *There's never the same wave twice.* | Oceans & Earth | live |
| [Earth, Moon & Sun](site/orbits/) — *You are not sitting still.* | Sky & Space | live |
| Weather — *Why does the wind blow?* | Weather & Climate | being built |
| Light & colour — *Why is the sky blue?* | Light & Sound | being built |

More are planned (sound, earthquakes, ocean currents, northern lights, snowflakes, scaling laws) —
see [`site/kit/catalog.js`](site/kit/catalog.js).

## How it's built
Static site, vanilla ES modules, **no build step, no dependencies**. Open `site/` with any static
server (`python3 -m http.server -d site`) or `docker compose up -d`.

```
site/
  index.html, landing.*   the library front door (grid generated from the catalogue)
  kit/                     shared by every explainer
    kit.css                layout, controls, readouts, mobile-first rules, themes (data-theme)
    util.js                canvases, run-only-when-visible loops, sliders, formatting
    chapters.js            isolated chapter loader, chapter-bar highlight, "aha" boxes
    library.js             home link, cross-link chips, "more explainers" footer
    catalog.js             every explainer + categories + cross-links (single source of truth)
  waves/  orbits/  …       one folder per explainer: index.html, js/, css/<name>.css, DECISIONS.md
tools/
  port-explainer.py        import/re-sync an explainer from a standalone project
  browser-lock             share the one test browser between sessions
```

Every explainer keeps a `DECISIONS.md`: the model, the simplifications, and what's next.
See [CONTRIBUTING.md](CONTRIBUTING.md) for how to add one.
