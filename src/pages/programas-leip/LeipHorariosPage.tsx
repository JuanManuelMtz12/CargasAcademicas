import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Plus, Edit, Trash2, Clock, AlertCircle, CheckCircle, AlertTriangle,
  ArrowLeft, Calendar,
} from 'lucide-react';

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface LeipProgram {
  id: string;
  name: string;
  coordinator_id: string | null;
  sede_id: string | null;
  sede?: { id: string; name: string } | null;
}

interface LeipSubject {
  id: string;
  name: string;
  leip_program_id: string;
  leip_module_id: string | null;
  module_name: string | null;
}

interface LeipSchedule {
  id: string;
  teacher_id: string;
  leip_subject_id: string;
  group_id: string;
  school_cycle_id: string;
  day: string;
  start_hour: number;
  end_hour: number;
  teacher?: { id: string; name: string } | null;
  subject?: { id: string; name: string } | null;
  group?: { id: string; name: string } | null;
}

interface Teacher {
  id: string;
  name: string;
  category?: { id: string; category: string; max_hours_week: number } | null;
}

interface Group {
  id: string;
  name: string;
}

interface SchoolCycle {
  id: string;
  name: string;
  is_active: boolean;
  cycle_type: string;
}

interface DaySchedule {
  day: 'Lunes' | 'Martes' | 'Miércoles' | 'Jueves' | 'Viernes' | 'Sábado';
  enabled: boolean;
  start_hour: number;
  end_hour: number;
}

// LEIP es sabatino
const LEIP_DAYS: DaySchedule['day'][] = ['Sábado'];

// ─── Componente ───────────────────────────────────────────────────────────────

