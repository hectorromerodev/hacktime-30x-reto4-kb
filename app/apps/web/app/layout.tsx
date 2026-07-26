import type { Metadata, Viewport } from 'next';
import './globals.css';
import { RegistrarSW } from '@/components/RegistrarSW';

export const metadata: Metadata = {
  title: 'Conteo de inventarios · Piscilago',
  description:
    'Captura inteligente en la toma física de inventarios. Funciona sin red, el conteo es ciego y exporta listo para el sistema.',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Conteo' },
};

export const viewport: Viewport = {
  themeColor: '#004B8D',
  width: 'device-width',
  initialScale: 1,
  // Se bloquea el zoom: durante el conteo un pellizco accidental estorba.
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-CO">
      <body className="min-h-full antialiased">
        <RegistrarSW />
        {children}
      </body>
    </html>
  );
}
