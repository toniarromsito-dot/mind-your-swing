"use client";

import { useEffect, useRef } from "react";

export function AutoSubmitForm({
  action,
  children,
}: {
  action: () => void | Promise<void>;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    ref.current?.requestSubmit();
  }, []);

  return (
    <form ref={ref} action={action}>
      {children}
    </form>
  );
}
