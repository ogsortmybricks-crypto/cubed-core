export interface TimedTurn {
  move: string;
  frame: number;
}

export interface AlgorithmMatch {
  name: string;
  family: string;
  start: number;
  end: number;
  moves: readonly string[];
  cue: string;
}

export interface PauseGap {
  afterMove: number;
  seconds: number;
}

export interface SolveCoaching {
  moveCount: number;
  algorithms: AlgorithmMatch[];
  medianTurnGapSeconds: number | null;
  elapsedSeconds: number | null;
  pauses: PauseGap[];
  timingAvailable: boolean;
}

const MOVE_PATTERN = /^[UDLRFB](?:'|2)?$/;

const ALGORITHM_CATALOG = [
  {
    name: "Sexy move",
    family: "Trigger",
    moves: ["R", "U", "R'", "U'"],
    cue: "Keep the four-move rhythm even. Avoid pausing before the final U'.",
  },
  {
    name: "Inverse sexy move",
    family: "Trigger",
    moves: ["U", "R", "U'", "R'"],
    cue: "Use this as one fluid trigger instead of four separate finger turns.",
  },
  {
    name: "Sledgehammer",
    family: "Trigger",
    moves: ["R'", "F", "R", "F'"],
    cue: "Keep the F turns compact so the front-face grip does not interrupt flow.",
  },
  {
    name: "Hedge slammer",
    family: "Trigger",
    moves: ["F", "R'", "F'", "R"],
    cue: "Try to preserve the same hand position through the front-face turns.",
  },
  {
    name: "T-perm",
    family: "PLL",
    moves: ["R", "U", "R'", "U'", "R'", "F", "R2", "U'", "R'", "U'", "R", "U", "R'", "F'"],
    cue: "Practice the full permutation as a named chunk, then compare its first and second half.",
  },
  {
    name: "J-perm fragment",
    family: "PLL fragment",
    moves: ["R", "U", "R'", "F'", "R", "U", "R'", "U'", "R'", "F", "R2", "U'", "R'"],
    cue: "This matches a common J-perm sequence. Verify the case before drilling the full alg.",
  },
] as const;

export function parseMoveSequence(text: string): string[] {
  const tokens = text
    .replace(/[’′]/g, "'")
    .trim()
    .split(/[\s,]+/)
    .filter(Boolean);
  const invalid = tokens.find((move) => !MOVE_PATTERN.test(move));
  if (invalid) {
    throw new Error(`“${invalid}” is not a supported face turn. Use moves like R, U', or F2.`);
  }
  return tokens;
}

function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function inverseMove(move: string): string {
  if (move.endsWith("2")) return move;
  return move.endsWith("'") ? move.slice(0, -1) : `${move}'`;
}

export function analyzeSolve(
  moves: readonly string[],
  timedTurns: readonly TimedTurn[] = [],
  fps = 0,
): SolveCoaching {
  const algorithms: AlgorithmMatch[] = [];
  for (const algorithm of ALGORITHM_CATALOG) {
    for (let start = 0; start <= moves.length - algorithm.moves.length; start += 1) {
      if (algorithm.moves.every((move, index) => moves[start + index] === move)) {
        algorithms.push({
          name: algorithm.name,
          family: algorithm.family,
          start,
          end: start + algorithm.moves.length,
          moves: algorithm.moves,
          cue: algorithm.cue,
        });
      }
    }
  }
  for (let start = 0; start <= moves.length - 4; start += 1) {
    const [first, second, third, fourth] = moves.slice(start, start + 4);
    if (
      first !== second &&
      third === inverseMove(first) &&
      fourth === inverseMove(second) &&
      !algorithms.some((match) => match.start === start)
    ) {
      algorithms.push({
        name: "Four-move commutator",
        family: "Trigger pattern",
        start,
        end: start + 4,
        moves: [first, second, third, fourth],
        cue: "This move structure returns the first two turns in reverse. Practice it as one compact trigger.",
      });
    }
  }

  const validTiming =
    fps > 0 &&
    timedTurns.length === moves.length &&
    timedTurns.every(
      (turn, index) =>
        turn.move === moves[index] &&
        Number.isFinite(turn.frame) &&
        (index === 0 || turn.frame > timedTurns[index - 1].frame),
    );
  if (!validTiming || timedTurns.length < 2) {
    return {
      moveCount: moves.length,
      algorithms,
      medianTurnGapSeconds: null,
      elapsedSeconds: null,
      pauses: [],
      timingAvailable: false,
    };
  }

  const gaps = timedTurns.slice(1).map((turn, index) => ({
    afterMove: index + 1,
    seconds: (turn.frame - timedTurns[index].frame) / fps,
  }));
  const medianGap = median(gaps.map((gap) => gap.seconds));
  const pauseThreshold = Math.max(1.2, (medianGap ?? 0) * 2.5);
  return {
    moveCount: moves.length,
    algorithms,
    medianTurnGapSeconds: medianGap,
    elapsedSeconds:
      (timedTurns[timedTurns.length - 1].frame - timedTurns[0].frame) / fps,
    pauses: gaps
      .filter((gap) => gap.seconds >= pauseThreshold)
      .sort((left, right) => right.seconds - left.seconds),
    timingAvailable: true,
  };
}

