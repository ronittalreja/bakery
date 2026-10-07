import { useState, useEffect } from 'react';

/**
 * Custom hook to persist state to localStorage
 * @param key - The localStorage key
 * @param initialValue - The initial value if no saved value exists
 * @returns [value, setValue] - A state tuple like useState
 */
export function usePersistedState<T>(key: string, initialValue: T): [T, (value: T | ((val: T) => T)) => void] {
  // Get saved value from localStorage on mount
  const [state, setState] = useState<T>(() => {
    if (typeof window === 'undefined') return initialValue;
    
    try {
      const saved = localStorage.getItem(key);
      if (saved === null) return initialValue;
      return JSON.parse(saved);
    } catch (error) {
      console.error(`Error loading ${key} from localStorage:`, error);
      return initialValue;
    }
  });

  // Save state to localStorage whenever it changes
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch (error) {
      console.error(`Error saving ${key} to localStorage:`, error);
    }
  }, [key, state]);

  return [state, setState];
}
