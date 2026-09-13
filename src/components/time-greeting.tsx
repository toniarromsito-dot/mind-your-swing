"use client";

import { useEffect, useState } from "react";

/**
 * "Good morning, Antonio." — la franja horaria correcta depende de la
 * hora LOCAL del jugador, no la del servidor (Vercel corre en UTC, casi
 * nunca coincide con dónde está jugando alguien). Por eso esto se decide
 * en el cliente: el servidor manda el saludo neutro (t.dashboard.greeting)
 * como primer render, y aquí se sustituye en cuanto se conoce la hora
 * real — sin useEffect+setState no hay forma de leer `new Date()` del
 * navegador sin arriesgar un mismatch de hidratación.
 */
export function TimeGreeting({
  fallback,
  morning,
  afternoon,
  evening,
}: {
  fallback: string;
  morning: string;
  afternoon: string;
  evening: string;
}) {
  const [text, setText] = useState(fallback);

  useEffect(() => {
    const hour = new Date().getHours();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza con la hora real del dispositivo, no re-deriva estado de React
    setText(hour < 12 ? morning : hour < 20 ? afternoon : evening);
  }, [morning, afternoon, evening]);

  return <>{text}</>;
}
