import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { auth, getToken } from '@/lib/api';

interface AuthUser {
  id: number;
  email: string;
  display_name?: string;
  role?: 'admin' | 'correcteur' | 'validateur';
  points?: number;
  user_metadata?: { display_name?: string };
}

interface AuthContextType {
  user: AuthUser | null;
  session: null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (token) {
      auth.getMe()
        .then(({ user }) => {
          setUser({
            ...user,
            user_metadata: { display_name: user.display_name },
          });
        })
        .catch(() => {
          auth.signOut();
          setUser(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      const data = await auth.login(email, password);
      setUser({
        ...data.user,
        user_metadata: { display_name: data.user.display_name },
      });
      return { error: null };
    } catch (err: any) {
      return { error: new Error(err.message || 'Erreur de connexion') };
    }
  };

  const signUp = async (email: string, password: string) => {
    try {
      const data = await auth.register(email, password);
      setUser({
        ...data.user,
        user_metadata: { display_name: data.user.display_name },
      });
      return { error: null };
    } catch (err: any) {
      return { error: new Error(err.message || "Erreur d'inscription") };
    }
  };

  const handleSignOut = async () => {
    auth.signOut();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, session: null, loading, signIn, signUp, signOut: handleSignOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
