'use client'

import { useState, useRef, useLayoutEffect } from 'react'
import type { Task } from '@/lib/types'
import type { SupabaseClient } from '@supabase/supabase-js'
import DetailPanel from './DetailPanel'
import CarryModal from './CarryModal'

type Props = {
  dateKey: string
  dateLabel: string
  tasks: Task[]
  onBack: () => void
  onRefresh: () => Promise<void>
  supabase: SupabaseClient
}

export default function TaskScreen({ dateKey, dateLabel, tasks, onBack, onRefresh, supabase }: Props) {
  const [tab, setTab] = useState<'todo' | 'done'>('todo')
  const [showAddModal, setShowAddModal] = useState(false)
  const [newText, setNewText] = useState('')
  const [newMemo, setNewMemo] = useState('')
  const [detailTaskId, setDetailTaskId] = useState<number | null>(null)
  const [carryTaskId, setCarryTaskId] = useState<number | null>(null)
  const [draggingId, setDraggingId] = useState<number | null>(null)

  const dragState = useRef<{ id: number; startX: number; startY: number; dragging: boolean } | null>(null)
  const listRef = useRef<HTMLDivElement | null>(null)
  const prevRects = useRef<Map<number, DOMRect>>(new Map())
  const skipAnimRef = useRef(true)

  const todoTasks = tasks.filter(t => !t.done).sort((a, b) => a.prio - b.prio)
  const doneTasks = tasks.filter(t => t.done)
  const detailTask = tasks.find(t => t.id === detailTaskId) ?? null
  const carryTask = tasks.find(t => t.id === carryTaskId) ?? null

  // FLIPアニメーション: レンダー後に前回位置と比較してtransformで滑らかに移動
  useLayoutEffect(() => {
    const container = listRef.current
    if (!container) return
    const cards = Array.from(container.querySelectorAll<HTMLElement>('[data-task-id]'))

    if (!skipAnimRef.current) {
      cards.forEach(card => {
        const id = Number(card.dataset.taskId)
        if (id === draggingId) return
        const prevRect = prevRects.current.get(id)
        if (!prevRect) return
        const newRect = card.getBoundingClientRect()
        const dy = prevRect.top - newRect.top
        if (Math.abs(dy) > 0.5) {
          card.style.transform = `translateY(${dy}px)`
          card.style.transition = 'transform 0s'
          requestAnimationFrame(() => {
            card.style.transition = 'transform 0.25s cubic-bezier(.4,0,.2,1)'
            card.style.transform = 'translateY(0)'
            const clear = () => { card.style.transform = ''; card.style.transition = '' }
            card.addEventListener('transitionend', clear, { once: true })
          })
        }
      })
    }
    skipAnimRef.current = false

    const newMap = new Map<number, DOMRect>()
    cards.forEach(card => {
      newMap.set(Number(card.dataset.taskId), card.getBoundingClientRect())
    })
    prevRects.current = newMap
  }, [todoTasks.map(t => t.id).join(',')])

  async function addTask() {
    if (!newText.trim()) return
    const maxPrio = todoTasks.length + 1
    await supabase.from('tasks').insert({
      text: newText.trim(), memo: newMemo.trim(), done: false, prio: maxPrio, task_date: dateKey,
    })
    setNewText(''); setNewMemo(''); setShowAddModal(false)
    await onRefresh()
  }

  async function toggleTask(task: Task) {
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

  async function deleteTask(id: number) {
    if (!confirm('このタスクを削除しますか？分割タスクや課題も一緒に削除されます。')) return
    await supabase.from('tasks').delete().eq('id', id)
    await onRefresh()
  }

  function handleMouseDown(e: React.MouseEvent, id: number) {
    if ((e.target as HTMLElement).closest('button,[data-chk]')) return
    dragState.current = { id, startX: e.clientX, startY: e.clientY, dragging: false }
  }

  function handleMouseMove(e: React.MouseEvent) {
    const ds = dragState.current
    if (!ds) return
    const dx = Math.abs(e.clientX - ds.startX), dy = Math.abs(e.clientY - ds.startY)
    if (!ds.dragging && (dx > 6 || dy > 6)) {
      ds.dragging = true
      setDraggingId(ds.id)
    }
  }

  async function handleMouseUp(e: React.MouseEvent, targetId: number) {
    const ds = dragState.current
    if (!ds) return
    dragState.current = null
    setDraggingId(null)
    if (ds.dragging && ds.id !== targetId) {
      const srcIdx = todoTasks.findIndex(t => t.id === ds.id)
      const tgtIdx = todoTasks.findIndex(t => t.id === targetId)
      const reordered = [...todoTasks]
      const [moved] = reordered.splice(srcIdx, 1)
      const newTgtIdx = reordered.findIndex(t => t.id === targetId)
      reordered.splice(newTgtIdx + (srcIdx < tgtIdx ? 1 : 0), 0, moved)
      for (let i = 0; i < reordered.length; i++) {
        await supabase.from('tasks').update({ prio: i + 1 }).eq('id', reordered[i].id)
      }
      await onRefresh()
    } else if (!ds.dragging) {
      setDetailTaskId(targetId)
    }
  }

  return (
    <div style={{ minHeight: 640 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 20px', borderBottom: '0.5px solid #eee', background: '#fff' }}>
        <button onClick={onBack} style={backBtnStyle}>
          <span style={{ fontSize: 14 }}>←</span> カレンダーに戻る
        </button>
      </div>

      <div style={{ padding: 20, background: '#f0f0f0', minHeight: 560, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ width: '100%', maxWidth: 480 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: 16, fontWeight: 500 }}>{dateLabel}</span>
            <button onClick={() => setShowAddModal(true)} style={addBtnStyle}>
              <span style={{ fontSize: 14 }}>+</span> タスクを追加
            </button>
          </div>

          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            <button onClick={() => setTab('todo')} style={tab === 'todo' ? tabActiveStyle : tabInactiveStyle}>
              <span style={{ fontSize: 14 }}>☑</span> 未完了
              <span style={tab === 'todo' ? tabCountActiveStyle : tabCountInactiveStyle}>{todoTasks.length}</span>
            </button>
            <button onClick={() => setTab('done')} style={tab === 'done' ? tabActiveStyle : tabInactiveStyle}>
              <span style={{ fontSize: 14 }}>✓</span> 完了済み
              <span style={tab === 'done' ? tabCountActiveStyle : tabCountInactiveStyle}>{doneTasks.length}</span>
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {tab === 'todo' && todoTasks.length === 0 && <div style={emptyStyle}>未完了のタスクはありません</div>}
            <div ref={listRef} style={{ display: tab === 'todo' ? 'flex' : 'none', flexDirection: 'column', gap: 8 }}>
              {todoTasks.map(t => {
                const subCount = t.subtasks.length
                const subDone = t.subtasks.filter(s => s.done).length
                const cardClass = [
                  'task-card',
                  t.carry_from ? 'has-carry' : '',
                  draggingId === t.id ? 'is-dragging' : '',
                ].filter(Boolean).join(' ')
                return (
                  <div
                    key={t.id}
                    data-task-id={t.id}
                    className={cardClass}
                    style={{ cursor: 'grab' }}
                    onMouseDown={e => handleMouseDown(e, t.id)}
                    onMouseMove={handleMouseMove}
                    onMouseUp={e => handleMouseUp(e, t.id)}
                  >
                    <div style={{ display: 'flex' }}>
                      <div style={prioBoxStyle(t.prio)}>
                        <span style={{ fontSize: 18, fontWeight: 500 }}>{t.prio}</span>
                        <span style={{ fontSize: 8 }}>優先</span>
                      </div>
                      <div
                        data-chk
                        onClick={e => { e.stopPropagation(); toggleTask(t) }}
                        style={chkColStyle(false)}
                      >
                        <div style={chkCircleStyle(false)} />
                      </div>
                      <div style={{ flex: 1, padding: '10px 12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ flex: 1, fontSize: 14, color: '#333' }}>{t.text}</span>
                          {subCount > 0 && <span style={{ fontSize: 11, color: '#888' }}>{subDone}/{subCount}</span>}
                          {t.carry_from && (
                            <span style={carryBadgeStyle}><span style={{ fontSize: 10 }}>⏱</span> {t.carry_from}から</span>
                          )}
                          <button onClick={e => { e.stopPropagation(); deleteTask(t.id) }} style={delBtnStyle}>
                            <span>×</span>
                          </button>
                        </div>
                        <div style={{ display: 'flex', gap: 5, marginTop: 8, flexWrap: 'wrap' }}>
                          <button onClick={e => { e.stopPropagation(); setDetailTaskId(t.id) }} style={actionBtnStyle}>
                            <span style={{ fontSize: 11 }}>▤</span> 分割
                          </button>
                          <button onClick={e => { e.stopPropagation(); setDetailTaskId(t.id) }} style={actionBtnStyle}>
                            <span style={{ fontSize: 11 }}>⚠</span> 課題
                          </button>
                          <button onClick={e => { e.stopPropagation(); setCarryTaskId(t.id) }} style={actionBtnStyle}>
                            <span style={{ fontSize: 11 }}>→</span> 繰り越す
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {tab === 'done' && doneTasks.length === 0 && <div style={emptyStyle}>完了済みのタスクはありません</div>}
            {tab === 'done' && doneTasks.map(t => (
              <div key={t.id} className="task-card" style={{ opacity: 0.8, cursor: 'pointer' }} onClick={() => setDetailTaskId(t.id)}>
                <div style={{ display: 'flex' }}>
                  <div style={prioBoxStyle(t.prio, true)}>
                    <span style={{ fontSize: 18, fontWeight: 500, color: '#aaa' }}>{t.prio}</span>
                    <span style={{ fontSize: 8, color: '#aaa' }}>優先</span>
                  </div>
                  <div onClick={e => { e.stopPropagation(); toggleTask(t) }} style={chkColStyle(true)}>
                    <div style={chkCircleStyle(true)}>
                      <span style={{ fontSize: 14, color: '#fff' }}>✓</span>
                    </div>
                  </div>
                  <div style={{ flex: 1, padding: '10px 12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ flex: 1, fontSize: 14, color: '#aaa', textDecoration: 'line-through' }}>{t.text}</span>
                      <button onClick={e => { e.stopPropagation(); deleteTask(t.id) }} style={delBtnStyle}>
                        <span>×</span>
                      </button>
                    </div>
                    <div style={{ fontSize: 11, color: '#aaa', marginTop: 4 }}>
                      <span style={{ fontSize: 12 }}>✓</span> {t.done_at} に完了
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ fontSize: 11, color: '#aaa', textAlign: 'center', marginTop: 10 }}>
            <span style={{ fontSize: 12 }}>⇕</span> カードをドラッグして並び替え／クリックで詳細
          </div>
        </div>
      </div>

      {showAddModal && (
        <div style={overlayStyle} onClick={e => { if (e.target === e.currentTarget) setShowAddModal(false) }}>
          <div style={modalStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 15, fontWeight: 500 }}>タスクを追加</span>
              <button onClick={() => setShowAddModal(false)} style={xBtnStyle}><span>×</span></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <label style={{ fontSize: 12, color: '#888' }}>タスク名</label>
              <input value={newText} onChange={e => setNewText(e.target.value)} onKeyDown={e => e.key === 'Enter' && addTask()} placeholder="例：企画書を作成する" style={inputStyle} autoFocus />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <label style={{ fontSize: 12, color: '#888' }}>メモ（任意）</label>
              <textarea value={newMemo} onChange={e => setNewMemo(e.target.value)} rows={2} placeholder="補足があれば..." style={inputStyle} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={addTask} style={saveBtnStyle}>追加する</button>
              <button onClick={() => setShowAddModal(false)} style={cancelBtnStyle}>キャンセル</button>
            </div>
          </div>
        </div>
      )}

      {detailTask && (
        <DetailPanel task={detailTask} onClose={() => setDetailTaskId(null)} onRefresh={onRefresh} supabase={supabase} />
      )}

      {carryTask && (
        <CarryModal task={carryTask} currentDateKey={dateKey} onClose={() => setCarryTaskId(null)} onRefresh={onRefresh} supabase={supabase} />
      )}
    </div>
  )
}

const backBtnStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, padding: '7px 12px', border: '1px solid #ddd', borderRadius: 8, background: 'transparent', color: '#444', cursor: 'pointer' }
const addBtnStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, padding: '7px 14px', border: 'none', borderRadius: 8, background: '#444', color: '#fff', cursor: 'pointer' }
const tabBase: React.CSSProperties = { flex: 1, padding: '8px 0', fontSize: 13, cursor: 'pointer', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, border: 'none' }
const tabActiveStyle: React.CSSProperties = { ...tabBase, background: '#444', color: '#fff' }
const tabInactiveStyle: React.CSSProperties = { ...tabBase, background: 'transparent', color: 'rgba(0,0,0,0.3)', border: '1.5px solid rgba(0,0,0,0.15)' }
const tabCountActiveStyle: React.CSSProperties = { fontSize: 11, padding: '1px 7px', borderRadius: 10, background: '#444', color: '#fff', border: '1px solid rgba(255,255,255,0.4)' }
const tabCountInactiveStyle: React.CSSProperties = { fontSize: 11, padding: '1px 7px', borderRadius: 10, background: 'transparent', color: 'rgba(0,0,0,0.3)' }
const emptyStyle: React.CSSProperties = { textAlign: 'center', padding: '2rem', color: '#ccc', fontSize: 13 }

const delBtnStyle: React.CSSProperties = { width: 24, height: 24, borderRadius: '50%', border: 'none', background: 'transparent', color: '#ccc', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, marginLeft: 'auto', flexShrink: 0 }
const actionBtnStyle: React.CSSProperties = { fontSize: 11, padding: '3px 9px', borderRadius: 6, border: '1px solid #444', background: 'transparent', color: '#444', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }
const carryBadgeStyle: React.CSSProperties = { fontSize: 10, padding: '2px 7px', borderRadius: 10, background: '#FAEEDA', color: '#BA7517', display: 'flex', alignItems: 'center', gap: 3, whiteSpace: 'nowrap', flexShrink: 0 }
const overlayStyle: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }
const modalStyle: React.CSSProperties = { background: '#fff', borderRadius: 12, padding: 20, display: 'flex', flexDirection: 'column', gap: 14, width: 320 }
const xBtnStyle: React.CSSProperties = { background: '#444', border: 'none', cursor: 'pointer', color: '#fff', fontSize: 14, width: 26, height: 26, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }
const inputStyle: React.CSSProperties = { fontSize: 16, padding: '8px 10px', border: '1px solid #ddd', borderRadius: 8, background: '#fafafa', color: '#333', outline: 'none', fontFamily: 'inherit', resize: 'none' }
const saveBtnStyle: React.CSSProperties = { flex: 2, padding: '9px 0', fontSize: 13, border: 'none', borderRadius: 8, background: '#444', color: '#fff', cursor: 'pointer' }
const cancelBtnStyle: React.CSSProperties = { flex: 1, padding: '9px 0', fontSize: 13, border: '1.5px solid rgba(0,0,0,0.15)', borderRadius: 8, background: 'transparent', color: 'rgba(0,0,0,0.3)', cursor: 'pointer' }

function chkColStyle(done: boolean): React.CSSProperties {
  return {
    width: 44, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', background: done ? '#e6f4ea' : '#f0f0f0',
  }
}

function chkCircleStyle(done: boolean): React.CSSProperties {
  return {
    width: 22, height: 22, borderRadius: '50%',
    border: done ? '2px solid #2e7d4f' : '2px dashed #bbb',
    background: done ? '#2e7d4f' : 'transparent',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  }
}

function prioBoxStyle(prio: number, isDone = false): React.CSSProperties {
  const bg = isDone ? '#f0f0f0' : prio === 1 ? '#FCEBEB' : prio === 2 ? '#FAEEDA' : '#f0f0f0'
  const color = isDone ? '#aaa' : prio === 1 ? '#E24B4A' : prio === 2 ? '#BA7517' : '#888'
  return {
    width: 36, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    gap: 1, background: bg, color,
  }
}
