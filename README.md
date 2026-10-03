# SKYBREAK — Glass Meridian (v4)

An original, single-player browser flight game. Version 4 adds a six-mission campaign, local pilot progression, countermeasure decoys, threat visualization and configurable cinematic rendering. **AI Duel Series** still uses one rival at a time, five two-minute rounds, manual cannons and equal-performance SF–29 loadouts. Missile Operation, Free Hunt, Last Stand and Flight Practice remain available. There is no multiplayer backend, account, paid key or shared online score.

## New in Glass Meridian

- **Readable missile threats:** bright red hostile exhaust/tracers, triangular missile markers, off-screen indicators, range, closing-time estimate and left/right warning tones. The alarm accelerates with time-to-impact. Colourblind mode substitutes amber and retains shape/text information.
- **Reliable countermeasures:** F creates a two-second decoy cloud with a 1,100 m capture radius and 2.5-second recharge. Approaching seekers turn toward the displaced cloud, including missiles arriving after deployment. Captured missiles cannot reacquire; their aircraft proximity fuse is disabled, but direct impacts still count. Last-instant flares are not invulnerability.
- **Local career:** 100 XP per kill, 200 per sortie victory, 300 bonus XP for five daily kills (UTC reset, once per day). Three cosmetic SF–29 configurations and three liveries unlock at published thresholds. Configurations share physics and hitboxes; they are not three independently simulated aircraft types. Settings and progress use this browser's localStorage, not a cloud account.
- **Six connected campaign sorties:** coastal interception; a 90-second airborne escort; a three-relay bombing strike with gravity bombs and an impact predictor; storm interception; night interception; and a 300-health ace boss. Completing a mission unlocks the next; unlocked missions remain replayable. Three lives per mission. Respawn downtime does not consume the objective timer.
- **AI tactics:** aggressive, defensive and stand-off/sniper styles. Rookie, Regular, Veteran and Ace tune pursuit/firing/defensive behaviour; Training suppresses enemy fire. Equal duel damage is preserved.
- **Expanded missile loadout:** agile IR (2,400 m lock, 3.5-second motor) or faster, less agile LR (3,600 m lock, five-second motor). Both reload in one second. T gives a three-second afterburner burst with a 12-second activation cooldown outside cannon modes. Green repair caches restore 35 health; gold resupply caches reset weapon/flare/boost cooldowns. Missiles remain unlimited; these are cooldown pickups, not finite-ammunition crates.
- **Weather and lighting:** clear, sunset, fog, storm rain, night or a gradual time cycle across the existing arenas. Campaign weather is mission-authored. Lit city window bands and instanced runway edge lights improve night navigation. Weather is visual/visibility-based, not a new wind/turbulence physics model.
- **Cinematic options:** light screen-space bloom, optional high-speed radial blur, localized engine heat shimmer, wingtip vapour, a supersonic shock ring, damage smoke/sparks, destruction debris and a 3D display bay. These are performance-conscious procedural effects, not AAA assets or physically simulated volumetrics.
- **Uninterrupted combat:** no kill-cam or slow-motion replay. Kills immediately return to the active engagement; the ordinary duel round-result transition remains.
- **Readable HUD:** glass/classic/minimal layouts, cyan/green/amber colours, adjustable text/panel scale, FPS toggle and persistent preferences. Auto-quality switches from High to Performance after sustained sub-35 FPS samples. Touch controls include boost and strike bombs; desktop remains the primary target.

New keys: **T** afterburner; **U** gravity bomb during the strike mission. Use **F** as soon as the close-missile warning requests it, then turn away. Ordinary collision and terrain hazards remain active.

The campaign route selector is a six-step mission list, not a geographical mission-map editor. New systems have automated regression coverage; cross-device balancing, full campaign human playthroughs, gamepad controls, advanced structural damage and online multiplayer remain future work. Do not describe the game as bug-free or certified production-ready.

This is not GTA V or MTA, and does not reproduce their private physics or licensed maps. All aircraft, environments, textures, music and interface graphics are procedural originals. Flight is a tuned sport-flight game model, not a certified simulator.

## Run locally

From this repository in Warp or Terminal:

~~~sh
npm start
~~~

