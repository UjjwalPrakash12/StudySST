/**
 * Web Audio API Calming Soundscapes Engine & Pomodoro Bell Chime
 * 
 * Provides genuinely distinct, procedurally synthesized acoustic audio soundscapes
 * across 8 categories: Rain, Nature, Ocean, Lo-fi, Piano, Ambient, White Noise, Night Ambience.
 * Zero external audio downloads required; instant playback, 100% personal and private.
 */

export const SOUND_TRACKS = [
  {
    id: 'gentle-rain',
    title: 'Gentle Rainfall',
    category: 'Rain',
    description: 'Soft, steady rainfall drizzle on foliage to drown out background noise.',
    icon: 'CloudRain',
  },
  {
    id: 'rain-window',
    title: 'Rain on Window',
    category: 'Rain',
    description: 'Muffled indoor raindrops tapping against window glass with subtle droplet resonance.',
    icon: 'CloudDrizzle',
  },
  {
    id: 'distant-thunder',
    title: 'Distant Thunder',
    category: 'Rain',
    description: 'Continuous rainstorm accompanied by deep, rolling low-frequency thunder rumbles.',
    icon: 'CloudLightning',
  },
  {
    id: 'forest-birds',
    title: 'Forest & Birdsong',
    category: 'Nature',
    description: 'Tranquil woodland breeze with algorithmic acoustic bird chirps and rustling leaves.',
    icon: 'Trees',
  },
  {
    id: 'flowing-stream',
    title: 'Mountain Stream',
    category: 'Nature',
    description: 'Gentle, clear freshwater creek bubbling over smooth riverbed stones.',
    icon: 'Waves',
  },
  {
    id: 'ocean-waves',
    title: 'Pacific Ocean Breakers',
    category: 'Ocean',
    description: 'Rhythmic, deep ocean waves swelling and receding along a sandy shoreline.',
    icon: 'Compass',
  },
  {
    id: 'mellow-lofi',
    title: 'Mellow Lo-Fi Beats',
    category: 'Lo-fi',
    description: 'Warm electric piano chord swells with nostalgic vinyl warmth and mellow pulse.',
    icon: 'Headphones',
  },
  {
    id: 'slow-piano',
    title: 'Slow Instrumental Piano',
    category: 'Piano',
    description: 'Peaceful acoustic piano notes echoing in an open room with long natural decay.',
    icon: 'Music',
  },
  {
    id: 'atmospheric-pad',
    title: 'Atmospheric Drone Pad',
    category: 'Ambient',
    description: 'Lush, warm detuned analog synthesizer pads shifting through calming harmonic intervals.',
    icon: 'Sparkles',
  },
  {
    id: 'pink-noise',
    title: 'Pink Focus Noise',
    category: 'White Noise',
    description: 'Balanced -3dB/octave pink noise scientifically optimized for reading and laser focus.',
    icon: 'Volume2',
  },
  {
    id: 'brown-noise',
    title: 'Deep Brown Noise',
    category: 'White Noise',
    description: 'Deep, low-pitched rumble reminiscent of a heavy waterfall to mask distractions.',
    icon: 'Radio',
  },
  {
    id: 'night-crickets',
    title: 'Twilight Crickets',
    category: 'Night Ambience',
    description: 'Warm summer evening breeze with gentle cricket trills under a calm starry sky.',
    icon: 'Moon',
  },
];

class SoundSynthesizer {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.trackGain = null;
    this.activeNodes = [];
    this.activeTimers = [];
    this.activeTrackId = null;
    this.isPlaying = false;
    this.trackVolume = 0.5;
    this.masterVolume = 0.7;
    this.isInitialized = false;

