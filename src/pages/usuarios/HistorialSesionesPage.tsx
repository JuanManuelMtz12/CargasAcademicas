import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LogIn, LogOut, Search, RefreshCw, Plus, Pencil, Trash2, History, ChevronLeft, ChevronRight } from 'lucide-react';
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

interface ActivityLogEntry {
  id: string;
  table_name: string;
  record_id: string | null;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  performed_by: string | null;
  performed_by_email: string | null;
  old_data: Record<string, any> | null;
  new_data: Record<string, any> | null;
  created_at: string;
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrador',
  coordinador: 'Coordinador',
  maestro: 'Maestro',
  invitado: 'Invitado',
};

// Nombre amigable de cada tabla auditada. Si agregas un trigger de
// fn_log_activity() a una tabla nueva, súmala aquí también.
const TABLE_LABELS: Record<string, string> = {
  groups: 'Grupos',
  subjects: 'Materias',
  teachers: 'Maestros',
  schedule: 'Horarios',
  categories: 'Categorías',
  departamentos: 'Departamentos',
  modules: 'Módulos',
  programs: 'Programas',
  sedes: 'Sedes',
  teacher_program: 'Asignación Maestro-Programa',
  user_department_access: 'Acceso a Departamento',
  user_module_permissions: 'Permisos de Módulo',
  user_program_access: 'Acceso a Programa',
  users: 'Usuarios',
};

const ACTION_CONFIG: Record<ActivityLogEntry['action'], { label: string; className: string; icon: typeof Plus }> = {
  INSERT: { label: 'Creó', className: 'bg-green-100 text-green-800', icon: Plus },
  UPDATE: { label: 'Editó', className: 'bg-blue-100 text-blue-800', icon: Pencil },
  DELETE: { label: 'Eliminó', className: 'bg-red-100 text-red-800', icon: Trash2 },
};

const PAGE_SIZE_OPTIONS = [25, 50, 100];

// Intenta sacar un nombre/título legible del registro afectado a partir
// de los campos más comunes usados en las tablas del proyecto.
const getRecordLabel = (entry: ActivityLogEntry): string => {
  const data = entry.new_data || entry.old_data;
  if (!data) return entry.record_id ?? '—';

  const fullName = data.first_name && data.last_name
    ? `${data.first_name} ${data.last_name}`.trim()
    : null;

  return (
    data.name ??
    data.nombre ??
    fullName ??
    data.username ??
    data.email ??
    data.title ??
    entry.record_id ??
    '—'
  );
};

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

// Controles de paginación reutilizables entre ambas pestañas.
function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : page * pageSize + 1;
  const to = Math.min(total, (page + 1) * pageSize);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-3 border-t border-gray-200 dark:border-slate-700">
      <div className="text-sm text-gray-600 dark:text-slate-400">
        {total === 0 ? 'Sin resultados' : `Mostrando ${from}–${to} de ${total}`}
      </div>
      <div className="flex items-center gap-3">
        <Select value={String(pageSize)} onValueChange={(v) => onPageSizeChange(Number(v))}>
          <SelectTrigger className="w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAGE_SIZE_OPTIONS.map((size) => (
              <SelectItem key={size} value={String(size)}>
                {size} / página
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onPageChange(Math.max(0, page - 1))}
            disabled={page === 0}
            className="p-1.5 rounded border border-gray-300 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm text-gray-600 dark:text-slate-400 px-2">
            Página {total === 0 ? 0 : page + 1} de {totalPages}
          </span>
          <button
            onClick={() => onPageChange(Math.min(totalPages - 1, page + 1))}
            disabled={page >= totalPages - 1}
            className="p-1.5 rounded border border-gray-300 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

type Tab = 'sessions' | 'activity';

