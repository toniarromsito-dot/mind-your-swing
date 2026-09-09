/**
 * Heurística de puntuación de swing a partir de keypoints de pose (2D)
 * extraídos en el navegador (ver pose-landmarker.ts). Esto NO es un
 * análisis clínico ni biomecánico validado: son proxies simples y
 * documentados sobre cinco aspectos clásicos de la técnica de swing,
 * pensados para dar una estimación orientativa e instantánea al jugador
 * mientras espera (si quiere) el feedback manual de un revisor humano.
 *
 * Índices de landmarks: topología estándar de 33 puntos de BlazePose/
 * MediaPipe Pose (0 nariz, 11/12 hombros, 13/14 codos, 15/16 muñecas,
 * 23/24 caderas, 25/26 rodillas, 27/28 tobillos). Este módulo es puro y
 * no depende de MediaPipe para poder testearse con datos sintéticos.
 */

export type Landmark = { x: number; y: number; visibility?: number };

export type PoseFrame = {
  /** Milisegundos desde el inicio del vídeo. */
  t: number;
  landmarks: Landmark[];
};

const LM = {
  NOSE: 0,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
} as const;

const MIN_VISIBILITY = 0.4;
const MIN_FRAMES = 10;

export type SwingMetrics = {
  frameCount: number;
  durationMs: number;
  headStability: { normalizedMovement: number; score: number };
  spineAngle: { addressDegrees: number; maxDeviationDegrees: number; score: number };
  hipRotation: { rotationRatio: number; score: number };
  weightTransfer: { shiftRatio: number; score: number };
  tempo: { ratio: number | null; score: number; available: boolean };
  overallScore: number;
};

export class InsufficientPoseDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InsufficientPoseDataError";
  }
}

