$ErrorActionPreference = 'Stop'
# Retention of the automatic backups, without Docker. Run from the repository root.
. ./deployment/offline/backup/retention.ps1
$failures = @()
function Check([bool]$condition, [string]$name) {
    if ($condition) { Write-Output "PASS $name" } else { Write-Output "FAIL $name"; $script:failures += $name }
}
$name = { param([datetime]$t) 'kavita-config-' + $t.ToString('yyyyMMdd-HHmmss') + '.tar.gz' }

# 40 days, two backups a day (03:00 and 15:00), from 2026-09-10 to 2026-10-19
$start = [datetime]'2026-09-10'
$all = foreach ($d in 0..39) { foreach ($h in 3, 15) { & $name $start.AddDays($d).AddHours($h) } }
$remove = @(Get-BackupsToRemove -Names $all)
$kept = @($all | Where-Object { $remove -notcontains $_ })

Check ($kept.Count -eq 11) "keeps 7 daily and 4 weekly ($($kept.Count))"
Check ($kept -contains (& $name ([datetime]'2026-10-19 15:00'))) 'keeps the newest backup'
Check ($kept -notcontains (& $name ([datetime]'2026-10-19 03:00'))) 'keeps one per day'
$days = @($kept | ForEach-Object { $_.Substring(14, 8) } | Sort-Object -Unique -Descending)
Check (($days | Select-Object -First 7) -join ',' -eq '20261019,20261018,20261017,20261016,20261015,20261014,20261013') 'the last 7 days'
Check ($kept -notcontains (& $name ([datetime]'2026-09-10 15:00'))) 'drops what is older than the weeks kept'

# Fewer backups than the limits: nothing removed; other files ignored
Check (@(Get-BackupsToRemove -Names @((& $name ([datetime]'2026-10-19 03:00')), 'notes.txt')).Count -eq 0) 'keeps everything when there is little'
Check (@(Get-BackupsToRemove -Names @()).Count -eq 0) 'empty folder'

if ($failures) { throw "$($failures.Count) failed: $($failures -join '; ')" }
Write-Output 'All retention tests passed.'
