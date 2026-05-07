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
import { Plus, Edit, Trash2, Search, BookOpen } from 'lucide-react';

interface LeipSubject {
  id: string;
  leip_program_id: string;
  name: string;
  module_name: string | null;
  leip_module_id: string | null;
  created_at?: string;
}

interface LeipSubjectWithProgram extends LeipSubject {
  program?: {
    id: string;
    name: string;
  } | null;
  module?: {
    id: string;
    name: string;
  } | null;
}

interface LeipProgram {
  id: string;
  name: string;
}

interface LeipModule {
  id: string;
  name: string;
  leip_program_id: string;
}

interface FormData {
  leip_program_id: string;
  name: string;
  leip_module_id: string;
}

const ITEMS_PER_PAGE = 10;

export default function MateriasLeipPage() {
  const [subjects, setSubjects] = useState<LeipSubjectWithProgram[]>([]);
  const [programs, setPrograms] = useState<LeipProgram[]>([]);
  const [modules, setModules] = useState<LeipModule[]>([]);
  const [filteredModules, setFilteredModules] = useState<LeipModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<LeipSubjectWithProgram | null>(null);
  const [deletingSubject, setDeletingSubject] = useState<LeipSubjectWithProgram | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Filtros y búsqueda
  const [searchTerm, setSearchTerm] = useState('');
  const [filterProgram, setFilterProgram] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);

  const [formData, setFormData] = useState<FormData>({
    leip_program_id: '',
    name: '',
    leip_module_id: '',
  });

  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});

  useEffect(() => {
    loadData();
  }, []);

  // Resetear página al cambiar filtros
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterProgram]);

  // Filtrar módulos cuando cambia el programa seleccionado en el formulario
  useEffect(() => {
    if (formData.leip_program_id) {
      const filtered = modules.filter(m => m.leip_program_id === formData.leip_program_id);
      setFilteredModules(filtered);
    } else {
      setFilteredModules([]);
    }
  }, [formData.leip_program_id, modules]);

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([loadSubjects(), loadPrograms(), loadModules()]);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Error al cargar los datos');
    } finally {
      setLoading(false);
    }
  };

  const loadSubjects = async () => {
    try {
      const { data, error } = await supabase
        .from('leip_subjects')
        .select(`
          *,
          program:leip_program_id (
            id,
            name
          ),
          module:leip_module_id (
            id,
            name
          )
        `)
        .order('name');

      if (error) throw error;
      setSubjects(data || []);
    } catch (error) {
      console.error('Error loading subjects:', error);
      throw error;
    }
  };

  const loadPrograms = async () => {
    try {
      const { data, error } = await supabase
        .from('leip_programs')
        .select('id, name')
        .order('name');

      if (error) throw error;
      setPrograms(data || []);
    } catch (error) {
      console.error('Error loading programs:', error);
      throw error;
    }
  };

  const loadModules = async () => {
    try {
      const { data, error } = await supabase
        .from('leip_modules')
        .select('*')
        .order('name');

      if (error) throw error;
      setModules(data || []);
    } catch (error) {
      console.error('Error loading modules:', error);
      throw error;
    }
  };

  // Filtrado y búsqueda
  const filteredSubjects = subjects.filter((subject) => {
    const matchesSearch =
      searchTerm === '' ||
      subject.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (subject.module_name && subject.module_name.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesProgram =
      filterProgram === 'all' || subject.leip_program_id === filterProgram;

    return matchesSearch && matchesProgram;
  });

  // Paginación
  const totalPages = Math.ceil(filteredSubjects.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedSubjects = filteredSubjects.slice(startIndex, endIndex);

  const openCreateModal = () => {
    setEditingSubject(null);
    setFormData({
      leip_program_id: '',
      name: '',
      leip_module_id: '',
    });
    setErrors({});
    setIsModalOpen(true);
  };

  const openEditModal = (subject: LeipSubjectWithProgram) => {
    setEditingSubject(subject);
    setFormData({
      leip_program_id: subject.leip_program_id,
      name: subject.name,
      leip_module_id: subject.leip_module_id || '',
    });
    setErrors({});
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingSubject(null);
    setFormData({
      leip_program_id: '',
      name: '',
      leip_module_id: '',
    });
    setErrors({});
  };

  const validateForm = async (): Promise<boolean> => {
    const newErrors: Partial<Record<keyof FormData, string>> = {};

    if (!formData.leip_program_id) {
      newErrors.leip_program_id = 'El programa es requerido';
    }

    if (!formData.name.trim()) {
      newErrors.name = 'El nombre es requerido';
    }

    if (!formData.leip_module_id) {
      newErrors.leip_module_id = 'El módulo es requerido';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const isValid = await validateForm();
    if (!isValid) {
      toast.error('Por favor corrija los errores en el formulario');
      return;
    }

    setSubmitting(true);

    try {
      // Obtener el nombre del módulo seleccionado
      const selectedModule = modules.find(m => m.id === formData.leip_module_id);
      
      const subjectData = {
        leip_program_id: formData.leip_program_id,
        name: formData.name.trim(),
        leip_module_id: formData.leip_module_id || null,
        module_name: selectedModule?.name || null,
      };

      if (editingSubject) {
        // Actualizar
        const { error } = await supabase
          .from('leip_subjects')
          .update(subjectData)
          .eq('id', editingSubject.id);

        if (error) throw error;
        toast.success('Módulo LEIP actualizado exitosamente');
      } else {
        // Crear
        const { error } = await supabase
          .from('leip_subjects')
          .insert([subjectData]);

        if (error) throw error;
        toast.success('Módulo LEIP creado exitosamente');
      }

      closeModal();
      await loadSubjects();
    } catch (error: any) {
      console.error('Error saving subject:', error);
      toast.error(error.message || 'Error al guardar el módulo');
    } finally {
      setSubmitting(false);
    }
  };

  const openDeleteDialog = (subject: LeipSubjectWithProgram) => {
    setDeletingSubject(subject);
    setIsDeleteDialogOpen(true);
  };

  const closeDeleteDialog = () => {
    setIsDeleteDialogOpen(false);
    setDeletingSubject(null);
  };

  const handleDelete = async () => {
    if (!deletingSubject) return;

    try {
      // Verificar si hay horarios asociados
      const { count: schedulesCount } = await supabase
        .from('leip_schedule')
        .select('*', { count: 'exact', head: true })
        .eq('leip_subject_id', deletingSubject.id);

      if (schedulesCount && schedulesCount > 0) {
        toast.error('No se puede eliminar el módulo porque tiene horarios asociados');
        closeDeleteDialog();
        return;
      }

      const { error } = await supabase
        .from('leip_subjects')
        .delete()
        .eq('id', deletingSubject.id);

      if (error) throw error;

      toast.success('Módulo LEIP eliminado exitosamente');
      closeDeleteDialog();
      await loadSubjects();
    } catch (error: any) {
      console.error('Error deleting subject:', error);
      toast.error(error.message || 'Error al eliminar el módulo');
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
          <h1 className="text-3xl font-bold text-gray-900 dark:text-slate-100">Módulos LEIP</h1>
          <p className="text-gray-600 dark:text-slate-400 mt-1">
            Gestión de módulos para programas LEIP
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={openCreateModal} className="gap-2">
            <Plus className="w-4 h-4" />
            Nuevo Módulo
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Módulos LEIP</CardTitle>
          <CardDescription>
            {filteredSubjects.length} módulo{filteredSubjects.length !== 1 ? 's' : ''}{' '}
            {searchTerm || filterProgram !== 'all' ? 'filtrado' : 'registrado'}
            {filteredSubjects.length !== 1 ? 's' : ''}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filtros */}
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Búsqueda */}
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Buscar por nombre o módulo..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Filtro por programa */}
            <div className="sm:w-64">
              <Select value={filterProgram} onValueChange={setFilterProgram}>
                <SelectTrigger>
                  <SelectValue placeholder="Filtrar por programa" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los programas</SelectItem>
                  {programs.map((program) => (
                    <SelectItem key={program.id} value={program.id}>
                      {program.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Tabla */}
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Módulo</TableHead>
                  <TableHead>Programa</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedSubjects.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-gray-500 py-8">
                      <div className="flex flex-col items-center gap-2">
                        <BookOpen className="w-12 h-12 text-gray-400" />
                        <p>
                          {searchTerm || filterProgram !== 'all'
                            ? 'No se encontraron módulos con los filtros aplicados'
                            : 'No hay módulos LEIP registrados'}
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedSubjects.map((subject) => (
                    <TableRow key={subject.id}>
                      <TableCell className="font-medium">{subject.name}</TableCell>
                      <TableCell>
                        {subject.module_name ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            {subject.module_name}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {subject.program ? (
                          <span className="text-sm">{subject.program.name}</span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditModal(subject)}
                            className="gap-1"
                          >
                            <Edit className="w-4 h-4" />
                            Editar
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openDeleteDialog(subject)}
                            className="gap-1 text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                            Eliminar
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Paginación */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4">
              <div className="text-sm text-gray-600 dark:text-slate-400">
                Mostrando {startIndex + 1} a {Math.min(endIndex, filteredSubjects.length)} de{' '}
                {filteredSubjects.length} resultado{filteredSubjects.length !== 1 ? 's' : ''}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                >
                  Anterior
                </Button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <Button
                      key={page}
                      variant={currentPage === page ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setCurrentPage(page)}
                      className="w-10"
                    >
                      {page}
                    </Button>
                  ))}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                >
                  Siguiente
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de Creación/Edición */}
      <Dialog open={isModalOpen} onOpenChange={closeModal}>
        <DialogContent className="sm:max-w-[500px]">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>
                {editingSubject ? 'Editar Módulo LEIP' : 'Nuevo Módulo LEIP'}
              </DialogTitle>
              <DialogDescription>
                {editingSubject
                  ? 'Modifica los datos del módulo'
                  : 'Completa los datos para crear un nuevo módulo LEIP'}
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              {/* Programa */}
              <div className="grid gap-2">
                <Label htmlFor="leip_program_id">
                  Programa <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={formData.leip_program_id}
                  onValueChange={(value) =>
                    setFormData({ ...formData, leip_program_id: value, leip_module_id: '' })
                  }
                >
                  <SelectTrigger className={errors.leip_program_id ? 'border-red-500' : ''}>
                    <SelectValue placeholder="Selecciona el programa" />
                  </SelectTrigger>
                  <SelectContent>
                    {programs.map((program) => (
                      <SelectItem key={program.id} value={program.id}>
                        {program.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.leip_program_id && (
                  <p className="text-sm text-red-500">{errors.leip_program_id}</p>
                )}
              </div>

              {/* Módulo */}
              <div className="grid gap-2">
                <Label htmlFor="leip_module_id">
                  Módulo <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={formData.leip_module_id || 'no-modules'}
                  onValueChange={(value) =>
                    setFormData({ ...formData, leip_module_id: value === 'no-modules' ? '' : value })
                  }
                  disabled={!formData.leip_program_id}
                >
                  <SelectTrigger className={errors.leip_module_id ? 'border-red-500' : ''}>
                    <SelectValue placeholder={formData.leip_program_id ? "Selecciona el módulo" : "Primero selecciona un programa"} />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredModules.length === 0 ? (
                      <SelectItem value="no-modules" disabled>
                        No hay módulos disponibles para este programa
                      </SelectItem>
                    ) : (
                      filteredModules.map((module) => (
                        <SelectItem key={module.id} value={module.id}>
                          {module.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                {errors.leip_module_id && (
                  <p className="text-sm text-red-500">{errors.leip_module_id}</p>
                )}
              </div>

              {/* Nombre */}
              <div className="grid gap-2">
                <Label htmlFor="name">
                  Nombre <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="Ej: Desarrollo Infantil"
                  className={errors.name ? 'border-red-500' : ''}
                />
                {errors.name && (
                  <p className="text-sm text-red-500">{errors.name}</p>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={closeModal}
                disabled={submitting}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting
                  ? 'Guardando...'
                  : editingSubject
                  ? 'Actualizar'
                  : 'Crear Módulo'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Diálogo de Confirmación de Eliminación */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={closeDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará permanentemente el módulo{' '}
              <strong>{deletingSubject?.name}</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
