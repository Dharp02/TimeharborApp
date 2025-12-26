import { supabase } from '../core/supabase';

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
  const { error } = await supabase.auth.signOut();
  if (error) {
    console.warn("SignOut error, forcing local signout", error);
    await supabase.auth.signOut({ scope: 'local' });
  }
  return { error };
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
