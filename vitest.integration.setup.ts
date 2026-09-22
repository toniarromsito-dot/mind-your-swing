import { config } from "dotenv";
import { beforeEach } from "vitest";
import { resetRateLimitsForTests } from "@/lib/rate-limit";

// Las pruebas de integración usan su propia base de datos (mindyourswing_test)
// para no tocar los datos de desarrollo. Ver README → "Pruebas".
config({ path: ".env.test", override: true });

// El rate limiter (Fase 11A) vive en memoria del módulo: sin resetearlo
// entre tests, un archivo que reutiliza el mismo usuario para crear varias
// partidas a lo largo de varios `it()` puede toparse con el límite real sin
// que ese sea el objetivo del test. Solo afecta a los tests; en producción
// nadie llama a esto.
beforeEach(() => {
  resetRateLimitsForTests();
});
