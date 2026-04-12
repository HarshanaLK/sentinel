$ErrorActionPreference="Stop"
$root=Resolve-Path "$PSScriptRoot\.."
Set-Location "$root\services\ml"
if(-not(Test-Path ".venv")){ py -3.12 -m venv .venv }
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
if(-not(Test-Path ".env")){Copy-Item ".env.example" ".env"}
python -c "import tensorflow as tf; print('TensorFlow', tf.__version__)"
Write-Host "ML service setup complete." -ForegroundColor Green