function mid(a: Landmark, b: Landmark): Landmark {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function dist(a: Landmark, b: Landmark): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function mean(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function stdev(values: number[]): number {
  const m = mean(values);
  return Math.sqrt(mean(values.map((v) => (v - m) ** 2)));
}

function isVisible(lm: Landmark | undefined): lm is Landmark {
  return !!lm && (lm.visibility ?? 1) >= MIN_VISIBILITY;
}

/** Filtra a los fotogramas donde los landmarks clave (hombros, caderas) son fiables. */
function usableFrames(frames: PoseFrame[]): PoseFrame[] {
  return frames.filter((f) => {
    const l = f.landmarks;
    return (
      isVisible(l[LM.LEFT_SHOULDER]) &&
      isVisible(l[LM.RIGHT_SHOULDER]) &&
      isVisible(l[LM.LEFT_HIP]) &&
      isVisible(l[LM.RIGHT_HIP])
    );
  });
}

export function computeSwingMetrics(rawFrames: PoseFrame[]): SwingMetrics {
  const frames = usableFrames(rawFrames).sort((a, b) => a.t - b.t);

  if (frames.length < MIN_FRAMES) {
    throw new InsufficientPoseDataError(
      `Solo se detectó pose fiable en ${frames.length} fotogramas (mínimo ${MIN_FRAMES}). Prueba con un vídeo donde el cuerpo entero se vea claro y estable.`
    );
  }

  const shoulderWidths = frames.map((f) => dist(f.landmarks[LM.LEFT_SHOULDER], f.landmarks[LM.RIGHT_SHOULDER]));
  const avgShoulderWidth = mean(shoulderWidths);
  if (avgShoulderWidth <= 0) {
    throw new InsufficientPoseDataError("No se ha podido medir la escala del cuerpo en el vídeo.");
  }

  const addressCount = Math.max(1, Math.round(frames.length * 0.1));
  const addressFrames = frames.slice(0, addressCount);

  // --- 1. Estabilidad de la cabeza ---
  const noseXs = frames.map((f) => f.landmarks[LM.NOSE].x);
  const noseYs = frames.map((f) => f.landmarks[LM.NOSE].y);
  const headMovement = Math.hypot(stdev(noseXs), stdev(noseYs));
  const normalizedHeadMovement = headMovement / avgShoulderWidth;
  const headStabilityScore = clamp(100 - normalizedHeadMovement * 300, 0, 100);

  // --- 2. Ángulo de columna (hombro-cadera vs vertical) ---
  function spineAngleDegrees(f: PoseFrame): number {
    const shoulderMid = mid(f.landmarks[LM.LEFT_SHOULDER], f.landmarks[LM.RIGHT_SHOULDER]);
    const hipMid = mid(f.landmarks[LM.LEFT_HIP], f.landmarks[LM.RIGHT_HIP]);
    const dx = shoulderMid.x - hipMid.x;
    const dy = shoulderMid.y - hipMid.y;
    return (Math.atan2(Math.abs(dx), Math.abs(dy)) * 180) / Math.PI;
  }
  const addressAngle = mean(addressFrames.map(spineAngleDegrees));
  const angleDeviations = frames.map((f) => Math.abs(spineAngleDegrees(f) - addressAngle));
  const maxDeviation = Math.max(...angleDeviations);
  const spineAngleScore = clamp(100 - maxDeviation * 4, 0, 100);

  // --- 3. Rango de rotación de caderas (foreshortening de la línea de caderas) ---
  const hipWidths = frames.map((f) => dist(f.landmarks[LM.LEFT_HIP], f.landmarks[LM.RIGHT_HIP]));
  const maxHipWidth = Math.max(...hipWidths);
  const minHipWidth = Math.min(...hipWidths);
  const rotationRatio = maxHipWidth > 0 ? 1 - minHipWidth / maxHipWidth : 0;
  const hipRotationScore = clamp((rotationRatio / 0.5) * 100, 0, 100);

  // --- 4. Transferencia de peso (desplazamiento horizontal de caderas) ---
  const ankleSpan =
    mean(addressFrames.map((f) => dist(f.landmarks[LM.LEFT_ANKLE], f.landmarks[LM.RIGHT_ANKLE]))) ||
    avgShoulderWidth;
  const addressHipX = mean(addressFrames.map((f) => mid(f.landmarks[LM.LEFT_HIP], f.landmarks[LM.RIGHT_HIP]).x));
  const impactWindowStart = Math.floor(frames.length * 0.55);
  const impactWindowEnd = Math.max(impactWindowStart + 1, Math.floor(frames.length * 0.75));
  const impactFrames = frames.slice(impactWindowStart, impactWindowEnd);
  const impactHipX = mean(impactFrames.map((f) => mid(f.landmarks[LM.LEFT_HIP], f.landmarks[LM.RIGHT_HIP]).x));
  const shiftRatio = ankleSpan > 0 ? Math.abs(impactHipX - addressHipX) / ankleSpan : 0;
  const weightTransferScore = clamp((shiftRatio / 0.2) * 100, 0, 100);

  // --- 5. Tempo (ratio subida:bajada, estimado por velocidad de las muñecas) ---
  const wristSpeeds: number[] = [0];
  for (let i = 1; i < frames.length; i++) {
    const prev = frames[i - 1];
    const cur = frames[i];
    const dt = Math.max(1, cur.t - prev.t);
    const prevMid = mid(prev.landmarks[LM.LEFT_WRIST], prev.landmarks[LM.RIGHT_WRIST]);
    const curMid = mid(cur.landmarks[LM.LEFT_WRIST], cur.landmarks[LM.RIGHT_WRIST]);
    wristSpeeds.push(dist(prevMid, curMid) / dt);
  }

  let peakIdx = 0;
  for (let i = 1; i < wristSpeeds.length; i++) {
    if (wristSpeeds[i] > wristSpeeds[peakIdx]) peakIdx = i;
  }

  let topIdx = 0;
  if (peakIdx > 2) {
    let minSpeed = Infinity;
    for (let i = 1; i < peakIdx; i++) {
      if (wristSpeeds[i] < minSpeed) {
        minSpeed = wristSpeeds[i];
        topIdx = i;
      }
    }
  }

  let tempoRatio: number | null = null;
  let tempoAvailable = false;
  if (peakIdx > topIdx && topIdx > 0) {
    const backswingMs = frames[topIdx].t - frames[0].t;
    const downswingMs = frames[peakIdx].t - frames[topIdx].t;
    if (backswingMs > 0 && downswingMs > 0) {
      tempoRatio = backswingMs / downswingMs;
      tempoAvailable = true;
    }
  }
  const tempoScore = tempoAvailable && tempoRatio !== null ? clamp(100 - Math.abs(tempoRatio - 3) * 20, 0, 100) : 60;

  const weights = {
    headStability: 0.2,
    spineAngle: 0.2,
    hipRotation: 0.25,
    weightTransfer: 0.15,
    tempo: 0.2,
  };

  const overallScore = Math.round(
    headStabilityScore * weights.headStability +
      spineAngleScore * weights.spineAngle +
      hipRotationScore * weights.hipRotation +
      weightTransferScore * weights.weightTransfer +
      tempoScore * weights.tempo
  );

  return {
    frameCount: frames.length,
    durationMs: frames[frames.length - 1].t - frames[0].t,
    headStability: { normalizedMovement: normalizedHeadMovement, score: Math.round(headStabilityScore) },
    spineAngle: {
      addressDegrees: Math.round(addressAngle * 10) / 10,
      maxDeviationDegrees: Math.round(maxDeviation * 10) / 10,
      score: Math.round(spineAngleScore),
    },
    hipRotation: { rotationRatio: Math.round(rotationRatio * 1000) / 1000, score: Math.round(hipRotationScore) },
    weightTransfer: { shiftRatio: Math.round(shiftRatio * 1000) / 1000, score: Math.round(weightTransferScore) },
    tempo: {
      ratio: tempoRatio !== null ? Math.round(tempoRatio * 100) / 100 : null,
      score: Math.round(tempoScore),
      available: tempoAvailable,
    },
    overallScore: clamp(overallScore, 0, 100),
  };
}
