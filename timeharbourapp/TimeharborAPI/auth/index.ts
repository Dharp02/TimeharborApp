// API URL from environment variable
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://10.0.0.39:3001';

type AuthListener = (event: string, session: any) => void;
const listeners: AuthListener[] = [];

const notifyListeners = (event: string, session: any) => {
  listeners.forEach(listener => listener(event, session));
};

export const signUp = async (email: string, password: string, name: string) => {
  console.log('Signing up with:', { email, name });
  try {
    const response = await fetch(`${API_URL}/auth/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password, full_name: name }),
    });

    const data = await response.json();

    if (!response.ok) {
      return { data: null, error: { message: data.error || 'Signup failed' } };
    }

    if (data.session?.access_token) {
      localStorage.setItem('access_token', data.session.access_token);
      notifyListeners('SIGNED_IN', { user: data.user, access_token: data.session.access_token });
    }

    return { data, error: null };
  } catch (err) {
    console.error('Signup error:', err);
    return { data: null, error: { message: 'Network error' } };
  }
};

export const signIn = async (email: string, password: string) => {
  try {
    const response = await fetch(`${API_URL}/auth/signin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (!response.ok) {
      return { data: null, error: { message: data.error || 'Signin failed' } };
    }

    if (data.session?.access_token) {
      localStorage.setItem('access_token', data.session.access_token);
      notifyListeners('SIGNED_IN', { user: data.user, access_token: data.session.access_token });
    }

    return { data, error: null };
  } catch (err) {
    console.error('Signin error:', err);
    return { data: null, error: { message: 'Network error' } };
  }
};

export const signOut = async () => {
  localStorage.removeItem('access_token');
  notifyListeners('SIGNED_OUT', null);
  return { error: null };
};

export const getSession = async () => {
  const token = localStorage.getItem('access_token');
  if (!token) {
    return { session: null, error: null };
  }
  // Ideally verify token here or get user
  // For now just return the token
  return { session: { access_token: token }, error: null };
};

export const getUser = async () => {
  const token = localStorage.getItem('access_token');
  if (!token) {
    return { user: null, error: null };
  }

  try {
    const response = await fetch(`${API_URL}/auth/me`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return { user: null, error: { message: data.error } };
    }

    return { user: data.user, error: null };
  } catch (err) {
    return { user: null, error: { message: 'Network error' } };
  }
};

export const onAuthStateChange = (callback: AuthListener) => {
  listeners.push(callback);
  return {
    unsubscribe: () => {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  };
};
