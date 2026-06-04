$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $repoRoot

$toolsRoot = "C:\Users\feodo\Documents\Codex\tools"
$gitPath = Join-Path $toolsRoot "git\cmd"
$nodePath = Join-Path $toolsRoot "node"

if (Test-Path $gitPath) {
  $env:Path = "$gitPath;$env:Path"
}

if (Test-Path $nodePath) {
  $env:Path = "$nodePath;$env:Path"
}

if (-not $env:SCAN_MODE) {
  $env:SCAN_MODE = "test"
}

if (-not $env:COLLECT_GENERATE_REPORT) {
  $env:COLLECT_GENERATE_REPORT = "1"
}

if (-not $env:COLLECT_RUNS) {
  $env:COLLECT_RUNS = "12"
}

if (-not $env:COLLECT_INTERVAL_MINUTES) {
  $env:COLLECT_INTERVAL_MINUTES = "5"
}

Write-Host "Repo: $repoRoot"
Write-Host "SCAN_MODE=$env:SCAN_MODE"
Write-Host "COLLECT_GENERATE_REPORT=$env:COLLECT_GENERATE_REPORT"
Write-Host "COLLECT_RUNS=$env:COLLECT_RUNS"
Write-Host "COLLECT_INTERVAL_MINUTES=$env:COLLECT_INTERVAL_MINUTES"
Write-Host ""

npm.cmd run collect:loop
