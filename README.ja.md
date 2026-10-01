# TimeTree MCP Server

[English](README.md) | [한국어](README.ko.md) | [日本語](#日本語)

## 日本語

> ⚠️ **免責事項**: これは**個人利用向け**の**非公式** TimeTree MCP サーバーです。TimeTree, Inc. とは提携していません。いつでも動作しなくなる可能性があります。詳細は [DISCLAIMER.md](DISCLAIMER.md) を参照してください。

Claude、Codex、Cursor、Windsurf などの MCP クライアントから、TimeTree のカレンダー、イベント、メモ、コメント、ラベル、メンバー情報をローカルで読み取り・管理できるようにする非公式の MCP (Model Context Protocol) サーバーです。認証情報は MCP クライアント設定にのみ保存します。

> **クレジット**: このプロジェクトは [@eoleedi](https://github.com/eoleedi) による [TimeTree-Exporter](https://github.com/eoleedi/TimeTree-Exporter) から着想を得ており、API に関する知見も参考にしています。

### 機能

- 📅 **カレンダー一覧** - TimeTree のすべてのカレンダーを取得
- 📆 **イベント取得** - 自動ページネーションで任意のカレンダーのイベントを取得
- ➕ **イベント作成** - カレンダーに新しいイベントを追加
- ✏️ **イベント更新** - 既存イベントを変更
- 🗑️ **イベント削除** - カレンダーからイベントを削除
- 🗒️ **メモ管理** - TimeTree メモの一覧取得、作成、更新、削除
- 💬 **コメント管理** - イベントコメントの追加、一覧取得、更新、削除
- 🏷️ **カレンダーメタデータ** - ラベルの取得/更新、メンバー/仮想メンバーの確認
- 🎌 **祝日** - 国と期間を指定して祝日を取得
- 🕘 **最近のアクティビティ** - 誰が予定やメモを作成・変更・削除したかを確認
- 🔐 **安全な認証** - メールアドレス/パスワード認証（MCP 設定にのみ保存）
- ⚡ **レート制限** - Token Bucket アルゴリズムで API 負荷を抑制
- 🔄 **自動ページネーション** - 複数ページにまたがるイベントを自動取得
- 🛡️ **エラー処理** - ユーザーに分かりやすい包括的なエラー処理
- 📝 **構造化ログ** - 機密データをマスクした詳細ログ

### 必要条件

- Node.js >= 22
- Git（インストール用）
- TimeTree アカウント
- MCP 対応クライアント（Claude Desktop、Claude Code、Codex、Antigravity、Cline など）

### インストール

#### 🚀 エージェント向けクイックインストール

Codex、Claude Code、その他のコーディングエージェントに次のプロンプトを貼り付けてください:

> Clone `https://github.com/ehs208/TimeTree-MCP`, enter the cloned directory, run `npm ci && npm run build`, then configure my MCP client with a server named `timetree` that runs `node /absolute/path/to/TimeTree-MCP/dist/index.js` (use the real cloned path). Store `TIMETREE_EMAIL` and `TIMETREE_PASSWORD` only in the MCP client environment configuration, and never hardcode or print secrets.

役に立った場合は GitHub star で応援してください: https://github.com/ehs208/TimeTree-MCP

#### クイックインストール（推奨）

**1 行インストール** - 自動で clone、ビルド、任意の `npm link` を試行し、クライアント設定例を表示します:

```bash
curl -fsSL https://raw.githubusercontent.com/ehs208/TimeTree-MCP/main/TimeTree-MCP-install.sh | bash
```

このプロジェクトは npm registry ではなく GitHub clone からインストールします。スクリプトはローカル clone をビルドし、必要に応じて `npm link` を実行したあと、絶対パスの `node`/`dist/index.js` を使う MCP クライアント設定例を表示します。利用するクライアント用の設定をコピーし、TimeTree 認証情報を入力してください。

#### 手動インストール

<details>
<summary>手動インストール手順を表示</summary>

1. **clone とビルド:**

```bash
git clone https://github.com/ehs208/TimeTree-MCP.git
cd TimeTree-MCP
npm ci
npm run build
```

2. **MCP クライアントの設定:**

下の [設定](#設定) セクションを参照して、利用する MCP クライアントに設定してください。

</details>

### 設定

**クイック例（Claude Desktop - macOS）:**

`~/Library/Application Support/Claude/claude_desktop_config.json` を編集します:

```json
{
  "mcpServers": {
    "timetree": {
      "command": "node",
      "args": ["/absolute/path/to/TimeTree-MCP/dist/index.js"],
      "env": {
        "TIMETREE_EMAIL": "your-email@example.com",
        "TIMETREE_PASSWORD": "your-password"
      }
    }
  }
}
```

パスは実際に clone したリポジトリのパスに置き換えてください。GUI クライアントが `node` を見つけられない場合は、`command -v node` の結果の絶対パスを `command` に指定してください。その後 Claude Desktop を再起動します（Cmd+Q で終了して再起動）。

📖 **すべての MCP クライアント（Claude Desktop Windows、Claude Code CLI、Codex、Antigravity、VS Code 系エディタなど）の設定:**
→ 詳細な設定手順は **[docs/MCP_CLIENTS.md](docs/MCP_CLIENTS.md)** を参照してください

### 更新

最新バージョンへ更新するには:

```bash
cd /path/to/TimeTree-MCP  # またはインストール先のパス
git pull origin main
npm ci
npm run build
```

その後、MCP クライアントを再起動してください。

📖 **詳しい更新手順とトラブルシューティング:**
→ **[docs/UPDATING.md](docs/UPDATING.md)** を参照してください

### 使い方

📖 **詳しい使用例とワークフローは [COMMANDS.md](COMMANDS.md) を参照してください**

### MCP ツール

- **list_calendars** - 参加ユーザー情報付きですべてのカレンダーを一覧表示
- **get_events** - 自動ページネーションでカレンダーのイベントを取得（開始時刻順、キーワード/ラベル/期間フィルター、期間内の繰り返し予定を展開）
- **get_updated_events** - 指定時刻以降に更新されたイベントを取得（効率的な差分同期）
- **create_event** - カレンダーに新しいイベントを作成（通知、繰り返し、参加者、チェックリストに対応）
- **update_event** - 既存イベントを更新
- **delete_event** - カレンダーからイベントを削除
- **list_memos / create_memo / update_memo / delete_memo** - TimeTree メモを管理
- **add_event_comment / list_event_comments / update_event_comment / delete_event_comment** - イベントコメントを管理
- **get_calendar_labels / update_calendar_labels** - カレンダーラベルを取得またはマージ更新
- **get_calendar_members / get_calendar_virtual_members** - カレンダーメンバーのメタデータを取得
- **get_holidays** - 期間内の祝日と記念日を取得
- **get_recent_activity** - 最近変更された予定とメモ、変更者を取得

📖 パラメータと詳しい使い方は [COMMANDS.md](COMMANDS.md) を参照してください。

### 開発

```bash
# プロジェクトをビルド
npm run build

# Watch モード（変更時に自動リビルド）
npm run dev
```

### 制限事項

- **非公式 API**: TimeTree が内部 API を変更すると動作しなくなる可能性があります
- **レート制限**: 1 秒あたり 10 リクエスト（429 エラー時は自動リトライ）
- **公式サポートなし**: TimeTree はこのツールを公式にはサポートしていません
- **CSRF トークンが必要**: 書き込み操作には CSRF トークンが必要です（TimeTree Web ページから自動抽出）

### セキュリティ

- 認証情報は**ローカル MCP 設定にのみ**保存されます
- セッション Cookie はメモリにのみ保存されます（ディスクには永続化しません）
- パスワードとセッション ID はログ内で自動的にマスクされます
- すべての通信は HTTPS を使用します

### トラブルシューティング

#### "Missing required environment variables" エラー

MCP 設定で `TIMETREE_EMAIL` と `TIMETREE_PASSWORD` が設定されていることを確認してください。

#### 認証に失敗する

- メールアドレスとパスワードが正しいことを確認してください
- TimeTree Web アプリにログインできるか確認してください
- TimeTree が認証 API を変更した可能性があります

#### カレンダーやイベントが返らない

- TimeTree アカウントにカレンダー/イベントが存在することを確認してください
- 詳細なエラーメッセージはログを確認してください
- API が変更された可能性があります

### コントリビューション

コントリビューションを歓迎します。基本的な流れは次のとおりです:

1. リポジトリを fork
2. 機能ブランチを作成
3. 変更を実装
4. Pull Request を送信

### ライセンス

MIT License - 詳細は [LICENSE](LICENSE) を参照してください。

### プロジェクトを応援

このプロジェクトが役に立った場合は、GitHub Star を付けていただけると嬉しいです。他のユーザーがこのプロジェクトを見つける助けになります。

### 免責事項

重要な法的情報と利用上の注意は [DISCLAIMER.md](DISCLAIMER.md) を参照してください。

---

**TIMETREE, INC. とは提携していません**

これは独立したコミュニティ管理プロジェクトです。
