import type { Metadata, Viewport } from 'next';
import './globals.css';
import { RegistrarSW } from '@/components/RegistrarSW';

export const metadata: Metadata = {
  title: 'Conteo de inventarios · Piscilago',
  description:
    'Captura inteligente en la toma física de inventarios. Funciona sin red, el conteo es ciego y exporta listo para el sistema.',
  manifest: '/manifest.json',
  /*
   * `default` y no `black-translucent`.
   *
   * `black-translucent` mete el contenido por debajo de la barra de estado y la
   * pinta con texto BLANCO. Eso funcionaba con el tema oscuro; con la paleta
   * clara la pantalla de entrada es blanca arriba, asi que en el telefono con
   * la app instalada el reloj y la bateria quedaban blancos sobre blanco:
   * invisibles. `default` deja texto oscuro sobre fondo claro.
   */
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Conteo' },
};

export const viewport: Viewport = {
  // Igual al blanco de la parte superior de la pantalla de entrada, para que la
  // barra del sistema no dibuje una franja de otro color encima.
  themeColor: '#ffffff',
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
