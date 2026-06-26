'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'

export default function LoginScreen() {
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  async function handleGoogleLogin() {
    setError('')
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
    if (error) setError(error.message)
  }

  async function handleEmailAuth(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setMessage('')
    setLoading(true)
    if (mode === 'signin') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message)
      else window.location.reload()
    } else {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) setError(error.message)
      else setMessage('確認メールを送信しました。メール内のリンクをクリックして登録を完了してください。')
    }
    setLoading(false)
  }

  return (
    <div style={wrapStyle}>
      <div style={cardStyle}>
        <div style={{ fontSize: 20, fontWeight: 600, color: '#222', textAlign: 'center', marginBottom: 4 }}>
          Todo Tree
        </div>
        <div style={{ fontSize: 13, color: '#888', textAlign: 'center', marginBottom: 12 }}>
          {mode === 'signin' ? 'ログイン' : '新規登録'}
        </div>

        <button onClick={handleGoogleLogin} style={googleBtnStyle}>
          <span style={{ fontSize: 16 }}>G</span> Googleでログイン
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '4px 0' }}>
          <div style={{ flex: 1, height: 1, background: '#eee' }} />
          <span style={{ fontSize: 11, color: '#aaa' }}>または</span>
          <div style={{ flex: 1, height: 1, background: '#eee' }} />
        </div>

        <form onSubmit={handleEmailAuth} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="メールアドレス"
            style={inputStyle}
            required
          />
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="パスワード"
            style={inputStyle}
            required
            minLength={6}
          />
          {error && <div style={{ fontSize: 12, color: '#E24B4A' }}>{error}</div>}
          {message && <div style={{ fontSize: 12, color: '#2e7d4f' }}>{message}</div>}
          <button type="submit" disabled={loading} style={submitBtnStyle}>
            {loading ? '処理中...' : mode === 'signin' ? 'ログイン' : '新規登録'}
          </button>
        </form>

        <button
          onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(''); setMessage('') }}
          style={switchModeBtnStyle}
        >
          {mode === 'signin' ? 'アカウントを作成する' : 'すでにアカウントをお持ちですか？ログイン'}
        </button>
      </div>
    </div>
  )
}

const wrapStyle: React.CSSProperties = { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f0f0', padding: 16 }
const cardStyle: React.CSSProperties = { width: '100%', maxWidth: 360, background: '#fff', borderRadius: 16, padding: 24, display: 'flex', flexDirection: 'column', gap: 14, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }
const googleBtnStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '11px 0', fontSize: 14, border: '1px solid #ddd', borderRadius: 8, background: '#fff', color: '#444', cursor: 'pointer' }
const inputStyle: React.CSSProperties = { fontSize: 16, padding: '10px 12px', border: '1px solid #ddd', borderRadius: 8, background: '#fafafa', color: '#333', outline: 'none', fontFamily: 'inherit' }
const submitBtnStyle: React.CSSProperties = { padding: '11px 0', fontSize: 14, border: 'none', borderRadius: 8, background: '#444', color: '#fff', cursor: 'pointer' }
const switchModeBtnStyle: React.CSSProperties = { fontSize: 12, color: '#888', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'center', padding: 4 }
