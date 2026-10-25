# Publica REA Eléctrico en GitHub y activa GitHub Pages.
#
# Requisitos: haber iniciado sesión una vez con
#   & "$env:LOCALAPPDATA\Programs\gh-cli\bin\gh.exe" auth login
#
# Uso (desde la carpeta del proyecto):
#   powershell -ExecutionPolicy Bypass -File scripts\publicar-github.ps1 -Nombre rea-electrico -Visibilidad public
#
# Con una cuenta gratuita de GitHub, Pages solo funciona en repositorios públicos.
# Con GitHub Pro (o una organización con plan de pago) se puede usar -Visibilidad private.

param(
  [string]$Nombre = "rea-electrico",
  [ValidateSet("public", "private")][string]$Visibilidad = "public"
)
$ErrorActionPreference = "Stop"

$gh = (Get-Command gh -ErrorAction SilentlyContinue).Source
if (-not $gh) { $gh = "$env:LOCALAPPDATA\Programs\gh-cli\bin\gh.exe" }
if (-not (Test-Path $gh)) { throw "No se encontró GitHub CLI (gh)." }

& $gh auth status | Out-Null
if ($LASTEXITCODE -ne 0) { throw "Primero inicia sesión: & `"$gh`" auth login" }
$usuario = (& $gh api user --jq .login).Trim()

Write-Host "1/3 Creando el repositorio $usuario/$Nombre ($Visibilidad) y subiendo el código..."
& $gh repo create $Nombre "--$Visibilidad" --source . --remote origin --push --description "Cálculo y diseño de instalaciones eléctricas (NOM-001-SEDE-2012, IEC 60364) con memoria de cálculo trazable"
if ($LASTEXITCODE -ne 0) { throw "No se pudo crear el repositorio." }

Write-Host "2/3 Activando GitHub Pages (publicación con GitHub Actions)..."
& $gh api -X POST "repos/$usuario/$Nombre/pages" -f build_type=workflow | Out-Null
if ($LASTEXITCODE -ne 0) { Write-Warning "No se pudo activar Pages por la API; actívalo en Settings → Pages → Source: GitHub Actions." }

Write-Host "3/3 Lanzando la primera publicación..."
& $gh workflow run pages.yml | Out-Null

Write-Host ""
Write-Host "Listo. En unos minutos la aplicación estará en:"
Write-Host "  https://$usuario.github.io/$Nombre/"
Write-Host "Avance de la publicación: https://github.com/$usuario/$Nombre/actions"
