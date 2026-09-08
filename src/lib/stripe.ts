import Stripe from "stripe";

// apiVersion se omite a propósito: el SDK usa la versión con la que se
// generó (ver node_modules/stripe/cjs/apiVersion.js), evitando fijar aquí
// un string que quede desactualizado.
//
// El SDK lanza un error en el propio constructor si la key está vacía
// (a diferencia del de Anthropic), así que sin STRIPE_SECRET_KEY usamos un
// placeholder: nunca se llega a usar de verdad porque todas las rutas que
// tocan Stripe comprueban isStripeConfigured() antes.
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_not_configured");

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRO_PRICE_ID);
}

export const PRO_PRICE_ID = process.env.STRIPE_PRO_PRICE_ID;

// Cupón de bienvenida (50% de descuento, solo el primer mes) — opcional,
// se aplica automáticamente en el checkout si está configurado y el
// usuario no ha tenido nunca una suscripción.
export const WELCOME_COUPON_ID = process.env.STRIPE_WELCOME_COUPON_ID;
