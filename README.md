# Gun Shot — Ozo's Adventure

A colourful solo run-and-gun platformer for ages 9–11, built with Phaser 4 and Vite. The first playable level, **Canopy Coast**, stars Ozo: a two-legged toucan with a toy-like pop blaster.

**Graphics are placeholders for now:** chunky pixel art and a plain menu, so work can focus on gameplay. Every sprite is a small grid of letters in `src/game/sprites.js`, so you can redraw one in a text editor. The earlier painted artwork and styled menus are kept in `archive/painted-v1/`.

## Run locally

Open a terminal in this folder and run:

```powershell
npm install
npm run dev
```

Open the local URL printed by Vite. Stop the server with Ctrl+C.

For a phone or tablet on the same Wi-Fi/network, run:

```powershell
npm run dev -- --host 0.0.0.0
```

Open Vite's **Network** URL on the device. Landscape works best. The computer must stay on with the server running; a firewall may need to allow Node on your private network.

## Controls

| Action | Touch | Keyboard |
| --- | --- | --- |
| Move / face direction | Drag the thumbstick left or right | A/D or left/right arrows |
| Jump (tap for a short hop, hold for full height) | JUMP | Space, W or up arrow |
| Shoot | Hold SHOOT | Hold X or J |
| Dash, once purchased | Tap DASH | Shift |
| Glide, once purchased | Hold JUMP while falling | Hold a jump key while falling |
| Pause | Top-right pause button | Escape |

Shooting follows the direction Ozo faces. Touch controls support holding movement, jump and shooting together. Audio can be muted; the game pauses if the tab loses focus.

## First level

- Six enemies: Snappers have 4 health and ranged Spitters have 6, shown in health pips. Your shots and the pink enemy shots pass through each other, so dodge them.
- One obstacle type: a 12-health stone wall. Repeated shots crack it, knock off upper stones, and finally collapse it completely. Enemy shots cannot damage it.
- Shots travel 360 world pixels from the muzzle; Long shot extends this to 540. Both blasters use the same range upgrades. Enemy shots also have a finite range.
- Raised platforms allow jumping through from below and landing on top. Ground remains solid.
- Three hearts, with brief protection after a hit. On death Ozo freezes, becomes black, and a heart appears and shatters. Try Again restarts the entire level, enemies and puzzle. After Ozo touches the checkpoint flag just past the wall, he can start again there instead: the wall stays down and loot picked up before the flag is kept.
- Defeated enemies drop gun coins and research where they stood. Loot only drifts to Ozo when he is very close.
- A heart sits high above the ledges before the wall. It gives back one lost heart and stays put while Ozo's hearts are full.
- The camera looks ahead in the direction Ozo faces. Snappers get knocked back when hit; the screen flashes red and the hearts shake when Ozo is hurt.
- Tutorial tips float in the sky. At the end Ozo hops into the birdhouse.
- The level is paced so each idea gets its own stretch: move, jump, shoot, dodge pink shots, heal, break the wall, then all together.
- The Nest (upgrade shop) spends research on higher jumps, speed, dash and glide. Gun coins buy more shot damage, longer range and a Twin Pop blaster.
- All necessary jumps and the puzzle work with the starting abilities. Talents are optional.
- For testing, the Nest has a **Reset save** button (tap twice) that returns loot, upgrades and best time to a fresh start.
- Coins and research picked up in a level only count if Ozo reaches home; die or restart and that loot is lost. Purchased upgrades, banked loot and the equipped gun persist on this browser/device. If browser storage is unavailable, the game still works for the current session.

## Build and check the production version

```powershell
npm run build
npm run preview
```

The production site is built into `dist/`.

## Tweaking gameplay

- **`src/game/tuning.js`** holds every gameplay number: run speed, jump strength, coyote time, dash, glide, fire rate, shot range, enemy health and speeds, wall health, loot. Change a value and save; the dev server reloads the game.
- **`src/levels/canopy.js`** holds the level layout: ground and pits, ledges, enemies and their patrol areas, pickups, the wall, the exit and the tutorial tips.
- **`src/game/sprites.js`** holds the pixel art.
- Add `?debug=1` to the dev server address to see collision boxes. In the browser console, `game` gives you the running game.

## Project files

- `src/main.js` starts Phaser and controls the game size and physics.
- `src/scenes/LevelScene.js` builds a level from its layout file and runs movement, enemies, combat and effects.
- `src/game/tuning.js` gameplay numbers; `src/levels/canopy.js` the first level's layout.
- `src/game/sprites.js` the pixel art; `src/game/art.js` turns it into textures.
- `src/game/combat.js` contains swept projectile collision, range and platform rules.
- `src/game/state.js` defines currency, purchases and saved progress.
- `src/game/ui.js` handles touch/keyboard controls, menus and the Nest (upgrade shop).
- `src/game/audio.js` synthesizes the short sound effects.
- `src/style.css` controls the (deliberately plain) responsive interface.
- `DESIGN.md` records the agreed direction and prototype assumptions.
- `archive/painted-v1/` is a copy of the painted-art version. Nothing in it is built.
- `.github/workflows/deploy.yml` builds and deploys the game from the `main` branch.

## Gameplay verification

`npm test` checks swept collisions, range limits, one-way platforms, health balancing, purchases, saved progress and storage restrictions.

While the development server is running, open `/?verify=1` and use the six check buttons. These exercise the actual scene and physics: a full route with no talents, damage/death/restart, purchases/abilities/weapons, projectile and wall regressions, jumping through platforms / boosted movement / short hops, and the checkpoint. The checks read their numbers from `tuning.js` and the level file, so run them after changing either. The route check does not teleport Ozo or make him invincible; the focused regression fixtures deliberately position actors to reproduce specific situations. The verification session uses a temporary in-memory profile and never overwrites saved progress. The runner is excluded from the production build.

## Publish on GitHub Pages later

Create an empty GitHub repository, then run these commands from this folder, replacing the example URL with your repository URL:

```powershell
git add .
git commit -m "Add Gun Shot first playable level"
git remote add origin https://github.com/USERNAME/REPOSITORY.git
git push -u origin main
```

In the GitHub repository, open **Settings → Pages** and set **Build and deployment → Source** to **GitHub Actions**. The **Deploy game to GitHub Pages** workflow runs when you push to `main`. You can also run it manually from the Actions tab.

Vite uses relative asset paths so the game can be hosted under a GitHub Pages repository URL without changing the repo name in the config. When loading future assets from JavaScript, use imports or prefix public asset URLs with `import.meta.env.BASE_URL`.
