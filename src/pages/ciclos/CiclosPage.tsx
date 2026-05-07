import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Calendar, Edit2, Plus, Power, PowerOff, Trash2 } from 'lucide-react';

// Tipos
interface SchoolCycle {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  cycle_type: 'LIC' | 'LEIP' | 'MAE-MS' | 'MAE-B';
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

interface CycleFormData {
  name: string;
  start_date: string;
  end_date: string;
  cycle_type: 'LIC' | 'LEIP' | 'MAE-MS' | 'MAE-B';
}

const CYCLE_TYPES = [
  { value: 'LIC', label: 'Licenciatura' },
  { value: 'LEIP', label: 'LEIP' },
  { value: 'MAE-MS', label: 'Maestría - Modalidad Sabatina' },
  { value: 'MAE-B', label: 'Maestría - Modalidad Bimestral' },
] as const;

export default function CiclosPage() {
  const [cycles, setCycles] = useState<SchoolCycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCycle, setEditingCycle] = useState<SchoolCycle | null>(null);
  const [formData, setFormData] = useState<CycleFormData>({
    name: '',
    start_date: '',
    end_date: '',
    cycle_type: 'LIC',
  });
  const [submitting, setSubmitting] = useState(false);

  // Cargar ciclos escolares
  const loadCycles = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('school_cycles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCycles(data || []);
    } catch (error: any) {
      toast.error('Error al cargar ciclos escolares: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCycles();
  }, []);

  // Abrir modal para crear
  const handleCreate = () => {
    setEditingCycle(null);
    setFormData({
      name: '',
      start_date: '',
      end_date: '',
      cycle_type: 'LIC',
    });
    setIsDialogOpen(true);
  };

  // Convertir fecha de DB a formato de input (evita desfase de zona horaria)
  const dateToInputFormat = (dateString: string): string => {
    // Tomar solo la parte de la fecha (YYYY-MM-DD) sin conversión de zona horaria
    return dateString.split('T')[0];
  };

  // Abrir modal para editar
  const handleEdit = (cycle: SchoolCycle) => {
    setEditingCycle(cycle);
    setFormData({
      name: cycle.name,
      start_date: dateToInputFormat(cycle.start_date),
      end_date: dateToInputFormat(cycle.end_date),
      cycle_type: cycle.cycle_type,
    });
    setIsDialogOpen(true);
  };

  // Validar formulario
  const validateForm = (): boolean => {
    if (!formData.name.trim()) {
      toast.error('El nombre del ciclo es requerido');
      return false;
    }

    if (!formData.start_date) {
      toast.error('La fecha de inicio es requerida');
      return false;
    }

    if (!formData.end_date) {
      toast.error('La fecha de fin es requerida');
      return false;
    }

    // Comparar fechas sin conversión de zona horaria
    const startDate = new Date(formData.start_date + 'T00:00:00');
    const endDate = new Date(formData.end_date + 'T00:00:00');
    
    if (startDate >= endDate) {
      toast.error('La fecha de inicio debe ser anterior a la fecha de fin');
      return false;
    }

    return true;
  };

  // Guardar ciclo (crear o editar)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    try {
      setSubmitting(true);

      if (editingCycle) {
        // Actualizar ciclo existente
        const { error } = await supabase
          .from('school_cycles')
          .update({
            name: formData.name,
            start_date: formData.start_date,
            end_date: formData.end_date,
            cycle_type: formData.cycle_type,
          })
          .eq('id', editingCycle.id);

        if (error) throw error;
        toast.success('Ciclo escolar actualizado correctamente');
      } else {
        // Crear nuevo ciclo
        const { error } = await supabase.from('school_cycles').insert({
          name: formData.name,
          start_date: formData.start_date,
          end_date: formData.end_date,
          cycle_type: formData.cycle_type,
          is_active: false,
        });

        if (error) throw error;
        toast.success('Ciclo escolar creado correctamente');
      }

