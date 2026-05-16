# ─────────────────────────────────────────────────────────────────────────────
# Aura-Agent Backend — Quick Start Script (Windows PowerShell)
# ─────────────────────────────────────────────────────────────────────────────
# Usage:  .\start.ps1
# Flags:  .\start.ps1 -Port 9000        (custom port, default: 8000)
#         .\start.ps1 -NoReload          (disable hot-reload for production)
#
# Android Emulator: use http://10.0.2.2:<port>/api/v1 as the base URL.
# Physical Device:  use http://<your-LAN-IP>:<port>/api/v1 as the base URL.
# ─────────────────────────────────────────────────────────────────────────────

param (
    [int]$Port = 8000,
    [switch]$NoReload
)

$ErrorActionPreference = "Stop"

# ── Locate virtual environment ────────────────────────────────────────────────
$VenvPaths = @(".\venv\Scripts\Activate.ps1", ".\.venv\Scripts\Activate.ps1")
$ActivateScript = $null
foreach ($p in $VenvPaths) {
    if (Test-Path $p) { $ActivateScript = $p; break }
}

if (-not $ActivateScript) {
    Write-Host ""
    Write-Host "  [ERROR] No virtual environment found." -ForegroundColor Red
    Write-Host "  Run the following to create one:" -ForegroundColor Yellow
    Write-Host "    python -m venv venv" -ForegroundColor Cyan
    Write-Host "    .\venv\Scripts\pip install -r requirements.txt" -ForegroundColor Cyan
    Write-Host ""
    exit 1
}

# ── Check .env exists ─────────────────────────────────────────────────────────
if (-not (Test-Path ".\.env")) {
    Write-Host ""
    Write-Host "  [WARN] .env file not found. Copying from .env.example ..." -ForegroundColor Yellow
    Copy-Item ".\.env.example" ".\.env"
    Write-Host "  .env created. Edit it to configure credentials." -ForegroundColor Green
}

# ── Activate venv ─────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "  Aura-Agent Backend" -ForegroundColor Cyan
Write-Host "  ──────────────────" -ForegroundColor DarkGray
Write-Host "  Activating virtual environment: $ActivateScript" -ForegroundColor DarkGray
. $ActivateScript

# ── Detect local LAN IP for physical device testing ──────────────────────────
$LanIP = (Get-NetIPAddress -AddressFamily IPv4 |
    Where-Object { $_.InterfaceAlias -notmatch "Loopback|vEthernet|WSL" -and $_.IPAddress -ne "127.0.0.1" } |
    Select-Object -First 1).IPAddress

Write-Host ""
Write-Host "  Server URLs:" -ForegroundColor White
Write-Host "    Browser / Swagger :  http://localhost:$Port/docs" -ForegroundColor Green
Write-Host "    Android Emulator  :  http://10.0.2.2:$Port/api/v1" -ForegroundColor Green
if ($LanIP) {
    Write-Host "    Physical Device   :  http://${LanIP}:$Port/api/v1" -ForegroundColor Green
}
Write-Host ""

# ── Launch uvicorn ────────────────────────────────────────────────────────────
$ReloadFlag = if ($NoReload) { "" } else { "--reload" }
$cmd = "uvicorn main:app --host 0.0.0.0 --port $Port $ReloadFlag"
Write-Host "  Running: $cmd" -ForegroundColor DarkGray
Write-Host "  Press Ctrl+C to stop." -ForegroundColor DarkGray
Write-Host ""

Invoke-Expression $cmd
