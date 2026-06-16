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
import { Plus, Edit, Trash2, Search } from 'lucide-react';

type Category = Database['public']['Tables']['categories']['Row'];
type CategoryInsert = Database['public']['Tables']['categories']['Insert'];

interface FormData {
  category: 'BASE' | 'INVITADO';
  subcategory: 'TC' | 'MT' | 'PA' | null;
  max_hours_week: number;
}

export default function CategoriasPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<Category | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    category: 'BASE',
    subcategory: null,
    max_hours_week: 18,
  });
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});

  const itemsPerPage = 5;

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('category', { ascending: true })
        .order('subcategory', { ascending: true });

      if (error) throw error;
      setCategories(data || []);
    } catch (error: any) {
      console.error('Error loading categories:', error);
      toast.error('Error al cargar las categorías');
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setEditingCategory(null);
    setFormData({
      category: 'BASE',
      subcategory: null,
      max_hours_week: 18,
    });
    setErrors({});
    setIsModalOpen(true);
  };

  const openEditModal = (category: Category) => {
    setEditingCategory(category);
    setFormData({
      category: category.category as 'BASE' | 'INVITADO',
      subcategory: category.subcategory as 'TC' | 'MT' | 'PA' | null,
      max_hours_week: category.max_hours_week,
    });
    setErrors({});
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingCategory(null);
    setFormData({
      category: 'BASE',
      subcategory: null,
      max_hours_week: 18,
    });
    setErrors({});
  };

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof FormData, string>> = {};

    if (!formData.category) {
      newErrors.category = 'La categoría es requerida';
    }

    if (formData.max_hours_week < 7 || formData.max_hours_week > 30) {
      newErrors.max_hours_week = 'Las horas deben estar entre 7 y 30';
    }

    // Si la categoría es INVITADO, subcategory debe ser null
    if (formData.category === 'INVITADO' && formData.subcategory !== null) {
      newErrors.subcategory = 'La categoría INVITADO no debe tener subcategoría';
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
      const categoryData: CategoryInsert = {
        category: formData.category,
        subcategory: formData.category === 'INVITADO' ? null : formData.subcategory,
        max_hours_week: formData.max_hours_week,
      };

      if (editingCategory) {
        // Actualizar
        const { error } = await supabase
          .from('categories')
          .update(categoryData)
          .eq('id', editingCategory.id);

        if (error) throw error;
        toast.success('Categoría actualizada correctamente');
      } else {
        // Crear
        const { error } = await supabase
          .from('categories')
          .insert([categoryData]);

        if (error) throw error;
        toast.success('Categoría creada correctamente');
      }

      closeModal();
      await loadData();
    } catch (error: any) {
      console.error('Error saving category:', error);
      
      if (error.code === '23505') {
        toast.error('Ya existe una categoría con estos valores');
      } else {
        toast.error('Error al guardar la categoría');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const openDeleteDialog = (category: Category) => {
    setDeletingCategory(category);
    setIsDeleteDialogOpen(true);
  };

  const closeDeleteDialog = () => {
    setIsDeleteDialogOpen(false);
    setDeletingCategory(null);
  };

  const handleDelete = async () => {
    if (!deletingCategory) return;

    try {
      // Verificar si hay maestros asociados
      const { count } = await supabase
        .from('teachers')
        .select('*', { count: 'exact', head: true })
        .eq('category_id', deletingCategory.id);

      if (count && count > 0) {
        toast.error('No se puede eliminar: hay maestros asociados a esta categoría');
        closeDeleteDialog();
        return;
      }

      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', deletingCategory.id);

      if (error) throw error;

      toast.success('Categoría eliminada correctamente');
      closeDeleteDialog();
      await loadData();
    } catch (error: any) {
      console.error('Error deleting category:', error);
      toast.error('Error al eliminar la categoría');
    }
  };

  const handleCategoryChange = (value: string) => {
    const newCategory = value as 'BASE' | 'INVITADO';
    setFormData({
      ...formData,
      category: newCategory,
      subcategory: newCategory === 'INVITADO' ? null : formData.subcategory,
    });
  };

  // Filtrar categorías por búsqueda
  const filteredCategories = categories.filter((category) =>
    category.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (category.subcategory && category.subcategory.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Paginación
  const totalPages = Math.ceil(filteredCategories.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentCategories = filteredCategories.slice(startIndex, endIndex);

  // Resetear a página 1 cuando cambia la búsqueda
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const getCategoryBadgeColor = (category: string) => {
    switch (category) {
      case 'BASE':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
      case 'INVITADO':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300';
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
          <h1 className="text-3xl font-bold text-gray-900 dark:text-slate-100">Categorías de Maestros</h1>
          <p className="text-gray-600 dark:text-slate-400 mt-1">
            Gestión de categorías y subcategorías docentes
          </p>
        </div>
        <Button onClick={openCreateModal} className="gap-2">
          <Plus className="w-4 h-4" />
          Nueva Categoría
        </Button>
      </div>

      {/* Search */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-slate-500 w-5 h-5" />
          <Input
            type="text"
            placeholder="Buscar por categoría o subcategoría..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="text-sm text-gray-600 dark:text-slate-400">
          Total: {filteredCategories.length} categoría{filteredCategories.length !== 1 ? 's' : ''}
        </div>
      </div>

      <Card className="dark:bg-slate-800 dark:border-slate-700">
        <CardHeader>
          <CardTitle>Lista de Categorías</CardTitle>
          <CardDescription>
            {categories.length} categoría{categories.length !== 1 ? 's' : ''} registrada{categories.length !== 1 ? 's' : ''}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Categoría</TableHead>
                  <TableHead>Subcategoría</TableHead>
                  <TableHead>Horas Máx/Semana</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentCategories.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-gray-500 py-8">
                      {searchTerm ? 'No se encontraron categorías' : 'No hay categorías registradas'}
                    </TableCell>
                  </TableRow>
                ) : (
                  currentCategories.map((category) => (
                    <TableRow key={category.id}>
                      <TableCell>
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-semibold ${getCategoryBadgeColor(
                            category.category
                          )}`}
                        >
                          {category.category}
                        </span>
                      </TableCell>
                      <TableCell>
                        {category.subcategory ? (
                          <span className="text-sm font-medium">{category.subcategory}</span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{category.max_hours_week}h</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditModal(category)}
                            className="gap-1"
                          >
                            <Edit className="w-4 h-4" />
                            Editar
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openDeleteDialog(category)}
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
                Mostrando {startIndex + 1} a {Math.min(endIndex, filteredCategories.length)} de{' '}
                {filteredCategories.length} resultados
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
                {editingCategory ? 'Editar Categoría' : 'Nueva Categoría'}
              </DialogTitle>
              <DialogDescription>
                {editingCategory
                  ? 'Modifica los datos de la categoría'
                  : 'Completa los datos para crear una nueva categoría'}
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              {/* Categoría */}
              <div className="grid gap-2">
                <Label htmlFor="category">
                  Categoría <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={formData.category}
                  onValueChange={handleCategoryChange}
                >
                  <SelectTrigger className={errors.category ? 'border-red-500' : ''}>
                    <SelectValue placeholder="Selecciona la categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BASE">BASE</SelectItem>
                    <SelectItem value="INVITADO">INVITADO</SelectItem>
                  </SelectContent>
                </Select>
                {errors.category && (
                  <p className="text-sm text-red-500">{errors.category}</p>
                )}
              </div>

              {/* Subcategoría */}
              <div className="grid gap-2">
                <Label htmlFor="subcategory">
                  Subcategoría {formData.category !== 'INVITADO' && '(opcional)'}
                </Label>
                <Select
                  value={formData.subcategory || 'none'}
                  onValueChange={(value) =>
                    setFormData({
                      ...formData,
                      subcategory: value === 'none' ? null : (value as 'TC' | 'MT' | 'PA'),
                    })
                  }
                  disabled={formData.category === 'INVITADO'}
                >
                  <SelectTrigger className={errors.subcategory ? 'border-red-500' : ''}>
                    <SelectValue placeholder="Selecciona la subcategoría" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin subcategoría</SelectItem>
                    <SelectItem value="TC">TC (Tiempo Completo)</SelectItem>
                    <SelectItem value="MT">MT (Medio Tiempo)</SelectItem>
                    <SelectItem value="PA">PA (Por Asignatura)</SelectItem>
                  </SelectContent>
                </Select>
                {errors.subcategory && (
                  <p className="text-sm text-red-500">{errors.subcategory}</p>
                )}
                {formData.category === 'INVITADO' && (
                  <p className="text-xs text-gray-500 dark:text-slate-400">
                    La categoría INVITADO no puede tener subcategoría
                  </p>
                )}
              </div>

              {/* Horas Máximas por Semana */}
              <div className="grid gap-2">
                <Label htmlFor="max_hours_week">
                  Horas Máximas por Semana <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="max_hours_week"
                  type="number"
                  min="7"
                  max="30"
                  value={formData.max_hours_week}
                  onChange={(e) =>
                    setFormData({ ...formData, max_hours_week: parseInt(e.target.value) })
                  }
                  className={errors.max_hours_week ? 'border-red-500' : ''}
                />
                {errors.max_hours_week && (
                  <p className="text-sm text-red-500">{errors.max_hours_week}</p>
                )}
                <p className="text-xs text-gray-500 dark:text-slate-400">
                  Debe estar entre 7 y 30 horas
                </p>
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
                  : editingCategory
                  ? 'Actualizar'
                  : 'Crear Categoría'}
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
              Esta acción no se puede deshacer. Se eliminará permanentemente la categoría{' '}
              <strong>
                {deletingCategory?.category}
                {deletingCategory?.subcategory && ` ${deletingCategory.subcategory}`}
              </strong>.
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
