param([Parameter(Mandatory = $true)][string]$Image)
$ErrorActionPreference = 'Stop'
# The health task on a disposable server bound to 127.0.0.1:5061, under its own Compose project labels. The main
# server and the library are never used. Run from the repository root, without redirecting stderr; everything created
# here is removed at the end. The "no container" case shows one Windows notification.

$project = 'kavita-healthtest'
$name = "$project-kavita-1"
$root = '_temp/health-test'
$failures = @()
function Check([bool]$condition, [string]$label) {
    if ($condition) { Write-Output "PASS $label" } else { Write-Output "FAIL $label"; $script:failures += $label }
}
function Wait-Healthy {
    $deadline = (Get-Date).AddSeconds(240)
    while ((Get-Date) -lt $deadline) {
        if ((docker inspect -f '{{.State.Health.Status}}' $name) -eq 'healthy') { return $true }
        Start-Sleep -Seconds 3
    }
    return $false
}
function Status([string]$container = $name) { docker inspect -f '{{.State.Status}}' $container }
$proxy = "$project-https-1"
$network = "$project-net"
function Cleanup {
    $ErrorActionPreference = 'Continue'
    foreach ($c in $name, $proxy) { if (docker ps -aq --filter "name=^$c$") { docker rm -f $c | Out-Null } }
    if (docker volume ls -q --filter "name=^$name$") { docker volume rm $name | Out-Null }
    if (docker network ls -q --filter "name=^$network$") { docker network rm $network | Out-Null }
    if (Test-Path $root) { Remove-Item -Recurse -Force $root }
}

Cleanup
New-Item -ItemType Directory -Force -Path $root | Out-Null
try {
    docker network create $network | Out-Null
    docker run -d --name $name --network $network --network-alias kavita -p 127.0.0.1:5061:5000 --mount "type=volume,source=$name,target=/kavita/config" `
        --label "com.docker.compose.project=$project" --label 'com.docker.compose.service=kavita' `
        --health-cmd 'curl -fsS http://localhost:5000/api/health' --health-interval 5s --health-retries 5 $Image | Out-Null
    Check (Wait-Healthy) 'disposable server starts'

    & ./deployment/offline/check-health.ps1 -Project $project -LogDir $root
    $log = "$root/health.log"
    Check (-not ((Test-Path $log) -and (Select-String -Path $log -Pattern 'ALERTA|iniciado|reiniciado' -Quiet))) 'healthy server: nothing done'

    # As after a reboot with the Wi-Fi late: the container is stopped
    docker stop $name | Out-Null
    & ./deployment/offline/check-health.ps1 -Project $project -LogDir $root
    Check ((Status) -eq 'running') 'starts the stopped server'
    Check (Select-String -Path "$root/health.log" -Pattern 'Container parado' -Quiet) 'logs the start'
    Check (Wait-Healthy) 'healthy again'

    # The HTTPS proxy of the same project, stopped: the task starts it again
    $caddyfile = (Resolve-Path deployment/offline/https/Caddyfile).Path
    docker run -d --name $proxy --network $network -p 127.0.0.1:5446:443 -e KAVITA_HTTPS_HOST=127.0.0.1 `
        --mount "type=bind,source=$caddyfile,target=/etc/caddy/Caddyfile,readonly" `
        --label "com.docker.compose.project=$project" --label 'com.docker.compose.service=https' `
        caddy:2.8.4-alpine@sha256:af32e97399febea808609119bb21544d0265c58a02836576e32a2d082c262c17 | Out-Null
    Start-Sleep -Seconds 5
    docker stop $proxy | Out-Null
    & ./deployment/offline/check-health.ps1 -Project $project -LogDir $root
    Check ((Status $proxy) -eq 'running') 'starts the stopped HTTPS proxy'
    Check (Select-String -Path "$root/health.log" -Pattern 'Proxy HTTPS parado' -Quiet) 'logs the proxy start'
    Start-Sleep -Seconds 5
    $before = @(Get-Content "$root/health.log").Count
    & ./deployment/offline/check-health.ps1 -Project $project -LogDir $root
    Check (@(Get-Content "$root/health.log").Count -eq $before) 'the proxy answers: nothing more to do'

    # No container: alert only, nothing created
    & ./deployment/offline/check-health.ps1 -Project 'kavita-healthtest-none' -LogDir $root
    Check (Select-String -Path "$root/health.log" -Pattern 'ALERTA O container do Kavita' -Quiet) 'alerts when there is no container'
    Check (-not (docker ps -aq --filter 'label=com.docker.compose.project=kavita-healthtest-none')) 'creates no container'
    $state = Get-Content -Raw "$root/health-state.json" | ConvertFrom-Json
    $alerted = @($state.Alerts.PSObject.Properties).Count
    & ./deployment/offline/check-health.ps1 -Project 'kavita-healthtest-none' -LogDir $root
    $state = Get-Content -Raw "$root/health-state.json" | ConvertFrom-Json
    Check ($alerted -eq 1 -and @($state.Alerts.PSObject.Properties).Count -eq 1) 'remembers the alert, so it is not shown again at once'
} finally {
    Cleanup
}
if ($failures) { throw "$($failures.Count) failed: $($failures -join '; ')" }
Write-Output 'All health task tests passed.'
