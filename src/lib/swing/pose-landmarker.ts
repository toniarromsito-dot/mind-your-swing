"use client";

import type { PoseFrame } from "./scoring";

/**
 * Extracción de pose en el propio navegador con MediaPipe Pose Landmarker
 * (WASM + modelo "lite", cargados bajo demanda desde el CDN oficial de
 * Google — nunca se envía el vídeo a ningún servidor para esto). El vídeo
 * nunca sale del dispositivo del jugador para este paso: solo los
 * keypoints numéricos resultantes viajan luego al backend.
 */

const WASM_BASE_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task";

// Muestreamos a un ritmo fijo en vez de a la tasa de fotogramas real del
// vídeo: suficiente para la heurística y mucho más rápido que analizar
// cada fotograma.
const SAMPLE_FPS = 20;
const MAX_SAMPLES = 300; // ~15s de vídeo a 20fps; evita clips desproporcionados

export type PoseExtractionProgress = { processed: number; total: number };

let landmarkerPromise: Promise<import("@mediapipe/tasks-vision").PoseLandmarker> | null = null;

async function getLandmarker() {
  if (!landmarkerPromise) {
    landmarkerPromise = (async () => {
      const { FilesetResolver, PoseLandmarker } = await import("@mediapipe/tasks-vision");
      const filesetResolver = await FilesetResolver.forVisionTasks(WASM_BASE_URL);
      try {
        return await PoseLandmarker.createFromOptions(filesetResolver, {
          baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
          runningMode: "VIDEO",
          numPoses: 1,
        });
      } catch {
        // No todos los navegadores/dispositivos soportan el delegate GPU (WebGL) — CPU es más lento pero universal.
        return PoseLandmarker.createFromOptions(filesetResolver, {
          baseOptions: { modelAssetPath: MODEL_URL, delegate: "CPU" },
          runningMode: "VIDEO",
          numPoses: 1,
        });
      }
    })().catch((err) => {
      landmarkerPromise = null;
      throw err;
    });
  }
  return landmarkerPromise;
}

export class PoseExtractionError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = "PoseExtractionError";
  }
}

/**
 * Recorre un archivo de vídeo local fotograma a fotograma (a un ritmo
 * fijo) y devuelve los keypoints de pose detectados en cada muestra.
 */
export async function extractPoseFramesFromVideo(
  file: File,
  onProgress?: (progress: PoseExtractionProgress) => void
): Promise<PoseFrame[]> {
  const landmarker = await getLandmarker().catch((err) => {
    throw new PoseExtractionError(
      "No se ha podido cargar el modelo de detección de pose. Comprueba tu conexión e inténtalo de nuevo.",
      err
    );
  });

  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  const objectUrl = URL.createObjectURL(file);
  video.src = objectUrl;

  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new PoseExtractionError("No se ha podido leer el vídeo."));
    });

    const durationMs = video.duration * 1000;
    if (!isFinite(durationMs) || durationMs <= 0) {
      throw new PoseExtractionError("El vídeo no tiene una duración válida.");
    }

    const stepMs = 1000 / SAMPLE_FPS;
    const totalSamples = Math.min(MAX_SAMPLES, Math.floor(durationMs / stepMs));
    if (totalSamples < 10) {
      throw new PoseExtractionError("El vídeo es demasiado corto para analizarlo (mínimo ~1 segundo).");
    }

    const frames: PoseFrame[] = [];

    for (let i = 0; i < totalSamples; i++) {
      const timestampMs = i * stepMs;

      await new Promise<void>((resolve, reject) => {
        const onSeeked = () => {
          video.removeEventListener("seeked", onSeeked);
          resolve();
        };
        video.addEventListener("seeked", onSeeked);
        try {
          video.currentTime = timestampMs / 1000;
        } catch (err) {
          video.removeEventListener("seeked", onSeeked);
          reject(err);
        }
      });

      const result = landmarker.detectForVideo(video, Math.round(timestampMs));
      const landmarks = result.landmarks?.[0];
      if (landmarks && landmarks.length > 0) {
        frames.push({
          t: Math.round(timestampMs),
          landmarks: landmarks.map((l) => ({ x: l.x, y: l.y, visibility: l.visibility })),
        });
      }

      onProgress?.({ processed: i + 1, total: totalSamples });
    }

    return frames;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
