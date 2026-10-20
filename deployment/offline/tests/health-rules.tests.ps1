$ErrorActionPreference = 'Stop'
# Rules of the health task (check-health.ps1), without Docker. Run from the repository root.
. ./deployment/offline/health/health-rules.ps1
$failures = @()
function Check([bool]$condition, [string]$name) {
    if ($condition) { Write-Output "PASS $name" } else { Write-Output "FAIL $name"; $script:failures += $name }
}
function Healthy {
    @{ DockerUp = $true; Container = 'running'; Health = 'healthy'; LanAddressPresent = $true; ApiReachable = $true;
       LogsMB = 10; LogsLimitMB = 200; RestartedRecently = $false; DockerStartedRecently = $false }
}
function Actions([hashtable]$changes) {
    $state = Healthy
    foreach ($key in $changes.Keys) { $state[$key] = $changes[$key] }
    @(Get-HealthActions -State $state)
}
function Kinds($actions) { ($actions | ForEach-Object { $_.Kind }) -join ',' }

Check ((Kinds (Actions @{})) -eq '') 'a healthy server needs nothing'

# After a reboot: Docker came up before the Wi-Fi, the container could not publish on the LAN address
Check ((Kinds (Actions @{ Container = 'exited'; Health = '' })) -eq 'start') 'starts a stopped container'
Check ((Kinds (Actions @{ Container = 'created'; Health = '' })) -eq 'start') 'starts a container that never started'
$noLan = @(Actions @{ Container = 'exited'; Health = ''; LanAddressPresent = $false })
Check ((Kinds $noLan) -eq 'alert') 'without the LAN address it only alerts: never publishes elsewhere'
Check ($noLan.Count -gt 0 -and $noLan[0].Message -match 'IP') 'the alert names the missing address'

# Docker Desktop does not start with Windows on this PC
Check ((Kinds (Actions @{ DockerUp = $false; Container = 'unknown'; Health = '' })) -eq 'start-docker') 'Docker Desktop not running: opens it'
Check ((Kinds (Actions @{ DockerUp = $false; Container = 'unknown'; Health = ''; DockerStartedRecently = $true })) -eq 'alert') 'alerts when opening Docker Desktop did not help'
Check ((Kinds (Actions @{ Container = 'missing'; Health = '' })) -eq 'alert') 'no container: alert, nothing is created'

Check ((Kinds (Actions @{ Health = 'unhealthy' })) -eq 'restart') 'restarts an unhealthy container once'
Check ((Kinds (Actions @{ Health = 'unhealthy'; RestartedRecently = $true })) -eq 'alert') 'alerts when a restart did not help'
Check ((Kinds (Actions @{ Health = 'starting' })) -eq '') 'waits while it starts'

Check ((Kinds (Actions @{ ApiReachable = $false })) -eq 'alert') 'healthy inside but unreachable on the LAN: alert'
Check ((Kinds (Actions @{ LogsMB = 250 })) -eq 'alert') 'logs over the limit: alert'
Check ((Kinds (Actions @{ Health = 'unhealthy'; LogsMB = 250 })) -eq 'restart,alert') 'acts on each problem'

if ($failures) { throw "$($failures.Count) failed: $($failures -join '; ')" }
Write-Output 'All health rule tests passed.'
