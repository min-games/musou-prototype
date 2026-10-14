import type { Player } from "./CombatSystem";
// Optional, synthesized cues: no downloads, and no audio context until a user gesture.
export class AudioFeedback {
  enabled = true;
  private context?: AudioContext;
  private previous?: Player;
  private hits = 0;
  private specials = 0;
  private hp = 100;
  unlock() {
    if (!this.enabled || !window.AudioContext) return;
    try {
      this.context ??= new AudioContext();
      void this.context.resume().catch(() => {});
    } catch {
      this.enabled = false;
    }
  }
  private tone(
    frequency: number,
    end: number,
    duration: number,
    volume: number,
  ) {
    const context = this.context;
    if (!this.enabled || !context || context.state !== "running") return;
    const oscillator = context.createOscillator(),
      gain = context.createGain(),
      now = context.currentTime;
    oscillator.type = "triangle";
    oscillator.frequency.setValueAtTime(frequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(end, now + duration);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + duration);
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
    };
  }
  update(player: Player) {
    if (this.previous !== player) {
      this.previous = player;
      this.hits = player.hits;
      this.specials = player.specials;
      this.hp = player.hp;
    }
    if (player.specials > this.specials) {
      this.tone(220, 55, 0.45, 0.07);
      this.tone(440, 110, 0.3, 0.035);
    } else if (player.hits > this.hits) this.tone(180, 70, 0.07, 0.055);
    if (player.hp < this.hp) this.tone(100, 45, 0.12, 0.05);
    this.hits = player.hits;
    this.specials = player.specials;
    this.hp = player.hp;
  }
}
