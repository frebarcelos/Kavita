param([Parameter(Mandatory = $true)][string]$Image)
$ErrorActionPreference = 'Stop'
# enable-https.ps1 on a disposable Compose project bound to 127.0.0.1 (5063 for Kavita, 5445 for HTTPS), with an empty
# temporary library. The main server, its volumes, the library and C:\KavitaBackups are never used. Run from the
# repository root, without redirecting stderr; everything created here is removed at the end.

$project = 'kavita-enablehttpstest'
$root = (New-Item -ItemType Directory -Force -Path '_temp/enable-https-test').FullName
$ca = Join-Path $root 'ca'
$failures = @()
function Check([bool]$condition, [string]$label) {
    if ($condition) { Write-Output "PASS $label" } else { Write-Output "FAIL $label"; $script:failures += $label }
}
$envFile = Join-Path $root '.env'
$override = Join-Path $root 'override.yaml'
$all = @('compose', '-p', $project, '--env-file', $envFile, '-f', 'deployment/offline/compose.yaml', '-f', $override,
    '-f', 'deployment/offline/compose.https.yaml')
function Fingerprint {
    (New-Object Security.Cryptography.X509Certificates.X509Certificate2 (Join-Path $ca 'root.crt')).Thumbprint
}
function Enable {
    & ./deployment/offline/enable-https.ps1 -Project $project -EnvFile $envFile -Override $override -CaDir $ca 6>&1 | Out-Null
}
function Cleanup {
    $ErrorActionPreference = 'Continue'
    docker @all down --volumes --remove-orphans 2>&1 | Out-Null
}

New-Item -ItemType Directory -Force -Path (Join-Path $root 'library') | Out-Null
@(
    "KAVITA_LIBRARY_PATH=$((Join-Path $root 'library') -replace '\\', '/')"
    'KAVITA_BIND_ADDRESS=127.0.0.1'
    'KAVITA_PORT=5063'
    'KAVITA_HTTPS_PORT=5445'
    "KAVITA_IMAGE=$Image"
) | Set-Content -Encoding ASCII $envFile
"services: {}" | Set-Content -Encoding ASCII $override
Cleanup
try {
    # Kavita alone, as before HTTPS
    $ErrorActionPreference = 'Continue'
    docker compose -p $project --env-file $envFile -f deployment/offline/compose.yaml -f $override up -d --wait --wait-timeout 240 2>&1 | Out-Null
    $kavitaBefore = docker compose -p $project --env-file $envFile -f deployment/offline/compose.yaml -f $override ps -q kavita
    $ErrorActionPreference = 'Stop'
    Check ([bool]$kavitaBefore) 'Kavita runs without the proxy'

    Enable
    Check ((Test-Path (Join-Path $ca 'root.crt')) -and (Test-Path (Join-Path $ca 'root.key'))) 'exports the root and its key'
    $first = Fingerprint
    $kavitaAfter = docker @all ps -q kavita
    Check ($kavitaAfter -eq $kavitaBefore) 'Kavita itself is not recreated'
    Check ((docker @all port https 443) -eq '127.0.0.1:5445') 'HTTPS published only on the configured address'

    # The proxy volume is lost: the same authority comes back from the exported root
    $ErrorActionPreference = 'Continue'
    docker @all rm -sf https 2>&1 | Out-Null
    docker volume rm "${project}_https-data" 2>&1 | Out-Null
    $ErrorActionPreference = 'Stop'
    Enable
    Check ((Fingerprint) -eq $first) 'a lost proxy volume gets the same authority back'

    # Running it again changes nothing
    Enable
    Check ((Fingerprint) -eq $first) 'running it again keeps the authority'
} finally {
    Cleanup
    Remove-Item -Recurse -Force $root -ErrorAction SilentlyContinue
}
if ($failures) { throw "$($failures.Count) failed: $($failures -join '; ')" }
Write-Output 'All enable-https tests passed.'
