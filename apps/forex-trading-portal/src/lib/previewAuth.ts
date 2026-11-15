import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from './supabase';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (alive) { setUser(data.session?.user ?? null); setLoading(false); }
    }).catch(() => { if (alive) setLoading(false); });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });
    return () => { alive = false; listener.subscription.unsubscribe(); };
  }, []);
  return { user: user ? { ...user, name: String(user.user_metadata?.full_name || user.user_metadata?.name || user.email || 'BIGBULLS Client') } : null, isLoading };
}

export function loginWithRedirect() {}
export async function logout() { await supabase.auth.signOut(); }

export function useLocalUpload() {
  const [isUploading, setIsUploading] = useState(false);
  const upload = async (file: File) => {
    setIsUploading(true);
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw userError || new Error('Please sign in again.');
      if (file.size < 100 * 1024 || file.size > 20 * 1024 * 1024) throw new Error('File size must be between 100 KB and 20 MB.');
      const ext = file.name.split('.').pop()?.toLowerCase() || 'bin';
      const path = user.id + '/' + crypto.randomUUID() + '.' + ext;
      const { error } = await supabase.storage.from('kyc-documents').upload(path, file, { upsert: false, contentType: file.type || 'application/octet-stream' });
      if (error) throw error;
      const { data, error: signedError } = await supabase.storage.from('kyc-documents').createSignedUrl(path, 3600);
      if (signedError) throw signedError;
      return { url: data.signedUrl, path };
    } finally { setIsUploading(false); }
  };
  return { upload, isUploading };
}