Open [localhost:3040](http://localhost:3040/). Keep the terminal running; Ctrl+C stops it. If that port is occupied, the game may already be running. The server never kills an existing process. For a second instance:

~~~sh
PORT=3041 npm start
~~~

Node.js 20+, WebGL 2 and browser graphics acceleration are required. No dependency installation or internet is needed for normal localhost play.

## Files and packaging

- `public/index.html`: complete authored game: HTML, CSS, inline gameplay scripts, shaders, procedural assets and audio.
- `public/skybreak.html`: byte-identical standalone source entry.
- `public/vendor/`: local Three.js 0.180.0 renderer and MIT attribution. The source HTML falls back to unpkg only if the local renderer is unavailable.
- `public/offline/index.html`: portable HTML with the renderer embedded. Regenerate it after edits with `npm run build:offline`.
- `server.mjs`: localhost-only static server with path/method validation, security headers, HEAD/ETag support and graceful shutdown.
- `tests/`: tests that execute the delivered inline implementations, not a second copy of game logic.

Copy the offline HTML to another machine to play without Node. Direct-file launch must still be tested in the target browser; the in-app test browser blocks file URLs. Device speech may use a browser service: choose an **on device** voice for offline speech.

## Controls

| Action | Keys / mouse |
| --- | --- |
| Steer and aim | Mouse / trackpad; assisted heading control by default |
| Pitch / bank | W/S and A/D, or arrow keys |
| Yaw | Q/E |
| Throttle up | Shift or + |
| Throttle down + airbrake | Z or Ctrl; Z avoids Mac browser shortcuts |
| Throttle down only | − |
| Fire equipped weapon | Hold left click, Space, X or Enter |
| Landing gear | G |
| Eject in Last Stand | J |
| Flares in missile modes | F; 2.5-second recharge |
| Wings-level recovery | Hold L; not automatic obstacle avoidance |
| Recenter aim / change chase distance | R or right click / C |
| Pilot view | V |
| Capture mouse / controls / pause | M / H / Escape |
| Inspect aircraft hitboxes | B |

Numeric keypad: 8/2 pitch, 4/6 bank, 7/9 yaw, +/− throttle, 0/Enter/decimal fire. No number pad is required. Touch controls include a flight stick, drag-to-aim, fire, throttle, yaw and gear/flare buttons. Desktop/laptop is the primary target.

Launching requests pointer lock. If the embedded browser refuses it, uncaptured mouse/trackpad movement over the canvas still works; M retries capture. Stop moving the mouse to settle onto the requested heading. Manual keyboard inputs override assisted heading. In H / Pause, disable **Assisted mouse flight** for keyboard flight with independent mouse-camera look.

Sensitivity, inversion, audio, visual quality and camera-effect preferences are saved locally. Reduced motion disables decorative motion/shake; actual flight necessarily moves.

## AI Duel Series

Five rounds, each capped at **120 seconds of active play**. Kill the opponent or make it crash to earn one point. Your destruction loses the round. Timeout and same-simulation-tick mutual destruction are draws with no points. All five rounds are played; the higher score wins, and tied scores remain tied.

Pause freezes the round and phase clocks. A four-second verdict and two-second next-round countdown restore both aircraft, clear projectiles and reset heat/gear while retaining the series score. AI callsigns rotate; there are no simulated waiting humans.

Both sides use the same 100-health SF–29 and fixed cannon:

- **500 m** maximum travelled path from the muzzle.
- **1,300 m/s** muzzle velocity plus aircraft velocity.
- **Eight rounds/second**, **25 damage per hit**: four hits kill in under half a second.
- Swept compound oriented aircraft boxes, nearest-world-obstruction checks, no homing or proximity fuse.
- Short bursts control heat. Continuous fire overheats; cooling must fall below the recovery threshold.
- The small circle shows the aircraft's actual firing line. The diamond predicts relative target motion; it is only an aiming aid, never an automatic hit.
- Training disables return fire. Regular and Ace alter AI decisions, not weapon damage.
- No check-six warning or missile lock in this mode. Positioning matters.

## Last Stand

A separate air-to-ground challenge, not a continuation of competitive 1v1 scoring. Fight three AI aircraft with the cannon. On destruction, after 120 seconds, or on pressing J, move to a fixed ground-defence position.

Mouse/trackpad or arrows aim the railgun. Click / Space fires instantly along the sight: **1,600 m range, 100 damage, three-second recharge**. Terrain and structures stop shots. Destroy three aircraft within 90 seconds before the position's health reaches zero. The AI can strafe the position with the same cannon used in the air.

This is a stationary emplacement, not an on-foot shooter. There are no airborne controls or engine sound while grounded. The carrier position is on its flight deck.

## Nine original theaters

These are original environments inspired by landmark *types*, not copied GTA assets.

| Theater | Flight environment |
| --- | --- |
| Rift Valley | Rust/teal mountain canyons, spires, low mist |
| North Point | Coastal airfield, urban blocks, bridges, gantries, cooling towers |
| Meridian International | Parallel runways, terminals, hangars, control tower, elevated crossing |
| Bastion Air Station | Hardened structures, radar/control towers, overpass |
| Dustline Airfield | Desert strip, outcrops, long viaduct |
| Glass Harbor | High-rise blocks, river corridor, bridges |
| Resolute | Ocean, carrier deck, island superstructure, escort ships |
| Orchard County | Fields, silos, barns, railway crossing |
| Aeolus Ridge | Rolling hills and 25 rotating wind turbines |

Any theater works with any mode. New arenas build lazily; static geometry is batched by material. Colliders are theater-specific, so hidden structures cannot cause collisions. Terrain rendering and collision share sampled triangles. Wind blades have rotating box colliders with genuine gaps, not an invisible solid disc. Major structures use boxes; small decorative details are not all physical. North Point retains three scored fly-through gates.

## Retained missile modes

**Operation:** eight kills, three lives, four minutes. Destruction triggers a 3.5-second redeployment with three seconds of weapon-damage protection, not terrain immunity. The operation clock continues during redeployment but freezes when paused.

**Free Hunt:** unlimited redeployments and no time limit. Choose three, five or seven simultaneous opponents.

**Flight Practice:** no enemies or clock; learn throttle, recovery, energy and terrain clearance.

The compact missile ring acquires in 0.35 seconds with assisted flight or 0.65 seconds in classic mode, within 2,400 m and clear line of sight. Every launch reloads in one second. Once launched, a missile retains its original target. A five-metre swept proximity fuse requires an unobstructed path to the target. After 3.5 seconds of powered guidance, the missile falls ballistically; lifetime is capped at 12 seconds.

Player missiles deal 100 damage; AI missiles deal 38. These asymmetric missile settings are separate from the identical duel cannon loadouts. Flares recharge in 2.5 seconds and create a two-second decoy cloud that captures seekers inside 1,100 m without erasing their projectiles. A direct impact can still collide; turn away after deploying.

## Flight, graphics and audio

Fixed 120 Hz simulation with bounded catch-up, quaternion attitude, lift/gravity/thrust/drag, engine spool, induced drag, coordinated banking and a forgiving −3 to +9 G envelope. The 125–155 m/s corner-speed window rewards energy management. Landing gear adds actual drag at unchanged throttle. Health never reduces control authority at any positive value.

Aircraft render poses interpolate between physics ticks. Chase attitude and relative boom are damped, while translation stays attached to the aircraft. Terrain checks constrain the camera. HUD instruments expose velocity, altitude, flight-path vector, angle of attack, load, ground clearance, energy and weapons. Pause/focus loss clears held inputs and stops simulation.

The SF–29 has panel seams, reflective canopy, twin exhausts, animated plumes, gun flash and deploying gear. Original sky/water/rock shaders, pooled particles and blasts, soft directional shadows and lazy/batched environments keep assets local. Performance mode removes shadows and reduces pixel ratio. Hardware-independent FPS is not guaranteed.

**Iron Meridian** is an original procedural 148 BPM metal-inspired score generated with Web Audio. Device/browser speech provides event-linked radio. Voice priority, expiry, ducking and captions avoid stale overlapping calls. Music, voice and effects have settings; sound starts only after a user gesture. Muting and pausing stop active audio.

## Verify and release

~~~sh
npm run verify
~~~

This regenerates the offline artifact and runs physics, weapon-runtime, round-state, terrain, audio, server, source-parser and packaging checks. Duel tests cover scoring/draws, lethal bursts, heat, gear drag, actual cannon/railgun collision, blocked fire, pool cleanup, all arena builders, bridge openings and moving turbine blades.

See `RELEASE-CHECKLIST.md` for browser/device, long-session performance, playtesting and release gates. Unit tests and the in-app browser do not establish bug-free commercial readiness or Safari/Firefox compatibility.

## Hosting

The existing project uses **Vercel static hosting**. Import the repository with Framework **Other**, root `./`. `vercel.json` builds the offline file and publishes only `public`; it needs no secrets or server process. Do not use `npm start` as the Vercel build command.

The game stays single-player even when publicly hosted. Changes to local files do not update the live Vercel site until a new deployment is made. The optional `ci/game-workflow.yml` template can be copied to `.github/workflows/game.yml` with an account authorized to manage workflows; it is not enabled automatically.

The earlier edition remains at `/homing-legacy.html` and is documented in `README.homing-legacy.md`. Retain the included Three.js MIT license. No proprietary GTA assets are bundled.
