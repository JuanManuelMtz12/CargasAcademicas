import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar, Download, Loader2 } from 'lucide-react';
import { generateCalendarioAcademico } from '@/utils/calendarioAcademicoGenerator';

type SchoolCycle = {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
};

interface CalendarioAcademicoModalProps {
  isOpen: boolean;
  onClose: () => void;
  programId: string;
  programName: string;
  isLeipProgram?: boolean;
}

export default function CalendarioAcademicoModal({
  isOpen,
  onClose,
  programId,
  programName,
  isLeipProgram = false,
}: CalendarioAcademicoModalProps) {
  const [schoolCycles, setSchoolCycles] = useState<SchoolCycle[]>([]);
  const [selectedCycleId, setSelectedCycleId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadSchoolCycles();
    }
  }, [isOpen]);

  const loadSchoolCycles = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('school_cycles')
        .select('*')
        .eq('is_active', true)
        .order('start_date', { ascending: false });

      if (error) throw error;
      setSchoolCycles(data || []);

      // Seleccionar automáticamente el primer ciclo activo
      if (data && data.length > 0) {
        setSelectedCycleId(data[0].id);
      }
    } catch (error: any) {
      console.error('Error loading school cycles:', error);
      toast.error('Error al cargar los ciclos escolares');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (!selectedCycleId) {
      toast.error('Por favor seleccione un ciclo escolar');
      return;
    }

    setGenerating(true);
    try {
      await generateCalendarioAcademico(programId, selectedCycleId);
      toast.success('Calendario académico generado exitosamente');
      onClose();
    } catch (error: any) {
      console.error('Error generating calendario:', error);
      toast.error(error.message || 'Error al generar el calendario académico');
    } finally {
      setGenerating(false);
    }
  };

  const formatDateRange = (startDate: string, endDate: string): string => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    const months = [
      'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
      'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'
    ];
    
    return `${months[start.getMonth()]} ${start.getFullYear()} - ${months[end.getMonth()]} ${end.getFullYear()}`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Generar Calendario Académico
          </DialogTitle>
          <DialogDescription>
            Genera el calendario de asignación de cargas académicas para{' '}
            <strong>{programName}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Información */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              <strong>Documento a generar:</strong> Asignación de Cargas Académicas - Horario por Grupo
            </p>
            <p className="text-sm text-blue-700 mt-2">
              Incluye todos los grupos, materias, asesores y horarios organizados por grupo.
            </p>
          </div>

          {/* Selector de Ciclo Escolar */}
          <div className="grid gap-2">
            <Label htmlFor="cycle">
              Ciclo Escolar <span className="text-red-500">*</span>
            </Label>
            {loading ? (
              <div className="flex items-center justify-center py-3">
                <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
              </div>
            ) : schoolCycles.length === 0 ? (
              <p className="text-sm text-gray-500 py-3">
                No hay ciclos escolares activos disponibles
              </p>
            ) : (
              <Select value={selectedCycleId} onValueChange={setSelectedCycleId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona el ciclo escolar" />
                </SelectTrigger>
                <SelectContent>
                  {schoolCycles.map((cycle) => (
                    <SelectItem key={cycle.id} value={cycle.id}>
                      <div className="flex flex-col">
                        <span className="font-medium">{cycle.name}</span>
                        <span className="text-xs text-gray-500">
                          {formatDateRange(cycle.start_date, cycle.end_date)}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Vista previa de datos */}
          {selectedCycleId && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <h4 className="font-semibold text-sm mb-2">Vista Previa:</h4>
              <ul className="text-sm text-gray-700 space-y-1">
                <li>
                  <strong>Programa:</strong> {programName}
                </li>
                <li>
                  <strong>Ciclo:</strong>{' '}
                  {schoolCycles.find(c => c.id === selectedCycleId)?.name}
                </li>
                <li>
                  <strong>Formato:</strong> Documento PDF (Formato vertical)
                </li>
              </ul>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={generating}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleGenerate}
            disabled={!selectedCycleId || generating || schoolCycles.length === 0}
            className="gap-2"
          >
            {generating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generando...
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                Generar Calendario
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
