import { Capacitor } from "@capacitor/core";
import { Purchases, type CustomerInfo, type PurchasesOfferings, type PurchasesPackage } from "@revenuecat/purchases-capacitor";

/**
 * Fase 12C — wrapper fino sobre el SDK Capacitor de RevenueCat (verificado
 * contra el paquete real @revenuecat/purchases-capacitor@13.6.1, no
 * inventado). Solo implementa lo pedido para esta fase: configure/login/
 * logout/getCustomerInfo/getOfferings/purchasePackage/restorePurchases —
 * sin paywall todavía.
 *
 * IMPORTANTE: CustomerInfo es SOLO para UX optimista (p.ej. "ya eres PRO"
 * mientras carga la pantalla) — la autoridad real de PRO sigue siendo
 * exclusivamente el backend (hasProAccess()/canUseFeature()), alimentada
 * por el webhook de RevenueCat (api/revenuecat/webhook), nunca por lo que
 * este SDK reporte en el cliente. Ningún caller debe usar estas funciones
 * para decidir acceso a una función Pro.
 */

function apiKeyForPlatform(): string | undefined {
  if (Capacitor.getPlatform() === "ios") return process.env.NEXT_PUBLIC_REVENUECAT_API_KEY_IOS;
  if (Capacitor.getPlatform() === "android") return process.env.NEXT_PUBLIC_REVENUECAT_API_KEY_ANDROID;
  return undefined;
}

/** false hasta que exista una API key real para la plataforma actual — la integración queda inerte, igual que AdMob en 11F. */
export function isRevenueCatClientConfigured(): boolean {
  return Boolean(apiKeyForPlatform());
}

// Módulo, no estado de componente: persiste durante toda la sesión de la
// app nativa — Purchases.configure() solo debe llamarse una vez por
// arranque; identificaciones posteriores usan logIn().
let configured = false;

/**
 * Solo para tests: sin esto, un test que monta varios escenarios de
 * configuración heredaría el estado "ya configurado" del test anterior —
 * mismo patrón que resetAdMobInitStateForTests() en ad-banner.tsx. Nunca
 * se llama desde código de producción.
 */
export function resetRevenueCatClientStateForTests(): void {
  configured = false;
}

/**
 * Se llama SOLO dentro de una sesión ya autenticada (ver
 * (app)/layout.tsx → RevenueCatSession), nunca antes — el appUserId
 * SIEMPRE es el User.id real de MYS (ver auditoría "Identity/User Mapping"
 * de la Fase 12C), nunca un id anónimo ni el email.
 */
export async function configureAndLoginRevenueCat(appUserId: string): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  const apiKey = apiKeyForPlatform();
  if (!apiKey) return;

  try {
    if (!configured) {
      await Purchases.configure({ apiKey, appUserID: appUserId });
      configured = true;
    } else {
      await Purchases.logIn({ appUserID: appUserId });
    }
  } catch (err) {
    console.error("RevenueCat: no se ha podido configurar/identificar", err);
  }
}

/** Crítico al cerrar sesión: sin esto, el siguiente usuario del mismo dispositivo heredaría el CustomerInfo del anterior. */
export async function logoutRevenueCat(): Promise<void> {
  if (!Capacitor.isNativePlatform() || !configured) return;
  try {
    await Purchases.logOut();
  } catch (err) {
    console.error("RevenueCat: no se ha podido cerrar sesión", err);
  }
}

export async function getRevenueCatCustomerInfo(): Promise<CustomerInfo | null> {
  if (!Capacitor.isNativePlatform()) return null;
  try {
    const { customerInfo } = await Purchases.getCustomerInfo();
    return customerInfo;
  } catch (err) {
    console.error("RevenueCat: no se ha podido leer CustomerInfo", err);
    return null;
  }
}

export async function getRevenueCatOfferings(): Promise<PurchasesOfferings | null> {
  if (!Capacitor.isNativePlatform()) return null;
  try {
    return await Purchases.getOfferings();
  } catch (err) {
    console.error("RevenueCat: no se han podido cargar las offerings", err);
    return null;
  }
}

export async function purchaseRevenueCatPackage(aPackage: PurchasesPackage): Promise<CustomerInfo> {
  const result = await Purchases.purchasePackage({ aPackage });
  return result.customerInfo;
}

export async function restoreRevenueCatPurchases(): Promise<CustomerInfo> {
  const { customerInfo } = await Purchases.restorePurchases();
  return customerInfo;
}
