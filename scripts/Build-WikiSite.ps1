<#
.SYNOPSIS
  Build the CodeWiki Local Agent site from generated wiki data.

.DESCRIPTION
  Validates wiki-data.json, copies it to public/, and builds the Next.js app.
  Optionally deploys to Azure Web App.

.PARAMETER WikiDataPath
  Path to the wiki-data.json file. Defaults to ./output/wiki-data.json.

.PARAMETER Deploy
  If set, deploys the built site to Azure Web App.

.PARAMETER ResourceGroup
  Azure resource group name (required if -Deploy).

.PARAMETER AppName
  Azure Web App name (required if -Deploy).

.EXAMPLE
  .\scripts\Build-WikiSite.ps1
  .\scripts\Build-WikiSite.ps1 -WikiDataPath C:\myproject\output\wiki-data.json
  .\scripts\Build-WikiSite.ps1 -Deploy -ResourceGroup myRG -AppName my-codewiki
#>
param(
    [string]$WikiDataPath = (Join-Path $PSScriptRoot "..\output\wiki-data.json"),
    [switch]$Deploy,
    [string]$ResourceGroup,
    [string]$AppName
)

$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path $PSScriptRoot -Parent

# Step 1: Validate wiki data
Write-Host "Validating wiki data..." -ForegroundColor Cyan
$validateScript = Join-Path $PSScriptRoot "validate-wiki-data.js"
node $validateScript $WikiDataPath
if ($LASTEXITCODE -ne 0) {
    Write-Error "Wiki data validation failed."
    exit 1
}
Write-Host "Validation passed." -ForegroundColor Green

# Step 2: Build Next.js
Write-Host "Building Next.js application..." -ForegroundColor Cyan
Push-Location $ProjectRoot
try {
    if (-not (Test-Path "node_modules")) {
        Write-Host "Installing dependencies..." -ForegroundColor Yellow
        npm install
    }
    npm run build
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Next.js build failed."
        exit 1
    }
    Write-Host "Build complete." -ForegroundColor Green
} finally {
    Pop-Location
}

# Step 3: Optional Azure deployment
if ($Deploy) {
    if (-not $ResourceGroup -or -not $AppName) {
        Write-Error "Both -ResourceGroup and -AppName are required for deployment."
        exit 1
    }

    Write-Host "Deploying to Azure Web App $AppName..." -ForegroundColor Cyan

    $zipPath = Join-Path $ProjectRoot ".next-deploy.zip"
    $standalonePath = Join-Path $ProjectRoot ".next\standalone"

    if (Test-Path $standalonePath) {
        # Copy public assets
        Copy-Item (Join-Path $ProjectRoot "public") (Join-Path $standalonePath "public") -Recurse -Force
        Copy-Item (Join-Path $ProjectRoot ".next\static") (Join-Path $standalonePath ".next\static") -Recurse -Force

        # Zip and deploy
        Compress-Archive -Path "$standalonePath\*" -DestinationPath $zipPath -Force
        az webapp deploy --resource-group $ResourceGroup --name $AppName --src-path $zipPath --type zip
        Remove-Item $zipPath -Force

        Write-Host "Deployment complete." -ForegroundColor Green
    } else {
        Write-Error "Standalone build not found at $standalonePath. Ensure 'output: standalone' is in next.config.ts."
        exit 1
    }
}

Write-Host "`nDone! Run 'npm run dev' to preview locally, or 'npm start' for production." -ForegroundColor Green
