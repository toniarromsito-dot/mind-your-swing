// Texto a voz del coach vía ElevenLabs. Solo se llama desde el backend
// (la API key nunca llega al cliente). Modelo multilingüe: soporta es/en
// sin tener que cambiar de modelo según el idioma del usuario.
const ELEVENLABS_BASE_URL = "https://api.elevenlabs.io/v1";

export const TTS_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM"; // "Rachel", voz pública por defecto
export const TTS_MODEL_ID = "eleven_multilingual_v2";
export const TTS_MAX_CHARS = 600;

export function isTtsConfigured(): boolean {
  return Boolean(process.env.ELEVENLABS_API_KEY);
}

export async function synthesizeSpeech(text: string): Promise<Response> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error("ELEVENLABS_API_KEY no configurada");

  return fetch(`${ELEVENLABS_BASE_URL}/text-to-speech/${TTS_VOICE_ID}`, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({
      text: text.slice(0, TTS_MAX_CHARS),
      model_id: TTS_MODEL_ID,
      voice_settings: { stability: 0.5, similarity_boost: 0.75 },
    }),
  });
}
