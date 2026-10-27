import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";

import {
  GTD1_PUBLISHED_DEMO,
  GTD1_VIDEO_TIMING,
  bleTimedMoves,
  loadPublishedBleGroundTruth,
  loadPublishedDemo,
  type TimedMove,
} from "../publishedDemo";
import {
  analyzeSolve,
  parseMoveSequence,
  type AlgorithmMatch,
  type SolveCoaching,
} from "../coachAnalysis";
import "../labTools.css";
import "./CoachWorkbench.css";

interface CoachRouteState {
  moves?: unknown;
  sourceName?: string;
}

function formatDuration(seconds: number | null): string {
  if (seconds === null) return "N/A";
  return `${seconds.toFixed(2)}s`;
}

function algorithmRanges(matches: readonly AlgorithmMatch[]): Map<number, string> {
  const ranges = new Map<number, string>();
  for (const match of matches) {
    for (let index = match.start; index < match.end; index += 1) {
      ranges.set(index, match.name);
    }
  }
  return ranges;
}

function chooseFocus(analysis: SolveCoaching): { title: string; detail: string } {
  const longestPause = analysis.pauses[0];
  if (longestPause) {
    return {
      title: "Keep your hands moving through the longest pause",
      detail: `The largest recorded gap is ${formatDuration(longestPause.seconds)}, after move ${longestPause.afterMove}. On the next solve, use that moment as a cue to look ahead to the next pair instead of stopping.`,
    };
  }
  if (analysis.algorithms.length > 0) {
    const first = analysis.algorithms[0];
    return {
      title: `Make ${first.name} feel automatic`,
      detail: `The move sequence contains ${analysis.algorithms.length} recognized algorithm fragment${analysis.algorithms.length === 1 ? "" : "s"}. Drill one clean repetition at a time, then try the full solve without breaking the trigger.`,
    };
  }
  return {
    title: "Build a clean, repeatable baseline",
    detail: "This scan did not find a catalogued trigger. Start with relaxed turning and a consistent inspection-to-first-move routine. A complete case library can be added as the app grows.",
  };
}

