import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { Toaster } from 'sonner';
import { useAuthStore } from '@/store/authStore';
import { ThemeProvider } from '@/contexts/ThemeContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import MainLayout from '@/components/MainLayout';
import LoginPage from '@/pages/LoginPage';
import DashboardPage from '@/pages/DashboardPage';
import CiclosPage from '@/pages/ciclos/CiclosPage';
import ProgramasPage from '@/pages/programas/ProgramasPage';
import ProgramaHorariosPage from '@/pages/horarios/ProgramaHorariosPage';
import MaestrosPage from '@/pages/maestros/MaestrosPage';
import MaestrosExcedidosPage from '@/pages/maestros-excedidos/MaestrosExcedidosPage';
import MateriasPage from '@/pages/materias/MateriasPage';
import ModulosPage from '@/pages/modulos/ModulosPage';
import GruposPage from '@/pages/grupos/GruposPage';
import DisponibilidadPage from '@/pages/disponibilidad/DisponibilidadPage';
import UsuariosPageV2 from '@/pages/usuarios/UsuariosPageV2';
import MaestrosMultiplesPage from '@/pages/maestros-multiples/MaestrosMultiplesPage';
import DebugPermissionsPage from '@/pages/DebugPermissionsPage';
import CategoriasPage from '@/pages/categorias/CategoriasPage';
import SedesPage from '@/pages/sedes/SedesPage';
import MaestriasSabatinasPage from '@/pages/maestrias-sabado/MaestriasSabatinasPage';
import MaestriaSabadoSchedulePage from '@/pages/maestrias-sabado/MaestriaSabadoSchedulePage';
import CargasAcademicasPage from '@/pages/cargas-academicas/CargasAcademicasPage';
import EspecializacionesPage from '@/pages/EspecializacionesPage';
import ProgramasLeipPage from '@/pages/programas-leip/ProgramasLeipPage';
import MateriasLeipPage from '@/pages/materias-leip/MateriasLeipPage';
import CreateAdminPage from '@/pages/CreateAdminPage';

function App() {
  const initialize = useAuthStore((state) => state.initialize);

  useEffect(() => {
    initialize();
  }, [initialize]);

  return (
    <ThemeProvider>
      <BrowserRouter>
        <Toaster position="top-right" richColors />
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/create-admin" element={<CreateAdminPage />} />
          
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <MainLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            
            <Route
              path="ciclos"
              element={
                <ProtectedRoute requireAdmin>
                  <CiclosPage />
                </ProtectedRoute>
              }
            />
            
            <Route path="programas" element={<ProgramasPage />} />
            <Route path="programas/:programId/horarios" element={<ProgramaHorariosPage />} />
            
            <Route path="programas-leip" element={<ProtectedRoute requireModule="programas-leip"><ProgramasLeipPage /></ProtectedRoute>} />
            <Route path="materias-leip" element={<ProtectedRoute requireModule="materias-leip"><MateriasLeipPage /></ProtectedRoute>} />
            <Route path="maestrias-sabado" element={<ProtectedRoute requireModule="maestrias-sabado"><MaestriasSabatinasPage /></ProtectedRoute>} />
            <Route path="maestrias-sabado/:id/horarios" element={<ProtectedRoute requireModule="maestrias-sabado"><MaestriaSabadoSchedulePage /></ProtectedRoute>} />

            <Route path="cargas-academicas" element={<ProtectedRoute requireModule="cargas-academicas"><CargasAcademicasPage /></ProtectedRoute>} />
            <Route path="especializaciones" element={<ProtectedRoute requireModule="especializaciones"><EspecializacionesPage /></ProtectedRoute>} />
            
            <Route path="maestros" element={<MaestrosPage />} />
            <Route path="maestros-multiples" element={<MaestrosMultiplesPage />} />
            <Route
              path="maestros-excedidos"
              element={
                <ProtectedRoute requireAdmin>
                  <MaestrosExcedidosPage />
                </ProtectedRoute>
              }
            />
            
            <Route
              path="materias"
              element={
                <ProtectedRoute requireModule="materias">
                  <MateriasPage />
                </ProtectedRoute>
              }
            />
            
            <Route
              path="modulos"
              element={
                <ProtectedRoute requireAdmin>
                  <ModulosPage />
                </ProtectedRoute>
              }
            />
            
            <Route
              path="grupos"
              element={
                <ProtectedRoute requireModule="grupos">
                  <GruposPage />
                </ProtectedRoute>
              }
            />
            
            <Route
              path="categorias"
              element={
                <ProtectedRoute requireAdmin>
                  <CategoriasPage />
                </ProtectedRoute>
              }
            />
            
            <Route
              path="sedes"
              element={
                <ProtectedRoute requireAdmin>
                  <SedesPage />
                </ProtectedRoute>
              }
            />
            
            <Route
              path="disponibilidad"
              element={
                <ProtectedRoute requireModule="disponibilidad">
                  <DisponibilidadPage />
                </ProtectedRoute>
              }
            />
            
            <Route
              path="usuarios"
              element={
                <ProtectedRoute requireAdmin>
                  <UsuariosPageV2 />
                </ProtectedRoute>
              }
            />
            
            <Route path="debug-permissions" element={<DebugPermissionsPage />} />
          </Route>
          
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;