import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase, UserProfile } from '../lib/supabase';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  resendConfirmationEmail: (email: string) => Promise<string>;
  canResendEmail: () => boolean;
  getResendTimeRemaining: () => number;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Constants for email resend rate limiting
const RESEND_COOLDOWN_MS = 60000; // 1 minute cooldown
const MAX_RESEND_ATTEMPTS = 3; // Maximum attempts per session

interface ResendState {
  lastAttempt: number;
  attempts: number;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [resendState, setResendState] = useState<ResendState>({
    lastAttempt: 0,
    attempts: 0
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      (async () => {
        setUser(session?.user ?? null);
        if (session?.user) {
          await fetchProfile(session.user.id);
        } else {
          setProfile(null);
          setLoading(false);
        }
      })();
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) throw error;
      setProfile(data);
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const canResendEmail = () => {
    const now = Date.now();
    const timeSinceLastAttempt = now - resendState.lastAttempt;
    return resendState.attempts < MAX_RESEND_ATTEMPTS && timeSinceLastAttempt >= RESEND_COOLDOWN_MS;
  };

  const getResendTimeRemaining = () => {
    const now = Date.now();
    const timeSinceLastAttempt = now - resendState.lastAttempt;
    return Math.ceil((RESEND_COOLDOWN_MS - timeSinceLastAttempt) / 1000);
  };

  const handleEmailResend = async (email: string) => {
    if (!canResendEmail()) {
      if (resendState.attempts >= MAX_RESEND_ATTEMPTS) {
        throw new Error(`Maximum resend attempts reached (${MAX_RESEND_ATTEMPTS}). Please contact support.`);
      }
      const waitSeconds = getResendTimeRemaining();
      throw new Error(`Please wait ${waitSeconds} seconds before requesting another confirmation email.`);
    }

    setResendState(prev => ({
      lastAttempt: Date.now(),
      attempts: prev.attempts + 1
    }));

    const { error: resendError } = await supabase.auth.resend({
      type: 'signup',
      email,
    });

    if (resendError) {
      if (resendError.status === 429) {
        throw new Error('Too many confirmation email requests. Please wait a while before trying again.');
      }
      throw new Error('Failed to send confirmation email. Please try again later.');
    }

    return `Confirmation email sent! ${MAX_RESEND_ATTEMPTS - (resendState.attempts + 1)} attempts remaining.`;
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (error) {
      if (error.message.includes('Email not confirmed')) {
        try {
          const message = await handleEmailResend(email);
          throw new Error(`Please check your email to confirm your account. ${message}`);
        } catch (resendError: any) {
          throw new Error(resendError.message);
        }
      }
      
      if (error.message.includes('Invalid login credentials')) {
        throw new Error('Invalid email or password');
      }
      
      throw error;
    }
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  const resendConfirmationEmail = async (email: string) => {
    return handleEmailResend(email);
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      profile, 
      loading, 
      signIn, 
      signOut,
      resendConfirmationEmail,
      canResendEmail,
      getResendTimeRemaining
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