    // Load saved preferences if available
    try {
      const savedTrack = localStorage.getItem('studystream_ambient_track');
      if (savedTrack && SOUND_TRACKS.some(t => t.id === savedTrack)) {
        this.activeTrackId = savedTrack;
      } else {
        this.activeTrackId = 'gentle-rain';
      }
      const savedVol = localStorage.getItem('studystream_ambient_vol');
      if (savedVol !== null) {
        this.trackVolume = Math.max(0.05, Math.min(1, parseFloat(savedVol)));
      }
    } catch (e) {
      this.activeTrackId = 'gentle-rain';
    }
  }

  init() {
    if (this.isInitialized && this.ctx) return;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;

    this.ctx = new AudioContextClass();

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(this.masterVolume, this.ctx.currentTime);
    this.masterGain.connect(this.ctx.destination);

    this.trackGain = this.ctx.createGain();
    this.trackGain.gain.setValueAtTime(this.trackVolume, this.ctx.currentTime);
    this.trackGain.connect(this.masterGain);

    this.isInitialized = true;
  }

  ensureContext() {
    this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  getTracks() {
    return SOUND_TRACKS;
  }

  getCategories() {
    return Array.from(new Set(SOUND_TRACKS.map(t => t.category)));
  }

  getActiveTrack() {
    return SOUND_TRACKS.find(t => t.id === this.activeTrackId) || SOUND_TRACKS[0];
  }

  // Helper to create looping noise buffer
  createNoiseBuffer(durationSec = 3, type = 'pink') {
    const bufferSize = this.ctx.sampleRate * durationSec;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);

    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    let lastOut = 0.0;

    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;

      if (type === 'white') {
        data[i] = white * 0.3;
      } else if (type === 'pink') {
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.08;
        b6 = white * 0.115926;
      } else if (type === 'brown') {
        lastOut = (lastOut + (0.02 * white)) / 1.02;
        data[i] = lastOut * 3.5;
      }
    }
    return buffer;
  }

  // Stop active synthesis nodes with smooth volume ramp down
  _stopActiveNodes() {
    this.activeTimers.forEach(id => clearInterval(id));
    this.activeTimers = [];

    this.activeNodes.forEach(node => {
      try {
        if (node.stop) node.stop();
        node.disconnect();
      } catch (e) {}
    });
    this.activeNodes = [];
  }

  playTrack(trackId = null, volume = null) {
    this.ensureContext();
    if (!this.ctx) return;

    const targetId = trackId || this.activeTrackId || 'gentle-rain';
    this.activeTrackId = targetId;

    if (volume !== null) {
      this.trackVolume = Math.max(0, Math.min(1, volume));
    }

    try {
      localStorage.setItem('studystream_ambient_track', targetId);
      localStorage.setItem('studystream_ambient_vol', this.trackVolume.toString());
    } catch (e) {}

    // Smooth fade out of any existing track
    this._stopActiveNodes();

    // Fade in to desired volume
    if (this.trackGain) {
      this.trackGain.gain.setValueAtTime(0.01, this.ctx.currentTime);
      this.trackGain.gain.linearRampToValueAtTime(this.trackVolume, this.ctx.currentTime + 0.35);
    }

    // Launch dedicated procedural synthesizer for the track
    switch (targetId) {
      case 'gentle-rain':
        this._synthGentleRain();
        break;
      case 'rain-window':
        this._synthRainWindow();
        break;
      case 'distant-thunder':
        this._synthDistantThunder();
        break;
      case 'forest-birds':
        this._synthForestBirds();
        break;
      case 'flowing-stream':
        this._synthFlowingStream();
        break;
      case 'ocean-waves':
        this._synthOceanWaves();
        break;
      case 'mellow-lofi':
        this._synthMellowLoFi();
        break;
      case 'slow-piano':
        this._synthSlowPiano();
        break;
      case 'atmospheric-pad':
        this._synthAtmosphericPad();
        break;
      case 'pink-noise':
        this._synthPinkNoise();
        break;
      case 'brown-noise':
        this._synthBrownNoise();
        break;
      case 'night-crickets':
        this._synthNightCrickets();
        break;
      default:
        this._synthGentleRain();
        break;
    }

    this.isPlaying = true;
  }

  pauseTrack() {
    if (!this.ctx) return;
    if (this.trackGain) {
      this.trackGain.gain.linearRampToValueAtTime(0.001, this.ctx.currentTime + 0.25);
    }
    setTimeout(() => {
      this._stopActiveNodes();
      this.isPlaying = false;
    }, 250);
  }

  togglePlay(trackId = null) {
    if (this.isPlaying && (!trackId || trackId === this.activeTrackId)) {
      this.pauseTrack();
    } else {
      this.playTrack(trackId || this.activeTrackId);
    }
    return this.isPlaying;
  }

  setTrackVolume(vol) {
    this.ensureContext();
    const v = Math.max(0, Math.min(1, vol));
    this.trackVolume = v;
    try {
      localStorage.setItem('studystream_ambient_vol', v.toString());
    } catch (e) {}
    if (this.trackGain && this.ctx) {
      this.trackGain.gain.setValueAtTime(v, this.ctx.currentTime);
    }
  }

  setMasterVolume(vol) {
    this.ensureContext();
    const v = Math.max(0, Math.min(1, vol));
    this.masterVolume = v;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(v, this.ctx.currentTime);
    }
  }

  // ==========================================
  // Individual Procedural Sound Synthesizers
  // ==========================================

  // 1. Gentle Rainfall
  _synthGentleRain() {
    const src = this.ctx.createBufferSource();
    src.buffer = this.createNoiseBuffer(3, 'pink');
    src.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(950, this.ctx.currentTime);

    const highpass = this.ctx.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.setValueAtTime(120, this.ctx.currentTime);

    src.connect(filter);
    filter.connect(highpass);
    highpass.connect(this.trackGain);
    src.start();

    this.activeNodes.push(src, filter, highpass);
  }

  // 2. Rain on Window
  _synthRainWindow() {
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.createNoiseBuffer(2, 'pink');
    noise.loop = true;

    const bandpass = this.ctx.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.setValueAtTime(600, this.ctx.currentTime);
    bandpass.Q.setValueAtTime(2.2, this.ctx.currentTime);

    noise.connect(bandpass);
    bandpass.connect(this.trackGain);
    noise.start();

    this.activeNodes.push(noise, bandpass);

    // Droplet clicks
    const dropTimer = setInterval(() => {
      if (!this.isPlaying) return;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      const now = this.ctx.currentTime;
      osc.frequency.setValueAtTime(1400 + Math.random() * 800, now);
      osc.frequency.exponentialRampToValueAtTime(400, now + 0.04);
      g.gain.setValueAtTime(0.04, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
      osc.connect(g);
      g.connect(this.trackGain);
      osc.start(now);
      osc.stop(now + 0.05);
    }, 450);

    this.activeTimers.push(dropTimer);
  }

  // 3. Distant Thunder
  _synthDistantThunder() {
    // Heavy rain layer
    const rain = this.ctx.createBufferSource();
    rain.buffer = this.createNoiseBuffer(3, 'pink');
    rain.loop = true;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(750, this.ctx.currentTime);
    rain.connect(filter);
    filter.connect(this.trackGain);
    rain.start();
    this.activeNodes.push(rain, filter);

    // Procedural periodic thunder rumble
    const triggerThunder = () => {
      if (!this.isPlaying || !this.ctx) return;
      const now = this.ctx.currentTime;
      const thunderNoise = this.ctx.createBufferSource();
      thunderNoise.buffer = this.createNoiseBuffer(4, 'brown');
      const lowFilter = this.ctx.createBiquadFilter();
      lowFilter.type = 'lowpass';
      lowFilter.frequency.setValueAtTime(110, now);

      const thunderGain = this.ctx.createGain();
      thunderGain.gain.setValueAtTime(0.001, now);
      thunderGain.gain.linearRampToValueAtTime(0.35, now + 0.6);
      thunderGain.gain.exponentialRampToValueAtTime(0.001, now + 3.8);

      thunderNoise.connect(lowFilter);
      lowFilter.connect(thunderGain);
      thunderGain.connect(this.trackGain);
      thunderNoise.start(now);
      thunderNoise.stop(now + 4);
    };

    triggerThunder();
    const thunderTimer = setInterval(triggerThunder, 10000);
    this.activeTimers.push(thunderTimer);
  }

  // 4. Forest & Birdsong
  _synthForestBirds() {
    // Soft wind rustle
    const wind = this.ctx.createBufferSource();
    wind.buffer = this.createNoiseBuffer(4, 'pink');
    wind.loop = true;
    const windFilter = this.ctx.createBiquadFilter();
    windFilter.type = 'lowpass';
    windFilter.frequency.setValueAtTime(450, this.ctx.currentTime);
    wind.connect(windFilter);
    windFilter.connect(this.trackGain);
    wind.start();
    this.activeNodes.push(wind, windFilter);

    // Procedural bird chirps
    const chirpTimer = setInterval(() => {
      if (!this.isPlaying || !this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const baseFreq = 2600 + Math.random() * 800;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(baseFreq, now);
      osc.frequency.linearRampToValueAtTime(baseFreq + 600, now + 0.06);
      osc.frequency.linearRampToValueAtTime(baseFreq - 200, now + 0.14);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.05, now + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

      osc.connect(gain);
      gain.connect(this.trackGain);
      osc.start(now);
      osc.stop(now + 0.2);
    }, 2400);

    this.activeTimers.push(chirpTimer);
  }

  // 5. Flowing Mountain Stream
  _synthFlowingStream() {
    const stream = this.ctx.createBufferSource();
    stream.buffer = this.createNoiseBuffer(3, 'pink');
    stream.loop = true;

    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(480, this.ctx.currentTime);
    bp.Q.setValueAtTime(1.8, this.ctx.currentTime);

    // LFO to modulate stream bubbling
    const lfo = this.ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(0.4, this.ctx.currentTime);
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.setValueAtTime(180, this.ctx.currentTime);
    lfo.connect(lfoGain);
    lfoGain.connect(bp.frequency);
    lfo.start();

    stream.connect(bp);
    bp.connect(this.trackGain);
    stream.start();

    this.activeNodes.push(stream, bp, lfo, lfoGain);
  }

  // 6. Pacific Ocean Breakers
  _synthOceanWaves() {
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.createNoiseBuffer(5, 'brown');
    noise.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(320, this.ctx.currentTime);

    // LFO for wave ebb and flow (period of 8 seconds)
    const lfo = this.ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(0.125, this.ctx.currentTime);

    const lfoGain = this.ctx.createGain();
    lfoGain.gain.setValueAtTime(240, this.ctx.currentTime);
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    lfo.start();

    noise.connect(filter);
    filter.connect(this.trackGain);
    noise.start();

    this.activeNodes.push(noise, filter, lfo, lfoGain);
  }

  // 7. Mellow Lo-Fi Study Beats
  _synthMellowLoFi() {
    // Subtle vinyl dust crackle
    const vinyl = this.ctx.createBufferSource();
    vinyl.buffer = this.createNoiseBuffer(2, 'white');
    vinyl.loop = true;
    const vinylGain = this.ctx.createGain();
    vinylGain.gain.setValueAtTime(0.015, this.ctx.currentTime);
    vinyl.connect(vinylGain);
    vinylGain.connect(this.trackGain);
    vinyl.start();
    this.activeNodes.push(vinyl, vinylGain);

    // Warm Rhodes/Electric Piano chord sequence (Fmaj7 -> Am7 -> Dm7 -> C)
    const chords = [
      [174.61, 220.00, 261.63, 329.63], // Fmaj7
      [220.00, 261.63, 329.63, 392.00], // Am7
      [146.83, 174.61, 220.00, 261.63], // Dm7
      [130.81, 164.81, 196.00, 246.94], // C
    ];

    let chordIdx = 0;
    const playChord = () => {
      if (!this.isPlaying || !this.ctx) return;
      const chord = chords[chordIdx % chords.length];
      chordIdx++;
      const now = this.ctx.currentTime;

      chord.forEach(freq => {
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now);

        g.gain.setValueAtTime(0.001, now);
        g.gain.linearRampToValueAtTime(0.04, now + 0.15);
        g.gain.exponentialRampToValueAtTime(0.001, now + 2.7);

        osc.connect(g);
        g.connect(this.trackGain);
        osc.start(now);
        osc.stop(now + 2.8);
      });
    };

    playChord();
    const lofiTimer = setInterval(playChord, 3000);
    this.activeTimers.push(lofiTimer);
  }

  // 8. Slow Instrumental Piano
  _synthSlowPiano() {
    // Acoustic Pentatonic notes
    const scale = [220.00, 261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33];

    const playNote = () => {
      if (!this.isPlaying || !this.ctx) return;
      const freq = scale[Math.floor(Math.random() * scale.length)];
      const now = this.ctx.currentTime;

      const osc = this.ctx.createOscillator();
      const oscHarmonic = this.ctx.createOscillator();
      const g = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);

      oscHarmonic.type = 'triangle';
      oscHarmonic.frequency.setValueAtTime(freq * 2, now);

      g.gain.setValueAtTime(0.001, now);
      g.gain.linearRampToValueAtTime(0.06, now + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 3.4);

      osc.connect(g);
      oscHarmonic.connect(g);
      g.connect(this.trackGain);

      osc.start(now);
      oscHarmonic.start(now);
      osc.stop(now + 3.5);
      oscHarmonic.stop(now + 3.5);
    };

    playNote();
    const pianoTimer = setInterval(playNote, 2200);
    this.activeTimers.push(pianoTimer);
  }

  // 9. Atmospheric Drone Pad
  _synthAtmosphericPad() {
    const freqs = [146.83, 220.00, 293.66, 440.00]; // D, A, D, A
    freqs.forEach(freq => {
      const osc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(500, this.ctx.currentTime);

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq + (Math.random() - 0.5) * 1.5, this.ctx.currentTime);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.035, this.ctx.currentTime);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.trackGain);
      osc.start();

      this.activeNodes.push(osc, filter, gain);
    });
  }

  // 10. Pink Noise
  _synthPinkNoise() {
    const src = this.ctx.createBufferSource();
    src.buffer = this.createNoiseBuffer(3, 'pink');
    src.loop = true;
    src.connect(this.trackGain);
    src.start();
    this.activeNodes.push(src);
  }

  // 11. Deep Brown Noise
  _synthBrownNoise() {
    const src = this.ctx.createBufferSource();
    src.buffer = this.createNoiseBuffer(3, 'brown');
    src.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(450, this.ctx.currentTime);

    src.connect(filter);
    filter.connect(this.trackGain);
    src.start();

    this.activeNodes.push(src, filter);
  }

  // 12. Twilight Crickets
  _synthNightCrickets() {
    const cricketTimer = setInterval(() => {
      if (!this.isPlaying || !this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(4600 + (Math.random() - 0.5) * 100, now);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.025, now + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

      osc.connect(gain);
      gain.connect(this.trackGain);
      osc.start(now);
      osc.stop(now + 0.16);
    }, 850);

    this.activeTimers.push(cricketTimer);
  }

  // Pomodoro Completion Chime (C5, E5, G5, C6 Harmonic Arpeggio)
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
    this._stopActiveNodes();
    this.isPlaying = false;
  }
}

export const soundSynthesizer = new SoundSynthesizer();
