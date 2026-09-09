// Datos de DEMOSTRACIÓN para el prototipo de PLAY — nunca se presentan
// como datos oficiales de un campo real (ver GolfCourse.isDemo y el aviso
// en la UI de selección de campo). Generados por plantilla, no copiados
// de ninguna tarjeta de resultados real.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Índice de dificultad de cada hoyo (1 = más difícil), mismo patrón para
// los tres campos de demostración: solo hace falta variar el par.
const INDEX_BY_HOLE = [7, 13, 17, 3, 11, 15, 1, 9, 5, 8, 18, 2, 12, 16, 14, 4, 10, 6];

const DISTANCE_BY_PAR = { 3: 155, 4: 345, 5: 480 };

function buildHoles(pars) {
  return pars.map((par, i) => {
    const number = i + 1;
    const wobble = ((number * 37) % 21) - 10; // +/-10m de variación, solo estética
    return {
      number,
      par,
      index: INDEX_BY_HOLE[i],
      distance: DISTANCE_BY_PAR[par] + wobble,
    };
  });
}

const COURSES = [
  {
    name: "Son Muntaner",
    location: "Mallorca, España",
    pars: [4, 4, 3, 5, 4, 3, 4, 5, 4, 4, 4, 5, 4, 4, 3, 5, 4, 4],
  },
  {
    name: "Club de Golf Bahía Azul",
    location: "Costa del Sol, España",
    pars: [4, 3, 5, 4, 4, 3, 4, 5, 4, 4, 4, 3, 5, 4, 4, 3, 5, 4],
  },
  {
    name: "Links de Piedra Verde",
    location: "Cantabria, España",
    pars: [4, 5, 3, 4, 4, 4, 3, 5, 4, 4, 3, 4, 5, 4, 3, 4, 5, 4],
  },
];

for (const course of COURSES) {
  const existing = await prisma.golfCourse.findFirst({ where: { name: course.name } });
  if (existing) {
    console.log(`Ya existe: ${course.name}`);
    continue;
  }

  await prisma.golfCourse.create({
    data: {
      name: course.name,
      location: course.location,
      isDemo: true,
      holes: { create: buildHoles(course.pars) },
    },
  });
  console.log(`Creado: ${course.name}`);
}

await prisma.$disconnect();
