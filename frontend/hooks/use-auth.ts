// File: src/hooks/use-auth.ts
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@/types";

interface TokenPayload {
  id: string;
  username: string;
  role: "staff" | "admin";
  iat: number;
  exp: number;
}

export const getAuthToken = (): string | null => {
  try {
    return localStorage.getItem("token");
  } catch (error) {
    console.error("Error accessing local storage:", error);
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
    console.error("Error validating token:", error);
    return false;
  }
};

export const getStoredUser = (): User | null => {
  try {
    const storedUser = localStorage.getItem("bakery_user");
    return storedUser ? JSON.parse(storedUser) : null;
  } catch (error) {
    console.error("Error accessing stored user:", error);
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
          console.warn("No token or user data found, redirecting to login");
          setUser(null);
          setLoading(false);
          return;
        }

        // First, check if token is valid locally
        if (!isTokenValid(token)) {
          console.warn("Token has expired locally, removing from storage");
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
        };
        setUser(user);
        localStorage.setItem("bakery_user", JSON.stringify(user));
        console.log("User validated successfully, session persisted for 1 year");
      } catch (err) {
        console.error("Auth validation error:", err);
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
      console.log("Auth state change event received:", e.detail);
      setForceUpdate(prev => prev + 1);
    };

    // Check for existing valid session on mount
    const checkExistingSession = () => {
      const token = getAuthToken();
      const storedUser = getStoredUser();
      
      if (token && storedUser && isTokenValid(token)) {
        console.log("Found valid existing session, restoring user:", storedUser.username);
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
    console.log("Login attempt started");
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
            console.error("Invalid token format");
            return false;
          }
          const decodedPayload: TokenPayload = JSON.parse(atob(tokenParts[1]));
          const user: User = {
            id: decodedPayload.id,
            username: decodedPayload.username,
            role: decodedPayload.role,
          };

          localStorage.setItem("token", data.token);
          localStorage.setItem("bakery_user", JSON.stringify(user));
          console.log("About to set user state:", user);
          setUser(user);
          setForceUpdate(prev => prev + 1); // Force re-render
          console.log("User state set, login success:", { user, token: data.token });
          
          // Dispatch custom event for immediate UI update
          window.dispatchEvent(new CustomEvent('authStateChanged', { detail: { user, action: 'login' } }));
          
          return true;
        } catch (decodeError) {
          console.error("Token decode error:", decodeError);
          return false;
        }
      } else {
        console.error("Login failed:", data.error || "No token/role in response");
        return false;
      }
    } catch (error) {
      console.error("Login error:", error);
      return false;
    } finally {
      setLoading(false);
      console.log("Login attempt finished, loading set to false");
    }
  };

  const logout = () => {
    console.log("Logout called");
    localStorage.removeItem("token");
    localStorage.removeItem("bakery_user");
    setUser(null);
    setForceUpdate(prev => prev + 1); // Force re-render
    console.log("User state set to null, logout complete");
    // Force immediate re-render by updating loading state
    setLoading(false);
    
    // Dispatch custom event for immediate UI update
    window.dispatchEvent(new CustomEvent('authStateChanged', { detail: { user: null, action: 'logout' } }));
  };

  return { user, login, logout, loading };
};