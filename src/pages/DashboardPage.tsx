// Dashboard principal
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { usePermissions } from '@/hooks/usePermissions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Calendar,
  Users,
  BookOpen,
  Building,
  FolderOpen,
  Clock,
} from 'lucide-react';

interface Stats {
  programas: number;
  maestros: number;
  materias: number;
  grupos: number;
  ciclosActivos: number;
  horariosAsignados: number;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats>({
    programas: 0,
    maestros: 0,
    materias: 0,
    grupos: 0,
    ciclosActivos: 0,
    horariosAsignados: 0,
  });
  const [loading, setLoading] = useState(true);
  const { allowedPrograms, isAdmin, loading: permissionsLoading } = usePermissions();

  useEffect(() => {
    if (!permissionsLoading) {
      loadStats();
    }
  }, [permissionsLoading, allowedPrograms, isAdmin]);

  const loadStats = async () => {
    try {
      let programasQuery = supabase.from('programs').select('id', { count: 'exact', head: true });
      let materiasQuery = supabase.from('subjects').select('id', { count: 'exact', head: true });
      let gruposQuery = supabase.from('groups').select('id', { count: 'exact', head: true });
      
      // Filtrar por programas permitidos si es coordinador
      if (!isAdmin && allowedPrograms.length > 0) {
        programasQuery = programasQuery.in('id', allowedPrograms);
        materiasQuery = materiasQuery.in('program_id', allowedPrograms);
        gruposQuery = gruposQuery.in('program_id', allowedPrograms);
      }

      const [programas, materias, grupos, ciclos] = await Promise.all([
        programasQuery,
        materiasQuery,
        gruposQuery,
        supabase.from('school_cycles').select('id', { count: 'exact', head: true }).eq('is_active', true),
      ]);

      // Contar maestros asignados a los programas permitidos
      let maestrosCount = 0;
      if (isAdmin) {
        const { count } = await supabase.from('teachers').select('id', { count: 'exact', head: true });
        maestrosCount = count || 0;
      } else if (allowedPrograms.length > 0) {
        const { data: teacherIds } = await supabase
          .from('teacher_program')
          .select('teacher_id')
          .in('program_id', allowedPrograms);
        
        const uniqueTeachers = new Set(teacherIds?.map(t => t.teacher_id) || []);
        maestrosCount = uniqueTeachers.size;
      }

      // Contar horarios de las materias permitidas
      let horariosCount = 0;
      if (isAdmin) {
        const { count } = await supabase.from('schedule').select('id', { count: 'exact', head: true });
        horariosCount = count || 0;
      } else if (allowedPrograms.length > 0) {
        const { data: subjectsIds } = await supabase
          .from('subjects')
          .select('id')
          .in('program_id', allowedPrograms);
        
        if (subjectsIds && subjectsIds.length > 0) {
          const { count } = await supabase
            .from('schedule')
            .select('id', { count: 'exact', head: true })
            .in('subject_id', subjectsIds.map(s => s.id));
          horariosCount = count || 0;
        }
      }

      setStats({
        programas: programas.count || 0,
        maestros: maestrosCount,
        materias: materias.count || 0,
        grupos: grupos.count || 0,
        ciclosActivos: ciclos.count || 0,
        horariosAsignados: horariosCount,
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      title: 'Programas',
      value: stats.programas,
      icon: FolderOpen,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
      link: '/programas',
    },
    {
      title: 'Maestros',
      value: stats.maestros,
      icon: Users,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
      link: '/maestros',
    },
    {
      title: 'Materias',
      value: stats.materias,
      icon: BookOpen,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100',
      link: '/materias',
    },
    {
      title: 'Grupos',
      value: stats.grupos,
      icon: Building,
      color: 'text-orange-600',
      bgColor: 'bg-orange-100',
      link: '/grupos',
    },
    {
      title: 'Ciclos Activos',
      value: stats.ciclosActivos,
      icon: Calendar,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-100',
      link: '/ciclos',
    },
    {
      title: 'Horarios Asignados',
      value: stats.horariosAsignados,
      icon: Clock,
      color: 'text-pink-600',
      bgColor: 'bg-pink-100',
      link: '/programas',
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-slate-100">Dashboard</h1>
        <p className="text-gray-600 dark:text-slate-400 mt-1">Bienvenido al sistema de gestión escolar</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <Link key={stat.title} to={stat.link}>
              <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">
                    {stat.title}
                  </CardTitle>
                  <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                    <Icon className={`w-5 h-5 ${stat.color}`} />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-gray-900 dark:text-slate-100">{stat.value}</div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>


    </div>
  );
}