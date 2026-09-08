import { config } from "dotenv";

// Las pruebas de integración usan su propia base de datos (mindyourswing_test)
// para no tocar los datos de desarrollo. Ver README → "Pruebas".
config({ path: ".env.test", override: true });
