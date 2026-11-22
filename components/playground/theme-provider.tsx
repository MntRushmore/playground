"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

/** Global theme. Dark by default; users can switch to light or follow the system. */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
