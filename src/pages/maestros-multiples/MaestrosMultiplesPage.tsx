import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Users, Clock, BookOpen, GraduationCap } from 'lucide-react';

interface MaestroMultiple {
  teacher_id: string;
  teacher_name: string;
  total_hours: number;
  programs: Array<{
    program_id: string;
    program_name: string;
    program_type: string;
  }>;
  program_count: number;
}

export default function MaestrosMultiplesPage() {
  const [maestros, setMaestros] = useState<MaestroMultiple[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMaestrosMultiples();
  }, []);

  const loadMaestrosMultiples = async () => {
    try {
      setLoading(true);

      // Obtener todos los horarios con sus relaciones
      const { data: schedules, error: schedulesError } = await supabase
        .from('schedule')
        .select(`
          id,
          teacher_id,
          start_hour,
          end_hour,
          teachers (id, name),
          subjects (id, program_id, programs (id, name, type))
        `);

      if (schedulesError) throw schedulesError;

      // Procesar datos para agrupar por maestro
      const maestrosMap = new Map<string, {
        teacher_id: string;
        teacher_name: string;
        total_hours: number;
        programs: Map<string, { program_id: string; program_name: string; program_type: string }>;
      }>();

      schedules?.forEach((schedule: any) => {
        const teacherId = schedule.teacher_id;
        const teacherName = schedule.teachers?.name || 'Sin nombre';
        const hours = schedule.end_hour - schedule.start_hour;
        const programId = schedule.subjects?.programs?.id;
        const programName = schedule.subjects?.programs?.name;
        const programType = schedule.subjects?.programs?.type;

        if (!teacherId || !programId) return;

        if (!maestrosMap.has(teacherId)) {
          maestrosMap.set(teacherId, {
            teacher_id: teacherId,
            teacher_name: teacherName,
            total_hours: 0,
            programs: new Map(),
          });
        }

        const maestro = maestrosMap.get(teacherId)!;
        maestro.total_hours += hours;

        if (!maestro.programs.has(programId)) {
          maestro.programs.set(programId, {
            program_id: programId,
            program_name: programName,
            program_type: programType,
          });
        }
      });

      // Filtrar solo maestros que están en más de una licenciatura
      const maestrosMultiples: MaestroMultiple[] = Array.from(maestrosMap.values())
        .filter(m => m.programs.size > 1)
        .map(m => ({
          teacher_id: m.teacher_id,
          teacher_name: m.teacher_name,
          total_hours: m.total_hours,
          programs: Array.from(m.programs.values()),
          program_count: m.programs.size,
        }))
        .sort((a, b) => b.program_count - a.program_count || b.total_hours - a.total_hours);

      setMaestros(maestrosMultiples);
    } catch (error: any) {
      console.error('Error loading maestros:', error);
      toast.error('Error al cargar los datos: ' + error.message);
    } finally {
      setLoading(false);
    }
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
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-slate-100">Maestros en Múltiples Licenciaturas</h1>
          <p className="text-gray-600 dark:text-slate-400 mt-1">
            Maestros que imparten clases en más de un programa académico
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-4 border border-blue-100">
        <div>
          <p className="text-sm text-gray-600 font-medium">Total de maestros</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-slate-100">{maestros.length}</p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-slate-700 border-b border-gray-200 dark:border-slate-600">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Maestro
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                  <div className="flex items-center gap-2">
                    <GraduationCap className="w-4 h-4" />
                    # Programas
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Horas Totales
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-4 h-4" />
                    Licenciaturas
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-slate-700">
              {maestros.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-gray-500 dark:text-slate-400">
                    No hay maestros que impartan en múltiples licenciaturas
                  </td>
                </tr>
              ) : (
                maestros.map((maestro) => (
                  <tr key={maestro.teacher_id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
                          <Users className="h-5 w-5 text-blue-600" />
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900 dark:text-slate-100">
                            {maestro.teacher_name}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-purple-100 text-purple-800">
                          {maestro.program_count}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-gray-400" />
                        <span className="text-sm font-semibold text-gray-900 dark:text-slate-100">
                          {maestro.total_hours} hrs
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-2">
                        {maestro.programs.map((program) => (
                          <div
                            key={program.program_id}
                            className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2 shadow-sm"
                          >
                            <span className="text-sm font-medium text-gray-900 dark:text-slate-100">
                              {program.program_name}
                            </span>
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
