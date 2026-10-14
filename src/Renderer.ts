import type { Simulation } from "./GameLoop";
export interface Renderer {
  backend: string;
  render(sim: Simulation, yaw: number, pitch: number, fixed?: boolean): void;
  drawCalls(): number;
  metadata(): Record<string, unknown>;
  dispose(): void;
  setReducedMotion(value: boolean): void;
}
