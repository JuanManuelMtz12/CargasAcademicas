-- Datos iniciales simples para el sistema
-- Solo programas básicos que vimos en las pruebas

-- Insertar programas básicos si no existen
INSERT INTO public.programas (nombre, tipo) 
SELECT 'Administración Educativa', 'LIC'
WHERE NOT EXISTS (SELECT 1 FROM public.programas WHERE nombre = 'Administración Educativa');

INSERT INTO public.programas (nombre, tipo) 
SELECT 'Intervención Educativa', 'LIC'
WHERE NOT EXISTS (SELECT 1 FROM public.programas WHERE nombre = 'Intervención Educativa');