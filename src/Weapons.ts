import type { Player, Hero } from "./CombatSystem";
export type WeaponId =
  "saber" | "spear" | "greatblade" | "shortbow" | "longbow" | "fanbow";
export interface Weapon {
  id: WeaponId;
  hero: Hero;
  name: string;
  description: string;
  damage: number;
  finisher: number;
  period: number;
  range: number;
  halfArc: number;
  arrowSpeed: number;
  arrows: number;
  spread: number;
}
export const WEAPONS: Readonly<Record<WeaponId, Readonly<Weapon>>> = {
  saber: {
    id: "saber",
    hero: "vanguard",
    name: "Saber",
    description: "Quick, balanced three-hit sweeps",
    damage: 25,
    finisher: 40,
    period: 0.38,
    range: 2.8,
    halfArc: Math.PI * 0.42,
    arrowSpeed: 0,
    arrows: 1,
    spread: 0,
  },
  spear: {
    id: "spear",
    hero: "vanguard",
    name: "Spear",
    description: "Long reach through a narrow thrusting arc",
    damage: 34,
    finisher: 55,
    period: 0.5,
    range: 4.5,
    halfArc: Math.PI * 0.2,
    arrowSpeed: 0,
    arrows: 1,
    spread: 0,
  },
  greatblade: {
    id: "greatblade",
    hero: "vanguard",
    name: "Greatblade",
    description: "Slow, powerful swings with broad coverage",
    damage: 50,
    finisher: 82,
    period: 0.68,
    range: 3.4,
    halfArc: Math.PI * 0.48,
    arrowSpeed: 0,
    arrows: 1,
    spread: 0,
  },
  shortbow: {
    id: "shortbow",
    hero: "ranger",
    name: "Shortbow",
    description: "Rapid arrows; quick charge generation",
    damage: 32,
    finisher: 32,
    period: 0.32,
    range: 19.2,
    halfArc: 0,
    arrowSpeed: 24,
    arrows: 1,
    spread: 0.14,
  },
  longbow: {
    id: "longbow",
    hero: "ranger",
    name: "Longbow",
    description: "Slower, harder hits at greater distance",
    damage: 65,
    finisher: 65,
    period: 0.62,
    range: 28.8,
    halfArc: 0,
    arrowSpeed: 36,
    arrows: 1,
    spread: 0.14,
  },
  fanbow: {
    id: "fanbow",
    hero: "ranger",
    name: "Fan Bow",
    description: "Three arrows spread across a crowd",
    damage: 23,
    finisher: 23,
    period: 0.52,
    range: 14.4,
    halfArc: 0,
    arrowSpeed: 24,
    arrows: 3,
    spread: 0.16,
  },
};
export const DEFAULT_WEAPON: Record<Hero, WeaponId> = {
  vanguard: "saber",
  ranger: "shortbow",
};
export const roundDamage = (damage: number) => Math.ceil(damage - 1e-9);
export function getWeapon(p: Pick<Player, "hero" | "weapon">) {
  const weapon = WEAPONS[p.weapon];
  return weapon.hero === p.hero ? weapon : WEAPONS[DEFAULT_WEAPON[p.hero]];
}
export function weaponStats(
  p: Pick<
    Player,
    | "hero"
    | "weapon"
    | "attackSpeedMult"
    | "rangeMult"
    | "extraArrows"
    | "damageMult"
    | "pierce"
  >,
) {
  const weapon = getWeapon(p);
  // Match the actual 60 Hz cadence rather than displaying an unattainable rate.
  const period =
    Math.max(
      6,
      Math.ceil(
        (weapon.period / Math.max(0.5, Math.min(2.5, p.attackSpeedMult))) * 60 -
          1e-9,
      ),
    ) / 60;
  const range = weapon.range * Math.max(0.5, Math.min(1.75, p.rangeMult));
  const arrows =
    p.hero === "ranger"
      ? Math.min(7, weapon.arrows + Math.max(0, Math.floor(p.extraArrows)))
      : 1;
  const damage = roundDamage(weapon.damage * p.damageMult),
    finisher = roundDamage(weapon.finisher * p.damageMult);
  const dps =
    p.hero === "ranger"
      ? damage / period
      : (damage * 2 + finisher) / (period * 3);
  const targetsPerArrow =
    p.hero === "ranger" ? 1 + Math.max(0, Math.floor(p.pierce)) : 1;
  return {
    weapon,
    period,
    rate: 1 / period,
    range,
    arrows,
    damage,
    finisher,
    dps,
    targetsPerArrow,
    crowdDps: dps * arrows * targetsPerArrow,
  };
}
