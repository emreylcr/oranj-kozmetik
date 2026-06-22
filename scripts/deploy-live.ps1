param(
  [string]$GitHubToken = $env:GH_TOKEN,
  [string]$RenderApiKey = $env:RENDER_API_KEY,
  [string]$RepoName = "oranj-kozmetik",
  [string]$ServiceName = "oranj-kozmetik"
)

$ErrorActionPreference = "Stop"
$git = "C:\Program Files\Git\bin\git.exe"
$root = Split-Path -Parent $PSScriptRoot

if (-not $GitHubToken) { throw "GH_TOKEN eksik." }
if (-not $RenderApiKey) { throw "RENDER_API_KEY eksik." }

Set-Location $root

$headersGh = @{
  Authorization = "Bearer $GitHubToken"
  Accept        = "application/vnd.github+json"
  "X-GitHub-Api-Version" = "2022-11-28"
}

$user = Invoke-RestMethod -Uri "https://api.github.com/user" -Headers $headersGh
$owner = $user.login
Write-Host "GitHub kullanici: $owner"

$repoCheck = $null
try {
  $repoCheck = Invoke-RestMethod -Uri "https://api.github.com/repos/$owner/$RepoName" -Headers $headersGh
} catch {
  $repoCheck = $null
}

if (-not $repoCheck) {
  $body = @{
    name        = $RepoName
    description = "Oranj Kozmetik web sitesi"
    private     = $false
    auto_init   = $false
  } | ConvertTo-Json
  $repoCheck = Invoke-RestMethod -Method Post -Uri "https://api.github.com/user/repos" -Headers $headersGh -Body $body -ContentType "application/json"
  Write-Host "Repo olusturuldu: $($repoCheck.html_url)"
} else {
  Write-Host "Repo mevcut: $($repoCheck.html_url)"
}

if (-not (Test-Path ".git")) { & $git init | Out-Null }
& $git add .
& $git diff --cached --quiet 2>$null
if ($LASTEXITCODE -ne 0) {
  & $git -c user.name="Oranj Deploy" -c user.email="deploy@oranjkozmetik.local" commit -m "Render canli yayin hazirligi"
}
& $git branch -M main

$remoteUrl = "https://$GitHubToken@github.com/$owner/$RepoName.git"
& $git remote remove origin 2>$null
& $git remote add origin $remoteUrl
& $git push -u origin main --force

$headersRender = @{
  Authorization = "Bearer $RenderApiKey"
  Accept        = "application/json"
  "Content-Type" = "application/json"
}

$owners = Invoke-RestMethod -Uri "https://api.render.com/v1/owners?limit=20" -Headers $headersRender
if (-not $owners.Count) { throw "Render owner bulunamadi." }
$ownerId = $owners[0].owner.id

$existing = Invoke-RestMethod -Uri "https://api.render.com/v1/services?limit=100" -Headers $headersRender
$service = $existing | Where-Object { $_.service.name -eq $ServiceName } | Select-Object -First 1

if (-not $service) {
  $createBody = @{
    type             = "web_service"
    name             = $ServiceName
    ownerId          = $ownerId
    repo             = "https://github.com/$owner/$RepoName"
    branch           = "main"
    autoDeploy       = "yes"
    serviceDetails   = @{
      runtime          = "node"
      plan             = "free"
      buildCommand     = "npm install"
      startCommand     = "npm start"
      healthCheckPath  = "/health"
      envSpecificDetails = @{
        buildCommand = "npm install"
        startCommand = "npm start"
      }
    }
    envVars = @(
      @{ key = "NODE_ENV"; value = "production" }
      @{ key = "NODE_VERSION"; value = "24.17.0" }
    )
  } | ConvertTo-Json -Depth 8

  $created = Invoke-RestMethod -Method Post -Uri "https://api.render.com/v1/services" -Headers $headersRender -Body $createBody
  $serviceUrl = $created.service.serviceDetails.url
  Write-Host "Render servisi olusturuldu: $serviceUrl"
} else {
  $serviceId = $service.service.id
  Invoke-RestMethod -Method Post -Uri "https://api.render.com/v1/services/$serviceId/deploys" -Headers $headersRender -Body "{}" -ContentType "application/json" | Out-Null
  $serviceUrl = $service.service.serviceDetails.url
  Write-Host "Render deploy tetiklendi: $serviceUrl"
}

Write-Host ""
Write-Host "CANLI URL: $serviceUrl"
Write-Host "Admin: admin / admin123"
