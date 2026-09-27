#!/usr/bin/env bash
# team-builder skills installer (macOS / Linux)
# Copies the skill directories under skills/ into the Claude, Codex and/or
# OpenCode global skills directory. (Claude Code and Codex can also install the
# repo as a plugin — see the README.)
#
# There is no default target — pick one explicitly, or run with no argument to
# be prompted.
#
# Usage:
#   ./install.sh                 # interactive picker
#   ./install.sh claude          # claude            -> ~/.claude/skills
#   ./install.sh codex           # codex             -> ~/.codex/skills
#   ./install.sh opencode        # opencode          -> ~/.config/opencode/skills
#   ./install.sh both            # claude + codex
#   ./install.sh all             # claude + codex + opencode
#   CLAUDE_SKILLS_DIR=/path ./install.sh claude   # custom claude target
#
# Windows users: run install.ps1 from PowerShell instead.
set -euo pipefail

SRC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# No argument → ask. Non-interactive (piped/CI) runs must name a target so the
# install never silently picks an ecosystem for the user.
choose_target() {
  if [ ! -t 0 ]; then
    echo "No target given. Pass one of: claude | codex | opencode | both | all" >&2
    exit 1
  fi
  echo "Which tool should team-builder be installed for?" >&2
  echo "  1) claude    -> ~/.claude/skills" >&2
  echo "  2) codex     -> ~/.codex/skills" >&2
  echo "  3) opencode  -> ~/.config/opencode/skills" >&2
  echo "  4) both      -> claude + codex" >&2
  echo "  5) all       -> claude + codex + opencode" >&2
  local reply
  read -r -p "Choice [1-5]: " reply
  case "$reply" in
    1|claude)   echo claude ;;
    2|codex)    echo codex ;;
    3|opencode) echo opencode ;;
    4|both)     echo both ;;
    5|all)      echo all ;;
    *) echo "Invalid choice: $reply" >&2; exit 1 ;;
  esac
}

TARGET="${1:-}"
[ -n "$TARGET" ] || TARGET="$(choose_target)"

# The skills name their bundled files relative to themselves:
# ${CLAUDE_SKILL_DIR}/../team-builder-shared/... The Claude Code plugin resolves
# that on its own; a copy knows where it landed, so the absolute path is written
# in instead — the same form for every tool, a custom CLAUDE_SKILLS_DIR included.
# Perl behaves identically on GNU and BSD/macOS (sed -i is not portable).
rewrite_skill_dir() {
  local dir="$1" dest="$2"
  find "$dir" -name '*.md' -type f -print0 | while IFS= read -r -d '' f; do
    DEST="$dest" perl -0777 -pi -e 's{\$\{CLAUDE_SKILL_DIR\}/\.\./}{$ENV{DEST}/}g' "$f"
  done
}

copy_skills() {
  # $1: destination skills dir
  mkdir -p "$1"
  local dest; dest="$(cd "$1" && pwd)"
  # The skills' commands carry this path inside double quotes, where these are
  # special: refuse rather than write a command that expands or breaks.
  case "$dest" in
    *'$'* | *'`'* | *'"'* | *'\'*)
      echo "Refusing to install into $dest: the path contains \$, \`, \" or \\, which the skills' commands cannot quote. Choose another directory." >&2
      exit 1 ;;
  esac
  shopt -s nullglob
  for src in "$SRC_DIR"/skills/*/; do
    local name; name="$(basename "$src")"
    # Only directories that are skills (have SKILL.md) or the shared bundle.
    if [ -f "$src/SKILL.md" ] || [ "$name" = "team-builder-shared" ]; then
      echo "  -> $name  ($dest/$name)"
      rm -rf "${dest:?}/$name"
      cp -R "$src" "$dest/$name"
      rewrite_skill_dir "$dest/$name" "$dest"
    fi
  done
}

install_claude()   { echo "Installing for Claude...";   copy_skills "${CLAUDE_SKILLS_DIR:-$HOME/.claude/skills}"; }
install_codex()    { echo "Installing for Codex...";    copy_skills "$HOME/.codex/skills"; }
install_opencode() { echo "Installing for OpenCode..."; copy_skills "$HOME/.config/opencode/skills"; }

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

case "$TARGET" in
  claude)   OPEN_IN="Claude Code" ;;
  codex)    OPEN_IN="Codex" ;;
  opencode) OPEN_IN="OpenCode" ;;
  *)        OPEN_IN="any of the installed tools" ;;
esac

echo "Done ($TARGET). Open $OPEN_IN and run /team-builder-setup to begin."
