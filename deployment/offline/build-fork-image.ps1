param(
    # Image name; the tag comes from the fork's git describe (for example fork-v1.1 or fork-v1.1-3-gabc1234)
    [string]$Repository = 'kavita-fork',
    # Where the backend is published and the web build copied; reused between builds of the same commit
    [string]$OutputRoot = '_temp/offline-f1/build'
)
# Native tools (npm, ng, docker) write progress and warnings to stderr; each one is checked by its exit code instead,
# so a redirected run does not stop on a warning
$ErrorActionPreference = 'Continue'
# Builds the server image from a clean checkout of the fork, so a running image can always be traced to a commit.
# Run from the repository root. Needs Docker Desktop and the Node used by the web build.

if (git status --porcelain) { throw 'The working tree has changes: commit them first, so the image matches a commit.' }
$revision = (git rev-parse HEAD).Trim()
$version = (git describe --tags --match 'fork-*' --always).Trim()
$tag = "${Repository}:$version"
$out = Join-Path $OutputRoot $version
$server = Join-Path $out 'server'

if (-not (Test-Path (Join-Path $server 'Kavita.Server'))) {
    New-Item -ItemType Directory -Force -Path $out | Out-Null
    $sdk = 'mcr.microsoft.com/dotnet/sdk:10.0@sha256:0d99ebf1ccad15037b5c98c9fe8979d6b8dbac23812feae2277a0b277b5c5ffa'
    $target = "/work/$($server -replace '\\', '/')"
    docker run --rm --cpus 4 -v "${PWD}:/work" -w /work -v kavita-dotnet-nuget:/root/.nuget/packages $sdk `
        dotnet publish Kavita.Server/Kavita.Server.csproj -c Release -r linux-x64 --self-contained true -p:RunAnalyzers=false -o $target
    if ($LASTEXITCODE -ne 0) { throw 'Backend publish failed.' }
}

Push-Location UI/Web
try {
    npm exec --yes --package=node@24.15.0 -- node hash-localization.js
    if ($LASTEXITCODE -ne 0) { throw 'Localization hashing failed.' }
    npm exec --yes --package=node@24.15.0 -- node node_modules/@angular/cli/bin/ng.js build --configuration production
    if ($LASTEXITCODE -ne 0) { throw 'Web build failed.' }
} finally {
    Pop-Location
}
$wwwroot = Join-Path $server 'wwwroot'
if (Test-Path $wwwroot) { Remove-Item -Recurse -Force $wwwroot -ErrorAction Stop }
Copy-Item -Recurse UI/Web/dist/browser $wwwroot -ErrorAction Stop

docker build --file deployment/offline/Dockerfile.fork --build-arg "FORK_REVISION=$revision" --build-arg "FORK_VERSION=$version" --tag $tag $server
if ($LASTEXITCODE -ne 0) { throw 'Image build failed.' }
Write-Output "Built $tag from $revision"
