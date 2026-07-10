$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$postgresRoot = Join-Path $projectRoot ".local\postgres18"
$pgCtlExe = Join-Path $postgresRoot "pgsql\bin\pg_ctl.exe"
$dataDir = Join-Path $postgresRoot "data"

if (!(Test-Path $pgCtlExe) -or !(Test-Path $dataDir)) {
  Write-Host "Local PostgreSQL is not installed."
  exit 0
}

& $pgCtlExe -D $dataDir stop -m fast
if ($LASTEXITCODE -ne 0) {
  throw "Failed to stop local PostgreSQL."
}
