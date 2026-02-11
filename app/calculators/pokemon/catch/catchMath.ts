export type RulesetKey = "gen1" | "gen2" | "gen34" | "gen5plus" | "letsgo" | "pla";

export type StatusKey = "none" | "paralysis" | "poison" | "burn" | "sleep" | "freeze";

export type BallKey =
  | "poke"
  | "great"
  | "ultra"
  | "master"
  | "premier"
  | "luxury"
  | "quick"
  | "dusk"
  | "repeat"
  | "timer"
  | "nest"
  | "net"
  | "dive";

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

/**
 * Status multipliers (Gen 3+ baseline).
 * Sleep/Freeze = 2.0; others = 1.5.
 */
export function statusMultiplier(status: StatusKey): number {
  if (status === "sleep" || status === "freeze") return 2.0;
  if (status === "paralysis" || status === "poison" || status === "burn") return 1.5;
  return 1.0;
}

/**
 * Ball multipliers baseline.
 * NOTE: Many balls are conditional; for v1 we assume conditions are met when chosen.
 * You can add toggles later (e.g., "isNight", "isCave", "alreadyCaught", "isWaterOrBug", etc.).
 */
export function ballMultiplier(ball: BallKey, turn: number): number {
  switch (ball) {
    case "poke":
    case "premier":
    case "luxury":
      return 1.0;
    case "great":
      return 1.5;
    case "ultra":
      return 2.0;
    case "master":
      return 9999; // guaranteed
    case "quick":
      // Modern: 5x turn 1, else 1x (good default for Gen 5+)
      return turn <= 1 ? 5.0 : 1.0;
    case "dusk":
      return 3.0; // if night/cave
    case "repeat":
      return 3.0; // if already caught
    case "timer":
      // Modern-ish approximation: ramp to 4x
      return clamp(1 + (turn - 1) * 0.3, 1, 4);
    case "nest":
    case "net":
    case "dive":
    default:
      // Leave 1.0 until you add condition toggles (level/type/underwater)
      return 1.0;
  }
}

/**
 * Compute Gen 3+ "a" value using normalized HP.
 * a = ((3*MaxHP - 2*CurHP) * CatchRate * Ball * Status) / (3*MaxHP)
 *
 * We don't have exact HP values in v1; we use:
 * MaxHP = 1
 * CurHP = hpPctRemaining (0..1)
 */
export function computeAValueGen3Plus(opts: {
  captureRate: number; // 0..255
  hpPctRemaining: number; // 0..1
  ballMult: number;
  statusMult: number;
}): number {
  const CR = clamp(opts.captureRate, 0, 255);
  const hp = clamp(opts.hpPctRemaining, 0, 1);

  const a = ((3 * 1 - 2 * hp) * CR * opts.ballMult * opts.statusMult) / (3 * 1);
  return clamp(a, 0, 255);
}

/**
 * Convert "a" into true capture probability (Gen 3+ / Gen 4 / Gen 5+ style).
 *
 * Shake check approach:
 * If a >= 255 => guaranteed
 * Else:
 *   b = 1048560 / sqrt(sqrt(16711680 / a))
 * Each of 4 shakes succeeds with probability p = b / 65535
 * Capture probability = p^4
 *
 * We compute in floating point safely.
 */
export function captureProbabilityFromA_Gen3Plus(a: number): number {
  const A = clamp(a, 0, 255);
  if (A >= 255) return 1;

  // Prevent division by 0
  if (A <= 0) return 0;

  const x = 16711680 / A; // 0xFF0000 / a
  const sqrt1 = Math.sqrt(x);
  const sqrt2 = Math.sqrt(sqrt1);
  const b = 1048560 / sqrt2;

  const p = clamp(b / 65535, 0, 1);
  return Math.pow(p, 4);
}

/**
 * Main entrypoint.
 * For now:
 * - gen34 and gen5plus share the same shake math.
 * - gen1/gen2/letsgo/pla are stubbed to use gen5plus logic (so UI works),
 *   but you can implement true mechanics later with branching.
 */
export function computeCatchChance(opts: {
  rulesetKey: RulesetKey;
  captureRate: number;
  hpPctRemaining: number;
  ball: BallKey;
  status: StatusKey;
  turn: number;
}): number {
  // Stub special mechanics to gen5plus for v1
  const effectiveRuleset: RulesetKey =
    opts.rulesetKey === "letsgo" || opts.rulesetKey === "pla" ? "gen5plus" : opts.rulesetKey;

  // Gen 1/2 are different, but for v1 we still return gen5plus-style probability
  // until you want full historical accuracy per game.
  const ballMult = ballMultiplier(opts.ball, opts.turn);
  const statusMult = statusMultiplier(opts.status);

  const a = computeAValueGen3Plus({
    captureRate: opts.captureRate,
    hpPctRemaining: opts.hpPctRemaining,
    ballMult,
    statusMult,
  });

  // If you later implement true gen1/gen2, branch here:
  // if (effectiveRuleset === "gen1") return computeGen1(...)

  return captureProbabilityFromA_Gen3Plus(a);
}
