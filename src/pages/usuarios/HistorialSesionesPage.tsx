import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LogIn, LogOut, Search, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';


interface SessionLogEntry {
  id: string;
  user_id: string;
  email: string;
  role: string | null;
  event_type: 'login' | 'logout';
  user_agent: string | null;
  created_at: string;
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrador',
  coordinador: 'Coordinador',
  maestro: 'Maestro',
  invitado: 'Invitado',
};

export default function HistorialSesionesPage() {
  const [entries, setEntries] = useState<SessionLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [eventFilter, setEventFilter] = useState<'all' | 'login' | 'logout'>('all');

  const loadEntries = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('session_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);

      if (error) throw error;
      setEntries(data || []);
    } catch (error: any) {
      console.error('Error cargando historial de sesiones:', error);
      toast.error('Error al cargar el historial: ' + error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  const filtered = entries.filter((e) => {
    const matchesSearch =
      searchTerm === '' || e.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesEvent = eventFilter === 'all' || e.event_type === eventFilter;
    return matchesSearch && matchesEvent;
  });

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleString('es-MX', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

  // Extrae un resumen legible del navegador/dispositivo a partir del user-agent
  const parseDevice = (ua: string | null) => {
    if (!ua) return 'Desconocido';
    if (/Mobi|Android/i.test(ua)) return 'Móvil';
    if (/Edg/i.test(ua)) return 'Edge';
    if (/Chrome/i.test(ua)) return 'Chrome';
    if (/Firefox/i.test(ua)) return 'Firefox';
    if (/Safari/i.test(ua)) return 'Safari';
    return 'Navegador';
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">
            Historial de Sesiones
          </h1>
          <p className="text-gray-600 dark:text-slate-400">
            Registro de inicios y cierres de sesión de los usuarios
          </p>
        </div>
        <button
          onClick={loadEntries}
          className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Actualizar
        </button>
      </div>

      <div className="mb-6 flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por correo..."
            className="pl-10"
          />
        </div>

        <Select value={eventFilter} onValueChange={(v: any) => setEventFilter(v)}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los eventos</SelectItem>
            <SelectItem value="login">Solo inicios de sesión</SelectItem>
            <SelectItem value="logout">Solo cierres de sesión</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-slate-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-300 uppercase tracking-wider">
                  Evento
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-300 uppercase tracking-wider">
                  Usuario
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-300 uppercase tracking-wider">
                  Rol
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-300 uppercase tracking-wider">
                  Dispositivo
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-300 uppercase tracking-wider">
                  Fecha y hora
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-slate-600">
              {filtered.map((entry) => (
                <tr key={entry.id} className="hover:bg-gray-50 dark:hover:bg-slate-700">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-full ${
                        entry.event_type === 'login'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-200 text-gray-700'
                      }`}
                    >
                      {entry.event_type === 'login' ? (
                        <LogIn className="w-3 h-3" />
                      ) : (
                        <LogOut className="w-3 h-3" />
                      )}
                      {entry.event_type === 'login' ? 'Inicio de sesión' : 'Cierre de sesión'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-slate-100">
                    {entry.email}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-slate-400">
                    {entry.role ? ROLE_LABELS[entry.role] ?? entry.role : '—'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-slate-400">
                    {parseDevice(entry.user_agent)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-slate-400">
                    {formatDate(entry.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!loading && filtered.length === 0 && (
          <div className="text-center py-8">
            <p className="text-gray-500 dark:text-slate-400">
              {entries.length === 0
                ? 'Aún no hay eventos de sesión registrados'
                : 'No se encontraron eventos con los filtros aplicados'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
