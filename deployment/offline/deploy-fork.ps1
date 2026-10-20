param(
    # Image to run, for example kavita-fork:fork-v1.1
    [Parameter(Mandatory = $true)][string]$Image,
    [string]$Project = 'kavita-offline-f1',
    [string]$EnvFile = '_temp/offline-f1/.env',
    [string]$Override = '_temp/offline-f1/compose.libraries.yaml',
    # The address the server must stay published on: KAVITA_BIND_ADDRESS of the env file by default (the private LAN
    # address, or 127.0.0.1 once lan-https-only.ps1 leaves the LAN to the HTTPS proxy), never 0.0.0.0
    [string]$BindAddress = '',
    # Copies of the configuration taken before each deploy; outside the Docker volumes
    [string]$BackupRoot = '_temp/offline-f1/deploys',
    # Checkpoints (volumes and archives) kept, the newest first
    [int]$Keep = 2,
    [int]$MinFreeGB = 5,
    [int]$WaitSeconds = 240
)
$ErrorActionPreference = 'Stop'
# Replaces the per-version apply-main-r*.ps1 scripts. Run from the repository root.
# Stops the server, saves the configuration volume without its disposable cache, starts the new image and waits for
# it to be healthy; if it does not get healthy, puts the previous override back and starts the previous image again.
# The library is never touched: it stays mounted read-only by the Compose files.

if (-not $BindAddress) {
    $BindAddress = (Get-Content -LiteralPath $EnvFile | Where-Object { $_ -match '^KAVITA_BIND_ADDRESS=' }) -replace '^KAVITA_BIND_ADDRESS=', ''
}
if (-not $BindAddress -or $BindAddress -in '0.0.0.0', '::') { throw "KAVITA_BIND_ADDRESS must be 127.0.0.1 or the private LAN address, not '$BindAddress'." }
$container = "$Project-kavita-1"
$composeBase = @('compose', '-p', $Project, '--env-file', $EnvFile, '-f', 'deployment/offline/compose.yaml', '-f')
$checkpointLabel = "kavita.fork.checkpoint=$Project"

function Step([string]$message) { Write-Host "[$(Get-Date -Format 'HH:mm:ss')] $message" }

function Invoke-Compose([string]$overrideFile, [string[]]$arguments) {
    docker @composeBase $overrideFile @arguments
    return $LASTEXITCODE
}

# The server is found by its Compose labels, not by name: an interrupted recreate leaves it under a temporary name
function Get-ServerId {
    $filters = @('--filter', "label=com.docker.compose.project=$Project", '--filter', 'label=com.docker.compose.service=kavita')
    $ids = @(docker ps -aq @filters)
    if ($ids.Count -gt 1) { $ids = @(docker ps -q @filters) }
    if ($ids.Count -ne 1) { return $null }
    return $ids[0]
}

function Restore-ServerName {
    $id = Get-ServerId
    if ($id -and (docker inspect -f '{{.Name}}' $id) -ne "/$container") { docker rename $id $container | Out-Null }
}

function Wait-Healthy {
    $deadline = (Get-Date).AddSeconds($WaitSeconds)
    while ((Get-Date) -lt $deadline) {
        $id = Get-ServerId
        if ($id) {
            $state = docker inspect -f '{{.State.Status}} {{if .State.Health}}{{.State.Health.Status}}{{end}}' $id
            if ($state -eq 'running healthy') { return $true }
            if ($state -and -not $state.StartsWith('running')) { return $false }
        }
        Start-Sleep -Seconds 3
    }
    return $false
}

