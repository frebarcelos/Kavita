param(
    # Two images that start healthy; the deploys switch between them
    [Parameter(Mandatory = $true)][string]$ImageA,
    [Parameter(Mandatory = $true)][string]$ImageB
)
$ErrorActionPreference = 'Stop'
# Behaviour tests for deploy-fork.ps1 on a disposable project bound to 127.0.0.1:5057. The main server, its volumes
# and the library are never used. Run from the repository root; everything created here is removed at the end.

$project = 'kavita-deploytest'
$container = "$project-kavita-1"
$root = '_temp/deploy-test'
$active = "$project-active"
$broken = "${project}:broken"
$failures = @()

function Check([bool]$condition, [string]$name) {
    if ($condition) { Write-Output "PASS $name" } else { Write-Output "FAIL $name"; $script:failures += $name }
}
function Deploy([string]$image, [hashtable]$extra = @{}) {
    $params = @{Image = $image; Project = $project; EnvFile = "$root/.env"; Override = "$root/override.yaml"; BindAddress = '127.0.0.1'; BackupRoot = "$root/deploys"} + $extra
    & ./deployment/offline/deploy-fork.ps1 @params
}
function RunningImage { docker inspect -f '{{.Config.Image}}' $container }
function Cleanup {
    $ErrorActionPreference = 'Continue'
    docker ps -aq --filter "label=com.docker.compose.project=$project" | ForEach-Object { docker rm -f $_ | Out-Null }
    docker volume ls -q --filter "label=kavita.fork.checkpoint=$project" | ForEach-Object { docker volume rm $_ | Out-Null }
    if (docker volume ls -q --filter "name=^$active$") { docker volume rm $active | Out-Null }
    if (docker images -q $broken) { docker rmi $broken | Out-Null }
    if (Test-Path $root) { Remove-Item -Recurse -Force $root }
}

Cleanup
New-Item -ItemType Directory -Force -Path "$root/library/Series" | Out-Null
Set-Content -Path "$root/library/Series/readme.txt" -Value 'disposable library'
$library = (Resolve-Path "$root/library").Path
@"
KAVITA_LIBRARY_PATH=$library
KAVITA_BIND_ADDRESS=127.0.0.1
KAVITA_PORT=5057
"@ | Set-Content -Encoding ASCII "$root/.env"
@"
services:
  kavita:
    image: $ImageA
volumes:
  config:
    external: true
    name: $active
"@ | Set-Content -Encoding UTF8 "$root/override.yaml"
docker volume create $active | Out-Null
"FROM $ImageB`nENTRYPOINT [`"/bin/false`"]" | docker build -q -t $broken - | Out-Null

try {
    docker compose -p $project --env-file "$root/.env" -f deployment/offline/compose.yaml -f "$root/override.yaml" up -d --wait --wait-timeout 240 | Out-Null
    Check ((RunningImage) -eq $ImageA) 'disposable server starts'
    # A disposable cache file that must stay out of checkpoints
    docker exec $container sh -c 'mkdir -p /kavita/config/cache && head -c 1048576 /dev/zero > /kavita/config/cache/big.bin'

    # Not enough space: refused before stopping anything
    $refused = $false
    try { Deploy $ImageB @{MinFreeGB = 1000000} } catch { $refused = $true }
    Check $refused 'refuses without free space'
    Check ((RunningImage) -eq $ImageA -and (docker inspect -f '{{.State.Running}}' $container) -eq 'true') 'server untouched after refusal'

    # A deploy already running (or interrupted) holds a lock: a second one refuses before stopping anything
    New-Item -ItemType Directory -Force -Path "$root/deploys" | Out-Null
    Set-Content -Path "$root/deploys/.deploy.lock" -Value 'held'
    $locked = $false
    try { Deploy $ImageB } catch { $locked = $_.Exception.Message -match 'lock' }
    Check $locked 'refuses while another deploy holds the lock'
    Check ((RunningImage) -eq $ImageA -and (docker inspect -f '{{.State.Running}}' $container) -eq 'true') 'server untouched while locked'
    Remove-Item "$root/deploys/.deploy.lock"

    # An interrupted Compose recreate leaves the container under a temporary name: the deploy still finds it
    docker rename $container "0123456789ab_$container" | Out-Null
    Deploy $ImageB
    Check ((docker ps -q --filter "name=^$container$") -ne $null) 'container back under its own name'
    Check ((RunningImage) -eq $ImageB) 'deploy works from a temporary name'
    Check (-not (Test-Path "$root/deploys/.deploy.lock")) 'lock released after the deploy'
    Deploy $ImageA

    # Successful deploy
    Deploy $ImageB
    Check ((RunningImage) -eq $ImageB) 'runs the new image'
    Check ((docker inspect -f '{{.State.Health.Status}}' $container) -eq 'healthy') 'new image healthy'
    Check ((Get-Content "$root/override.yaml" -Raw).Contains("image: $ImageB")) 'override points to the new image'
    # Newest first; the deploys above already left two
    $checkpoints = @(docker volume ls -q --filter "label=kavita.fork.checkpoint=$project" | Sort-Object -Descending)
    Check ($checkpoints.Count -eq 2) 'two labelled checkpoints at most'
    $listing = @(docker run --rm --mount "type=volume,source=$($checkpoints[0]),target=/c,readonly" --entrypoint /bin/ls $ImageB /c)
    Check ($listing -contains 'kavita.db') 'checkpoint keeps the database'
    Check ($listing -notcontains 'cache') 'checkpoint leaves the cache out'
    $archive = Get-ChildItem "$root/deploys" -Recurse -Filter config.tar.gz | Select-Object -First 1
    Check ($archive -and -not ((tar -tzf $archive.FullName) -match '^\./cache/')) 'archive leaves the cache out'

    # Broken image: rolls back to the running one
    $rolledBack = $false
    try { Deploy $broken } catch { $rolledBack = $_.Exception.Message -match 'rolled back' }
    Check $rolledBack 'reports the rollback'
    Check ((RunningImage) -eq $ImageB) 'previous image running again'
    Check ((docker inspect -f '{{.State.Health.Status}}' $container) -eq 'healthy') 'previous image healthy again'
    Check ((Get-Content "$root/override.yaml" -Raw).Contains("image: $ImageB")) 'override restored'

    # Retention: only the newest two checkpoints stay
    Deploy $ImageA
    Deploy $ImageB
    Check (@(docker volume ls -q --filter "label=kavita.fork.checkpoint=$project").Count -eq 2) 'keeps two checkpoint volumes'
    Check (@(Get-ChildItem "$root/deploys" -Directory | Where-Object { Test-Path (Join-Path $_.FullName 'deploy.json') }).Count -le 2) 'keeps two archives'
} finally {
    Cleanup
}
if ($failures) { throw "$($failures.Count) failed: $($failures -join '; ')" }
Write-Output 'All deploy tests passed.'
