# SKYBREAK 3.0 — release gates

Status: improved, locally playable release candidate. Not a certified simulator, multiplayer service, or a claim of bug-free commercial production readiness.

## Implemented and checked

- Five-round AI Duel Series with 120-second round clocks, one-point wins, scoreless draws, opponent rotation, verdict/countdown phases and identical 500 m cannon loadouts.
- Cannon heat, swept compound hitboxes, terrain obstruction, four-hit lethality, animated landing gear with real drag, and a separate Last Stand railgun defence mode.
- Seven new original procedural arenas in addition to Rift Valley and North Point. Lazy construction, static batching, theater-isolated collision, matching terrain triangles, open bridges and rotating turbine hitboxes are covered by runtime tests.
- Local browser checks cover arena selection/rendering, one-rival duels, AI cannon damage and round progression, gear, pause, Last Stand ejection and railgun recharge. These checks do not replace human playtesting.
- Version 3 passes 166 automated checks. Browser play confirmed four manual cannon shots → four hits → one kill → 1–0 round score, pause during the verdict, and a full five-round AI loss series with final results and rotating callsigns. Arena selection/shader compilation produced no browser errors in this session; observed play was around 60 FPS on this machine, not a universal guarantee.

- Lift-driven sport flight, coordinated banking, energy loss/gain, spool, real airbrake, angle-of-attack limiting and a bounded G envelope.
- Easy mouse-heading assist, keyboard override, wings-level recovery, close/wide chase and pilot view.
- AI uses the same flight dynamics as the player. One-second homing-missile reload is retained.
- Useful flight-path and energy instruments, ahead-of-aircraft terrain warnings and empty-airspace practice.
- Local renderer, self-contained offline packaging, bounded particles, paused-tab safety and saved preferences.
- Static server has method/path validation, HEAD/ETag responses, defensive headers, localhost-only binding, graceful shutdown and a friendly occupied-port error.
- Build, physics/runtime, packaging and server checks run with `npm run verify`. Optional GitHub Actions template included at `ci/game-workflow.yml`; no dependency installation required for the game.
- Browser interaction checked: launch, two kills including mouse aim, pause/resume, practice mode, camera switch and graphics selection. Full browser/device coverage remains open.
- Original procedural battle score and device-speech radio, independently adjustable layers, expiring priority cues, warning ducking and captions. Unit tests cover audio scheduling and event rules; browser testing verifies speech-start events, settings and music playback state, not a subjective acoustic mastering review.

## Before publishing for other players

1. **Browser/device matrix:** test current Safari, Chrome and Firefox on actual macOS devices, plus the intended Windows browsers. Test mouse capture, trackpad fallback, screen resizing, fullscreen, audio, keyboard shortcuts, reduced motion, browser back/forward and focus loss. Listen on headphones and laptop speakers; check voice intelligibility over engine/music, no clipping, incoming-callout priority, speech-engine failure and offline installed-voice availability. Embedded-browser results do not replace this.
2. **Performance gate:** run a 20–30 minute seven-enemy session on each minimum-spec device. Record frame times, memory trend and graphics errors. Target a stable 60 FPS on the chosen recommended hardware and usable Performance mode on minimum-spec hardware; declare that hardware explicitly.
3. **Gameplay gate:** have at least five unfamiliar players complete launch → steer → lock → fire → evade → pause → restart without explanation. Record time to first hit, control confusion, motion sickness and difficulty. Tune from that evidence, not from a subjective “10/10” promise.
4. **Regression gate:** complete an eight-kill operation, lose all three lives, resume a paused respawn, test flares, fly through every coastal opening, and confirm all nine theaters. Play a complete duel series with wins, losses and timeouts, pause between rounds, and complete Last Stand from both ejection and combat destruction. Automated tests cover rule boundaries, but rendered outcome and control feel require playtesting.
5. **Failure gate:** cold-load with the internet unavailable on localhost; test blocked local storage, missing renderer, WebGL disabled, context loss, audio permission failure and an occupied server port. Verify that the downloadable offline HTML also opens directly in supported browsers. Direct-file launch is not verified in the in-app browser because that browser blocks file URLs.
6. **Public deployment:** serve the public game files over HTTPS using a maintained static host with correct JavaScript MIME types, compression, cache revalidation and security headers. Do not expose the localhost development server to the internet. No account system, backend database or multiplayer authority is implemented.
7. **Release hygiene:** retain the Three.js MIT attribution, choose a license for the original game code, document supported controls/hardware, add a versioned changelog and provide a way for players to report bugs. Enable the optional Actions template using a credential authorized to manage workflows; this initial deployment does not activate it.

## Deliberate limits

Procedural terrain and aircraft are original, not commercial-game assets. The physics is a forgiving game model with fixed atmospheric assumptions, not aerodynamic certification data. There are no takeoff/landing procedures, cockpit avionics, mission campaign, joystick/gamepad support, online multiplayer or anti-cheat. Add those only as separately scoped features with their own tests.
