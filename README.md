# SKYBREAK — Rift Valley / Air Operations

An original single-player browser flight game inspired by the requested SAAF/Grafuroam combat presentation. The current edition defaults to **assisted mouse/trackpad flight and guided missiles with a one-second reload**. Rift Valley is a rugged rust-and-teal mountain arena with low valley mist; North Point remains available for coastal obstacle flying.

**public/skybreak.html** contains all HTML, CSS, shaders, flight logic, enemy AI, procedural scenery, synthesized audio and instruments. **public/index.html** is byte-identical and serves the localhost entry. Version 2.1 loads the included Three.js 0.180.0 renderer locally first; unpkg.com is only a fallback when the local renderer is missing. No build, package installation, account, or internet connection is needed for normal localhost play.

**public/offline/index.html** is the portable, self-contained edition: the same game plus the MIT-licensed renderer embedded in the HTML. It does not request external models, textures, fonts, scripts or audio files. Radio speech uses the browser/device's speech engine; choose an **on device** voice for offline speech. Copy that one file to your Mac and open it in a modern browser with WebGL 2 enabled. Its bundling and module integrity are automatically tested; direct-file browser launch could not be verified in the Codex in-app browser, which disallows file URLs.

This is not GTA V, MTA multiplayer, or a copy of the original servers' private physics or assets. All terrain, aircraft, architecture, textures and UI are generated in the game. Visual quality and performance depend on browser graphics acceleration and hardware.

## Run locally

In Warp or Terminal:

~~~sh
cd skybreak-dogfight
npm start
~~~

Open **http://localhost:3040/**. Keep the terminal running; Ctrl+C stops it. If port 3040 is occupied by another app, use **PORT=3041 npm start** and open http://localhost:3041/.

The localhost edition needs Node.js 20+, WebGL 2 and graphics acceleration. The server binds only to 127.0.0.1. If the port is occupied, it prints the existing URL and an alternative command without stopping another process. The offline edition removes the Node.js requirement. To regenerate it after editing the source, run `npm run build:offline` (uses only local files). The complete build-and-test command is `npm run verify`.

## Deploy on Vercel

Import this standalone repository into Vercel. Keep the **Root Directory** at the repository root (`./`) and the **Framework Preset** at **Other**. The included `vercel.json` sets the build command to `npm run build:offline`, skips dependency installation (there are no package dependencies), and publishes only the `public` directory. No environment variables or API keys are required.

Vercel serves the HTML, renderer and assets directly over HTTPS. Do **not** run `npm start` as the Vercel build command: `server.mjs` is only the local development server. The source, tests and server are in GitHub but are not part of the hosted output. The game remains local single-player even when the page is publicly hosted; it does not add multiplayer networking or shared scores.

