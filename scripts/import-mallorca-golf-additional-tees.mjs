// Tercera fase de datos verificados de Mallorca — completa los tees
// (colores/categorías) que faltaban en los 23 recorridos ya cargados por
// scripts/import-mallorca-golf-verified.mjs y
// scripts/import-mallorca-golf-pending-layouts.mjs. Esos dos scripts y sus
// datasets siguen siendo la fuente de verdad de la carga inicial — este
// importador solo AÑADE tees adicionales al mismo campo/recorrido, nunca
// crea un GolfCourse ni un GolfCourseLayout nuevo.
//
// Fuente: scripts/data/mallorca-golf-additional-tees.json — generado a
// partir de la ficha de cada club en RFEG (selector de recorrido/tee),
// leyendo directamente la tarjeta de juego real (hoyo a hoyo + Course
// Rating + Slope) de cada color y categoría publicados, sin inventar ni
// aproximar ningún valor. Cada recorrido incluye su URL de origen.
//
// Excluye deliberadamente configuraciones que no son un "tee" del
// recorrido ya cargado (ver dataset.excludedOutOfScope): recorridos
// re-secuenciados, configuraciones de torneo puntual, tarjetas
// provisionales por obras, y recorridos/instalaciones que no existen
// todavía como GolfCourseLayout en la base de datos.
//
// Idempotente: si el tee (layoutId + name + category) ya existe —
// incluidos los que ya se cargaron en fases anteriores con otro nombre de
// categoría (NULL, "HOMBRES"/"MUJERES") — este script NO lo toca ni lo
// duplica, solo añade lo que falta de verdad.
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const prisma = new PrismaClient();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_PATH = path.join(__dirname, "data", "mallorca-golf-additional-tees.json");

async function importLayoutTees(layoutEntry) {
  const course = await prisma.golfCourse.findUnique({ where: { slug: layoutEntry.courseSlug } });
  if (!course) {
    return [{ status: `OMITIDO (no existe GolfCourse con slug "${layoutEntry.courseSlug}")` }];
  }

  const layout = await prisma.golfCourseLayout.findUnique({
    where: { courseId_name: { courseId: course.id, name: layoutEntry.layoutName } },
  });
  if (!layout) {
    return [{ status: `OMITIDO (no existe GolfCourseLayout "${layoutEntry.layoutName}" en ${course.name})` }];
  }

  const results = [];
  for (const t of layoutEntry.tees) {
    const existingTee = await prisma.golfCourseTee.findFirst({
      where: { layoutId: layout.id, name: t.color, category: t.category ?? null },
    });
    if (existingTee) {
      results.push({ course: course.name, layout: layoutEntry.layoutName, tee: t.color, category: t.category, status: "ya existía" });
      continue;
    }

    const tee = await prisma.golfCourseTee.create({
      data: {
        layoutId: layout.id,
        name: t.color,
        category: t.category ?? null,
        parTotal: t.parTotal ?? null,
        distanceTotal: t.distanceTotal ?? null,
        courseRating: t.courseRating ?? null,
        slope: t.slope ?? null,
      },
    });

    for (const h of t.holes) {
      await prisma.golfCourseTeeHole.create({
        data: {
          teeId: tee.id,
          number: h.number,
          index: h.index ?? null,
          par: h.par ?? null,
          distance: h.distance ?? null,
        },
      });
    }

    results.push({ course: course.name, layout: layoutEntry.layoutName, tee: t.color, category: t.category, status: "creado", holes: t.holes.length });
  }
  return results;
}

async function main() {
  const dataset = JSON.parse(readFileSync(DATA_PATH, "utf8"));
  console.log(`Dataset: ${dataset.dataset} (${dataset.version}) — ${dataset.layouts.length} recorrido(s).\n`);

  const allResults = [];
  for (const layoutEntry of dataset.layouts) {
    allResults.push(...(await importLayoutTees(layoutEntry)));
  }

  let currentCourse = "";
  for (const r of allResults) {
    const tag = r.status === "creado" ? "OK" : r.status === "ya existía" ? "--" : "!!";
    const label = r.course ? `${r.course} | ${r.layout}` : "";
    if (label !== currentCourse) {
      currentCourse = label;
    }
    console.log(`  [${tag}] ${(r.course ?? "?").padEnd(22)} | ${(r.layout ?? "-").padEnd(16)} | ${(r.tee ?? "-").padEnd(10)} ${r.category ? "(" + r.category + ")" : ""} | ${r.status}`);
  }

  const created = allResults.filter((r) => r.status === "creado").length;
  const skipped = allResults.filter((r) => r.status.startsWith("OMITIDO")).length;
  console.log(`\n${created} tee(s) nuevo(s), ${allResults.length - created - skipped} ya existían, ${skipped} omitido(s).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
