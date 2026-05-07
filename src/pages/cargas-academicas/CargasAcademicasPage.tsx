import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
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
import { Plus, Edit, Trash2, User, MapPin, Clock, FileText, Search, Download } from 'lucide-react';
import CalendarSelector from '@/components/AcademicLoads/CalendarSelector';
import { generateAcademicLoadPDF, generateGroupCalendarPDF, downloadPDF } from '@/utils/academicLoadPDF';

interface AcademicLoad {
  id: string;
  group_name: string;
  location: string;
  module_number: string;
  module_name: string;
  module_key: string;
  start_time: string;
  end_time: string;
  work_modality: string;
  face_to_face_days: string[];
  face_to_face_schedule: any;
  start_date: string;
  end_date: string;
  status: string;
  program_name: string;
  specialization_name: string;
  instructor_name: string;
  academic_period_name: string;
  program_id: string;
  specialization_id: string;
  instructor_id: string;
  academic_period_id: string;
}

interface Program {
  id: string;
  name: string;
}

interface Specialization {
  id: string;
  name: string;
  program_id: string;
}

interface Teacher {
  id: string;
  name: string;
}

interface AcademicPeriod {
  id: string;
  name: string;
}

interface Sede {
  id: string;
  name: string;
}

interface FormData {
  program_id: string;
  specialization_id: string;
  group_name: string;
  location: string;
  module_number: string;
  module_name: string;
  module_key: string;
  instructor_id: string;
  start_time: string;
  end_time: string;
  work_modality: string;
  face_to_face_days: string[];
  face_to_face_schedule: Record<string, number[]>;
  start_date: string;
  end_date: string;
  status: string;
  academic_period_id: string;
}

