import type { Metadata } from "next";
import localFont from "next/font/local";
import { ConvexClientProvider } from "@/components/providers/convex-client-provider";
import { ToastProvider } from "@/components/ui/toast";
import "./globals.css";

// Alojadas localmente (ver src/app/fonts/) en vez de `next/font/google`: esta
// última necesita salir a internet durante `next build` para traer la fuente,
// y ese paso fue lo que hizo fallar el deploy en Railway (el build ahí no
// pudo resolver la fuente de Google) — autoalojarlas saca esa dependencia de
// red del build por completo. Son variables (un solo archivo cubre todo el
// rango de pesos), descargadas del mismo subset "latin" que se usaba antes.
const inter = localFont({
  src: "./fonts/inter-variable.woff2",
  variable: "--font-inter",
  weight: "400 600",
});

const jetbrainsMono = localFont({
  src: "./fonts/jetbrains-mono-variable.woff2",
  variable: "--font-jetbrains-mono",
  weight: "400 500",
});

export const metadata: Metadata = {
  title: "Vibe CRM",
  description: "CRM simple para no perder ventas por falta de seguimiento.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-(--color-bg) text-(--color-text)">
        <ConvexClientProvider>
          <ToastProvider>{children}</ToastProvider>
        </ConvexClientProvider>
      </body>
    </html>
  );
}
