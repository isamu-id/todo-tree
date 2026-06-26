import { createServerSupabase } from '@/lib/supabase-server'
import CalendarApp from '@/components/CalendarApp'
import LoginScreen from '@/components/LoginScreen'

export const dynamic = 'force-dynamic'

export default async function Home() {
  const supabase = createServerSupabase()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return <LoginScreen />
  }

  const { data: tasks, error: taskErr } = await supabase
    .from('tasks')
    .select('*')
    .eq('user_id', user.id)
    .order('prio', { ascending: true })

  const { data: subtasks, error: subErr } = await supabase
    .from('subtasks')
    .select('*')

  const { data: issues, error: issueErr } = await supabase
    .from('issues')
    .select('*')

  if (taskErr) console.error(taskErr)
  if (subErr) console.error(subErr)
  if (issueErr) console.error(issueErr)

  const tasksWithChildren = (tasks ?? []).map(t => ({
    ...t,
    subtasks: (subtasks ?? []).filter(s => s.task_id === t.id),
    issues: (issues ?? []).filter(i => i.task_id === t.id),
  }))

  return <CalendarApp initialTasks={tasksWithChildren} userId={user.id} userEmail={user.email ?? ''} />
}
