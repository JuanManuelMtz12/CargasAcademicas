import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Clock, User, Users, Calendar, BookOpen } from 'lucide-react';
import { ValidationResult } from '@/hooks/useScheduleValidation';

interface ConflictConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  validationResult: ValidationResult | null;
  scheduleData: {
    day: string;
    start_hour: number;
    end_hour: number;
    subject_name?: string;
    teacher_name?: string;
    group_name?: string;
  };
  isSubmitting: boolean;
}

/**
 * Modal de confirmación para conflictos de horario
 * Muestra detalles específicos de cada conflicto para que el usuario pueda decidir
 */
export default function ConflictConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  validationResult,
  scheduleData,
  isSubmitting
}: ConflictConfirmationModalProps) {
  if (!validationResult || validationResult.valid) return null;

  const formatDay = (day: string) => {
    const days: { [key: string]: string } = {
      'monday': 'Lunes',
      'tuesday': 'Martes', 
      'wednesday': 'Miércoles',
      'thursday': 'Jueves',
      'friday': 'Viernes',
      'saturday': 'Sábado',
      'sunday': 'Domingo'
    };
    return days[day.toLowerCase()] || day;
  };

  const formatHour = (hour: number) => `${hour.toString().padStart(2, '0')}:00`;

  const totalConflicts = 
    (validationResult.conflicts?.teacher_conflicts?.length || 0) + 
    (validationResult.conflicts?.group_conflicts?.length || 0) +
    (validationResult.conflicts?.availability_conflicts?.length || 0);

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-5 w-5" />
            Conflicto de Horario Detectado
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4">
              <p>
                Se detectaron <strong>{totalConflicts} conflicto(s)</strong> al intentar crear el horario:
              </p>
              
              {/* Resumen del horario a crear */}
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <h4 className="font-semibold text-blue-800 mb-3 flex items-center gap-2">
                  📝 Horario que intentas crear
                </h4>
                <div className="text-sm text-blue-700 space-y-2">
                  <div className="bg-white p-3 rounded border border-blue-100">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        <span><strong>Día:</strong> {formatDay(scheduleData.day)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        <span><strong>Horario:</strong> {formatHour(scheduleData.start_hour)} - {formatHour(scheduleData.end_hour)}</span>
                      </div>
                      {scheduleData.teacher_name && (
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4" />
                          <span><strong>Maestro:</strong> {scheduleData.teacher_name}</span>
                        </div>
                      )}
                      {scheduleData.subject_name && (
                        <div className="flex items-center gap-2">
                          <BookOpen className="h-4 w-4" />
                          <span><strong>Materia:</strong> {scheduleData.subject_name}</span>
                        </div>
                      )}
                      {scheduleData.group_name && (
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4" />
                          <span><strong>Grupo:</strong> {scheduleData.group_name}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        {/* Detalles de conflictos */}
        <div className="space-y-4 my-4">
          {/* Conflictos de Maestro */}
          {validationResult.conflicts?.teacher_conflicts && validationResult.conflicts.teacher_conflicts.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-semibold text-red-700 flex items-center gap-2">
                <User className="h-4 w-4" />
                Conflictos de Maestro ({validationResult.conflicts.teacher_conflicts.length})
              </h4>
              <div className="space-y-3">
                {validationResult.conflicts.teacher_conflicts.map((conflict, index) => (
                  <div key={`teacher-${index}`} className="bg-red-50 p-4 rounded border border-red-200">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-red-800 font-medium mb-2">{conflict.message}</p>
                        {conflict.details && (
                          <div className="bg-white p-3 rounded border border-red-100">
                            <h5 className="text-red-700 font-medium text-sm mb-2">📋 Detalles del Conflicto:</h5>
                            <div className="text-red-600 text-sm space-y-1">
                              {conflict.details.conflicting_subject && (
                                <div className="flex items-center gap-2">
                                  <BookOpen className="h-3 w-3" />
                                  <span><strong>Materia:</strong> {conflict.details.conflicting_subject}</span>
                                </div>
                              )}
                              {conflict.details.subject && (
                                <div className="flex items-center gap-2">
                                  <BookOpen className="h-3 w-3" />
                                  <span><strong>Materia:</strong> {conflict.details.subject}</span>
                                </div>
                              )}
                              {/* Fallback para obtener materia de forma más directa */}
                              {(!conflict.details.conflicting_subject && !conflict.details.subject && conflict.details.teacher) && (
                                <div className="text-xs text-gray-500">
                                  ⚠️ Información de materia no disponible en detalles
                                </div>
                              )}
                              {conflict.details.conflicting_group && (
                                <div className="flex items-center gap-2">
                                  <Users className="h-3 w-3" />
                                  <span><strong>Grupo:</strong> {conflict.details.conflicting_group}</span>
                                </div>
                              )}
                              {conflict.details.conflicting_program && (
                                <div className="flex items-center gap-2">
                                  <span className="text-xs">🎓</span>
                                  <span><strong>Programa:</strong> {conflict.details.conflicting_program}</span>
                                </div>
                              )}
                              {conflict.details.conflicting_time && (
                                <div className="flex items-center gap-2">
                                  <Clock className="h-3 w-3" />
                                  <span><strong>Horario del conflicto:</strong> {conflict.details.conflicting_time}</span>
                                </div>
                              )}
                              {conflict.details.day && (
                                <div className="flex items-center gap-2">
                                  <Calendar className="h-3 w-3" />
                                  <span><strong>Día:</strong> {formatDay(conflict.details.day)}</span>
                                </div>
                              )}
                              {conflict.details.conflicting_teacher && (
                                <div className="flex items-center gap-2">
                                  <User className="h-3 w-3" />
                                  <span><strong>Maestro asignado:</strong> {conflict.details.conflicting_teacher}</span>
                                </div>
                              )}
                              {conflict.details.teacher && (
                                <div className="flex items-center gap-2">
                                  <User className="h-3 w-3" />
                                  <span><strong>Maestro:</strong> {conflict.details.teacher}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Conflictos de Grupo */}
          {validationResult.conflicts?.group_conflicts && validationResult.conflicts.group_conflicts.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-semibold text-red-700 flex items-center gap-2">
                <Users className="h-4 w-4" />
                Conflictos de Grupo ({validationResult.conflicts.group_conflicts.length})
              </h4>
              <div className="space-y-3">
                {validationResult.conflicts.group_conflicts.map((conflict, index) => (
                  <div key={`group-${index}`} className="bg-red-50 p-4 rounded border border-red-200">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-red-800 font-medium mb-2">{conflict.message}</p>
                        {conflict.details && (
                          <div className="bg-white p-3 rounded border border-red-100">
                            <h5 className="text-red-700 font-medium text-sm mb-2">📋 Detalles del Conflicto:</h5>
                            <div className="text-red-600 text-sm space-y-1">
                              {conflict.details.conflicting_subject && (
                                <div className="flex items-center gap-2">
                                  <BookOpen className="h-3 w-3" />
                                  <span><strong>Materia en conflicto:</strong> {conflict.details.conflicting_subject}</span>
                                </div>
                              )}
                              {conflict.details.subject && (
                                <div className="flex items-center gap-2">
                                  <BookOpen className="h-3 w-3" />
                                  <span><strong>Materia en conflicto:</strong> {conflict.details.subject}</span>
                                </div>
                              )}
                              {/* Fallback para obtener información adicional */}
                              {!conflict.details.conflicting_subject && !conflict.details.subject && (
                                <div className="text-xs text-gray-500">
                                  ⚠️ Información detallada de materia no disponible
                                </div>
                              )}
                              {conflict.details.conflicting_teacher && (
                                <div className="flex items-center gap-2">
                                  <User className="h-3 w-3" />
                                  <span><strong>Maestro asignado:</strong> {conflict.details.conflicting_teacher}</span>
                                </div>
                              )}
                              {conflict.details.program && (
                                <div className="flex items-center gap-2">
                                  <span className="text-xs">🎓</span>
                                  <span><strong>Programa:</strong> {conflict.details.program}</span>
                                </div>
                              )}
                              {conflict.details.conflicting_time && (
                                <div className="flex items-center gap-2">
                                  <Clock className="h-3 w-3" />
                                  <span><strong>Horario del conflicto:</strong> {conflict.details.conflicting_time}</span>
                                </div>
                              )}
                              {conflict.details.day && (
                                <div className="flex items-center gap-2">
                                  <Calendar className="h-3 w-3" />
                                  <span><strong>Día:</strong> {formatDay(conflict.details.day)}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Conflictos de Disponibilidad */}
          {validationResult.conflicts?.availability_conflicts && validationResult.conflicts.availability_conflicts.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-semibold text-yellow-700 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Advertencias de Disponibilidad ({validationResult.conflicts.availability_conflicts.length})
              </h4>
              <div className="space-y-3">
                {validationResult.conflicts.availability_conflicts.map((conflict, index) => (
                  <div key={`availability-${index}`} className="bg-yellow-50 p-4 rounded border border-yellow-200">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="h-5 w-5 text-yellow-500 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-yellow-800 font-medium mb-2">{conflict.message}</p>
                        {conflict.details && (
                          <div className="bg-white p-3 rounded border border-yellow-100">
                            <h5 className="text-yellow-700 font-medium text-sm mb-2">📋 Detalles:</h5>
                            <div className="text-yellow-600 text-sm space-y-1">
                              {conflict.details.unavailable_time && (
                                <div className="flex items-center gap-2">
                                  <Clock className="h-3 w-3" />
                                  <span><strong>Horario no disponible:</strong> {conflict.details.unavailable_time}</span>
                                </div>
                              )}
                              <div className="text-xs mt-2 text-yellow-600">
                                💡 <strong>Nota:</strong> El maestro no tiene registrada disponibilidad para este horario.
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="bg-gray-50 border-t pt-4">
          <div className="text-sm text-gray-700">
            <p className="font-medium mb-2">
              ❓ <strong>¿Deseas continuar guardando este horario con conflicto?</strong>
            </p>
            <div className="bg-yellow-50 border border-yellow-200 rounded p-3 text-xs">
              <p className="text-yellow-800 mb-2">
                <strong>⚠️ Consecuencias de continuar:</strong>
              </p>
              <ul className="text-yellow-700 space-y-1 list-disc list-inside">
                <li>El horario se guardará con una <strong>marca de conflicto</strong></li>
                <li>Aparecerá destacado en rojo en el sistema</li>
                <li>Deberás resolver manualmente estos empalmes posteriormente</li>
                <li>Esto puede afectar la organización académica del programa</li>
              </ul>
            </div>
            <p className="text-xs mt-3 text-gray-600">
              💡 <strong>Recomendación:</strong> Cancela y ajusta el horario para evitar conflictos, o coordina con los maestros/grupos afectados.
            </p>
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel 
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction 
            onClick={onConfirm}
            disabled={isSubmitting}
            className="bg-red-600 hover:bg-red-700"
          >
            {isSubmitting ? 'Guardando...' : 'Guardar con Conflicto'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}