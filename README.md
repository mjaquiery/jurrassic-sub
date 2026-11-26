# Jurassic Sub

A gentle 3D underwater game for a three-year-old (and their grown-ups). Pilot a little yellow submarine through the Jurassic seas over what is now Oxford (Oxford Clay, about 165 million years ago) and meet the sea life.

**Play:** https://mjaquiery.github.io/jurrassic-sub/ — on an iPad, use Share → Add to Home Screen for a fullscreen, offline copy.

## How it plays
- Touch and hold anywhere: the sub glides towards where you point. Let go and it drifts to a stop.
- Bring a creature to the middle of the screen (the dotted circle) and a portrait pops up with its name.
- Press the portrait for simple facts (and a pointer to the real fossils at the Oxford University Museum of Natural History).
- Tap or bump a creature and it does a barrel roll, makes a noise, and swims off.
- No scores, timers, failure or reading needed.

## Tech
Vite + TypeScript + Three.js, deployed to GitHub Pages by `.github/workflows/deploy.yml` (`main` → site root, pull requests → `/stage`). A generated service worker precaches everything so it works offline.

- Creatures are built in code from low-poly shapes (`src/species.ts`), so there are no model licences to track.
- Portraits are rendered from those same models at start-up (`src/portrait.ts`).
- All sound and music is synthesised with WebAudio (`src/audio.ts`): no audio files.

```
npm install
npm run dev        # local dev server
npm test           # unit tests
npm run test:e2e   # browser tests (needs: npx playwright install chromium)
npm run build
```

## Not yet verified
Only tested in desktop Chromium (CI). Not yet tried on a real iPad: check touch steering, audio unlock and the Add to Home Screen flow.
