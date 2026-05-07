// Layout principal con Sidebar
import React from 'react';
import { Outlet, Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { usePermissions } from '@/hooks/usePermissions';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ThemeToggle';
import {
  Home,
  Calendar,
  Users,
  BookOpen,
  Building,
  UserCircle,
  Clock,
  FolderOpen,
  LogOut,
  Menu,
  X,
  GraduationCap,
  Tags,
  MapPin,
  AlertTriangle,
  CalendarCheck,
  BookMarked,
  Target,
  ChevronDown,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

interface MenuItem {
  icon: React.ElementType;
  label: string;
  path: string;
  adminOnly?: boolean;
  moduleId?: string;
}

interface MenuGroup {
  label: string;
  items: MenuItem[];
}

const menuGroups: MenuGroup[] = [
  {
    label: 'General',
    items: [
      { icon: Home, label: 'Dashboard', path: '/dashboard' },
      { icon: Calendar, label: 'Ciclos Escolares', path: '/ciclos', adminOnly: true },
      { icon: FolderOpen, label: 'Programas Académicos', path: '/programas', moduleId: 'programas' },
    ],
  },
  {
    label: 'LEIP',
    items: [
      { icon: FolderOpen, label: 'Programas LEIP', path: '/programas-leip', moduleId: 'programas-leip' },
      { icon: BookOpen, label: 'Materias LEIP', path: '/materias-leip', moduleId: 'materias-leip' },
    ],
  },
  {
    label: 'Maestrías',
    items: [
      { icon: CalendarCheck, label: 'Maestrías Sabatinas', path: '/maestrias-sabado', moduleId: 'maestrias-sabado' },
      { icon: BookMarked, label: 'Cargas Académicas', path: '/cargas-academicas', moduleId: 'cargas-academicas' },
      { icon: Target, label: 'Especializaciones', path: '/especializaciones', moduleId: 'especializaciones' },
    ],
  },
  {
    label: 'Catálogos Académicos',
    items: [
      { icon: BookOpen, label: 'Materias', path: '/materias', moduleId: 'materias' },
      { icon: Building, label: 'Grupos', path: '/grupos', moduleId: 'grupos' },
      { icon: Users, label: 'Maestros', path: '/maestros', moduleId: 'maestros' },
      { icon: FolderOpen, label: 'Módulos Académicos', path: '/modulos', adminOnly: true },
    ],
  },
  {
    label: 'Configuración',
    items: [
      { icon: Tags, label: 'Categorías', path: '/categorias', adminOnly: true },
      { icon: MapPin, label: 'Sedes', path: '/sedes', adminOnly: true },
      { icon: Clock, label: 'Disponibilidad', path: '/disponibilidad', moduleId: 'disponibilidad' },
      { icon: GraduationCap, label: 'Maestros Múltiples Prog.', path: '/maestros-multiples', moduleId: 'maestros-multiples' },
      { icon: AlertTriangle, label: 'Maestros Excedidos', path: '/maestros-excedidos', adminOnly: true },
      { icon: UserCircle, label: 'Usuarios', path: '/usuarios', adminOnly: true },
      { icon: FolderOpen, label: 'Módulos', path: '/modulos', adminOnly: true },
    ],
  },
];

export default function MainLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>(
    () => Object.fromEntries(menuGroups.map(g => [g.label, true]))
  );

  const toggleGroup = (label: string) => {
    setCollapsedGroups(prev => ({ ...prev, [label]: !prev[label] }));
  };
  const { user, role, signOut } = useAuthStore();
  const { hasModuleAccess, isAdmin, loading: permissionsLoading } = usePermissions();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await signOut();
      toast.success('Sesión cerrada correctamente');
      navigate('/login');
    } catch (error) {
      toast.error('Error al cerrar sesión');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 transition-colors duration-300">
      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 z-40 h-screen transition-all duration-300 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } bg-white dark:bg-slate-800 border-r border-gray-200 dark:border-slate-700/50 w-64 shadow-lg dark:shadow-slate-900/50`}
      >
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-gray-200 dark:border-slate-700/50 bg-gradient-to-r from-blue-50 to-orange-50 dark:from-slate-800 dark:to-slate-800">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-blue-600 dark:text-blue-400">UPN Sistema</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSidebarOpen(false)}
                className="lg:hidden hover:bg-white/50 dark:hover:bg-slate-700/50"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
            <p className="text-xs text-gray-600 dark:text-slate-400 mt-1">
              {role === 'admin' ? 'Administrador' : 'Coordinador'}
            </p>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto p-4 bg-white dark:bg-slate-800">
            <div className="space-y-4">
              {menuGroups.map((group) => {
                const visibleItems = group.items.filter((item) => {
                  if (item.adminOnly) return isAdmin;
                  if (item.moduleId && !isAdmin) {
                    return !permissionsLoading && hasModuleAccess(item.moduleId);
                  }
                  return true;
                });

                if (visibleItems.length === 0) return null;

                const isCollapsed = collapsedGroups[group.label] ?? false;

                return (
                  <div key={group.label}>
                    <button
                      onClick={() => toggleGroup(group.label)}
                      className="w-full flex items-center justify-between px-3 mb-1 group/header"
                    >
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-slate-400 group-hover/header:text-gray-600 dark:group-hover/header:text-slate-200 transition-colors">
                        {group.label}
                      </p>
                      <ChevronDown
                        className={`w-3 h-3 text-gray-400 dark:text-slate-400 transition-transform duration-200 ${isCollapsed ? '-rotate-90' : ''}`}
                      />
                    </button>
                    {!isCollapsed && (
                      <ul className="space-y-0.5">
                        {visibleItems.map((item) => (
                          <li key={item.path + item.label}>
                            <Link
                              to={item.path}
                              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-700 dark:text-slate-200 hover:bg-gradient-to-r hover:from-blue-50 hover:to-blue-50/50 dark:hover:from-slate-700 dark:hover:to-slate-700/50 hover:text-blue-600 dark:hover:text-blue-400 transition-all duration-200 group"
                            >
                              <item.icon className="w-5 h-5 group-hover:scale-110 transition-transform duration-200 shrink-0" />
                              <span className="text-sm font-medium">{item.label}</span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          </nav>

          {/* User section */}
          <div className="p-4 border-t border-gray-200 dark:border-slate-700/50 bg-gray-50 dark:bg-slate-800/50">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700 rounded-full flex items-center justify-center shadow-md">
                <UserCircle className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">{user?.email}</p>
                <p className="text-xs text-gray-600 dark:text-slate-400">{role}</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="w-full justify-start gap-2 border-gray-300 dark:border-slate-600 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 hover:border-red-300 dark:hover:border-red-700 transition-all duration-200"
            >
              <LogOut className="w-4 h-4" />
              Cerrar Sesión
            </Button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className={`${sidebarOpen ? 'lg:ml-64' : ''} transition-all duration-300`}>
        {/* Top bar */}
        <header className="bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700/50 px-4 py-3 sticky top-0 z-30 shadow-sm dark:shadow-slate-900/50 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="hover:bg-gray-100 dark:hover:bg-slate-700"
            >
              <Menu className="w-5 h-5" />
            </Button>
            <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-blue-700 dark:from-blue-400 dark:to-blue-500 bg-clip-text text-transparent">
              Sistema de Gestión Escolar
            </h1>
            <ThemeToggle />
          </div>
        </header>

        {/* Page content */}
        <main className="p-6 min-h-screen bg-gray-50 dark:bg-slate-900">
          <Outlet />
        </main>

        {/* Footer */}
        <footer className="border-t border-gray-200 dark:border-slate-700/50 bg-white dark:bg-slate-800 px-6 py-3">
          <p className="text-center text-xs text-gray-400 dark:text-slate-500">
            Desarrollado por{' '}
            <span className="font-medium text-gray-600 dark:text-slate-400">Ing. Juan Téllez</span>
            {' '}y{' '}
            <a
              href="https://daeonix.com"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-blue-600 dark:text-blue-400 hover:underline"
            >
              Daeonix Systems
            </a>
            {' '}· © {new Date().getFullYear()}
          </p>
        </footer>
      </div>
    </div>
  );
}