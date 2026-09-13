import { describe, expect, it } from "vitest";
import { computeSwingMetrics, InsufficientPoseDataError, type Landmark, type PoseFrame } from "./scoring";

/**
 * Construye una secuencia sintética de fotogramas simulando un swing:
 * dirección de cadera/hombros que gira (foreshortening), una cabeza más
 * o menos estable, y muñecas que suben despacio y bajan rápido (tempo
 * realista ~3:1).
 */
function buildSyntheticSwing(opts: {
  frameCount?: number;
  fps?: number;
  headJitter?: number;
  rotationAmount?: number; // 0 = sin giro, 0.4 = giro marcado
  weightShift?: number;
}): PoseFrame[] {
  const frameCount = opts.frameCount ?? 60;
  const fps = opts.fps ?? 30;
  const headJitter = opts.headJitter ?? 0;
  const rotationAmount = opts.rotationAmount ?? 0.35;
  const weightShift = opts.weightShift ?? 0.1;

  const shoulderY = 0.3;
  const hipY = 0.55;
  const baseShoulderHalfWidth = 0.12;
  const baseHipHalfWidth = 0.08;
  const centerX = 0.5;

  const topIdx = Math.floor(frameCount * 0.4);
  const pauseFrames = Math.max(2, Math.round(frameCount * 0.03)); // breve pausa real arriba del backswing
  const downswingStart = topIdx + pauseFrames;
  const impactIdx = downswingStart + Math.floor(frameCount * 0.15);

  const frames: PoseFrame[] = [];
  for (let i = 0; i < frameCount; i++) {
    const t = Math.round((i * 1000) / fps);

    // Fase de swing: 0 en address, 1 en top de backswing (con una breve
    // pausa real, como en un swing de verdad), 0 de nuevo en impacto/finish
    let phase: number;
    if (i <= topIdx) {
      phase = i / topIdx;
    } else if (i <= downswingStart) {
      phase = 1;
    } else if (i <= impactIdx) {
      phase = 1 - (i - downswingStart) / (impactIdx - downswingStart);
    } else {
      phase = 0;
    }

    const rotation = rotationAmount * phase;
    const shoulderHalfWidth = baseShoulderHalfWidth * (1 - rotation);
    const hipHalfWidth = baseHipHalfWidth * (1 - rotation);

    const hipShift = i > impactIdx ? weightShift * baseHipHalfWidth * 2 : 0;

    const noseX = centerX + (headJitter ? Math.sin(i) * headJitter : 0);
    const noseY = shoulderY - 0.15 + (headJitter ? Math.cos(i) * headJitter : 0);

    // Muñecas: suben despacio hasta el top, bajan rápido hasta el impacto
    const wristSwing = phase; // 0..1..0, usado para simular la posición de las muñecas
    const wristX = centerX + wristSwing * 0.2;
    const wristY = shoulderY + 0.1 - wristSwing * 0.35;

    const lm: Landmark[] = new Array(29).fill(null).map(() => ({ x: centerX, y: 0.5, visibility: 1 }));
    lm[0] = { x: noseX, y: noseY, visibility: 1 }; // nose
    lm[11] = { x: centerX - shoulderHalfWidth, y: shoulderY, visibility: 1 }; // left shoulder
    lm[12] = { x: centerX + shoulderHalfWidth, y: shoulderY, visibility: 1 }; // right shoulder
    lm[13] = { x: centerX - shoulderHalfWidth, y: shoulderY + 0.15, visibility: 1 }; // left elbow
    lm[14] = { x: centerX + shoulderHalfWidth, y: shoulderY + 0.15, visibility: 1 }; // right elbow
    lm[15] = { x: wristX - 0.02, y: wristY, visibility: 1 }; // left wrist
    lm[16] = { x: wristX + 0.02, y: wristY, visibility: 1 }; // right wrist
    lm[23] = { x: centerX - hipHalfWidth + hipShift, y: hipY, visibility: 1 }; // left hip
    lm[24] = { x: centerX + hipHalfWidth + hipShift, y: hipY, visibility: 1 }; // right hip
    lm[25] = { x: centerX - hipHalfWidth, y: hipY + 0.2, visibility: 1 }; // left knee
    lm[26] = { x: centerX + hipHalfWidth, y: hipY + 0.2, visibility: 1 }; // right knee
    lm[27] = { x: centerX - baseHipHalfWidth, y: hipY + 0.4, visibility: 1 }; // left ankle
    lm[28] = { x: centerX + baseHipHalfWidth, y: hipY + 0.4, visibility: 1 }; // right ankle

    frames.push({ t, landmarks: lm });
  }

  return frames;
}

