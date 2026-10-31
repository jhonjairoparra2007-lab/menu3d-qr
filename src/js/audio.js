/**
 * audio.js - Procedural Web Audio UI sound effects
 * Generates instant acoustic feedback without downloading external sound files
 */

let audioCtx = null;

function getAudioContext() {
  if (!audioCtx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) {
      audioCtx = new AudioContext();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

/**
 * Gentle marimba pop when adding item to cart
 */
export function playCartSound() {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(440, now); // A4
  osc.frequency.exponentialRampToValueAtTime(880, now + 0.12); // Octave up

  gain.gain.setValueAtTime(0.2, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.18);
}

/**
 * Subtle tick when clicking buttons or 3D indicators
 */
export function playClickSound() {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'triangle';
  osc.frequency.setValueAtTime(600, now);
  osc.frequency.exponentialRampToValueAtTime(300, now + 0.05);

  gain.gain.setValueAtTime(0.08, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.06);
}

/**
 * Joyful celebration chime when order is successfully placed
 */
export function playCelebrationSound() {
  const ctx = getAudioContext();
  if (!ctx) return;

  const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
  notes.forEach((freq, idx) => {
    const now = ctx.currentTime + idx * 0.09;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.35);
  });
}

/**
 * Ascending whoosh sound when disassembling/exploding 3D food layers
 */
export function playExplodeSound() {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(260, now);
  osc.frequency.exponentialRampToValueAtTime(750, now + 0.28);

  gain.gain.setValueAtTime(0.18, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.3);
}

/**
 * Crisp snap/reassemble sound when putting 3D food back together
 */
export function playAssembleSound() {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(750, now);
  osc.frequency.exponentialRampToValueAtTime(260, now + 0.22);

  gain.gain.setValueAtTime(0.2, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.25);
}

/**
 * Authentic Kitchen Service Bell (Campana de cocina / timbre de comanda)
 * High-pitch brass strike with realistic metallic harmonics and warm decay
 */
export function playKitchenBellSound() {
  const ctx = getAudioContext();
  if (!ctx) return;

  const strikes = [0, 0.15]; // Classic double crisp strike "DING-DING!"
  strikes.forEach(delay => {
    const now = ctx.currentTime + delay;

    // Harmonic partial frequencies characteristic of a brass counter bell
    const harmonics = [
      { freq: 2093.00, gain: 0.45, decay: 1.5, type: 'sine' },      // Fundamental (C7)
      { freq: 2793.83, gain: 0.25, decay: 1.1, type: 'sine' },      // Fourth harmonic (F7)
      { freq: 3520.00, gain: 0.20, decay: 0.8, type: 'sine' },      // Minor sixth (A7)
      { freq: 4186.01, gain: 0.18, decay: 0.6, type: 'triangle' },  // Octave harmonic shimmer (C8)
    ];

    harmonics.forEach(h => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = h.type;
      osc.frequency.setValueAtTime(h.freq, now);

      gain.gain.setValueAtTime(h.gain, now);
      gain.gain.exponentialRampToValueAtTime(0.0005, now + h.decay);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + h.decay);
    });

    // Metallic initial "clink" attack transient
    const noiseNode = ctx.createBufferSource();
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 0.02, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.005));
    }
    noiseNode.buffer = buffer;

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.2, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.02);

    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(3000, now);

    noiseNode.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(ctx.destination);

    noiseNode.start(now);
  });
}
