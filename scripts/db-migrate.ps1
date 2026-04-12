$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$migrationsPath = Join-Path $projectRoot "database\migrations"

if (-not $env:PGPASSWORD) {
    $securePassword = Read-Host "PostgreSQL password for sentinel" -AsSecureString

    $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)

    try {
        $env:PGPASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
    }
    finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
    }
}

Write-Host "Testing PostgreSQL connection..."

& psql `
    -h 127.0.0.1 `
    -p 5432 `
    -U sentinel `
    -d sentinel `
    -v ON_ERROR_STOP=1 `
    -c "SELECT current_database();"

if ($LASTEXITCODE -ne 0) {
    throw "Could not connect to PostgreSQL."
}

$files = Get-ChildItem "$migrationsPath\*.sql" | Sort-Object Name

foreach ($file in $files) {
    Write-Host "Applying $($file.Name)"

    & psql `
        -h 127.0.0.1 `
        -p 5432 `
        -U sentinel `
        -d sentinel `
        -v ON_ERROR_STOP=1 `
        -f $file.FullName

    if ($LASTEXITCODE -ne 0) {
        throw "Migration failed: $($file.Name)"
    }
}

Write-Host ""
Write-Host "Database migrations complete."