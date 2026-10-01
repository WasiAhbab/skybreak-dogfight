import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const source = html.match(/<script id="battle-audio">([\s\S]*?)<\/script>/)[1];
const context = vm.createContext({});
vm.runInContext(source + ';globalThis.audio = BattleAudio;', context);
const { Director, scoreStep } = context.audio;

function radio({ available = true } = {}) {
  let time = 0;
  const spoken = [],
    captions = [],
    statuses = [];
  const voices = [
    { voiceURI: 'remote', name: 'Online English', lang: 'en-US', localService: false, default: true },
    { voiceURI: 'local', name: 'Daniel', lang: 'en-GB', localService: true },
    { voiceURI: 'other', name: 'Other language', lang: 'fr-FR', localService: true }
  ];
  const synth = {
    cancels: 0,
    getVoices: () => voices,
    speak(message) {
      spoken.push(message);
      message.onstart();
    },
    cancel() {
      this.cancels++;
    }
  };
  const director = new Director({
    synth: available ? synth : null,
    Utterance: available
      ? class {
          constructor(text) {
            this.text = text;
          }
        }
      : null,
    now: () => time,
    caption: (text, key) => captions.push({ text, key }),
    status: (text) => statuses.push(text)
  });
  director.mode = 'playing';
  return {
    director,
    synth,
    spoken,
    captions,
    statuses,
    at(value) {
      time = value;
    }
  };
}

test('radio prefers an installed English voice and supports an explicit voice choice', () => {
  const h = radio();
  assert.equal(h.director.voices.length, 2);
  assert.equal(h.director.selectedVoice().voiceURI, 'local');
  h.director.configure({ voiceURI: 'remote' });
  h.director.emit('begin');
  assert.equal(h.spoken[0].voice.voiceURI, 'remote');
  assert.equal(h.spoken[0].lang, 'en-US');
  assert.equal(h.spoken[0].volume, 0.85);
  assert.equal(h.director.radioState, 'speaking');
});

test('incoming warnings interrupt lower-priority radio, and stale callbacks cannot end the warning', () => {
  const h = radio();
  h.director.emit('begin');
  const greeting = h.spoken[0];
  assert.equal(h.director.emit('incoming'), true);
  assert.equal(h.synth.cancels, 1);
  assert.equal(h.spoken.length, 2);
  assert.equal(h.director.current.key, 'incoming');
  greeting.onend();
  greeting.onerror({ error: 'interrupted' });
  assert.equal(h.director.current.key, 'incoming');
  assert.equal(h.director.warning, '');
});

test('voice queue has a hard cap, per-event cooldown and no repeated pending callouts', () => {
  const h = radio();
  h.director.emit('incoming');
  for (const key of ['launch', 'flares', 'kill', 'begin']) h.director.emit(key);
  assert.equal(h.director.queue.length, 3);
  assert.equal(h.director.queue[0].key, 'kill');
  assert.equal(h.director.emit('incoming'), false);
  h.at(5.99);
  assert.equal(h.director.emit('incoming'), false);
  h.at(6);
  h.spoken[0].onend();
  assert.equal(h.director.emit('incoming'), true);
  assert.equal(h.spoken.at(-1).text, 'Missile inbound. Countermeasures!');
});

test('old queued launches expire rather than playing after the engagement', () => {
  const h = radio();
  h.director.emit('begin');
  h.director.emit('launch');
  h.at(1.51);
  h.spoken[0].onend();
  h.director.tick('playing');
  assert.equal(h.spoken.length, 1);
  assert.equal(h.director.queue.length, 0);
});

test('confirmed flare decoys take priority but plain deployment never claims a defeated missile', () => {
  const h = radio();
  h.director.emit('launch');
  h.director.emit('defeated');
  assert.equal(h.director.current.key, 'defeated');
  assert.match(h.spoken.at(-1).text, /Seeker defeated/);
  h.spoken.at(-1).onend();
  h.director.emit('flares');
  assert.equal(h.spoken.at(-1).text, 'Flares away. Keep turning.');
});

