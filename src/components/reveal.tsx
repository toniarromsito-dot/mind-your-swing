"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Aparición progresiva muy sutil al entrar en el viewport — nada de
 * parallax fuerte ni animaciones llamativas, solo un fundido + pequeño
 * desplazamiento (brief: "calma + premium + deportiva").
 */
export function Reveal({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(16px)",
        transition: "opacity 0.6s ease-out, transform 0.6s ease-out",
      }}
    >
      {children}
    </div>
  );
}
