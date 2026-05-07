import { useEffect, useState, useCallback } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import { supabase } from '@/lib/supabase';
import { Database } from '@/types/database';
import { toast } from 'sonner';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plus, Edit, Trash2, Search, BookOpen, Upload, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';

type Subject = Database['public']['Tables']['subjects']['Row'];
type SubjectInsert = Database['public']['Tables']['subjects']['Insert'];

interface SubjectWithProgram extends Subject {
  program?: {
    id: string;
    name: string;
    type: string;
    sede?: {
      id: string;
      name: string;
    } | null;
  } | null;
}

interface Program {
  id: string;
  name: string;
  type: string;
  sede?: {
    id: string;
    name: string;
  } | null;
}

interface FormData {
  program_id: string;
  clave: string;
  name: string;
  credits: number | null;
}

const ITEMS_PER_PAGE = 5;

export default function MateriasPage() {
  const { allowedPrograms, isAdmin, canCreate, canEdit, canDelete, loading: permLoading } = usePermissions();
  const [subjects, setSubjects] = useState<SubjectWithProgram[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<SubjectWithProgram | null>(null);
  const [deletingSubject, setDeletingSubject] = useState<SubjectWithProgram | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Filtros y búsqueda
  const [searchTerm, setSearchTerm] = useState('');
  const [filterProgram, setFilterProgram] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);

  const [formData, setFormData] = useState<FormData>({
    program_id: '',
    clave: '',
    name: '',
    credits: null,
  });

  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});

  // Estados para importación
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [fileInputKey, setFileInputKey] = useState(0); // Para resetear el input
  const [importResults, setImportResults] = useState<{
    total: number;
    successful: number;
    failed: number;
    errors: { row: number; clave: string; name: string; error: string }[];
  } | null>(null);

  useEffect(() => {
    if (!permLoading) loadData();
  }, [permLoading]);

  // Resetear página al cambiar filtros
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterProgram]);

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([loadSubjects(), loadPrograms()]);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Error al cargar los datos');
    } finally {
      setLoading(false);
    }
  };

  const loadSubjects = async () => {
    try {
      let query = supabase
        .from('subjects')
        .select(`
          *,
          program:program_id (
            id,
            name,
            type,
            sede:sede_id (
              id,
              name
            )
          )
        `)
        .order('clave');

      if (!isAdmin && allowedPrograms.length > 0) {
        query = query.eq('program_id', allowedPrograms[0]);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      // Procesar los datos para manejar sede como array
      const processedData = (data || []).map((subject: any) => ({
        ...subject,
        program: subject.program ? {
          ...subject.program,
          sede: Array.isArray(subject.program.sede) ? subject.program.sede[0] : subject.program.sede
        } : null
      }));
      
      setSubjects(processedData);
    } catch (error) {
      console.error('Error loading subjects:', error);
      throw error;
    }
  };

  const loadPrograms = async () => {
    try {
      let query = supabase
        .from('programs')
        .select(`
          id,
          name,
          type,
          sede:sede_id (
            id,
            name
          )
        `)
        .order('name');

      if (!isAdmin && allowedPrograms.length > 0) {
        query = query.eq('id', allowedPrograms[0]);
      }

      const { data, error } = await query;

      if (error) throw error;
      
      // Procesar los datos para asegurar el tipo correcto
      const processedData = (data || []).map((program: any) => ({
        id: program.id,
        name: program.name,
        type: program.type,
        sede: Array.isArray(program.sede) ? program.sede[0] : program.sede
      }));
      
      setPrograms(processedData);
    } catch (error) {
      console.error('Error loading programs:', error);
      throw error;
    }
  };

  // Filtrado y búsqueda
  const filteredSubjects = subjects.filter((subject) => {
    const matchesSearch =
      searchTerm === '' ||
      subject.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      subject.clave.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesProgram =
      filterProgram === 'all' || subject.program_id === filterProgram;

    return matchesSearch && matchesProgram;
  });

  // Paginación
  const totalPages = Math.ceil(filteredSubjects.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedSubjects = filteredSubjects.slice(startIndex, endIndex);

  const openCreateModal = () => {
    setEditingSubject(null);
    setFormData({
      program_id: '',
      clave: '',
      name: '',
      credits: null,
    });
    setErrors({});
    setIsModalOpen(true);
  };

  const openEditModal = (subject: SubjectWithProgram) => {
    setEditingSubject(subject);
    setFormData({
      program_id: subject.program_id,
      clave: subject.clave,
      name: subject.name,
      credits: subject.credits,
    });
    setErrors({});
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingSubject(null);
    setFormData({
      program_id: '',
      clave: '',
      name: '',
      credits: null,
    });
    setErrors({});
  };

  const validateForm = async (): Promise<boolean> => {
    const newErrors: Partial<Record<keyof FormData, string>> = {};

    if (!formData.program_id) {
      newErrors.program_id = 'El programa es requerido';
    }

    if (!formData.clave.trim()) {
      newErrors.clave = 'La clave es requerida';
    }

    if (!formData.name.trim()) {
      newErrors.name = 'El nombre es requerido';
    }

    // Validar duplicados de clave en el mismo programa
    if (formData.program_id && formData.clave.trim()) {
      const { data: existingSubjects, error } = await supabase
        .from('subjects')
        .select('id')
        .eq('program_id', formData.program_id)
        .eq('clave', formData.clave.trim());

      if (error) {
        console.error('Error checking duplicate:', error);
      } else if (existingSubjects && existingSubjects.length > 0) {
        // Si estamos editando, verificar que no sea el mismo registro
        const isDuplicate = editingSubject
          ? existingSubjects.some((s) => s.id !== editingSubject.id)
          : existingSubjects.length > 0;

        if (isDuplicate) {
          newErrors.clave = 'Ya existe una materia con esta clave en el programa seleccionado';
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const isValid = await validateForm();
    if (!isValid) {
      toast.error('Por favor corrija los errores en el formulario');
      return;
    }

    setSubmitting(true);

    try {
      const subjectData: SubjectInsert = {
        program_id: formData.program_id,
        clave: formData.clave.trim(),
        name: formData.name.trim(),
        credits: formData.credits,
        module_id: null,
      };

      if (editingSubject) {
        // Actualizar
        const { error } = await supabase
          .from('subjects')
          .update(subjectData)
          .eq('id', editingSubject.id);

        if (error) throw error;
        toast.success('Materia actualizada exitosamente');
      } else {
        // Crear
        const { error } = await supabase
          .from('subjects')
          .insert([subjectData]);

        if (error) throw error;
        toast.success('Materia creada exitosamente');
      }

      closeModal();
      await loadSubjects();
    } catch (error: any) {
      console.error('Error saving subject:', error);
      toast.error(error.message || 'Error al guardar la materia');
    } finally {
      setSubmitting(false);
    }
  };

  const openDeleteDialog = (subject: SubjectWithProgram) => {
    setDeletingSubject(subject);
    setIsDeleteDialogOpen(true);
  };

  const closeDeleteDialog = () => {
    setIsDeleteDialogOpen(false);
    setDeletingSubject(null);
  };

  const handleDelete = async () => {
    if (!deletingSubject) return;

    try {
      // Verificar si hay horarios asociados
      const { count: schedulesCount } = await supabase
        .from('schedule')
        .select('*', { count: 'exact', head: true })
        .eq('subject_id', deletingSubject.id);

      if (schedulesCount && schedulesCount > 0) {
        toast.error('No se puede eliminar la materia porque tiene horarios asociados');
        closeDeleteDialog();
        return;
      }

      const { error } = await supabase
        .from('subjects')
        .delete()
        .eq('id', deletingSubject.id);

      if (error) throw error;

      toast.success('Materia eliminada exitosamente');
      closeDeleteDialog();
      await loadSubjects();
    } catch (error: any) {
      console.error('Error deleting subject:', error);
      toast.error(error.message || 'Error al eliminar la materia');
    }
  };

  const getProgramTypeBadgeColor = (type: string) => {
    switch (type) {
      case 'LIC':
        return 'bg-blue-100 text-blue-800';
      case 'LEIP':
        return 'bg-green-100 text-green-800';
      case 'MAE':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const handleOpenImportModal = () => {
    setIsImportModalOpen(true);
    setImportFile(null);
    setImportResults(null);
  };

  const handleCloseImportModal = () => {
    setIsImportModalOpen(false);
    setImportFile(null);
    setImportResults(null);
    setFileInputKey(prev => prev + 1); // Resetear el input file
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const validExtensions = ['.xlsx', '.xls'];
      const fileName = file.name.toLowerCase();
      const isValidExtension = validExtensions.some(ext => fileName.endsWith(ext));
      
      if (!isValidExtension) {
        toast.error('Por favor, seleccione un archivo Excel válido (.xlsx o .xls)');
        e.target.value = ''; // Reset input
        setImportFile(null);
        return;
      }
      
      setImportFile(file);
      setImportResults(null);
    }
  };

  const handleDownloadTemplate = () => {
    // Crear datos de ejemplo con programas y sedes reales
    const templateData: any[] = [];
    
    // Obtener 3 ejemplos de programas reales con sus sedes
    const examplePrograms = programs.slice(0, 3);
    
    if (examplePrograms.length > 0) {
      examplePrograms.forEach((prog, index) => {
        const sedeNombre = prog.sede?.name || 'Sin Sede';
        templateData.push({
          'Clave': `MAT${101 + index}`,
          'Nombre': `Materia Ejemplo ${index + 1}`,
          'Programa': prog.name,
          'Sede': sedeNombre,
          'Créditos': 8
        });
      });
    } else {
      // Si no hay programas, usar ejemplos genéricos
      templateData.push(
        { 'Clave': 'MAT101', 'Nombre': 'Matemáticas Básicas', 'Programa': 'Administración Educativa', 'Sede': 'Huehuetla', 'Créditos': 8 },
        { 'Clave': 'FIS101', 'Nombre': 'Física I', 'Programa': 'Administración Educativa', 'Sede': 'Teziutlan', 'Créditos': 10 },
        { 'Clave': 'QUIM101', 'Nombre': 'Química General', 'Programa': 'Pedagogía', 'Sede': 'Huehuetla', 'Créditos': 8 }
      );
    }

    // Agregar información de programas disponibles con sus sedes
    const programsInfo = programs.map(prog => ({
      'Programa': prog.name,
      'Sede': prog.sede?.name || 'Sin Sede',
      'Tipo': prog.type,
      'ID': prog.id
    }));

    // Crear workbook
    const wb = XLSX.utils.book_new();

    // Hoja 1: Template de materias
    const ws1 = XLSX.utils.json_to_sheet(templateData);
    XLSX.utils.book_append_sheet(wb, ws1, 'Materias');

    // Hoja 2: Programas disponibles
    const ws2 = XLSX.utils.json_to_sheet(programsInfo);
    XLSX.utils.book_append_sheet(wb, ws2, 'Programas Disponibles');

    // Descargar
    XLSX.writeFile(wb, 'plantilla_materias.xlsx');
    toast.success('Plantilla descargada correctamente');
  };

  const handleImportExcel = async () => {
    if (!importFile) {
      toast.error('Por favor, seleccione un archivo');
      return;
    }

    setIsImporting(true);
    const errors: { row: number; clave: string; name: string; error: string }[] = [];
    let successful = 0;
    let total = 0;

    try {
      // Leer archivo
      const data = await importFile.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[];

      if (jsonData.length === 0) {
        toast.error('El archivo está vacío');
        return;
      }

      total = jsonData.length;

      // Crear un mapa de programas para búsqueda rápida (usando nombre + sede como clave)
      const programMap = new Map<string, string>();
      programs.forEach(prog => {
        const sedeNombre = prog.sede?.name || 'sin sede';
        const key = `${prog.name.toLowerCase().trim()}|${sedeNombre.toLowerCase().trim()}`;
        programMap.set(key, prog.id);
      });

      // Procesar cada fila
      for (let i = 0; i < jsonData.length; i++) {
        const row = jsonData[i];
        const rowNumber = i + 2;

        // Obtener datos (soportar diferentes nombres de columna)
        const clave = (row['Clave'] || row['clave'] || row['Key'] || row['key'] || '').toString().trim();
        const name = (row['Nombre'] || row['nombre'] || row['Name'] || row['name'] || '').toString().trim();
        const programName = (row['Programa'] || row['programa'] || row['Program'] || row['program'] || '').toString().trim();
        const sedeName = (row['Sede'] || row['sede'] || row['Campus'] || row['campus'] || '').toString().trim();
        const creditsValue = row['Créditos'] || row['creditos'] || row['Credits'] || row['credits'];
        const credits = creditsValue ? parseInt(creditsValue.toString()) : null;

        // Validar datos
        if (!clave) {
          errors.push({ row: rowNumber, clave: '-', name: name || '-', error: 'Clave vacía' });
          continue;
        }

        if (!name) {
          errors.push({ row: rowNumber, clave, name: '-', error: 'Nombre vacío' });
          continue;
        }

        if (!programName) {
          errors.push({ row: rowNumber, clave, name, error: 'Programa vacío' });
          continue;
        }

        if (!sedeName) {
          errors.push({ row: rowNumber, clave, name, error: 'Sede vacía' });
          continue;
        }

        // Buscar programa usando nombre + sede
        const programKey = `${programName.toLowerCase()}|${sedeName.toLowerCase()}`;
        const programId = programMap.get(programKey);
        if (!programId) {
          errors.push({ row: rowNumber, clave, name, error: `Programa "${programName}" en sede "${sedeName}" no encontrado` });
          continue;
        }

        // Verificar duplicados (misma clave en el mismo programa)
        const { data: existingSubjects, error: checkError } = await supabase
          .from('subjects')
          .select('id, clave')
          .eq('program_id', programId)
          .eq('clave', clave);

        if (checkError) {
          errors.push({ row: rowNumber, clave, name, error: `Error al validar: ${checkError.message}` });
          continue;
        }

        if (existingSubjects && existingSubjects.length > 0) {
          errors.push({ row: rowNumber, clave, name, error: 'Ya existe una materia con esta clave en este programa' });
          continue;
        }

        // Insertar materia
        const { error: insertError } = await supabase
          .from('subjects')
          .insert({
            program_id: programId,
            clave,
            name,
            credits,
            module_id: null,
          });

        if (insertError) {
          errors.push({ row: rowNumber, clave, name, error: insertError.message });
          continue;
        }

        successful++;
      }

      // Mostrar resultados
      setImportResults({
        total,
        successful,
        failed: errors.length,
        errors
      });

      if (successful > 0) {
        toast.success(`Se importaron ${successful} de ${total} materias correctamente`);
        loadSubjects();
      }

      if (errors.length > 0) {
        toast.warning(`${errors.length} registros con errores`);
      }

    } catch (error: any) {
      console.error('Error importing Excel:', error);
      toast.error('Error al procesar el archivo: ' + error.message);
    } finally {
      setIsImporting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-slate-100">Materias</h1>
          <p className="text-gray-600 dark:text-slate-400 mt-1">
            Gestión de materias por programa académico
          </p>
        </div>
        <div className="flex gap-2">
          {(isAdmin || canCreate('materias')) && (
            <>
              <Button onClick={handleOpenImportModal} variant="outline" className="gap-2">
                <Upload className="w-4 h-4" />
                Importar desde Excel
              </Button>
              <Button onClick={openCreateModal} className="gap-2">
                <Plus className="w-4 h-4" />
                Nueva Materia
              </Button>
            </>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Materias</CardTitle>
          <CardDescription>
            {filteredSubjects.length} materia{filteredSubjects.length !== 1 ? 's' : ''}{' '}
            {searchTerm || filterProgram !== 'all' ? 'filtrada' : 'registrada'}
            {filteredSubjects.length !== 1 ? 's' : ''}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filtros */}
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Búsqueda */}
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Buscar por nombre o clave..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Filtro por programa — solo para admin */}
            {isAdmin && (
              <div className="sm:w-64">
                <Select value={filterProgram} onValueChange={setFilterProgram}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filtrar por programa" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los programas</SelectItem>
                    {programs.map((program) => (
                      <SelectItem key={program.id} value={program.id}>
                        {program.name}{program.sede ? ` (${program.sede.name})` : ` (${program.type})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Tabla */}
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Clave</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Programa</TableHead>
                  <TableHead className="text-center">Créditos</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedSubjects.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-gray-500 py-8">
                      <div className="flex flex-col items-center gap-2">
                        <BookOpen className="w-12 h-12 text-gray-400" />
                        <p>
                          {searchTerm || filterProgram !== 'all'
                            ? 'No se encontraron materias con los filtros aplicados'
                            : 'No hay materias registradas'}
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedSubjects.map((subject) => (
                    <TableRow key={subject.id}>
                      <TableCell className="font-mono font-semibold">
                        {subject.clave}
                      </TableCell>
                      <TableCell className="font-medium">{subject.name}</TableCell>
                      <TableCell>
                        {subject.program ? (
                          <div className="flex flex-col gap-1">
                            <span className="text-sm">{subject.program.name}</span>
                            {(subject.program.sede || subject.program.type) && (
                              <span
                                className={`px-2 py-0.5 rounded-full text-xs font-semibold w-fit ${getProgramTypeBadgeColor(
                                  subject.program.type
                                )}`}
                              >
                                {subject.program.sede ? subject.program.sede.name : subject.program.type}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {subject.credits !== null ? (
                          <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-blue-100 text-blue-800 text-sm font-semibold">
                            {subject.credits}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {(isAdmin || canEdit('materias')) && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openEditModal(subject)}
                              className="gap-1"
                            >
                              <Edit className="w-4 h-4" />
                              Editar
                            </Button>
                          )}
                          {(isAdmin || canDelete('materias')) && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openDeleteDialog(subject)}
                              className="gap-1 text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="w-4 h-4" />
                              Eliminar
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Paginación */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4">
              <div className="text-sm text-gray-600 dark:text-slate-400">
                Mostrando {startIndex + 1} a {Math.min(endIndex, filteredSubjects.length)} de{' '}
                {filteredSubjects.length} resultado{filteredSubjects.length !== 1 ? 's' : ''}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                >
                  Anterior
                </Button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <Button
                      key={page}
                      variant={currentPage === page ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setCurrentPage(page)}
                      className="w-10"
                    >
                      {page}
                    </Button>
                  ))}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                >
                  Siguiente
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de Creación/Edición */}
      <Dialog open={isModalOpen} onOpenChange={closeModal}>
        <DialogContent className="sm:max-w-[500px]">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>
                {editingSubject ? 'Editar Materia' : 'Nueva Materia'}
              </DialogTitle>
              <DialogDescription>
                {editingSubject
                  ? 'Modifica los datos de la materia'
                  : 'Completa los datos para crear una nueva materia'}
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              {/* Programa */}
              <div className="grid gap-2">
                <Label htmlFor="program_id">
                  Programa <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={formData.program_id}
                  onValueChange={(value) =>
                    setFormData({ ...formData, program_id: value })
                  }
                >
                  <SelectTrigger className={errors.program_id ? 'border-red-500' : ''}>
                    <SelectValue placeholder="Selecciona el programa" />
                  </SelectTrigger>
                  <SelectContent>
                    {programs.map((program) => (
                      <SelectItem key={program.id} value={program.id}>
                        {program.name}{program.sede ? ` (${program.sede.name})` : ` (${program.type})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.program_id && (
                  <p className="text-sm text-red-500">{errors.program_id}</p>
                )}
              </div>

              {/* Clave */}
              <div className="grid gap-2">
                <Label htmlFor="clave">
                  Clave <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="clave"
                  value={formData.clave}
                  onChange={(e) =>
                    setFormData({ ...formData, clave: e.target.value })
                  }
                  placeholder="Ej: MAT101"
                  className={errors.clave ? 'border-red-500' : ''}
                />
                {errors.clave && (
                  <p className="text-sm text-red-500">{errors.clave}</p>
                )}
              </div>

              {/* Nombre */}
              <div className="grid gap-2">
                <Label htmlFor="name">
                  Nombre <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="Ej: Matemáticas Básicas"
                  className={errors.name ? 'border-red-500' : ''}
                />
                {errors.name && (
                  <p className="text-sm text-red-500">{errors.name}</p>
                )}
              </div>

              {/* Créditos */}
              <div className="grid gap-2">
                <Label htmlFor="credits">
                  Créditos <span className="text-gray-500">(opcional)</span>
                </Label>
                <Input
                  id="credits"
                  type="number"
                  min="0"
                  step="1"
                  value={formData.credits === null ? '' : formData.credits}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      credits: e.target.value === '' ? null : parseInt(e.target.value),
                    })
                  }
                  placeholder="Ej: 8"
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={closeModal}
                disabled={submitting}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting
                  ? 'Guardando...'
                  : editingSubject
                  ? 'Actualizar'
                  : 'Crear Materia'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Importación */}
      <Dialog open={isImportModalOpen} onOpenChange={handleCloseImportModal}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Importar Materias desde Excel</DialogTitle>
            <DialogDescription>
              Carga materias de forma masiva usando un archivo Excel
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Instrucciones */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-blue-800 dark:text-blue-300 mb-2">
                Instrucciones:
              </h3>
              <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1 list-disc list-inside">
                <li>El archivo debe ser formato Excel (.xlsx o .xls)</li>
                <li>Debe tener las columnas: "Clave", "Nombre", "Programa", "Sede" y "Créditos" (opcional)</li>
                <li>El programa y la sede deben coincidir exactamente con los programas existentes</li>
                <li>Las claves duplicadas en el mismo programa serán ignoradas</li>
              </ul>
            </div>

            {/* Botón descargar plantilla */}
            <div className="flex justify-center">
              <Button onClick={handleDownloadTemplate} variant="secondary" className="gap-2">
                <FileSpreadsheet className="w-4 h-4" />
                Descargar Plantilla de Ejemplo
              </Button>
            </div>

            {/* Input de archivo */}
            <div className="space-y-2">
              <Label>Seleccionar archivo Excel</Label>
              <Input
                key={fileInputKey}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileChange}
                disabled={isImporting}
              />
              {importFile && (
                <p className="text-sm text-gray-600 dark:text-slate-400">
                  Archivo seleccionado: {importFile.name}
                </p>
              )}
            </div>

            {/* Resultados de importación */}
            {importResults && (
              <div className="space-y-3">
                <div className="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100 mb-2">
                    Resultados de la importación:
                  </h3>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <div className="text-2xl font-bold text-gray-900 dark:text-slate-100">
                        {importResults.total}
                      </div>
                      <div className="text-xs text-gray-600 dark:text-slate-400">Total</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                        {importResults.successful}
                      </div>
                      <div className="text-xs text-gray-600 dark:text-slate-400">Exitosos</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                        {importResults.failed}
                      </div>
                      <div className="text-xs text-gray-600 dark:text-slate-400">Fallidos</div>
                    </div>
                  </div>
                </div>

                {/* Errores */}
                {importResults.errors.length > 0 && (
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 max-h-64 overflow-y-auto">
                    <h3 className="text-sm font-semibold text-red-800 dark:text-red-300 mb-2">
                      Errores encontrados:
                    </h3>
                    <div className="space-y-2">
                      {importResults.errors.map((error, idx) => (
                        <div key={idx} className="text-sm text-red-700 dark:text-red-300">
                          <span className="font-semibold">Fila {error.row}:</span> {error.clave} - {error.name} - {error.error}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleCloseImportModal}
              disabled={isImporting}
            >
              {importResults ? 'Cerrar' : 'Cancelar'}
            </Button>
            {!importResults && (
              <Button
                onClick={handleImportExcel}
                disabled={!importFile || isImporting}
              >
                {isImporting ? 'Importando...' : 'Importar'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo de Confirmación de Eliminación */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={closeDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará permanentemente la materia{' '}
              <strong>
                {deletingSubject?.clave} - {deletingSubject?.name}
              </strong>
              .
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
