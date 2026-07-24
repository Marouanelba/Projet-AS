import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { auth, getToken } from '@/lib/api';

interface User {
  id: number;
  email: string;
  display_name?: string;
  user_metadata?: { display_name?: string };
}

interface AuthContextType {
  user: User | null;
  session: { token: string } | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<{ token: string } | null>(null);
  const [loading, setLoading] = useState(true);

  // Au montage, vérifier si un token existe et récupérer le profil
  useEffect(() => {
    const initAuth = async () => {
      const token = getToken();
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const { user: userData } = await auth.getMe();
        const enrichedUser: User = {
          ...userData,
          user_metadata: { display_name: userData.display_name },
        };
        setUser(enrichedUser);
        setSession({ token });
      } catch {
        // Token invalide ou expiré, nettoyer
        auth.signOut();
        setUser(null);
        setSession(null);
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      const { user: userData, token } = await auth.login(email, password);
      const enrichedUser: User = {
        ...userData,
        user_metadata: { display_name: userData.display_name },
      };
      setUser(enrichedUser);
      setSession({ token });
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signUp = async (email: string, password: string) => {
    try {
      const { user: userData, token } = await auth.register(email, password);
      const enrichedUser: User = {
        ...userData,
        user_metadata: { display_name: userData.display_name },
      };
      setUser(enrichedUser);
      setSession({ token });
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signOut = async () => {
    auth.signOut();
    setUser(null);
    setSession(null);
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signIn, signUp, signOut }}>
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
