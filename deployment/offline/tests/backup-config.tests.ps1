param([Parameter(Mandatory = $true)][string]$Image)
$ErrorActionPreference = 'Stop'
# Backup and restore on a disposable server bound to 127.0.0.1 (5058 and 5059). The main server and the library are
# never used. Run from the repository root, without redirecting stderr; everything created here is removed at the end.

$name = 'kavita-backuptest'
$restored = "$name-restored"
$root = '_temp/backup-test'
$failures = @()
function Check([bool]$condition, [string]$label) {
    if ($condition) { Write-Output "PASS $label" } else { Write-Output "FAIL $label"; $script:failures += $label }
}
function Wait-Healthy([string]$url) {
    $deadline = (Get-Date).AddSeconds(240)
    while ((Get-Date) -lt $deadline) {
        try { if ((Invoke-WebRequest -UseBasicParsing -TimeoutSec 5 $url).StatusCode -eq 200) { return $true } } catch { }
        Start-Sleep -Seconds 3
    }
    return $false
}
function Sql([string]$volume, [string]$query) {
    docker run --rm --mount "type=volume,source=$volume,target=/config,readonly" kavita-backup-tools:3 sqlite3 -readonly /config/kavita.db $query
}
function Cleanup {
    $ErrorActionPreference = 'Continue'
    foreach ($c in $name, $restored) { if (docker ps -aq --filter "name=^$c$") { docker rm -f $c | Out-Null } }
    foreach ($v in $name, $restored) { if (docker volume ls -q --filter "name=^$v$") { docker volume rm $v | Out-Null } }
    if (Test-Path $root) { Remove-Item -Recurse -Force $root }
}

Cleanup
New-Item -ItemType Directory -Force -Path "$root/backups" | Out-Null
try {
    docker run -d --name $name -p 127.0.0.1:5058:5000 --mount "type=volume,source=$name,target=/kavita/config" $Image | Out-Null
    Check (Wait-Healthy 'http://127.0.0.1:5058/api/health') 'disposable server starts'
    docker exec $name sh -c 'mkdir -p /kavita/config/covers /kavita/config/cache /kavita/config/themes && echo cover > /kavita/config/covers/c1.png && echo custom-theme-v1 > /kavita/config/themes/custom.css && head -c 1048576 /dev/zero > /kavita/config/cache/big.bin'

    # Two backups of the running server; it keeps running
    & ./deployment/offline/backup-config.ps1 -Container $name -Destination "$root/backups"
    Start-Sleep -Seconds 1
    & ./deployment/offline/backup-config.ps1 -Container $name -Destination "$root/backups"
    Check ((docker inspect -f '{{.State.Running}}' $name) -eq 'true') 'server keeps running during the backup'
    $archives = @(Get-ChildItem "$root/backups" -Filter 'kavita-config-*.tar.gz')
    Check ($archives.Count -eq 1) 'one backup a day is kept'
    $archive = $archives[0].FullName
    $listing = @(tar -tzf $archive)
    Check ($listing -contains './kavita.db') 'archive has the database'
    Check (@($listing | Where-Object { $_ -match '^covers/c1.png$' }).Count -eq 1) 'archive has the covers'
    # A user site theme lives only in the configuration volume; without it the restored server answers 400 for the theme
    Check (@($listing | Where-Object { $_ -match '^themes/custom.css$' }).Count -eq 1) 'archive has the custom site themes'
    Check (@($listing | Where-Object { $_ -match '(^|/)cache/' }).Count -eq 0) 'archive leaves the cache out'
    $expected = (Get-Content "$archive.sha256").Split(' ')[0]
    Check ($expected -eq (Get-FileHash $archive -Algorithm SHA256).Hash) 'checksum matches'

    # Restore into a new volume and start a server on it
    docker volume create $restored | Out-Null
    $dir = (Resolve-Path "$root/backups").Path
    docker run --rm --mount "type=volume,source=$restored,target=/config" --mount "type=bind,source=$dir,target=/in,readonly" `
        kavita-backup-tools:3 tar -xzf "/in/$($archives[0].Name)" -C /config
    docker run -d --name $restored -p 127.0.0.1:5059:5000 --mount "type=volume,source=$restored,target=/kavita/config" $Image | Out-Null
    Check (Wait-Healthy 'http://127.0.0.1:5059/api/health') 'restored server starts'
    $tables = "SELECT count(*) FROM sqlite_master WHERE type='table'"
    Check ((Sql $name $tables) -eq (Sql $restored $tables)) 'restored database has the same tables'
    $users = 'SELECT count(*) FROM AspNetUsers'
    Check ((Sql $name $users) -eq (Sql $restored $users)) 'restored database has the same accounts'
    $theme = docker exec $restored sh -c 'cat /kavita/config/themes/custom.css 2>/dev/null'
    Check ($theme -eq 'custom-theme-v1') 'restored server has the custom site theme'
} finally {
    Cleanup
}
if ($failures) { throw "$($failures.Count) failed: $($failures -join '; ')" }
Write-Output 'All backup tests passed.'
