# turn-timing

`turn-timing` 在每次完成的回复的最后一条 assistant 消息末尾（底部操作栏上方）放置一条精简、可配置的耗时行。耗时只在回复结束后出现，工作中不显示。

## 效果

![耗时与 token 指标](assets/effect.png)

```text
工作 7m23s · 思考 2m18s · 回答 1m57s · 工具 3m8s & Token 9.5M · 输入 9.5M · 缓存 9.2M (98%) · 输出 40k
```

引擎返回本轮 usage 时，token 指标会接在同一行。插件只追加这一行，不修改上方回复正文。该行使用最小号、弱化颜色并在窄布局中截断；仅用于显示，不进入 transcript 文件，也不进入模型上下文。

## 安装

一键 marketplace 安装需要 Claude Code 2.1.275+。函数钩子 API 针对 Claude Desktop Code 标签页内置的 Claude Code 2.1.321。

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
| `language` | `Auto`、`中文`、`English`、`日本語`、`Custom` | `English` | 计时文字语言；`Auto` 跟随系统语言，`Custom` 使用四个自定义标签 |
| `showTokens` | 布尔 | `true` | 在耗时后显示总 token、输入、输出和缓存命中率 |
| `prefix` | 字符串 | 空 | 耗时前可选的字符或 emoji |
| `totalLabel` | 字符串 | 空 | 总耗时自定义标签 |
| `thinkingLabel` | 字符串 | 空 | 思考耗时自定义标签 |
| `respondingLabel` | 字符串 | 空 | 回答耗时自定义标签 |
| `toolsLabel` | 字符串 | 空 | 工具耗时自定义标签 |

只有 `Custom` 会使用四个自定义标签，且四项都必须非空。旧配置值 `auto`、`zh-CN`、`en`、`ja-JP`、`custom` 仍兼容。

示例 `~/.claude/settings.json`：

```json
{
  "pluginConfigs": {
    "turn-timing@claude-code-mods": {
      "options": {
        "language": "中文",
        "showTokens": true,
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
| 工具 | 主循环工具调用执行时间；并发调用只计一次墙钟时间 |
| Token 总量 | `turn.complete.usage`：未缓存输入 + 缓存写入 + 缓存读取 + 输出 |
| 缓存命中率 | `cache_read_input_tokens / (input_tokens + cache_creation_input_tokens + cache_read_input_tokens)` |

每次完成的回复只在最后一条 assistant 消息末尾显示一条耗时行，旧回复保持各自数值。耗时绑定到该回复最后一条已存储的 assistant 消息，重新绘制旧消息不会移动当前耗时。token 是引擎报告的整轮汇总；没有 usage 时不显示 token 指标；子 Agent 回合不统计。三个估算值会归一化，不会超过权威总耗时。

## 验证

```bash
claude plugin validate plugins/turn-timing
claude plugin test plugins/turn-timing
```

测试覆盖每次回复一条、数值独立、历史重绘、语言优先级、并发工具、语言本名、`Auto`、自定义标签、工作中隐藏、子 Agent 与中断。

## 限制

- 每次完成的回复只显示一条耗时行。
- 思考/回答/工具拆分是客户端估算；总耗时为权威值。
- 终端渲染器忽略 `size="caption"`，Desktop 使用 caption 字号。
- 电脑休眠/暂停计入墙钟耗时。
- 按回复保存的耗时位于会话状态中，不是永久对话历史。

## 许可证

MIT，详见 [LICENSE](LICENSE)。
