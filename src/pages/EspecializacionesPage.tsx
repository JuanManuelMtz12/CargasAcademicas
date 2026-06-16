import React, { useEffect, useState } from 'react';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { Plus, Edit, Trash2, Eye, Search, GraduationCap } from 'lucide-react';

interface Especializacion {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export default function EspecializacionesPage() {
  const [especializaciones, setEspecializaciones] = useState<Especializacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEspecializacion, setEditingEspecializacion] = useState<Especializacion | null>(null);
  const [deleteEspecializacion, setDeleteEspecializacion] = useState<Especializacion | null>(null);
  const [formData, setFormData] = useState({ name: '' });

  useEffect(() => {
    fetchEspecializaciones();
  }, []);

  const fetchEspecializaciones = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('specializations')
        .select('*')
        .order('name');

      if (error) throw error;
      setEspecializaciones(data || []);
    } catch (error) {
      console.error('Error fetching especializaciones:', error);
      toast.error('Error al cargar las especializaciones');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error('El nombre de la especialización es requerido');
      return;
    }

    try {
      if (editingEspecializacion) {
        // Actualizar especialización existente
        const { error } = await supabase
          .from('specializations')
          .update({ name: formData.name.trim() })
          .eq('id', editingEspecializacion.id);

        if (error) throw error;
        toast.success('Especialización actualizada correctamente');
      } else {
        // Crear nueva especialización
        const { error } = await supabase
          .from('specializations')
          .insert([{ name: formData.name.trim() }]);

        if (error) throw error;
        toast.success('Especialización creada correctamente');
      }

      setIsModalOpen(false);
      setEditingEspecializacion(null);
      setFormData({ name: '' });
      fetchEspecializaciones();
    } catch (error: any) {
      console.error('Error saving especialización:', error);
      if (error.code === '23505') {
        toast.error('Ya existe una especialización con ese nombre');
      } else {
        toast.error('Error al guardar la especialización');
      }
    }
  };

  const handleEdit = (especializacion: Especializacion) => {
    setEditingEspecializacion(especializacion);
    setFormData({ name: especializacion.name });
    setIsModalOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteEspecializacion) return;

    try {
      const { error } = await supabase
        .from('specializations')
        .delete()
        .eq('id', deleteEspecializacion.id);

      if (error) throw error;
      toast.success('Especialización eliminada correctamente');
      setDeleteEspecializacion(null);
      fetchEspecializaciones();
    } catch (error) {
      console.error('Error deleting especialización:', error);
      toast.error('Error al eliminar la especialización');
    }
  };

  const filteredEspecializaciones = especializaciones.filter((esp) =>
    esp.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Especializaciones
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Gestiona las especializaciones académicas del sistema
          </p>
        </div>
        <Button
          onClick={() => {
            setEditingEspecializacion(null);
            setFormData({ name: '' });
            setIsModalOpen(true);
          }}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          Nueva Especialización
        </Button>
      </div>

      {/* Stats Card */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center space-x-4">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
              <GraduationCap className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Total de Especializaciones
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {especializaciones.length}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
        <Input
          placeholder="Buscar especializaciones..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Fecha de Creación</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEspecializaciones.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center py-8 text-gray-500">
                    {searchTerm ? 'No se encontraron especializaciones' : 'No hay especializaciones registradas'}
                  </TableCell>
                </TableRow>
              ) : (
                filteredEspecializaciones.map((especializacion) => (
                  <TableRow key={especializacion.id}>
                    <TableCell className="font-medium">
                      {especializacion.name}
                    </TableCell>
                    <TableCell>
                      {new Date(especializacion.created_at).toLocaleDateString('es-MX')}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(especializacion)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteEspecializacion(especializacion)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">
              {editingEspecializacion ? 'Editar Especialización' : 'Nueva Especialización'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Nombre de la Especialización
                </label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ej: Maestría en Educación"
                  required
                />
              </div>
              <div className="flex space-x-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsModalOpen(false);
                    setEditingEspecializacion(null);
                    setFormData({ name: '' });
                  }}
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button type="submit" className="flex-1">
                  {editingEspecializacion ? 'Actualizar' : 'Crear'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {deleteEspecializacion && (
        <AlertDialog open={!!deleteEspecializacion} onOpenChange={() => setDeleteEspecializacion(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar Especialización?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta acción no se puede deshacer. ¿Estás seguro de que quieres eliminar la especialización "{deleteEspecializacion.name}"?
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
      )}
    </div>
  );
}