export default function HistorialSesionesPage() {
  const [tab, setTab] = useState<Tab>('sessions');

  // --- Sesiones ---
  const [sessionEntries, setSessionEntries] = useState<SessionLogEntry[]>([]);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [sessionTotal, setSessionTotal] = useState(0);
  const [sessionPage, setSessionPage] = useState(0);
  const [sessionPageSize, setSessionPageSize] = useState(25);
  const [searchTerm, setSearchTerm] = useState('');
  const [eventFilter, setEventFilter] = useState<'all' | 'login' | 'logout'>('all');

  // --- Actividad ---
  const [activityEntries, setActivityEntries] = useState<ActivityLogEntry[]>([]);
  const [activityLoading, setActivityLoading] = useState(true);
  const [activityTotal, setActivityTotal] = useState(0);
  const [activityPage, setActivityPage] = useState(0);
  const [activityPageSize, setActivityPageSize] = useState(25);
  const [activitySearch, setActivitySearch] = useState('');
  const [activityTableFilter, setActivityTableFilter] = useState<string>('all');
  const [activityActionFilter, setActivityActionFilter] = useState<'all' | ActivityLogEntry['action']>('all');
  const [availableTables, setAvailableTables] = useState<string[]>([]);
  // Mapa id de usuario -> { nombre completo, rol }, solo para los usuarios
  // que aparecen en la página actual (no se resuelve todo el historial de golpe).
  const [performerById, setPerformerById] = useState<Record<string, { fullName: string; role: string | null }>>({});

  const loadSessionEntries = useCallback(async () => {
    try {
      setSessionLoading(true);
      const from = sessionPage * sessionPageSize;
      const to = from + sessionPageSize - 1;

      let query = supabase
        .from('session_log')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to);

      if (searchTerm.trim()) {
        query = query.ilike('email', `%${searchTerm.trim()}%`);
      }
      if (eventFilter !== 'all') {
        query = query.eq('event_type', eventFilter);
      }

      const { data, error, count } = await query;
      if (error) throw error;

      setSessionEntries(data || []);
      setSessionTotal(count ?? 0);
    } catch (error: any) {
      console.error('Error cargando historial de sesiones:', error);
      toast.error('Error al cargar el historial: ' + error.message);
    } finally {
      setSessionLoading(false);
    }
  }, [sessionPage, sessionPageSize, searchTerm, eventFilter]);

  const loadActivityEntries = useCallback(async () => {
    try {
      setActivityLoading(true);
      const from = activityPage * activityPageSize;
      const to = from + activityPageSize - 1;

      let query = supabase
        .from('activity_log')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to);

      if (activitySearch.trim()) {
        query = query.ilike('performed_by_email', `%${activitySearch.trim()}%`);
      }
      if (activityTableFilter !== 'all') {
        query = query.eq('table_name', activityTableFilter);
      }
      if (activityActionFilter !== 'all') {
        query = query.eq('action', activityActionFilter);
      }

      const { data, error, count } = await query;
      if (error) throw error;

      const entries = data || [];
      setActivityEntries(entries);
      setActivityTotal(count ?? 0);

      // Resolver nombre completo + rol de cada "performed_by" de esta página
      // contra public.users. No hay join directo porque la FK apunta a
      // auth.users, que no está expuesto por la API de Supabase.
      const performerIds = Array.from(
        new Set(entries.map((e) => e.performed_by).filter((id): id is string => !!id))
      );

      if (performerIds.length > 0) {
        const { data: usersData, error: usersError } = await supabase
          .from('users')
          .select('id, first_name, last_name, role')
          .in('id', performerIds);

        if (usersError) {
          console.error('Error resolviendo usuarios del historial:', usersError);
        } else {
          setPerformerById((prev) => {
            const next = { ...prev };
            (usersData || []).forEach((u: any) => {
              next[u.id] = {
                fullName: `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim(),
                role: u.role ?? null,
              };
            });
            return next;
          });
        }
      }
    } catch (error: any) {
      console.error('Error cargando historial de actividad:', error);
      toast.error('Error al cargar el historial de actividad: ' + error.message);
    } finally {
      setActivityLoading(false);
    }
  }, [activityPage, activityPageSize, activitySearch, activityTableFilter, activityActionFilter]);

  // Lista de módulos para el filtro, cargada una sola vez (independiente de la paginación)
  useEffect(() => {
    supabase
      .from('activity_log')
      .select('table_name')
      .then(({ data, error }) => {
        if (error) {
          console.error('Error cargando módulos disponibles:', error);
          return;
        }
        const unique = Array.from(new Set((data || []).map((r: any) => r.table_name))).sort();
        setAvailableTables(unique);
      });
  }, []);

  // Volver a la página 0 cuando cambian los filtros de sesiones
  useEffect(() => {
    setSessionPage(0);
  }, [searchTerm, eventFilter, sessionPageSize]);

  // Volver a la página 0 cuando cambian los filtros de actividad
  useEffect(() => {
    setActivityPage(0);
  }, [activitySearch, activityTableFilter, activityActionFilter, activityPageSize]);

  // Debounce simple de la búsqueda de texto antes de golpear la base de datos
  useEffect(() => {
    const t = setTimeout(() => loadSessionEntries(), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionPage, sessionPageSize, eventFilter, searchTerm]);

  useEffect(() => {
    const t = setTimeout(() => loadActivityEntries(), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activityPage, activityPageSize, activityTableFilter, activityActionFilter, activitySearch]);

  const isLoading = tab === 'sessions' ? sessionLoading : activityLoading;

  const handleRefresh = () => {
    if (tab === 'sessions') loadSessionEntries();
    else loadActivityEntries();
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">
            Historial
          </h1>
          <p className="text-gray-600 dark:text-slate-400">
            Registro de sesiones y de la actividad de los usuarios en el sistema
          </p>
        </div>
        <button
          onClick={handleRefresh}
          className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          Actualizar
        </button>
      </div>

      {/* Pestañas */}
      <div className="mb-6 border-b border-gray-200 dark:border-slate-700 flex gap-6">
        <button
          onClick={() => setTab('sessions')}
          className={`flex items-center gap-2 pb-3 text-sm font-medium border-b-2 transition-colors ${
            tab === 'sessions'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-slate-400'
          }`}
        >
          <LogIn className="w-4 h-4" />
          Sesiones (inicio / cierre)
        </button>
        <button
          onClick={() => setTab('activity')}
          className={`flex items-center gap-2 pb-3 text-sm font-medium border-b-2 transition-colors ${
            tab === 'activity'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-slate-400'
          }`}
        >
          <History className="w-4 h-4" />
          Actividad del sistema
        </button>
      </div>

      {tab === 'sessions' ? (
        <>
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
                  {sessionEntries.map((entry) => (
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
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <button
                          onClick={() => setSearchTerm(entry.email)}
                          className="text-gray-900 dark:text-slate-100 hover:underline decoration-dotted text-left"
                          title="Ver solo las sesiones de esta persona"
                        >
                          {entry.email}
                        </button>
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

            {!sessionLoading && sessionEntries.length === 0 && (
              <div className="text-center py-8">
                <p className="text-gray-500 dark:text-slate-400">
                  {sessionTotal === 0 && !searchTerm && eventFilter === 'all'
                    ? 'Aún no hay eventos de sesión registrados'
                    : 'No se encontraron eventos con los filtros aplicados'}
                </p>
              </div>
            )}

            <Pagination
              page={sessionPage}
              pageSize={sessionPageSize}
              total={sessionTotal}
              onPageChange={setSessionPage}
              onPageSizeChange={setSessionPageSize}
            />
          </div>
        </>
      ) : (
        <>
          <div className="mb-6 flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                type="text"
                value={activitySearch}
                onChange={(e) => setActivitySearch(e.target.value)}
                placeholder="Buscar por correo de quien lo hizo..."
                className="pl-10"
              />
            </div>

            <Select value={activityTableFilter} onValueChange={setActivityTableFilter}>
              <SelectTrigger className="w-full sm:w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los módulos</SelectItem>
                {availableTables.map((t) => (
                  <SelectItem key={t} value={t}>
                    {TABLE_LABELS[t] ?? t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={activityActionFilter} onValueChange={(v: any) => setActivityActionFilter(v)}>
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las acciones</SelectItem>
                <SelectItem value="INSERT">Solo creaciones</SelectItem>
                <SelectItem value="UPDATE">Solo ediciones</SelectItem>
                <SelectItem value="DELETE">Solo eliminaciones</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-slate-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-300 uppercase tracking-wider">
                      Acción
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-300 uppercase tracking-wider">
                      Módulo
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-300 uppercase tracking-wider">
                      Registro afectado
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-300 uppercase tracking-wider">
                      Realizado por
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-300 uppercase tracking-wider">
                      Fecha y hora
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-slate-600">
                  {activityEntries.map((entry) => {
                    const config = ACTION_CONFIG[entry.action];
                    const Icon = config.icon;
                    const performer = entry.performed_by ? performerById[entry.performed_by] : undefined;
                    return (
                      <tr key={entry.id} className="hover:bg-gray-50 dark:hover:bg-slate-700">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-full ${config.className}`}>
                            <Icon className="w-3 h-3" />
                            {config.label}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-slate-100">
                          {TABLE_LABELS[entry.table_name] ?? entry.table_name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-slate-400">
                          {getRecordLabel(entry)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {entry.performed_by ? (
                            <button
                              onClick={() => setActivitySearch(entry.performed_by_email ?? '')}
                              className="text-left hover:underline decoration-dotted"
                              title="Ver solo las acciones de esta persona"
                            >
                              <div className="text-gray-900 dark:text-slate-100 font-medium">
                                {performer?.fullName || entry.performed_by_email || 'Usuario desconocido'}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-slate-400">
                                {entry.performed_by_email}
                                {performer?.role && ` · ${ROLE_LABELS[performer.role] ?? performer.role}`}
                              </div>
                            </button>
                          ) : (
                            <span className="text-gray-500 dark:text-slate-400">Sistema</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-slate-400">
                          {formatDate(entry.created_at)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {!activityLoading && activityEntries.length === 0 && (
              <div className="text-center py-8">
                <p className="text-gray-500 dark:text-slate-400">
                  {activityTotal === 0 && !activitySearch && activityTableFilter === 'all' && activityActionFilter === 'all'
                    ? 'Aún no hay actividad registrada'
                    : 'No se encontró actividad con los filtros aplicados'}
                </p>
              </div>
            )}

            <Pagination
              page={activityPage}
              pageSize={activityPageSize}
              total={activityTotal}
              onPageChange={setActivityPage}
              onPageSizeChange={setActivityPageSize}
            />
          </div>
        </>
      )}
    </div>
  );
}