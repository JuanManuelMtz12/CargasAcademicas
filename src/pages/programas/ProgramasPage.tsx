import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { usePermissions } from '@/hooks/usePermissions';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plus, Edit, Trash2, Clock, Users, BookOpen, Calendar, FileSpreadsheet } from 'lucide-react';
import ManageTeachersModal from '@/components/ManageTeachersModal';
import CalendarioAcademicoModal from '@/components/CalendarioAcademicoModal';
import { downloadConcentradoExcel, ConcentradoRow } from '@/utils/concentradoExcel';

type Program = Database['public']['Tables']['programs']['Row'];
type ProgramInsert = Database['public']['Tables']['programs']['Insert'];

interface ProgramWithRelations extends Program {
  coordinador?: { id: string; name: string } | null;
  sede?: { id: string; name: string } | null;
  maestros_count: number;
  materias_count: number;
  horarios_count: number;
}

interface Sede {
  id: string;
  name: string;
}

interface Teacher {
  id: string;
  name: string;
}

interface FormData {
  name: string;
  type: 'LIC' | 'LEIP' | 'MAE';
  coordinator_id: string;
  sede_id: string;
}

export default function ProgramasPage() {
  const { allowedPrograms, isAdmin, loading: permissionsLoading } = usePermissions();
  const [programs, setPrograms] = useState<ProgramWithRelations[]>([]);
  const [sedes, setSedes] = useState<Sede[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingProgram, setEditingProgram] = useState<ProgramWithRelations | null>(null);
  const [deletingProgram, setDeletingProgram] = useState<ProgramWithRelations | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [isManageTeachersModalOpen, setIsManageTeachersModalOpen] = useState(false);
  const [managingProgram, setManagingProgram] = useState<ProgramWithRelations | null>(null);
  const [isCalendarioModalOpen, setIsCalendarioModalOpen] = useState(false);
  const [calendarioProgram, setCalendarioProgram] = useState<ProgramWithRelations | null>(null);
  const [downloadingConcentrado, setDownloadingConcentrado] = useState(false);

  const [formData, setFormData] = useState<FormData>({
    name: '',
    type: 'LIC',
    coordinator_id: '',
    sede_id: '',
  });

  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});

  useEffect(() => {
    if (!permissionsLoading) loadData();
  }, [permissionsLoading, allowedPrograms, isAdmin]);

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([loadPrograms(), loadSedes(), loadTeachers()]);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Error al cargar los datos');
    } finally {
      setLoading(false);
    }
  };

  const loadPrograms = async () => {
    try {
      let programsQuery = supabase
        .from('programs')
        .select(`
          *,
          coordinador:coordinator_id (id, name),
          sede:sede_id (id, name)
        `)
        .order('name');

      if (!isAdmin && allowedPrograms.length > 0) {
        programsQuery = programsQuery.in('id', allowedPrograms);
      }

      const { data: programsData, error: programsError } = await programsQuery;
      if (programsError) throw programsError;

      const programsWithCounts = await Promise.all(
        (programsData || []).map(async (program) => {
          const { count: maestrosCount } = await supabase
            .from('teacher_program')
            .select('*', { count: 'exact', head: true })
            .eq('program_id', program.id);

          const { count: materiasCount } = await supabase
            .from('subjects')
            .select('*', { count: 'exact', head: true })
            .eq('program_id', program.id);

          const { data: subjectsIds } = await supabase
            .from('subjects')
            .select('id')
            .eq('program_id', program.id);

          let horariosCount = 0;
          if (subjectsIds && subjectsIds.length > 0) {
            const { count } = await supabase
              .from('schedule')
              .select('*', { count: 'exact', head: true })
              .in('subject_id', subjectsIds.map(s => s.id));
            horariosCount = count || 0;
          }

          return {
            ...program,
            maestros_count: maestrosCount || 0,
            materias_count: materiasCount || 0,
            horarios_count: horariosCount,
          };
        })
      );

      setPrograms(programsWithCounts);
    } catch (error) {
      console.error('Error loading programs:', error);
      throw error;
    }
  };

  const loadSedes = async () => {
    try {
      const { data, error } = await supabase.from('sedes').select('*').order('name');
      if (error) throw error;
      setSedes(data || []);
    } catch (error) {
      console.error('Error loading sedes:', error);
      throw error;
    }
  };

  const loadTeachers = async () => {
    try {
      const { data, error } = await supabase.from('teachers').select('*').order('name');
      if (error) throw error;
      setTeachers(data || []);
    } catch (error) {
      console.error('Error loading teachers:', error);
      throw error;
    }
  };

  // ── Descarga del Concentrado General en Excel ─────────────────────────────
  const handleDownloadConcentrado = async () => {
    try {
      setDownloadingConcentrado(true);

      // 1. Obtener TODOS los programas visibles
      let programsQuery = supabase
        .from('programs')
        .select('id, name, sede:sede_id(name)')
        .order('name');

      if (!isAdmin && allowedPrograms.length > 0) {
        programsQuery = programsQuery.in('id', allowedPrograms);
      }

      const { data: allPrograms, error: programsError } = await programsQuery;
      if (programsError) throw programsError;

      const rows: ConcentradoRow[] = [];

      for (const prog of allPrograms || []) {
        // 2. Obtener materias de este programa
        const { data: subjects } = await supabase
          .from('subjects')
          .select('id, name')
          .eq('program_id', prog.id);

        if (!subjects || subjects.length === 0) continue;
        const subjectIds = subjects.map(s => s.id);

        // 3. Obtener horarios con maestro, materia y grupo
        const { data: schedules } = await supabase
          .from('schedule')
          .select(`
            id,
            day,
            start_hour,
            end_hour,
            teacher:teachers(id, name, category:categories(category)),
            subject:subjects(id, name),
            group:groups(id, name)
          `)
          .in('subject_id', subjectIds)
          .order('teacher_id')
          .order('subject_id')
          .order('day');

        if (!schedules || schedules.length === 0) continue;

        // 4. Agrupar por maestro → materia+grupo
        type DayKey = 'Lunes' | 'Martes' | 'Miércoles' | 'Jueves' | 'Viernes' | 'Sábado';

        interface GroupedKey {
          teacherId: string;
          teacherName: string;
          contractType: string;
          subjectName: string;
          groupName: string;
          daySchedules: Partial<Record<DayKey, { start: number; end: number }>>;
        }

        const teacherMap = new Map<string, Map<string, GroupedKey>>();

        schedules.forEach((s: any) => {
          const teacher = Array.isArray(s.teacher) ? s.teacher[0] : s.teacher;
          const subject = Array.isArray(s.subject) ? s.subject[0] : s.subject;
          const group   = Array.isArray(s.group)   ? s.group[0]   : s.group;
          if (!teacher || !subject || !group) return;

          const cat = teacher.category
            ? (Array.isArray(teacher.category) ? teacher.category[0] : teacher.category)
            : null;
          const catStr = (cat?.category || '').toUpperCase();
          const contractType = catStr.includes('BASE') ? 'BASE'
            : catStr.includes('INVITADO') ? 'INVITADO'
            : catStr || 'N/D';

          const tId = teacher.id;
          const rowKey = `${subject.id}-${group.id}`;

          if (!teacherMap.has(tId)) teacherMap.set(tId, new Map());
          const tRows = teacherMap.get(tId)!;

          if (!tRows.has(rowKey)) {
            tRows.set(rowKey, {
              teacherId: tId,
              teacherName: teacher.name,
              contractType,
              subjectName: subject.name,
              groupName: group.name,
              daySchedules: {},
            });
          }

          const entry = tRows.get(rowKey)!;
          entry.daySchedules[s.day as DayKey] = { start: s.start_hour, end: s.end_hour };
        });

        // 5. Convertir a filas del concentrado
        teacherMap.forEach((tRows, _tId) => {
          const rowsArr = Array.from(tRows.values());

          // Calcular total de horas del docente
          const totalHours = rowsArr.reduce((acc, r) => {
            return acc + Object.values(r.daySchedules).reduce((a, d) => a + (d ? d.end - d.start : 0), 0);
          }, 0);

          rowsArr.forEach((r, idx) => {
            const hoursPerSubject = Object.values(r.daySchedules).reduce(
              (a, d) => a + (d ? d.end - d.start : 0), 0
            );
            rows.push({
              teacherName: idx === 0 ? r.teacherName : '',
              programName: prog.name,
              contractType: idx === 0 ? r.contractType : '',
              sede: (prog.sede as any)?.name || '',
              subjectName: r.subjectName,
              groupName: r.groupName,
              daySchedules: r.daySchedules,
              hoursPerSubject,
              totalHoursTeacher: idx === 0 ? totalHours : undefined,
            });
          });
        });
      }

      if (rows.length === 0) {
        toast.error('No hay horarios registrados para generar el concentrado');
        return;
      }

      downloadConcentradoExcel(rows, 'Concentrado General 2026');
      toast.success('Concentrado descargado correctamente');
    } catch (error: any) {
      console.error('Error generating concentrado:', error);
      toast.error('Error al generar el concentrado');
    } finally {
      setDownloadingConcentrado(false);
    }
  };

  const openCreateModal = () => {
    setEditingProgram(null);
    setFormData({ name: '', type: 'LIC', coordinator_id: '', sede_id: '' });
    setErrors({});
    setIsModalOpen(true);
  };

  const openEditModal = (program: ProgramWithRelations) => {
    setEditingProgram(program);
    setFormData({
      name: program.name,
      type: program.type as 'LIC' | 'LEIP' | 'MAE',
      coordinator_id: program.coordinator_id || '',
      sede_id: program.sede_id || '',
    });
    setErrors({});
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingProgram(null);
    setFormData({ name: '', type: 'LIC', coordinator_id: '', sede_id: '' });
    setErrors({});
  };

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof FormData, string>> = {};
    if (!formData.name.trim()) newErrors.name = 'El nombre es requerido';
    if (!formData.type) newErrors.type = 'El tipo es requerido';
    if (!formData.sede_id) newErrors.sede_id = 'La sede es requerida';
    if (!formData.coordinator_id) newErrors.coordinator_id = 'El coordinador es requerido';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) {
      toast.error('Por favor corrija los errores en el formulario');
      return;
    }
    setSubmitting(true);
    try {
      const programData: ProgramInsert = {
        name: formData.name.trim(),
        type: formData.type,
        coordinator_id: formData.coordinator_id || null,
        sede_id: formData.sede_id || null,
      };
      if (editingProgram) {
        const { error } = await supabase.from('programs').update(programData).eq('id', editingProgram.id);
        if (error) throw error;
        toast.success('Programa actualizado exitosamente');
      } else {
        const { error } = await supabase.from('programs').insert([programData]);
        if (error) throw error;
        toast.success('Programa creado exitosamente');
      }
      closeModal();
      await loadPrograms();
    } catch (error: any) {
      console.error('Error saving program:', error);
      toast.error(error.message || 'Error al guardar el programa');
    } finally {
      setSubmitting(false);
    }
  };

  const openDeleteDialog = (program: ProgramWithRelations) => {
    setDeletingProgram(program);
    setIsDeleteDialogOpen(true);
  };

  const closeDeleteDialog = () => {
    setIsDeleteDialogOpen(false);
    setDeletingProgram(null);
  };

  const handleDelete = async () => {
    if (!deletingProgram) return;
    try {
      const { count: materiasCount } = await supabase
        .from('subjects').select('*', { count: 'exact', head: true }).eq('program_id', deletingProgram.id);
      if (materiasCount && materiasCount > 0) {
        toast.error('No se puede eliminar el programa porque tiene materias asociadas');
        closeDeleteDialog(); return;
      }
      const { count: maestrosCount } = await supabase
        .from('teacher_program').select('*', { count: 'exact', head: true }).eq('program_id', deletingProgram.id);
      if (maestrosCount && maestrosCount > 0) {
        toast.error('No se puede eliminar el programa porque tiene maestros asignados');
        closeDeleteDialog(); return;
      }
      const { error } = await supabase.from('programs').delete().eq('id', deletingProgram.id);
      if (error) throw error;
      toast.success('Programa eliminado exitosamente');
      closeDeleteDialog();
      await loadPrograms();
    } catch (error: any) {
      console.error('Error deleting program:', error);
      toast.error(error.message || 'Error al eliminar el programa');
    }
  };

  const handleTypeChange = (value: string) => {
    setFormData({ ...formData, type: value as 'LIC' | 'LEIP' | 'MAE' });
  };

  const openManageTeachersModal = (program: ProgramWithRelations) => {
    setManagingProgram(program);
    setIsManageTeachersModalOpen(true);
  };

  const closeManageTeachersModal = () => {
    setIsManageTeachersModalOpen(false);
    setManagingProgram(null);
  };

  const handleTeachersUpdate = async () => {
    await loadPrograms();
  };

  const openCalendarioModal = (program: ProgramWithRelations) => {
    setCalendarioProgram(program);
    setIsCalendarioModalOpen(true);
  };

  const closeCalendarioModal = () => {
    setIsCalendarioModalOpen(false);
    setCalendarioProgram(null);
  };

  const getTipoBadgeColor = (type: string) => {
    switch (type) {
      case 'LIC': return 'bg-blue-100 text-blue-800';
      case 'LEIP': return 'bg-green-100 text-green-800';
      case 'MAE': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
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
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-slate-100">Programas Académicos</h1>
          <p className="text-gray-600 dark:text-slate-400 mt-1">
            Gestión de licenciaturas y maestrías
          </p>
        </div>
        <div className="flex gap-2">
          {/* ── Botón Concentrado General Excel ── */}
          <Button
            variant="outline"
            onClick={handleDownloadConcentrado}
            disabled={downloadingConcentrado}
            className="gap-2 border-emerald-600 text-emerald-700 hover:bg-emerald-50"
          >
            <FileSpreadsheet className="w-4 h-4" />
            {downloadingConcentrado ? 'Generando...' : 'Concentrado General'}
          </Button>
          {isAdmin && (
            <Button onClick={openCreateModal} className="gap-2">
              <Plus className="w-4 h-4" />
              Nuevo Programa
            </Button>
          )}
        </div>
      </div>

      <Card className="dark:bg-slate-800 dark:border-slate-700">
        <CardHeader>
          <CardTitle>Lista de Programas</CardTitle>
          <CardDescription>
            {programs.length} programa{programs.length !== 1 ? 's' : ''} registrado{programs.length !== 1 ? 's' : ''}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Sede</TableHead>
                  <TableHead>Coordinador</TableHead>
                  <TableHead className="text-center">
                    <Users className="w-4 h-4 inline mr-1" />
                    Maestros
                  </TableHead>
                  <TableHead className="text-center">
                    <BookOpen className="w-4 h-4 inline mr-1" />
                    Materias
                  </TableHead>
                  <TableHead className="text-center">
                    <Clock className="w-4 h-4 inline mr-1" />
                    Horarios
                  </TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {programs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-gray-500 py-8">
                      No hay programas registrados
                    </TableCell>
                  </TableRow>
                ) : (
                  programs.map((program) => (
                    <TableRow key={program.id}>
                      <TableCell className="font-medium">{program.name}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getTipoBadgeColor(program.type)}`}>
                          {program.type}
                        </span>
                      </TableCell>
                      <TableCell>{program.sede ? program.sede.name : '-'}</TableCell>
                      <TableCell>{program.coordinador ? program.coordinador.name : '-'}</TableCell>
                      <TableCell className="text-center">
                        <button
                          onClick={() => openManageTeachersModal(program)}
                          className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-green-100 text-green-800 text-sm font-semibold hover:bg-green-200 hover:scale-110 transition-all cursor-pointer"
                          title="Gestionar maestros"
                        >
                          {program.maestros_count}
                        </button>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-800 text-sm font-semibold">
                          {program.materias_count}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-purple-100 text-purple-800 text-sm font-semibold">
                          {program.horarios_count}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Link to={`/programas/${program.id}/horarios`}>
                            <Button variant="outline" size="sm" className="gap-1">
                              <Clock className="w-4 h-4" />
                              Horarios
                            </Button>
                          </Link>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openCalendarioModal(program)}
                            className="gap-1 text-green-600 hover:text-green-700 hover:bg-green-50"
                            title="Generar calendario académico"
                          >
                            <Calendar className="w-4 h-4" />
                            Calendario
                          </Button>
                          {isAdmin && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openEditModal(program)}
                                className="gap-1"
                              >
                                <Edit className="w-4 h-4" />
                                Editar
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openDeleteDialog(program)}
                                className="gap-1 text-red-600 hover:text-red-700 hover:bg-red-50"
                              >
                                <Trash2 className="w-4 h-4" />
                                Eliminar
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Modal de Creación/Edición */}
      <Dialog open={isModalOpen} onOpenChange={closeModal}>
        <DialogContent className="sm:max-w-[500px]">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>{editingProgram ? 'Editar Programa' : 'Nuevo Programa'}</DialogTitle>
              <DialogDescription>
                {editingProgram
                  ? 'Modifica los datos del programa académico'
                  : 'Completa los datos para crear un nuevo programa académico'}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Nombre del Programa <span className="text-red-500">*</span></Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ej: Pedagogía, Administración Educativa"
                  className={errors.name ? 'border-red-500' : ''}
                />
                {errors.name && <p className="text-sm text-red-500">{errors.name}</p>}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="type">Tipo <span className="text-red-500">*</span></Label>
                <Select value={formData.type} onValueChange={handleTypeChange}>
                  <SelectTrigger className={errors.type ? 'border-red-500' : ''}>
                    <SelectValue placeholder="Selecciona el tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LIC">Licenciatura (LIC)</SelectItem>
                    <SelectItem value="LEIP">Licenciatura en Educación Inicial y Preescolar (LEIP)</SelectItem>
                    <SelectItem value="MAE">Maestría (MAE)</SelectItem>
                  </SelectContent>
                </Select>
                {errors.type && <p className="text-sm text-red-500">{errors.type}</p>}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="sede">Sede <span className="text-red-500">*</span></Label>
                <Select value={formData.sede_id} onValueChange={(value) => setFormData({ ...formData, sede_id: value })}>
                  <SelectTrigger className={errors.sede_id ? 'border-red-500' : ''}>
                    <SelectValue placeholder="Selecciona la sede" />
                  </SelectTrigger>
                  <SelectContent>
                    {sedes.map((sede) => (
                      <SelectItem key={sede.id} value={sede.id}>{sede.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.sede_id && <p className="text-sm text-red-500">{errors.sede_id}</p>}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="coordinator">Coordinador <span className="text-red-500">*</span></Label>
                <Select value={formData.coordinator_id} onValueChange={(value) => setFormData({ ...formData, coordinator_id: value })}>
                  <SelectTrigger className={errors.coordinator_id ? 'border-red-500' : ''}>
                    <SelectValue placeholder="Selecciona el coordinador" />
                  </SelectTrigger>
                  <SelectContent>
                    {teachers.map((teacher) => (
                      <SelectItem key={teacher.id} value={teacher.id}>{teacher.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.coordinator_id && <p className="text-sm text-red-500">{errors.coordinator_id}</p>}
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeModal} disabled={submitting}>Cancelar</Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Guardando...' : editingProgram ? 'Actualizar' : 'Crear Programa'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal de Gestión de Maestros */}
      {managingProgram && (
        <ManageTeachersModal
          isOpen={isManageTeachersModalOpen}
          onClose={closeManageTeachersModal}
          programId={managingProgram.id}
          programName={managingProgram.name}
          onUpdate={handleTeachersUpdate}
        />
      )}

      {/* Modal de Generación de Calendario Académico */}
      {calendarioProgram && (
        <CalendarioAcademicoModal
          isOpen={isCalendarioModalOpen}
          onClose={closeCalendarioModal}
          programId={calendarioProgram.id}
          programName={calendarioProgram.name}
        />
      )}

      {/* Diálogo de Confirmación de Eliminación */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={closeDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará permanentemente el programa{' '}
              <strong>{deletingProgram?.name}</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}/ /   0 5 / 0 7 / 2 0 2 6   0 9 : 3 3 : 4 6 
 
