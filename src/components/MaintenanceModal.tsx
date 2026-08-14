// src/components/MaintenanceModal.tsx
import { useState, useEffect } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface MaintenanceModalProps {
  title?: string;
  message?: string;
  startDate?: string; // ej: "Sábado 9 de agosto, 10:00 PM"
  endDate?: string;   // ej: "Domingo 10 de agosto, 6:00 AM"
  storageKey?: string; // clave para no volver a mostrarlo en la sesión
}

export function MaintenanceModal({
  title = 'Mantenimiento Programado',
  message = 'El sistema estará temporalmente fuera de servicio por labores de mantenimiento. Disculpa las molestias.',
  startDate = 'Sábado 9 de agosto, 10:00 PM',
  endDate = 'Domingo 10 de agosto, 6:00 AM',
  storageKey = 'maintenance-modal-dismissed',
}: MaintenanceModalProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const dismissed = sessionStorage.getItem(storageKey);
    if (!dismissed) {
      setOpen(true);
    }
  }, [storageKey]);

  const handleClose = () => {
    sessionStorage.setItem(storageKey, 'true');
    setOpen(false);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-gray-200/50 dark:border-slate-700/50 p-6 animate-in zoom-in-95 fade-in duration-200">
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:text-slate-500 dark:hover:text-slate-300 transition-colors"
          aria-label="Cerrar"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-amber-100 dark:bg-amber-500/10 flex items-center justify-center">
            <AlertTriangle className="w-6 h-6 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-gray-900 dark:text-slate-100">
              {title}
            </h2>
            <p className="text-sm text-gray-600 dark:text-slate-400 mt-2">
              {message}
            </p>

            <div className="mt-4 bg-gray-50 dark:bg-slate-700/50 rounded-lg p-3 text-sm space-y-1">
              <p className="text-gray-700 dark:text-slate-300">
                <span className="font-medium">Inicio:</span> {startDate}
              </p>
              <p className="text-gray-700 dark:text-slate-300">
                <span className="font-medium">Fin estimado:</span> {endDate}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <Button
            onClick={handleClose}
            className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white"
          >
            Entendido
          </Button>
        </div>
      </div>
    </div>
  );
}