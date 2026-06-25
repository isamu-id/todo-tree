'use client'

import { useState } from 'react'
import type { Task, SubTask } from '@/lib/types'
import type { SupabaseClient } from '@supabase/supabase-js'

type Props = {
  task: Task
  onClose: () => void
  onRefresh: () => Promise<void>
  supabase: SupabaseClient
}

export default function SplitModal({ task, onClose, onRefresh, supabase }: Props) {
  const [showAdd, setShowAdd] = useState(false)
  const [newText, setNewText] = useState('')
  const [newMemo, setNewMemo] = useState('')

  async function checkAutoComplete() {
    const subsDone = task.subtasks.length === 0 || task.subtasks.every(s => s.done)
    const issuesDone = task.issues.length === 0 || task.issues.every(i => i.done)
    const hasAny = task.subtasks.length > 0 || task.issues.length > 0
    if (hasAny && subsDone && issuesDone && !task.done) {
      await supabase.from('tasks').update({ done: true, done_at: new Date().toTimeString().slice(0, 5) }).eq('id', task.id)
    }
  }

  async function toggleSub(s: SubTask) {
    await supabase.from('subtasks').update({ done: !s.done }).eq('id', s.id)
    await checkAutoComplete()
    await onRefresh()
  }

  async function deleteSub(id: number) {
    if (!confirm('このサブタスクを削除しますか？')) return
    await supabase.from('subtasks').delete().eq('id', id)
    await onRefresh()
  }

  async function addSub() {
    if (!newText.trim()) return
    const { error } = await supabase.from('subtasks').insert({ task_id: task.id, text: newText.trim(), memo: newMemo.trim(), done: false })
    if (error) { alert('サブタスクの追加に失敗しました：' + error.message); return }
    setNewText(''); setNewMemo(''); setShowAdd(false)
    await onRefresh()
  }

  const done = task.subtasks.filter(s => s.done).length
  const total = task.subtasks.length
  const pct = total === 0 ? 0 : Math.round((done / total) * 100)

  return (
    <div style={overlayStyle} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={modalStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 500, color: '#333' }}>{task.text}</div>
            <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>分割タスク</div>
          </div>
          <button onClick={onClose} style={xBtnStyle}><span>×</span></button>
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#888' }}>
            <span>{done} / {total} 完了</span><span>{pct}%</span>
          </div>
          <div style={{ height: 4, background: '#eee', borderRadius: 2, overflow: 'hidden', marginTop: 6 }}>
            <div style={{ height: '100%', background: '#444', borderRadius: 2, width: `${pct}%` }} />
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {task.subtasks.map(s => (
            <div key={s.id} style={subItemStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px' }}>
                <div onClick={() => toggleSub(s)} style={chkStyle(s.done)}>
                  {s.done && <span style={{ fontSize: 9, color: '#fff' }}>✓</span>}
                </div>
                <span style={{ flex: 1, fontSize: 13, color: '#333', textDecoration: s.done ? 'line-through' : 'none' }}>{s.text}</span>
                <button onClick={() => deleteSub(s.id)} style={smallDelBtnStyle}><span style={{ fontSize: 16 }}>×</span></button>
              </div>
              {s.memo && (
                <div style={{ padding: '6px 10px 8px', borderTop: '0.5px solid #eee', fontSize: 12, color: '#666', lineHeight: 1.5, background: '#fafafa', display: 'flex', alignItems: 'flex-start', gap: 5 }}>
                  <span style={{ fontSize: 11, color: '#aaa' }}>📝</span>{s.memo}
                </div>
              )}
            </div>
          ))}
        </div>

        {showAdd ? (
          <div style={{ border: '1px solid #ddd', borderRadius: 8, background: '#fff', overflow: 'hidden' }}>
            <input value={newText} onChange={e => setNewText(e.target.value)} placeholder="サブタスク名を入力..." style={{ width: '100%', fontSize: 16, padding: '8px 10px', border: 'none', outline: 'none', fontFamily: 'inherit' }} autoFocus />
            <textarea value={newMemo} onChange={e => setNewMemo(e.target.value)} rows={2} placeholder="メモ（任意）" style={{ width: '100%', fontSize: 16, padding: '6px 10px 8px', border: 'none', borderTop: '0.5px solid #eee', outline: 'none', fontFamily: 'inherit', resize: 'none', color: '#555', background: '#fafafa' }} />
            <div style={{ display: 'flex', gap: 8, padding: '8px 10px', borderTop: '0.5px solid #eee', background: '#fafafa' }}>
              <button onClick={addSub} style={tinySaveBtnStyle}>追加する</button>
              <button onClick={() => setShowAdd(false)} style={tinyCancelBtnStyle}>キャンセル</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setShowAdd(true)} style={addTriggerStyle}><span style={{ fontSize: 13 }}>+</span> サブタスクを追加</button>
        )}

        <button onClick={onClose} style={closeBtnStyle}>閉じる</button>
      </div>
    </div>
  )
}

const overlayStyle: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }
const modalStyle: React.CSSProperties = { background: '#fff', borderRadius: 12, padding: 20, display: 'flex', flexDirection: 'column', gap: 14, width: 360, maxHeight: '85vh', overflowY: 'auto' }
const xBtnStyle: React.CSSProperties = { background: '#444', border: 'none', cursor: 'pointer', color: '#fff', fontSize: 14, width: 26, height: 26, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }
const subItemStyle: React.CSSProperties = { background: '#f5f5f5', borderRadius: 8, border: '0.5px solid #eee', overflow: 'hidden' }
const smallDelBtnStyle: React.CSSProperties = { width: 28, height: 28, borderRadius: '50%', border: 'none', background: 'transparent', color: '#ccc', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 16 }
const tinySaveBtnStyle: React.CSSProperties = { padding: '5px 14px', fontSize: 12, border: 'none', borderRadius: 6, background: '#444', color: '#fff', cursor: 'pointer' }
const tinyCancelBtnStyle: React.CSSProperties = { padding: '5px 10px', fontSize: 12, border: '1px solid rgba(0,0,0,0.15)', borderRadius: 6, background: 'transparent', color: 'rgba(0,0,0,0.3)', cursor: 'pointer' }
const addTriggerStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 13, color: '#888', padding: 8, border: '1px dashed #ddd', borderRadius: 8, cursor: 'pointer', background: 'transparent', width: '100%' }
const closeBtnStyle: React.CSSProperties = { padding: '9px 0', fontSize: 13, border: 'none', borderRadius: 8, background: '#444', color: '#fff', cursor: 'pointer', width: '100%' }

function chkStyle(done: boolean): React.CSSProperties {
  return {
    width: 16, height: 16, borderRadius: '50%',
    border: done ? '1.5px solid #444' : '1.5px dashed #ccc',
    background: done ? '#444' : 'transparent',
    flexShrink: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
  }
}
