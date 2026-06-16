// Cliente de Supabase configurado
import { createClient } from '@supabase/supabase-js';

// Credenciales del Sistema UPN - Proyecto: wkdtovngbdlnucupylos (MIGRADO COMPLETO)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://wkdtovngbdlnucupylos.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndrZHRvdm5nYmRsbnVjdXB5bG9zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA5MDQ0MjgsImV4cCI6MjA3NjQ4MDQyOH0.TRaGGrg7i4Q4GY6wUf078smDsMx6YFT5uogRboNXIoA';

// Log de configuración para debugging
console.log('🚀 SISTEMA UPN COMPLETO MIGRADO - Configuración:', {
  url: supabaseUrl,
  keyStartsWith: supabaseAnonKey.substring(0, 20) + '...',
  envVar: import.meta.env.VITE_SUPABASE_URL ? 'from env' : 'from fallback',
  projectId: 'wkdtovngbdlnucupylos',
  modules: 'COMPLETE - LEIP, Asignaciones, Especializaciones, etc.'
});

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
