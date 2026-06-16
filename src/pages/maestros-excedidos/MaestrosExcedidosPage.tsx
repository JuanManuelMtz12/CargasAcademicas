import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Database } from '@/types/database';
import { toast } from 'sonner';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { AlertTriangle } from 'lucide-react';

type SchoolCycle = Database['public']['Tables']['school_cycles']['Row'];
type Teacher = Database['public']['Tables']['teachers']['Row'];
type Category = Database['public']['Tables']['categories']['Row'];
type Schedule = Database['public']['Tables']['schedule']['Row'];

interface MaestroExcedido {
  id: string;
  nombre: string;
  categoria: string;
  subcategoria: string | null;
  horasPermitidas: number;
  horasAsignadas: number;
  horasExcedidas: number;
}

export default function MaestrosExcedidosPage() {
  const [cycles, setCycles] = useState<SchoolCycle[]>([]);
  const [selectedCycle, setSelectedCycle] = useState<string>('');
  const [maestrosExcedidos, setMaestrosExcedidos] = useState<MaestroExcedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingData, setLoadingData] = useState(false);

  useEffect(() => {
    loadCycles();
  }, []);

  useEffect(() => {
    if (selectedCycle) {
      loadMaestrosExcedidos();
    }
  }, [selectedCycle]);

  const loadCycles = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('school_cycles')
        .select('*')
        .order('start_date', { ascending: false });

      if (error) throw error;
      
      setCycles(data || []);
      
      // Seleccionar el ciclo activo por defecto
      const activeCycle = data?.find(c => c.is_active);
      if (activeCycle) {
        setSelectedCycle(activeCycle.id);
      } else if (data && data.length > 0) {
        setSelectedCycle(data[0].id);
      }
    } catch (error: any) {
      console.error('Error loading cycles:', error);
      toast.error('Error al cargar los ciclos escolares');
    } finally {
      setLoading(false);
    }
  };

  const loadMaestrosExcedidos = async () => {
    try {
      setLoadingData(true);
      
      // Llamar a la función RPC optimizada que hace todo el cálculo en el servidor
      const { data, error } = await supabase
        .rpc('get_maestros_excedidos', {
          p_cycle_id: selectedCycle
        });

      if (error) throw error;

      // Transformar los datos al formato del componente
      const maestrosExcedidosTemp: MaestroExcedido[] = (data || []).map((row: any) => ({
        id: row.teacher_id,
        nombre: row.teacher_name,
        categoria: row.category,
        subcategoria: row.subcategory,
        horasPermitidas: row.horas_permitidas,
        horasAsignadas: row.horas_asignadas,
        horasExcedidas: row.horas_excedidas,
      }));

      setMaestrosExcedidos(maestrosExcedidosTemp);
      
    } catch (error: any) {
      console.error('Error loading maestros excedidos:', error);
      toast.error('Error al cargar los datos de maestros excedidos');
    } finally {
      setLoadingData(false);
    }
  };

  const getCategoryDisplayName = (categoria: string, subcategoria: string | null) => {
    return subcategoria ? `${categoria} - ${subcategoria}` : categoria;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-slate-100">Maestros Excedidos</h1>
          <p className="text-gray-600 dark:text-slate-400 mt-1">
            Monitoreo de maestros que exceden sus horas permitidas
          </p>
        </div>
      </div>

      {/* Selector de Ciclo Escolar */}
      <Card className="dark:bg-slate-800 dark:border-slate-700">
        <CardHeader>
          <CardTitle>Seleccionar Ciclo Escolar</CardTitle>
          <CardDescription>
            Elige el ciclo escolar para revisar las horas asignadas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 max-w-md">
            <Label htmlFor="cycle">Ciclo Escolar</Label>
            <Select value={selectedCycle} onValueChange={setSelectedCycle}>
              <SelectTrigger id="cycle">
                <SelectValue placeholder="Selecciona un ciclo" />
              </SelectTrigger>
              <SelectContent>
                {cycles.map((cycle) => (
                  <SelectItem key={cycle.id} value={cycle.id}>
                    {cycle.name} {cycle.is_active ? '(Activo)' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tabla de Maestros Excedidos */}
      <Card className="dark:bg-slate-800 dark:border-slate-700">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            Maestros que Exceden Horas Permitidas
          </CardTitle>
          <CardDescription>
            {loadingData
              ? 'Cargando datos...'
              : `${maestrosExcedidos.length} maestro${maestrosExcedidos.length !== 1 ? 's' : ''} excede${maestrosExcedidos.length === 1 ? '' : 'n'} el límite de horas`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingData ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : maestrosExcedidos.length === 0 ? (
            <div className="text-center py-12">
              <div className="flex flex-col items-center gap-3">
                <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                  <svg
                    className="w-8 h-8 text-green-600 dark:text-green-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
                <p className="text-lg font-medium text-gray-900 dark:text-slate-100">
                  No hay maestros que excedan sus horas permitidas
                </p>
                <p className="text-sm text-gray-600 dark:text-slate-400">
                  Todos los maestros están dentro del límite de horas asignadas en este ciclo
                </p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre del Maestro</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead className="text-center">Horas Permitidas</TableHead>
                    <TableHead className="text-center">Horas Asignadas</TableHead>
                    <TableHead className="text-center">Horas Excedidas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {maestrosExcedidos.map((maestro) => (
                    <TableRow key={maestro.id}>
                      <TableCell className="font-medium">{maestro.nombre}</TableCell>
                      <TableCell>
                        <span className="px-2 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                          {getCategoryDisplayName(maestro.categoria, maestro.subcategoria)}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="text-sm">{maestro.horasPermitidas}h</span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="text-sm font-medium">{maestro.horasAsignadas}h</span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-bold bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">
                          <AlertTriangle className="w-4 h-4" />
                          +{maestro.horasExcedidas}h
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
