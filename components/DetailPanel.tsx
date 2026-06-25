'use client'

import { useState } from 'react'
import type { Task, SubTask, Issue } from '@/lib/types'
import type { SupabaseClient } from '@supabase/supabase-js'

type Props = {
  task: Task
  onClose: () => void
  onRefresh: () => Promise<void>
  supabase: SupabaseClient
}

export default function DetailPanel({ task, onClose, onRefresh, supabase }: Props) {
  const [editingMemo, setEditingMemo] = useState(false)
  const [memoDraft, setMemoDraft] = useState(task.memo)
  const [editingItem, setEditingItem] = useState<{ kind: 'sub' | 'issue'; id: number } | null>(null)
  const [itemNameDraft, setItemNameDraft] = useState('')
  const [itemMemoDraft, setItemMemoDraft] = useState('')
  const [showAddSub, setShowAddSub] = useState(false)
  const [showAddIssue, setShowAddIssue] = useState(false)
  const [newSubText, setNewSubText] = useState('')
  const [newSubMemo, setNewSubMemo] = useState('')
  const [newIssueText, setNewIssueText] = useState('')
  const [newIssueMemo, setNewIssueMemo] = useState('')

  async function checkAutoComplete() {
    const subsDone = task.subtasks.length === 0 || task.subtasks.every(s => s.done)
    const issuesDone = task.issues.length === 0 || task.issues.every(i => i.done)
    const hasAny = task.subtasks.length > 0 || task.issues.length > 0
    if (hasAny && subsDone && issuesDone && !task.done) {
      await supabase.from('tasks').update({ done: true, done_at: new Date().toTimeString().slice(0, 5) }).eq('id', task.id)
    }
  }

  async function saveMemo() {
    await supabase.from('tasks').update({ memo: memoDraft.trim() }).eq('id', task.id)
    setEditingMemo(false)
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

  function startEditItem(kind: 'sub' | 'issue', item: SubTask | Issue) {
    setEditingItem({ kind, id: item.id })
    setItemNameDraft(item.text)
    setItemMemoDraft(item.memo)
  }

  async function saveItem() {
    if (!editingItem) return
    const table = editingItem.kind === 'sub' ? 'subtasks' : 'issues'
    const updates: { text?: string; memo: string } = { memo: itemMemoDraft.trim() }
    if (itemNameDraft.trim()) updates.text = itemNameDraft.trim()
    await supabase.from(table).update(updates).eq('id', editingItem.id)
    setEditingItem(null)
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

  async function addSub() {
    if (!newSubText.trim()) return
    const { error } = await supabase.from('subtasks').insert({ task_id: task.id, text: newSubText.trim(), memo: newSubMemo.trim(), done: false })
    if (error) { alert('サブタスクの追加に失敗しました：' + error.message); return }
    setNewSubText(''); setNewSubMemo(''); setShowAddSub(false)
    await onRefresh()
  }

  async function addIssue() {
    if (!newIssueText.trim()) return
    const { error } = await supabase.from('issues').insert({ task_id: task.id, text: newIssueText.trim(), memo: newIssueMemo.trim(), done: false })
    if (error) { alert('課題の追加に失敗しました：' + error.message); return }
    setNewIssueText(''); setNewIssueMemo(''); setShowAddIssue(false)
    await onRefresh()
  }

  const subsDone = task.subtasks.length === 0 || task.subtasks.every(s => s.done)
  const issuesDone = task.issues.length === 0 || task.issues.every(i => i.done)
  const hasAny = task.subtasks.length > 0 || task.issues.length > 0
  const allDone = hasAny && subsDone && issuesDone

  function renderTreeSection(kind: 'sub' | 'issue', label: string, icon: string, list: (SubTask | Issue)[]) {
    const isAdding = kind === 'sub' ? showAddSub : showAddIssue
    return (
      <div>
        <div style={sLabelStyle}><i className={`ti ${icon}`} style={{ fontSize: 12 }} /> {label}{list.length > 0 ? `（${list.length}件）` : ''}</div>
        {list.length === 0 ? (
          <div style={{ fontSize: 12, color: '#ccc', padding: '0.5rem 0', marginLeft: 25 }}>{label}はありません</div>
        ) : (
          <div style={{ marginLeft: 9, borderLeft: '2px solid #eee', paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {list.map(item => {
              const isEditing = editingItem?.kind === kind && editingItem.id === item.id
              return (
                <div key={item.id} style={{ position: 'relative', background: '#f5f5f5', borderRadius: 8, overflow: 'hidden' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 9px' }}>
                    <div
                      onClick={() => kind === 'sub' ? toggleSub(item as SubTask) : toggleIssue(item as Issue)}
                      style={{
                        width: 14, height: 14, borderRadius: '50%',
                        border: item.done ? '1.5px solid #444' : '1.5px dashed #ccc',
                        background: item.done ? '#444' : 'transparent',
                        flexShrink: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      {item.done && <span style={{ fontSize: 8, color: '#fff' }} >✓</span>}
                    </div>
                    <span style={{ fontSize: 13, flex: 1, color: item.done ? '#aaa' : '#333', textDecoration: item.done ? 'line-through' : 'none' }}>
                      {item.text}
                    </span>
                    <button onClick={() => startEditItem(kind, item)} style={smallEditBtnStyle}>
                      <span style={{ fontSize: 9 }} >✎</span> 編集
                    </button>
                    <button onClick={() => kind === 'sub' ? deleteSub(item.id) : deleteIssue(item.id)} style={smallDelBtnStyle}>
                      <span style={{ fontSize: 11 }} >×</span>
                    </button>
                  </div>
                  {isEditing ? (
                    <div style={{ padding: '0 9px 8px 9px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div style={{ fontSize: 10, color: '#999', fontWeight: 500 }}>タスク名</div>
                      <input value={itemNameDraft} onChange={e => setItemNameDraft(e.target.value)} style={smallInputStyle} />
                      <div style={{ fontSize: 10, color: '#999', fontWeight: 500 }}>メモ</div>
                      <textarea value={itemMemoDraft} onChange={e => setItemMemoDraft(e.target.value)} rows={3} style={smallInputStyle} />
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={saveItem} style={tinySaveBtnStyle}>保存</button>
                        <button onClick={() => setEditingItem(null)} style={tinyCancelBtnStyle}>キャンセル</button>
                      </div>
                    </div>
                  ) : item.memo ? (
                    <div style={{ padding: '0 9px 8px 31px' }}>
                      <div style={{ fontSize: 12, color: '#555', lineHeight: 1.5, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                        <span style={memoChipStyle}><span style={{ fontSize: 9 }} >📝</span> メモ</span>
                        <span>{item.memo}</span>
                      </div>
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        )}

        {isAdding ? (
          <div key={`${kind}-add-form`} style={{ border: '1px solid #ddd', borderRadius: 8, background: '#fff', overflow: 'hidden', marginLeft: 25, marginTop: 6 }}>
            <input
              key={`${kind}-add-input`}
              value={kind === 'sub' ? newSubText : newIssueText}
              onChange={e => kind === 'sub' ? setNewSubText(e.target.value) : setNewIssueText(e.target.value)}
              placeholder={kind === 'sub' ? 'サブタスク名を入力...' : '課題を入力...'}
              style={{ width: '100%', fontSize: 16, padding: '8px 10px', border: 'none', outline: 'none', fontFamily: 'inherit' }}
              autoFocus
            />
            <textarea
              key={`${kind}-add-memo`}
              value={kind === 'sub' ? newSubMemo : newIssueMemo}
              onChange={e => kind === 'sub' ? setNewSubMemo(e.target.value) : setNewIssueMemo(e.target.value)}
              rows={2}
              placeholder="メモ（任意）"
              style={{ width: '100%', fontSize: 16, padding: '6px 10px 8px', border: 'none', borderTop: '0.5px solid #eee', outline: 'none', fontFamily: 'inherit', resize: 'none', color: '#555', background: '#fafafa' }}
            />
            <div style={{ display: 'flex', gap: 8, padding: '8px 10px', borderTop: '0.5px solid #eee', background: '#fafafa' }}>
              <button onClick={kind === 'sub' ? addSub : addIssue} style={tinySaveBtnStyle}>追加する</button>
              <button onClick={() => kind === 'sub' ? setShowAddSub(false) : setShowAddIssue(false)} style={tinyCancelBtnStyle}>キャンセル</button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => kind === 'sub' ? setShowAddSub(true) : setShowAddIssue(true)}
            style={addTriggerStyle}
          >
            <span style={{ fontSize: 13 }} >+</span> {kind === 'sub' ? 'サブタスクを追加' : '課題を追加'}
          </button>
        )}
      </div>
    )
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end', zIndex: 40 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ width: '80%', height: '100%', background: '#fff', borderLeft: '0.5px solid #eee', padding: 16, display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 14, fontWeight: 500, color: '#333', flex: 1, marginRight: 8 }}>{task.text}</span>
          <button onClick={onClose} style={xBtnStyle}><span >×</span></button>
        </div>

        {task.carry_from && (
          <div>
            <div style={sLabelStyle}><span style={{ fontSize: 12 }} >→</span> 繰り越し情報</div>
            <div style={{ padding: 10, background: '#FAEEDA', borderRadius: 8, borderLeft: '2px solid #BA7517', fontSize: 13, color: '#8a5a10', lineHeight: 1.6 }}>
              <div>繰り越し元：{task.carry_from}</div>
              {task.carry_reason && <div style={{ marginTop: 4 }}>理由：{task.carry_reason}</div>}
            </div>
          </div>
        )}

        <div>
          <div style={{ ...sLabelStyle, justifyContent: 'space-between' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ fontSize: 12 }} >📝</span> メモ</span>
            {!editingMemo && (
              <button onClick={() => { setEditingMemo(true); setMemoDraft(task.memo) }} style={editBtnStyle}>
                <span style={{ fontSize: 10 }} >✎</span> 編集
              </button>
            )}
          </div>
          {editingMemo ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <textarea value={memoDraft} onChange={e => setMemoDraft(e.target.value)} rows={4} style={textareaStyle} autoFocus />
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={saveMemo} style={memoSaveBtnStyle}>保存する</button>
                <button onClick={() => setEditingMemo(false)} style={memoCancelBtnStyle}>キャンセル</button>
              </div>
            </div>
          ) : task.memo ? (
            <div style={memoBoxStyle}>{task.memo}</div>
          ) : (
            <div style={{ fontSize: 13, color: '#ccc', fontStyle: 'italic' }}>メモはありません</div>
          )}
        </div>

        <div key="sub-section">{renderTreeSection('sub', '分割タスク', 'ti-list-details', task.subtasks)}</div>
        <div key="issue-section">{renderTreeSection('issue', '課題', 'ti-alert-triangle', task.issues)}</div>

        {allDone && (
          <div style={{ background: '#f0f0f0', borderRadius: 8, padding: '10px 12px', fontSize: 12, color: '#888', display: 'flex', alignItems: 'center', gap: 6, marginLeft: 25 }}>
            <span style={{ fontSize: 14 }} >✓</span> すべて完了！親タスクも完了済みに移動しました
          </div>
        )}
      </div>
    </div>
  )
}

const xBtnStyle: React.CSSProperties = { background: '#444', border: 'none', cursor: 'pointer', color: '#fff', fontSize: 14, width: 26, height: 26, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }
const sLabelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 500, color: '#888', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }
const editBtnStyle: React.CSSProperties = { fontSize: 11, padding: '3px 9px', borderRadius: 6, border: '1px solid #444', background: 'transparent', color: '#444', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }
const textareaStyle: React.CSSProperties = { width: '100%', fontSize: 16, padding: '8px 10px', border: '1px solid #ddd', borderRadius: 8, background: '#fafafa', color: '#333', outline: 'none', fontFamily: 'inherit', resize: 'none' }
const memoSaveBtnStyle: React.CSSProperties = { padding: '7px 0', fontSize: 12, border: 'none', borderRadius: 8, background: '#444', color: '#fff', cursor: 'pointer', flex: 1 }
const memoCancelBtnStyle: React.CSSProperties = { padding: '7px 0', fontSize: 12, border: '1.5px solid rgba(0,0,0,0.15)', borderRadius: 8, background: 'transparent', color: 'rgba(0,0,0,0.3)', cursor: 'pointer', flex: 1 }
const memoBoxStyle: React.CSSProperties = { padding: 10, background: '#f5f5f5', borderRadius: 8, borderLeft: '2px solid #ccc', fontSize: 13, color: '#555', lineHeight: 1.6, whiteSpace: 'pre-wrap' }
const smallEditBtnStyle: React.CSSProperties = { fontSize: 10, padding: '2px 7px', borderRadius: 5, border: '1px solid #aaa', background: 'transparent', color: '#888', cursor: 'pointer', flexShrink: 0 }
const smallDelBtnStyle: React.CSSProperties = { width: 20, height: 20, borderRadius: '50%', border: 'none', background: 'transparent', color: '#ccc', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }
const smallInputStyle: React.CSSProperties = { width: '100%', fontSize: 16, padding: '6px 8px', border: '1px solid #ddd', borderRadius: 6, background: '#fff', color: '#333', outline: 'none', fontFamily: 'inherit', resize: 'none' }
const tinySaveBtnStyle: React.CSSProperties = { padding: '4px 10px', fontSize: 11, border: 'none', borderRadius: 6, background: '#444', color: '#fff', cursor: 'pointer' }
const tinyCancelBtnStyle: React.CSSProperties = { padding: '4px 10px', fontSize: 11, border: '1px solid rgba(0,0,0,0.15)', borderRadius: 6, background: 'transparent', color: 'rgba(0,0,0,0.3)', cursor: 'pointer' }
const memoChipStyle: React.CSSProperties = { fontSize: 10, padding: '2px 8px', borderRadius: 10, background: '#eee', color: '#777', display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0, fontWeight: 500, marginTop: 1 }
const addTriggerStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 13, color: '#888', padding: 8, border: '1px dashed #ddd', borderRadius: 8, cursor: 'pointer', background: 'transparent', width: '100%', textAlign: 'center', marginLeft: 25, marginTop: 6 }
