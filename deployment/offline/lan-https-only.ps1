param(
    [string]$Project = 'kavita-offline-f1',
    [string]$EnvFile = '_temp/offline-f1/.env',
    [string]$Override = '_temp/offline-f1/compose.libraries.yaml',
    # Root of the local authority exported by enable-https.ps1, to check HTTPS as a client would
    [string]$CaDir = 'C:\KavitaBackups\https',
    # Where Kavita's own HTTP port goes: the PC only
    [string]$LocalAddress = '127.0.0.1',
    # Puts HTTP back on the LAN address (rollback)
    [switch]$Undo,
    [int]$WaitSeconds = 240
)
# Native tools write progress to stderr; each one is checked by its exit code instead
$ErrorActionPreference = 'Continue'
# Fork (item 5.5, last step): the home network reaches Kavita only through the HTTPS proxy. Kavita's HTTP port moves to
# 127.0.0.1 (still usable on the PC itself) and the proxy keeps the LAN address. Run from the repository root after
# every client uses HTTPS. Recreates the Kavita container (same image and volumes); on any failure the previous env
# file is put back and the server started as it was. Afterwards, as administrator: firewall-lan.ps1 -Ports 5443.

$base = @('compose', '-p', $Project, '--env-file', $EnvFile, '-f', 'deployment/offline/compose.yaml', '-f', $Override,
    '-f', 'deployment/offline/compose.https.yaml')
function Fail([string]$message) { Write-Error $message -ErrorAction Stop }
function Step([string]$message) { Write-Host "[$(Get-Date -Format 'HH:mm:ss')] $message" }
function EnvValue([string[]]$lines, [string]$name) { ($lines | Where-Object { $_ -match "^$name=" }) -replace "^$name=", '' }
function Set-EnvValue([string[]]$lines, [string]$name, [string]$value) {
    $found = $false
    $result = foreach ($line in $lines) {
        if ($line -match "^$name=") { $found = $true; "$name=$value" } else { $line }
    }
    if (-not $found) { $result = @($result) + "$name=$value" }
    return $result
}
function Bindings {
    $config = docker @base config --format json | ConvertFrom-Json
    [pscustomobject]@{
        Http = @($config.services.kavita.ports)[0].host_ip
        Https = @($config.services.https.ports)[0].host_ip
        Image = $config.services.kavita.image
    }
}
function Wait-Ready([string]$lan) {
    $deadline = (Get-Date).AddSeconds($WaitSeconds)
    while ((Get-Date) -lt $deadline) {
        $id = docker @base ps -q kavita
        if ($id -and (docker inspect -f '{{.State.Health.Status}}' $id) -eq 'healthy') {
            # Through the proxy, trusting only the local authority, as the tablet does
            docker run --rm --network "${Project}_default" --mount "type=bind,source=$ca,target=/ca,readonly" --entrypoint curl `
                (Bindings).Image -fsS --max-time 10 --cacert /ca/root.crt --connect-to "${lan}:443:https:443" "https://$lan/api/health" | Out-Null
            if ($LASTEXITCODE -eq 0) { return $true }
        }
        Start-Sleep -Seconds 3
    }
    return $false
}

$ca = (Resolve-Path -LiteralPath $CaDir).Path
if (-not (Test-Path (Join-Path $ca 'root.crt'))) { Fail "No root.crt in ${CaDir}: run enable-https.ps1 first." }
$lines = @(Get-Content -LiteralPath $EnvFile)
$lan = EnvValue $lines 'KAVITA_HTTPS_BIND_ADDRESS'
if (-not $lan) { $lan = EnvValue $lines 'KAVITA_BIND_ADDRESS' }
if (-not $lan -or $lan -in '0.0.0.0', '::', $LocalAddress) { Fail "The LAN address in $EnvFile is '$lan': nothing to move." }
if (-not (docker @base ps -q https)) { Fail 'The HTTPS proxy is not running: run enable-https.ps1 first.' }

$http = if ($Undo) { $lan } else { $LocalAddress }
$new = Set-EnvValue (Set-EnvValue $lines 'KAVITA_HTTPS_BIND_ADDRESS' $lan) 'KAVITA_BIND_ADDRESS' $http
$backup = "$EnvFile.before-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
Copy-Item -LiteralPath $EnvFile $backup
$new | Set-Content -Encoding ASCII -LiteralPath $EnvFile

$bindings = Bindings
if ($bindings.Http -ne $http -or $bindings.Https -ne $lan) {
    Copy-Item -LiteralPath $backup $EnvFile -Force
    Fail "The new configuration would publish HTTP on '$($bindings.Http)' and HTTPS on '$($bindings.Https)'; nothing changed."
}

Step "Kavita HTTP on $http, HTTPS on ${lan}: recreating the server (a few seconds offline)"
docker @base up -d kavita https
if ($LASTEXITCODE -ne 0 -or -not (Wait-Ready $lan)) {
    Step 'Not ready: putting the previous configuration back'
    Copy-Item -LiteralPath $backup $EnvFile -Force
    docker @base up -d kavita https
    $back = Wait-Ready $lan
    Fail "The server did not get ready; rolled back ($(if ($back) { 'healthy' } else { 'NOT healthy: check now' }))."
}
Step "Done. Previous env file: $backup"
if (-not $Undo) {
    Step "Now, as administrator: ./deployment/offline/firewall-lan.ps1 -Ports 5443"
}
