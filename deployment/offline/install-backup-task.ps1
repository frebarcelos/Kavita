param(
    [string]$Destination = 'C:\KavitaBackups',
    [string]$At = '03:00',
    [string]$TaskName = 'Kavita - backup',
    # Only shows what would be registered
    [switch]$WhatIf
)
$ErrorActionPreference = 'Stop'
# Registers a daily Windows task, for the current user (Docker Desktop runs in this user's session), that runs
# backup-config.ps1. If the PC is off at the set time, it runs as soon as possible afterwards. Run once, from any folder.

$script = Join-Path $PSScriptRoot 'backup-config.ps1'
$log = Join-Path $Destination 'backup.log'
$command = "& '$script' -Destination '$Destination' *>> '$log'"
$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -Command `"$command`""
$trigger = New-ScheduledTaskTrigger -Daily -At $At
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 30) -AllowStartIfOnBatteries
if ($WhatIf) {
    Write-Output "Task '$TaskName' daily at $At, as $env:USERNAME"
    Write-Output "powershell.exe $($action.Arguments)"
    return
}
New-Item -ItemType Directory -Force -Path $Destination | Out-Null
Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings `
    -Description 'Kavita: consistent backup of the database, covers and settings (deployment/offline/backup-config.ps1).' -Force | Out-Null
Write-Output "Registered '$TaskName': daily at $At, log in $log. Run it now with: Start-ScheduledTask -TaskName '$TaskName'"
