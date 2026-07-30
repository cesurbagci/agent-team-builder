<#
.SYNOPSIS
  team-builder skills installer (Windows / PowerShell).
.DESCRIPTION
  Copies the skill directories in this repo into the Claude, Codex and/or
  OpenCode global skills directory.
.PARAMETER Target
  claude | codex | opencode | both | all
  There is no default — omit it to be prompted.
.EXAMPLE
  .\install.ps1             # interactive picker
  .\install.ps1 claude
  .\install.ps1 codex
  .\install.ps1 opencode
  .\install.ps1 both        # claude + codex
  .\install.ps1 all         # claude + codex + opencode
  $env:CLAUDE_SKILLS_DIR = "D:\skills"; .\install.ps1 claude
.NOTES
  macOS / Linux users: run ./install.sh instead.
  If you get an execution-policy error, run:
    powershell -ExecutionPolicy Bypass -File .\install.ps1
#>
param(
  [ValidateSet('claude', 'codex', 'opencode', 'both', 'all')]
  [string]$Target
)

$ErrorActionPreference = 'Stop'
$SrcDir = $PSScriptRoot

# No target given → ask, so the install never silently picks an ecosystem.
if (-not $Target) {
  Write-Host 'Which tool should team-builder be installed for?'
  Write-Host '  1) claude    -> ~\.claude\skills'
  Write-Host '  2) codex     -> ~\.codex\skills'
  Write-Host '  3) opencode  -> ~\.config\opencode\skills'
  Write-Host '  4) both      -> claude + codex'
  Write-Host '  5) all       -> claude + codex + opencode'
  $reply = Read-Host 'Choice [1-5]'
  $Target = switch ($reply) {
    { $_ -in '1', 'claude' }   { 'claude' }
    { $_ -in '2', 'codex' }    { 'codex' }
    { $_ -in '3', 'opencode' } { 'opencode' }
    { $_ -in '4', 'both' }     { 'both' }
    { $_ -in '5', 'all' }      { 'all' }
    default { throw "Invalid choice: $reply" }
  }
}

# Rewrite the skill's OWN install path so its internal references resolve under
# the target ecosystem's skills dir. Only team-builder/architecture-advisor
# self-references are touched; generic project paths are left alone.
function Rewrite-SelfPaths {
  param([string]$Dir, [string]$Prefix)
  Get-ChildItem -Path $Dir -Filter '*.md' -Recurse -File | ForEach-Object {
    $content = Get-Content -Raw -LiteralPath $_.FullName
    $updated = [regex]::Replace(
      $content,
      '(/)\.claude/skills/(team-builder|architecture-advisor)',
      ('$1' + $Prefix + '/$2')
    )
    if ($updated -ne $content) {
      Set-Content -LiteralPath $_.FullName -Value $updated -NoNewline
    }
  }
}

function Copy-Skills {
  param([string]$Dest, [string]$Prefix = '')
  New-Item -ItemType Directory -Force -Path $Dest | Out-Null
  Get-ChildItem -Path $SrcDir -Directory | ForEach-Object {
    $name = $_.Name
    $hasSkill = Test-Path -LiteralPath (Join-Path $_.FullName 'SKILL.md')
    if ($hasSkill -or $name -eq 'team-builder-shared') {
      $targetPath = Join-Path $Dest $name
      Write-Host "  -> $name  ($targetPath)"
      if (Test-Path -LiteralPath $targetPath) { Remove-Item -Recurse -Force -LiteralPath $targetPath }
      Copy-Item -Recurse -LiteralPath $_.FullName -Destination $targetPath
      if ($Prefix) { Rewrite-SelfPaths -Dir $targetPath -Prefix $Prefix }
    }
  }
}

$claudeDir   = if ($env:CLAUDE_SKILLS_DIR) { $env:CLAUDE_SKILLS_DIR } else { Join-Path $HOME '.claude\skills' }
$codexDir    = Join-Path $HOME '.codex\skills'
$opencodeDir = Join-Path $HOME '.config\opencode\skills'

function Install-Claude   { Write-Host 'Installing for Claude...';   Copy-Skills -Dest $claudeDir }
function Install-Codex    { Write-Host 'Installing for Codex...';    Copy-Skills -Dest $codexDir -Prefix '.codex/skills' }
function Install-OpenCode { Write-Host 'Installing for OpenCode...'; Copy-Skills -Dest $opencodeDir -Prefix '.config/opencode/skills' }

switch ($Target) {
  'claude'   { Install-Claude }
  'codex'    { Install-Codex }
  'opencode' { Install-OpenCode }
  'both'     { Install-Claude; Install-Codex }
  'all'      { Install-Claude; Install-Codex; Install-OpenCode }
}

$openIn = switch ($Target) {
  'claude'   { 'Claude Code' }
  'codex'    { 'Codex' }
  'opencode' { 'OpenCode' }
  default    { 'any of the installed tools' }
}

Write-Host "Done ($Target). Open $openIn and run /team-builder-setup to begin."
