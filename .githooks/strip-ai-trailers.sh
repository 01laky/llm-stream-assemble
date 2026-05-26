#!/bin/sh
# Remove AI editor/agent attribution lines from commit messages.
# Used by prepare-commit-msg and commit-msg hooks.

file=$1
[ -n "$file" ] && [ -f "$file" ] || exit 0

tmp=$(mktemp "${TMPDIR:-/tmp}/lsa-commit-msg.XXXXXX") || exit 0

sed -E \
	-e '/^Co-authored-by: Cursor /d' \
	-e '/^Co-authored-by:.*cursoragent@/Id' \
	-e '/^Co-authored-by:.*cursor\.com>/Id' \
	-e '/^Co-authored-by:.*[Cc]opilot/d' \
	-e '/^Signed-off-by: Cursor /d' \
	-e '/^Generated with Cursor/d' \
	-e '/^Made with AI/d' \
	"$file" >"$tmp" || exit 0

mv "$tmp" "$file"
exit 0
