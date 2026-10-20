param([Parameter(Mandatory = $true)][string]$Image)
$ErrorActionPreference = 'Stop'
# The HTTPS proxy (compose.https.yaml) on a disposable Compose project bound to 127.0.0.1 (5062 for Kavita, 5444 for
# HTTPS), with an empty temporary library. The main server, its volumes and the library are never used. Run from the
# repository root, without redirecting stderr; everything created here is removed at the end.

$project = 'kavita-httpstest'
$root = (New-Item -ItemType Directory -Force -Path '_temp/https-test').FullName
$failures = @()
function Check([bool]$condition, [string]$label) {
    if ($condition) { Write-Output "PASS $label" } else { Write-Output "FAIL $label"; $script:failures += $label }
}
$envFile = Join-Path $root '.env'
$compose = @('compose', '-p', $project, '--env-file', $envFile, '-f', 'deployment/offline/compose.yaml',
    '-f', 'deployment/offline/compose.https.yaml')
# A client on the project network, reaching the proxy as if it were the server's address
function Probe([string[]]$arguments) {
    $ErrorActionPreference = 'Continue'
    docker run --rm --network "${project}_default" --entrypoint curl -v "${root}:/ca:ro" $Image `
        -sS --max-time 15 --connect-to '127.0.0.1:443:https:443' @arguments 2>&1
}
function Cleanup {
    $ErrorActionPreference = 'Continue'
    docker @compose down --volumes --remove-orphans 2>&1 | Out-Null
}

New-Item -ItemType Directory -Force -Path (Join-Path $root 'library') | Out-Null
@(
    "KAVITA_LIBRARY_PATH=$((Join-Path $root 'library') -replace '\\', '/')"
    'KAVITA_BIND_ADDRESS=127.0.0.1'
    'KAVITA_PORT=5062'
    'KAVITA_HTTPS_PORT=5444'
    "KAVITA_IMAGE=$Image"
) | Set-Content -Encoding ASCII $envFile
Cleanup
try {
    $ErrorActionPreference = 'Continue'
    docker @compose up -d --wait --wait-timeout 240 2>&1 | Out-Null
    $ErrorActionPreference = 'Stop'
    Check ($LASTEXITCODE -eq 0) 'Kavita and the proxy start'

    $ports = docker @compose port https 443
    Check ($ports -eq '127.0.0.1:5444') "HTTPS published only on the configured address ($ports)"

    # The local authority's root, as a client would receive it
    $ErrorActionPreference = 'Continue'
    docker @compose cp https:/data/caddy/pki/authorities/local/root.crt (Join-Path $root 'root.crt') 2>&1 | Out-Null
    $ErrorActionPreference = 'Stop'
    Check (Test-Path (Join-Path $root 'root.crt')) 'the local authority root can be exported'

    $trusted = Probe @('--cacert', '/ca/root.crt', 'https://127.0.0.1/api/health')
    Check ($LASTEXITCODE -eq 0) "a client trusting the root reaches Kavita ($trusted)"

    $untrusted = Probe @('https://127.0.0.1/api/health')
    Check ($LASTEXITCODE -ne 0 -and ($untrusted -join ' ') -match 'certificate') 'a client without the root is refused'

    $plain = Probe @('-o', '/dev/null', '-w', '%{http_code}', 'http://https:443/api/health')
    Check (($plain -join '') -notmatch '200') "plain HTTP on the HTTPS port gets no content ($plain)"
    $ErrorActionPreference = 'Continue'
    $port80 = docker run --rm --network "${project}_default" --entrypoint curl $Image -sS --max-time 5 http://https:80/ 2>&1
    $ErrorActionPreference = 'Stop'
    Check ($LASTEXITCODE -ne 0) 'nothing listens on port 80'

    # From Windows, the published port without the root: the certificate is refused
    $refused = $false
    try { Invoke-WebRequest -UseBasicParsing -TimeoutSec 10 'https://127.0.0.1:5444/api/health' | Out-Null } catch { $refused = $true }
    Check $refused 'Windows without the root refuses the certificate'
} finally {
    Cleanup
    Remove-Item -Recurse -Force $root -ErrorAction SilentlyContinue
}
if ($failures) { throw "$($failures.Count) failed: $($failures -join '; ')" }
Write-Output 'All HTTPS proxy tests passed.'
