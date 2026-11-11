# turn-timing

[中文](README.zh-CN.md) · [日本語](README.ja-JP.md)

`turn-timing` places one compact, configurable timing row at the end of the reply body after each completed reply. It appears only after a reply finishes; active cards stay clean.

## Effect

```text
Ran 7 commands, read 3 files · Worked 1m30s · Thought 12s · Responded 8s · Tools 1m10s & Tokens 13k · Input 12k · Cache 8k (67%) · Output 1k
```

Optional token metrics follow on the same line when the engine reports usage. The suffix uses caption-sized dim text and truncates on narrow layouts. It is display-only: it does not enter the transcript file or the model's context.

## Installation

Requires Claude Code 2.1.275+ for one-step marketplace install. The hooks API targets Claude Desktop Code tab's bundled Claude Code 2.1.321.

```bash
/plugin marketplace add ideshun/claude-code-mods
/plugin install turn-timing@claude-code-mods
```

Select the user scope, then set options in the Plugins settings. New sessions load the plugin from the user scope automatically. The Desktop Code tab can use user-scope plugins but does not offer `/plugin install` itself.

For development:

```bash
claude --plugin-dir /path/to/claude-code-mods/plugins/turn-timing
```

## Configuration

| Option | Values | Default | Meaning |
| --- | --- | --- | --- |
| `language` | `Auto`, `中文`, `English`, `日本語`, `Custom` | `English` | Native-name language picker; `Auto` follows explicit Chinese/Japanese locale variables |
| `showTokens` | boolean | `true` | Show total, input, cache-hit and output tokens under the timing line |
| `prefix` | string | empty | Optional text/emoji before the timing line |
| `totalLabel` | string | empty | Custom total-time label |
| `thinkingLabel` | string | empty | Custom thinking-time label |
| `respondingLabel` | string | empty | Custom response-time label |
| `toolsLabel` | string | empty | Custom tool-time label |

All four custom labels must be non-empty for `Custom` to take effect. Legacy values `auto`, `zh-CN`, `en`, `ja-JP`, `custom` remain accepted for existing settings.

Example `~/.claude/settings.json`:

```json
{
  "pluginConfigs": {
    "turn-timing@claude-code-mods": {
      "options": {
        "language": "English",
        "showTokens": true,
        "prefix": "⏱",
        "totalLabel": "Total",
        "thinkingLabel": "Think",
        "respondingLabel": "Reply",
        "toolsLabel": "Tools"
      }
    }
  }
}
```

## What is measured

| Field | Source |
| --- | --- |
| Total | Engine-provided `turn.complete.durationMs` wall-clock duration |
| Thinking | Streamed `thinking` chunk time |
| Responding | Streamed text and tool-call chunk time |
| Tools | Main-loop tool-call execution time |
| Tokens | `turn.complete.usage` total = uncached input + cache write + cache read + output |
| Cache hit | `cache_read_input_tokens / (input_tokens + cache_creation_input_tokens + cache_read_input_tokens)` |

Each completed reply places one timing line at the end of the reply body with its own value; earlier rows keep their own values. Token usage is the turn total reported by the engine; when no usage exists, token metrics are omitted. Subagent turns are ignored. The three estimates are normalized so they never exceed the authoritative total.

## Verification

```bash
claude plugin validate plugins/turn-timing
claude plugin test plugins/turn-timing
```

Tests cover one row per reply, independent values, native language names, `Auto`, custom labels, hidden in-progress state, subagents and interruptions.

## Limitations

- Only completed replies receive one timing line at the end of the reply body.
- Thinking/responding/tool splits are client-side estimates; total is authoritative.
- The terminal renderer ignores `size="caption"`; Claude Desktop uses caption-sized text.
- A paused or sleeping computer is measured as elapsed wall-clock time.
- Timing is kept in session state; it is not a permanent conversation history.

## License

MIT. See [LICENSE](LICENSE).
