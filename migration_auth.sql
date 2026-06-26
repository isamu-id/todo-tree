-- ユーザーごとにタスクを分離するための変更
-- Supabase SQL Editor で実行してください

-- tasksテーブルにuser_id列を追加
alter table tasks add column user_id uuid references auth.users(id);

-- 既存のRLSポリシー（全員アクセス可）を削除
drop policy if exists "allow all tasks" on tasks;
drop policy if exists "allow all subtasks" on subtasks;
drop policy if exists "allow all issues" on issues;

-- 新しいRLSポリシー：自分のタスクだけ見える・操作できる
create policy "Users can view own tasks" on tasks
  for select using (auth.uid() = user_id);
create policy "Users can insert own tasks" on tasks
  for insert with check (auth.uid() = user_id);
create policy "Users can update own tasks" on tasks
  for update using (auth.uid() = user_id);
create policy "Users can delete own tasks" on tasks
  for delete using (auth.uid() = user_id);

-- subtasksは親タスクのuser_idを通じて判定
create policy "Users can view own subtasks" on subtasks
  for select using (
    exists (select 1 from tasks where tasks.id = subtasks.task_id and tasks.user_id = auth.uid())
  );
create policy "Users can insert own subtasks" on subtasks
  for insert with check (
    exists (select 1 from tasks where tasks.id = subtasks.task_id and tasks.user_id = auth.uid())
  );
create policy "Users can update own subtasks" on subtasks
  for update using (
    exists (select 1 from tasks where tasks.id = subtasks.task_id and tasks.user_id = auth.uid())
  );
create policy "Users can delete own subtasks" on subtasks
  for delete using (
    exists (select 1 from tasks where tasks.id = subtasks.task_id and tasks.user_id = auth.uid())
  );

-- issuesも同様
create policy "Users can view own issues" on issues
  for select using (
    exists (select 1 from tasks where tasks.id = issues.task_id and tasks.user_id = auth.uid())
  );
create policy "Users can insert own issues" on issues
  for insert with check (
    exists (select 1 from tasks where tasks.id = issues.task_id and tasks.user_id = auth.uid())
  );
create policy "Users can update own issues" on issues
  for update using (
    exists (select 1 from tasks where tasks.id = issues.task_id and tasks.user_id = auth.uid())
  );
create policy "Users can delete own issues" on issues
  for delete using (
    exists (select 1 from tasks where tasks.id = issues.task_id and tasks.user_id = auth.uid())
  );
