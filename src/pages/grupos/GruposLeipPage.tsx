import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Building, Plus, Search, MapPin, GraduationCap, Trash2, Edit } from 'lucide-react';
import { toast } from 'sonner';

// Interfaces de ejemplo (ajústalas a tu modelo de datos)
interface GrupoLeip {
  id: string;
  name: string; // Ej: "1º A"
  programId: string;
  programName: string;
  sedeId: string;
  sedeName: string;
  capacity: number;
}

export default function GruposLeipPage() {
  const [searchParams] = useSearchParams();
  const programFilter = searchParams.get('programId'); // Para cuando vengas desde ProgramasLeipPage

  // Estados
  const [grupos, setGrupos] = useState<GrupoLeip[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  // Formulario
  const [formData, setFormData] = useState({
    name: '',
    programId: programFilter || '',
    sedeId: '',
    capacity: 30
  });

  // Cargar datos simulados o de tu API
  useEffect(() => {
    // Aquí harías tu fetch a la API filtrando si existe programFilter
    const mockGrupos: GrupoLeip[] = [
      { id: '1', name: '1º Semestre Grupo A', programId: 'leip-1', programName: 'Lic. en Educación e Innovación Pedagógica', sedeId: 's-1', sedeName: 'Sede Central Teziutlán', capacity: 35 },
      { id: '2', name: '3º Semestre Grupo B', programId: 'leip-1', programName: 'Lic. en Educación e Innovación Pedagógica', sedeId: 's-2', sedeName: 'Sede Virtual / En línea', capacity: 30 },
    ];
    
    if (programFilter) {
      setGrupos(mockGrupos.filter(g => g.programId === programFilter));
    } else {
      setGrupos(mockGrupos);
    }
  }, [programFilter]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.programId || !formData.sedeId) {
      toast.error('Por favor, completa todos los campos requeridos');
      return;
    }
    
    // Aquí agregarías la lógica de guardar en tu BD
    toast.success('Grupo LEIP creado correctamente');
    setIsDialogOpen(false);
    setFormData({ name: '', programId: programFilter || '', sedeId: '', capacity: 30 });
  };

  const filteredGrupos = grupos.filter(g => 
    g.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    g.sedeName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Building className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            Grupos LEIP
          </h2>
          <p className="text-sm text-muted-foreground">
            Gestión exclusiva de grupos asignados a Sedes y Programas de la Licenciatura LEIP.
          </p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-700 text-white gap-2">
              <Plus className="w-4 h-4" /> Nuevo Grupo LEIP
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Crear Grupo LEIP</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 pt-4">
              <div className="space-y-1">
                <label className="text-sm font-medium">Nombre del Grupo</label>
                <Input 
                  placeholder="Ej: 1º Semestre Grupo A" 
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium">Programa LEIP</label>
                <Select 
                  value={formData.programId} 
                  onValueChange={val => setFormData({...formData, programId: val})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona el programa" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="leip-1">Lic. en Educación e Innovación Pedagógica</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium">Sede</label>
                <Select 
                  value={formData.sedeId} 
                  onValueChange={val => setFormData({...formData, sedeId: val})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona la sede" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="s-1">Sede Central Teziutlán</SelectItem>
                    <SelectItem value="s-2">Sede Virtual / En línea</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium">Capacidad de Alumnos</label>
                <Input 
                  type="number" 
                  value={formData.capacity}
                  onChange={e => setFormData({...formData, capacity: parseInt(e.target.value) || 0})}
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
                <Button type="submit" className="bg-blue-600 text-white hover:bg-blue-700">Guardar</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Barra de Búsqueda */}
      <div className="flex items-center max-w-md relative">
        <Search className="w-4 h-4 text-gray-400 absolute left-3 pointer-events-none" />
        <Input
          placeholder="Buscar por nombre o sede..."
          className="pl-9"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Tabla de Resultados */}
      <div className="bg-white dark:bg-slate-800 border rounded-xl overflow-hidden shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50 dark:bg-slate-800/50">
              <TableHead>Grupo</TableHead>
              <TableHead>Programa Académico</TableHead>
              <TableHead>Sede Asignada</TableHead>
              <TableHead className="text-center">Capacidad</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredGrupos.length > 0 ? (
              filteredGrupos.map((grupo) => (
                <TableRow key={grupo.id}>
                  <TableCell className="font-semibold text-slate-900 dark:text-slate-100">
                    {grupo.name}
                  </TableCell>
                  <TableCell className="text-muted-foreground flex items-center gap-1.5 py-4">
                    <GraduationCap className="w-4 h-4 text-slate-400" />
                    {grupo.programName}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-700 text-xs font-medium text-slate-800 dark:text-slate-200">
                      <MapPin className="w-3 h-3 text-orange-500" />
                      {grupo.sedeName}
                    </span>
                  </TableCell>
                  <TableCell className="text-center font-medium">
                    {grupo.capacity} alumnos
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-blue-600">
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-red-600">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  No se encontraron grupos LEIP registrados.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}