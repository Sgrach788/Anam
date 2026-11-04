param(
  [string]$Bind = '0.0.0.0',
  [int]$Port = 8787,
  [switch]$Live,
  [switch]$Mock
)

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
if (-not $root) { $root = Split-Path -Parent $MyInvocation.MyCommand.Path }
Set-Location (Join-Path $root 'app')

# node 查找顺序：系统 PATH -> 项目自带 .runtime -> DSH 自带运行时
$node = $null
$cmd = Get-Command node -ErrorAction SilentlyContinue
if ($cmd) { $node = $cmd.Source }
if (-not $node) {
  $hit = Get-ChildItem (Join-Path $root '.runtime\node-*\node.exe') -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($hit) { $node = $hit.FullName }
}
if (-not $node) {
  $hit = Get-ChildItem (Join-Path $env:USERPROFILE '.dsh\dsh-runtimes\*\dependencies\node\bin\node.exe') -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($hit) { $node = $hit.FullName }
}
if (-not $node -or -not (Test-Path $node)) {
  Write-Host '[x] Node not found. Put portable Node under .runtime, or install Node LTS.'
  exit 1
}

# 有 key 就走真模型，没有就自动 mock；-Mock 可强制 mock
$hasKey = [bool]$env:DEEPSEEK_API_KEY
if (Test-Path 'data\secret.json') {
  & $node -e "process.exit(JSON.parse(require('fs').readFileSync('data/secret.json','utf8').replace(/^\uFEFF/,'')).apiKey?0:1)" 2>$null
  $hasKey = $hasKey -or ($LASTEXITCODE -eq 0)
}
$liveMode = $hasKey -and -not $Mock

$env:HOST = $Bind
$env:PORT = "$Port"
if ($Mock) {
  $env:MOCK_MODEL = '1'
} else {
  Remove-Item Env:MOCK_MODEL -ErrorAction SilentlyContinue
}

$mode = if ($liveMode) { 'LIVE' } else { 'MOCK' }
Write-Host "[i] node: $node"
Write-Host "[i] mode: $mode  bind: $Bind  port: $Port"
if (-not $hasKey) { Write-Host '[i] no API key in app\data\secret.json -> mock mode' }
Write-Host "[i] PC:    http://127.0.0.1:$Port"
$ips = @()
foreach ($line in (ipconfig 2>$null | Select-String -Pattern 'IPv4')) {
  $ip = ($line.Line -split ':')[-1].Trim()
  if ($ip) { $ips += $ip }
}
foreach ($ip in $ips) { Write-Host "[i] Phone: http://${ip}:$Port" }
Write-Host '[i] close this window to stop'
& $node server.mjs
