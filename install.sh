#!/usr/bin/env bash
# team-builder skills installer (macOS / Linux)
# Copies the skill directories in this repo into the Claude, Codex and/or
# OpenCode global skills directory.
#
# Usage:
#   ./install.sh                 # claude (default)  -> ~/.claude/skills
#   ./install.sh codex           # codex             -> ~/.codex/skills
#   ./install.sh opencode        # opencode          -> ~/.config/opencode/skills
#   ./install.sh both            # claude + codex
#   ./install.sh all             # claude + codex + opencode
#   CLAUDE_SKILLS_DIR=/path ./install.sh   # custom claude target
#
# Windows users: run install.ps1 from PowerShell instead.
set -euo pipefail

SRC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET="${1:-claude}"

# Rewrite the skill's OWN install path so its internal references resolve under
# the target ecosystem's skills dir (e.g. ~/.claude/skills/team-builder-shared ->
# ~/.codex/skills/team-builder-shared). Only the team-builder/architecture-advisor
# self-references are touched; generic project paths like .claude/agents are left
# alone. Perl behaves identically on GNU and BSD/macOS (sed -i is not portable).
rewrite_self_paths() {
  local dir="$1" prefix="$2"
  find "$dir" -name '*.md' -type f -print0 | while IFS= read -r -d '' f; do
    PREFIX="$prefix" perl -0777 -pi \
      -e 's{(/)\.claude/skills/(team-builder|architecture-advisor)}{${1}$ENV{PREFIX}/$2}g' "$f"
  done
}

copy_skills() {
  # $1: destination skills dir ; $2: path prefix for self-reference rewrite (empty = none)
  local dest="$1" prefix="${2:-}"
  mkdir -p "$dest"
  shopt -s nullglob
  for src in "$SRC_DIR"/*/; do
    local name; name="$(basename "$src")"
    # Only directories that are skills (have SKILL.md) or the shared bundle.
    if [ -f "$src/SKILL.md" ] || [ "$name" = "team-builder-shared" ]; then
      echo "  -> $name  ($dest/$name)"
      rm -rf "${dest:?}/$name"
      cp -R "$src" "$dest/$name"
      if [ -n "$prefix" ]; then
        rewrite_self_paths "$dest/$name" "$prefix"
      fi
    fi
  done
}

install_claude()   { echo "Installing for Claude...";   copy_skills "${CLAUDE_SKILLS_DIR:-$HOME/.claude/skills}"; }
install_codex()    { echo "Installing for Codex...";    copy_skills "$HOME/.codex/skills" ".codex/skills"; }
install_opencode() { echo "Installing for OpenCode..."; copy_skills "$HOME/.config/opencode/skills" ".config/opencode/skills"; }

case "$TARGET" in
  claude)   install_claude ;;
  codex)    install_codex ;;
  opencode) install_opencode ;;
  both)     install_claude; install_codex ;;
  all)      install_claude; install_codex; install_opencode ;;
  *)
    echo "Unknown target: $TARGET  (expected: claude | codex | opencode | both | all)" >&2
    exit 1
    ;;
esac

echo "Done ($TARGET). Open Claude Code and run /team-builder-setup to begin."
