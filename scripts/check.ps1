$ErrorActionPreference='Stop';$root=Resolve-Path "$PSScriptRoot\..";Set-Location $root
npm run typecheck
npm run test -w @sentinel/api
Set-Location "$root\services\ml"; python -m compileall app; pytest -q
