import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Calendar } from 'lucide-react';

interface CalendarSelectorProps {
  startDate: string;
  endDate: string;
  selectedDays: string[]; // ["lunes", "sábados"]
  value: Record<string, number[]>; // {"noviembre": [8, 15, 22], ...}
  onChange: (value: Record<string, number[]>) => void;
}

const MONTHS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
];

const DAYS_OF_WEEK = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábados'];

export default function CalendarSelector({
  startDate,
  endDate,
  selectedDays,
  value,
  onChange,
}: CalendarSelectorProps) {
  const [schedule, setSchedule] = useState<Record<string, number[]>>(value || {});

  useEffect(() => {
    if (startDate && endDate && selectedDays.length > 0) {
      // Auto-generar fechas basado en días seleccionados
      const generated = generateSchedule(startDate, endDate, selectedDays);
      setSchedule(generated);
      onChange(generated);
    }
  }, [startDate, endDate, selectedDays]);

  const generateSchedule = (start: string, end: string, days: string[]): Record<string, number[]> => {
    if (!start || !end || days.length === 0) return {};

    const startDateObj = new Date(start);
    const endDateObj = new Date(end);
    const schedule: Record<string, number[]> = {};

    // Mapeo de días en español a índices de JS (0=domingo, 6=sábado)
    const dayIndexMap: Record<string, number> = {
      'domingo': 0,
      'lunes': 1,
      'martes': 2,
      'miércoles': 3,
      'jueves': 4,
      'viernes': 5,
      'sábados': 6,
      'sábado': 6,
    };

    const selectedDayIndices = days.map(day => dayIndexMap[day.toLowerCase()]).filter(idx => idx !== undefined);

    // Iterar día por día
    const currentDate = new Date(startDateObj);
    while (currentDate <= endDateObj) {
      const dayOfWeek = currentDate.getDay();
      
      if (selectedDayIndices.includes(dayOfWeek)) {
        const monthName = MONTHS[currentDate.getMonth()];
        const dayOfMonth = currentDate.getDate();
        
        if (!schedule[monthName]) {
          schedule[monthName] = [];
        }
        schedule[monthName].push(dayOfMonth);
      }
      
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Ordenar días en cada mes
    Object.keys(schedule).forEach(month => {
      schedule[month].sort((a, b) => a - b);
    });

    return schedule;
  };

  const toggleDay = (month: string, day: number) => {
    const newSchedule = { ...schedule };
    if (!newSchedule[month]) {
      newSchedule[month] = [];
    }

    const index = newSchedule[month].indexOf(day);
    if (index > -1) {
      newSchedule[month].splice(index, 1);
      if (newSchedule[month].length === 0) {
        delete newSchedule[month];
      }
    } else {
      newSchedule[month].push(day);
      newSchedule[month].sort((a, b) => a - b);
    }

    setSchedule(newSchedule);
    onChange(newSchedule);
  };

  const getDaysInMonth = (year: number, month: number): number => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getMonthsInRange = (): Array<{ name: string; year: number; month: number }> => {
    if (!startDate || !endDate) return [];

    const start = new Date(startDate);
    const end = new Date(endDate);
    const months: Array<{ name: string; year: number; month: number }> = [];

    const currentDate = new Date(start);
    while (currentDate <= end) {
      months.push({
        name: MONTHS[currentDate.getMonth()],
        year: currentDate.getFullYear(),
        month: currentDate.getMonth(),
      });
      currentDate.setMonth(currentDate.getMonth() + 1);
    }

    return months;
  };

  const monthsInRange = getMonthsInRange();

  if (!startDate || !endDate || selectedDays.length === 0) {
    return (
      <div className="p-4 border border-dashed border-gray-300 rounded-lg text-center text-gray-500 text-sm">
        <Calendar className="h-8 w-8 mx-auto mb-2 text-gray-400" />
        Selecciona fechas de inicio/fin y días de la semana para generar el calendario
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label>Calendario de Sesiones Presenciales</Label>
        <span className="text-xs text-gray-500">
          Total: {Object.values(schedule).reduce((sum, days) => sum + days.length, 0)} sesiones
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {monthsInRange.map(({ name, year, month }) => {
          const daysInMonth = getDaysInMonth(year, month);
          const monthSchedule = schedule[name] || [];

          return (
            <div key={`${year}-${month}`} className="border border-gray-200 rounded-lg p-3">
              <h4 className="font-semibold text-sm mb-2 capitalize text-gray-900 dark:text-gray-100">
                {name} {year}
              </h4>
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
                  const isSelected = monthSchedule.includes(day);
                  const date = new Date(year, month, day);
                  const dayOfWeek = DAYS_OF_WEEK[date.getDay()];
                  const isValidDay = selectedDays.some(d => d.toLowerCase() === dayOfWeek.toLowerCase());

                  return (
                    <Button
                      key={day}
                      type="button"
                      variant={isSelected ? 'default' : 'outline'}
                      size="sm"
                      className={`h-8 w-8 p-0 text-xs ${
                        !isValidDay ? 'opacity-30 cursor-not-allowed' : ''
                      }`}
                      onClick={() => isValidDay && toggleDay(name, day)}
                      disabled={!isValidDay}
                    >
                      {day}
                    </Button>
                  );
                })}
              </div>
              {monthSchedule.length > 0 && (
                <div className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                  Días: {monthSchedule.join(', ')}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {Object.keys(schedule).length === 0 && (
        <div className="text-center text-sm text-gray-500 py-4">
          No hay sesiones programadas. Ajusta los días seleccionados o haz clic en los días del calendario.
        </div>
      )}
    </div>
  );
}
