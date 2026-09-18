// Importador de datos VERIFICADOS de campos de golf de Mallorca — segunda
// fase, sobre la identidad ya creada por scripts/seed-mallorca-golf.mjs.
//
// Fuente: scripts/data/mallorca-golf-verified.json — un dataset preparado
// a partir de las fichas actuales de la RFEG (Real Federación Española de
// Golf) y, solo cuando la RFEG no publicaba el dato con claridad (Son
// Antem West), la página/scorecard oficial del propio club. Cada entrada
// incluye su `source` (tipo, URL, fecha de verificación) — ver ese archivo
// para el detalle exacto de cada campo.
//
// Este script NO inventa ni aproxima ningún dato: si un valor no estaba
// disponible en la fuente (p. ej. Course Rating/Slope de Golf Pollença,
// que la RFEG solo publica para su cálculo a 18 duplicando la tarjeta de
// 9), se guarda tal cual como NULL, nunca calculado ni copiado de otro tee.
//
// Cada campo del dataset guarda UN recorrido/tee de referencia verificado,
// no todos los tees posibles — el resto de tees, y los recorridos todavía
// sin verificar (Santa Ponsa II/III, Palma Pitch & Putt), se dejan
// pendientes a propósito: no se crea ningún GolfCourseLayout para ellos.
//
// Idempotente: la clave de creación es (GolfCourse.id, GolfCourseLayout.name)
// y (GolfCourseLayout.id, GolfCourseTee.name) — ambas ya son restricciones
// únicas del schema. Si el recorrido/tee ya existe, este script no lo
// vuelve a crear ni pisa sus hoyos — para corregir un dato ya cargado hay
// que hacerlo aparte, a propósito, no re-ejecutando este importador.
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const prisma = new PrismaClient();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_PATH = path.join(__dirname, "data", "mallorca-golf-verified.json");

// slug del dataset -> slug de GolfCourse ya creado por seed-mallorca-golf.mjs.
// Varias entradas del dataset apuntan al MISMO club cuando ese club tiene
// más de un recorrido verificado (Son Antem Este/Oeste comparten club);
// "santa_ponsa_1" apunta al club "Golf Santa Ponsa" ya existente, como su
// recorrido "Santa Ponsa I" concreto (II/III siguen sin verificar).
const DATASET_SLUG_TO_COURSE_SLUG = {
  alcanada: "alcanada",
  andratx: "golf-de-andratx",
  bendinat: "real-golf-de-bendinat",
  canyamel: "canyamel-golf",
  capdepera: "capdepera-golf",
  maioris: "golf-maioris",
  pollensa: "golf-pollenca",
  pula: "pula-golf-resort",
  santa_ponsa_1: "golf-santa-ponsa",
  son_antem_east: "son-antem-golf-club",
  son_antem_west: "son-antem-golf-club",
  son_gual: "golf-son-gual",
  son_muntaner: "son-muntaner-golf",
  son_quint: "son-quint-golf",
  son_servera: "golf-club-son-servera",
  son_termes: "golf-son-termes",
  son_vida: "son-vida-club-de-golf",
  t_golf_calvia: "t-golf-calvia",
  t_golf_palma: "t-golf-palma-puntiro",
  vall_dor: "vall-dor-golf",
};

async function importEntry(entry) {
  const courseSlug = DATASET_SLUG_TO_COURSE_SLUG[entry.slug];
  if (!courseSlug) {
    return { entry: entry.slug, status: "OMITIDO (sin mapeo a un GolfCourse existente)" };
  }

  const course = await prisma.golfCourse.findUnique({ where: { slug: courseSlug } });
  if (!course) {
    return { entry: entry.slug, status: `OMITIDO (no existe GolfCourse con slug "${courseSlug}")` };
  }

  // Localidad verificada (RFEG) — solo si el campo todavía no tenía
  // ninguna, nunca pisa un valor que ya estuviera cargado.
  if (!course.location && entry.municipality) {
    await prisma.golfCourse.update({ where: { id: course.id }, data: { location: entry.municipality } });
  }

  let layout = await prisma.golfCourseLayout.findUnique({
    where: { courseId_name: { courseId: course.id, name: entry.layout } },
  });
  if (!layout) {
    layout = await prisma.golfCourseLayout.create({
      data: { courseId: course.id, name: entry.layout, holeCount: entry.holes },
    });
  }

  const t = entry.reference_tee;
  // findFirst en vez de findUnique: la clave única de GolfCourseTee incluye
  // `category`, que aquí puede ser null, y findUnique no admite null en un
  // campo de una unique compuesta (ver import-mallorca-golf-pending-layouts.mjs).
  const existingTee = await prisma.golfCourseTee.findFirst({
    where: { layoutId: layout.id, name: t.name, category: t.sex ?? null },
  });
  if (existingTee) {
    return {
      entry: entry.slug,
      course: course.name,
      layout: entry.layout,
      tee: t.name,
      status: "ya existía",
    };
  }

  const tee = await prisma.golfCourseTee.create({
    data: {
      layoutId: layout.id,
      name: t.name,
      category: t.sex ?? null,
      parTotal: t.par_total ?? null,
      distanceTotal: t.distance_total_m ?? null,
      courseRating: t.course_rating ?? null,
      slope: t.slope ?? null,
    },
  });

  for (const h of t.holes) {
    await prisma.golfCourseTeeHole.create({
      data: {
        teeId: tee.id,
        number: h.number,
        par: h.par ?? null,
        index: h.handicap ?? null,
        distance: h.distance_m ?? null,
      },
    });
  }

  return {
    entry: entry.slug,
    course: course.name,
    layout: entry.layout,
    tee: t.name,
    status: "creado",
    holes: t.holes.length,
  };
}

async function main() {
  const dataset = JSON.parse(readFileSync(DATA_PATH, "utf8"));
  console.log(`Dataset: ${dataset.dataset} (${dataset.version}) — ${dataset.courses.length} entradas verificadas.\n`);

  const results = [];
  for (const entry of dataset.courses) {
    results.push(await importEntry(entry));
  }

  for (const r of results) {
    console.log(`  [${r.status.startsWith("creado") ? "OK" : r.status.startsWith("ya") ? "--" : "!!"}] ${r.entry.padEnd(16)} -> ${r.course ?? "?"} | ${r.layout ?? "-"} | ${r.tee ?? "-"} | ${r.status}`);
  }

  const created = results.filter((r) => r.status === "creado").length;
  const skipped = results.filter((r) => r.status.startsWith("OMITIDO")).length;
  console.log(`\n${created} tee(s) nuevo(s), ${results.length - created - skipped} ya existían, ${skipped} omitido(s).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
