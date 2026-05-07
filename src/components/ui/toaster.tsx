"use client";

// Provider unique des toasts (Sonner). À monter dans RootLayout.
// Le composant client expose `toast.success/error/info/...` consommé partout.

import { Toaster as SonnerToaster } from "sonner";

export function Toaster() {
  return (
    <SonnerToaster
      position="top-right"
      richColors
      expand
      closeButton
      toastOptions={{
        style: {
          fontFamily: "var(--font-inter)",
          fontSize: "14px",
        },
      }}
    />
  );
}
