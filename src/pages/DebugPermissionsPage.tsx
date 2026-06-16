import { useAuthStore } from '@/store/authStore';
import { usePermissions } from '@/hooks/usePermissions';
import { supabase } from '@/lib/supabase';
import { useEffect, useState } from 'react';

export default function DebugPermissionsPage() {
  const { user } = useAuthStore();
  const permissions = usePermissions();
  const [rawData, setRawData] = useState<any>(null);
  const [edgeFunctionTest, setEdgeFunctionTest] = useState<any>(null);

  useEffect(() => {
    const loadRawData = async () => {
      if (!user) return;

      // Test 1: Direct Supabase query (will be subject to RLS)
      const { data: modulePerms, error: moduleError } = await supabase
        .from('user_module_permissions')
        .select('*')
        .eq('user_id', user.id);

      const { data: programAccess, error: programError } = await supabase
        .from('user_program_access')
        .select('*')
        .eq('user_id', user.id);

      setRawData({
        modulePerms,
        moduleError: moduleError?.message,
        programAccess,
        programError: programError?.message,
      });

      // Test 2: Use RPC function to test permissions from server side
      try {
        if (user?.id) {
          const { data: rpcData, error } = await supabase.rpc('test_user_permissions', {
            p_user_id: user.id,
            p_module: 'dashboard',
            p_action: 'view'
          });

          if (error) {
            throw new Error(error.message);
          }

          setEdgeFunctionTest(rpcData);
        }
      } catch (error: any) {
        setEdgeFunctionTest({ error: error.message });
      }
    };

    loadRawData();
  }, [user]);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">Debug de Permisos</h1>

      <div className="space-y-6">
        <section className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Usuario Actual</h2>
          <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
            {JSON.stringify(
              {
                id: user?.id,
                email: user?.email,
                user_metadata: user?.user_metadata,
              },
              null,
              2
            )}
          </pre>
        </section>

        <section className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">
            Datos del Hook usePermissions
          </h2>
          <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
            {JSON.stringify(
              {
                isAdmin: permissions.isAdmin,
                loading: permissions.loading,
                allowedPrograms: permissions.allowedPrograms,
                hasModuleAccess_dashboard: permissions.hasModuleAccess('dashboard'),
                hasModuleAccess_programas: permissions.hasModuleAccess('programas'),
                hasModuleAccess_maestros: permissions.hasModuleAccess('maestros'),
              },
              null,
              2
            )}
          </pre>
        </section>

        <section className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">
            Consulta Directa a la BD (Raw Data)
          </h2>
          <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
            {JSON.stringify(rawData, null, 2)}
          </pre>
        </section>

        <section className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">
            Test Edge Function (Server-side verification)
          </h2>
          <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
            {JSON.stringify(edgeFunctionTest, null, 2)}
          </pre>
        </section>
      </div>
    </div>
  );
}
