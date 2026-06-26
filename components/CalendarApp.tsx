'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import type { Task } from '@/lib/types'
import TaskScreen from '@/components/TaskScreen'

const monthNames = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月']
const dowNames = ['日','月','火','水','木','金','土']

function pad(n: number) { return String(n).padStart(2, '0') }
function dateKey(y: number, m: number, d: number) { return `${y}-${pad(m + 1)}-${pad(d)}` }

export default function CalendarApp({ initialTasks, userId, userEmail }: { initialTasks: Task[]; userId: string; userEmail: string }) {
  const supabase = createClient()
  const today = new Date()

  const [tasks, setTasks] = useState<Task[]>(initialTasks)
  const [screen, setScreen] = useState<'calendar' | 'task'>('calendar')
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())
  const [selectedDate, setSelectedDate] = useState<{ y: number; m: number; d: number } | null>(null)

  function daysInMonth(y: number, m: number) { return new Date(y, m + 1, 0).getDate() }
  function firstWeekday(y: number, m: number) { return new Date(y, m, 1).getDay() }

  function taskCountForDate(key: string) {
    return tasks.filter(t => t.task_date === key && !t.done).length
  }

  function goToTaskScreen(y: number, m: number, d: number) {
    setSelectedDate({ y, m, d })
    setScreen('task')
  }

  function backToCalendar() {
    setScreen('calendar')
  }

  function goToAdjacentDate(offset: number) {
    if (!selectedDate) return
    const d = new Date(selectedDate.y, selectedDate.m, selectedDate.d)
    d.setDate(d.getDate() + offset)
    setSelectedDate({ y: d.getFullYear(), m: d.getMonth(), d: d.getDate() })
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    window.location.reload()
  }

  async function refreshTasks() {
    const { data: tasksData } = await supabase.from('tasks').select('*').eq('user_id', userId).order('prio', { ascending: true })
    const { data: subtasksData } = await supabase.from('subtasks').select('*')
    const { data: issuesData } = await supabase.from('issues').select('*')
    const merged = (tasksData ?? []).map(t => ({
      ...t,
      subtasks: (subtasksData ?? []).filter(s => s.task_id === t.id),
      issues: (issuesData ?? []).filter(i => i.task_id === t.id),
    }))
    setTasks(merged as Task[])
  }

  const days = daysInMonth(viewYear, viewMonth)
  const startDow = firstWeekday(viewYear, viewMonth)
  const cells: (number | null)[] = [...Array(startDow).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)]

  if (screen === 'task' && selectedDate) {
    const key = dateKey(selectedDate.y, selectedDate.m, selectedDate.d)
    const dow = dowNames[new Date(selectedDate.y, selectedDate.m, selectedDate.d).getDay()]
    return (
      <TaskScreen
        dateKey={key}
        dateLabel={`${monthNames[selectedDate.m]}${selectedDate.d}日（${dow}）`}
        tasks={tasks.filter(t => t.task_date === key)}
        userId={userId}
        onBack={backToCalendar}
        onPrevDay={() => goToAdjacentDate(-1)}
        onNextDay={() => goToAdjacentDate(1)}
        onRefresh={refreshTasks}
        supabase={supabase}
      />
    )
  }

  return (
    <div style={{ padding: 32, maxWidth: 640, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <span style={{ fontSize: 12, color: '#999' }}>{userEmail}</span>
        <button onClick={handleLogout} style={logoutBtnStyle}>ログアウト</button>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <button
          onClick={() => setViewMonth(m => { if (m === 0) { setViewYear(y => y - 1); return 11 } return m - 1 })}
          style={navBtnStyle}
        >
          <span >‹</span>
        </button>
        <span style={{ fontSize: 22, fontWeight: 600 }}>{viewYear}年{monthNames[viewMonth]}</span>
        <button
          onClick={() => setViewMonth(m => { if (m === 11) { setViewYear(y => y + 1); return 0 } return m + 1 })}
          style={navBtnStyle}
        >
          <span >›</span>
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 8 }}>
        {dowNames.map(d => (
          <div key={d} style={{ fontSize: 13, color: '#aaa', textAlign: 'center', padding: '6px 0', fontWeight: 500 }}>{d}</div>
        ))}
        {cells.map((d, i) => {
          if (d === null) return <div key={i} />
          const key = dateKey(viewYear, viewMonth, d)
          const count = taskCountForDate(key)
          const isToday = viewYear === today.getFullYear() && viewMonth === today.getMonth() && d === today.getDate()
          return (
            <div
              key={i}
              onClick={() => goToTaskScreen(viewYear, viewMonth, d)}
              style={{
                fontSize: 16, textAlign: 'center', padding: '16px 4px', cursor: 'pointer', color: '#333',
                position: 'relative', borderRadius: 10, minHeight: 64,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', gap: 4,
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#f5f5f5')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <span style={isToday ? {
                background: '#444', color: '#fff', borderRadius: '50%',
                width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
              } : {}}>{d}</span>
              {count > 0 && (
                <>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#E24B4A' }} />
                  <span style={{ fontSize: 9, color: '#aaa' }}>{count}件</span>
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

const navBtnStyle: React.CSSProperties = {
  background: '#f0f0f0', border: 'none', cursor: 'pointer', color: '#444',
  fontSize: 18, padding: '8px 12px', borderRadius: 8,
}

const logoutBtnStyle: React.CSSProperties = {
  fontSize: 12, padding: '4px 10px', border: '1px solid #ddd', borderRadius: 8,
  background: 'transparent', color: '#888', cursor: 'pointer',
}