      setIsDialogOpen(false);
      loadCycles();
    } catch (error: any) {
      toast.error('Error al guardar: ' + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Activar/Desactivar ciclo
  const handleToggleActive = async (cycle: SchoolCycle) => {
    try {
      // Si se va a activar, validar que no haya otro activo del mismo tipo
      if (!cycle.is_active) {
        const activeCycleOfType = cycles.find(
          (c) => c.cycle_type === cycle.cycle_type && c.is_active && c.id !== cycle.id
        );

        if (activeCycleOfType) {
          toast.error(
            `Ya existe un ciclo activo para ${getCycleTypeLabel(cycle.cycle_type)}. Desactívalo primero.`
          );
          return;
        }
      }

      const { error } = await supabase
        .from('school_cycles')
        .update({
          is_active: !cycle.is_active,
        })
        .eq('id', cycle.id);

      if (error) throw error;

      toast.success(
        cycle.is_active ? 'Ciclo desactivado correctamente' : 'Ciclo activado correctamente'
      );
      loadCycles();
    } catch (error: any) {
      toast.error('Error al cambiar estado: ' + error.message);
    }
  };

  // Eliminar ciclo
  const handleDelete = async (cycle: SchoolCycle) => {
    if (!confirm(`¿Estás seguro de eliminar el ciclo "${cycle.name}"?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('school_cycles')
        .delete()
        .eq('id', cycle.id);

      if (error) throw error;

      toast.success('Ciclo escolar eliminado correctamente');
      loadCycles();
    } catch (error: any) {
      toast.error('Error al eliminar: ' + error.message);
    }
  };

  // Obtener etiqueta del tipo de ciclo
  const getCycleTypeLabel = (type: string): string => {
    const cycleType = CYCLE_TYPES.find((t) => t.value === type);
    return cycleType ? cycleType.label : type;
  };

  // Formatear fecha (evita desfase de zona horaria)
  const formatDate = (dateString: string): string => {
    // Tomar solo la parte de fecha y parsear manualmente
    const datePart = dateString.split('T')[0];
    const [year, month, day] = datePart.split('-').map(Number);
    
    // Crear fecha en zona horaria local de México
    const date = new Date(year, month - 1, day);
    
    return date.toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'America/Mexico_City',
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-orange-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-100 rounded-lg">
                <Calendar className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">Ciclos Escolares</h1>
                <p className="text-gray-600">Gestión de períodos académicos</p>
              </div>
            </div>
            <Button
              onClick={handleCreate}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              Nuevo Ciclo
            </Button>
          </div>
        </div>

        {/* Tabla */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          {loading ? (
            <div className="p-12 text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-600 border-t-transparent"></div>
              <p className="mt-4 text-gray-600">Cargando ciclos escolares...</p>
            </div>
          ) : cycles.length === 0 ? (
            <div className="p-12 text-center">
              <Calendar className="w-16 h-16 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                No hay ciclos escolares
              </h3>
              <p className="text-gray-600 mb-6">
                Crea tu primer ciclo escolar para comenzar
              </p>
              <Button
                onClick={handleCreate}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Plus className="w-4 h-4 mr-2" />
                Crear Ciclo
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-bold">Nombre</TableHead>
                  <TableHead className="font-bold">Fecha Inicio</TableHead>
                  <TableHead className="font-bold">Fecha Fin</TableHead>
                  <TableHead className="font-bold">Tipo</TableHead>
                  <TableHead className="font-bold">Estado</TableHead>
                  <TableHead className="font-bold text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cycles.map((cycle) => (
                  <TableRow key={cycle.id}>
                    <TableCell className="font-medium">{cycle.name}</TableCell>
                    <TableCell>{formatDate(cycle.start_date)}</TableCell>
                    <TableCell>{formatDate(cycle.end_date)}</TableCell>
                    <TableCell>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {getCycleTypeLabel(cycle.cycle_type)}
                      </span>
                    </TableCell>
                    <TableCell>
                      {cycle.is_active ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Activo
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          Inactivo
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleToggleActive(cycle)}
                          title={cycle.is_active ? 'Desactivar' : 'Activar'}
                        >
                          {cycle.is_active ? (
                            <PowerOff className="w-4 h-4 text-red-600" />
                          ) : (
                            <Power className="w-4 h-4 text-green-600" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(cycle)}
                          title="Editar"
                        >
                          <Edit2 className="w-4 h-4 text-blue-600" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(cycle)}
                          title="Eliminar"
                        >
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      {/* Modal de Creación/Edición */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {editingCycle ? 'Editar Ciclo Escolar' : 'Nuevo Ciclo Escolar'}
            </DialogTitle>
            <DialogDescription>
              {editingCycle
                ? 'Modifica los datos del ciclo escolar'
                : 'Completa los datos para crear un nuevo ciclo escolar'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              {/* Nombre */}
              <div className="space-y-2">
                <Label htmlFor="name">Nombre del Ciclo *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="Ej: Ciclo 2025-A"
                  required
                />
              </div>

              {/* Tipo de Ciclo */}
              <div className="space-y-2">
                <Label htmlFor="cycle_type">Tipo de Ciclo *</Label>
                <Select
                  value={formData.cycle_type}
                  onValueChange={(value: any) =>
                    setFormData({ ...formData, cycle_type: value })
                  }
                >
                  <SelectTrigger id="cycle_type">
                    <SelectValue placeholder="Selecciona un tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    {CYCLE_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Fecha Inicio */}
              <div className="space-y-2">
                <Label htmlFor="start_date">Fecha de Inicio *</Label>
                <Input
                  id="start_date"
                  type="date"
                  value={formData.start_date}
                  onChange={(e) =>
                    setFormData({ ...formData, start_date: e.target.value })
                  }
                  required
                />
              </div>

              {/* Fecha Fin */}
              <div className="space-y-2">
                <Label htmlFor="end_date">Fecha de Fin *</Label>
                <Input
                  id="end_date"
                  type="date"
                  value={formData.end_date}
                  onChange={(e) =>
                    setFormData({ ...formData, end_date: e.target.value })
                  }
                  required
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
                disabled={submitting}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700 text-white"
                disabled={submitting}
              >
                {submitting
                  ? 'Guardando...'
                  : editingCycle
                  ? 'Actualizar'
                  : 'Crear'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
