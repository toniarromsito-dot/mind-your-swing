// Corrección puntual de 3 discrepancias detectadas al comparar los tees ya
// cargados contra la ficha vigente de RFEG (fuente de prioridad #1):
// Santa Ponsa II, Son Antem West y Son Quint. Ver el informe de
// discrepancias de la fase anterior para el detalle de cada comparación.
//
// NO toca Santa Ponsa III ni Palma Pitch & Putt: sus valores actuales
// vienen de una tarjeta de 9 hoyos verificada (FBGolf), y RFEG solo
// publica para esas dos el cálculo artificial de 18 hoyos (duplicando la
// misma tarjeta de 9) — sustituir por ese cálculo sería peor dato, no
// mejor, así que se dejan exactamente como están.
//
// Todos los hoyos de los tees corregidos aquí ya coincidían EXACTAMENTE
// con RFEG (comprobado antes de escribir este script) — ninguna fila de
// GolfCourseTeeHole se toca, solo categoría/Course Rating/Slope, y en dos
// casos (Santa Ponsa II Azules/Rojas) se añade el tee de la categoría que
// faltaba, copiando el mismo hoyo a hoyo del tee ya cargado (es físicamente
// el mismo tee, solo cambia el rating oficial por sexo).
//
// Idempotente: cada paso comprueba el valor actual antes de tocarlo.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function fixSimpleCategory(teeId, label, data) {
  const tee = await prisma.golfCourseTee.findUniqueOrThrow({ where: { id: teeId } });
  const alreadyCorrect =
    tee.category === data.category &&
    (data.courseRating === undefined || tee.courseRating === data.courseRating) &&
    (data.slope === undefined || tee.slope === data.slope);
  if (alreadyCorrect) {
    console.log(`  [--] ${label} — ya corregido`);
    return;
  }
  await prisma.golfCourseTee.update({ where: { id: teeId }, data });
  console.log(`  [OK] ${label} — corregido`);
}

async function ensureSiblingTee(existingTeeId, label, newCategory, newCourseRating, newSlope) {
  const existing = await prisma.golfCourseTee.findUniqueOrThrow({
    where: { id: existingTeeId },
    include: { holes: true },
  });
  const sibling = await prisma.golfCourseTee.findFirst({
    where: { layoutId: existing.layoutId, name: existing.name, category: newCategory },
  });
  if (sibling) {
    console.log(`  [--] ${label} (${newCategory}) — ya existía`);
    return;
  }
  const created = await prisma.golfCourseTee.create({
    data: {
      layoutId: existing.layoutId,
      name: existing.name,
      category: newCategory,
      parTotal: existing.parTotal,
      distanceTotal: existing.distanceTotal,
      courseRating: newCourseRating,
      slope: newSlope,
    },
  });
  for (const h of existing.holes) {
    await prisma.golfCourseTeeHole.create({
      data: { teeId: created.id, number: h.number, index: h.index, par: h.par, distance: h.distance },
    });
  }
  console.log(`  [OK] ${label} (${newCategory}) — creado (mismos hoyos que ${existing.category ?? "el tee base"})`);
}

async function main() {
  console.log("Santa Ponsa II:");
  await fixSimpleCategory("cmu7l7i2w0001uy0ktyqp6t9j", "BLANCAS -> M", { category: "M", courseRating: 72.9, slope: 134 });
  await fixSimpleCategory("cmu7l7i5h0013uy0kx9n73rix", "AMARILLAS -> M", { category: "M", courseRating: 70.7, slope: 131 });
  await fixSimpleCategory("cmu7l7i7c0025uy0kkxl3wo7f", "AZULES -> F", { category: "F", courseRating: 73.4, slope: 134 });
  await ensureSiblingTee("cmu7l7i7c0025uy0kkxl3wo7f", "AZULES", "M", 67.5, 117);
  await fixSimpleCategory("cmu7l7i970037uy0khp7xbst9", "ROJAS -> F", { category: "F", courseRating: 71.8, slope: 131 });
  await ensureSiblingTee("cmu7l7i970037uy0khp7xbst9", "ROJAS", "M", 66.2, 115);

  console.log("\nSon Antem West:");
  await fixSimpleCategory("cmu7khwdq00apuy1gpu8odoj5", "BLANCAS -> M", { category: "M", courseRating: 73.7, slope: 140 });

  console.log("\nSon Quint:");
  await fixSimpleCategory("cmu7khwh800e1uy1gdz6hp3ko", "BLANCAS -> F (solo categoría, hoyos/CR/Slope ya correctos)", { category: "F" });
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
