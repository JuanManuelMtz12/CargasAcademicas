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
    const { data: listener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (isInitialLoad.current) {
        isInitialLoad.current = false;
        // No registramos nada en la carga inicial si ya había sesión;
        // solo nos interesan transiciones reales de login/logout.
        return;
      }

      try {
        if (event === 'SIGNED_IN' && session?.user) {
          // Rol actual del usuario, para que el historial no dependa de
          // hacer join contra public.users cada vez que se muestra.
          const { data: profile } = await supabase
            .from('users')
            .select('role')
            .eq('id', session.user.id)
            .maybeSingle();

          await supabase.from('session_log').insert({
            user_id: session.user.id,
            email: session.user.email,
            role: profile?.role ?? null,
            event_type: 'login',
            user_agent: navigator.userAgent,
          });
        }

        if (event === 'SIGNED_OUT') {
          // En SIGNED_OUT ya no hay `session`, así que usamos el último
          // usuario conocido guardado en localStorage por supabase-js
          // antes de que se limpie, o lo pasamos explícitamente al
          // llamar signOut (ver helper `signOutAndLog` más abajo).
          const lastUserId = sessionStorage.getItem('last_user_id');
          const lastEmail = sessionStorage.getItem('last_user_email');
          const lastRole = sessionStorage.getItem('last_user_role');

          if (lastUserId) {
            await supabase.from('session_log').insert({
              user_id: lastUserId,
              email: lastEmail ?? '',
              role: lastRole,
              event_type: 'logout',
              user_agent: navigator.userAgent,
            });
          }

          sessionStorage.removeItem('last_user_id');
          sessionStorage.removeItem('last_user_email');
          sessionStorage.removeItem('last_user_role');
        }

        if (event === 'SIGNED_IN' && session?.user) {
          // Guardamos snapshot para poder loguear el logout después
          // (en ese momento `session` ya no estará disponible).
          sessionStorage.setItem('last_user_id', session.user.id);
          sessionStorage.setItem('last_user_email', session.user.email ?? '');
        }
      } catch (err) {
        // Nunca bloquear el login/logout real por un fallo al loguear.
        console.error('Error registrando evento de sesión:', err);
      }
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);
}
