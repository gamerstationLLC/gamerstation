export type EnemyPreset = {
  key: string;
  name: string;
  hp: number;
  defLevel: number;
  defBonus: number;
};

// Keep this SMALL (20–50). Add/adjust whenever.
export const ENEMY_PRESETS: EnemyPreset[] = [
  { key: "custom", name: "Custom", hp: 150, defLevel: 100, defBonus: 100 },

  // Popular examples (replace with your favorites)
  { key: "zulrah", name: "Zulrah", hp: 500, defLevel: 300, defBonus: 0 },
  { key: "vorkath", name: "Vorkath", hp: 750, defLevel: 250, defBonus: 0 },
  { key: "jad", name: "TzTok-Jad", hp: 250, defLevel: 240, defBonus: 0 },
  { key: "zuk", name: "TzKal-Zuk", hp: 1200, defLevel: 350, defBonus: 0 },
];
