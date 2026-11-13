#!/bin/sh
set -eu

repo_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
plugin_dir="$repo_dir/plugins/turn-timing"
claude_bin=${CLAUDE_BIN:-claude}

"$claude_bin" --version
"$claude_bin" plugin validate "$plugin_dir"
"$claude_bin" plugin test "$plugin_dir"
"${TSC_BIN:-tsc}" --project "$plugin_dir/tsconfig.json"

# Optional: verify the code that is actually installed, without changing it.
if [ "$#" -gt 0 ]; then
  for file in .claude-plugin/plugin.json hooks/hooks.json hooks/register.tsx hooks/history.ts types/index.d.ts; do
    diff -u "$plugin_dir/$file" "$1/$file"
    shasum -a 256 "$1/$file"
  done
fi
