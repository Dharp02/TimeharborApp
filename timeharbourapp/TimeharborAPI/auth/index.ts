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
    console.error('Supabase SignUp Error:', error);
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
  return { error };
};
