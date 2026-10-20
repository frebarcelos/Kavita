param([Parameter(Mandatory = $true)][string]$Image)
$ErrorActionPreference = 'Stop'
# lan-https-only.ps1 on a disposable Compose project. 127.0.0.1 stands for the LAN address and 127.0.0.2 for the PC-only
# address (Windows answers on all of 127.0.0.0/8). The main server, its volumes, the library and C:\KavitaBackups are
# never used. Run from the repository root, without redirecting stderr; everything created here is removed at the end.

$project = 'kavita-lanhttpstest'
$root = (New-Item -ItemType Directory -Force -Path '_temp/lan-https-test').FullName
$ca = Join-Path $root 'ca'
$failures = @()
function Check([bool]$condition, [string]$label) {
    if ($condition) { Write-Output "PASS $label" } else { Write-Output "FAIL $label"; $script:failures += $label }
}
$envFile = Join-Path $root '.env'
$override = Join-Path $root 'override.yaml'
$all = @('compose', '-p', $project, '--env-file', $envFile, '-f', 'deployment/offline/compose.yaml', '-f', $override,
    '-f', 'deployment/offline/compose.https.yaml')
$common = @{ Project = $project; EnvFile = $envFile; Override = $override; CaDir = $ca }
function Answers([string]$url) {
    try { (Invoke-WebRequest -UseBasicParsing -TimeoutSec 5 $url).StatusCode -eq 200 } catch { $false }
}
function Cleanup {
    $ErrorActionPreference = 'Continue'
    docker @all down --volumes --remove-orphans 2>&1 | Out-Null
}

New-Item -ItemType Directory -Force -Path (Join-Path $root 'library') | Out-Null
@(
    "KAVITA_LIBRARY_PATH=$((Join-Path $root 'library') -replace '\\', '/')"
    'KAVITA_BIND_ADDRESS=127.0.0.1'
    'KAVITA_PORT=5064'
    'KAVITA_HTTPS_PORT=5447'
    "KAVITA_IMAGE=$Image"
) | Set-Content -Encoding ASCII $envFile
"services: {}" | Set-Content -Encoding ASCII $override
Cleanup
try {
    $ErrorActionPreference = 'Continue'
    docker compose -p $project --env-file $envFile -f deployment/offline/compose.yaml -f $override up -d --wait --wait-timeout 240 2>&1 | Out-Null
    & ./deployment/offline/enable-https.ps1 @common 6>&1 | Out-Null
    $ErrorActionPreference = 'Stop'
    Check (Answers 'http://127.0.0.1:5064/api/health') 'before: HTTP answers on the LAN address'

    & ./deployment/offline/lan-https-only.ps1 @common -LocalAddress 127.0.0.2 6>&1 | Out-Null
    Check (-not (Answers 'http://127.0.0.1:5064/api/health')) 'after: no HTTP on the LAN address'
    Check (Answers 'http://127.0.0.2:5064/api/health') 'after: HTTP on the PC-only address'
    Check ((docker @all port https 443) -eq '127.0.0.1:5447') 'after: HTTPS still on the LAN address'
    $envText = Get-Content -Raw $envFile
    Check ($envText -match '(?m)^KAVITA_BIND_ADDRESS=127\.0\.0\.2\r?$' -and $envText -match '(?m)^KAVITA_HTTPS_BIND_ADDRESS=127\.0\.0\.1\r?$') 'the env file records both addresses'
    Check (@(Get-ChildItem "$envFile.before-*").Count -eq 1) 'the previous env file is kept'

    & ./deployment/offline/lan-https-only.ps1 @common -LocalAddress 127.0.0.2 -Undo 6>&1 | Out-Null
    Check (Answers 'http://127.0.0.1:5064/api/health') 'undo: HTTP back on the LAN address'
    Check ((docker @all port https 443) -eq '127.0.0.1:5447') 'undo: HTTPS unchanged'
} finally {
    Cleanup
    Remove-Item -Recurse -Force $root -ErrorAction SilentlyContinue
}
if ($failures) { throw "$($failures.Count) failed: $($failures -join '; ')" }
Write-Output 'All lan-https-only tests passed.'
