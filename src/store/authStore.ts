// Store de autenticación con Zustand
import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';

interface AuthState {
  user: User | null;
  role: 'admin' | 'coordinador' | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  initialize: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  role: null,
  loading: true,

  signIn: async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;

    const role = data.user?.user_metadata?.role || null;
    set({ user: data.user, role });
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ user: null, role: null });
  },

  initialize: async () => {
    console.log('=== AUTH STORE INITIALIZE ===');
    set({ loading: true });
    
    const { data: { session } } = await supabase.auth.getSession();
    
    console.log('Session data:', session);
    
    if (session?.user) {
      const role = session.user.user_metadata?.role || null;
      console.log('User found:', { id: session.user.id, email: session.user.email, role });
      set({ user: session.user, role, loading: false });
    } else {
      console.log('No session found');
      set({ user: null, role: null, loading: false });
    }

    // Escuchar cambios en la autenticación
    supabase.auth.onAuthStateChange((_event, session) => {
      console.log('Auth state changed:', _event, session?.user?.email);
      if (session?.user) {
        const role = session.user.user_metadata?.role || null;
        console.log('Setting user in state:', { id: session.user.id, email: session.user.email, role });
        set({ user: session.user, role });
      } else {
        console.log('Clearing user from state');
        set({ user: null, role: null });
      }
    });
  },
}));