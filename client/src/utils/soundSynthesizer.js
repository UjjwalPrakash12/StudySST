/**
 * Web Audio API Ambient Sound Synthesizer & Pomodoro Bell Chime
 * Zero external MP3 downloads required - synthesizes audio on the fly!
 */

class SoundSynthesizer {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.channels = {
      rain: { gain: null, nodes: [] },
      cafe: { gain: null, nodes: [] },
      binaural: { gain: null, nodes: [] },
      fire: { gain: null, nodes: [] },
    };
    this.volumes = {
      rain: 0,
      cafe: 0,
      binaural: 0,
      fire: 0,
    };
    this.masterVolume = 0.7;
    this.isInitialized = false;
  }

  init() {
    if (this.isInitialized && this.ctx) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;

    this.ctx = new AudioContext();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(this.masterVolume, this.ctx.currentTime);
    this.masterGain.connect(this.ctx.destination);

    // Initialize individual channel gains
    Object.keys(this.channels).forEach(channelKey => {
      const channelGain = this.ctx.createGain();
      channelGain.gain.setValueAtTime(this.volumes[channelKey], this.ctx.currentTime);
      channelGain.connect(this.masterGain);
      this.channels[channelKey].gain = channelGain;
    });

    this.isInitialized = true;
  }

  ensureContext() {
    this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  // 1. Synthesize Rain & Gentle Thunder
  startRain() {
    if (!this.ctx || this.channels.rain.nodes.length > 0) return;

    const bufferSize = 2 * this.ctx.sampleRate;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      // Pinkish noise approximation
      output[i] = (Math.random() * 2 - 1) * 0.4;
    }

    const whiteNoise = this.ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;
    whiteNoise.loop = true;

    // Lowpass filter for heavy rain texture
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(800, this.ctx.currentTime);

    whiteNoise.connect(filter);
    filter.connect(this.channels.rain.gain);
    whiteNoise.start();

    this.channels.rain.nodes = [whiteNoise, filter];
  }

  stopRain() {
    this.channels.rain.nodes.forEach(node => {
      try { node.stop(); node.disconnect(); } catch (e) {}
    });
    this.channels.rain.nodes = [];
  }

  // 2. Synthesize Cozy Cafe Ambience (Low murmurs + filtered chatter)
  startCafe() {
    if (!this.ctx || this.channels.cafe.nodes.length > 0) return;

    // Combine 2 bandpass filtered oscillators to simulate warm room resonance
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(140, this.ctx.currentTime);
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(220, this.ctx.currentTime);

    // Add noise for espresso bar texture
    const bufferSize = this.ctx.sampleRate * 2;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = (Math.random() * 2 - 1) * 0.15;
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = noiseBuffer;
    noise.loop = true;

    const bandpass = this.ctx.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.setValueAtTime(350, this.ctx.currentTime);
    bandpass.Q.setValueAtTime(1.5, this.ctx.currentTime);

    osc1.connect(bandpass);
    osc2.connect(bandpass);
    noise.connect(bandpass);
    bandpass.connect(this.channels.cafe.gain);

    osc1.start();
    osc2.start();
    noise.start();

    this.channels.cafe.nodes = [osc1, osc2, noise, bandpass];
  }

  stopCafe() {
    this.channels.cafe.nodes.forEach(node => {
      try { node.stop(); node.disconnect(); } catch (e) {}
    });
    this.channels.cafe.nodes = [];
  }

  // 3. Synthesize Binaural Alpha Beat (Left: 200Hz, Right: 210Hz => 10Hz Alpha Focus Wave)
  startBinaural() {
    if (!this.ctx || this.channels.binaural.nodes.length > 0) return;

    const merger = this.ctx.createChannelMerger(2);

    const leftOsc = this.ctx.createOscillator();
    leftOsc.type = 'sine';
    leftOsc.frequency.setValueAtTime(216, this.ctx.currentTime);

    const rightOsc = this.ctx.createOscillator();
    rightOsc.type = 'sine';
    rightOsc.frequency.setValueAtTime(226, this.ctx.currentTime); // 10Hz differential

    leftOsc.connect(merger, 0, 0);
    rightOsc.connect(merger, 0, 1);
    merger.connect(this.channels.binaural.gain);

    leftOsc.start();
    rightOsc.start();

    this.channels.binaural.nodes = [leftOsc, rightOsc, merger];
  }

  stopBinaural() {
    this.channels.binaural.nodes.forEach(node => {
      try { node.stop(); node.disconnect(); } catch (e) {}
    });
    this.channels.binaural.nodes = [];
  }

  // 4. Synthesize Fireplace Crackle
  startFire() {
    if (!this.ctx || this.channels.fire.nodes.length > 0) return;

    const bufferSize = this.ctx.sampleRate * 2;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      // Brown noise + crackle spikes
      const r = Math.random();
      output[i] = (r * 2 - 1) * (r > 0.985 ? 0.9 : 0.2);
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = noiseBuffer;
    noise.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(650, this.ctx.currentTime);

    noise.connect(filter);
    filter.connect(this.channels.fire.gain);
    noise.start();

    this.channels.fire.nodes = [noise, filter];
  }

  stopFire() {
    this.channels.fire.nodes.forEach(node => {
      try { node.stop(); node.disconnect(); } catch (e) {}
    });
    this.channels.fire.nodes = [];
  }

  setChannelVolume(channel, volume) {
    this.ensureContext();
    const vol = Math.max(0, Math.min(1, volume));
    this.volumes[channel] = vol;

    if (this.channels[channel] && this.channels[channel].gain) {
      this.channels[channel].gain.gain.setValueAtTime(vol, this.ctx.currentTime);
    }

    if (vol > 0) {
      if (channel === 'rain') this.startRain();
      else if (channel === 'cafe') this.startCafe();
      else if (channel === 'binaural') this.startBinaural();
      else if (channel === 'fire') this.startFire();
    } else {
      if (channel === 'rain') this.stopRain();
      else if (channel === 'cafe') this.stopCafe();
      else if (channel === 'binaural') this.stopBinaural();
      else if (channel === 'fire') this.stopFire();
    }
  }

  setMasterVolume(volume) {
    this.ensureContext();
    const vol = Math.max(0, Math.min(1, volume));
    this.masterVolume = vol;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(vol, this.ctx.currentTime);
    }
  }

  // Play Pomodoro Completion Chime (C5, E5, G5, C6 Harmonic Arpeggio)
  playChime() {
    this.ensureContext();
    if (!this.ctx) return;

    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    const startTime = this.ctx.currentTime;

    notes.forEach((freq, index) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime + index * 0.12);

      gain.gain.setValueAtTime(0, startTime + index * 0.12);
      gain.gain.linearRampToValueAtTime(0.3, startTime + index * 0.12 + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + index * 0.12 + 0.9);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(startTime + index * 0.12);
      osc.stop(startTime + index * 0.12 + 1.0);
    });
  }

  stopAll() {
    this.stopRain();
    this.stopCafe();
    this.stopBinaural();
    this.stopFire();
    Object.keys(this.volumes).forEach(k => this.volumes[k] = 0);
  }
}

export const soundSynthesizer = new SoundSynthesizer();