export default function CargasAcademicasPage() {
  const [loads, setLoads] = useState<AcademicLoad[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [specializations, setSpecializations] = useState<Specialization[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [periods, setPeriods] = useState<AcademicPeriod[]>([]);
  const [sedes, setSedes] = useState<Sede[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingLoad, setEditingLoad] = useState<AcademicLoad | null>(null);
  const [deletingLoad, setDeletingLoad] = useState<AcademicLoad | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterLocation, setFilterLocation] = useState<string>('all');

  const [formData, setFormData] = useState<FormData>({
    program_id: '',
    specialization_id: '',
    group_name: '',
    location: '',
    module_number: '',
    module_name: '',
    module_key: '',
    instructor_id: '',
    start_time: '08:00',
    end_time: '12:00',
    work_modality: '',
    face_to_face_days: [],
    face_to_face_schedule: {},
    start_date: '',
    end_date: '',
    status: 'active',
    academic_period_id: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadAcademicLoads(),
        loadPrograms(),
        loadSpecializations(),
        loadTeachers(),
        loadPeriods(),
        loadSedes(),
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Error al cargar los datos');
    } finally {
      setLoading(false);
    }
  };

  const loadAcademicLoads = async () => {
    const { data, error } = await supabase
      .from('academic_loads_complete')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('Error al cargar las cargas académicas');
      console.error(error);
      return;
    }

    setLoads(data || []);
  };

  const loadPrograms = async () => {
    const { data, error } = await supabase
      .from('programs')
      .select('id, name')
      .order('name');

    if (error) {
      console.error('Error loading programs:', error);
      return;
    }

    setPrograms(data || []);
  };

  const loadSpecializations = async () => {
    const { data, error } = await supabase
      .from('specializations')
      .select('id, name, program_id')
      .eq('is_active', true)
      .order('name');

    if (error) {
      console.error('Error loading specializations:', error);
      return;
    }

    setSpecializations(data || []);
  };

  const loadTeachers = async () => {
    const { data, error } = await supabase
      .from('teachers')
      .select('id, name')
      .order('name');

    if (error) {
      console.error('Error loading teachers:', error);
      return;
    }

    setTeachers(data || []);
  };

  const loadPeriods = async () => {
    const { data, error } = await supabase
      .from('academic_periods')
      .select('id, name')
      .eq('is_active', true)
      .order('start_date', { ascending: false });

    if (error) {
      console.error('Error loading periods:', error);
      return;
    }

    setPeriods(data || []);
  };

  const loadSedes = async () => {
    const { data, error } = await supabase
      .from('sedes')
      .select('id, name')
      .order('name');

    if (error) {
      console.error('Error loading sedes:', error);
      return;
    }

    setSedes(data || []);
  };

  const filteredLoads = loads.filter((load) => {
    const matchesSearch =
      !searchTerm ||
      load.module_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      load.instructor_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      load.specialization_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      load.group_name.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = filterStatus === 'all' || load.status === filterStatus;
    const matchesLocation = filterLocation === 'all' || load.location === filterLocation;

    return matchesSearch && matchesStatus && matchesLocation;
  });

  const handleOpenModal = (load?: AcademicLoad) => {
    if (load) {
      setEditingLoad(load);
      setFormData({
        program_id: load.program_id,
        specialization_id: load.specialization_id,
        group_name: load.group_name,
        location: load.location,
        module_number: load.module_number,
        module_name: load.module_name,
        module_key: load.module_key,
        instructor_id: load.instructor_id,
        start_time: load.start_time.substring(0, 5),
        end_time: load.end_time.substring(0, 5),
        work_modality: load.work_modality,
        face_to_face_days: load.face_to_face_days || [],
        face_to_face_schedule: load.face_to_face_schedule || {},
        start_date: load.start_date,
        end_date: load.end_date,
        status: load.status,
        academic_period_id: load.academic_period_id,
      });
    } else {
      setEditingLoad(null);
      setFormData({
        program_id: '',
        specialization_id: '',
        group_name: '',
        location: '',
        module_number: '',
        module_name: '',
        module_key: '',
        instructor_id: '',
        start_time: '08:00',
        end_time: '12:00',
        work_modality: '',
        face_to_face_days: [],
        face_to_face_schedule: {},
        start_date: '',
        end_date: '',
        status: 'active',
        academic_period_id: periods[0]?.id || '',
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingLoad(null);
  };

  const generateSessions = async (loadId: string) => {
    try {
      const sessions: any[] = [];
      const schedule = formData.face_to_face_schedule;

      if (!schedule || Object.keys(schedule).length === 0) return;

      // Generar sesiones individuales basado en el calendario
      Object.entries(schedule).forEach(([month, days]) => {
        (days as number[]).forEach(day => {
          const year = formData.start_date ? new Date(formData.start_date).getFullYear() : new Date().getFullYear();
          const monthIndex = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'].indexOf(month.toLowerCase());
          
          if (monthIndex !== -1) {
            const sessionDate = new Date(year, monthIndex, day);
            sessions.push({
              academic_load_id: loadId,
              session_date: sessionDate.toISOString().split('T')[0],
              start_time: formData.start_time,
              end_time: formData.end_time,
              session_type: 'face_to_face',
              location: formData.location,
            });
          }
        });
      });

      if (sessions.length > 0) {
        const { error } = await supabase
          .from('academic_sessions')
          .insert(sessions);

        if (error) {
          console.error('Error creating sessions:', error);
        }
      }
    } catch (error) {
      console.error('Error generating sessions:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const payload = {
        ...formData,
        face_to_face_days: formData.face_to_face_days,
        face_to_face_schedule: formData.face_to_face_schedule,
      };

      if (editingLoad) {
        const { error } = await supabase
          .from('academic_loads')
          .update(payload)
          .eq('id', editingLoad.id);

        if (error) throw error;

        // Eliminar sesiones antiguas y regenerar
        await supabase
          .from('academic_sessions')
          .delete()
          .eq('academic_load_id', editingLoad.id);

        await generateSessions(editingLoad.id);

        toast.success('Carga académica actualizada correctamente');
      } else {
        const { data, error } = await supabase
          .from('academic_loads')
          .insert([payload])
          .select();

        if (error) throw error;

        // Generar sesiones automáticamente
        if (data && data.length > 0) {
          await generateSessions(data[0].id);
        }

        toast.success('Carga académica creada correctamente');
      }

      handleCloseModal();
      loadAcademicLoads();
    } catch (error: any) {
      console.error('Error saving academic load:', error);
      toast.error(error.message || 'Error al guardar la carga académica');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingLoad) return;

    try {
      const { error } = await supabase
        .from('academic_loads')
        .delete()
        .eq('id', deletingLoad.id);

      if (error) throw error;

      toast.success('Carga académica eliminada correctamente');
      setIsDeleteDialogOpen(false);
      setDeletingLoad(null);
      loadAcademicLoads();
    } catch (error: any) {
      console.error('Error deleting academic load:', error);
      toast.error(error.message || 'Error al eliminar la carga académica');
    }
  };

  const handleGeneratePDF = () => {
    try {
      if (filteredLoads.length === 0) {
        toast.error('No hay cargas para generar el PDF');
        return;
      }

      const periodName = periods.find(p => p.id === filteredLoads[0].academic_period_id)?.name || '';
      const doc = generateAcademicLoadPDF(filteredLoads, periodName);
      downloadPDF(doc, `cargas-academicas-${new Date().toISOString().split('T')[0]}.pdf`);
      toast.success('PDF generado correctamente');
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Error al generar el PDF');
    }
  };

  const handleGenerateGroupPDF = (load: AcademicLoad) => {
    try {
      const doc = generateGroupCalendarPDF(load);
      downloadPDF(doc, `calendario-${load.group_name.replace(/[^a-zA-Z0-9]/g, '-')}.pdf`);
      toast.success('Calendario PDF generado correctamente');
    } catch (error) {
      console.error('Error generating group PDF:', error);
      toast.error('Error al generar el calendario PDF');
    }
  };

  const handleDayToggle = (day: string) => {
    setFormData((prev) => ({
      ...prev,
      face_to_face_days: prev.face_to_face_days.includes(day)
        ? prev.face_to_face_days.filter((d) => d !== day)
        : [...prev.face_to_face_days, day],
    }));
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
      case 'inactive':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300';
      case 'completed':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'active':
        return 'Activo';
      case 'inactive':
        return 'Inactivo';
      case 'completed':
        return 'Completado';
      default:
        return status;
    }
  };

  const availableSpecializations = specializations.filter(
    (s) => s.program_id === formData.program_id
  );

  if (loading) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="text-2xl">Cargas Académicas</CardTitle>
              <CardDescription>
                Gestión de asignaciones de módulos y horarios para programas de maestría
              </CardDescription>
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={handleGeneratePDF}
                disabled={filteredLoads.length === 0}
              >
                <Download className="mr-2 h-4 w-4" />
                Generar PDF
              </Button>
              <Button onClick={() => handleOpenModal()}>
                <Plus className="mr-2 h-4 w-4" />
                Nueva Carga
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filtros */}
          <div className="mb-6 grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Buscar..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                <SelectItem value="active">Activo</SelectItem>
                <SelectItem value="inactive">Inactivo</SelectItem>
                <SelectItem value="completed">Completado</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterLocation} onValueChange={setFilterLocation}>
              <SelectTrigger>
                <SelectValue placeholder="Ubicación" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las ubicaciones</SelectItem>
                {sedes.map((sede) => (
                  <SelectItem key={sede.id} value={sede.name}>
                    {sede.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="text-sm text-gray-600 flex items-center">
              Total: {filteredLoads.length} cargas
            </div>
          </div>

          {/* Tabla */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Especialización / Módulo</TableHead>
                  <TableHead>Grupo</TableHead>
                  <TableHead>Asesor</TableHead>
                  <TableHead>Horario</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLoads.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                      No se encontraron cargas académicas
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLoads.map((load) => (
                    <TableRow key={load.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{load.module_name}</div>
                          <div className="text-sm text-gray-500">
                            {load.module_number} - {load.module_key}
                          </div>
                          <div className="text-xs text-gray-400 mt-1 line-clamp-1">
                            {load.specialization_name}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-gray-400" />
                          <div>
                            <div className="font-medium">{load.group_name}</div>
                            <div className="text-sm text-gray-500">{load.location}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-gray-400" />
                          <span className="text-sm">{load.instructor_name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-gray-400" />
                          <div>
                            <div className="text-sm">
                              {load.start_time.substring(0, 5)} - {load.end_time.substring(0, 5)}
                            </div>
                            <div className="text-xs text-gray-500">{load.work_modality}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeColor(
                            load.status
                          )}`}
                        >
                          {getStatusLabel(load.status)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleGenerateGroupPDF(load)}
                            title="Generar calendario PDF"
                          >
                            <FileText className="h-4 w-4 text-blue-600" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenModal(load)}
                            title="Editar"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setDeletingLoad(load);
                              setIsDeleteDialogOpen(true);
                            }}
                            title="Eliminar"
                          >
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
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

      {/* Modal de Formulario */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingLoad ? 'Editar Carga Académica' : 'Nueva Carga Académica'}
            </DialogTitle>
            <DialogDescription>
              Complete la información de la carga académica
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-6 py-4">
              {/* Información del Programa */}
              <div>
                <h3 className="text-lg font-semibold mb-3">Información del Programa</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="program_id">Programa *</Label>
                    <Select
                      value={formData.program_id}
                      onValueChange={(value) =>
                        setFormData({ ...formData, program_id: value, specialization_id: '' })
                      }
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar programa" />
                      </SelectTrigger>
                      <SelectContent>
                        {programs.map((program) => (
                          <SelectItem key={program.id} value={program.id}>
                            {program.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="specialization_id">Especialización *</Label>
                    <Select
                      value={formData.specialization_id}
                      onValueChange={(value) =>
                        setFormData({ ...formData, specialization_id: value })
                      }
                      required
                      disabled={!formData.program_id}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar especialización" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableSpecializations.map((spec) => (
                          <SelectItem key={spec.id} value={spec.id}>
                            {spec.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="academic_period_id">Período Académico *</Label>
                    <Select
                      value={formData.academic_period_id}
                      onValueChange={(value) =>
                        setFormData({ ...formData, academic_period_id: value })
                      }
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar período" />
                      </SelectTrigger>
                      <SelectContent>
                        {periods.map((period) => (
                          <SelectItem key={period.id} value={period.id}>
                            {period.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="location">Ubicación *</Label>
                    <Select
                      value={formData.location}
                      onValueChange={(value) => setFormData({ ...formData, location: value })}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar ubicación" />
                      </SelectTrigger>
                      <SelectContent>
                        {sedes.map((sede) => (
                          <SelectItem key={sede.id} value={sede.name}>
                            {sede.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Información del Módulo */}
              <div>
                <h3 className="text-lg font-semibold mb-3">Información del Módulo</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="module_number">Número de Módulo *</Label>
                    <Input
                      id="module_number"
                      value={formData.module_number}
                      onChange={(e) =>
                        setFormData({ ...formData, module_number: e.target.value })
                      }
                      placeholder="Ej: Módulo 2"
                      required
                    />
                  </div>
                  <div className="col-span-2">
                    <Label htmlFor="module_name">Nombre del Módulo *</Label>
                    <Input
                      id="module_name"
                      value={formData.module_name}
                      onChange={(e) => setFormData({ ...formData, module_name: e.target.value })}
                      placeholder="Ej: Evaluación de la práctica profesional"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="module_key">Clave *</Label>
                    <Input
                      id="module_key"
                      value={formData.module_key}
                      onChange={(e) => setFormData({ ...formData, module_key: e.target.value })}
                      placeholder="Ej: CLAVE 279"
                      required
                    />
                  </div>
                  <div className="col-span-2">
                    <Label htmlFor="group_name">Nombre del Grupo *</Label>
                    <Input
                      id="group_name"
                      value={formData.group_name}
                      onChange={(e) => setFormData({ ...formData, group_name: e.target.value })}
                      placeholder='Ej: TEZIUTLÁN GRUPO "A"'
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Horario y Asesor */}
              <div>
                <h3 className="text-lg font-semibold mb-3">Horario y Asesor</h3>
                <div className="grid grid-cols-4 gap-4">
                  <div>
                    <Label htmlFor="start_time">Hora Inicio *</Label>
                    <Input
                      id="start_time"
                      type="time"
                      value={formData.start_time}
                      onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="end_time">Hora Fin *</Label>
                    <Input
                      id="end_time"
                      type="time"
                      value={formData.end_time}
                      onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                      required
                    />
                  </div>
                  <div className="col-span-2">
                    <Label htmlFor="work_modality">Modalidad *</Label>
                    <Select
                      value={formData.work_modality}
                      onValueChange={(value) => setFormData({ ...formData, work_modality: value })}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar modalidad" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Presencial">Presencial</SelectItem>
                        <SelectItem value="En línea">En línea</SelectItem>
                        <SelectItem value="Presencial + En línea">Presencial + En línea</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-4">
                    <Label htmlFor="instructor_id">Asesor/Instructor *</Label>
                    <Select
                      value={formData.instructor_id}
                      onValueChange={(value) => setFormData({ ...formData, instructor_id: value })}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar asesor" />
                      </SelectTrigger>
                      <SelectContent>
                        {teachers.map((teacher) => (
                          <SelectItem key={teacher.id} value={teacher.id}>
                            {teacher.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Días presenciales */}
              <div>
                <Label>Días Presenciales</Label>
                <div className="flex gap-2 mt-2">
                  {['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábados', 'Domingos'].map(
                    (day) => (
                      <Button
                        key={day}
                        type="button"
                        variant={
                          formData.face_to_face_days.includes(day.toLowerCase())
                            ? 'default'
                            : 'outline'
                        }
                        size="sm"
                        onClick={() => handleDayToggle(day.toLowerCase())}
                      >
                        {day}
                      </Button>
                    )
                  )}
                </div>
              </div>

              {/* Calendario de Sesiones */}
              <div>
                <CalendarSelector
                  startDate={formData.start_date}
                  endDate={formData.end_date}
                  selectedDays={formData.face_to_face_days}
                  value={formData.face_to_face_schedule}
                  onChange={(schedule) => setFormData({ ...formData, face_to_face_schedule: schedule })}
                />
              </div>

              {/* Período */}
              <div>
                <h3 className="text-lg font-semibold mb-3">Período</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="start_date">Fecha Inicio *</Label>
                    <Input
                      id="start_date"
                      type="date"
                      value={formData.start_date}
                      onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="end_date">Fecha Fin *</Label>
                    <Input
                      id="end_date"
                      type="date"
                      value={formData.end_date}
                      onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="status">Estado *</Label>
                    <Select
                      value={formData.status}
                      onValueChange={(value) => setFormData({ ...formData, status: value })}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Activo</SelectItem>
                        <SelectItem value="inactive">Inactivo</SelectItem>
                        <SelectItem value="completed">Completado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCloseModal}>
                Cancelar
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Guardando...' : editingLoad ? 'Actualizar' : 'Crear'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Diálogo de Eliminación */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Está seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará permanentemente la carga académica
              {deletingLoad && (
                <span className="font-semibold"> {deletingLoad.module_name}</span>
              )}
              .
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
