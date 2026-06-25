'use client'

import { useState, useRef, useEffect } from 'react'
import type { Task } from '@/lib/types'
import type { SupabaseClient } from '@supabase/supabase-js'
import DetailPanel from './DetailPanel'
import TaskSummary from './TaskSummary'
import SplitModal from './SplitModal'
import IssueModal from './IssueModal'
import CarryModal from './CarryModal'

type Props = {
  dateKey: string
  dateLabel: string
  tasks: Task[]
  onBack: () => void
  onPrevDay: () => void
  onNextDay: () => void
  onRefresh: () => Promise<void>
  supabase: SupabaseClient
}

export default function TaskScreen({ dateKey, dateLabel, tasks, onBack, onPrevDay, onNextDay, onRefresh, supabase }: Props) {
  const [tab, setTab] = useState<'todo' | 'done'>('todo')
  const [showAddModal, setShowAddModal] = useState(false)
  const [newText, setNewText] = useState('')
  const [newMemo, setNewMemo] = useState('')
  const [detailTaskId, setDetailTaskId] = useState<number | null>(null)
  const [editTaskId, setEditTaskId] = useState<number | null>(null)
  const [splitTaskId, setSplitTaskId] = useState<number | null>(null)
  const [issueTaskId, setIssueTaskId] = useState<number | null>(null)
  const [carryTaskId, setCarryTaskId] = useState<number | null>(null)
  const [draggingId, setDraggingId] = useState<number | null>(null)

  const dragState = useRef<{
    id: number
    startY: number
    dragging: boolean
    origTop: number
    rowHeight: number
    order: number[]
    currentOrder: number[]
  } | null>(null)
  const listRef = useRef<HTMLDivElement | null>(null)

  const todoTasks = tasks.filter(t => !t.done).sort((a, b) => a.prio - b.prio)
  const doneTasks = tasks.filter(t => t.done)
  const detailTask = tasks.find(t => t.id === detailTaskId) ?? null
  const editTask = tasks.find(t => t.id === editTaskId) ?? null
  const splitTask = tasks.find(t => t.id === splitTaskId) ?? null
  const issueTask = tasks.find(t => t.id === issueTaskId) ?? null
  const carryTask = tasks.find(t => t.id === carryTaskId) ?? null

  // マウス・タッチ操作中はdocument全体でドラッグの移動・終了を検知する
  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!dragState.current) return
      moveDrag(e.clientY)
    }
    function onMouseUp() {
      if (!dragState.current) return
      endDrag()
    }
    function onTouchMove(e: TouchEvent) {
      if (!dragState.current) return
      const t = e.touches[0]
      moveDrag(t.clientY)
      if (dragState.current?.dragging) e.preventDefault()
    }
    function onTouchEnd() {
      if (!dragState.current) return
      endDrag()
    }
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
    document.addEventListener('touchmove', onTouchMove, { passive: false })
    document.addEventListener('touchend', onTouchEnd)
    return () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
      document.removeEventListener('touchmove', onTouchMove)
      document.removeEventListener('touchend', onTouchEnd)
    }
  }, [todoTasks])

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
    const remaining = todoTasks.filter(t => t.id !== id)
    for (let i = 0; i < remaining.length; i++) {
      if (remaining[i].prio !== i + 1) {
        await supabase.from('tasks').update({ prio: i + 1 }).eq('id', remaining[i].id)
      }
    }
    await onRefresh()
  }

  function getRows(): HTMLElement[] {
    const container = listRef.current
    if (!container) return []
    return Array.from(container.querySelectorAll<HTMLElement>('[data-task-id]'))
  }

  function startDrag(clientY: number, id: number) {
    const rows = getRows()
    const order = todoTasks.map(t => t.id)
    const row = rows.find(r => Number(r.dataset.taskId) === id)
    if (!row) return
    dragState.current = {
      id, startY: clientY, dragging: false,
      origTop: row.offsetTop, rowHeight: row.offsetHeight, order, currentOrder: order,
    }
  }

  function moveDrag(clientY: number) {
    const ds = dragState.current
    if (!ds) return
    const dy = clientY - ds.startY
    if (!ds.dragging && Math.abs(dy) > 6) {
      ds.dragging = true
      setDraggingId(ds.id)
    }
    if (!ds.dragging) return

    const rows = getRows()
    const dragRow = rows.find(r => Number(r.dataset.taskId) === ds.id)
    if (!dragRow) return
    dragRow.style.transform = `translateY(${dy}px)`

    const dragIdx = ds.order.indexOf(ds.id)
    const step = ds.rowHeight + 8
    // ドラッグ開始位置から何行分動いたかを四捨五入で求める（上下対称）
    const stepsMoved = Math.round(dy / step)
    const targetIdx = Math.max(0, Math.min(ds.order.length - 1, dragIdx + stepsMoved))

    rows.forEach(row => {
      const id = Number(row.dataset.taskId)
      if (id === ds.id) return
      const rowIdx = ds.order.indexOf(id)
      let shift = 0
      if (rowIdx > dragIdx && rowIdx <= targetIdx) shift = -step
      else if (rowIdx < dragIdx && rowIdx >= targetIdx) shift = step
      row.style.transform = shift !== 0 ? `translateY(${shift}px)` : ''
    })

    const reordered = [...ds.order]
    reordered.splice(dragIdx, 1)
    reordered.splice(targetIdx, 0, ds.id)
    ds.currentOrder = reordered
  }

  async function endDrag() {
    const ds = dragState.current
    if (!ds) return
    dragState.current = null
    setDraggingId(null)

    const rows = getRows()
    rows.forEach(row => { row.style.transform = '' })

    if (ds.dragging) {
      const finalOrder: number[] = ds.currentOrder ?? ds.order
      if (finalOrder.join(',') !== ds.order.join(',')) {
        for (let i = 0; i < finalOrder.length; i++) {
          const task = todoTasks.find(t => t.id === finalOrder[i])
          if (task && task.prio !== i + 1) {
            await supabase.from('tasks').update({ prio: i + 1 }).eq('id', finalOrder[i])
          }
        }
        await onRefresh()
      }
    } else {
      setDetailTaskId(ds.id)
    }
  }

  function handleMouseDown(e: React.MouseEvent, id: number) {
    if ((e.target as HTMLElement).closest('button,[data-chk]')) return
    startDrag(e.clientY, id)
  }

  function handleTouchStart(e: React.TouchEvent, id: number) {
    if ((e.target as HTMLElement).closest('button,[data-chk]')) return
    const t = e.touches[0]
    startDrag(t.clientY, id)
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button onClick={onPrevDay} style={dateNavBtnStyle}><span>«</span></button>
              <span style={{ fontSize: 16, fontWeight: 500 }}>{dateLabel}</span>
              <button onClick={onNextDay} style={dateNavBtnStyle}><span>»</span></button>
            </div>
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
                    onTouchStart={e => handleTouchStart(e, t.id)}
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
                        <div style={{ display: 'flex', gap: 16, marginTop: 10, justifyContent: 'center' }}>
                          <div style={squareBtnWrapStyle}>
                            <button onClick={e => { e.stopPropagation(); setSplitTaskId(t.id) }} style={squareBtnStyle}>
                              <span style={{ fontSize: 18 }}>▤</span>
                            </button>
                            <span style={squareBtnLabelStyle}>分割</span>
                          </div>
                          <div style={squareBtnWrapStyle}>
                            <button onClick={e => { e.stopPropagation(); setIssueTaskId(t.id) }} style={squareBtnStyle}>
                              <span style={{ fontSize: 18 }}>⚠</span>
                            </button>
                            <span style={squareBtnLabelStyle}>課題</span>
                          </div>
                          <div style={squareBtnWrapStyle}>
                            <button onClick={e => { e.stopPropagation(); setCarryTaskId(t.id) }} style={squareBtnStyle}>
                              <span style={{ fontSize: 18 }}>→</span>
                            </button>
                            <span style={squareBtnLabelStyle}>繰り越す</span>
                          </div>
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
        <TaskSummary
          task={detailTask}
          onClose={() => setDetailTaskId(null)}
          onEdit={() => { setEditTaskId(detailTask.id); setDetailTaskId(null) }}
          onRefresh={onRefresh}
          supabase={supabase}
        />
      )}

      {editTask && (
        <DetailPanel task={editTask} onClose={() => setEditTaskId(null)} onRefresh={onRefresh} supabase={supabase} />
      )}

      {splitTask && (
        <SplitModal task={splitTask} onClose={() => setSplitTaskId(null)} onRefresh={onRefresh} supabase={supabase} />
      )}

      {issueTask && (
        <IssueModal task={issueTask} onClose={() => setIssueTaskId(null)} onRefresh={onRefresh} supabase={supabase} />
      )}

      {carryTask && (
        <CarryModal task={carryTask} currentDateKey={dateKey} onClose={() => setCarryTaskId(null)} onRefresh={onRefresh} supabase={supabase} />
      )}
    </div>
  )
}

const backBtnStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, padding: '7px 12px', border: '1px solid #ddd', borderRadius: 8, background: 'transparent', color: '#444', cursor: 'pointer' }
const dateNavBtnStyle: React.CSSProperties = { background: '#fff', border: '1px solid #ddd', cursor: 'pointer', color: '#444', fontSize: 16, width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }
const addBtnStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, padding: '7px 14px', border: 'none', borderRadius: 8, background: '#444', color: '#fff', cursor: 'pointer' }
const tabBase: React.CSSProperties = { flex: 1, padding: '8px 0', fontSize: 13, cursor: 'pointer', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, border: 'none' }
const tabActiveStyle: React.CSSProperties = { ...tabBase, background: '#444', color: '#fff' }
const tabInactiveStyle: React.CSSProperties = { ...tabBase, background: 'transparent', color: 'rgba(0,0,0,0.3)', border: '1.5px solid rgba(0,0,0,0.15)' }
const tabCountActiveStyle: React.CSSProperties = { fontSize: 11, padding: '1px 7px', borderRadius: 10, background: '#444', color: '#fff', border: '1px solid rgba(255,255,255,0.4)' }
const tabCountInactiveStyle: React.CSSProperties = { fontSize: 11, padding: '1px 7px', borderRadius: 10, background: 'transparent', color: 'rgba(0,0,0,0.3)' }
const emptyStyle: React.CSSProperties = { textAlign: 'center', padding: '2rem', color: '#ccc', fontSize: 13 }

const delBtnStyle: React.CSSProperties = { width: 32, height: 32, borderRadius: '50%', border: 'none', background: 'transparent', color: '#ccc', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, marginLeft: 'auto', flexShrink: 0 }
const actionBtnStyle: React.CSSProperties = { fontSize: 13, padding: '8px 14px', borderRadius: 10, border: '1px solid #444', background: 'transparent', color: '#444', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }
const squareBtnWrapStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }
const squareBtnStyle: React.CSSProperties = { width: 48, height: 48, borderRadius: 12, border: '1px solid #444', background: 'transparent', color: '#444', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }
const squareBtnLabelStyle: React.CSSProperties = { fontSize: 10, color: '#888' }
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
