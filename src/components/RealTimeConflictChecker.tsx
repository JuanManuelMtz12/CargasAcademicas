import { useEffect, useState } from 'react';
import { useScheduleValidation, ValidationResult } from '@/hooks/useScheduleValidation';
import { AlertCircle, CheckCircle, Loader2, AlertTriangle, Clock, Calendar, User, Users, BookOpen, GraduationCap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface RealTimeConflictCheckerProps {
  teacher_id: string;
  subject_id: string;
  group_id: string;
  day: string;
  start_hour: number;
  end_hour: number;
  school_cycle_id: string;
  program_id?: string;                 // 👈 NUEVO: programa actual
  exclude_schedule_id?: string;        // @deprecated - use exclude_schedule_ids
  exclude_schedule_ids?: string[];     // Array de IDs a excluir (para edición multi-día)
  disableValidation?: boolean;         // NUEVO
}

export default function RealTimeConflictChecker({
  teacher_id,
  subject_id,
  group_id,
  day,
  start_hour,
  end_hour,
  school_cycle_id,
  program_id,
  exclude_schedule_id,
  exclude_schedule_ids
}: RealTimeConflictCheckerProps) {
  const { validateSchedule } = useScheduleValidation();
  const [validationState, setValidationState] = useState<'idle' | 'validating' | 'valid' | 'invalid'>('idle');
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);

  useEffect(() => {
    // Solo validar si tenemos todos los campos necesarios
    if (!teacher_id || !subject_id || !group_id || !day || !school_cycle_id) {
      setValidationState('idle');
      setValidationResult(null);
      return;
    }

    if (start_hour >= end_hour) {
      setValidationState('idle');
      setValidationResult(null);
      return;
    }

    // Debouncing: esperar 800ms después de que el usuario deja de escribir
    const timeoutId = setTimeout(async () => {
      setValidationState('validating');
      
      try {
const result = await validateSchedule({
  teacher_id,
  subject_id,
  group_id,
  day,
  start_hour,
  end_hour,
  school_cycle_id,
  program_id,              // 👈 se envía al hook
  exclude_schedule_id,
  exclude_schedule_ids,
});

        setValidationResult(result);
        
        // Verificar si hay conflictos críticos
        const criticalConflicts = [
          ...result.conflicts.teacher_conflicts,
          ...result.conflicts.group_conflicts
        ].filter(c => c.severity === 'critical');

        setValidationState(criticalConflicts.length > 0 ? 'invalid' : 'valid');
      } catch (error) {
        console.error('Error validating schedule:', error);
        setValidationState('idle');
      }
    }, 800);

    return () => clearTimeout(timeoutId);
  }, [teacher_id, subject_id, group_id, day, start_hour, end_hour, school_cycle_id, program_id, exclude_schedule_id, exclude_schedule_ids, validateSchedule]);

  // No mostrar nada si no hay campos completos
  if (validationState === 'idle') {
    return null;
  }

  const criticalConflicts = validationResult ? [
    ...validationResult.conflicts.teacher_conflicts,
    ...validationResult.conflicts.group_conflicts
  ].filter(c => c.severity === 'critical') : [];

    const warningConflicts = validationResult
    ? [
        // Advertencias de disponibilidad
        ...validationResult.conflicts.availability_conflicts.filter(
          (c) => c.severity === 'warning'
        ),
        // (Opcional) futuros warnings de maestro/grupo
        ...validationResult.conflicts.teacher_conflicts.filter(
          (c) => c.severity === 'warning'
        ),
        ...validationResult.conflicts.group_conflicts.filter(
          (c) => c.severity === 'warning'
        ),
      ]
    : [];


  return (
    <AnimatePresence mode="wait">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.3 }}
        className="mt-4"
      >
        {/* Estado de Validación */}
        <div className="flex items-center gap-3 mb-3">
          {validationState === 'validating' && (
            <>
              <div className="relative">
                <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
                <motion.div
                  className="absolute inset-0 rounded-full border-2 border-blue-200"
                  initial={{ scale: 1, opacity: 0.5 }}
                  animate={{ scale: 1.5, opacity: 0 }}
                  transition={{ duration: 1, repeat: Infinity }}
                />
              </div>
              <span className="text-sm text-gray-600 font-medium">
                Verificando disponibilidad...
              </span>
            </>
          )}

          {validationState === 'valid' && (
            <>
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 15 }}
              >
                <CheckCircle className="w-6 h-6 text-green-500" />
              </motion.div>
              <span className="text-sm text-green-600 font-medium">
                ✓ Sin empalmes detectados
              </span>
            </>
          )}

          {validationState === 'invalid' && (
            <>
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 15 }}
              >
                <AlertCircle className="w-6 h-6 text-red-500" />
              </motion.div>
              <span className="text-sm text-red-600 font-semibold">
                ⚠️ Empalmes detectados
              </span>
            </>
          )}
        </div>

        {/* Detalles de Conflictos */}
        {validationState === 'invalid' && criticalConflicts.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="space-y-3"
          >
            {criticalConflicts.map((conflict, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
                className="bg-red-50 border-l-4 border-red-500 rounded-r-lg p-4 shadow-sm"
              >
                {/* Tipo de Conflicto */}
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                  <span className="font-semibold text-red-700">
                    {conflict.type === 'teacher_time_overlap' 
                      ? '🧑‍🏫 Empalme de Maestro' 
                      : conflict.type === 'group_time_overlap'
                      ? '👥 Empalme de Grupo'
                      : '⚠️ Conflicto'}
                  </span>
                </div>

                {/* Detalles del Conflicto */}
                <div className="space-y-2 text-sm">
                  {/* Día */}
                  {conflict.details.day && (
                    <div className="flex items-center gap-2 text-gray-700">
                      <Calendar className="w-4 h-4 text-gray-500" />
                      <span className="font-medium">Día:</span>
                      <span className="text-red-600 font-semibold">{conflict.details.day}</span>
                    </div>
                  )}

                  {/* Horario del Conflicto */}
                  {conflict.details.conflicting_time && (
                    <div className="flex items-center gap-2 text-gray-700">
                      <Clock className="w-4 h-4 text-gray-500" />
                      <span className="font-medium">Horario:</span>
                      <span className="text-red-600 font-semibold">
                        {conflict.details.conflicting_time}
                      </span>
                    </div>
                  )}

                  {/* Maestro */}
                  {conflict.details.teacher_name && (
                    <div className="flex items-center gap-2 text-gray-700">
                      <User className="w-4 h-4 text-gray-500" />
                      <span className="font-medium">Maestro:</span>
                      <span className="text-gray-900 font-semibold">{conflict.details.teacher_name}</span>
                    </div>
                  )}

                  {/* Grupo */}
                  {conflict.details.group_name && (
                    <div className="flex items-center gap-2 text-gray-700">
                      <Users className="w-4 h-4 text-gray-500" />
                      <span className="font-medium">Grupo:</span>
                      <span className="text-gray-900 font-semibold">{conflict.details.group_name}</span>
                    </div>
                  )}

                  {/* Materia */}
                  {conflict.details.subject_name && (
                    <div className="flex items-center gap-2 text-gray-700">
                      <BookOpen className="w-4 h-4 text-gray-500" />
                      <span className="font-medium">Materia:</span>
                      <span className="text-gray-900 font-semibold">{conflict.details.subject_name}</span>
                    </div>
                  )}

                  {/* Licenciatura/Programa */}
                  {conflict.details.program_name && (
                    <div className="flex items-center gap-2 text-gray-700">
                      <GraduationCap className="w-4 h-4 text-gray-500" />
                      <span className="font-medium">Licenciatura:</span>
                      <span className="text-purple-700 font-semibold">{conflict.details.program_name}</span>
                    </div>
                  )}

                  {/* Mensaje Descriptivo */}
                  <div className="mt-3 pt-3 border-t border-red-200">
                    <p className="text-xs text-gray-600 italic">
                      {conflict.message}
                    </p>
                  </div>
                </div>
              </motion.div>
            ))}

            {/* Mensaje de Ayuda */}

            
           
          </motion.div>
        )}
      </motion.div>
              {/* Advertencias (no bloquean la asignación) */}
        {warningConflicts.length > 0 && (
          <div className="mt-2 space-y-1">
            {warningConflicts.map((conflict, index) => (
              <div
                key={index}
                className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 flex items-start gap-2"
              >
                <AlertTriangle className="w-4 h-4 mt-0.5" />
                <div>
                  <span className="font-semibold">Advertencia:</span>{' '}
                  <span>{conflict.message}</span>
                  
                </div>
              </div>
            ))}
          </div>
        )}

    </AnimatePresence>
  );
}
