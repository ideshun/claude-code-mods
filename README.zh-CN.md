# Claude Code 模块合集

按功能分类收集 ideshun 的 Claude Code 插件、模块及相关工具。

## 仓库结构

```text
plugins/       可安装的 Claude Code 插件（每个含 .claude-plugin/plugin.json）
  turn-timing/ UI 插件：精简、可配置的单次回复耗时
mods/          会话级函数钩子实验（规划）
skills/        独立技能（规划）
agents/        独立 Agent 定义（规划）
docs/          共用文档与截图（规划）
```

每个可安装插件放在 `plugins/` 下自己的目录中。根目录 `.claude-plugin/marketplace.json` 列出已发布插件；后续内容按类别添加，不放在仓库根目录。

## 插件

| 插件 | 分类 | 功能 | 状态 |
| --- | --- | --- | --- |
| [turn-timing](plugins/turn-timing/README.zh-CN.md) | UI / 计时 | 在每次完成回复的末尾显示总耗时、思考、回答与工具耗时 | v0.1.5 |

插件文档提供 [English](plugins/turn-timing/README.en.md)、[中文](plugins/turn-timing/README.zh-CN.md) 和 [日本語](plugins/turn-timing/README.ja-JP.md) 版本。

## 从 marketplace 安装

在 Claude Code 终端会话中执行：

```bash
/plugin marketplace add ideshun/claude-code-mods
/plugin install turn-timing@claude-code-mods
```

选择 user scope，在配置界面完成设置。当前会话立即生效，新会话自动从 user scope 加载。

后续更新：

```bash
/plugin marketplace update claude-code-mods
/plugin update turn-timing@claude-code-mods
```

Claude Desktop 的 Code 标签页不提供 `/plugin install`；请在终端 Claude Code 会话中安装，开发时也可按插件 README 使用 `--plugin-dir`。

## 快速上手

安装后完成一次回复，回复正文末尾会追加类似内容：

![耗时与 token 指标](plugins/turn-timing/assets/effect.png)

```text
工作 7m23s · 思考 2m18s · 回答 1m57s · 工具 3m8s & Token 9.5M · 输入 9.5M · 缓存 9.2M (98%) · 输出 40k
```

token 指标默认开启（`showTokens`）。Plugins 设置中的 Language 选项为 `Auto`、`中文`、`English`、`日本語`、`Custom`。默认是 `English`；`Auto` 仅在 `LANG` / `LC_ALL` / `LC_MESSAGES` 明确为中文或日文时切换，`Custom` 使用四个自定义标签。

## 开发

请使用与目标宿主匹配的 Claude Code 版本。本仓库当前针对 Claude Desktop Code 标签页内置的 Claude Code 2.1.321 函数钩子 API。

```bash
claude plugin validate plugins/turn-timing
claude plugin test plugins/turn-timing
```

## 许可证

MIT。详见各插件目录中的许可证文件。
