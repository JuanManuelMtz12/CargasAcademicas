import React, { useState } from 'react';
import { supabase } from '../lib/supabase';

export default function CreateAdminPage() {
  const [result, setResult] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const createAdminUser = async () => {
    setLoading(true);
    setResult('Creando usuario admin...');

    try {
      // Usar la función de crear usuario directamente
      const { data, error } = await supabase.auth.admin.createUser({
        email: 'admin@upn.mx',
        password: 'admin123',
        email_confirm: true,
        user_metadata: {
          role: 'admin'
        }
      });

      if (error) {
        setResult(`❌ Error: ${error.message}`);
        return;
      }

      if (!data.user) {
        setResult(`❌ Error: No se pudo crear el usuario`);
        return;
      }

      setResult(`✅ Usuario creado exitosamente!
ID: ${data.user.id}
Email: ${data.user.email}
Confirmado: ${data.user.email_confirmed_at ? 'Sí' : 'No'}
Rol: ${data.user.user_metadata?.role || 'admin'}`);
      
    } catch (err: any) {
      setResult(`❌ Error general: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const verifyUsers = async () => {
    setLoading(true);
    setResult('Verificando usuarios...');

    try {
      const { data, error } = await supabase.auth.admin.listUsers();
      
      if (error) {
        setResult(`❌ Error: ${error.message}`);
        return;
      }

      if (!data?.users || !Array.isArray(data.users)) {
        setResult(`❌ Error: No se pudo obtener la lista de usuarios`);
        return;
      }

      const users = data.users;
      const adminUser = users.find((u: any) => u.email === 'admin@upn.mx');
      
      if (adminUser) {
        setResult(`✅ Usuario admin@upn.mx existe:
ID: ${adminUser.id}
Confirmado: ${adminUser.email_confirmed_at ? 'Sí' : 'No'}
Total usuarios: ${users.length}`);
      } else {
        setResult(`❌ Usuario admin@upn.mx no existe.
Total usuarios: ${users.length}`);
      }
      
    } catch (err: any) {
      setResult(`❌ Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full">
        <h1 className="text-2xl font-bold text-center mb-6">Panel de Administración</h1>
        
        <div className="space-y-4">
          <button
            onClick={createAdminUser}
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Procesando...' : 'Crear Usuario Admin'}
          </button>
          
          <button
            onClick={verifyUsers}
            disabled={loading}
            className="w-full bg-green-600 text-white py-2 px-4 rounded hover:bg-green-700 disabled:opacity-50"
          >
            {loading ? 'Procesando...' : 'Verificar Usuarios'}
          </button>
          
          {result && (
            <div className="mt-4 p-4 bg-gray-100 rounded whitespace-pre-wrap text-sm">
              {result}
            </div>
          )}
          
          <div className="mt-6 p-4 bg-blue-50 rounded text-sm">
            <h3 className="font-semibold mb-2">Instrucciones:</h3>
            <ol className="list-decimal list-inside space-y-1">
              <li>Primero usa "Verificar Usuarios" para comprobar el estado actual</li>
              <li>Si no existe, usa "Crear Usuario Admin"</li>
              <li>Luego prueba el login en la aplicación principal</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}