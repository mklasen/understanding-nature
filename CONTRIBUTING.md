# Building an explainer in Understanding Nature

These are the house rules — for humans and for the Claude sessions that build here.

## Shape of an explainer
- Folder `site/<id>/` with `index.html`, `js/main.js`, one module per chapter, `css/<id>.css`, `DECISIONS.md`.
- `<body data-theme="ocean|space|sky|light" data-explainer="<id>" data-root="../">`, link
  `../kit/kit.css` then `css/<id>.css`.
- `main.js`: `initLibrary()` then `bootChapters((f) => import(`./${f}`), [['chapter.js', 'initChapter'], …])`.
- Chapters: `<section class="chapter" id="…">` with `.text` (story) and `.stage` (canvas + controls +
  readouts). Use `.try`, `.aha`, `.after` as in the existing explainers. Add the explainer (and its
  chapter ids) to `kit/catalog.js`; cross-links go in `XLINKS` there, not in your HTML.

## Principles (learned the hard way)
- **Mobile first.** Most readers are on phones. At ≤960px the layout becomes intro → stage →
  try-it/takeaway; readouts become label/value rows. Check at 390×844 (an iframe page works, since the
  browser CLI can't resize the viewport).
- **Honest framing.** Lead with what's true in reality; label every exaggeration on the canvas
  ("heights ×19", "not to scale"); idealised numbers only as clearly-marked thought experiments.
- **Real physics where it teaches**, documented in `DECISIONS.md` with sanity checks (run the model
  headless in node and compare with real-world numbers before trusting the visuals).
- **Isolation.** One failing chapter must not blank the page. Declare state *before* `bindRange`
  (it fires immediately). Animate only while visible (`visibleLoop`).
- **No build, no CDN.** Vendor data if needed and keep its licence notice.

## Working alongside other sessions
- Only edit your own `site/<id>/` folder. Changes to `kit/` or `catalog.js` → keep them small and
  backwards-compatible, and mention them in the commit message.
- Commit only your paths: `git add site/<id> && git commit -m "<id>: …"`.
- Don't push or publish unless the user asks; publishing is done from the library session.
- **The test browser is shared.** `tools/browser-lock acquire <session>` before using it,
  `tools/browser-lock release <session>` when you pause. It runs ~1.5 fps and has no WebGL —
  snap simulation state via `browser eval` for visual QA, and ship a Canvas2D fallback for WebGL.
