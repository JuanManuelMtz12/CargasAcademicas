import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';

/**
 * Monta esto UNA SOLA VEZ, cerca de la raíz de la app (por ejemplo en App.tsx,
 * o dentro del componente donde ya inicializas la sesión con Supabase).
 *
 * Escucha los eventos de autenticación y escribe una fila en `session_log`
 * cada vez que alguien inicia o cierra sesión. No requiere backend adicional:
 * el propio cliente inserta su fila, protegido por la política RLS que solo
 * permite `user_id = auth.uid()`.
 *
 * Uso:
 *   function App() {
 *     useSessionLogger();
 *     return (...)
 *   }
 */
export function useSessionLogger() {
  // Evita loguear un SIGNED_IN "fantasma" que Supabase dispara al cargar
  // la página con una sesión ya existente (no es un login nuevo real).
  const isInitialLoad = useRef(true);

  useEffect(() => {
    // IMPORTANTE: el callback de onAuthStateChange se ejecuta dentro de un
    // lock interno de supabase-js. Hacer `await` de otra llamada a Supabase
    // (auth o base de datos) DIRECTAMENTE dentro de este callback puede
    // bloquear ese lock y colgar la app (se queda en "Iniciando sesión...").
    // Por eso el callback en sí NO es async: solo agenda el trabajo real
    // con setTimeout(..., 0), que lo saca del lock y lo ejecuta después.
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (isInitialLoad.current) {
        isInitialLoad.current = false;
        // No registramos nada en la carga inicial si ya había sesión;
        // solo nos interesan transiciones reales de login/logout.
        return;
      }

      if (event === 'SIGNED_IN' && session?.user) {
        const userId = session.user.id;
        const email = session.user.email ?? '';

        // Guardamos snapshot para poder loguear el logout después
        // (en ese momento `session` ya no estará disponible).
        sessionStorage.setItem('last_user_id', userId);
        sessionStorage.setItem('last_user_email', email);

        setTimeout(async () => {
          try {
            const { data: profile } = await supabase
              .from('users')
              .select('role')
              .eq('id', userId)
              .maybeSingle();

            sessionStorage.setItem('last_user_role', profile?.role ?? '');

            await supabase.from('session_log').insert({
              user_id: userId,
              email,
              role: profile?.role ?? null,
              event_type: 'login',
              user_agent: navigator.userAgent,
            });
          } catch (err) {
            // Nunca bloquear el login real por un fallo al loguear.
            console.error('Error registrando evento de sesión (login):', err);
          }
        }, 0);
      }

      if (event === 'SIGNED_OUT') {
        const lastUserId = sessionStorage.getItem('last_user_id');
        const lastEmail = sessionStorage.getItem('last_user_email');
        const lastRole = sessionStorage.getItem('last_user_role');

        sessionStorage.removeItem('last_user_id');
        sessionStorage.removeItem('last_user_email');
        sessionStorage.removeItem('last_user_role');

        if (lastUserId) {
          setTimeout(async () => {
            try {
              await supabase.from('session_log').insert({
                user_id: lastUserId,
                email: lastEmail ?? '',
                role: lastRole || null,
                event_type: 'logout',
                user_agent: navigator.userAgent,
              });
            } catch (err) {
              console.error('Error registrando evento de sesión (logout):', err);
            }
          }, 0);
        }
      }
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);
}