After deployment, open the production URL, launch a sortie, test mouse controls, missile lock/fire, flares and audio, and check browser errors. Connecting the GitHub repository enables subsequent deployments through Vercel's Git integration. Vercel's [configuration reference](https://vercel.com/docs/project-configuration/vercel-json) documents the checked-in build/output settings.

The optional `ci/game-workflow.yml` template runs the complete verification suite on Node 22 and 24. To enable GitHub Actions, copy it to `.github/workflows/game.yml` using an account or credential authorized to manage workflows. It is not enabled by this initial deployment.

## Camera, aim and flight

**Assisted mouse flight** is enabled by default. Move your mouse/trackpad toward where you want to go; the jet steers, banks and levels automatically. Stop moving the mouse and it settles on that heading instead of continuing to circle. The small ring snaps onto a contact near your aim, making tracking easier. Hold Space to fire as soon as lock is confirmed. Press H and uncheck **Assisted mouse flight** for the previous classic keyboard-flight/independent-camera mode.

- **Mouse / trackpad movement:** steer toward your aim (assisted); independent camera look and aim (classic). New assisted settings use mouse-up to climb. Inversion remains optional.
- **W/S or Up/Down:** pitch up/down.
- **A/D or Left/Right:** bank left/right.
- **Q/E:** yaw left/right.
- **Shift or +:** increase throttle.
- **Ctrl or Z:** decrease throttle and hold the physical airbrake out. Z is the Mac-friendly alternative if a browser intercepts Ctrl combinations. Releasing retracts the brake; throttle stays at its new setting.
- **− / numeric keypad −:** decrease throttle without deploying the airbrake.
- **L, held:** wings-level recovery. Levels the bank and points toward the horizon; adds throttle at low speed. This is not obstacle avoidance and cannot guarantee recovery when too close to terrain.
- **Left click, Space, X or Enter:** launch a locked missile. Holding repeats only after the full reload.
- **F:** deploy flares. 2.5-second cooldown.
- **R or right click:** reset the aim along the aircraft's nose; assisted banking then returns to level.
- **C:** switch close/wide camera distance.
- **V:** switch between the pilot's forward view and chase camera. This is a clear forward camera, not a modeled cockpit.
- **M:** capture the mouse for continuous steering/look.
- **H:** controls guide; pauses active flight.
- **Escape:** pause/release mouse; resume from the pause screen.
- **B:** inspect actual aircraft collision boxes.

Optional numeric keypad: 8/2 pitch, 4/6 bank, 7/9 yaw, +/− throttle, and 0/Enter/decimal launch a missile. Key codes support the physical keypad even when Num Lock is off. A separate number pad is not required.

Launching or resuming requests mouse capture from the browser. If an embedded browser does not permit pointer lock, relative mouse/trackpad motion over the flight canvas still steers/aims. Click the flight view to focus the keyboard; use M to retry capture in a compatible browser. Moving outside the window is a limitation of the uncaptured fallback. Mouse sensitivity, inversion and assisted/classic mode can be changed while paused and are saved locally. Keyboard maneuver inputs override the assisted heading, so it will not pull you back toward an old aim point after a manual maneuver.

On touch devices, the left stick flies; drag the uncovered flight view to aim. Dedicated throttle, yaw, missile, flare and recenter buttons are provided. A laptop/desktop remains the primary play target.

Start with **Sortie → Flight practice** to learn the controls with no enemies, clock or life limit. The small white heading cue shows where you are asking to go. The green circle with wings is the **flight-path vector**, showing where your velocity is actually carrying you. In a hard turn these differ. Keep 450–558 km/h for dogfighting, add throttle before a climb, and ease the turn if the low-energy warning appears. The G meter, angle of attack (α), approximate Mach number, vertical speed (V/S) and height above terrain (AGL) explain the aircraft's energy state. Mach uses a fixed 340 m/s speed of sound; this is not an atmospheric instrument simulation.

Graphics quality is now adjustable in Pause without restarting. Quality, mute and camera-effect preferences are saved locally, alongside the existing mouse settings. Reduced-motion preferences continue to override cinematic motion effects. Flight motion itself cannot be removed.

## Missile system

There is **no cannon or rapid-fire weapon** in the current game.

1. Move your aim near a hostile. In assisted mode, contacts within 2.25 reticle radii are acquired; the ring moves onto the chosen aircraft. Tracking tolerates movement within 3.1 radii, but stops immediately on lost line of sight or range. The small cross/tether shows your actual heading aim. The visible ring stays 72 pixels across at 1280×720, capped at 80 pixels. Classic mode uses only the visible circle's radius.
2. White means searching; amber means acquiring. Assisted lock takes 0.35 seconds; classic lock takes 0.65 seconds. Target changes restart acquisition.
3. At red **LOCKED**, press Space/click/X/Enter. Line of sight must be clear and target range must be between 12 and 2,400 metres.
4. Every launch starts an exact **1-second reload**. A circular loading indicator and numeric timer show readiness. No ammunition is consumed by a failed lock.
5. Once launched, a missile follows that particular aircraft even if you look elsewhere. It never switches to a replacement aircraft. On target destruction, it continues ballistically.
6. Terrain and structures block acquisition and intercept projectiles. A missile can strike another aircraft along its path; the nearest swept collision wins. A five-metre proximity fuse checks relative aircraft motion continuously and requires an unobstructed path to the target. The visual explosion does not damage additional aircraft.

Player missiles launch at 760 m/s plus aircraft velocity, turn up to 2.6 radians/second, and inflict 100 damage: one confirmed hit destroys an opponent. AI missiles launch at 500 m/s plus aircraft velocity, turn up to 1.7 radians/second, and inflict 38 damage. Both use predictive intercept guidance, a 3.5-second motor burn, and a twelve-second maximum lifetime. After burnout, guidance and exhaust stop; momentum, gravity and drag carry the missile onward. A hard defensive turn can defeat its limited steering. AI pilots obey launcher cooldowns; attack pacing limits simultaneous incoming missiles to two in Skirmish and three in Ace.

The warning shows incoming missile range. **Deploy flares when it says FLARE NOW**, within 750 m, then turn hard. Flares break nearby seekers but do not erase the projectiles; a ballistic missile can still collide. Flares recharge in 2.5 seconds. Ace opponents can also deploy countermeasures with the same cooldown.

## Battle music and radio

The soundtrack, **Iron Meridian**, is an original procedural 148 BPM metal-inspired instrumental: stereo plucked-string power chords through distortion/cabinet filtering, low bass, kick/snare/hi-hat patterns, fills and a second-half lead phrase. It uses Web Audio rather than a streamed song or a commercial recording. The audio-clock scheduler looks ahead a short distance, reuses cached instrument buffers and releases finished notes. No paid key or audio download is needed.

Short browser/device-generated radio lines accompany real gameplay events:

- Sortie start: “Weapons free. Good hunting.” Flight practice has its own clearance.
- Player missile launch: “Fox two. Missile away.”
- Incoming enemy missile: “Incoming missile. Break! Break!”
- Flare deployment with no diverted seeker: “Flares away. Keep turning.”
- Flares actually divert a nearby incoming missile: “Seeker defeated. Flares effective.” This confirms a decoy, **not** a destroyed missile; the projectile remains ballistic and can still collide.
- Confirmed player kill: “Splash one. Target down.”

Incoming warnings interrupt lower-priority chatter. Routine calls have repetition limits, a short expiring priority queue and phrase variations; not every shot produces speech if a higher-priority transmission is in progress. Music lowers automatically under speech and missile warnings. Pause, focus loss, hangar and results stop the score and clear pending radio. Voice captions remain available when audio is off or speech cannot play.

Press **H/Escape → Battle audio · music & radio** to adjust separate music/radio volumes, choose an English voice and use **Radio check**. Zero volume disables that layer; the existing Sound/Mute control disables all audio. These settings persist locally. Playback begins only after a click/key gesture, not on page load. The automatic voice prefers an installed English voice. Options marked **browser service** may require the browser's online speech service; installed voices work locally. These are synthesized device voices, not recorded voice actors, and their timbre/availability differ between browsers and machines. If speech is blocked, try Radio check or another installed voice; captions and gameplay keep working.

## Arena and opponents

Choose **3, 5 or 7** hostile aircraft:

- **Training:** maneuvering opponents, no return fire.
- **Skirmish:** live missiles with moderated attack pacing.
- **Ace:** faster pursuit, more simultaneous threats, occasional enemy countermeasures.

Pilots patrol, attack, extend, evade guided missiles, separate from each other, avoid terrain/structures and can thread an open corridor. Their current intent appears beneath their projected target marker. Destroyed or disengaged opponents are replaced after a delay. This is a local single-player game, not a networked match.

**Operation** is the default: destroy eight enemies before four minutes expire, with three aircraft lives. A flight-check countdown leads into combat. On destruction, a 3.5-second redeployment countdown preserves kills, deaths and elapsed time, then returns a fresh aircraft with a three-second missile-damage shield. Terrain remains lethal. The clock keeps running during redeployment, but pauses in the pause menu or when the browser loses focus. Eight kills wins; a third death or expired clock ends the operation. Results show accuracy, time, kills and deaths, with retry and hangar actions.

**Free hunt** has unlimited redeployments and no time limit. Select Training for an unpressured practice session, or Skirmish/Ace for continuous combat. The operation goal is separate from the number of simultaneous enemies selected above.

Select **North Point** in Combat Theater for the coastal arena. It includes an airfield, urban blocks, cooling towers, container yards, a viaduct and two industrial gantries. Three cyan-marked openings award a clean-pass count once per sortie. Their physical supports are separate colliders: no invisible wall covers the opening. The viaduct lies ahead of the starting flight path; fly level through it to learn the clearances. Structural collision and ground impact destroy the aircraft, including wingtip contact.

**Rift Valley** starts at 2,600 metres in a clear canyon corridor. Sharper fractal ridges, world-space rust/teal mineral bands, fractured strata, blue dusk skies, warm directional light and low valley mist take their direction from the supplied rocky-terrain reference. The collision surface uses exactly the same 125-metre grid triangles as the rendered mountain mesh; surface detail does not change its shape. Enemy avoidance and line-of-sight checks use the selected theater. Hidden coastal buildings cannot collide with the mountain arena. The internal theater identifier remains `alpine` for saved-code compatibility.

## Flight and collision

- Fixed 120 Hz physics inside requestAnimationFrame with bounded catch-up.
- Normalized local-axis quaternion rotation; unrestricted loops and inverted flight.
- Lift and side force act perpendicular to airflow, instead of projecting velocity onto the nose. Gravity, engine thrust and drag change energy; normal turns no longer delete momentum. Climbs consume airspeed, descents regain it, and high-load turns add induced drag. Engine spool and brake deployment are time-based. Cinematic input response builds into a turn over roughly 0.4 seconds and settles faster on release. Peak bank rate is about 85°/second.
- Rate-command fly-by-wire limits pitch demand at high speed and high angle of attack, with a −3 to +9 G lift envelope. Bank-generated lateral lift is coordinated with heading; assisted mouse flight still returns the bank to level once the requested heading is reached. Keyboard maneuvers retain full loops and inverted flight. This is a tuned **sport-flight model**, not validated aircraft data or a certified six-degree-of-freedom simulator.
- Throttle sets engine power, calibrated for approximately 75–300 m/s clean level flight; it is not an automatic speed hold. Climbs, dives, brakes and maneuvers change actual airspeed (safety cap 360 m/s). Tightest dogfight window: **125–155 m/s / 450–558 km/h**. Low-speed/high-angle lift loss produces a recoverable sink. The practical game envelope is intentionally forgiving.
- AI pilots use the same flight model, engine response and energy/turn limits as the player. Their navigation and firing decisions still differ by difficulty.
- Terrain warning samples the velocity path three seconds ahead at 10 Hz. Swept structure checks detect obstacles without treating an open bridge passage as solid ground. Warnings are advisory, not an automatic pull-up.
- Health never reduces speed or control authority. Aircraft fly normally at every positive health value. Damage smoke is cosmetic.
- Aircraft render poses interpolate between fixed physics snapshots. The chase camera follows a damped aircraft attitude and a softly trailing relative boom, revealing the aircraft's bank before the horizon catches up. World translation remains attached to the jet, preventing high-speed camera lag from overtaking or losing the aircraft. Exponential mouse damping takes the shortest route across the yaw seam; quaternion-based orbit avoids a world-up pole flip during vertical loops. Mouse yaw wraps through a full orbit; pitch is bounded. Terrain checks run after boom smoothing.
- Uncaptured motion is handled through pointer events only, avoiding double application from compatibility mouse events. Captured movement uses relative mouse deltas. Extreme/non-finite deltas are guarded.
- Swept moving-aircraft compound oriented-box collision tests prevent fast missiles from skipping the jet. These are inspectable hitboxes, not triangle-perfect mesh collision.
- Buildings and major structures have physical box colliders; narrow suspension cables are decorative. Cooling towers use conservative box bounds.
- Pause, lost browser focus and hidden tabs stop simulation and clear held controls. Restart clears missiles, locks, scores, cooldowns and enemy instances.

## Graphics and UI

The original SF–29 aircraft has a blended fuselage, paired engine nacelles, swept wings, twin canted tails, panel seams, insignia, a reflective canopy, detailed exhaust rings and animated afterburner plumes. The close chase camera emphasizes the aircraft; C switches to a wider view. It is an original procedural interpretation of the supplied reference, not a pixel-identical reproduction or a licensed commercial-game model.

Rift Valley adds fractured rock shading, a mountain-height contour radar, drifting low mist and atmospheric distant ridges. North Point retains its coastal water shader, instanced city/trees, roads, runway markings, cooling towers, bridges and gantries. Both theaters use soft directional shadows, missile trails, smoke, flares and explosions.

The animated hangar menu includes theater, engagement, battle size, quality and sortie settings. In flight: compact scope, projected HTML target brackets, names/health/range/lock state, artificial horizon, pitch ladder, true-airspeed/altitude tapes, flight-path vector, load/angle-of-attack/Mach/AGL/vertical-speed readouts, radar, energy-turn window, airframe health, reload ring, flare status, incoming warning, rear-hemisphere check-six warning, terrain look-ahead warning, mission clock, lives and event feed. Narrow screens retain compact speed and altitude readouts; the extra instrument strip appears on landscape views at least 760×540. Flight practice replaces combat acquisition with a quiet heading cue. The pause screen includes keyboard controls, sensitivity, inversion, live graphics quality and camera-effect settings. End-of-sortie results include kills/deaths, missile accuracy, flight time, fly-throughs and flares.

Missiles leave expanding smoke, and hits produce pooled fireballs, shock rings and sparks. The chase camera pulls back with speed and receives bounded launch/explosion shake. **Performance** quality disables dynamic shadows and foreground cloud sprites, and caps pixel ratio at one. Static aircraft geometry is batched by material once and shared across opponents. Projectile, particle and explosion pools are bounded. Reduced-motion preferences disable decorative motion and cinematic shake/flash by default; these camera effects can also be switched off in Pause. Active flight necessarily contains motion. Sound begins after a user gesture and can be muted.

## Verification

~~~sh
npm test
~~~

- **tests/alpine.test.mjs** covers terrain/render triangle agreement, safe spawn corridor, yaw damping frame independence, camera continuity through loops, absence of duplicate mouse input, static mesh batching and theater collider isolation.
- **tests/single-file.test.mjs** extracts the delivered inline flight/weapon/camera core. Covers quaternion control, speed/health behavior, moving hitboxes, reload timing, keyboard aliases, mouse sensitivity/inversion/wrapping, stable multi-target selection, seeker acquisition, missile guidance and actual portal support clearance.
- **tests/missile-runtime.test.mjs** executes the delivered launch, projectile and flare routines with deterministic fixtures. Covers invalid locks, reload gating, target identity, nearest-aircraft collision, world obstruction, flare range/cooldown and paused-state safety.
- **tests/battle-audio.test.mjs** covers speech priority/preemption, cooldowns, stale callbacks, queue expiry, mute, speech failure/watchdog fallback, pause, preview, voice selection, preference validation, deterministic score/instrument generation, bounded scheduling, music ducking and audio-node cleanup. Missile runtime tests additionally verify launch and actual flare-decoy callout hooks.
- **tests/operation.test.mjs** covers flight momentum/lift/drag/gravity, throttle response, finite long-running integration, moving proximity fuses, rear-hemisphere warnings, operation outcomes, preserved scores across redeployment, free-hunt behavior, pause phases and respawn timeout.
- **tests/offline.test.mjs** checks the embedded renderer against the licensed local sources, verifies that module dependencies remain self-contained, and confirms that the portable edition contains the same gameplay logic.
- **tests/cinematic.test.mjs** covers compact reticle dimensions and lock bounds, gentler bank rates, control release, trailing camera attitude, loop continuity, high-speed camera attachment, reset and camera terrain clearance.
- **tests/assist.test.mjs** checks heading convergence, automatic leveling, keyboard override, assisted lock bounds/timing, mouse direction and limits, classic camera independence and the new terrain's safe spawn corridor.
- **tests/server.test.mjs** checks HTML delivery, content types, missing files and traversal rejection.
- **tests/aerodynamics.test.mjs** verifies climb/descent energy, coordinated banking, spool, airbrake deployment, load limits, time-step convergence, recovery assist, instruments, terrain prediction and the actual AI update using the shared model.
- **tests/document.test.mjs** parses all three delivered scripts, checks unique HTML identifiers and verifies the local-first renderer loader.
- Older module tests are retained for the preserved legacy game only.

The 2.1 update was browser-tested through two confirmed missile kills, including a mouse-steered intercept with the new physics, plus empty-airspace practice, pilot/chase view changes, pause/resume and live graphics-quality changes. The terrain shaders compiled without console errors. The session generally ran around 60 FPS on this machine, with transient dips during renderer reconfiguration; this is an observation, not a hardware-independent guarantee. Prior versions also tested enemy missiles, redeployment, results, North Point's viaduct, flares and seven contacts; those checks should be repeated for each release. See **RELEASE-CHECKLIST.md** for the remaining public-release gates. The optional GitHub Actions template runs the local build and unit/runtime/server checks on Node 22 and 24 when activated; it does not claim automated WebGL end-to-end coverage.

The battle-audio update passes **143 automated checks**. Its local browser test verified device-speech start events for sortie/launch, a confirmed-kill callout, an incoming warning, ordinary flare deployment, voice selection, preview, mute/captions, separate music-off behavior, saved voice selection, and pause/resume. The actual decoy hook is covered by deterministic missile-runtime tests; a live test also verified that flares diverted an incoming seeker. Web Audio scheduling reported active playback without browser console errors. This verifies integration, not a subjective listening/mastering review or every browser's speech engine.

## Preserved earlier game

The earlier homing game remains at **/homing-legacy.html** and is documented in README.homing-legacy.md. Its separate gameplay JavaScript and styles are not loaded by the current single-file game. The Three.js vendor copy is shared by the current game, the legacy edition and deterministic runtime tests.

## References and license

[Three.js](https://threejs.org/) is MIT-licensed. The runtime imports its [pinned release](https://unpkg.com/three@0.180.0/build/three.module.js); vendor/THREE-LICENSE.txt retains attribution.

The sport-flight model uses the qualitative relationships described in NASA's [banking-turn explanation](https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/banking-turns/) and [induced-drag explanation](https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/induced-drag-coefficient/). Its coefficients and fly-by-wire assists are game design choices, not measurements of a real SF–29, MiG or Hydra.

Mouse capture follows the browser's [Pointer Lock API](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_Lock_API), including user-gesture requirements and release behavior. Unsupported capture does not disable the free-look fallback.
