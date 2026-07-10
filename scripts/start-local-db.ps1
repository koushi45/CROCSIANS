$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$postgresRoot = Join-Path $projectRoot ".local\postgres18"
$postgresExe = Join-Path $postgresRoot "pgsql\bin\postgres.exe"
$pgIsReadyExe = Join-Path $postgresRoot "pgsql\bin\pg_isready.exe"
$dataDir = Join-Path $postgresRoot "data"
$port = 16432

if (!(Test-Path $postgresExe) -or !(Test-Path $dataDir)) {
  throw "Local PostgreSQL is not installed. Expected files under $postgresRoot."
}

$ready = & $pgIsReadyExe -h 127.0.0.1 -p $port -U postgres 2>$null
if ($LASTEXITCODE -eq 0) {
  Write-Host "Local PostgreSQL is already running on 127.0.0.1:$port."
  exit 0
}

Start-Process `
  -FilePath $postgresExe `
  -ArgumentList @("-D", $dataDir, "-p", "$port", "-h", "127.0.0.1") `
  -WorkingDirectory $projectRoot `
  -WindowStyle Hidden

for ($attempt = 1; $attempt -le 30; $attempt += 1) {
  Start-Sleep -Milliseconds 500
  & $pgIsReadyExe -h 127.0.0.1 -p $port -U postgres | Out-Null
  if ($LASTEXITCODE -eq 0) {
    Write-Host "Local PostgreSQL started on 127.0.0.1:$port."
    exit 0
  }
}

throw "Timed out waiting for local PostgreSQL to start."
