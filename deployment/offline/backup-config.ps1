param(
    [string]$Container = 'kavita-offline-f1-kavita-1',
    # A folder of this PC, outside Docker and the repository (user decision of 2026-10-19)
    [string]$Destination = 'C:\KavitaBackups',
    [int]$KeepDaily = 7,
    [int]$KeepWeekly = 4,
    [string]$ToolsImage = 'kavita-backup-tools:3'
)
$ErrorActionPreference = 'Stop'
# Backs up the personal state of the running server, without stopping it: a consistent copy of kavita.db (SQLite
# online backup, checked with integrity_check), the covers, the custom site themes and the appsettings files. The cache is left out: Kavita
# rebuilds it. The library is never read. The archive holds the server secrets: keep the folder private.
. (Join-Path $PSScriptRoot 'backup/retention.ps1')

# Native tools write progress to stderr; under a redirected run (the scheduled task logs with *>>) that must not stop
# the script, so they run with Continue and are checked by exit code
function Invoke-Native([scriptblock]$command) {
    $ErrorActionPreference = 'Continue'
    & $command
}

if (-not (Invoke-Native { docker images -q $ToolsImage })) {
    Invoke-Native { docker build -q -t $ToolsImage -f (Join-Path $PSScriptRoot 'backup/Dockerfile.tools') (Join-Path $PSScriptRoot 'backup') | Out-Null }
    if ($LASTEXITCODE -ne 0) { throw "Cannot build $ToolsImage." }
}
# Read from JSON: Windows PowerShell drops the quotes a Go template would need here
$active = ((Invoke-Native { docker inspect $Container } | ConvertFrom-Json)[0].Mounts | Where-Object { $_.Destination -eq '/kavita/config' }).Name
if (-not $active) { throw "Configuration volume of $Container not found." }

New-Item -ItemType Directory -Force -Path $Destination | Out-Null
$target = (Resolve-Path -LiteralPath $Destination).Path
$name = 'kavita-config-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.tar.gz'
# The configuration volume is mounted writable only because SQLite keeps its lock files next to the database
Invoke-Native { docker run --rm --mount "type=volume,source=$active,target=/config" --mount "type=bind,source=$target,target=/out" `
    $ToolsImage /usr/local/bin/kavita-backup.sh $name }
if ($LASTEXITCODE -ne 0) {
    Remove-Item -LiteralPath (Join-Path $target "$name.partial") -ErrorAction SilentlyContinue
    throw "Backup failed (exit $LASTEXITCODE)."
}
$archive = Join-Path $target $name
$hash = (Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash
"$hash  $name" | Set-Content -Encoding ASCII "$archive.sha256"

$removed = Get-BackupsToRemove -Names (Get-ChildItem -LiteralPath $target -File).Name -KeepDaily $KeepDaily -KeepWeekly $KeepWeekly
foreach ($old in $removed) {
    Remove-Item -LiteralPath (Join-Path $target $old)
    Remove-Item -LiteralPath (Join-Path $target "$old.sha256") -ErrorAction SilentlyContinue
}
Write-Output "Backup $archive ($([math]::Round((Get-Item $archive).Length / 1MB, 1)) MB, integrity ok). Removed: $($removed.Count)."
