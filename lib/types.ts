export type SubTask = {
  id: number
  task_id: number
  text: string
  memo: string
  done: boolean
}

export type Issue = {
  id: number
  task_id: number
  text: string
  memo: string
  done: boolean
}

export type Task = {
  id: number
  text: string
  memo: string
  done: boolean
  done_at: string | null
  prio: number
  task_date: string
  carry_from: string | null
  carry_reason: string | null
  subtasks: SubTask[]
  issues: Issue[]
}
