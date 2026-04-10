<#
.SYNOPSIS
  Build and deploy CodeWiki to Azure Web App.

.DESCRIPTION
  Builds Next.js standalone output and deploys via ZIP to Azure Web App.

.PARAMETER ResourceGroup
  Azure resource group. Default: RG-DEEPWIKI-UAT

.PARAMETER AppName
  Azure Web App name. Default: codewikiuat

.PARAMETER SkipBuild
  Skip npm build (use existing .next output).

.EXAMPLE
  .\publish-web.ps1
  .\publish-web.ps1 -SkipBuild
  .\publish-web.ps1 -ResourceGroup myRG -AppName myapp
#>
param(
    [string]$ResourceGroup = "RG-DEEPWIKI-UAT",
    [string]$AppName = "codewikiuat",
    [switch]$SkipBuild
)

$ErrorActionPreference = 'Stop'
$ProjectRoot = $PSScriptRoot

Push-Location $ProjectRoot
try {
    # Step 1: Build
    if (-not $SkipBuild) {
        Write-Host "`n=== Building Next.js ===" -ForegroundColor Cyan
        if (-not (Test-Path "node_modules")) {
            Write-Host "Installing dependencies..." -ForegroundColor Yellow
            npm install
            if ($LASTEXITCODE -ne 0) { throw "npm install failed" }
        }
        npm run build
        if ($LASTEXITCODE -ne 0) { throw "Next.js build failed" }
    }

    # Verify standalone output
    $standalone = Join-Path $ProjectRoot ".next\standalone"
    if (-not (Test-Path "$standalone\server.js")) {
        throw "Standalone build not found. Run without -SkipBuild."
    }

    # Step 2: Prepare package
    Write-Host "`n=== Preparing deployment package ===" -ForegroundColor Cyan
    Copy-Item "public" "$standalone\public" -Recurse -Force
    Copy-Item ".next\static" "$standalone\.next\static" -Recurse -Force

    $zipPath = Join-Path $ProjectRoot "codewiki-deploy.zip"
    if (Test-Path $zipPath) { Remove-Item $zipPath -Force }

    Push-Location $standalone
    Compress-Archive -Path ".\*" -DestinationPath $zipPath -Force
    Pop-Location

    $sizeMB = [math]::Round((Get-Item $zipPath).Length / 1MB, 1)
    Write-Host "Package: codewiki-deploy.zip ($sizeMB MB)" -ForegroundColor Green

    # Step 3: Deploy
    Write-Host "`n=== Deploying to $AppName.azurewebsites.net ===" -ForegroundColor Cyan
    az webapp deploy `
        --resource-group $ResourceGroup `
        --name $AppName `
        --src-path $zipPath `
        --type zip 2>&1 | Out-Null

    Write-Host "`n=== Deployment complete ===" -ForegroundColor Green
    Write-Host "Site: https://$AppName.azurewebsites.net/" -ForegroundColor Cyan

} finally {
    Pop-Location
}
