import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    include: ["src/**/*.integration.test.ts"],
    setupFiles: ["./vitest.integration.setup.ts"],
    // Las pruebas de integración pegan a Postgres real: evita condiciones
    // de carrera ejecutándolas en serie.
    fileParallelism: false,
  },
});