describe("computeSwingMetrics", () => {
  it("throws InsufficientPoseDataError when too few frames are usable", () => {
    const frames = buildSyntheticSwing({ frameCount: 5 });
    expect(() => computeSwingMetrics(frames)).toThrow(InsufficientPoseDataError);
  });

  it("throws when key landmarks are not visible", () => {
    const frames = buildSyntheticSwing({ frameCount: 30 }).map((f) => ({
      ...f,
      landmarks: f.landmarks.map((lm, i) => ([11, 12, 23, 24].includes(i) ? { ...lm, visibility: 0 } : lm)),
    }));
    expect(() => computeSwingMetrics(frames)).toThrow(InsufficientPoseDataError);
  });

  it("scores a stable head higher than a jittery head", () => {
    const stable = computeSwingMetrics(buildSyntheticSwing({ headJitter: 0 }));
    const jittery = computeSwingMetrics(buildSyntheticSwing({ headJitter: 0.05 }));
    expect(stable.headStability.score).toBeGreaterThan(jittery.headStability.score);
  });

  it("scores meaningful hip rotation higher than almost none", () => {
    const rotated = computeSwingMetrics(buildSyntheticSwing({ rotationAmount: 0.4 }));
    const flat = computeSwingMetrics(buildSyntheticSwing({ rotationAmount: 0.02 }));
    expect(rotated.hipRotation.score).toBeGreaterThan(flat.hipRotation.score);
  });

  it("detects a realistic ~3:1 tempo ratio from wrist speed", () => {
    const result = computeSwingMetrics(buildSyntheticSwing({ frameCount: 90, fps: 60 }));
    expect(result.tempo.available).toBe(true);
    expect(result.tempo.ratio).not.toBeNull();
    // La subida (backswing) dura bastante más que la bajada (downswing),
    // así que el ratio subida:bajada debe salir claramente mayor que 1.
    expect(result.tempo.ratio!).toBeGreaterThan(1.5);
    expect(result.tempo.ratio!).toBeLessThan(6);
  });

  it("produces an overall score within 0-100 and all sub-scores present", () => {
    const result = computeSwingMetrics(buildSyntheticSwing({}));
    expect(result.overallScore).toBeGreaterThanOrEqual(0);
    expect(result.overallScore).toBeLessThanOrEqual(100);
    expect(result.headStability.score).toBeGreaterThanOrEqual(0);
    expect(result.spineAngle.score).toBeGreaterThanOrEqual(0);
    expect(result.weightTransfer.score).toBeGreaterThanOrEqual(0);
  });

  it("rewards a clear weight transfer toward impact over none", () => {
    const shifted = computeSwingMetrics(buildSyntheticSwing({ weightShift: 0.8 }));
    const none = computeSwingMetrics(buildSyntheticSwing({ weightShift: 0 }));
    expect(shifted.weightTransfer.score).toBeGreaterThan(none.weightTransfer.score);
  });

  it("derives a 3-phase timeline (backswing/downswing/follow-through) from the same tempo detection", () => {
    const result = computeSwingMetrics(buildSyntheticSwing({ frameCount: 90, fps: 60 }));
    expect(result.tempo.available).toBe(true);
    expect(result.phases).not.toBeNull();
    const phases = result.phases!;
    expect(phases.map((p) => p.key)).toEqual(["backswing", "downswing", "followThrough"]);
    // Cada fase empieza donde termina la anterior y cubre tiempo real (nunca 0ms).
    expect(phases[0].startMs).toBe(0);
    expect(phases[1].startMs).toBe(phases[0].endMs);
    expect(phases[2].startMs).toBe(phases[1].endMs);
    for (const phase of phases) {
      expect(phase.endMs).toBeGreaterThan(phase.startMs);
    }
  });

  it("only returns a phase timeline when tempo detection itself succeeded (never fabricates phases otherwise)", () => {
    for (const opts of [{}, { frameCount: 30 }, { frameCount: 12, fps: 30 }, { rotationAmount: 0.02 }]) {
      const result = computeSwingMetrics(buildSyntheticSwing(opts));
      expect(result.phases !== null).toBe(result.tempo.available);
    }
  });
});
