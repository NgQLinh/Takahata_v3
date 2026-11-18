$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$deployPath = Join-Path $projectRoot "deploy"
$zipPath = Join-Path $projectRoot "next-app-deploy.zip"

Set-Location $projectRoot

Write-Host "Installing dependencies..."
npm ci
if ($LASTEXITCODE -ne 0) {
    throw "npm ci failed (exit code $LASTEXITCODE)."
}

Write-Host "Building Next.js application..."
npm run build
if ($LASTEXITCODE -ne 0) {
    throw "Next.js build failed (exit code $LASTEXITCODE)."
}

Write-Host "Preparing deploy directory..."
Remove-Item $deployPath -Recurse -Force -ErrorAction SilentlyContinue
New-Item $deployPath -ItemType Directory | Out-Null

Copy-Item ".\.next\standalone\*" $deployPath -Recurse -Force

$staticPath = Join-Path $deployPath ".next\static"
New-Item $staticPath -ItemType Directory -Force | Out-Null
Copy-Item ".\.next\static\*" $staticPath -Recurse -Force

if (Test-Path ".\public") {
    Copy-Item ".\public" (Join-Path $deployPath "public") -Recurse -Force
}

Write-Host "Removing old ZIP file..."
Remove-Item $zipPath -Force -ErrorAction SilentlyContinue

Write-Host "Creating ZIP package..."
$deployEntries = @(Get-ChildItem -LiteralPath $deployPath -Force | ForEach-Object { $_.Name })
tar.exe -a -c -f $zipPath -C $deployPath -- @deployEntries
if ($LASTEXITCODE -ne 0) {
    throw "Failed to create ZIP package with tar.exe (exit code $LASTEXITCODE)."
}

Write-Host "Deploy package created successfully:"
Write-Host $deployPath

Write-Host "ZIP package created successfully:"
Write-Host $zipPath