test('mute and zero voice volume cancel speech while retaining event captions', () => {
  for (const settings of [{ muted: true }, { voice: 0 }]) {
    const h = radio();
    h.director.emit('begin');
    h.director.configure(settings, settings.muted ?? false);
    h.director.emit('incoming');
    assert.equal(h.spoken.length, 1);
    assert.equal(h.director.current, null);
    assert.equal(h.captions.at(-1).key, 'incoming');
    assert.equal(h.director.radioState, 'captions only');
  }
});

test('missing, rejected and stalled device speech recover to captions without blocking gameplay', () => {
  const missing = radio({ available: false });
  missing.director.emit('begin');
  assert.match(missing.director.warning, /unavailable/);
  assert.equal(missing.captions.at(-1).key, 'begin');
  const denied = radio();
  denied.director.emit('begin');
  denied.spoken[0].onerror({ error: 'not-allowed' });
  assert.equal(denied.director.current, null);
  assert.match(denied.director.warning, /blocked/);
  const stalled = radio();
  stalled.director.emit('launch');
  stalled.at(7.01);
  stalled.director.tick('playing');
  assert.equal(stalled.director.current, null);
  assert.match(stalled.director.warning, /timed out/);
  assert.equal(stalled.captions.at(-1).text, '');
});

test('pause cancels radio and queued chatter; radio check works while paused', () => {
  const h = radio();
  h.director.emit('begin');
  h.director.emit('launch');
  h.director.tick('paused');
  assert.equal(h.director.current, null);
  assert.equal(h.director.queue.length, 0);
  assert.equal(h.captions.at(-1).text, '');
  assert.equal(h.director.emit('incoming'), false);
  assert.equal(h.director.emit('test', true), true);
  h.director.tick('paused');
  assert.equal(h.director.current.key, 'test');
  assert.match(h.spoken.at(-1).text, /Radio check/);
});

test('new sorties reset cue limits and score, while finite preference values are clamped', () => {
  const h = radio();
  h.director.configure({ music: 9, voice: -2, voiceURI: 45 });
  assert.equal(h.director.settings.music, 1);
  assert.equal(h.director.settings.voice, 0);
  assert.equal(h.director.settings.voiceURI, '');
  h.director.configure({ music: NaN, voice: Infinity });
  assert.equal(h.director.settings.music, 1);
  assert.equal(h.director.settings.voice, 0);
  h.director.emit('begin');
  h.director.step = 137;
  h.director.reset();
  assert.equal(h.director.step, 0);
  assert.equal(h.director.history, '');
  assert.equal(h.director.emit('begin'), true);
});

function mockContext() {
  const sources = [];
  const parameter = () => ({
    value: 0,
    targets: [],
    setValueAtTime(value, time) {
      this.value = value;
      this.targets.push({ value, time });
    },
    setTargetAtTime(value, time) {
      this.value = value;
      this.targets.push({ value, time });
    },
    linearRampToValueAtTime(value, time) {
      this.targets.push({ value, time });
    },
    exponentialRampToValueAtTime(value, time) {
      assert.ok(value > 0);
      this.targets.push({ value, time });
    }
  });
  const node = () => ({
    connect() {},
    disconnect() {
      this.disconnected = true;
    }
  });
  const sourceNode = () => {
    const source = {
      ...node(),
      frequency: parameter(),
      stops: [],
      start(time) {
        this.startedAt = time;
      },
      stop(time) {
        this.stops.push(time);
        if (time === undefined) this.onended?.();
      }
    };
    sources.push(source);
    return source;
  };
  return {
    currentTime: 0,
    sampleRate: 22050,
    state: 'running',
    sources,
    createGain: () => ({ ...node(), gain: parameter() }),
    createBiquadFilter: () => ({ ...node(), frequency: parameter(), Q: parameter() }),
    createWaveShaper: node,
    createDynamicsCompressor: () => ({
      ...node(),
      ...Object.fromEntries(
        ['threshold', 'knee', 'ratio', 'attack', 'release'].map((key) => [key, parameter()])
      )
    }),
    createBufferSource: sourceNode,
    createOscillator: sourceNode,
    createBuffer(channels, length, sampleRate) {
      const data = Array.from({ length: channels }, () => new Float32Array(length));
      return { length, sampleRate, numberOfChannels: channels, getChannelData: (channel) => data[channel] };
    }
  };
}

