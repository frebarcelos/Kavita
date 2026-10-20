param(
    [string]$Project = 'kavita-offline-f1',
    [string]$EnvFile = '_temp/offline-f1/.env',
    [string]$Override = '_temp/offline-f1/compose.libraries.yaml',
    # Where the local authority's root is kept: root.crt for clients (Kover build, Windows), root.key to recreate the
    # same authority if the proxy volume is lost. Private folder, never versioned.
    [string]$CaDir = 'C:\KavitaBackups\https',
    [int]$WaitSeconds = 90
)
# Native tools write progress to stderr; each one is checked by its exit code instead
$ErrorActionPreference = 'Continue'
# Fork (item 5.5): starts the HTTPS proxy (compose.https.yaml) next to the running Kavita, without touching Kavita
# itself, and exports the local authority. Run from the repository root. deploy-fork.ps1 leaves the proxy running.

$compose = @('compose', '-p', $Project, '--env-file', $EnvFile, '-f', 'deployment/offline/compose.yaml', '-f', $Override,
    '-f', 'deployment/offline/compose.https.yaml')
$authority = '/data/caddy/pki/authorities/local'
$volume = "${Project}_https-data"
function Fail([string]$message) { Write-Error $message -ErrorAction Stop }

$address = (Get-Content -LiteralPath $EnvFile | Where-Object { $_ -match '^KAVITA_BIND_ADDRESS=' }) -replace '^KAVITA_BIND_ADDRESS=', ''
if (-not $address -or $address -in '0.0.0.0', '::') { Fail "KAVITA_BIND_ADDRESS in $EnvFile must be 127.0.0.1 or the private LAN address." }
$port = (Get-Content -LiteralPath $EnvFile | Where-Object { $_ -match '^KAVITA_HTTPS_PORT=' }) -replace '^KAVITA_HTTPS_PORT=', ''
if (-not $port) { $port = '5443' }
# Kavita's image has curl and a shell for the helper steps below
$image = (docker @compose config --format json 2>$null | ConvertFrom-Json).services.kavita.image
if (-not $image) { Fail 'Invalid Compose configuration.' }

New-Item -ItemType Directory -Force -Path $CaDir | Out-Null
$ca = (Resolve-Path -LiteralPath $CaDir).Path
# A lost proxy volume gets the same authority back, so clients keep trusting it
$fresh = -not (docker volume ls -q --filter "name=^$volume$")
if ($fresh -and (Test-Path (Join-Path $ca 'root.key')) -and (Test-Path (Join-Path $ca 'root.crt'))) {
    # With the labels Compose itself would set, so it adopts the volume as its own
    docker volume create --label "com.docker.compose.project=$Project" --label 'com.docker.compose.volume=https-data' $volume | Out-Null
    docker run --rm --mount "type=volume,source=$volume,target=/data" --mount "type=bind,source=$ca,target=/ca,readonly" `
        --entrypoint /bin/sh $image -c "mkdir -p $authority && cp /ca/root.crt /ca/root.key $authority/ && chmod 600 $authority/root.key"
    if ($LASTEXITCODE -ne 0) { Fail 'Could not restore the local authority into the proxy volume.' }
    Write-Host "Local authority restored from $ca"
}

docker @compose up -d --no-deps https
if ($LASTEXITCODE -ne 0) { Fail 'The HTTPS proxy did not start.' }

# Caddy creates the authority when it issues the first certificate
$deadline = (Get-Date).AddSeconds($WaitSeconds)
do {
    docker @compose exec -T https test -s "$authority/root.crt" 2>$null
    if ($LASTEXITCODE -eq 0) { break }
    Start-Sleep -Seconds 2
} while ((Get-Date) -lt $deadline)
if ($LASTEXITCODE -ne 0) { Fail 'The local authority was not created in time.' }
foreach ($file in 'root.crt', 'root.key') {
    docker @compose cp "https:$authority/$file" (Join-Path $ca $file) | Out-Null
    if ($LASTEXITCODE -ne 0) { Fail "Could not export $file." }
}

# As a client on the home network would connect, trusting only the exported root
$ok = $false
do {
    docker run --rm --network "${Project}_default" --mount "type=bind,source=$ca,target=/ca,readonly" --entrypoint curl $image `
        -fsS --max-time 10 --cacert /ca/root.crt --connect-to "${address}:443:https:443" "https://$address/api/health" | Out-Null
    if ($LASTEXITCODE -eq 0) { $ok = $true; break }
    Start-Sleep -Seconds 3
} while ((Get-Date) -lt $deadline)
if (-not $ok) { Fail 'Kavita does not answer through the HTTPS proxy.' }

$fingerprint = (New-Object Security.Cryptography.X509Certificates.X509Certificate2 (Join-Path $ca 'root.crt')).GetCertHashString('SHA256')
Write-Host "HTTPS ready at https://${address}:$port (the LAN firewall must allow port ${port}: firewall-lan.ps1)."
Write-Host "Root of the local authority: $ca\root.crt, SHA-256 $fingerprint"
Write-Host "Keep $ca private: root.key can issue certificates every client trusts."
