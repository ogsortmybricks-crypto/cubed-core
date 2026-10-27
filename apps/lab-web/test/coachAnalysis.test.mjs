import assert from "node:assert/strict";
import test from "node:test";

import { analyzeSolve, parseMoveSequence } from "../src/coachAnalysis.ts";

test("parses supported notation and normalizes typographic primes", () => {
  assert.deepEqual(parseMoveSequence("R U’ R' U' F2"), ["R", "U'", "R'", "U'", "F2"]);
  assert.throws(() => parseMoveSequence("R X U"), /not a supported face turn/);
});

test("recognizes common trigger fragments at their move positions", () => {
  const analysis = analyzeSolve(["F", "R", "U", "R'", "U'", "F'"]);
  assert.equal(analysis.algorithms.length, 1);
  assert.equal(analysis.algorithms[0].name, "Sexy move");
  assert.equal(analysis.algorithms[0].start, 1);
  assert.equal(analysis.timingAvailable, false);
});

test("recognizes a four-move commutator without misnaming a full algorithm", () => {
  const analysis = analyzeSolve(["D", "B", "D'", "B'"]);
  assert.equal(analysis.algorithms.length, 1);
  assert.equal(analysis.algorithms[0].name, "Four-move commutator");
  assert.equal(analysis.algorithms[0].family, "Trigger pattern");
});

test("reports pauses from matching exact turn events only", () => {
  const moves = ["R", "U", "R'", "U'", "F"];
  const timed = [
    { move: "R", frame: 0 },
    { move: "U", frame: 30 },
    { move: "R'", frame: 60 },
    { move: "U'", frame: 300 },
    { move: "F", frame: 330 },
  ];
  const analysis = analyzeSolve(moves, timed, 30);
  assert.equal(analysis.timingAvailable, true);
  assert.equal(analysis.medianTurnGapSeconds, 1);
  assert.equal(analysis.elapsedSeconds, 11);
  assert.deepEqual(analysis.pauses, [{ afterMove: 3, seconds: 8 }]);
});

test("refuses checkpoint-like or mismatched timing records", () => {
  const analysis = analyzeSolve(
    ["R", "U"],
    [{ move: "R", frame: 0 }, { move: "D", frame: 100 }],
    120,
  );
  assert.equal(analysis.timingAvailable, false);
  assert.equal(analysis.elapsedSeconds, null);
  assert.deepEqual(analysis.pauses, []);
});

