'use client'

import { useState } from 'react'
import type { Task } from '@/lib/types'
import type { SupabaseClient } from '@supabase/supabase-js'

const monthNames = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月']

type Props = {
  task: Task
  currentDateKey: string
  onClose: () => void
  onRefresh: () => Promise<void>
  supabase: SupabaseClient
}

function pad(n: number) { return String(n).padStart(2, '0') }
function dateKey(y: number, m: number, d: number) { return `${y}-${pad(m + 1)}-${pad(d)}` }
function daysInMonth(y: number, m: number) { return new Date(y, m + 1, 0).getDate() }
function firstWeekday(y: number, m: number) { return new Date(y, m, 1).getDay() }

export default function CarryModal({ task, currentDateKey, onClose, onRefresh, supabase }: Props) {
  const [y0, m0, d0] = currentDateKey.split('-').map(Number)
  const [viewYear, setViewYear] = useState(y0)
  const [viewMonth, setViewMonth] = useState(m0 - 1)
  const [chosen, setChosen] = useState<{ y: number; m: number; d: number }>({ y: y0, m: m0 - 1, d: d0 })
  const [reason, setReason] = useState('')

  const days = daysInMonth(viewYear, viewMonth)
  const startDow = firstWeekday(viewYear, viewMonth)
  const today = new Date()

  async function execCarry() {
    const targetKey = dateKey(chosen.y, chosen.m, chosen.d)
    const [oy, om, od] = currentDateKey.split('-').map(Number)
    const fromLabel = `${monthNames[om - 1]}${od}日`

    // 移動先の既存タスクの優先度を1つずつ後ろにずらす
    const { data: targetTasks } = await supabase.from('tasks').select('id, prio, done').eq('task_date', targetKey)
    for (const t of (targetTasks ?? [])) {
      if (!t.done) {
        await supabase.from('tasks').update({ prio: t.prio + 1 }).eq('id', t.id)
      }
    }

    await supabase.from('tasks').update({
      task_date: targetKey,
      prio: 1,
      carry_from: fromLabel,
      carry_reason: reason.trim() || null,
    }).eq('id', task.id)

    await onRefresh()
    onClose()
  }

  return (
    <div style={overlayStyle} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={modalStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 15, fontWeight: 500 }}>繰り越す</span>
          <button onClick={onClose} style={xBtnStyle}><span >×</span></button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <label style={{ fontSize: 12, color: '#888' }}>繰り越し先の日付</label>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
            <button onClick={() => { if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) } else setViewMonth(m => m - 1) }} style={navBtnStyle}>
              <span >‹</span>
            </button>
            <span style={{ fontSize: 13, fontWeight: 500 }}>{viewYear}年{monthNames[viewMonth]}</span>
            <button onClick={() => { if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) } else setViewMonth(m => m + 1) }} style={navBtnStyle}>
              <span >›</span>
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2 }}>
            {['日','月','火','水','木','金','土'].map(d => (
              <div key={d} style={{ fontSize: 10, color: '#aaa', textAlign: 'center', padding: '3px 0' }}>{d}</div>
            ))}
            {Array.from({ length: startDow }).map((_, i) => <div key={`e${i}`} />)}
            {Array.from({ length: days }, (_, i) => i + 1).map(d => {
              const isToday = viewYear === today.getFullYear() && viewMonth === today.getMonth() && d === today.getDate()
              const isChosen = chosen.y === viewYear && chosen.m === viewMonth && chosen.d === d
              return (
                <div
                  key={d}
                  onClick={() => setChosen({ y: viewYear, m: viewMonth, d })}
                  style={{
                    fontSize: 12, textAlign: 'center', padding: '6px 2px', cursor: 'pointer', borderRadius: 6,
                    color: isChosen ? '#fff' : isToday ? '#444' : '#333',
                    fontWeight: isToday ? 600 : 400,
                    background: isChosen ? '#444' : 'transparent',
                    width: isChosen ? 26 : undefined, height: isChosen ? 26 : undefined,
                    display: isChosen ? 'flex' : 'block', alignItems: 'center', justifyContent: 'center', margin: isChosen ? 'auto' : undefined,
                  }}
                >
                  {d}
                </div>
              )
            })}
          </div>
        </div>

        <div style={{ fontSize: 12, color: '#888', textAlign: 'center' }}>
          <span style={{ fontSize: 12 }} >📅</span> {chosen.y}年{monthNames[chosen.m]}{chosen.d}日 に繰り越します
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <label style={{ fontSize: 12, color: '#888' }}>未完了の理由（任意）</label>
          <textarea value={reason} onChange={e => setReason(e.target.value)} rows={2} placeholder="例：資料が揃わなかった" style={inputStyle} />
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={execCarry} style={saveBtnStyle}>繰り越す</button>
          <button onClick={onClose} style={cancelBtnStyle}>キャンセル</button>
        </div>
      </div>
    </div>
  )
}

const overlayStyle: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }
const modalStyle: React.CSSProperties = { background: '#fff', borderRadius: 12, padding: 20, display: 'flex', flexDirection: 'column', gap: 14, width: 300 }
const xBtnStyle: React.CSSProperties = { background: '#444', border: 'none', cursor: 'pointer', color: '#fff', fontSize: 14, width: 26, height: 26, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }
const navBtnStyle: React.CSSProperties = { background: 'transparent', border: 'none', cursor: 'pointer', color: '#444', fontSize: 14, padding: '2px 6px' }
const inputStyle: React.CSSProperties = { fontSize: 14, padding: '8px 10px', border: '1px solid #ddd', borderRadius: 8, background: '#fafafa', color: '#333', outline: 'none', fontFamily: 'inherit', resize: 'none' }
const saveBtnStyle: React.CSSProperties = { flex: 2, padding: '9px 0', fontSize: 13, border: 'none', borderRadius: 8, background: '#444', color: '#fff', cursor: 'pointer' }
const cancelBtnStyle: React.CSSProperties = { flex: 1, padding: '9px 0', fontSize: 13, border: '1.5px solid rgba(0,0,0,0.15)', borderRadius: 8, background: 'transparent', color: 'rgba(0,0,0,0.3)', cursor: 'pointer' }
