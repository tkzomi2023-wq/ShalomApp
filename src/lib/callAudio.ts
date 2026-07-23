/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Synthesizes audio signals for calling (Ringtone, Ringback, Busy tone, End call tone)
 * using the Web Audio API for 100% reliability without external audio dependencies.
 */

class CallAudioEngine {
  private ctx: AudioContext | null = null;
  private currentOscillators: OscillatorNode[] = [];
  private currentGainNodes: GainNode[] = [];
  private isMuted: boolean = false;
  private intervalTimer: any = null;

  private getContext(): AudioContext {
    if (!this.ctx || this.ctx.state === 'closed') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (muted) {
      this.stopAll();
    }
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  public stopAll() {
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }
    this.currentOscillators.forEach(osc => {
      try {
        osc.stop();
        osc.disconnect();
      } catch (e) {}
    });
    this.currentGainNodes.forEach(g => {
      try {
        g.disconnect();
      } catch (e) {}
    });
    this.currentOscillators = [];
    this.currentGainNodes = [];
  }

  /**
   * Incoming Call Ringtone: melodic double-chime pattern repeating
   */
  public playRingtone(volume = 0.8) {
    this.stopAll();
    if (this.isMuted) return;

    const ctx = this.getContext();

    const playChimeSequence = () => {
      if (this.isMuted) return;
      const now = ctx.currentTime;

      // First chime
      this.createTone(ctx, 440, now, 0.3, volume * 0.4); // A4
      this.createTone(ctx, 554.37, now + 0.1, 0.3, volume * 0.4); // C#5
      this.createTone(ctx, 659.25, now + 0.2, 0.4, volume * 0.5); // E5

      // Second chime after short pause
      this.createTone(ctx, 554.37, now + 0.6, 0.3, volume * 0.4);
      this.createTone(ctx, 659.25, now + 0.7, 0.3, volume * 0.4);
      this.createTone(ctx, 880, now + 0.8, 0.5, volume * 0.5); // A5
    };

    playChimeSequence();
    this.intervalTimer = setInterval(() => {
      playChimeSequence();
    }, 2400);
  }

  /**
   * Outgoing Ringback Tone: classic soft double pulse (440Hz + 480Hz)
   */
  public playDialTone(volume = 0.5) {
    this.stopAll();
    if (this.isMuted) return;

    const ctx = this.getContext();

    const playPulse = () => {
      if (this.isMuted) return;
      const now = ctx.currentTime;
      this.createToneDual(ctx, 440, 480, now, 1.5, volume * 0.3);
    };

    playPulse();
    this.intervalTimer = setInterval(() => {
      playPulse();
    }, 4000);
  }

  /**
   * Busy Tone: repeating short pulses (480Hz + 620Hz)
   */
  public playBusyTone(volume = 0.5) {
    this.stopAll();
    if (this.isMuted) return;

    const ctx = this.getContext();

    const playPulse = () => {
      if (this.isMuted) return;
      const now = ctx.currentTime;
      this.createToneDual(ctx, 480, 620, now, 0.5, volume * 0.3);
    };

    playPulse();
    this.intervalTimer = setInterval(() => {
      playPulse();
    }, 1000);

    // Auto-stop after 4 seconds
    setTimeout(() => {
      this.stopAll();
    }, 4500);
  }

  /**
   * End Call Chime: descending soft pitch
   */
  public playEndCallTone(volume = 0.5) {
    this.stopAll();
    if (this.isMuted) return;

    const ctx = this.getContext();
    const now = ctx.currentTime;

    this.createTone(ctx, 440, now, 0.15, volume * 0.4);
    this.createTone(ctx, 330, now + 0.15, 0.25, volume * 0.3);
  }

  private createTone(ctx: AudioContext, freq: number, startTime: number, duration: number, vol: number) {
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.001, startTime);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.001, vol), startTime + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + duration);

      this.currentOscillators.push(osc);
      this.currentGainNodes.push(gain);
    } catch (e) {
      console.warn('Audio tone creation skipped:', e);
    }
  }

  private createToneDual(ctx: AudioContext, freq1: number, freq2: number, startTime: number, duration: number, vol: number) {
    this.createTone(ctx, freq1, startTime, duration, vol * 0.5);
    this.createTone(ctx, freq2, startTime, duration, vol * 0.5);
  }
}

export const callAudio = new CallAudioEngine();
