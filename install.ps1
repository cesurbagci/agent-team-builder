<#
.SYNOPSIS
  team-builder skills installer (Windows / PowerShell).
.DESCRIPTION
  Copies the skill directories under skills\ into the Claude, Codex and/or
  OpenCode global skills directory. (Claude Code and Codex can also install the
  repo as a plugin — see the README.)
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

# The skills name their bundled files relative to themselves:
# ${CLAUDE_SKILL_DIR}/../team-builder-shared/... The Claude Code plugin resolves
# that on its own; a copy knows where it landed, so the absolute path is written
# in instead (forward slashes: node and the shells accept them on Windows).
# The files are UTF-8 without a BOM. Windows PowerShell 5.1 reads and writes
# the ANSI code page by default, which corrupts Turkish text and non-ASCII
# paths, so both directions name the encoding.
function Rewrite-SkillDir {
  param([string]$Dir, [string]$Dest)
  $absolute = ((Resolve-Path -LiteralPath $Dest).Path) -replace '\\', '/'
  # The skills' commands carry this path inside double quotes, where these are
  # special: refuse rather than write a command that expands or breaks.
  if ($absolute -match '[$`"]') {
    throw "Refusing to install into ${absolute}: the path contains `$, `` or `", which the skills' commands cannot quote. Choose another directory."
  }
  $utf8 = New-Object System.Text.UTF8Encoding($false)
  Get-ChildItem -Path $Dir -Filter '*.md' -Recurse -File | ForEach-Object {
    $content = [System.IO.File]::ReadAllText($_.FullName, $utf8)
    $updated = $content.Replace('${CLAUDE_SKILL_DIR}/../', $absolute + '/')
    if ($updated -ne $content) {
      [System.IO.File]::WriteAllText($_.FullName, $updated, $utf8)
    }
  }
}

function Copy-Skills {
  param([string]$Dest)
  New-Item -ItemType Directory -Force -Path $Dest | Out-Null
  Get-ChildItem -Path (Join-Path $SrcDir 'skills') -Directory | ForEach-Object {
    $name = $_.Name
    $hasSkill = Test-Path -LiteralPath (Join-Path $_.FullName 'SKILL.md')
    if ($hasSkill -or $name -eq 'team-builder-shared') {
      $targetPath = Join-Path $Dest $name
      Write-Host "  -> $name  ($targetPath)"
      if (Test-Path -LiteralPath $targetPath) { Remove-Item -Recurse -Force -LiteralPath $targetPath }
      Copy-Item -Recurse -LiteralPath $_.FullName -Destination $targetPath
      Rewrite-SkillDir -Dir $targetPath -Dest $Dest
    }
  }
}

$claudeDir   = if ($env:CLAUDE_SKILLS_DIR) { $env:CLAUDE_SKILLS_DIR } else { Join-Path $HOME '.claude\skills' }
$codexDir    = Join-Path $HOME '.codex\skills'
$opencodeDir = Join-Path $HOME '.config\opencode\skills'

function Install-Claude   { Write-Host 'Installing for Claude...';   Copy-Skills -Dest $claudeDir }
function Install-Codex    { Write-Host 'Installing for Codex...';    Copy-Skills -Dest $codexDir }
function Install-OpenCode { Write-Host 'Installing for OpenCode...'; Copy-Skills -Dest $opencodeDir }

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
