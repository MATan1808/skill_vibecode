#!/usr/bin/env pwsh
# Cài AIaC cho Windows/Linux/macOS PowerShell. Không yêu cầu symlink/admin.

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$ScriptDir = Split-Path -Parent $PSCommandPath
$EnvRoot = $env:AIAC_ENV_ROOT
if (-not $EnvRoot -and (Test-Path -LiteralPath '/Volumes/DATA/ENV')) { $EnvRoot = '/Volumes/DATA/ENV' }
if (-not $EnvRoot) { $EnvRoot = if ($env:USERPROFILE) { $env:USERPROFILE } else { $HOME } }

$ClaudeDir = Join-Path $EnvRoot '.claude'
$CodexDir = Join-Path $EnvRoot '.codex'
$GeminiDir = Join-Path $EnvRoot '.gemini'
$AntigravityDir = Join-Path $EnvRoot '.antigravity-ide'
$Plugins = @(
  '360-odoo','360-desktop-app','360-agent-browser','360-vuaoffice','360-vuaassistant','360-hermes',
  '360-openclaw','360-flutter','360-wordpress','360-dev-workflow','360-payload-website','360-marketing',
  '360-designer','360-ponytail','360-caveman','360-superpowers','360-agent-map','360-codegraph',
  '360-airouter','360-gitsync','360-update-skill-resource','360-securities','360-rancher','360-token-killer'
)

function Log($Message) { Write-Host "[AIaC] $Message" }
function Warn($Message) { Write-Warning "[AIaC] $Message" }
function New-Dir($Path) { New-Item -ItemType Directory -Force -Path $Path | Out-Null }
function Copy-Tree($Source, $Destination) {
  if (Test-Path -LiteralPath $Destination) { Remove-Item -LiteralPath $Destination -Recurse -Force }
  Copy-Item -LiteralPath $Source -Destination $Destination -Recurse -Force
}
function Register-Skill($Source, $Destination) {
  if (Test-Path -LiteralPath $Destination) {
    $item = Get-Item -LiteralPath $Destination -Force
    if ($item.LinkType -or $item.Name.StartsWith('360-')) { Remove-Item -LiteralPath $Destination -Recurse -Force }
    else { Warn "Giữ nguyên skill đã có '$($item.Name)'; AIaC không ghi đè nội dung không sở hữu."; return }
  }
  Copy-Tree $Source $Destination
}
function Register-Editor($Name, $SkillsDir) {
  Log "Phát hiện $Name ➜ đăng ký plugins vào $SkillsDir"
  New-Dir $SkillsDir
  foreach ($plugin in $Plugins) {
    $source = Join-Path $ClaudeDir "360org/plugins/$plugin"
    if (Test-Path -LiteralPath $source) { Register-Skill $source (Join-Path $SkillsDir $plugin) }
  }
}
function Copy-Instructions($Target) {
  $source = Join-Path $ScriptDir 'CLAUDE.md'
  if (-not (Test-Path -LiteralPath $source)) { return }
  if (Test-Path -LiteralPath $Target) {
    $backup = "$Target.bak-aiac-$(Get-Date -Format yyyyMMddHHmmss)"
    Move-Item -LiteralPath $Target -Destination $backup -Force
    Warn "Đã backup $(Split-Path -Leaf $Target) trước AIaC tại $backup"
  }
  Copy-Item -LiteralPath $source -Destination $Target -Force
}

Log 'Bắt đầu cài đặt AIaC theo mô hình copy an toàn cross-platform...'
New-Dir $ClaudeDir
Copy-Tree (Join-Path $ScriptDir '360org') (Join-Path $ClaudeDir '360org')
@{ repoRoot = $ScriptDir } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $ClaudeDir '360org/aiac-runtime.json') -Encoding utf8

$found = $false
if (Test-Path -LiteralPath $ClaudeDir) { Register-Editor 'Claude Code' (Join-Path $ClaudeDir 'skills'); $found = $true }
if (Test-Path -LiteralPath $CodexDir) { Register-Editor 'Codex' (Join-Path $CodexDir 'skills'); $found = $true }
if ((Test-Path -LiteralPath $GeminiDir) -or (Test-Path -LiteralPath $AntigravityDir)) { Register-Editor 'Gemini/Antigravity' (Join-Path $GeminiDir 'config/skills'); $found = $true }
if (-not $found) { Warn 'Không phát hiện editor AI nào; đã đồng bộ runtime AIaC, bỏ qua đăng ký plugins.' }

if (Test-Path -LiteralPath $ClaudeDir) { Copy-Instructions (Join-Path $ClaudeDir 'CLAUDE.md') }
if (Test-Path -LiteralPath $CodexDir) { Copy-Instructions (Join-Path $CodexDir 'AGENTS.md') }
if (Test-Path -LiteralPath $GeminiDir) { Copy-Instructions (Join-Path $GeminiDir 'AGENTS.md') }

$mergeScript = Join-Path $ScriptDir 'scripts/aiac/merge-claude-settings.js'
if ((Test-Path -LiteralPath $ClaudeDir) -and (Get-Command node -ErrorAction SilentlyContinue) -and (Test-Path -LiteralPath $mergeScript)) {
  Log 'Merge cấu hình Claude Code hiện có với AIaC overlay...'
  & node $mergeScript --target (Join-Path $ClaudeDir 'settings.json')
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  $settings = Get-Content -LiteralPath (Join-Path $ClaudeDir 'settings.json') -Raw | ConvertFrom-Json
  $missing = @('SessionStart','PreToolUse','PostToolUse','PreCompact','Stop') | Where-Object { -not $settings.hooks.PSObject.Properties.Name.Contains($_) }
  if ($missing.Count) { throw "Thiếu hook sau merge: $($missing -join ', ')" }
}

Log 'Cài đặt hoàn tất. Windows/Linux/macOS dùng được qua PowerShell; không cần quyền tạo symlink.'
