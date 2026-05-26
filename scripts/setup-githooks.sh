#!/bin/sh
set -eu

root=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
cd "$root"

chmod +x .githooks/prepare-commit-msg .githooks/commit-msg .githooks/strip-ai-trailers.sh
git config core.hooksPath .githooks

echo "OK: git hooks enabled (.githooks — strips Cursor/Copilot co-author trailers)"
