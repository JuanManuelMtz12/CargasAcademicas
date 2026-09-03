import { ReactNode, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

interface ProtectedLayoutProps {
  children: ReactNode;
}

export default function ProtectedLayout({ children }: ProtectedLayoutProps) {
  const [isBlurred, setIsBlurred] = useState(false);
  const [watermarkLabel, setWatermarkLabel] = useState<string>('');

  // Detecta pérdida de foco / cambio de pestaña para activar el blur
  useEffect(() => {
    const blur = () => setIsBlurred(true);
    const unblur = () => setIsBlurred(false);
    const handleVisibility = () => {
      document.hidden ? blur() : unblur();
    };

    window.addEventListener('blur', blur);
    window.addEventListener('focus', unblur);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.removeEventListener('blur', blur);
      window.removeEventListener('focus', unblur);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  // Carga el usuario autenticado para armar la marca de agua
  useEffect(() => {
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

    loadCurrentUserForWatermark();
  }, []);

  return (
    <div className="relative min-h-screen">
      {/* Marca de agua: solo arriba, centro y abajo */}
      {watermarkLabel && (
        <div
          className="pointer-events-none fixed inset-0 z-40 flex flex-col items-center justify-between py-12 select-none"
          aria-hidden="true"
        >
          <span className="text-sm font-semibold whitespace-nowrap text-gray-900 dark:text-gray-100 opacity-[0.08] dark:opacity-[0.12] -rotate-12">
            {watermarkLabel}
          </span>
          <span className="text-sm font-semibold whitespace-nowrap text-gray-900 dark:text-gray-100 opacity-[0.08] dark:opacity-[0.12] -rotate-12">
            {watermarkLabel}
          </span>
          <span className="text-sm font-semibold whitespace-nowrap text-gray-900 dark:text-gray-100 opacity-[0.08] dark:opacity-[0.12] -rotate-12">
            {watermarkLabel}
          </span>
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