# Salud100

Registro de glucosa en español, pensado para el celular. React + TypeScript + Vite + Tailwind CSS, botón basado en shadcn/ui, Supabase y PWA.

## Ejecutar

Requiere Node.js 22. En PowerShell se usa `npm.cmd` para evitar depender de la política de ejecución de scripts.

```powershell
npm.cmd install
npm.cmd run dev
```

Abre la dirección que muestra Vite. Para producción:

```powershell
npm.cmd run build
npm.cmd run preview
```

## Funciones

- Captura con fecha/hora automáticas al guardar o fecha/hora personalizada.
- Ayuno: sí, no o sin indicar. Notas opcionales.
- Historial, filtros, edición, eliminación con confirmación y CSV compatible con Excel.
- Unidades mg/dL y mmol/L; cada registro conserva su unidad. Las gráficas y promedios solo usan la unidad elegida, sin mezclar valores.
- Gráfica de 7 o 30 días, sin clasificaciones clínicas ni umbrales de diagnóstico.
- PWA con iconos e instalación desde el navegador. El almacenamiento local y la aplicación precargada permiten uso sin conexión en la compilación de producción.

## Datos locales

Sin variables de Supabase, guarda en localStorage del navegador actual. No hay datos de ejemplo. Borrar datos del navegador elimina las mediciones; exporta CSV para conservar una copia. Este modo no sincroniza entre dispositivos y no tiene contraseña propia.

## Conectar Supabase

1. Crea un proyecto Supabase.
2. Ejecuta `supabase/migrations/001_readings.sql` en el editor SQL del proyecto. Activa RLS y restringe todas las operaciones al dueño del registro.
3. Copia `.env.example` a `.env.local` y completa la URL del proyecto y su clave pública/publishable. Nunca uses una clave `service_role` en el frontend.
4. En Authentication → URL Configuration, configura Site URL y las direcciones permitidas de redirección (por ejemplo `http://localhost:5173` y la URL HTTPS publicada).
5. Activa el proveedor de correo y los enlaces de acceso. Configura SMTP para entrega de correos en producción.
6. Reinicia Vite o recompila al modificar variables de entorno.

Con Supabase configurado, el inicio de sesión es obligatorio y las operaciones requieren conexión. No se mezclan ni se suben automáticamente los datos locales anteriores. Exporta esos registros antes de cambiar de modo. La integración requiere verificar el acceso de dos usuarios reales en tu proyecto para confirmar aislamiento; no hay credenciales incluidas.

## Publicar e instalar

### Netlify desde GitHub

Importa el repositorio `aceveduar/salud100` en Netlify y elige la rama `main`. El archivo `netlify.toml` configura Node.js 22, el comando `npm run build` y la carpeta `dist`.

Antes del primer despliegue, agrega en Netlify las variables `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` con los valores de tu proyecto. `.env.local` no se sube a GitHub. Usa únicamente la clave pública, nunca una clave secreta ni `service_role`.

Después del despliegue, configura en Supabase → Authentication → URL Configuration la URL HTTPS de Netlify como Site URL y agrega esa misma URL en Redirect URLs. Conserva las direcciones de localhost para pruebas locales. Si cambias variables de entorno, vuelve a desplegar para incorporarlas al frontend.

Para que otras personas reciban enlaces de acceso, configura SMTP en Supabase. Su servicio de correo predeterminado está limitado a destinatarios del equipo del proyecto.

Publica `dist/` en un alojamiento estático con HTTPS. Las variables `VITE_` se incorporan al compilar. La navegación usa estado local, sin rutas que requieran reescritura. Para probar instalación en un teléfono necesitas HTTPS; una IP de red local por HTTP no activa todas las capacidades PWA.

En iPhone: Safari → Compartir → Agregar a pantalla de inicio. En Android: menú de Chrome → Instalar app. El service worker almacena solamente archivos de la app; no almacena respuestas de Supabase. La sincronización offline con Supabase no está implementada.

## Verificación

```powershell
npm.cmd run build
npm.cmd test
```

Las pruebas de Playwright usan Microsoft Edge instalado y cubren escritorio y tamaño móvil: crear, recargar, editar, filtrar, exportar, eliminar, validación, captura local sin red, unidades y protección frente a almacenamiento inválido.

Para regenerar iconos: `node scripts/icons.mjs`.
