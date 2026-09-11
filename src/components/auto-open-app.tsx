"use client";

import { useEffect } from "react";

export function AutoOpenApp({ url }: { url: string }) {
  useEffect(() => {
    window.location.href = url;
  }, [url]);

  return null;
}
