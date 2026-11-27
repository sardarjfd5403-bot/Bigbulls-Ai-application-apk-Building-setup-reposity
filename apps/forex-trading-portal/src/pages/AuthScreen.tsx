import { useState } from 'react';
import { supabase } from '../lib/supabase';
import Logo from '../components/Logo';

export default function AuthScreen() {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [canResend, setCanResend] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setError(''); setMessage('');
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) {
          if (/email not confirmed/i.test(error.message)) {
            setCanResend(true);
            throw new Error('Please confirm your email from the BIGBULLS verification email before signing in.');
          }
          throw error;
        }
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: 'https://bigbullsglobalmarket.is-an.ai/auth.html?mode=login&verified=1',
            data: { full_name: fullName.trim(), name: fullName.trim() },
          },
        });
        if (error) throw error;
        setCanResend(true);
        setMessage('Registration received. BIGBULLS has requested an email confirmation. Open your inbox, press Confirm Email, then return here and sign in.');
        if (data.session) await supabase.auth.signOut();
      }
    } catch (e) { setError(e instanceof Error ? e.message : 'Authentication failed.'); }
    finally { setBusy(false); }
  };
  const resendConfirmation = async () => {
    if (!email.trim()) { setError('Enter your email address first.'); return; }
    setBusy(true); setError(''); setMessage('');
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email.trim(),
        options: { emailRedirectTo: 'https://bigbullsglobalmarket.is-an.ai/auth.html?mode=login&verified=1' },
      });
      if (error) throw error;
      setMessage('A fresh BIGBULLS confirmation email has been requested. Check your inbox and spam folder.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not resend confirmation email.'); }
    finally { setBusy(false); }
  };
  const reset = async () => {
    if (!email.trim()) { setError('Enter your email address first.'); return; }
    setBusy(true); setError(''); setMessage('');
    try { const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: 'https://bigbullsglobalmarket.is-an.ai/auth.html?mode=reset' }); if (error) throw error; setMessage('Password reset link sent. Open the email on this device, tap Reset Password, set a new password on the secure BIGBULLS page, then return here and sign in.'); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not send reset email.'); }
    finally { setBusy(false); }
  };
  return <div className="min-h-screen bg-background px-4 py-10">
    <div className="mx-auto flex min-h-[80vh] max-w-md flex-col justify-center">
      <div className="mb-8 flex justify-center"><Logo /></div>
      <div className="rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
        <div className="mb-6"><h1 className="text-2xl font-extrabold">{mode === 'login' ? 'Welcome back' : 'Create your BIGBULLS account'}</h1><p className="mt-1 text-sm text-muted-foreground">Secure access to your BIGBULLS client portal</p></div>
        <form onSubmit={submit} className="space-y-4">
          {mode === 'signup' && <label className="block text-sm font-semibold">Full name<input required value={fullName} onChange={e=>setFullName(e.target.value)} className="mt-1 h-11 w-full rounded-lg border bg-background px-3" autoComplete="name" /></label>}
          <label className="block text-sm font-semibold">Email address<input required type="email" value={email} onChange={e=>setEmail(e.target.value)} className="mt-1 h-11 w-full rounded-lg border bg-background px-3" autoComplete="email" /></label>
          <label className="block text-sm font-semibold">Password<input required minLength={8} type="password" value={password} onChange={e=>setPassword(e.target.value)} className="mt-1 h-11 w-full rounded-lg border bg-background px-3" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} /></label>
          {error && <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
          {message && <p className="rounded-lg bg-accent p-3 text-sm">{message}</p>}
          {canResend && <button type="button" onClick={resendConfirmation} disabled={busy} className="w-full text-sm font-semibold text-primary disabled:opacity-50">{busy ? 'Please wait…' : 'Resend confirmation email'}</button>}
          <button disabled={busy} className="h-11 w-full rounded-lg bg-primary font-bold text-primary-foreground disabled:opacity-60">{busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}</button>
        </form>
        {mode === 'login' && <button onClick={reset} disabled={busy} className="mt-4 w-full text-sm font-semibold text-primary">Forgot password?</button>}
        <div className="mt-6 border-t pt-5 text-center text-sm text-muted-foreground">{mode === 'login' ? "Don't have an account?" : 'Already registered?'} <button onClick={()=>{setMode(mode === 'login' ? 'signup' : 'login');setError('');setMessage('');setCanResend(false);}} className="font-bold text-primary">{mode === 'login' ? 'Create account' : 'Sign in'}</button></div>
      </div>
      <p className="mt-5 text-center text-xs text-muted-foreground">Your account is protected by BIGBULLS security.</p>
    </div>
  </div>;
}
