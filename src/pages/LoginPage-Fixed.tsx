// Página de Login con Corrección de Formularios
import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Lock, Mail } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [formErrors, setFormErrors] = useState<{email?: string; password?: string}>({});
  
  // Refs para acceso directo al DOM (fallback)
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  
  const signIn = useAuthStore((state) => state.signIn);
  const navigate = useNavigate();

  // Validación de formulario
  const validateForm = () => {
    const errors: {email?: string; password?: string} = {};
    
    if (!email || !email.includes('@')) {
      errors.email = 'Email válido es requerido';
    }
    
    if (!password || password.length < 3) {
      errors.password = 'Contraseña es requerida (mínimo 3 caracteres)';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Método de envío con validación completa
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Validación de formulario
    if (!validateForm()) {
      toast.error('Por favor, completa todos los campos correctamente');
      setLoading(false);
      return;
    }

    try {
      // Intentar login con valores del estado
      await signIn(email, password);
      toast.success('¡Bienvenido!');
      navigate('/dashboard');
    } catch (error: any) {
      console.error('Error de login:', error);
      toast.error(error.message || 'Credenciales inválidas');
      
      // Si falla, intentar con valores directos del DOM
      try {
        const directEmail = emailRef.current?.value || email;
        const directPassword = passwordRef.current?.value || password;
        
        if (directEmail && directPassword) {
          await signIn(directEmail, directPassword);
          toast.success('¡Bienvenido!');
          navigate('/dashboard');
        }
      } catch (directError: any) {
        console.error('Error de login directo:', directError);
        toast.error('Error de autenticación. Verifica tus credenciales.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Handler de email con debugging
  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newEmail = e.target.value;
    setEmail(newEmail);
    
    // Limpiar error de email al escribir
    if (formErrors.email && newEmail.includes('@')) {
      setFormErrors(prev => ({...prev, email: undefined}));
    }
    
    console.log('Email change:', newEmail, 'Length:', newEmail.length);
  };

  // Handler de contraseña con debugging
  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newPassword = e.target.value;
    setPassword(newPassword);
    
    // Limpiar error de contraseña al escribir
    if (formErrors.password && newPassword.length >= 3) {
      setFormErrors(prev => ({...prev, password: undefined}));
    }
    
    console.log('Password change:', 'Length:', newPassword.length, 'Value:', newPassword);
  };


  // Efecto para debugging
  useEffect(() => {
    console.log('Login form state:', { email, password, formErrors });
  }, [email, password, formErrors]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-orange-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 transition-all duration-500 relative overflow-hidden">
      {/* Decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-400/10 dark:bg-blue-500/5 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-orange-400/10 dark:bg-orange-500/5 rounded-full blur-3xl"></div>
      </div>
      
      <div className="absolute top-4 right-4 z-10">
        <ThemeToggle />
      </div>
      
      <div className="w-full max-w-md relative z-10">
        <div className="bg-white/80 dark:bg-slate-800/90 backdrop-blur-xl shadow-2xl dark:shadow-slate-900/50 rounded-2xl p-8 border border-gray-200/50 dark:border-slate-700/50 transition-all duration-300">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700 rounded-2xl mb-4 shadow-lg shadow-blue-500/30 dark:shadow-blue-600/20 transition-all duration-300">
              <Lock className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 dark:from-slate-100 dark:to-slate-300 bg-clip-text text-transparent">
              Sistema Escolar UPN
            </h1>
            <p className="text-gray-600 dark:text-slate-400 mt-2">Gestión de Horarios y Programas</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                Correo Electrónico
              </label>
              <div className="relative group">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-slate-500 w-5 h-5 transition-colors group-focus-within:text-blue-500 dark:group-focus-within:text-blue-400" />
                <Input
                  ref={emailRef}
                  id="email"
                  type="email"
                  value={email}
                  onChange={handleEmailChange}
                  className={`pl-10 bg-white dark:bg-slate-700/50 border-gray-300 dark:border-slate-600 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-blue-500 dark:focus:ring-blue-400 text-gray-900 dark:text-slate-100 placeholder:text-gray-400 dark:placeholder:text-slate-500 transition-all duration-200 ${
                    formErrors.email ? 'border-red-500' : ''
                  }`}
                  placeholder="usuario@upn.mx"
                  required
                />
              </div>
              {formErrors.email && (
                <p className="text-red-500 text-xs mt-1">{formErrors.email}</p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                Contraseña
              </label>
              <div className="relative group">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-slate-500 w-5 h-5 transition-colors group-focus-within:text-blue-500 dark:group-focus-within:text-blue-400" />
                <Input
                  ref={passwordRef}
                  id="password"
                  type="password"
                  value={password}
                  onChange={handlePasswordChange}
                  className={`pl-10 bg-white dark:bg-slate-700/50 border-gray-300 dark:border-slate-600 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-blue-500 dark:focus:ring-blue-400 text-gray-900 dark:text-slate-100 placeholder:text-gray-400 dark:placeholder:text-slate-500 transition-all duration-200 ${
                    formErrors.password ? 'border-red-500' : ''
                  }`}
                  placeholder="••••••••"
                  required
                />
              </div>
              {formErrors.password && (
                <p className="text-red-500 text-xs mt-1">{formErrors.password}</p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 dark:from-blue-600 dark:to-blue-700 dark:hover:from-blue-500 dark:hover:to-blue-600 text-white shadow-lg shadow-blue-500/30 dark:shadow-blue-600/20 transition-all duration-300 hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]"
              disabled={loading}
            >
              {loading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
            </Button>
          </form>

        </div>
      </div>
    </div>
  );
}
