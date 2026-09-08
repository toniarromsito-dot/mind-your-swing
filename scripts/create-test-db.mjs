// Crea la base de datos usada por las pruebas de integración (npm test),
// separada de la base de datos de desarrollo. Requiere que el Postgres
// local ya esté arrancado (npm run db:local).
import pg from "pg";

const client = new pg.Client({
  host: "localhost",
  port: 5544,
  user: "postgres",
  password: "postgres",
  database: "mindyourswing",
});

await client.connect();
try {
  await client.query("CREATE DATABASE mindyourswing_test");
  console.log("Base de datos de test creada: mindyourswing_test");
} catch (err) {
  if (err.code === "42P04") {
    console.log("La base de datos de test ya existía.");
  } else {
    throw err;
  }
} finally {
  await client.end();
}