test('score has deterministic riffs, bass, drums, lead variation and more urgent danger percussion', () => {
  let kick = 0,
    dangerKick = 0,
    lead = 0,
    snare = 0,
    riff = 0;
  const roots = new Set();
  for (let i = 0; i < 256; i++) {
    const note = scoreStep(i),
      danger = scoreStep(i, true);
    assert.deepEqual(note, scoreStep(i + 256));
    assert.equal(note.root, danger.root);
    roots.add(note.root);
    kick += +note.kick;
    dangerKick += +danger.kick;
    lead += +(note.lead !== null);
    snare += +note.snare;
    riff += +note.riff;
  }
  assert.equal(roots.size, 5);
  assert.ok(kick > 40 && dangerKick > kick && lead > 0 && snare > 30 && riff > 100);
});

test('cached stereo plucked-string buffers are finite, non-silent, decaying and repeatable', () => {
  const { director } = radio(),
    ctx = mockContext();
  director.attach(ctx, ctx.createGain());
  assert.equal(director.buffers.size, 10);
  const chord = director.chord(38);
  assert.equal(chord, director.chord(38));
  const left = chord.getChannelData(0),
    right = chord.getChannelData(1);
  assert.ok(left.every(Number.isFinite));
  assert.ok(left.some((value) => Math.abs(value) > 0.1));
  assert.notDeepEqual(left, right);
  const energy = (values) => values.reduce((sum, value) => sum + value * value, 0) / values.length;
  assert.ok(energy(left.slice(0, 1500)) > energy(left.slice(-1500)) * 5);
  const second = radio().director,
    secondCtx = mockContext();
  second.attach(secondCtx, secondCtx.createGain());
  assert.deepEqual(left, second.chord(38).getChannelData(0));
});

test('music schedules on the audio clock only during active flight and does not catch up after a stall', () => {
  const { director } = radio(),
    ctx = mockContext();
  director.attach(ctx, ctx.createGain());
  director.tick('spawning');
  assert.equal(ctx.sources.length, 0);
  director.tick('playing');
  assert.ok(director.musicActive);
  assert.ok(ctx.sources.length > 0);
  assert.ok(ctx.sources.every((source) => source.startedAt >= 0.005 && source.startedAt < 0.13));
  const before = director.step;
  ctx.currentTime = 600;
  director.tick('playing');
  assert.ok(director.step - before <= 4);
  assert.ok(director.nextBeat > 600);
  director.tick('paused');
  assert.equal(director.musicActive, false);
  assert.equal(director.nodes.size, 0);
  assert.ok(ctx.sources.every((source) => source.disconnected));
  assert.equal(director.musicGain.gain.value, 0);
});

test('music ducks under speech and missile warnings, restores afterwards, and respects mute/zero volume', () => {
  const h = radio(),
    ctx = mockContext();
  h.director.attach(ctx, ctx.createGain());
  h.director.tick('playing');
  const full = h.director.musicGain.gain.value;
  h.director.emit('launch');
  h.director.tick('playing');
  assert.ok(Math.abs(h.director.musicGain.gain.value - full * 0.2) < 1e-10);
  h.spoken[0].onend();
  h.director.tick('playing', true);
  assert.ok(Math.abs(h.director.musicGain.gain.value - full * 0.55) < 1e-10);
  h.director.tick('playing');
  assert.equal(h.director.musicGain.gain.value, full);
  h.director.configure({}, true);
  h.director.tick('playing');
  assert.equal(h.director.musicActive, false);
  assert.equal(h.director.musicGain.gain.value, 0);
  h.director.configure({ music: 0 }, false);
  h.director.tick('playing');
  assert.equal(h.director.musicActive, false);
});

test('finished notes release their audio nodes and browser-suspended audio schedules nothing', () => {
  const { director } = radio(),
    ctx = mockContext();
  director.attach(ctx, ctx.createGain());
  director.tick('playing');
  for (const source of ctx.sources) source.onended();
  assert.equal(director.nodes.size, 0);
  const count = ctx.sources.length;
  ctx.state = 'suspended';
  ctx.currentTime = 20;
  director.tick('playing');
  assert.equal(ctx.sources.length, count);
  assert.equal(director.musicActive, false);
});
