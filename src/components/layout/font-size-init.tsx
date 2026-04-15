"use client";

import { useEffect } from "react";

export function FontSizeInit() {
  useEffect(() => {
    try {
      const saved = localStorage.getItem("flashmind-settings");
      if (saved) {
        const settings = JSON.parse(saved);
        if (settings.fontSize) {
          document.body.classList.remove("font-small", "font-medium", "font-large", "font-xlarge");
          document.body.classList.add(`font-${settings.fontSize}`);
        }
      }
    } catch {
      // Ignore
    }
  }, []);

  return null;
}
