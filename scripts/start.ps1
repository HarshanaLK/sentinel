$root=Resolve-Path "$PSScriptRoot\.."
Start-Process powershell -ArgumentList '-NoExit','-Command',"cd '$root'; npm run dev -w @sentinel/api"
Start-Process powershell -ArgumentList '-NoExit','-Command',"cd '$root'; npm run worker -w @sentinel/api"
Start-Process powershell -ArgumentList '-NoExit','-Command',"cd '$root\services\ml'; .\.venv\Scripts\Activate.ps1; uvicorn app.main:app --reload --port 8100"
Start-Process powershell -ArgumentList '-NoExit','-Command',"cd '$root'; npm run dev -w @sentinel/web"
Write-Host "Started API, worker, ML service and web console in separate PowerShell windows." -ForegroundColor Green
