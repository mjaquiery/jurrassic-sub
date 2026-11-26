# Jurassic Sub

A gentle 3D underwater game for a three-year-old (and their grown-ups). Pilot a little yellow submarine through the Jurassic seas over what is now Oxford (Oxford Clay, about 165 million years ago) and meet the sea life.

**Play:** https://mjaquiery.github.io/jurrassic-sub/ — on an iPad, use Share → Add to Home Screen for a fullscreen, offline copy.

## How it plays
- Pick a dive site on the start screen: Clay Bay, Coral Garden or Deep Blue (🗺️ in the corner goes back to the menu).
- You look out from inside the sub (a little 1 m kid sits beside you for scale). Touch and hold anywhere on the window: the sub glides towards where you point. Let go and it drifts to a stop.
- Bring a creature or plant to the middle of the screen (the dotted circle) and it shows up on the dashboard screen.
- Press the dashboard screen to look down at it: a portrait, simple facts, who it eats and who eats it, and a pointer to the real fossils at the Oxford University Museum of Natural History.
- Tap or bump something and it wiggles, makes a noise, and swims off.
- Animals hunt, flee and graze on their own: a catch is either a cartoon gulp (the eaten one pops like a bubble and returns elsewhere) or a lucky escape. Plants get nibbled and grow back.
- A glowing striped wall appears at the edge of each zone; touch it and you boing back in.
- Let go and the sub drifts down to just above the sea floor, where the plants and most animals are.
- No scores, timers, failure or reading needed.

## Tech
Vite + TypeScript + Three.js, deployed to GitHub Pages by `.github/workflows/deploy.yml` (`main` → site root, pull requests → `/stage`). A generated service worker precaches everything so it works offline.

- Creatures and plants are built in code from low-poly shapes (`src/species.ts`), so there are no model licences to track. The food web is the `FOOD_WEB` table there; dive sites are in `src/regions.ts`; hunting, grazing and respawning is `src/ecology.ts`.
- One world unit is roughly a metre.
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
