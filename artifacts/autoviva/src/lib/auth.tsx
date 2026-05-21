import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { setAuthTokenGetter } from "@workspace/api-client-react";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  college?: string | null;
  plan: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (token: string, user: User) => void;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [, setLocation] = useLocation();

  useEffect(() => {
    const storedToken = localStorage.getItem("autoviva_token");
    const storedUser = localStorage.getItem("autoviva_user");
    
    if (storedToken && storedUser) {
      try {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
        setAuthTokenGetter(() => storedToken);
      } catch (err) {
        console.error("Failed to parse user from local storage", err);
        logout();
      }
    } else {
      setAuthTokenGetter(() => null);
    }
  }, []);

  const login = useCallback((newToken: string, newUser: User) => {
    localStorage.setItem("autoviva_token", newToken);
    localStorage.setItem("autoviva_user", JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
    setAuthTokenGetter(() => newToken);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("autoviva_token");
    localStorage.removeItem("autoviva_user");
    setToken(null);
    setUser(null);
    setAuthTokenGetter(() => null);
    setLocation("/login");
  }, [setLocation]);

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isAuthenticated: !!token }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
