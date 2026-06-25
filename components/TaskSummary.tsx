'use client'

import type { Task, SubTask, Issue } from '@/lib/types'
import type { SupabaseClient } from '@supabase/supabase-js'

type Props = {
  task: Task
  onClose: () => void
  onEdit: () => void
  onRefresh: () => Promise<void>
  supabase: SupabaseClient
}

export default function TaskSummary({ task, onClose, onEdit, onRefresh, supabase }: Props) {
  async function checkAutoComplete() {
    const subsDone = task.subtasks.length === 0 || task.subtasks.every(s => s.done)
    const issuesDone = task.issues.length === 0 || task.issues.every(i => i.done)
    const hasAny = task.subtasks.length > 0 || task.issues.length > 0
    if (hasAny && subsDone && issuesDone && !task.done) {
      await supabase.from('tasks').update({ done: true, done_at: new Date().toTimeString().slice(0, 5) }).eq('id', task.id)
    }
  }

  async function toggleMain() {
    const nowDone = !task.done
    await supabase.from('tasks').update({
      done: nowDone,
      done_at: nowDone ? new Date().toTimeString().slice(0, 5) : null,
    }).eq('id', task.id)
    if (!nowDone) {
      await supabase.from('subtasks').update({ done: false }).eq('task_id', task.id)
      await supabase.from('issues').update({ done: false }).eq('task_id', task.id)
    }
    await onRefresh()
  }

  async function toggleSub(s: SubTask) {
    await supabase.from('subtasks').update({ done: !s.done }).eq('id', s.id)
    await checkAutoComplete()
    await onRefresh()
  }

  async function toggleIssue(i: Issue) {
    await supabase.from('issues').update({ done: !i.done }).eq('id', i.id)
    await checkAutoComplete()
    await onRefresh()
  }

  async function deleteSub(id: number) {
    if (!confirm('このサブタスクを削除しますか？')) return
    await supabase.from('subtasks').delete().eq('id', id)
    await onRefresh()
  }

  async function deleteIssue(id: number) {
    if (!confirm('この課題を削除しますか？')) return
    await supabase.from('issues').delete().eq('id', id)
    await onRefresh()
  }

  const totalItems = task.subtasks.length + task.issues.length
  const doneItems = task.subtasks.filter(s => s.done).length + task.issues.filter(i => i.done).length
  const pct = totalItems === 0 ? 0 : Math.round((doneItems / totalItems) * 100)

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 40, padding: 16 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ width: '100%', maxWidth: 380, maxHeight: '90vh', overflowY: 'auto', background: '#fff', borderRadius: 16, padding: 20, display: 'flex', flexDirection: 'column', gap: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, flex: 1 }}>
            <div
              onClick={toggleMain}
              style={{
                width: 26, height: 26, borderRadius: '50%', flexShrink: 0, marginTop: 2, cursor: 'pointer',
                border: task.done ? '2px solid #2e7d4f' : '2px dashed #ccc',
                background: task.done ? '#2e7d4f' : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              {task.done && <span style={{ color: '#fff', fontSize: 13 }}>✓</span>}
            </div>
            <div style={{ fontSize: 17, fontWeight: 600, color: '#222', lineHeight: 1.4, textDecoration: task.done ? 'line-through' : 'none' }}>
              {task.text}
            </div>
          </div>
          <button onClick={onEdit} style={editBtnStyle}>
            <span style={{ fontSize: 12 }}>✎</span> 編集
          </button>
        </div>

        {task.carry_from && (
          <div style={carryTagStyle}>
            <span>⏱</span> {task.carry_from}から繰り越し
          </div>
        )}

        {task.memo && (
          <div style={{ background: '#f7f7f5', borderRadius: 10, padding: '10px 12px', fontSize: 13, color: '#666', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
            {task.memo}
          </div>
        )}

        {totalItems > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#888' }}>
              <span>進捗</span><span>{doneItems} / {totalItems} 完了</span>
            </div>
            <div style={{ height: 6, background: '#eee', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ height: '100%', background: '#2e7d4f', borderRadius: 3, width: `${pct}%` }} />
            </div>
          </div>
        )}

        {task.subtasks.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={sectionLabelStyle}><span>▤</span> 分割タスク（{task.subtasks.length}件）</div>
            {task.subtasks.map(s => (
              <div key={s.id} style={itemRowStyle}>
                <div
                  onClick={() => toggleSub(s)}
                  style={{
                    width: 18, height: 18, borderRadius: '50%', flexShrink: 0, cursor: 'pointer',
                    border: s.done ? '2px solid #2e7d4f' : '2px dashed #ccc',
                    background: s.done ? '#2e7d4f' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  {s.done && <span style={{ color: '#fff', fontSize: 10 }}>✓</span>}
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ flex: 1, fontSize: 13, color: s.done ? '#aaa' : '#333', textDecoration: s.done ? 'line-through' : 'none' }}>
                      {s.text}
                    </span>
                    <button onClick={() => deleteSub(s.id)} style={smallDelBtnStyle}>
                      <span style={{ fontSize: 16 }}>×</span>
                    </button>
                  </div>
                  {s.memo && (
                    <div style={{ fontSize: 12, color: '#555', lineHeight: 1.5, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                      <span style={memoChipStyle}><span style={{ fontSize: 9 }}>📝</span> メモ</span>
                      <span>{s.memo}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {task.issues.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={sectionLabelStyle}><span>⚠</span> 課題（{task.issues.length}件）</div>
            {task.issues.map(i => (
              <div key={i.id} style={itemRowStyle}>
                <div
                  onClick={() => toggleIssue(i)}
                  style={{
                    width: 18, height: 18, borderRadius: '50%', flexShrink: 0, cursor: 'pointer',
                    border: i.done ? '2px solid #2e7d4f' : '2px dashed #ccc',
                    background: i.done ? '#2e7d4f' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  {i.done && <span style={{ color: '#fff', fontSize: 10 }}>✓</span>}
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ flex: 1, fontSize: 13, color: i.done ? '#aaa' : '#333', textDecoration: i.done ? 'line-through' : 'none' }}>
                      {i.text}
                    </span>
                    <button onClick={() => deleteIssue(i.id)} style={smallDelBtnStyle}>
                      <span style={{ fontSize: 16 }}>×</span>
                    </button>
                  </div>
                  {i.memo && (
                    <div style={{ fontSize: 12, color: '#555', lineHeight: 1.5, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                      <span style={memoChipStyle}><span style={{ fontSize: 9 }}>📝</span> メモ</span>
                      <span>{i.memo}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

const editBtnStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, padding: '6px 12px', borderRadius: 8, border: '1px solid #444', color: '#444', background: 'transparent', cursor: 'pointer', flexShrink: 0 }
const carryTagStyle: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, background: '#FAEEDA', color: '#BA7517', padding: '3px 8px', borderRadius: 10, width: 'fit-content' }
const sectionLabelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: '#999', display: 'flex', alignItems: 'center', gap: 5 }
const itemRowStyle: React.CSSProperties = { display: 'flex', alignItems: 'flex-start', gap: 10, background: '#f7f7f5', borderRadius: 8, padding: '8px 10px' }
const memoChipStyle: React.CSSProperties = { fontSize: 10, padding: '2px 8px', borderRadius: 10, background: '#eee', color: '#777', display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0, fontWeight: 500, marginTop: 1 }
const smallDelBtnStyle: React.CSSProperties = { width: 28, height: 28, borderRadius: '50%', border: 'none', background: 'transparent', color: '#ccc', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 16 }