# --- Checks, before anything stops ---
if (-not (docker images -q $Image)) { throw "Image $Image not found." }
if (-not (Test-Path -LiteralPath $Override)) { throw "Override $Override not found." }
New-Item -ItemType Directory -Force -Path $BackupRoot | Out-Null
# One deploy at a time: a second run, or a run after an interrupted one, must not stop the server again
$lock = Join-Path $BackupRoot '.deploy.lock'
try {
    ([IO.File]::Open((Join-Path (Resolve-Path -LiteralPath $BackupRoot).Path '.deploy.lock'), 'CreateNew', 'Write', 'None')).Close()
} catch {
    throw "Another deploy holds the lock $lock. If none is running (an earlier one was interrupted), check the server and delete the lock."
}
try {
    $serverId = Get-ServerId
    if (-not $serverId) { throw "Server container of project $Project not found." }
    $previousImage = docker inspect -f '{{.Config.Image}}' $serverId
    if ($previousImage -eq $Image) { throw "Already running $Image." }
    # Read from JSON: Windows PowerShell drops the quotes a Go template would need here
    $active = ((docker inspect $serverId | ConvertFrom-Json)[0].Mounts | Where-Object { $_.Destination -eq '/kavita/config' }).Name
    if (-not $active) { throw 'Configuration volume not found on the container.' }

    $drive = (Get-Item -LiteralPath $BackupRoot).PSDrive
    if ($drive.Free -lt $MinFreeGB * 1GB) { throw "Less than $MinFreeGB GB free on $($drive.Name):; free space before deploying." }

    $overrideText = Get-Content -LiteralPath $Override -Raw
    $imageLine = [regex]::Match($overrideText, '(?m)^\s*image:\s*(\S+)\s*$')
    if (-not $imageLine.Success) { throw 'The override has no image line.' }
    $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
    $out = Join-Path $BackupRoot $stamp
    New-Item -ItemType Directory -Path $out | Out-Null
    $before = Join-Path $out 'compose.override.before.yaml'
    $candidate = Join-Path $out 'compose.override.yaml'
    Copy-Item -LiteralPath $Override $before
    $overrideText.Remove($imageLine.Groups[1].Index, $imageLine.Groups[1].Length).Insert($imageLine.Groups[1].Index, $Image) |
        Set-Content -Encoding UTF8 -NoNewline $candidate
    $rendered = docker @composeBase $candidate config
    if ($LASTEXITCODE -ne 0) { throw 'The new Compose configuration is invalid.' }
    $rendered = $rendered -join "`n"
    if (-not $rendered.Contains("image: $Image") -or -not $rendered.Contains($active) -or -not $rendered.Contains("host_ip: $BindAddress")) {
        throw "The new Compose configuration does not keep the image, the volume $active and the address $BindAddress."
    }

    # --- Checkpoint: the volume without cache/ and temp/, then an archive of it ---
    $checkpoint = "kavita-checkpoint-$Project-$stamp"
    Step "Stopping the server ($previousImage). Do not interrupt until the end: it can take a few minutes."
    docker stop $serverId | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Cannot stop the server.' }
    try {
        Step "Saving the configuration to the checkpoint $checkpoint (without cache)"
        docker volume create --label $checkpointLabel $checkpoint | Out-Null
        docker run --rm --mount "type=volume,source=$active,target=/source,readonly" --mount "type=volume,source=$checkpoint,target=/target" `
            --entrypoint /bin/sh $previousImage -c 'cd /source && tar -cf - --exclude=./cache --exclude=./temp . | tar -xf - -C /target'
        if ($LASTEXITCODE -ne 0) { throw 'Checkpoint copy failed.' }
        Step "Writing the archive $out\config.tar.gz"
        $backupDir = (Resolve-Path -LiteralPath $out).Path
        docker run --rm --mount "type=volume,source=$checkpoint,target=/source,readonly" --mount "type=bind,source=$backupDir,target=/backup" `
            --entrypoint /bin/tar $previousImage -czf /backup/config.tar.gz -C /source .
        if ($LASTEXITCODE -ne 0) { throw 'Archive failed.' }
    } catch {
        docker start $serverId | Out-Null
        throw "$($_.Exception.Message) The server was started again unchanged."
    }
    $hash = (Get-FileHash -LiteralPath (Join-Path $out 'config.tar.gz') -Algorithm SHA256).Hash

    # --- Switch, and roll back when the new image does not get healthy ---
    Step "Starting $Image and waiting for its health check (up to $WaitSeconds s)"
    Copy-Item -LiteralPath $candidate $Override -Force
    $started = (Invoke-Compose $Override @('up', '-d')) -eq 0
    if (-not ($started -and (Wait-Healthy))) {
        Step "Not healthy: putting $previousImage back"
        Copy-Item -LiteralPath $before $Override -Force
        Invoke-Compose $Override @('up', '-d') | Out-Null
        $back = Wait-Healthy
        Restore-ServerName
        throw "The new image did not get healthy; rolled back to $previousImage ($(if ($back) { 'healthy' } else { 'NOT healthy: check now' }))."
    }
    Restore-ServerName

    # --- Keep the newest checkpoints only: volumes created by this script (label) and their archives ---
    $removed = @()
    $volumes = docker volume ls -q --filter "label=$checkpointLabel" | Sort-Object -Descending
    foreach ($old in ($volumes | Select-Object -Skip $Keep)) {
        docker volume rm $old | Out-Null
        $removed += "volume $old"
    }
    $archives = Get-ChildItem -LiteralPath $BackupRoot -Directory | Where-Object { $_.Name -match '^\d{8}-\d{6}$' } | Sort-Object Name -Descending
    foreach ($old in ($archives | Select-Object -Skip $Keep)) {
        Remove-Item -LiteralPath $old.FullName -Recurse -Force
        $removed += "archive $($old.Name)"
    }

    @{image = $Image; previousImage = $previousImage; activeVolume = $active; checkpointVolume = $checkpoint; archiveSha256 = $hash;
      removed = $removed; utc = [DateTime]::UtcNow.ToString('o')} | ConvertTo-Json | Set-Content -Encoding UTF8 (Join-Path $out 'deploy.json')
    Write-Output "Running $Image (healthy). Checkpoint $checkpoint, archive $out."
    if ($removed) { Write-Output "Removed older checkpoints: $($removed -join ', ')" }
} finally {
    Remove-Item -LiteralPath $lock -ErrorAction SilentlyContinue
}
