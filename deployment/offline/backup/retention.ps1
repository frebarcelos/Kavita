# Which backups to remove: keep the newest backup of each of the last $KeepDaily days that have one, and the newest
# of each of the $KeepWeekly weeks before those. Names: kavita-config-yyyyMMdd-HHmmss.tar.gz; other names are ignored.
function Get-BackupsToRemove {
    param([string[]]$Names, [int]$KeepDaily = 7, [int]$KeepWeekly = 4)
    $backups = foreach ($name in $Names) {
        $match = [regex]::Match($name, '^kavita-config-(\d{8}-\d{6})\.tar\.gz$')
        if ($match.Success) {
            $taken = [datetime]::ParseExact($match.Groups[1].Value, 'yyyyMMdd-HHmmss', [Globalization.CultureInfo]::InvariantCulture)
            # Weeks start on Monday
            $week = $taken.Date.AddDays(-(([int]$taken.DayOfWeek + 6) % 7))
            # Sortable keys: grouping turns dates into culture-formatted text
            [pscustomobject]@{Name = $name; Taken = $taken; Day = $taken.ToString('yyyyMMdd'); Week = $week.ToString('yyyyMMdd')}
        }
    }
    if (-not $backups) { return @() }

    $byDay = @($backups | Group-Object Day | Sort-Object Name -Descending)
    $keep = @($byDay | Select-Object -First $KeepDaily | ForEach-Object { ($_.Group | Sort-Object Taken -Descending)[0].Name })
    $olderDays = @($byDay | Select-Object -Skip $KeepDaily | ForEach-Object { $_.Group })
    if ($olderDays) {
        $keep += @($olderDays | Group-Object Week | Sort-Object Name -Descending | Select-Object -First $KeepWeekly |
            ForEach-Object { ($_.Group | Sort-Object Taken -Descending)[0].Name })
    }
    return @($backups | Where-Object { $keep -notcontains $_.Name } | ForEach-Object { $_.Name })
}
