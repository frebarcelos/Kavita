param(
    [string]$Project = 'kavita-offline-f1',
    # Log and alert history; the same folder as the backups
    [string]$LogDir = 'C:\KavitaBackups',
    [int]$LogsLimitMB = 200,
    # The same alert is not shown again before this
    [int]$RepeatAlertHours = 6,
    # Only shows the state and the actions, without acting
    [switch]$WhatIf
)
# Native tools write to stderr; each one is checked by its exit code instead
$ErrorActionPreference = 'Continue'
# Run by the "Kavita - saúde" task (install-health-task.ps1) at logon and every 15 minutes. After a reboot it starts
# the server when Docker came up before the Wi-Fi, restarts it once when unhealthy and shows a Windows notification
# for what it cannot fix. It never creates a container nor changes the address the server is published on.
. (Join-Path $PSScriptRoot 'health/health-rules.ps1')

New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
$logFile = Join-Path $LogDir 'health.log'
$stateFile = Join-Path $LogDir 'health-state.json'
function Log([string]$message) { "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') $message" | Add-Content -Encoding UTF8 $logFile }

$memory = @{ LastRestart = $null; LastDockerStart = $null; Alerts = @{} }
if (Test-Path $stateFile) {
    try {
        $saved = Get-Content -Raw $stateFile | ConvertFrom-Json
        if ($saved.LastRestart) { $memory.LastRestart = [datetime]$saved.LastRestart }
        if ($saved.LastDockerStart) { $memory.LastDockerStart = [datetime]$saved.LastDockerStart }
        foreach ($p in $saved.Alerts.PSObject.Properties) { $memory.Alerts[$p.Name] = [datetime]$p.Value }
    } catch { }
}

$state = @{ DockerUp = $false; Container = 'unknown'; Health = ''; LanAddressPresent = $false; ApiReachable = $false
            LogsMB = 0; LogsLimitMB = $LogsLimitMB
            RestartedRecently = [bool]($memory.LastRestart -and $memory.LastRestart -gt (Get-Date).AddHours(-1))
            DockerStartedRecently = [bool]($memory.LastDockerStart -and $memory.LastDockerStart -gt (Get-Date).AddMinutes(-15)) }
docker info --format '{{.ServerVersion}}' *> $null
$state.DockerUp = $LASTEXITCODE -eq 0

$id = $null
if ($state.DockerUp) {
    # Found by its Compose labels, as deploy-fork.ps1 does
    $filters = @('--filter', "label=com.docker.compose.project=$Project", '--filter', 'label=com.docker.compose.service=kavita')
    $ids = @(docker ps -aq @filters)
    if ($ids.Count -gt 1) { $ids = @(docker ps -q @filters) }
    if ($ids.Count -ne 1) {
        $state.Container = 'missing'
    } else {
        $id = $ids[0]
        # Read from JSON: Windows PowerShell drops the quotes a Go template would need
        $info = (docker inspect $id | ConvertFrom-Json)[0]
        $state.Container = $info.State.Status
        if ($info.State.Health) { $state.Health = $info.State.Health.Status }
        $binding = @($info.HostConfig.PortBindings.'5000/tcp')[0]
        $address = $binding.HostIp
        $port = $binding.HostPort
        $state.LanAddressPresent = [bool]($address -and (Get-NetIPAddress -IPAddress $address -ErrorAction SilentlyContinue))
        if ($state.Container -eq 'running') {
            try {
                $state.ApiReachable = (Invoke-WebRequest -UseBasicParsing -TimeoutSec 10 "http://${address}:$port/api/health").StatusCode -eq 200
            } catch { }
            $du = docker exec $id du -sm /kavita/config/logs 2> $null
            if ($LASTEXITCODE -eq 0 -and $du) { $state.LogsMB = [int](($du -split '\s+')[0]) }
        }
    }
}

$actions = @(Get-HealthActions -State $state)
if ($WhatIf) {
    $state.GetEnumerator() | Sort-Object Name | ForEach-Object { "$($_.Name) = $($_.Value)" }
    $actions | ForEach-Object { "$($_.Kind): $($_.Message)" }
    return
}

function Show-Alert([string]$text) {
    try {
        [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
        [Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime] | Out-Null
        $xml = New-Object Windows.Data.Xml.Dom.XmlDocument
        $body = [Security.SecurityElement]::Escape($text)
        $xml.LoadXml("<toast><visual><binding template='ToastGeneric'><text>Kavita</text><text>$body</text></binding></visual></toast>")
        $appId = '{1AC14E77-02E7-4E5D-B744-2EB1AE5198B7}\WindowsPowerShell\v1.0\powershell.exe'
        [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier($appId).Show(
            [Windows.UI.Notifications.ToastNotification]::new($xml))
    } catch {
        Log "Notificação não exibida: $($_.Exception.Message)"
    }
}

foreach ($action in $actions) {
    switch ($action.Kind) {
        'start-docker' {
            $desktop = Join-Path $env:ProgramFiles 'Docker\Docker\Docker Desktop.exe'
            if (Test-Path $desktop) { Start-Process $desktop } else { Log "Docker Desktop não encontrado em $desktop" }
            $memory.LastDockerStart = Get-Date
            Log $action.Message
        }
        'start' {
            docker start $id | Out-Null
            Log "$($action.Message) (exit $LASTEXITCODE)"
        }
        'restart' {
            docker restart $id | Out-Null
            $memory.LastRestart = Get-Date
            Log "$($action.Message) (exit $LASTEXITCODE)"
        }
        'alert' {
            $last = $memory.Alerts[$action.Message]
            if (-not $last -or $last -lt (Get-Date).AddHours(-$RepeatAlertHours)) {
                Show-Alert $action.Message
                $memory.Alerts[$action.Message] = Get-Date
            }
            Log "ALERTA $($action.Message)"
        }
    }
}
if (-not $actions) {
    # Problems that are gone may alert again as soon as they come back
    $memory.Alerts = @{}
}

$alerts = @{}
foreach ($key in $memory.Alerts.Keys) { $alerts[$key] = $memory.Alerts[$key].ToString('o') }
$lastRestart = if ($memory.LastRestart) { $memory.LastRestart.ToString('o') } else { $null }
$lastDockerStart = if ($memory.LastDockerStart) { $memory.LastDockerStart.ToString('o') } else { $null }
@{ LastRestart = $lastRestart; LastDockerStart = $lastDockerStart; Alerts = $alerts } | ConvertTo-Json | Set-Content -Encoding UTF8 $stateFile
