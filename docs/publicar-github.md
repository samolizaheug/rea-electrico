# Publicar la aplicación en GitHub Pages

La aplicación es un sitio estático (no tiene servidor): GitHub Pages la sirve gratis desde un
repositorio de GitHub. Cada vez que se sube un cambio a la rama `main`, GitHub Actions corre el
typecheck y las pruebas, compila y publica. Si una prueba falla, no se publica.

Archivos que intervienen:
- `.github/workflows/pages.yml`: el flujo de publicación.
- `apps/web/vite.config.ts`: `base: "./"`, para que funcione en `https://<usuario>.github.io/<repositorio>/`.
- `scripts/publicar-github.ps1`: crea el repositorio, sube el código y activa Pages.

## Antes de publicar: qué queda público

Con una cuenta gratuita, GitHub Pages **solo funciona con repositorios públicos**. Quedarían
visibles el código y las tablas de `packages/norm-data/data/`:

- **NOM-001-SEDE-2012**: es una norma oficial publicada en el DOF; sus valores son de acceso público.
- **IEC 60364 (vía ABB)**: valores de tablas de IEC transcritos de un manual de ABB. IEC vende sus
  normas y protege sus tablas con derechos de autor; publicarlas en un repositorio abierto podría
  no estar permitido. Opciones:
  1. Repositorio **privado** con GitHub Pro (US$ 4/mes aprox.) u organización de pago: el sitio sigue siendo accesible por su URL.
  2. Repositorio público **sin** las tablas IEC (el módulo IEC quedaría «sin datos» en la versión publicada).
  3. Consultar con quien corresponda y publicarlo tal cual.

La carpeta `referencias/` (PDF de normas y manuales) **no** se sube: está en `.gitignore`.

## Pasos (una sola vez)

GitHub CLI quedó instalada en `%LOCALAPPDATA%\Programs\gh-cli\bin\gh.exe` (versión 2.102.0,
verificada con la huella SHA-256 publicada por GitHub). En PowerShell, desde la carpeta del proyecto:

```powershell
# 1. Iniciar sesión (abre el navegador para autorizar; elige HTTPS)
& "$env:LOCALAPPDATA\Programs\gh-cli\bin\gh.exe" auth login

# 2. Crear el repositorio, subir el código y activar Pages
powershell -ExecutionPolicy Bypass -File scripts\publicar-github.ps1 -Nombre rea-electrico -Visibilidad public
```

Al terminar, el script muestra la dirección, que será `https://<tu-usuario>.github.io/rea-electrico/`.
La primera publicación tarda unos minutos; su avance se ve en la pestaña **Actions** del repositorio.

## Después

- Para publicar cambios: `git push` (o pídemelo).
- El autoguardado del navegador es independiente por dirección: en la versión publicada se empieza con un proyecto vacío. Para ver el ejemplo, usa **Abrir** con `examples/sistema-ejemplo.rea.json`.
