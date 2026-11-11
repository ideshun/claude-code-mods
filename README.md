# Claude Code Mods

[中文](README.zh-CN.md) · [日本語](README.ja-JP.md)

A categorized collection of Claude Code plugins, mods, and related tools by ideshun.

## Repository layout

```text
plugins/       Installable Claude Code plugins (each has .claude-plugin/plugin.json)
  turn-timing/ UI plugin: compact, configurable reply timing
mods/          Session-scoped function-hook experiments (future)
skills/        Standalone skills (future)
agents/        Standalone agent definitions (future)
docs/          Shared documentation and screenshots (future)
```

Each installable plugin lives in its own folder under `plugins/`. The root `.claude-plugin/marketplace.json` lists published plugins. New work should be added to its matching category rather than the repository root.

## Plugins

| Plugin | Category | What it does | Status |
| --- | --- | --- | --- |
| [turn-timing](plugins/turn-timing/README.en.md) | UI / timing | Adds compact, configurable per-reply timing to Claude Desktop's end of the reply body | v0.1.2 |

The plugin has [English](plugins/turn-timing/README.en.md), [中文](plugins/turn-timing/README.zh-CN.md) and [日本語](plugins/turn-timing/README.ja-JP.md) documentation.

## Install from this marketplace

In a Claude Code terminal session:

```bash
/plugin marketplace add ideshun/claude-code-mods
/plugin install turn-timing@claude-code-mods
```

Choose the user scope when prompted, then complete the plugin's configuration screen. The plugin is active in the current session; newly started sessions load it automatically from the user scope.

To update later:

```bash
/plugin marketplace update claude-code-mods
/plugin update turn-timing@claude-code-mods
```

Claude Desktop's Code tab does not offer `/plugin install`; configure installed plugins from a terminal Claude Code session, or see each plugin's README for `--plugin-dir` development instructions.

## Quick start

After installing, finish any reply. Its end of the reply body gets a compact suffix like:

```text
Ran 7 commands, read 3 files · Worked 1m30s · Thought 12s · Responded 8s · Tools 1m10s & Tokens 13k · Input 12k · Cache 8k (67%) · Output 1k
```

Token metrics are enabled by default (`showTokens`). The Plugins settings expose `Auto`, `中文`, `English`, `日本語` and `Custom`. The default is `English`; `Auto` follows an explicit Chinese or Japanese `LANG` / `LC_ALL` / `LC_MESSAGES`, and `Custom` uses the four label fields.

## Development

Use the Claude Code version that matches the target host. This repository currently targets the Claude Desktop Code tab's bundled Claude Code 2.1.321 function-hook API.

```bash
claude plugin validate plugins/turn-timing
claude plugin test plugins/turn-timing
```

## License

MIT. See each plugin folder for its license.
