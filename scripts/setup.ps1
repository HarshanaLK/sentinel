$ErrorActionPreference="Stop"; $root=Resolve-Path "$PSScriptRoot\.."; Set-Location $root
if(-not(Test-Path "apps\api\.env")){Copy-Item "apps\api\.env.example" "apps\api\.env"}
if(-not(Test-Path "apps\web\.env.local")){Copy-Item "apps\web\.env.example" "apps\web\.env.local"}
if(-not(Test-Path "services\ml\.env")){Copy-Item "services\ml\.env.example" "services\ml\.env"}
npm install
& "$PSScriptRoot\db-migrate.ps1"
npm run seed -w @sentinel/api
Write-Host "Node, database and seed setup complete." -ForegroundColor Green
Write-Host "Create the Python venv separately in services\ml if not already created." -ForegroundColor Yellow
