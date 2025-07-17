'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useRouter } from 'next/navigation';

type User = {
  id: string;
  name: string;
  email: string;
  role: 'Admin' | 'Viewer';
};

type AuthContextType = {
  user: User | null;
  isAdmin: boolean;
  isViewer: boolean;
  loading: boolean;
  signOut: () => void;
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  isAdmin: false,
  isViewer: false,
  loading: false,
  signOut: () => { },
  setUser: () => { },
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (stored) {
      setUser(JSON.parse(stored));
    }
    setLoading(false);
  }, []);

  const signOut = () => {
    setLoading(true);
    localStorage.removeItem('user');
    setUser(null);
    setLoading(false);
    window.location.href = '/signin';
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAdmin: user?.role === 'Admin',
        isViewer: user?.role === 'Viewer',
        loading,
        signOut,
        setUser, // <-- expose setUser
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
