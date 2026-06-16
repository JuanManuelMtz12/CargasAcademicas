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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plus, Edit, Trash2, Search } from 'lucide-react';

type Sede = Database['public']['Tables']['sedes']['Row'];
type SedeInsert = Database['public']['Tables']['sedes']['Insert'];

interface SedeWithCounts extends Sede {
  programs_count: number;
}

interface FormData {
  name: string;
}

export default function SedesPage() {
  const [sedes, setSedes] = useState<SedeWithCounts[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingSede, setEditingSede] = useState<SedeWithCounts | null>(null);
  const [deletingSede, setDeletingSede] = useState<SedeWithCounts | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    name: '',
  });
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});

  const itemsPerPage = 10;

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Obtener todas las sedes
      const { data: sedesData, error: sedesError } = await supabase
        .from('sedes')
        .select('*')
        .order('name', { ascending: true });

      if (sedesError) throw sedesError;

      // Obtener conteos de programas para cada sede
      const sedesWithCounts = await Promise.all(
        (sedesData || []).map(async (sede) => {
          const { count: programsCount } = await supabase
            .from('programs')
            .select('*', { count: 'exact', head: true })
            .eq('sede_id', sede.id);

          return {
            ...sede,
            programs_count: programsCount || 0,
          };
        })
      );

      setSedes(sedesWithCounts);
    } catch (error: any) {
      console.error('Error loading sedes:', error);
      toast.error('Error al cargar las sedes');
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setEditingSede(null);
    setFormData({ name: '' });
    setErrors({});
    setIsModalOpen(true);
  };

  const openEditModal = (sede: SedeWithCounts) => {
    setEditingSede(sede);
    setFormData({ name: sede.name });
    setErrors({});
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingSede(null);
    setFormData({ name: '' });
    setErrors({});
  };

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof FormData, string>> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'El nombre es requerido';
    }

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
      const sedeData: SedeInsert = {
        name: formData.name.trim(),
      };

      if (editingSede) {
        // Actualizar
        const { error } = await supabase
          .from('sedes')
          .update(sedeData)
          .eq('id', editingSede.id);

        if (error) throw error;
        toast.success('Sede actualizada correctamente');
      } else {
        // Crear
        const { error } = await supabase
          .from('sedes')
          .insert([sedeData]);

        if (error) throw error;
        toast.success('Sede creada correctamente');
      }

      closeModal();
      await loadData();
    } catch (error: any) {
      console.error('Error saving sede:', error);
      
      if (error.code === '23505') {
        toast.error('Ya existe una sede con este nombre');
      } else {
        toast.error('Error al guardar la sede');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const openDeleteDialog = (sede: SedeWithCounts) => {
    setDeletingSede(sede);
    setIsDeleteDialogOpen(true);
  };

  const closeDeleteDialog = () => {
    setIsDeleteDialogOpen(false);
    setDeletingSede(null);
  };

  const handleDelete = async () => {
    if (!deletingSede) return;

    try {
      // Verificar si hay programas asociados
      const { count } = await supabase
        .from('programs')
        .select('*', { count: 'exact', head: true })
        .eq('sede_id', deletingSede.id);

      if (count && count > 0) {
        toast.error('No se puede eliminar: hay programas asociados a esta sede');
        closeDeleteDialog();
        return;
      }

      const { error } = await supabase
        .from('sedes')
        .delete()
        .eq('id', deletingSede.id);

      if (error) throw error;

      toast.success('Sede eliminada correctamente');
      closeDeleteDialog();
      await loadData();
    } catch (error: any) {
      console.error('Error deleting sede:', error);
      toast.error('Error al eliminar la sede');
    }
  };

  // Filtrar sedes por búsqueda
  const filteredSedes = sedes.filter((sede) =>
    sede.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Paginación
  const totalPages = Math.ceil(filteredSedes.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentSedes = filteredSedes.slice(startIndex, endIndex);

  // Resetear a página 1 cuando cambia la búsqueda
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
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
          <h1 className="text-3xl font-bold text-gray-900 dark:text-slate-100">Sedes UPN</h1>
          <p className="text-gray-600 dark:text-slate-400 mt-1">
            Gestión de sedes y campus universitarios
          </p>
        </div>
        <Button onClick={openCreateModal} className="gap-2">
          <Plus className="w-4 h-4" />
          Nueva Sede
        </Button>
      </div>

      {/* Search */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-slate-500 w-5 h-5" />
          <Input
            type="text"
            placeholder="Buscar por nombre..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="text-sm text-gray-600 dark:text-slate-400">
          Total: {filteredSedes.length} sede{filteredSedes.length !== 1 ? 's' : ''}
        </div>
      </div>

      <Card className="dark:bg-slate-800 dark:border-slate-700">
        <CardHeader>
          <CardTitle>Lista de Sedes</CardTitle>
          <CardDescription>
            {sedes.length} sede{sedes.length !== 1 ? 's' : ''} registrada{sedes.length !== 1 ? 's' : ''}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Fecha de Creación</TableHead>
                  <TableHead className="text-center">Programas Asociados</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentSedes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-gray-500 py-8">
                      {searchTerm ? 'No se encontraron sedes' : 'No hay sedes registradas'}
                    </TableCell>
                  </TableRow>
                ) : (
                  currentSedes.map((sede) => (
                    <TableRow key={sede.id}>
                      <TableCell className="font-medium">{sede.name}</TableCell>
                      <TableCell className="text-sm text-gray-600 dark:text-slate-400">
                        {formatDate(sede.created_at)}
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 text-sm font-semibold">
                          {sede.programs_count}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditModal(sede)}
                            className="gap-1"
                          >
                            <Edit className="w-4 h-4" />
                            Editar
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openDeleteDialog(sede)}
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

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <div className="text-sm text-gray-600 dark:text-slate-400">
                Mostrando {startIndex + 1} a {Math.min(endIndex, filteredSedes.length)} de{' '}
                {filteredSedes.length} resultados
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
                      className="w-8"
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
                {editingSede ? 'Editar Sede' : 'Nueva Sede'}
              </DialogTitle>
              <DialogDescription>
                {editingSede
                  ? 'Modifica los datos de la sede'
                  : 'Completa los datos para crear una nueva sede'}
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              {/* Nombre */}
              <div className="grid gap-2">
                <Label htmlFor="name">
                  Nombre de la Sede <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="Ej: Hueyapan, Victoria, Ayotoxco"
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
                  : editingSede
                  ? 'Actualizar'
                  : 'Crear Sede'}
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
              Esta acción no se puede deshacer. Se eliminará permanentemente la sede{' '}
              <strong>{deletingSede?.name}</strong>.
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
