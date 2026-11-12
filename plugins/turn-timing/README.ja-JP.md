# turn-timing

`turn-timing` は、各返信の最後の assistant メッセージ末尾（返信操作行の上）に、短く設定可能な時間表示を追加します。返信完了後にのみ表示され、実行中は追加されません。

## 表示例

![時間と token 指標](assets/effect.png)

```text
作業 7m23s · 思考 2m18s · 回答 1m57s · ツール 3m8s & Token 9.5M · 入力 9.5M · キャッシュ 9.2M (98%) · 出力 40k
```

エンジンが usage を返した場合、token 指標を同じ行に追加します。プラグインが追加するのはこの行だけで、上の返信本文は変更しません。最小サイズの淡色テキストで、狭い幅では折り返します。表示専用であり、transcript ファイルやモデルコンテキストには入りません。

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
| `language` | `Auto`、`中文`、`English`、`日本語`、`Custom` | `English` | タイミング表示の言語。`Auto` はシステム言語に従い、`Custom` は四つのカスタムラベルを使用 |
| `showTokens` | 真偽値 | `true` | タイミングの後に合計・入力・出力 token とキャッシュ命中率を表示 |
| `prefix` | 文字列 | 空 | 時間表示の前の文字/絵文字 |
| `totalLabel` | 文字列 | 空 | 合計時間のカスタムラベル |
| `thinkingLabel` | 文字列 | 空 | 思考時間のカスタムラベル |
| `respondingLabel` | 文字列 | 空 | 回答時間のカスタムラベル |
| `toolsLabel` | 文字列 | 空 | ツール時間のカスタムラベル |

四つのカスタムラベルは `Custom` のときだけ使用され、すべて非空である必要があります。旧値 `auto`、`zh-CN`、`en`、`ja-JP`、`custom` も互換性のため受け付けます。

## 計測内容

| 項目 | 情報源 |
| --- | --- |
| 合計 | エンジンの `turn.complete.durationMs` |
| 思考 | ストリーミングされた `thinking` chunk の時間 |
| 回答 | テキストおよびツール呼び出し chunk の時間 |
| ツール | メインループのツール実行時間。並行呼び出しは実時間で一度だけ計上 |
| Token 合計 | `turn.complete.usage`: 未キャッシュ入力 + キャッシュ書込 + キャッシュ読込 + 出力 |
| キャッシュ命中率 | `cache_read_input_tokens / (input_tokens + cache_creation_input_tokens + cache_read_input_tokens)` |

完了した返信の最後のテキストブロックに時間を表示します。メッセージ ID を優先し、API message ID がない場合は一意に一致する最終テキストで遅延描画を紐づけます。各画面では一つのブロックだけに表示します。サブエージェントは対象外です。思考・回答は観測されたストリーム時間のみを計上し、通信待ちなどは合計だけに残るため、内訳の和が合計より短い場合があります。

## 検証

リポジトリの `scripts/verify.sh` を `CLAUDE_BIN` で対象 Desktop のバイナリに向けて実行します。引数にインストール先を渡すとファイルの一致も確認します。公開時は新しいバージョンとタグを使い、クリーンインストール・更新・再インストール後に新規 Desktop セッションで連続する二つの返信を検証してください。

```bash
claude plugin validate plugins/turn-timing
claude plugin test plugins/turn-timing
```

返信ごとの 1 行表示、値の独立性、履歴再描画、言語の優先順位、並行ツール、言語名、`Auto`、カスタムラベル、実行中非表示、サブエージェント、中断をテストしています。

## 制限

- 最新 50 ターンを保持し、`/clear` またはセッション終了で破棄します。
- ID がなく同じ最終テキストを区別できない場合、推測せず表示を省略します。
- 実行中のターンで追跡する描画候補は最大 256 件です。
- 思考/回答/ツールの内訳はクライアント推定で、合計値が正式です。
- 端末レンダラーは `size="caption"` を無視しますが、Desktop では caption サイズです。
- スリープ中も壁時計時間として計測されます。
- 返信ごとの値はセッション状態に保存され、永続的な会話履歴ではありません。

## ライセンス

MIT。詳細は [LICENSE](LICENSE) を参照してください。
