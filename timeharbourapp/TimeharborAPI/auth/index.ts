import { supabase } from '../core/supabase';
import { clearAuthStorage } from '../core/storage';

export const signUp = async (email: string, password: string, name: string) => {
  console.log('Signing up with:', { email, name });
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: name,
      },
    },
  });
  if (error) {
    console.error('Supabase SignUp Error Message:', error.message);
    console.error('Supabase SignUp Error Name:', error.name);
    // @ts-ignore
    console.error('Supabase SignUp Error Status:', error.status);
    console.error('Supabase SignUp Error Full:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
  } else {
    console.log('Supabase SignUp Success:', data);
  }
  return { data, error };
};

export const signIn = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  return { data, error };
};

export const signOut = async () => {
  console.log('Starting signOut process...');
  
  try {
    // First, attempt global signout (clears session from Supabase server)
    const { error } = await supabase.auth.signOut();
    
    if (error) {
      console.warn("Global signOut error, attempting local signout", error);
      // If global signout fails, force local signout
      await supabase.auth.signOut({ scope: 'local' });
    } else {
      console.log('Global signOut successful (204)');
    }
    
    // CRITICAL: Always clear local storage regardless of server response
    // This prevents session persistence on iOS after successful server logout
    console.log('Clearing local auth storage...');
    await clearAuthStorage();
    console.log('Local auth storage cleared');
    
    return { error: null };
  } catch (err) {
    console.error('SignOut error:', err);
    
    // Even if an error occurred, try to clear local storage
    try {
      await clearAuthStorage();
      console.log('Local auth storage cleared after error');
    } catch (storageError) {
      console.error('Failed to clear storage:', storageError);
    }
    
    return { error: err };
  }
};

export const getSession = async () => {
  const { data, error } = await supabase.auth.getSession();
  return { session: data.session, error };
};

export const getUser = async () => {
  const { data, error } = await supabase.auth.getUser();
  return { user: data.user, error };
};

export const onAuthStateChange = (callback: (event: string, session: any) => void) => {
  const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
    callback(event, session);
  });
  return subscription;
};
