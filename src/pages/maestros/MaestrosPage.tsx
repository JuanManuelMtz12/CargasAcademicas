import { useEffect, useState } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import { supabase } from '@/lib/supabase';
import { Database } from '@/types/database';
import { toast } from 'sonner';
import { Search, Plus, Pencil, Trash2, X, Upload, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';

type Teacher = Database['public']['Tables']['teachers']['Row'] & {
  categories: Database['public']['Tables']['categories']['Row'];
};

type Category = Database['public']['Tables']['categories']['Row'];

// Función para normalizar strings: elimina acentos y convierte a minúsculas
const normalizeString = (str: string): string => {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, ''); // Remueve diacríticos/acentos
};

export default function MaestrosPage() {
  const { allowedPrograms, isAdmin, canCreate, canEdit, canDelete, loading: permLoading } = usePermissions();
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    category_id: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importResults, setImportResults] = useState<{
    total: number;
    successful: number;
    failed: number;
    errors: { row: number; name: string; error: string }[];
  } | null>(null);

  const itemsPerPage = 5;

  useEffect(() => {
    if (!permLoading) loadData();
  }, [permLoading]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Cargar categorías
      const { data: categoriesData, error: categoriesError } = await supabase
        .from('categories')
        .select('*')
        .order('category', { ascending: true });

      if (categoriesError) throw categoriesError;
      setCategories(categoriesData || []);

      // Cargar maestros — coordinadores solo ven los de su programa
      let teachersQuery = supabase
        .from('teachers')
        .select(`
          *,
          categories (*),
          teacher_program!inner (program_id)
        `)
        .order('name', { ascending: true });

      if (!isAdmin && allowedPrograms.length > 0) {
        teachersQuery = teachersQuery.eq('teacher_program.program_id', allowedPrograms[0]);
      } else if (isAdmin) {
        // Admin ve todos — sin filtro inner join, rehacer query sin el inner
        const { data: allTeachers, error: allErr } = await supabase
          .from('teachers')
          .select('*, categories (*)')
          .order('name', { ascending: true });
        if (allErr) throw allErr;
        setTeachers(allTeachers || []);
        return;
      }

      const { data: teachersData, error: teachersError } = await teachersQuery;
      if (teachersError) throw teachersError;
      setTeachers(teachersData || []);
    } catch (error: any) {
      console.error('Error loading data:', error);
      toast.error('Error al cargar los datos: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (teacher?: Teacher) => {
    if (teacher) {
      setEditingTeacher(teacher);
      setFormData({
        name: teacher.name,
        category_id: teacher.category_id,
      });
    } else {
      setEditingTeacher(null);
      setFormData({
        name: '',
        category_id: '',
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingTeacher(null);
    setFormData({
      name: '',
      category_id: '',
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast.error('El nombre es requerido');
      return;
    }

    if (!formData.category_id) {
      toast.error('La categoría es requerida');
      return;
    }

    try {
      setIsSubmitting(true);

      // Normalizar el nombre para comparación (sin acentos, minúsculas)
      const normalizedInputName = normalizeString(formData.name.trim());

      // Obtener todos los maestros de la misma categoría para validar duplicados
      const { data: existingTeachers, error: checkError } = await supabase
        .from('teachers')
        .select('id, name, category_id, categories(category, subcategory)')
        .eq('category_id', formData.category_id);

      if (checkError) throw checkError;

      // Filtrar duplicados comparando versiones normalizadas
      const duplicates = (existingTeachers || [])
        .filter((t: any) => {
          // Excluir el registro actual si estamos editando
          if (editingTeacher && t.id === editingTeacher.id) return false;
          
          // Comparar versiones normalizadas
          const normalizedExistingName = normalizeString(t.name);
          return normalizedExistingName === normalizedInputName;
        });

      if (duplicates.length > 0) {
        const duplicate = duplicates[0] as any;
        const categoryName = duplicate.categories?.category || 'desconocida';
        const subcategoryName = duplicate.categories?.subcategory
          ? ` ${duplicate.categories.subcategory}`
          : '';
        toast.error(
          `Ya existe un maestro con el nombre "${duplicate.name}" en la categoría "${categoryName}${subcategoryName}". Los nombres se validan sin distinción de mayúsculas/minúsculas ni acentos.`
        );
        return;
      }

      if (editingTeacher) {
        // Actualizar
        const { error } = await supabase
          .from('teachers')
          .update({
            name: formData.name.trim(),
            category_id: formData.category_id,
          })
          .eq('id', editingTeacher.id);

        if (error) throw error;
        toast.success('Maestro actualizado correctamente');
      } else {
        // Crear
        const { error } = await supabase
          .from('teachers')
          .insert({
            name: formData.name.trim(),
            category_id: formData.category_id,
          });

        if (error) throw error;
        toast.success('Maestro creado correctamente');
      }

      handleCloseModal();
      loadData();
    } catch (error: any) {
      console.error('Error saving teacher:', error);
      
      // Manejo específico de error de constraint UNIQUE
      if (error.code === '23505' || error.message?.includes('unique')) {
        const categoryName = categories.find((c) => c.id === formData.category_id);
        const categoryDisplay = categoryName
          ? `${categoryName.category}${categoryName.subcategory ? ` ${categoryName.subcategory}` : ''}`
          : 'seleccionada';
        toast.error(
          `Ya existe un maestro con el nombre "${formData.name.trim()}" en la categoría "${categoryDisplay}"`
        );
      } else {
        toast.error('Error al guardar: ' + error.message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (teacher: Teacher) => {
    if (!confirm(`¿Está seguro de eliminar al maestro "${teacher.name}"?`)) {
      return;
    }

    try {
      // Validar que no tenga horarios asignados
      const { data: scheduleData, error: scheduleError } = await supabase
        .from('schedule')
        .select('id')
        .eq('teacher_id', teacher.id)
        .limit(1);

      if (scheduleError) throw scheduleError;

      if (scheduleData && scheduleData.length > 0) {
        toast.error('No se puede eliminar: el maestro tiene horarios asignados');
        return;
      }

      // Eliminar
      const { error } = await supabase
        .from('teachers')
        .delete()
        .eq('id', teacher.id);

      if (error) throw error;
      
      toast.success('Maestro eliminado correctamente');
      loadData();
    } catch (error: any) {
      console.error('Error deleting teacher:', error);
      toast.error('Error al eliminar: ' + error.message);
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
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validar extensión
      const validExtensions = ['.xlsx', '.xls'];
      const fileName = file.name.toLowerCase();
      const isValidExtension = validExtensions.some(ext => fileName.endsWith(ext));
      
      if (!isValidExtension) {
        toast.error('Por favor, seleccione un archivo Excel válido (.xlsx o .xls)');
        return;
      }
      
      setImportFile(file);
      setImportResults(null);
    }
  };

  const handleDownloadTemplate = () => {
    // Crear datos de ejemplo para el template con las 4 categorías de la base de datos
    const templateData = [
      { 'Nombre': 'Dr. Juan Pérez García', 'Categoría': 'BASE TC' },
      { 'Nombre': 'Dra. María López Hernández', 'Categoría': 'BASE MT' },
      { 'Nombre': 'Mtro. Carlos Ramírez Sánchez', 'Categoría': 'BASE PA' },
      { 'Nombre': 'Mtra. Ana Torres Mendoza', 'Categoría': 'INVITADO' },
    ];

    // Agregar información de categorías disponibles
    const categoriesInfo = categories.map(cat => ({
      'Categorías Disponibles': `${cat.category}${cat.subcategory ? ' ' + cat.subcategory : ''}`,
      'Horas Máx/Semana': cat.max_hours_week
    }));

    // Crear workbook
    const wb = XLSX.utils.book_new();

    // Hoja 1: Template
    const ws1 = XLSX.utils.json_to_sheet(templateData);
    XLSX.utils.book_append_sheet(wb, ws1, 'Maestros');

    // Hoja 2: Categorías disponibles
    const ws2 = XLSX.utils.json_to_sheet(categoriesInfo);
    XLSX.utils.book_append_sheet(wb, ws2, 'Categorías Disponibles');

    // Descargar
    XLSX.writeFile(wb, 'plantilla_maestros.xlsx');
    toast.success('Plantilla descargada correctamente');
  };

  const handleImportExcel = async () => {
    if (!importFile) {
      toast.error('Por favor, seleccione un archivo');
      return;
    }

    setIsImporting(true);
    const errors: { row: number; name: string; error: string }[] = [];
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

      // Crear un mapa de categorías para búsqueda rápida
      const categoryMap = new Map<string, string>();
      categories.forEach(cat => {
        const displayName = `${cat.category}${cat.subcategory ? ' ' + cat.subcategory : ''}`;
        categoryMap.set(displayName.toLowerCase().trim(), cat.id);
        // También agregar solo la categoría sin subcategoría
        categoryMap.set(cat.category.toLowerCase().trim(), cat.id);
      });

      // Procesar cada fila
      for (let i = 0; i < jsonData.length; i++) {
        const row = jsonData[i];
        const rowNumber = i + 2; // +2 porque Excel empieza en 1 y hay encabezado

        // Obtener nombre y categoría (soportar diferentes nombres de columna)
        const name = (row['Nombre'] || row['nombre'] || row['Name'] || row['name'] || '').toString().trim();
        const categoryName = (row['Categoría'] || row['categoria'] || row['Category'] || row['category'] || '').toString().trim();

        // Validar datos
        if (!name) {
          errors.push({ row: rowNumber, name: '-', error: 'Nombre vacío' });
          continue;
        }

        if (!categoryName) {
          errors.push({ row: rowNumber, name, error: 'Categoría vacía' });
          continue;
        }

        // Buscar categoría
        const categoryId = categoryMap.get(categoryName.toLowerCase());
        if (!categoryId) {
          errors.push({ row: rowNumber, name, error: `Categoría "${categoryName}" no encontrada` });
          continue;
        }

        // Normalizar nombre para validar duplicados
        const normalizedName = normalizeString(name);

        // Verificar si ya existe un maestro con el mismo nombre en la misma categoría
        const { data: existingTeachers, error: checkError } = await supabase
          .from('teachers')
          .select('id, name')
          .eq('category_id', categoryId);

        if (checkError) {
          errors.push({ row: rowNumber, name, error: `Error al validar: ${checkError.message}` });
          continue;
        }

        // Verificar duplicados
        const isDuplicate = (existingTeachers || []).some((t: any) => 
          normalizeString(t.name) === normalizedName
        );

        if (isDuplicate) {
          errors.push({ row: rowNumber, name, error: 'Ya existe un maestro con este nombre en esta categoría' });
          continue;
        }

        // Insertar maestro
        const { error: insertError } = await supabase
          .from('teachers')
          .insert({
            name,
            category_id: categoryId,
          });

        if (insertError) {
          errors.push({ row: rowNumber, name, error: insertError.message });
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
        toast.success(`Se importaron ${successful} de ${total} maestros correctamente`);
        loadData(); // Recargar datos
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

  // Filtrar maestros por búsqueda
  const filteredTeachers = teachers.filter((teacher) =>
    teacher.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Paginación
  const totalPages = Math.ceil(filteredTeachers.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentTeachers = filteredTeachers.slice(startIndex, endIndex);

  // Resetear a página 1 cuando cambia la búsqueda
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const getCategoryDisplay = (category: Category) => {
    const subcategoryText = category.subcategory ? ` ${category.subcategory}` : '';
    return `${category.category}${subcategoryText} = ${category.max_hours_week}h`;
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
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-slate-100">Maestros</h1>
          <p className="text-gray-600 dark:text-slate-400 mt-1">Gestión de docentes del sistema</p>
        </div>
        <div className="flex gap-2">
          {(isAdmin || canCreate('maestros')) && (
            <>
              <button
                onClick={handleOpenImportModal}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                title="Importar maestros desde Excel"
              >
                <Upload className="w-5 h-5" />
                Importar desde Excel
              </button>
              <button
                onClick={() => handleOpenModal()}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-5 h-5" />
                Nuevo Maestro
              </button>
            </>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-slate-500 w-5 h-5" />
          <input
            type="text"
            placeholder="Buscar por nombre..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 placeholder:text-gray-400 dark:placeholder:text-slate-500"
          />
        </div>
        <div className="text-sm text-gray-600 dark:text-slate-400">
          Total: {filteredTeachers.length} maestro{filteredTeachers.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-slate-700 border-b border-gray-200 dark:border-slate-600">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                  Nombre
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                  Categoría
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                  Subcategoría
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                  Horas Máx/Semana
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-slate-700">
              {currentTeachers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500 dark:text-slate-400">
                    {searchTerm ? 'No se encontraron maestros' : 'No hay maestros registrados'}
                  </td>
                </tr>
              ) : (
                currentTeachers.map((teacher) => (
                  <tr key={teacher.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900 dark:text-slate-100">{teacher.name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 dark:text-slate-100">{teacher.categories.category}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 dark:text-slate-100">
                        {teacher.categories.subcategory || '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 dark:text-slate-100">
                        {teacher.categories.max_hours_week}h
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        {(isAdmin || canEdit('maestros')) && (
                          <button
                            onClick={() => handleOpenModal(teacher)}
                            className="text-blue-600 hover:text-blue-900 p-1 hover:bg-blue-50 rounded transition-colors"
                            title="Editar"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                        )}
                        {(isAdmin || canDelete('maestros')) && (
                          <button
                            onClick={() => handleDelete(teacher)}
                            className="text-red-600 hover:text-red-900 p-1 hover:bg-red-50 rounded transition-colors"
                            title="Eliminar"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-700/50">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600 dark:text-slate-400">
                Mostrando {startIndex + 1} a {Math.min(endIndex, filteredTeachers.length)} de{' '}
                {filteredTeachers.length} resultados
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1 border border-gray-300 dark:border-slate-600 rounded hover:bg-gray-100 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100"
                >
                  Anterior
                </button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`px-3 py-1 border rounded transition-colors ${
                        currentPage === page
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'border-gray-300 hover:bg-gray-100'
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 border border-gray-300 dark:border-slate-600 rounded hover:bg-gray-100 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100"
                >
                  Siguiente
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal Importación */}
      {isImportModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-slate-700">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-slate-100">
                Importar Maestros desde Excel
              </h2>
              <button
                onClick={handleCloseImportModal}
                className="text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="px-6 py-4 space-y-4">
              {/* Instrucciones */}
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-blue-800 dark:text-blue-300 mb-2">
                  Instrucciones:
                </h3>
                <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1 list-disc list-inside">
                  <li>El archivo debe ser formato Excel (.xlsx o .xls)</li>
                  <li>Debe tener dos columnas: "Nombre" y "Categoría"</li>
                  <li>La categoría debe coincidir exactamente con las categorías existentes</li>
                  <li>Los nombres duplicados en la misma categoría serán ignorados</li>
                </ul>
              </div>

              {/* Botón descargar plantilla */}
              <div className="flex justify-center">
                <button
                  onClick={handleDownloadTemplate}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                >
                  <FileSpreadsheet className="w-5 h-5" />
                  Descargar Plantilla de Ejemplo
                </button>
              </div>

              {/* Input de archivo */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                  Seleccionar archivo Excel
                </label>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileChange}
                  disabled={isImporting}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
                />
                {importFile && (
                  <p className="mt-2 text-sm text-gray-600 dark:text-slate-400">
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
                            <span className="font-semibold">Fila {error.row}:</span> {error.name} - {error.error}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-gray-200 dark:border-slate-700 flex justify-end gap-3">
              <button
                onClick={handleCloseImportModal}
                disabled={isImporting}
                className="px-4 py-2 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-300 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors bg-white dark:bg-slate-800"
              >
                {importResults ? 'Cerrar' : 'Cancelar'}
              </button>
              {!importResults && (
                <button
                  onClick={handleImportExcel}
                  disabled={!importFile || isImporting}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isImporting ? 'Importando...' : 'Importar'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-md w-full">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-slate-700">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-slate-100">
                {editingTeacher ? 'Editar Maestro' : 'Nuevo Maestro'}
              </h2>
              <button
                onClick={handleCloseModal}
                className="text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSubmit}>
              <div className="px-6 py-4 space-y-4">
                {/* Nombre */}
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                    Nombre <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="name"
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ej: Dr. Juan Pérez"
                    required
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100"
                  />
                </div>

                {/* Categoría */}
                <div>
                  <label
                    htmlFor="category_id"
                    className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1"
                  >
                    Categoría <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="category_id"
                    value={formData.category_id}
                    onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100"
                  >
                    <option value="">Seleccione una categoría</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {getCategoryDisplay(category)}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Info de categoría seleccionada */}
                {formData.category_id && (
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                    <p className="text-sm text-blue-800 dark:text-blue-300 font-medium">
                      Información de la categoría:
                    </p>
                    <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                      {(() => {
                        const selectedCategory = categories.find(
                          (c) => c.id === formData.category_id
                        );
                        if (!selectedCategory) return '';
                        return getCategoryDisplay(selectedCategory);
                      })()}
                    </p>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 border-t border-gray-200 dark:border-slate-700 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  disabled={isSubmitting}
                  className="px-4 py-2 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-300 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors bg-white dark:bg-slate-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isSubmitting ? 'Guardando...' : editingTeacher ? 'Actualizar' : 'Crear'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
