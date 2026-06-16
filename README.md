# 🎓 Sistema de Horarios UPN 212

## Descripción

Sistema web para la gestión automatizada de horarios académicos de la Universidad Pedagógica Nacional. Permite administrar programas, ciclos, módulos, materias, maestros, grupos y horarios de manera eficiente.

## ✨ Características Principales

- 🔐 **Autenticación segura** con Supabase Auth
- 👥 **Gestión de maestros** con disponibilidad horaria
- 📚 **Administración de materias y módulos**
- 🎯 **Asignación inteligente de grupos**
- 📅 **Generación automática de horarios**
- 🌓 **Modo oscuro** con diseño moderno
- 📱 **Diseño responsivo** adaptado a todos los dispositivos
- 🔍 **Búsqueda y filtrado** avanzado
- 📊 **Paginación** eficiente de datos

## 🛠️ Tecnologías Utilizadas

### Frontend
- **React 18** - Framework de interfaz de usuario
- **TypeScript** - Tipado estático
- **Vite** - Herramienta de compilación rápida
- **Tailwind CSS** - Framework de estilos
- **Lucide React** - Iconos modernos
- **React Router** - Navegación

### Backend
- **Supabase** - Backend as a Service
  - PostgreSQL - Base de datos
  - Auth - Autenticación
  - Row Level Security - Seguridad de datos

## 📦 Instalación Rápida

```bash
# 1. Instalar dependencias
pnpm install

# 2. Configurar variables de entorno
cp .env.example .env
# Editar .env con tus credenciales de Supabase

# 3. Ejecutar en modo desarrollo
pnpm dev
```


## 🗂️ Estructura de la Base de Datos

### Tablas Principales

- **usuarios** - Gestión de usuarios del sistema
- **programas** - Programas académicos
- **ciclos** - Ciclos escolares
- **modulos** - Módulos de los programas
- **materias** - Materias a impartir
- **maestros** - Información de maestros
- **grupos** - Grupos académicos
- **disponibilidad_maestros** - Horarios disponibles de maestros
- **maestros_por_modulo** - Relación maestros-módulos
- **horarios** - Horarios generados

## 🚀 Comandos Disponibles

```bash
# Desarrollo
pnpm dev          # Inicia servidor de desarrollo

# Producción
pnpm build        # Construye para producción
pnpm preview      # Previsualiza build de producción

# Linting
pnpm lint         # Verifica código con ESLint
```


## 🔐 Seguridad

El sistema implementa:

- ✅ Row Level Security (RLS) en todas las tablas
- ✅ Autenticación basada en JWT
- ✅ Validación de roles (admin/usuario)
- ✅ Políticas de acceso granular
- ✅ Sanitización de inputs

## 🌐 Despliegue

El proyecto puede desplegarse en:

- **Netlify** - Recomendado para despliegue rápido
- **Vercel** - Alternativa con integración Git
- **Supabase Storage** - Hosting estático nativo
- Cualquier servidor que soporte archivos estáticos

## 📱 Módulos del Sistema

### 1. Dashboard
Panel principal con resumen de información clave

### 2. Gestión de Programas
Creación y administración de programas académicos

### 3. Ciclos Escolares
Configuración de periodos académicos

### 4. Módulos
Organización de módulos por programa

### 5. Materias
Catálogo de materias disponibles

### 6. Maestros
Registro de maestros con disponibilidad horaria

### 7. Grupos
Administración de grupos académicos

### 8. Horarios
Generación y visualización de horarios

### 9. Usuarios
Gestión de usuarios del sistema

## 🎨 Diseño

- **Tema claro/oscuro** - Adaptación automática según preferencia del sistema
- **Diseño responsivo** - Optimizado para móvil, tablet y escritorio
- **Accesibilidad** - Alto contraste y navegación por teclado
- **UX moderna** - Interfaz intuitiva y fácil de usar

## 📋 Requisitos del Sistema

- Node.js >= 18.0.0
- pnpm >= 8.0.0
- Navegador moderno (Chrome, Firefox, Safari, Edge)

## 🤝 Contribución

Este es un proyecto privado de la UPN. Para contribuir:

1. Contacta al administrador del sistema
2. Solicita acceso al repositorio
3. Sigue las guías de estilo establecidas

## 📄 Licencia

Propiedad de la Universidad Pedagógica Nacional.  
Todos los derechos reservados.

## 📞 Soporte

Para soporte técnico o consultas:
- Email: soporte.upn@ejemplo.com
- Documentación: Ver archivos `.md` incluidos

---

**Desarrollado para la Universidad Pedagógica Nacional**  
Versión 1.0.0 - Octubre 2025
