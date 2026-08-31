// File: src/hooks/use-auth.ts
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@/types";

interface TokenPayload {
  id: string;
  username: string;
  role: "staff" | "admin";
  isDemo?: boolean;
  iat: number;
  exp: number;
}

export const getAuthToken = (): string | null => {
  try {
    return localStorage.getItem("token");
  } catch (error) {
    return null;
  }
};

export const isTokenValid = (token: string): boolean => {
  try {
    const tokenParts = token.split(".");
    if (tokenParts.length !== 3) return false;
    
    const decodedPayload = JSON.parse(atob(tokenParts[1]));
    const currentTime = Math.floor(Date.now() / 1000);
    
    return decodedPayload.exp && decodedPayload.exp > currentTime;
  } catch (error) {
    return false;
  }
};

export const getStoredUser = (): User | null => {
  try {
    const storedUser = localStorage.getItem("bakery_user");
    return storedUser ? JSON.parse(storedUser) : null;
  } catch (error) {
    return null;
  }
};

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [forceUpdate, setForceUpdate] = useState(0);
  const router = useRouter();

  useEffect(() => {
    const validateUser = async () => {
      setLoading(true);
      try {
        const token = getAuthToken();
        const storedUser = localStorage.getItem("bakery_user");

        if (!token || !storedUser) {
          setUser(null);
          setLoading(false);
          return;
        }

        // First, check if token is valid locally
        if (!isTokenValid(token)) {
          localStorage.removeItem("token");
          localStorage.removeItem("bakery_user");
          setUser(null);
          setLoading(false);
          return;
        }

        // Validate token with backend
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
        const response = await fetch(`${apiUrl}/api/auth/validate`, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          throw new Error("Token validation failed");
        }

        const userData = await response.json();
        
        // Check if the response has success field and handle accordingly
        if (userData.success === false) {
          throw new Error(userData.error || "Token validation failed");
        }
        
        const user: User = {
          id: userData.id,
          username: userData.username,
          role: userData.role,
          isDemo: userData.isDemo || false,
        };
        setUser(user);
        localStorage.setItem("bakery_user", JSON.stringify(user));
      } catch (err) {
        localStorage.removeItem("token");
        localStorage.removeItem("bakery_user");
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    validateUser();
  }, [forceUpdate]); // Add forceUpdate dependency to re-run when auth state changes

  // Add event listener for storage changes (for cross-tab sync)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'token' || e.key === 'bakery_user') {
        setForceUpdate(prev => prev + 1);
      }
    };

    const handleAuthStateChange = (e: CustomEvent) => {
      setForceUpdate(prev => prev + 1);
    };

    // Check for existing valid session on mount
    const checkExistingSession = () => {
      const token = getAuthToken();
      const storedUser = getStoredUser();
      
      if (token && storedUser && isTokenValid(token)) {
        setUser(storedUser);
        setLoading(false);
      }
    };

    // Run session check immediately
    checkExistingSession();

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('authStateChanged', handleAuthStateChange as EventListener);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('authStateChanged', handleAuthStateChange as EventListener);
    };
  }, []);

  const login = async (username: string, password: string): Promise<boolean> => {
    setLoading(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
      const response = await fetch(`${apiUrl}/api/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (response.ok && data.success && data.token && data.role) {
        try {
          const tokenParts = data.token.split(".");
          if (tokenParts.length !== 3) {
            return false;
          }
          const decodedPayload: TokenPayload = JSON.parse(atob(tokenParts[1]));
          const user: User = {
            id: decodedPayload.id,
            username: decodedPayload.username,
            role: decodedPayload.role,
            isDemo: decodedPayload.isDemo || false,
          };

          localStorage.setItem("token", data.token);
          localStorage.setItem("bakery_user", JSON.stringify(user));
          setUser(user);
          setForceUpdate(prev => prev + 1); // Force re-render
          
          // Dispatch custom event for immediate UI update
          window.dispatchEvent(new CustomEvent('authStateChanged', { detail: { user, action: 'login' } }));
          
          return true;
        } catch (decodeError) {
          return false;
        }
      } else {
        return false;
      }
    } catch (error) {
      return false;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("bakery_user");
    setUser(null);
    setForceUpdate(prev => prev + 1); // Force re-render
    // Force immediate re-render by updating loading state
    setLoading(false);
    
    // Dispatch custom event for immediate UI update
    window.dispatchEvent(new CustomEvent('authStateChanged', { detail: { user: null, action: 'logout' } }));
  };

  return { user, login, logout, loading };
};