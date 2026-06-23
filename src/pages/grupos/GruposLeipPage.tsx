import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
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
import { Plus, Edit, Trash2, Search, Users, Building } from 'lucide-react';

interface GroupLeip {
  id: string;
  name: string;
  sede_id: string | null;
  leip_program_id: string | null;
  created_at?: string;
}

interface GroupLeipWithRelations extends GroupLeip {
  sede?: { id: string; name: string } | null;
  leip_program?: { id: string; name: string } | null;
}

interface Sede {
  id: string;
  name: string;
}

interface LeipProgram {
  id: string;
  name: string;
}

interface FormData {
  name: string;
  sede_id: string;
  leip_program_id: string;
}

const ITEMS_PER_PAGE = 10;

export default function GruposLeipPage() {
  const [searchParams] = useSearchParams();
  const programIdFilter = searchParams.get('programId') || '';

  const [groups, setGroups] = useState<GroupLeipWithRelations[]>([]);
  const [sedes, setSedes] = useState<Sede[]>([]);
  const [programs, setPrograms] = useState<LeipProgram[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<GroupLeipWithRelations | null>(null);
  const [deletingGroup, setDeletingGroup] = useState<GroupLeipWithRelations | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterProgram, setFilterProgram] = useState<string>(programIdFilter || 'all');
  const [currentPage, setCurrentPage] = useState(1);

  const [formData, setFormData] = useState<FormData>({
    name: '',
    sede_id: '',
    leip_program_id: programIdFilter || '',
  });

  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});

  const currentProgramName = programs.find(p => p.id === programIdFilter)?.name;

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterProgram]);

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([loadGroups(), loadSedes(), loadPrograms()]);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Error al cargar los datos');
    } finally {
      setLoading(false);
    }
  };

  const loadGroups = async () => {
    try {
      // Solo grupos que pertenecen a algún programa LEIP
      const { data, error } = await supabase
        .from('groups')
        .select(`
          *,
          sede:sede_id (id, name),
          leip_program:leip_program_id (id, name)
        `)
        .not('leip_program_id', 'is', null)
        .order('name');

      if (error) throw error;
      setGroups((data || []) as GroupLeipWithRelations[]);
    } catch (error) {
      console.error('Error loading groups:', error);
      throw error;
    }
  };

  const loadSedes = async () => {
    try {
      const { data, error } = await supabase
        .from('sedes')
        .select('id, name')
        .order('name');

      if (error) throw error;
      setSedes(data || []);
    } catch (error) {
      console.error('Error loading sedes:', error);
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

  // Filtrado y búsqueda
  const filteredGroups = groups.filter((group) => {
    const matchesSearch =
      searchTerm === '' || group.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesProgram = filterProgram === 'all' || group.leip_program_id === filterProgram;
    return matchesSearch && matchesProgram;
  });

  // Paginación
  const totalPages = Math.ceil(filteredGroups.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedGroups = filteredGroups.slice(startIndex, endIndex);

  const openCreateModal = () => {
    setEditingGroup(null);
    setFormData({
      name: '',
      sede_id: '',
      leip_program_id: programIdFilter || '',
    });
    setErrors({});
    setIsModalOpen(true);
  };

  const openEditModal = (group: GroupLeipWithRelations) => {
    setEditingGroup(group);
    setFormData({
      name: group.name,
      sede_id: group.sede_id || '',
      leip_program_id: group.leip_program_id || '',
    });
    setErrors({});
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingGroup(null);
    setFormData({ name: '', sede_id: '', leip_program_id: programIdFilter || '' });
    setErrors({});
  };

  const validateForm = async (): Promise<boolean> => {
    const newErrors: Partial<Record<keyof FormData, string>> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'El nombre es requerido';
    }

    if (!formData.leip_program_id) {
      newErrors.leip_program_id = 'El programa LEIP es requerido';
    }

    // Validar nombre único
    if (formData.name.trim()) {
      const { data } = await supabase
        .from('groups')
        .select('id')
        .ilike('name', formData.name.trim());

      const duplicates = (data || []).filter(g => g.id !== editingGroup?.id);
      if (duplicates.length > 0) {
        newErrors.name = 'Ya existe un grupo con este nombre';
      }
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
      const groupData = {
        name: formData.name.trim(),
        sede_id: formData.sede_id || null,
        leip_program_id: formData.leip_program_id || null,
      };

      if (editingGroup) {
        const { error } = await supabase
          .from('groups')
          .update(groupData)
          .eq('id', editingGroup.id);

        if (error) throw error;
        toast.success('Grupo LEIP actualizado exitosamente');
      } else {
        const { error } = await supabase
          .from('groups')
          .insert([groupData]);

        if (error) throw error;
        toast.success('Grupo LEIP creado exitosamente');
      }

      closeModal();
      await loadGroups();
    } catch (error: any) {
      console.error('Error saving group:', error);
      toast.error(error.message || 'Error al guardar el grupo');
    } finally {
      setSubmitting(false);
    }
  };

  const openDeleteDialog = (group: GroupLeipWithRelations) => {
    setDeletingGroup(group);
    setIsDeleteDialogOpen(true);
  };

  const closeDeleteDialog = () => {
    setIsDeleteDialogOpen(false);
    setDeletingGroup(null);
  };

  const handleDelete = async () => {
    if (!deletingGroup) return;

    try {
      const { count: scheduleCount } = await supabase
        .from('leip_schedule')
        .select('*', { count: 'exact', head: true })
        .eq('group_id', deletingGroup.id);

      if (scheduleCount && scheduleCount > 0) {
        toast.error('No se puede eliminar: el grupo tiene horarios LEIP asignados');
        closeDeleteDialog();
        return;
      }

      const { error } = await supabase
        .from('groups')
        .delete()
        .eq('id', deletingGroup.id);

      if (error) throw error;

      toast.success('Grupo LEIP eliminado exitosamente');
      closeDeleteDialog();
      await loadGroups();
    } catch (error: any) {
      console.error('Error deleting group:', error);
      toast.error(error.message || 'Error al eliminar el grupo');
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
          <h1 className="text-3xl font-bold text-gray-900 dark:text-slate-100">Grupos LEIP</h1>
          <p className="text-gray-600 dark:text-slate-400 mt-1">
            {currentProgramName
              ? `Grupos del programa: ${currentProgramName}`
              : 'Gestión de grupos de programas LEIP'}
          </p>
        </div>
        <Button onClick={openCreateModal} className="gap-2">
          <Plus className="w-4 h-4" />
          Nuevo Grupo LEIP
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Grupos LEIP</CardTitle>
          <CardDescription>
            {filteredGroups.length} grupo{filteredGroups.length !== 1 ? 's' : ''}{' '}
            {searchTerm || filterProgram !== 'all' ? 'filtrado' : 'registrado'}
            {filteredGroups.length !== 1 ? 's' : ''}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filtros */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Buscar por nombre..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {!programIdFilter && (
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
            )}
          </div>

          {/* Tabla */}
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>
                    <Building className="w-4 h-4 inline mr-1" />
                    Sede
                  </TableHead>
                  <TableHead>
                    <Users className="w-4 h-4 inline mr-1" />
                    Programa LEIP
                  </TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedGroups.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-gray-500 py-8">
                      <div className="flex flex-col items-center gap-2">
                        <Users className="w-12 h-12 text-gray-400" />
                        <p>
                          {searchTerm || filterProgram !== 'all'
                            ? 'No se encontraron grupos con los filtros aplicados'
                            : 'No hay grupos LEIP registrados todavía'}
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedGroups.map((group) => (
                    <TableRow key={group.id}>
                      <TableCell className="font-medium">{group.name}</TableCell>
                      <TableCell>
                        {group.sede ? (
                          <span className="text-sm">{group.sede.name}</span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {group.leip_program ? (
                          <span className="text-sm">{group.leip_program.name}</span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditModal(group)}
                            className="gap-1"
                          >
                            <Edit className="w-4 h-4" />
                            Editar
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openDeleteDialog(group)}
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
                Mostrando {startIndex + 1} a {Math.min(endIndex, filteredGroups.length)} de{' '}
                {filteredGroups.length} resultado{filteredGroups.length !== 1 ? 's' : ''}
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
                {editingGroup ? 'Editar Grupo LEIP' : 'Nuevo Grupo LEIP'}
              </DialogTitle>
              <DialogDescription>
                {editingGroup
                  ? 'Modifica los datos del grupo'
                  : 'Completa los datos para crear un nuevo grupo LEIP'}
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              {/* Nombre */}
              <div className="grid gap-2">
                <Label htmlFor="name">
                  Nombre <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder='Ej: 1A, 1B, Grupo "C"'
                  className={errors.name ? 'border-red-500' : ''}
                />
                {errors.name && <p className="text-sm text-red-500">{errors.name}</p>}
              </div>

              {/* Programa LEIP */}
              <div className="grid gap-2">
                <Label htmlFor="leip_program_id">
                  Programa LEIP <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={formData.leip_program_id}
                  onValueChange={(value) => setFormData({ ...formData, leip_program_id: value })}
                  disabled={!!programIdFilter}
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

              {/* Sede */}
              <div className="grid gap-2">
                <Label htmlFor="sede_id">
                  Sede <span className="text-gray-400 text-xs font-normal">(opcional)</span>
                </Label>
                <Select
                  value={formData.sede_id}
                  onValueChange={(value) => setFormData({ ...formData, sede_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona la sede" />
                  </SelectTrigger>
                  <SelectContent>
                    {sedes.map((sede) => (
                      <SelectItem key={sede.id} value={sede.id}>
                        {sede.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeModal} disabled={submitting}>
                Cancelar
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Guardando...' : editingGroup ? 'Actualizar' : 'Crear Grupo'}
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
              Esta acción no se puede deshacer. Se eliminará permanentemente el grupo{' '}
              <strong>{deletingGroup?.name}</strong>.
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
}