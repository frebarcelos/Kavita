param(
    [string]$LogDir = 'C:\KavitaBackups',
    [int]$EveryMinutes = 15,
    [string]$TaskName = 'Kavita - saude',
    # Only shows what would be registered
    [switch]$WhatIf
)
$ErrorActionPreference = 'Stop'
# Registers a Windows task, for the current user (Docker Desktop and the notifications live in this user's session),
# that runs check-health.ps1 at logon and every $EveryMinutes minutes. Run once, from any folder.

$script = Join-Path $PSScriptRoot 'check-health.ps1'
$command = "& '$script' -LogDir '$LogDir'"
# conhost --headless runs PowerShell without any window: -WindowStyle Hidden still flashes a console on every run
$action = New-ScheduledTaskAction -Execute 'conhost.exe' -Argument "--headless powershell.exe -NoProfile -ExecutionPolicy Bypass -Command `"$command`""
$atLogon = New-ScheduledTaskTrigger -AtLogOn -User "$env:USERDOMAIN\$env:USERNAME"
# Wait for the Wi-Fi and Docker after logon, then check again every few minutes
$atLogon.Delay = 'PT2M'
$repeat = New-ScheduledTaskTrigger -Once -At (Get-Date).Date -RepetitionInterval (New-TimeSpan -Minutes $EveryMinutes)
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Minutes 5)
$principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive
if ($WhatIf) {
    Write-Output "Task '$TaskName' at logon (after 2 minutes) and every $EveryMinutes minutes, as $env:USERNAME"
    Write-Output "conhost.exe $($action.Arguments)"
    return
}
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger @($atLogon, $repeat) -Settings $settings -Principal $principal `
    -Description 'Kavita: starts the server after a reboot, restarts it when unhealthy and alerts (deployment/offline/check-health.ps1).' -Force | Out-Null
Write-Output "Registered '$TaskName'. Log in $(Join-Path $LogDir 'health.log'). Run it now with: Start-ScheduledTask -TaskName '$TaskName'"
