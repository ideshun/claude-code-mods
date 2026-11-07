# Claude Code Mods

ideshun による Claude Code プラグイン、mod、関連ツールのカテゴリ別コレクションです。

## リポジトリ構成

```text
plugins/       インストール可能な Claude Code プラグイン
  turn-timing/ UI プラグイン：コンパクトで設定可能な返信時間
mods/          セッション単位の function-hook 実験（予定）
skills/        独立スキル（予定）
agents/        独立エージェント定義（予定）
docs/          共通ドキュメントとスクリーンショット（予定）
```

公開済みプラグインはルートの `.claude-plugin/marketplace.json` に一覧されています。新しい項目はリポジトリ直下ではなく、対応するカテゴリに追加します。

## プラグイン

| プラグイン | カテゴリ | 内容 | 状態 |
| --- | --- | --- | --- |
| [turn-timing](plugins/turn-timing/README.ja-JP.md) | UI / 時間計測 | 完了した返信ごとに、合計・思考・回答・ツール時間を返信末尾へ追加 | v0.1.1 |

ドキュメントは [English](plugins/turn-timing/README.en.md)、[中文](plugins/turn-timing/README.zh-CN.md)、[日本語](plugins/turn-timing/README.ja-JP.md) を提供しています。

## marketplace からインストール

Claude Code のターミナルセッションで次を実行します。

```bash
/plugin marketplace add ideshun/claude-code-mods
/plugin install turn-timing@claude-code-mods
```

user scope を選択し、設定画面でオプションを完了してください。現在のセッションで有効になり、以降の新規セッションでも user scope から自動的に読み込まれます。

更新時：

```bash
/plugin marketplace update claude-code-mods
/plugin update turn-timing@claude-code-mods
```

Claude Desktop の Code タブでは `/plugin install` を使用できません。ターミナルの Claude Code でインストールするか、開発時はプラグイン README の `--plugin-dir` 手順を使用してください。

## クイックスタート

インストール後に返信が完了すると、transcript 末尾に次のような短い文字列が追加されます。

```text
Ran 7 commands, read 3 files · 作業 1m30s · 思考 12s · 回答 8s · ツール 1m10s
```

Plugins 設定の Language には `Auto`、`中文`、`English`、`日本語`、`Custom` が表示されます。既定値は `English` です。`Auto` は `LANG` / `LC_ALL` / `LC_MESSAGES` が明示的に中国語または日本語の場合のみ切り替え、`Custom` は四つのカスタムラベルを使用します。

## 開発

対象ホストと一致する Claude Code バージョンを使用してください。このリポジトリは現在、Claude Desktop Code タブ同梱の Claude Code 2.1.317 function-hook API を対象としています。

```bash
claude plugin validate plugins/turn-timing
claude plugin test plugins/turn-timing
```

## ライセンス

MIT。各プラグインフォルダーのライセンスを参照してください。
