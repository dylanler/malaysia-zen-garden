# Taman Kenangan · a Malaysian zen garden

A slow, walkable, sound-led Three.js zen garden built from Malaysian millennial memory, representing Malay, Chinese, Indian, Kadazan-Dusun and Iban cultures with equal weight.

One day, eight places, one path around a lake: a kampung at dawn, a padang and a wau, a rainforest waterfall at noon, rain on a zinc roof, padi at golden hour under Kinabalu, an Iban longhouse at sunset, a shophouse street at dusk with a kolam and cellophane lanterns, and a sampan crossing through fireflies back to a row of lit pelita. Everything is procedural: the landscape, every object and every sound is generated in the browser, so the whole garden ships as a single small bundle with no external assets.

Start with [PLAN.md](./PLAN.md) for the concept, station-by-station design, sound and art direction, cultural notes and the decisions taken while building.

## Running it

Requires Node 20 or newer.

```bash
npm install
npm run dev        # http://localhost:5173, also reachable from a phone on the same network
npm run build      # type-check (tsc) then bundle to dist/
npm run preview    # serve the production bundle locally
```

## Controls

The garden is first person. Free roam is the default; "Follow the path" (menu → Walking) is there for anyone who would rather be led.

- **Desktop:** `W A S D` to walk, move the mouse to look (the mouse is captured on the first click; `Esc` releases it and opens the menu), scroll to zoom, click / hold / drag with the centre reticle on things that glow, `E` or `Enter` also "clicks". Tap `Space` to auto-walk to the next place; any step of your own cancels it.
- **Touch:** joystick (bottom left) to walk, drag anywhere to look, pinch to zoom, tap things that glow. The round button (bottom right) walks forward while held and auto-walks to the next place when tapped.
- The sampan only knows the path: walking up to a jetty hands you to it for the crossing, and free roam comes back on the far shore.
- Cues appear as you come near: a ring on the thing itself and a hint at the bottom of the screen. Every interaction is a tap, a hold, a drag or a flick. Nothing can be failed and there are no timers.

Progress and settings are kept in `localStorage`; "Start the day again" in the menu clears progress.

## Deploying

The project is a static site. `vercel.json` configures Vercel to run `npm run build` and serve `dist/` with long-lived caching for hashed assets; importing the repository into Vercel is all that is needed, and every push to `main` deploys.

## Project layout

```
src/
  core/       App loop, input and gestures, interaction (raycast, markers, hands view), locomotion, time of day, weather, save
  world/      Terrain ring and lake, path spline, sky and Kinabalu, water shader, instanced vegetation with wind, props, textures, particles
  audio/      Web Audio engine and buses, procedural synth instruments and effects, pentatonic music walker and finale, ambience zones
  systems/    Hands view (bring an object close), Unwrap (staged peel/unfold gestures)
  stations/   The eight places, one file each, on a shared Station base
  content/    Station definitions: names, hours, intros, memory lines
  ui/         Title, station cards, hints, memory cards, menu and settings, progress dots
```

## Cultural care

Five cultures walk the same path with the same weight; each place has one thing to touch, one instrument in a shared pentatonic scale, and a few lines of memory. People are present only as traces. Festival lights are cultural lights; nothing sacred is made into a toy. Names and words in Kadazan-Dusun, Iban, Tamil and Chinese should be verified by native speakers, and each community should review its station, before the garden is considered finished. See PLAN.md §8.
