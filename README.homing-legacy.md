# SKYBREAK — Missile Dogfight

A self-contained, single-player 3D arcade dogfight built for a desktop browser. Fly an original Harrier-inspired strike jet over North Point: a coastal airfield, two runways, a city and western hills. No MTA installation, GTA assets, accounts, paid keys or runtime online dependencies. Inspired by the targeting style of SAAF/Grafuroam, **not** an exact recreation of either server and not a multiplayer client.

## Play locally on your Mac

Install Node.js 20 or later if it is not already available. In Warp or Terminal:

```sh
cd skybreak-dogfight
npm start
```

Open **http://localhost:3040** in Chrome, Safari, Edge, or the Codex browser. Keep the terminal running while playing; Ctrl+C stops the server. No `npm install` is required. If the port is busy, run `PORT=3041 npm start` and open http://localhost:3041 instead.

Select Rookie for your first flight and click **Launch sortie**. A mouse and keyboard are recommended. WebGL 2 / browser graphics acceleration must be enabled. The Performance setting reduces render resolution on Retina screens. Touch steering and buttons are provided as a secondary control scheme.

## Controls

| Input | Action |
| --- | --- |
| Mouse or arrow keys | Steer the aircraft; mouse also positions the seeker |
| Left click or Space | Fire paired missiles; hold Space for successive volleys |
| W / S | Throttle up / airbrake (airbrake also tightens turns) |
| A / D | Roll left / right, including inverted flight |
| Q / E | Additional local-axis yaw controls |
| Shift | Afterburner; regenerates when released |
| F | Deploy flares to decoy incoming missiles |
| R | Barrel roll |
| C | Switch close/wide chase camera |
| Escape | Pause/resume; adjust sensitivity or invert pitch |

Keep a bandit inside the large four-segment ring for 0.75 seconds. The ring turns yellow during acquisition and **red when locked**. Enemy aircraft have hexagonal markers, callsigns and distances in metres. A locked launch tracks that aircraft even when you turn away. **Without a lock, rockets fly straight.** Terrain and buildings block initial lock acquisition; guided missiles can collide with them. Guidance has a bounded turn rate, so a missile is not an instant-hit weapon.

Your twelve-missile rack fires two missiles per volley, with a 0.48-second minimum interval. It automatically rearms in 3.2 seconds after emptying. Four flare charges regenerate one at a time. Opponents shoot back; Veteran pilots also use countermeasures. Avoid terrain and buildings, monitor the map radar and use flares when a missile approaches. Enemies replenish continuously. Personal-best kills are stored only in your browser.

Flight uses unrestricted local-axis quaternion rotation, not pitch-clamped Euler steering. Releasing steering immediately stops commanded rotation; mouse steering stops when the pointer returns to the centre dead zone. The fuselage's assisted bank animation settles smoothly. Airbraking tightens turns, while afterburner increases turn radius. Damage does not reduce steering authority or speed. At zero health the sortie ends. This is arcade handling, not a physically accurate aerodynamics model.

## Implementation

- Three.js r180 / WebGL 2, locally bundled under its MIT license.
- Original single-tail jet geometry, blue/violet exhaust, ocean and dusk atmosphere shaders, coastal terrain, instanced city blocks, runway lighting, missile smoke, explosions and synthesized audio.
- Mouse/keyboard flight, seeker acquisition, bounded-rate homing guidance, swept-segment hit detection, enemy pursuit and countermeasures.
- Reference-inspired segmented seeker and hexagonal markers; round radar uses the same roads, runways and buildings as the 3D world. Canvas flight HUD plus textual flight telemetry for assistive technologies.
- Small Node HTTP server bound to loopback only. It serves just `public/`, not the surrounding Axess Lab project.
- No build step, analytics, external fonts, remote textures or backend accounts. This folder is independent of Axess Lab.

## Tests

```sh
npm test
```

Tests cover unrestricted loops, inverted rolls, immediate release response, frame-independent mixed-axis rotation, turn-radius scaling, lock acquisition/loss, steering dead zones, frame-independent damping, missile turn limits, opposite/zero-heading edge cases, moving-target interception, swept hit detection, terrain/building obstruction, serving all local runtime assets and path traversal protection.

### Manual smoke check

1. Launch Rookie, keep the mouse centered, wait for the red locked ring and fire.
2. Confirm the missile trail, target destruction and increased kill count.
3. Fire F; verify flare particles and reduced charge count.
4. Switch C, use afterburner, steer with mouse/arrows and perform R.
5. Pause, change sensitivity, resume; restart and return to hangar.
6. Empty the missile rack with six volleys and observe automatic reload. Let enemies attack to test damage, aircraft loss and retry.
7. Test sound, fullscreen and the Performance option on the target computer.

## Scope

This is a playable local arcade game, not a commercial AAA release or a flight simulator. It does not include online multiplayer, San Andreas maps, imported server handling, accounts or matchmaking. Real-time 3D flight necessarily contains motion; nonessential menu transitions respect reduced-motion preferences. Your hardware and viewport affect frame rate.

Third-party license: `public/vendor/THREE-LICENSE.txt`.
