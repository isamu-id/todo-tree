# Todo Tree — カレンダーベースのTodoアプリ

## セットアップ手順

### 1. Supabase の準備

1. [supabase.com](https://supabase.com) でプロジェクト作成
2. **SQL Editor** を開いて `schema.sql` の内容を貼り付けて実行
3. **Project Settings > API** から `Project URL` と `anon public key` をコピー

### 2. ローカル開発（VS Code）

1. このフォルダを **VS Codeで開く**（「ファイル」→「フォルダーを開く」）
2. VS Codeのターミナルで以下を実行：

```bash
npm install
cp .env.local.example .env.local
```

3. `.env.local` を開いて、SupabaseのURLとキーを入力
4. 開発サーバーを起動：

```bash
npm run dev
```

`http://localhost:3000` で確認できます。

### 3. GitHubにアップロード

```bash
git init
git add .
git commit -m "first commit"
git branch -M main
git remote add origin https://github.com/（あなたのユーザー名）/todo-tree.git
git push -u origin main
```

### 4. Vercelへデプロイ

1. [vercel.com](https://vercel.com) で「New Project」→ このリポジトリを選択
2. **Environment Variables** に以下を追加：
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. 「Deploy」をクリック

## 機能一覧

- 📅 月カレンダー → 日付クリックでタスク管理画面へ全画面遷移
- 📋 分割タスク（ツリー構造表示）
- ⚠️ 課題（ツリー構造表示）
- 📝 メモ（タスク・分割タスク・課題それぞれに編集可能）
- 🔢 優先度番号 + ドラッグ＆ドロップで並び替え
- ✅ 分割タスク・課題が両方完了で親タスクも自動完了
- 🔄 繰り越し（カレンダーで日付選択＋理由記録）
- 🗑️ 削除確認ダイアログ
