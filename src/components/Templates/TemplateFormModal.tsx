import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { GroupTemplateComplete } from '@/types/group-templates';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import CalendarSelector from '@/components/AcademicLoads/CalendarSelector';

interface Program {
  id: string;
  name: string;
}

interface AcademicPeriod {
  id: string;
  name: string;
}

interface TemplateFormModalProps {
  template: GroupTemplateComplete | null;
  onClose: () => void;
  onSave: () => void;
}

const TemplateFormModal: React.FC<TemplateFormModalProps> = ({ template, onClose, onSave }) => {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [periods, setPeriods] = useState<AcademicPeriod[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    start_date: '',
    end_date: '',
    academic_period_id: '',
    start_time: '08:00',
    end_time: '15:00',
    work_modality: 'hibrida' as 'presencial' | 'en_linea' | 'hibrida',
    face_to_face_days: [] as string[],
    face_to_face_schedule: {} as { [key: string]: number[] },
    program_id: '',
    is_active: true,
  });

  useEffect(() => {
    loadPrograms();
    loadPeriods();

    if (template) {
      setFormData({
        name: template.name,
        description: template.description || '',
        start_date: template.start_date,
        end_date: template.end_date,
        academic_period_id: template.academic_period_id || '',
        start_time: template.start_time,
        end_time: template.end_time,
        work_modality: template.work_modality,
        face_to_face_days: template.face_to_face_days || [],
        face_to_face_schedule: template.face_to_face_schedule || {},
        program_id: template.program_id || '',
        is_active: template.is_active,
      });
    }
  }, [template]);

  const loadPrograms = async () => {
    try {
      const { data, error } = await supabase
        .from('programs')
        .select('id, name')
        .order('name');

      if (error) throw error;
      setPrograms(data || []);
    } catch (error) {
      console.error('Error loading programs:', error);
    }
  };

  const loadPeriods = async () => {
    try {
      const { data, error } = await supabase
        .from('academic_periods')
        .select('id, name')
        .order('name');

      if (error) throw error;
      setPeriods(data || []);
    } catch (error) {
      console.error('Error loading periods:', error);
    }
  };

  const handleDayToggle = (day: string) => {
    setFormData(prev => ({
      ...prev,
      face_to_face_days: prev.face_to_face_days.includes(day)
        ? prev.face_to_face_days.filter(d => d !== day)
        : [...prev.face_to_face_days, day],
      face_to_face_schedule: {}, // Reset schedule when days change
    }));
  };

  const handleScheduleChange = (schedule: { [key: string]: number[] }) => {
    setFormData(prev => ({
      ...prev,
      face_to_face_schedule: schedule,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.start_date || !formData.end_date) {
      toast.error('Por favor completa todos los campos requeridos');
      return;
    }

    setSubmitting(true);

    try {
      const payload = {
        name: formData.name,
        description: formData.description || null,
        start_date: formData.start_date,
        end_date: formData.end_date,
        academic_period_id: formData.academic_period_id || null,
        start_time: formData.start_time,
        end_time: formData.end_time,
        work_modality: formData.work_modality,
        face_to_face_days: formData.face_to_face_days,
        face_to_face_schedule: formData.face_to_face_schedule,
        program_id: formData.program_id || null,
        is_active: formData.is_active,
      };

      if (template) {
        const { error } = await supabase
          .from('group_templates')
          .update(payload)
          .eq('id', template.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('group_templates')
          .insert([{
            ...payload,
            template_type: 'group',
            display_order: 0,
          }]);

        if (error) throw error;
      }

      onSave();
    } catch (error: any) {
      console.error('Error saving template:', error);
      toast.error(error.message || 'Error al guardar la plantilla');
    } finally {
      setSubmitting(false);
    }
  };

  const days = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábados', 'domingos'];

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{template ? 'Editar Plantilla Grupal' : 'Nueva Plantilla Grupal'}</DialogTitle>
          <DialogDescription>
            Define la configuración compartida para grupos de maestros
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Información básica */}
          <div className="space-y-4">
            <h3 className="font-medium">Información Básica</h3>
            <div className="grid grid-cols-1 gap-4">
              <div>
                <Label htmlFor="name">Nombre de la Plantilla Grupal *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ej: MAESTRÍAS SABATINAS NOV-FEB 2026"
                  required
                />
              </div>
              <div>
                <Label htmlFor="description">Descripción</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Descripción de la plantilla"
                  rows={2}
                />
              </div>
            </div>
          </div>

          {/* Programa y Período */}
          <div className="space-y-4">
            <h3 className="font-medium">Programa y Período</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="program_id">Programa</Label>
                <Select value={formData.program_id} onValueChange={(value) => setFormData({ ...formData, program_id: value })}>
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
                <Label htmlFor="academic_period_id">Período Académico</Label>
                <Select value={formData.academic_period_id} onValueChange={(value) => setFormData({ ...formData, academic_period_id: value })}>
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
            </div>
          </div>

          {/* Fechas */}
          <div className="space-y-4">
            <h3 className="font-medium">Período *</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="start_date">Fecha de Inicio</Label>
                <Input
                  id="start_date"
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="end_date">Fecha de Fin</Label>
                <Input
                  id="end_date"
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                  required
                />
              </div>
            </div>
          </div>

          {/* Horario */}
          <div className="space-y-4">
            <h3 className="font-medium">Horario *</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="start_time">Hora de Inicio</Label>
                <Input
                  id="start_time"
                  type="time"
                  value={formData.start_time}
                  onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="end_time">Hora de Fin</Label>
                <Input
                  id="end_time"
                  type="time"
                  value={formData.end_time}
                  onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                  required
                />
              </div>
            </div>
          </div>

          {/* Modalidad */}
          <div className="space-y-4">
            <h3 className="font-medium">Modalidad de Trabajo *</h3>
            <Select
              value={formData.work_modality}
              onValueChange={(value: any) => setFormData({ ...formData, work_modality: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="presencial">Presencial</SelectItem>
                <SelectItem value="en_linea">En Línea</SelectItem>
                <SelectItem value="hibrida">Híbrida</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Días Presenciales */}
          <div className="space-y-4">
            <h3 className="font-medium">Días Presenciales</h3>
            <div className="flex flex-wrap gap-2">
              {days.map((day) => (
                <Button
                  key={day}
                  type="button"
                  size="sm"
                  variant={formData.face_to_face_days.includes(day) ? 'default' : 'outline'}
                  onClick={() => handleDayToggle(day)}
                >
                  {day.charAt(0).toUpperCase() + day.slice(1)}
                </Button>
              ))}
            </div>
          </div>

          {/* Calendario */}
          {formData.start_date && formData.end_date && formData.face_to_face_days.length > 0 && (
            <div className="space-y-4">
              <h3 className="font-medium">Calendario de Sesiones Presenciales</h3>
              <CalendarSelector
                startDate={formData.start_date}
                endDate={formData.end_date}
                selectedDays={formData.face_to_face_days}
                value={formData.face_to_face_schedule}
                onChange={handleScheduleChange}
              />
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Guardando...' : template ? 'Actualizar Plantilla' : 'Crear Plantilla Grupal'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default TemplateFormModal;
