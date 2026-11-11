# turn-timing

`turn-timing` は、各返信の最後の assistant メッセージ末尾（返信操作行の上）に、短く設定可能な時間表示を追加します。返信完了後にのみ表示され、実行中は追加されません。

## 表示例

```text
Ran 7 commands, read 3 files · 作業 1m30s · 思考 12s · 回答 8s · ツール 1m10s · Token 13k · 入力 12k · キャッシュ 8k (67%) · 出力 1k
```

同じ行の末尾に、エンジンが usage を返した場合の token 統計を追加します。追加部分は最小サイズの淡色テキストで、狭い幅では切り詰めます。表示専用であり、transcript ファイルやモデルコンテキストには入りません。

## インストール

marketplace からのワンステップインストールには Claude Code 2.1.275+ が必要です。function-hook API は Claude Desktop Code タブ同梱の Claude Code 2.1.321 を対象としています。

```bash
/plugin marketplace add ideshun/claude-code-mods
/plugin install turn-timing@claude-code-mods
```

user scope を選択し、Plugins 設定でオプションを設定してください。新規セッションは user scope から自動読み込みします。Desktop Code タブは user scope プラグインを使用できますが、`/plugin install` は提供しません。

開発時：

```bash
claude --plugin-dir /path/to/claude-code-mods/plugins/turn-timing
```

## 設定

| 項目 | 値 | 既定値 | 内容 |
| --- | --- | --- | --- |
| `language` | `Auto`、`中文`、`English`、`日本語`、`Custom` | `English` | 言語名で表示。`Auto` は明示的な中国語/日本語ロケール変数に従う |
| `showTokens` | 真偽値 | `true` | 時間表示の下に合計・入力・キャッシュ・出力 token を表示 |
| `prefix` | 文字列 | 空 | 時間表示の前の文字/絵文字 |
| `totalLabel` | 文字列 | 空 | 合計時間のカスタムラベル |
| `thinkingLabel` | 文字列 | 空 | 思考時間のカスタムラベル |
| `respondingLabel` | 文字列 | 空 | 回答時間のカスタムラベル |
| `toolsLabel` | 文字列 | 空 | ツール時間のカスタムラベル |

`Custom` は四つのカスタムラベルがすべて非空の場合に有効です。旧値 `auto`、`zh-CN`、`en`、`ja-JP`、`custom` も互換性のため受け付けます。

## 計測内容

| 項目 | 情報源 |
| --- | --- |
| 合計 | エンジンの `turn.complete.durationMs` |
| 思考 | ストリーミングされた `thinking` chunk の時間 |
| 回答 | テキストおよびツール呼び出し chunk の時間 |
| ツール | メインループのツール実行時間 |
| Token 合計 | `turn.complete.usage`: 未キャッシュ入力 + キャッシュ書込 + キャッシュ読込 + 出力 |
| キャッシュ命中率 | `cache_read_input_tokens / (input_tokens + cache_creation_input_tokens + cache_read_input_tokens)` |

完了した返信ごとに最後の assistant メッセージ末尾へ 1 行を置き、以前の返信は書き換わりません。token はエンジンが報告するターン合計で、usage がない場合は token 指標を表示しません。サブエージェントは対象外です。三つの推定値は権威ある合計値を超えないよう正規化されます。

## 検証

```bash
claude plugin validate plugins/turn-timing
claude plugin test plugins/turn-timing
```

返信ごとの 1 行表示、値の独立性、言語名、`Auto`、カスタムラベル、実行中非表示、サブエージェント、中断をテストしています。

## 制限

- 完了した返信の末尾に 1 行表示します。
- 思考/回答/ツールの内訳はクライアント推定で、合計値が正式です。
- 端末レンダラーは `size="caption"` を無視しますが、Desktop では caption サイズです。
- スリープ中も壁時計時間として計測されます。
- 返信ごとの値はセッション状態に保存され、永続的な会話履歴ではありません。

## ライセンス

MIT。詳細は [LICENSE](LICENSE) を参照してください。
