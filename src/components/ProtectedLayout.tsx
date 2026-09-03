import { ReactNode, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAntiScreenshot } from '@/hooks/useAntiScreenshot';

interface ProtectedLayoutProps {
  children: ReactNode;
}

export default function ProtectedLayout({ children }: ProtectedLayoutProps) {
  const isBlurred = useAntiScreenshot();
  const [watermarkLabel, setWatermarkLabel] = useState<string>('');

  useEffect(() => {
    loadCurrentUserForWatermark();
  }, []);

  const loadCurrentUserForWatermark = async () => {
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data?.user) return;

      const email = data.user.email || '';
      const now = new Date();
      const stamp = now.toLocaleString('es-MX', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
      setWatermarkLabel(`${email} · ${stamp}`);
    } catch (error) {
      console.error('Error loading user for watermark:', error);
    }
  };

  return (
    <div className="relative min-h-screen">
      {/* Marca de agua repetida en diagonal sobre TODA la aplicación */}
      {watermarkLabel && (
        <div
          className="pointer-events-none fixed inset-0 z-40 overflow-hidden select-none"
          aria-hidden="true"
        >
          <div
            className="grid h-[140%] w-[140%] -translate-x-[10%] -translate-y-[10%] opacity-[0.06] dark:opacity-[0.09]"
            style={{
              gridTemplateColumns: 'repeat(4, 1fr)',
              gridTemplateRows: 'repeat(10, 1fr)',
              transform: 'rotate(-28deg)',
            }}
          >
            {Array.from({ length: 40 }).map((_, i) => (
              <span
                key={i}
                className="flex items-center justify-center text-xs font-semibold whitespace-nowrap text-gray-900 dark:text-gray-100"
              >
                {watermarkLabel}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Contenido real de la app, se difumina completo al perder foco */}
      <div
        className={
          isBlurred
            ? 'blur-xl select-none transition-all duration-150'
            : 'transition-all duration-150'
        }
      >
        {children}
      </div>

      {/* Overlay de aviso mientras está oculto por seguridad */}
      {isBlurred && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 pointer-events-none">
          <div className="bg-white dark:bg-gray-800 px-6 py-3 rounded-lg shadow-lg text-sm font-medium">
            Contenido oculto por seguridad
          </div>
        </div>
      )}
    </div>
  );
}