export default function LeipHorariosPage() {
  const { programId } = useParams<{ programId: string }>();
  const navigate = useNavigate();

  const [program, setProgram]           = useState<LeipProgram | null>(null);
  const [schedules, setSchedules]       = useState<LeipSchedule[]>([]);
  const [schoolCycles, setSchoolCycles] = useState<SchoolCycle[]>([]);
  const [teachers, setTeachers]         = useState<Teacher[]>([]);
  const [subjects, setSubjects]         = useState<LeipSubject[]>([]);
  const [groups, setGroups]             = useState<Group[]>([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState<string | null>(null);

  const [selectedSchoolCycleId, setSelectedSchoolCycleId] = useState('');
  const [selectedGroupId, setSelectedGroupId]             = useState('');
  const [selectedTeacherId, setSelectedTeacherId]         = useState('');

  const [isModalOpen, setIsModalOpen]         = useState(false);
  const [editingSchedules, setEditingSchedules] = useState<LeipSchedule[]>([]);
  const [submitting, setSubmitting]           = useState(false);

  const [deleteDialogOpen, setDeleteDialogOpen]     = useState(false);
  const [schedulesToDelete, setSchedulesToDelete]   = useState<LeipSchedule[]>([]);

  const [formTeacherId, setFormTeacherId]   = useState('');
  const [formSubjectId, setFormSubjectId]   = useState('');
  const [formGroupId, setFormGroupId]       = useState('');
  const [formCycleId, setFormCycleId]       = useState('');
  const [daySchedules, setDaySchedules]     = useState<DaySchedule[]>([]);

  // ── Carga de datos ──────────────────────────────────────────────────────────

  useEffect(() => { if (programId) loadData(); }, [programId]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Programa LEIP
      const { data: progRows, error: progError } = await supabase
        .from('leip_programs')
        .select('*, sede:sede_id(id, name)')
        .eq('id', programId)
        .limit(1);
      if (progError) throw progError;
      if (!progRows || progRows.length === 0) throw new Error('Programa no encontrado');
      setProgram(progRows[0]);

      // Materias del programa
      const { data: subjectsData, error: subjectsError } = await supabase
        .from('leip_subjects')
        .select('*')
        .eq('leip_program_id', programId)
        .order('name');
      if (subjectsError) throw subjectsError;
      setSubjects(subjectsData || []);

      const subjectIds = (subjectsData || []).map(s => s.id);

      // Horarios
      if (subjectIds.length > 0) {
        const { data: scheduleData, error: scheduleError } = await supabase
          .from('leip_schedule')
          .select(`
            *,
            teacher:teachers(id, name),
            subject:leip_subjects(id, name),
            group:groups(id, name)
          `)
          .in('leip_subject_id', subjectIds)
          .order('day')
          .order('start_hour');
        if (scheduleError) throw scheduleError;
        setSchedules(scheduleData || []);
      }

      // Ciclos LEIP
      const { data: cyclesData, error: cyclesError } = await supabase
        .from('school_cycles')
        .select('*')
        .eq('is_active', true)
        .eq('cycle_type', 'LEIP')
        .order('name');
      if (cyclesError) throw cyclesError;
      setSchoolCycles(cyclesData || []);

      // Maestros del programa LEIP
      const { data: teacherProgramData, error: teachersError } = await supabase
        .from('teacher_leip_program')
        .select(`teacher:teachers(*, category:categories(id, category, max_hours_week))`)
        .eq('leip_program_id', programId);
      if (teachersError) throw teachersError;
      const teachersList: Teacher[] = (teacherProgramData || [])
        .map((row: any) => row.teacher)
        .filter(Boolean)
        .sort((a: Teacher, b: Teacher) => a.name.localeCompare(b.name, 'es'));
      setTeachers(teachersList);

      // Grupos
      const { data: groupsData, error: groupsError } = await supabase
        .from('groups').select('*').order('name');
      if (groupsError) throw groupsError;
      setGroups(groupsData || []);

      // Ciclo activo por defecto
      const activeCycle = (cyclesData || []).find(c => c.is_active);
      if (activeCycle) {
        setSelectedSchoolCycleId(activeCycle.id);
        setFormCycleId(activeCycle.id);
      }

    } catch (err: any) {
      console.error('Error loading data:', err);
      setError(err.message);
      toast.error('Error al cargar los datos');
    } finally {
      setLoading(false);
    }
  };

  // ── Validación de día ───────────────────────────────────────────────────────

  const getDayError = (day: DaySchedule): string | null => {
    if (!day.enabled) return null;
    if (day.start_hour >= day.end_hour) return 'Inicio debe ser menor a fin';
    if (day.start_hour < 7 || day.end_hour > 21) return 'Entre 7:00 y 21:00';
    return null;
  };

  const updateDay = (index: number, updates: Partial<DaySchedule>) => {
    const newDays = [...daySchedules];
    newDays[index] = { ...newDays[index], ...updates };
    setDaySchedules(newDays);
  };

  // ── Modal ───────────────────────────────────────────────────────────────────

  const openModal = (schedulesGroup?: LeipSchedule[]) => {
    if (schedulesGroup && schedulesGroup.length > 0) {
      const first = schedulesGroup[0];
      setEditingSchedules(schedulesGroup);
      setFormTeacherId(first.teacher_id);
      setFormSubjectId(first.leip_subject_id);
      setFormGroupId(first.group_id);
      setFormCycleId(first.school_cycle_id);

      const byDay = new Map(schedulesGroup.map(s => [s.day, s]));
      setDaySchedules(LEIP_DAYS.map(day => {
        const ex = byDay.get(day);
        return { day, enabled: !!ex, start_hour: ex?.start_hour || 8, end_hour: ex?.end_hour || 10 };
      }));
    } else {
      setEditingSchedules([]);
      setFormTeacherId('');
      setFormSubjectId('');
      setFormGroupId('');
      setFormCycleId(selectedSchoolCycleId || schoolCycles.find(c => c.is_active)?.id || '');
      setDaySchedules(LEIP_DAYS.map(day => ({ day, enabled: false, start_hour: 8, end_hour: 10 })));
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingSchedules([]);
    setFormTeacherId('');
    setFormSubjectId('');
    setFormGroupId('');
    setDaySchedules([]);
  };

  // ── Guardar ─────────────────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const enabledDays = daySchedules.filter(d => d.enabled);
    if (!formTeacherId || !formSubjectId || !formGroupId || enabledDays.length === 0) {
      toast.error('Completa todos los campos y activa al menos un día');
      return;
    }
    const hasErrors = enabledDays.some(d => getDayError(d));
    if (hasErrors) {
      toast.error('Corrige los errores de horario');
      return;
    }

    setSubmitting(true);
    try {
      // Eliminar horarios anteriores si editamos
      if (editingSchedules.length > 0) {
        const { error: delError } = await supabase
          .from('leip_schedule')
          .delete()
          .in('id', editingSchedules.map(s => s.id));
        if (delError) throw delError;
      }

      // Insertar nuevos
      const inserts = enabledDays.map(day => ({
        teacher_id: formTeacherId,
        leip_subject_id: formSubjectId,
        group_id: formGroupId,
        school_cycle_id: formCycleId,
        day: day.day,
        start_hour: day.start_hour,
        end_hour: day.end_hour,
      }));

      const { error: insError } = await supabase.from('leip_schedule').insert(inserts);
      if (insError) throw insError;

      toast.success(editingSchedules.length > 0 ? 'Horario actualizado' : 'Horario creado');
      await loadData();
      closeModal();
    } catch (err: any) {
      console.error('Error saving:', err);
      toast.error(err.message || 'Error al guardar');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Eliminar ────────────────────────────────────────────────────────────────

  const handleDelete = (schedulesGroup: LeipSchedule[]) => {
    setSchedulesToDelete(schedulesGroup);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    try {
      const { error } = await supabase
        .from('leip_schedule')
        .delete()
        .in('id', schedulesToDelete.map(s => s.id));
      if (error) throw error;
      toast.success('Asignación eliminada');
      await loadData();
    } catch (err: any) {
      toast.error(err.message || 'Error al eliminar');
    } finally {
      setDeleteDialogOpen(false);
      setSchedulesToDelete([]);
    }
  };

  // ── Filtros y agrupación ────────────────────────────────────────────────────

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center text-red-600">
          <AlertCircle className="h-12 w-12 mx-auto mb-4" />
          <p>{error}</p>
          <Button onClick={loadData} className="mt-4">Reintentar</Button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  const filteredByPeriod = selectedSchoolCycleId
    ? schedules.filter(s => s.school_cycle_id === selectedSchoolCycleId)
    : schedules;

  const uniqueGroups = [...new Map(
    filteredByPeriod.filter(s => s.group).map(s => [s.group_id, { id: s.group_id, name: s.group!.name }])
  ).values()].sort((a, b) => a.name.localeCompare(b.name));

  const uniqueTeachers = [...new Map(
    filteredByPeriod.filter(s => s.teacher).map(s => [s.teacher_id, { id: s.teacher_id, name: s.teacher!.name }])
  ).values()].sort((a, b) => a.name.localeCompare(b.name));

  // Agrupar por maestro + materia + grupo
  interface Grouped {
    key: string;
    group: string; groupId: string;
    teacher: string; teacherId: string;
    subject: string; subjectId: string;
    schedulesList: LeipSchedule[];
    sab?: { start: number; end: number };
    totalHours: number;
  }

  const grouped: Record<string, Grouped> = {};
  const teacherHours: Record<string, number> = {};

  filteredByPeriod
    .filter(s => (!selectedGroupId || s.group_id === selectedGroupId) &&
                 (!selectedTeacherId || s.teacher_id === selectedTeacherId))
    .forEach(s => {
      const key = `${s.group_id}-${s.teacher_id}-${s.leip_subject_id}`;
      if (!grouped[key]) {
        grouped[key] = {
          key,
          group: s.group?.name || 'N/A', groupId: s.group_id,
          teacher: s.teacher?.name || 'N/A', teacherId: s.teacher_id,
          subject: s.subject?.name || 'N/A', subjectId: s.leip_subject_id,
          schedulesList: [], totalHours: 0,
        };
      }
      grouped[key].schedulesList.push(s);
      if (s.day === 'Sábado') grouped[key].sab = { start: s.start_hour, end: s.end_hour };
      teacherHours[s.teacher_id] = (teacherHours[s.teacher_id] || 0) + (s.end_hour - s.start_hour);
    });

  const groupedArray = Object.values(grouped).sort((a, b) => {
    if (a.group !== b.group) return a.group.localeCompare(b.group);
    if (a.teacher !== b.teacher) return a.teacher.localeCompare(b.teacher);
    return a.subject.localeCompare(b.subject);
  });

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button variant="outline" size="sm" onClick={() => navigate('/programas-leip')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">LEIP — {program?.name}</h1>
              <p className="text-gray-600">{(program?.sede as any)?.name}</p>
            </div>
          </div>
          <Button onClick={() => openModal()}>
            <Plus className="h-4 w-4 mr-2" />
            Nueva Asignación
          </Button>
        </div>

        {/* Filtros */}
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="py-4">
            <div className="flex items-center gap-6 flex-wrap">
              <div className="flex items-center gap-2">
                <Label className="text-sm font-medium text-blue-900 min-w-fit">Período:</Label>
                <Select value={selectedSchoolCycleId} onValueChange={v => { setSelectedSchoolCycleId(v); setSelectedGroupId(''); setSelectedTeacherId(''); }}>
                  <SelectTrigger className="w-44 bg-white">
                    <SelectValue placeholder="Seleccione período" />
                  </SelectTrigger>
                  <SelectContent>
                    {schoolCycles.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name} {c.is_active && '(Activo)'}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-sm font-medium text-blue-900 min-w-fit">Grupo:</Label>
                <Select value={selectedGroupId || 'all'} onValueChange={v => setSelectedGroupId(v === 'all' ? '' : v)}>
                  <SelectTrigger className="w-44 bg-white"><SelectValue placeholder="Todos los grupos" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los grupos</SelectItem>
                    {uniqueGroups.map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-sm font-medium text-blue-900 min-w-fit">Maestro:</Label>
                <Select value={selectedTeacherId || 'all'} onValueChange={v => setSelectedTeacherId(v === 'all' ? '' : v)}>
                  <SelectTrigger className="w-52 bg-white"><SelectValue placeholder="Todos los maestros" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los maestros</SelectItem>
                    {uniqueTeachers.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabla */}
        <Card>
          <CardHeader>
            <CardTitle>Horarios Asignados</CardTitle>
            <CardDescription>Vista consolidada por grupo, maestro y módulo</CardDescription>
          </CardHeader>
          <CardContent>
            {groupedArray.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No hay horarios asignados</p>
                <p className="text-sm">Comienza asignando el primer horario</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Grupo</TableHead>
                      <TableHead>Maestro</TableHead>
                      <TableHead>Módulo / Materia</TableHead>
                      <TableHead className="text-center">Sábado</TableHead>
                      <TableHead className="text-center">Total Hrs</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {groupedArray.map(item => (
                      <TableRow key={item.key}>
                        <TableCell className="font-medium">{item.group}</TableCell>
                        <TableCell>{item.teacher}</TableCell>
                        <TableCell>{item.subject}</TableCell>
                        <TableCell className="text-center text-xs">
                          {item.sab ? (
                            <span className="font-semibold text-blue-600">
                              {item.sab.start}:00-{item.sab.end}:00
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="font-bold text-green-600">
                            {teacherHours[item.teacherId] || 0}h
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end space-x-1">
                            <Button variant="outline" size="sm" onClick={() => openModal(item.schedulesList)}>
                              <Edit className="h-3 w-3" />
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => handleDelete(item.schedulesList)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Modal nueva asignación */}
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingSchedules.length > 0 ? 'Editar Horario' : 'Nueva Asignación'}</DialogTitle>
              <DialogDescription>Asigna un módulo a un grupo con su horario del sábado.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Maestro *</Label>
                  <Select value={formTeacherId} onValueChange={setFormTeacherId}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                    <SelectContent>
                      {teachers.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Módulo / Materia *</Label>
                  <Select value={formSubjectId} onValueChange={setFormSubjectId}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                    <SelectContent>
                      {subjects.map(s => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.module_name ? `[${s.module_name}] ` : ''}{s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Grupo *</Label>
                  <Select value={formGroupId} onValueChange={setFormGroupId}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                    <SelectContent>
                      {groups.map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Tabla de días */}
              <div className="space-y-2">
                <Label>Horario *</Label>
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-20">Activar</TableHead>
                        <TableHead>Día</TableHead>
                        <TableHead>Hora Inicio</TableHead>
                        <TableHead>Hora Fin</TableHead>
                        <TableHead className="w-24">Estado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {daySchedules.map((day, idx) => {
                        const err = getDayError(day);
                        return (
                          <TableRow key={day.day} className={!day.enabled ? 'opacity-50' : ''}>
                            <TableCell>
                              <input type="checkbox" checked={day.enabled}
                                onChange={e => updateDay(idx, { enabled: e.target.checked })}
                                className="rounded border-gray-300" />
                            </TableCell>
                            <TableCell className="font-medium">{day.day}</TableCell>
                            <TableCell>
                              <Select value={day.start_hour.toString()}
                                onValueChange={v => updateDay(idx, { start_hour: parseInt(v) })}
                                disabled={!day.enabled}>
                                <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {Array.from({ length: 14 }, (_, i) => i + 7).map(h => (
                                    <SelectItem key={h} value={h.toString()}>{h}:00</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              <Select value={day.end_hour.toString()}
                                onValueChange={v => updateDay(idx, { end_hour: parseInt(v) })}
                                disabled={!day.enabled}>
                                <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {Array.from({ length: 14 }, (_, i) => i + 8).map(h => (
                                    <SelectItem key={h} value={h.toString()}>{h}:00</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              {err ? (
                                <div className="flex items-center text-red-600">
                                  <AlertTriangle className="h-4 w-4 mr-1" />
                                  <span className="text-xs">{err}</span>
                                </div>
                              ) : day.enabled ? (
                                <div className="flex items-center text-green-600">
                                  <CheckCircle className="h-4 w-4 mr-1" />
                                  <span className="text-xs">Listo</span>
                                </div>
                              ) : (
                                <span className="text-xs text-gray-400">Inactivo</span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={closeModal} disabled={submitting}>Cancelar</Button>
                <Button type="submit" disabled={submitting ||
                  !formTeacherId || !formSubjectId || !formGroupId ||
                  daySchedules.filter(d => d.enabled).length === 0}>
                  {submitting ? 'Guardando...' : 'Guardar Horario'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Confirmar eliminación */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar asignación?</AlertDialogTitle>
              <AlertDialogDescription>
                {schedulesToDelete[0] && (
                  <div className="bg-gray-50 p-3 rounded-md space-y-1 text-sm mt-2">
                    <p><strong>Maestro:</strong> {schedulesToDelete[0].teacher?.name}</p>
                    <p><strong>Módulo:</strong> {schedulesToDelete[0].subject?.name}</p>
                    <p><strong>Grupo:</strong> {schedulesToDelete[0].group?.name}</p>
                    <p><strong>Días:</strong> {schedulesToDelete.map(s => s.day).join(', ')}</p>
                  </div>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">
                Eliminar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

      </div>
    </div>
  );
}