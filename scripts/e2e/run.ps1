param(
    # Server image; the web under test comes from -Web, so a web change needs no new image
    [Parameter(Mandatory = $true)][string]$Image,
    # Production web build (ng build), mounted read-only over the image's wwwroot
    [string]$Web = 'UI/Web/dist/browser',
    [int]$Port = 5066,
    [int]$DebugPort = 9333,
    [string]$Chrome = 'C:\Program Files\Google\Chrome\Application\chrome.exe',
    # Keeps the server and the browser profile for a look after a failure
    [switch]$Keep,
    # L2.2: also validate publisher CSS clipping with the real engine
    [switch]$MeasureEpubClipping,
    # Focused RED/GREEN for appearance preservation; the ordinary runner still runs all reader scenarios
    [switch]$EpubReflowOnly,
    # Focused RED/GREEN for selection, highlights and navigation with the book on (L4)
    [switch]$EpubL4Only
)
$ErrorActionPreference = 'Stop'
# Fork (item 7.1): reader end-to-end test. A disposable Kavita on 127.0.0.1 with a synthetic library mounted read-only
# (make_fixtures.py), a test account, and Chrome driven over CDP by reader.e2e.mjs. The main server, its volumes and
# the real library are never used. Run from the repository root, without redirecting stderr.

$project = 'kavita-e2e'
$root = (New-Item -ItemType Directory -Force -Path '_temp/e2e').FullName
$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$expectedRoot = [IO.Path]::GetFullPath((Join-Path $repositoryRoot '_temp/e2e'))
if ($root -ne $expectedRoot -or ((Get-Item -LiteralPath $root).Attributes -band [IO.FileAttributes]::ReparsePoint)) {
    throw 'The disposable test directory must be inside this repository, without a junction.'
}
$library = Join-Path $root 'library'
$envFile = Join-Path $root '.env'
$override = Join-Path $root 'override.yaml'
$compose = @('compose', '-p', $project, '--env-file', $envFile, '-f', 'deployment/offline/compose.yaml', '-f', $override)
if (-not (Test-Path (Join-Path $Web 'index.html'))) { throw "No web build in $Web (run ng build --configuration production)." }
$webPath = (Resolve-Path $Web).Path -replace '\\', '/'

function Cleanup {
    $ErrorActionPreference = 'Continue'
    if ($script:browser -and -not $script:browser.HasExited) { Stop-Process -Id $script:browser.Id -Force }
    docker @compose down --volumes --remove-orphans 2>&1 | Out-Null
    Remove-Item -Recurse -Force $root -ErrorAction SilentlyContinue
}

# A run kept with -Keep, or an interrupted one
$ErrorActionPreference = 'Continue'
docker @compose down --volumes --remove-orphans 2>&1 | Out-Null
$ErrorActionPreference = 'Stop'
if (Test-Path $library) { Remove-Item -Recurse -Force $library }
# A fresh browser profile: a kept one serves the previous web from its cache
if (Test-Path (Join-Path $root 'chrome')) { Remove-Item -Recurse -Force (Join-Path $root 'chrome') }
$fixtureArgs = @($library)
if ($MeasureEpubClipping) { $fixtureArgs += '--publisher-css' }
python -I scripts/e2e/make_fixtures.py @fixtureArgs | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Fixtures failed.' }
@(
    "KAVITA_LIBRARY_PATH=$($library -replace '\\', '/')"
    'KAVITA_BIND_ADDRESS=127.0.0.1'
    "KAVITA_PORT=$Port"
    "KAVITA_IMAGE=$Image"
) | Set-Content -Encoding ASCII $envFile
@(
    'services:'
    '  kavita:'
    '    volumes:'
    '      - type: bind'
    "        source: $webPath"
    '        target: /kavita/wwwroot'
    '        read_only: true'
) | Set-Content -Encoding ASCII $override

$failed = $true
try {
    $ErrorActionPreference = 'Continue'
    docker @compose up -d --wait --wait-timeout 240 2>&1 | Out-Null
    $ErrorActionPreference = 'Stop'
    if ($LASTEXITCODE -ne 0) { throw 'The disposable server did not start.' }

    $profile = Join-Path $root 'chrome'
    $script:browser = Start-Process $Chrome -WindowStyle Hidden -PassThru -ArgumentList @(
        # Not headless: the PDF reader's viewer does not load in headless Chrome. Off screen instead
        '--window-position=-32000,-32000', "--remote-debugging-port=$DebugPort", '--remote-allow-origins=*', "--user-data-dir=$profile",
        '--window-size=1600,1000', '--no-first-run', '--no-default-browser-check', 'about:blank')

    $readerArgs = @("http://127.0.0.1:$Port", $DebugPort)
    if ($MeasureEpubClipping) { $readerArgs += '--epub-clipping' }
    if ($EpubReflowOnly) { $readerArgs += '--epub-reflow-only' }
    if ($EpubL4Only) { $readerArgs += '--epub-l4-only' }
    npm exec --yes --package=node@24.15.0 -- node scripts/e2e/reader.e2e.mjs @readerArgs
    $failed = $LASTEXITCODE -ne 0
} finally {
    if ($Keep -and $failed) {
        Write-Host "Kept for a look: http://127.0.0.1:$Port (project $project). Remove with: docker compose -p $project down --volumes"
    } else {
        Cleanup
    }
}
if ($failed) { throw 'Reader end-to-end test failed.' }
