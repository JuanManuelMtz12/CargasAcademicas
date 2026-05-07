import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { Button } from '@/components/ui/button';

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggleTheme}
      className="w-10 h-10 p-0 rounded-full transition-all duration-300 hover:bg-gradient-to-br hover:from-blue-50 hover:to-orange-50 dark:hover:from-slate-700 dark:hover:to-slate-700 hover:scale-110 active:scale-95 group relative overflow-hidden"
      title={theme === 'light' ? 'Activar modo oscuro' : 'Activar modo claro'}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-orange-500/10 dark:from-blue-500/5 dark:to-orange-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
      {theme === 'light' ? (
        <Moon className="w-5 h-5 text-gray-700 dark:text-slate-300 transition-all duration-300 group-hover:text-blue-600 group-hover:rotate-12" />
      ) : (
        <Sun className="w-5 h-5 text-yellow-500 dark:text-yellow-400 transition-all duration-300 group-hover:rotate-90 group-hover:text-orange-500" />
      )}
    </Button>
  );
}
