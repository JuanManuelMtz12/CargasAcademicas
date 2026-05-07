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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Trash2, Zap, Download, Eye, AlertTriangle, CheckCircle, Loader2 } from 'lucide-react';
import { generateAcademicLoadPDF, downloadPDF } from '@/utils/academicLoadPDF';

interface Specialization {
  id: string;
  name: string;
}

interface Teacher {
  id: string;
  name: string;
}

interface Assignment {
  id: string;
  specialization_id: string;
  group_name: string;
  location: 'TEZIUTLÁN' | 'HUEYAPAN' | 'GUADALUPE VICTORIA';
  module_number: string;
  module_name: string;
  module_key: string;
  instructor_id: string;
}

interface MassiveGeneratorModalProps {
  template: GroupTemplateComplete;
  onClose: () => void;
  onComplete: () => void;
}

const MassiveGeneratorModal: React.FC<MassiveGeneratorModalProps> = ({ template, onClose, onComplete }) => {
  const [specializations, setSpecializations] = useState<Specialization[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [validatingConflict, setValidatingConflict] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generationStatus, setGenerationStatus] = useState('');

  const [newAssignment, setNewAssignment] = useState({
    specialization_id: '',
    group_name: '',
    location: 'TEZIUTLÁN' as 'TEZIUTLÁN' | 'HUEYAPAN' | 'GUADALUPE VICTORIA',
    module_number: '',
    module_name: '',
    module_key: '',
    instructor_id: '',
  });

  useEffect(() => {
    loadData();
    loadExistingAssignments();
  }, [template.id]);

  const loadData = async () => {
    try {
      const [specsResult, teachersResult] = await Promise.all([
        supabase.from('specializations').select('id, name').order('name'),
        supabase.from('teachers').select('id, name').order('name'),
      ]);

      if (specsResult.error) throw specsResult.error;
      if (teachersResult.error) throw teachersResult.error;

      setSpecializations(specsResult.data || []);
      setTeachers(teachersResult.data || []);
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const loadExistingAssignments = async () => {
    try {
      const { data, error } = await supabase
        .from('template_assignments')
        .select('*')
        .eq('template_id', template.id)
        .eq('is_generated', false);

      if (error) throw error;

      setAssignments(data || []);
    } catch (error) {
      console.error('Error loading assignments:', error);
    }
  };

  const validateInstructorConflicts = async (instructorId: string) => {
    if (!instructorId) return { has_conflict: false, conflicts: [] };

    try {
      const { data, error } = await supabase.functions.invoke('validate-instructor-conflicts', {
        body: {
          instructor_id: instructorId,
          start_date: template.start_date,
          end_date: template.end_date,
          start_time: template.start_time,
          end_time: template.end_time,
          face_to_face_days: template.face_to_face_days,
          face_to_face_schedule: template.face_to_face_schedule,
        },
      });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error validating conflicts:', error);
      return { has_conflict: false, conflicts: [] };
    }
  };

  const handleAddAssignment = async () => {
    if (
      !newAssignment.group_name ||
      !newAssignment.module_name ||
      !newAssignment.module_number ||
      !newAssignment.module_key
    ) {
      toast.error('Por favor completa todos los campos requeridos');
      return;
    }

    // Validar conflictos de horarios si hay instructor asignado
    if (newAssignment.instructor_id) {
      setValidatingConflict(true);
      const conflictResult = await validateInstructorConflicts(newAssignment.instructor_id);
      setValidatingConflict(false);

      if (conflictResult.has_conflict) {
        const teacher = teachers.find(t => t.id === newAssignment.instructor_id);
        const conflictMessages = conflictResult.conflicts.map(c => 
          `- ${c.group_name} (${c.module_name}) en ${c.location}: ${c.conflicting_dates.length} fechas en conflicto`
        ).join('\n');
        
        toast.error(
          `CONFLICTO DE HORARIOS\n\nEl instructor ${teacher?.name} ya tiene asignaciones en el mismo horario:\n\n${conflictMessages}`,
          { duration: 8000 }
        );
        return;
      } else {
        toast.success('No se detectaron conflictos de horarios', { duration: 2000 });
      }
    }

    try {
      const { data, error } = await supabase
        .from('template_assignments')
        .insert([{
          template_id: template.id,
          ...newAssignment,
          specialization_id: newAssignment.specialization_id || null,
          instructor_id: newAssignment.instructor_id || null,
          assignment_order: assignments.length + 1,
        }])
        .select();

      if (error) throw error;

      if (data) {
        setAssignments([...assignments, data[0]]);
        setNewAssignment({
          specialization_id: '',
          group_name: '',
          location: 'TEZIUTLÁN',
          module_number: '',
          module_name: '',
          module_key: '',
          instructor_id: '',
        });
        toast.success('Asignación agregada');
      }
    } catch (error: any) {
      console.error('Error adding assignment:', error);
      toast.error('Error al agregar asignación');
    }
  };

  const handleRemoveAssignment = async (id: string) => {
    try {
      const { error } = await supabase
        .from('template_assignments')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setAssignments(assignments.filter(c => c.id !== id));
      toast.success('Asignación eliminada');
    } catch (error) {
      console.error('Error removing assignment:', error);
      toast.error('Error al eliminar asignación');
    }
  };

  const generateSessions = async (loadId: string) => {
    try {
      const sessions: any[] = [];
      const schedule = template.face_to_face_schedule;

      if (!schedule || Object.keys(schedule).length === 0) return;

      Object.entries(schedule).forEach(([month, days]) => {
        (days as number[]).forEach(day => {
          const year = new Date(template.start_date).getFullYear();
          const monthIndex = [
            'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
            'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
          ].indexOf(month.toLowerCase());

          if (monthIndex !== -1) {
            const sessionDate = new Date(year, monthIndex, day);
            sessions.push({
              academic_load_id: loadId,
              session_date: sessionDate.toISOString().split('T')[0],
              start_time: template.start_time,
              end_time: template.end_time,
              session_type: 'face_to_face',
              location: '', // Will be set from combination
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

  const handleGenerateLoads = async () => {
    if (assignments.length === 0) {
      toast.error('Debes agregar al menos una asignación');
      return;
    }

    setGenerating(true);
    setGenerationProgress(0);
    setGenerationStatus('Iniciando generación...');

    try {
      // Paso 1: Crear cargas académicas
      setGenerationStatus(`Creando ${assignments.length} cargas académicas...`);
      setGenerationProgress(10);

      const loadsToCreate = assignments.map(assignment => ({
        program_id: template.program_id,
        specialization_id: assignment.specialization_id,
        academic_period_id: template.academic_period_id,
        group_name: assignment.group_name,
        location: assignment.location,
        module_number: assignment.module_number,
        module_name: assignment.module_name,
        module_key: assignment.module_key,
        instructor_id: assignment.instructor_id,
        start_time: template.start_time,
        end_time: template.end_time,
        work_modality: template.work_modality,
        face_to_face_days: template.face_to_face_days,
        face_to_face_schedule: template.face_to_face_schedule,
        start_date: template.start_date,
        end_date: template.end_date,
        status: 'active',
      }));

      const { data: createdLoads, error: loadsError } = await supabase
        .from('academic_loads')
        .insert(loadsToCreate)
        .select();

      if (loadsError) throw loadsError;

      setGenerationProgress(40);

      // Paso 2: Generar sesiones para cada carga
      if (createdLoads) {
        const totalLoads = createdLoads.length;
        const progressPerLoad = 50 / totalLoads;

        for (let i = 0; i < createdLoads.length; i++) {
          const load = createdLoads[i];
          const assignment = assignments[i];
          
          setGenerationStatus(`Generando sesiones para ${assignment.group_name} (${i + 1}/${totalLoads})...`);
          
          // Generar sesiones
          await generateSessions(load.id);
          
          // Actualizar progreso
          setGenerationProgress(40 + (i + 1) * progressPerLoad);
          
          // Marcar asignación como generada
          await supabase
            .from('template_assignments')
            .update({
              is_generated: true,
              generated_load_id: load.id,
            })
            .eq('id', assignment.id);
        }
      }

      setGenerationProgress(100);
      setGenerationStatus('Completado');

      toast.success(`${assignments.length} cargas académicas y sesiones generadas exitosamente`, {
        duration: 5000
      });
      
      // Esperar un momento antes de cerrar para mostrar el 100%
      setTimeout(() => {
        onComplete();
      }, 1000);
    } catch (error: any) {
      console.error('Error generating loads:', error);
      toast.error('Error al generar cargas académicas: ' + error.message);
      setGenerationStatus('Error en la generación');
    } finally {
      setTimeout(() => {
        setGenerating(false);
        setGenerationProgress(0);
        setGenerationStatus('');
      }, 1500);
    }
  };

  const handlePreviewPDF = () => {
    // Generate preview PDF with assignments
    const previewLoads = assignments.map(assignment => {
      const spec = specializations.find(s => s.id === assignment.specialization_id);
      const teacher = teachers.find(t => t.id === assignment.instructor_id);

      return {
        id: assignment.id,
        module_name: assignment.module_name,
        module_number: assignment.module_number,
        module_key: assignment.module_key,
        group_name: assignment.group_name,
        location: assignment.location,
        specialization_name: spec?.name || '',
        instructor_name: teacher?.name || '',
        start_time: template.start_time,
        end_time: template.end_time,
        start_date: template.start_date,
        end_date: template.end_date,
        status: 'preview',
        work_modality: template.work_modality,
        face_to_face_days: template.face_to_face_days,
        face_to_face_schedule: template.face_to_face_schedule || {},
        program_name: template.program_name || '',
        academic_period_name: template.academic_period_name || '',
      };
    });

    const doc = generateAcademicLoadPDF(previewLoads, template.name);
    downloadPDF(doc, `preview-${template.name}.pdf`);
  };

  const getSpecName = (id: string) => specializations.find(s => s.id === id)?.name || 'N/A';
  const getTeacherName = (id: string) => teachers.find(t => t.id === id)?.name || 'N/A';

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Generador Masivo de Cargas - {template.name}
          </DialogTitle>
          <DialogDescription>
            Agrega asignaciones de maestros, módulos y grupos para generar múltiples cargas automáticamente
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Form to add new combination */}
          <div className="border rounded-lg p-4 space-y-4 bg-gray-50 dark:bg-gray-900">
            <h3 className="font-medium text-sm">Agregar Nueva Asignación</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <Label className="text-xs">Especialización</Label>
                <Select
                  value={newAssignment.specialization_id}
                  onValueChange={(value) => setNewAssignment({ ...newAssignment, specialization_id: value })}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Seleccionar" />
                  </SelectTrigger>
                  <SelectContent>
                    {specializations.map((spec) => (
                      <SelectItem key={spec.id} value={spec.id}>
                        {spec.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Grupo *</Label>
                <Input
                  className="h-9"
                  value={newAssignment.group_name}
                  onChange={(e) => setNewAssignment({ ...newAssignment, group_name: e.target.value })}
                  placeholder="Ej: TEZIUTLÁN A"
                />
              </div>
              <div>
                <Label className="text-xs">Ubicación *</Label>
                <Select
                  value={newAssignment.location}
                  onValueChange={(value: any) => setNewAssignment({ ...newAssignment, location: value })}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TEZIUTLÁN">TEZIUTLÁN</SelectItem>
                    <SelectItem value="HUEYAPAN">HUEYAPAN</SelectItem>
                    <SelectItem value="GUADALUPE VICTORIA">GUADALUPE VICTORIA</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Nombre del Módulo Académico *</Label>
                <Input
                  className="h-9"
                  value={newAssignment.module_number}
                  onChange={(e) => setNewAssignment({ ...newAssignment, module_number: e.target.value })}
                  placeholder="Ej: 1"
                />
              </div>
              <div className="col-span-2">
                <Label className="text-xs">Nombre del Módulo *</Label>
                <Input
                  className="h-9"
                  value={newAssignment.module_name}
                  onChange={(e) => setNewAssignment({ ...newAssignment, module_name: e.target.value })}
                  placeholder="Ej: Evaluación de la práctica profesional"
                />
              </div>
              <div>
                <Label className="text-xs">Clave *</Label>
                <Input
                  className="h-9"
                  value={newAssignment.module_key}
                  onChange={(e) => setNewAssignment({ ...newAssignment, module_key: e.target.value })}
                  placeholder="Ej: EPP-01"
                />
              </div>
              <div>
                <Label className="text-xs">Asesor</Label>
                <Select
                  value={newAssignment.instructor_id}
                  onValueChange={(value) => setNewAssignment({ ...newAssignment, instructor_id: value })}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Seleccionar" />
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
            <div className="flex justify-end">
              <Button size="sm" onClick={handleAddAssignment} disabled={validatingConflict}>
                {validatingConflict ? (
                  <>
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                    Validando...
                  </>
                ) : (
                  <>
                    <Plus className="mr-1 h-3 w-3" />
                    Agregar
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* List of combinations */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <h3 className="font-medium">
                Asignaciones ({assignments.length})
              </h3>
              {assignments.length > 0 && (
                <Button size="sm" variant="outline" onClick={handlePreviewPDF}>
                  <Eye className="mr-1 h-3 w-3" />
                  Vista Previa PDF
                </Button>
              )}
            </div>

            {assignments.length === 0 ? (
              <div className="text-center py-8 text-gray-500 border rounded-lg">
                <p>No hay asignaciones agregadas</p>
                <p className="text-sm">Agrega asignaciones usando el formulario arriba</p>
              </div>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[150px]">Especialización</TableHead>
                      <TableHead>Grupo</TableHead>
                      <TableHead>Ubicación</TableHead>
                      <TableHead>Módulo</TableHead>
                      <TableHead>Asesor</TableHead>
                      <TableHead className="w-[80px]">Acción</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {assignments.map((assignment) => (
                      <TableRow key={assignment.id}>
                        <TableCell className="text-sm">{getSpecName(assignment.specialization_id)}</TableCell>
                        <TableCell className="text-sm font-medium">{assignment.group_name}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">{assignment.location}</Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          <div>{assignment.module_name}</div>
                          <div className="text-xs text-gray-500">{assignment.module_number} - {assignment.module_key}</div>
                        </TableCell>
                        <TableCell className="text-sm">{getTeacherName(assignment.instructor_id)}</TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleRemoveAssignment(assignment.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="flex-col items-stretch gap-4">
          {generating && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">{generationStatus}</span>
                <span className="font-medium">{generationProgress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${generationProgress}%` }}
                />
              </div>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose} disabled={generating}>
              Cancelar
            </Button>
            <Button
              onClick={handleGenerateLoads}
              disabled={generating || assignments.length === 0}
            >
              {generating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generando...
                </>
              ) : (
                <>
                  <Zap className="mr-2 h-4 w-4" />
                  Generar {assignments.length} Cargas
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default MassiveGeneratorModal;
