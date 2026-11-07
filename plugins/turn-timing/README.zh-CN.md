# turn-timing

`turn-timing` 在每次完成的回复后，于 transcript 末尾放置一条精简、可配置的耗时行。耗时只在回复结束后出现，工作中不显示。

## 效果

```text
Ran 7 commands, read 3 files · 工作 1m30s · 思考 12s · 回答 8s · 工具 1m10s
```

后缀使用最小号、弱化颜色并在窄布局中截断；仅用于显示，不进入 transcript 文件，也不进入模型上下文。

## 安装

一键 marketplace 安装需要 Claude Code 2.1.275+。函数钩子 API 针对 Claude Desktop Code 标签页内置的 Claude Code 2.1.317。

```bash
/plugin marketplace add ideshun/claude-code-mods
/plugin install turn-timing@claude-code-mods
```

选择 user scope，在 Plugins 设置中完成配置。新会话会自动从 user scope 加载。Desktop Code 标签页可以使用 user scope 插件，但界面本身不提供 `/plugin install`。

开发时：

```bash
claude --plugin-dir /path/to/claude-code-mods/plugins/turn-timing
```

## 配置

| 选项 | 可选值 | 默认值 | 含义 |
| --- | --- | --- | --- |
| `language` | `Auto`、`中文`、`English`、`日本語`、`Custom` | `English` | 以语言本名显示；`Auto` 跟随明确的中日文环境变量 |
| `prefix` | 字符串 | 空 | 耗时前可选的字符或 emoji |
| `totalLabel` | 字符串 | 空 | 总耗时自定义标签 |
| `thinkingLabel` | 字符串 | 空 | 思考耗时自定义标签 |
| `respondingLabel` | 字符串 | 空 | 回答耗时自定义标签 |
| `toolsLabel` | 字符串 | 空 | 工具耗时自定义标签 |

`Custom` 需要四个自定义标签均非空才生效。旧配置值 `auto`、`zh-CN`、`en`、`ja-JP`、`custom` 仍兼容。

示例 `~/.claude/settings.json`：

```json
{
  "pluginConfigs": {
    "turn-timing@claude-code-mods": {
      "options": {
        "language": "中文",
        "prefix": "⏱"
      }
    }
  }
}
```

## 统计口径

| 字段 | 来源 |
| --- | --- |
| 总耗时 | 引擎 `turn.complete.durationMs` 墙钟时间 |
| 思考 | 流式 `thinking` 片段时间 |
| 回答 | 流式文本与工具调用片段时间 |
| 工具 | 主循环工具调用执行时间 |

每次完成的回复只在 transcript 末尾放一条独立行，旧行保持各自数值；子 Agent 回合不统计。三个估算值会归一化，不会超过权威总耗时。

## 验证

```bash
claude plugin validate plugins/turn-timing
claude plugin test plugins/turn-timing
```

测试覆盖每次回复一条、数值独立、语言本名、`Auto`、自定义标签、工作中隐藏、子 Agent 与中断。

## 限制

- 每次完成的回复只显示一条 transcript 末尾行。
- 思考/回答/工具拆分是客户端估算；总耗时为权威值。
- 终端渲染器忽略 `size="caption"`，Desktop 使用 caption 字号。
- 电脑休眠/暂停计入墙钟耗时。
- 按回复保存的耗时位于会话状态中，不是永久 transcript 历史。

## 许可证

MIT，详见 [LICENSE](LICENSE)。