export function CoachWorkbench() {
  const location = useLocation();
  const routeState = (location.state ?? null) as CoachRouteState | null;
  const incomingMoves = Array.isArray(routeState?.moves)
    ? routeState.moves.filter(
        (move): move is string => typeof move === "string",
      )
    : [];
  const fromRun = incomingMoves.length > 0;
  const [moves, setMoves] = useState<string[]>(incomingMoves);
  const [timedMoves, setTimedMoves] = useState<TimedMove[]>([]);
  const [sourceName, setSourceName] = useState(
    routeState?.sourceName ?? (fromRun ? "Selected decoded run" : "Loading demo solve"),
  );
  const [loading, setLoading] = useState(!fromRun);
  const [error, setError] = useState("");
  const [moveDraft, setMoveDraft] = useState("");
  const [showMoveEntry, setShowMoveEntry] = useState(false);
  const [fps, setFps] = useState(0);

  useEffect(() => {
    if (fromRun) {
      setMoves(incomingMoves);
      setTimedMoves([]);
      setFps(0);
      setSourceName(routeState?.sourceName ?? "Selected decoded run");
      setLoading(false);
      setError("");
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    Promise.all([
      loadPublishedDemo(controller.signal),
      loadPublishedBleGroundTruth(controller.signal),
    ])
      .then(([demo, ble]) => {
        const demoMoves = demo.result.moves;
        setMoves(demoMoves);
        setTimedMoves(bleTimedMoves(ble, demoMoves));
        setFps(GTD1_VIDEO_TIMING.fps);
        setSourceName(GTD1_PUBLISHED_DEMO.title);
        setError("");
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) {
          setError(
            reason instanceof Error
              ? reason.message
              : "The reference solve could not be loaded.",
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [fromRun, location.key]);

  const analysis = useMemo(
    () => analyzeSolve(moves, timedMoves, fps),
    [fps, moves, timedMoves],
  );
  const highlightedMoves = useMemo(
    () => algorithmRanges(analysis.algorithms),
    [analysis.algorithms],
  );
  const focus = chooseFocus(analysis);

  function applyMoveDraft(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const parsed = parseMoveSequence(moveDraft);
      if (parsed.length === 0) throw new Error("Paste at least one move first.");
      setMoves(parsed);
      setTimedMoves([]);
      setFps(0);
      setSourceName("Pasted move sequence");
      setError("");
      setShowMoveEntry(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The move list is invalid.");
    }
  }

  return (
    <div className="page coach-page">
      <header className="coach-hero">
        <div>
          <p className="station-code">Cubed Core · Coach</p>
          <h1>Every solve has a lesson.</h1>
          <p className="page-description">
            Find familiar algorithms, spot the moments that break your rhythm,
            and leave with one useful thing to practice.
          </p>
        </div>
        <div className="coach-local-badge">
          <span aria-hidden="true">✳</span>
          <div>
            <strong>Explainable scan</strong>
            <small>Runs in your browser · no AI key needed</small>
          </div>
        </div>
      </header>

      <section className="coach-source-row" aria-label="Solve source">
        <div>
          <span className="coach-live-dot" aria-hidden="true" />
          <div>
            <p className="station-code">Analyzing</p>
            <strong>{sourceName}</strong>
          </div>
        </div>
        <div className="coach-source-actions">
          <button
            className="button button-secondary"
            type="button"
            onClick={() => setShowMoveEntry((open) => !open)}
          >
            {showMoveEntry ? "Close move entry" : "Paste a sequence"}
          </button>
          <Link className="button button-quiet" to="/runs">
            Browse runs
          </Link>
        </div>
      </section>

      {showMoveEntry && (
        <form className="coach-move-entry" onSubmit={applyMoveDraft}>
          <label htmlFor="coach-move-input">Move sequence in standard notation</label>
          <textarea
            id="coach-move-input"
            rows={3}
            value={moveDraft}
            onChange={(event) => setMoveDraft(event.target.value)}
            placeholder="R U R' U'  ·  F2 L D' ..."
          />
          <p>Accepted turns: U, R, F, D, L, B, with ' or 2 modifiers.</p>
          <button className="button button-primary" type="submit">
            Analyze sequence
          </button>
        </form>
      )}

      {error && (
        <p className="tool-message tool-message-error" role="alert">
          {error}
        </p>
      )}
      {loading && (
        <p className="coach-loading" role="status">
          Loading a verified sample solve and its timing record…
        </p>
      )}

      {!loading && moves.length > 0 && (
        <>
          <section className="coach-metrics" aria-label="Solve summary">
            <article className="coach-metric">
              <span className="station-code">MOVES</span>
              <strong>{analysis.moveCount}</strong>
              <small>reconstructed turns</small>
            </article>
            <article className="coach-metric">
              <span className="station-code">ALGORITHM HITS</span>
              <strong>{analysis.algorithms.length}</strong>
              <small>catalogued fragments</small>
            </article>
            <article className="coach-metric">
              <span className="station-code">SOLVE WINDOW</span>
              <strong>{formatDuration(analysis.elapsedSeconds)}</strong>
              <small>
                {analysis.timingAvailable ? "from exact turn events" : "timing not available"}
              </small>
            </article>
            <article className="coach-metric coach-metric-accent">
              <span className="station-code">LONGEST PAUSE</span>
              <strong>
                {formatDuration(analysis.pauses[0]?.seconds ?? null)}
              </strong>
              <small>
                {analysis.timingAvailable
                  ? `${analysis.pauses.length} gap${analysis.pauses.length === 1 ? "" : "s"} over threshold`
                  : "needs per-turn timestamps"}
              </small>
            </article>
          </section>

          <section className="coach-sequence-panel" aria-labelledby="coach-sequence-title">
            <div className="coach-section-heading">
              <div>
                <p className="station-code">Move-by-move</p>
                <h2 id="coach-sequence-title">Patterns in your solve</h2>
              </div>
              <span>{moves.length} turns</span>
            </div>
            <div className="coach-move-list" aria-label="Move sequence with recognized patterns">
              {moves.map((move, index) => (
                <span
                  className={`coach-move-chip${highlightedMoves.has(index) ? " is-pattern" : ""}`}
                  key={`${index}-${move}`}
                  title={
                    highlightedMoves.has(index)
                      ? `Part of ${highlightedMoves.get(index)}`
                      : `Move ${index + 1}`
                  }
                >
                  {move}
                </span>
              ))}
            </div>
            <p className="coach-evidence-note">
              Highlighted turns match a small library of common triggers and PLL
              patterns. This is not a full CFOP stage classifier.
            </p>
          </section>

          <div className="coach-lower-grid">
            <section className="coach-panel" aria-labelledby="coach-patterns-title">
              <div className="coach-section-heading">
                <div>
                  <p className="station-code">Recognition</p>
                  <h2 id="coach-patterns-title">Algorithm fragments</h2>
                </div>
                <span>{analysis.algorithms.length} found</span>
              </div>
              {analysis.algorithms.length > 0 ? (
                <div className="coach-pattern-list">
                  {analysis.algorithms.slice(0, 8).map((match, index) => (
                    <article className="coach-pattern" key={`${match.name}-${match.start}-${index}`}>
                      <div className="coach-pattern-head">
                        <strong>{match.name}</strong>
                        <span>{match.family}</span>
                      </div>
                      <code>{match.moves.join(" ")}</code>
                      <p>{match.cue}</p>
                      <small>Moves {match.start + 1}–{match.end}</small>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="coach-empty">
                  <strong>No catalogued fragments in this sequence.</strong>
                  <p>
                    The scan checks a small set of common triggers and PLL
                    algorithms. It does not infer a complete solving method.
                  </p>
                </div>
              )}
            </section>

            <section className="coach-panel" aria-labelledby="coach-pauses-title">
              <div className="coach-section-heading">
                <div>
                  <p className="station-code">Rhythm</p>
                  <h2 id="coach-pauses-title">Pause watch</h2>
                </div>
                <span>
                  {analysis.medianTurnGapSeconds === null
                    ? "no timing"
                    : `median ${formatDuration(analysis.medianTurnGapSeconds)}`}
                </span>
              </div>
              {analysis.timingAvailable ? (
                analysis.pauses.length > 0 ? (
                  <ol className="coach-pause-list">
                    {analysis.pauses.slice(0, 5).map((pause) => (
                      <li key={`${pause.afterMove}-${pause.seconds}`}>
                        <span>After move {pause.afterMove}</span>
                        <strong>{formatDuration(pause.seconds)}</strong>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <div className="coach-empty">
                    <strong>No long gaps in this recording.</strong>
                    <p>
                      Gaps are flagged at 1.2 seconds or 2.5× your median
                      inter-turn interval, whichever is greater.
                    </p>
                  </div>
                )
              ) : (
                <div className="coach-empty">
                  <strong>Per-turn timing is not attached to this run.</strong>
                  <p>
                    The decoder’s checkpoints locate reconstruction states,
                    not individual physical turns. Pause feedback stays off
                    unless exact turn events are available.
                  </p>
                  <Link to="/demo">See the timed reference solve →</Link>
                </div>
              )}
              {analysis.timingAvailable && (
                <p className="coach-evidence-note">
                  Timing comes from the paired smart-cube turn record, not
                  interpolated video checkpoints.
                </p>
              )}
            </section>
          </div>

          <section className="coach-focus" aria-labelledby="coach-focus-title">
            <div className="coach-focus-icon" aria-hidden="true">↗</div>
            <div>
              <p className="station-code">Your next practice focus</p>
              <h2 id="coach-focus-title">{focus.title}</h2>
              <p>{focus.detail}</p>
            </div>
            <span className="coach-focus-tag">1 cue · next solve</span>
          </section>
        </>
      )}
    </div>
  );
}

