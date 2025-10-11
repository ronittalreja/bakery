/**
 * Utility functions for consistent date formatting across the application
 */

/**
 * Format a date to DD/MM/YYYY format
 * @param date - Date object, date string, or timestamp
 * @returns Formatted date string in DD/MM/YYYY format
 */
export const formatDate = (date: Date | string | number): string => {
  try {
    const dateObj = new Date(date);
    if (isNaN(dateObj.getTime())) {
      return '-';
    }
    
    const day = dateObj.getDate().toString().padStart(2, '0');
    const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
    const year = dateObj.getFullYear();
    
    return `${day}/${month}/${year}`;
  } catch (error) {
    console.error('Error formatting date:', error);
    return '-';
  }
};

/**
 * Format a date to DD/MM/YYYY HH:MM format for timestamps
 * @param date - Date object, date string, or timestamp
 * @returns Formatted date string in DD/MM/YYYY HH:MM format
 */
export const formatDateTime = (date: Date | string | number): string => {
  try {
    const dateObj = new Date(date);
    if (isNaN(dateObj.getTime())) {
      return '-';
    }
    
    const day = dateObj.getDate().toString().padStart(2, '0');
    const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
    const year = dateObj.getFullYear();
    const hours = dateObj.getHours().toString().padStart(2, '0');
    const minutes = dateObj.getMinutes().toString().padStart(2, '0');
    
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  } catch (error) {
    console.error('Error formatting date time:', error);
    return '-';
  }
};

/**
 * Format a date to DD/MM/YYYY format for display in cards and headers
 * @param date - Date object, date string, or timestamp
 * @returns Formatted date string in DD/MM/YYYY format
 */
export const formatDisplayDate = (date: Date | string | number): string => {
  try {
    const dateObj = new Date(date);
    if (isNaN(dateObj.getTime())) {
      return 'Invalid Date';
    }
    
    const day = dateObj.getDate().toString().padStart(2, '0');
    const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
    const year = dateObj.getFullYear();
    
    return `${day}/${month}/${year}`;
  } catch (error) {
    console.error('Error formatting display date:', error);
    return 'Invalid Date';
  }
};

/**
 * Format time to 12-hour format (HH:MM AM/PM)
 * @param date - Date object, date string, or timestamp
 * @returns Formatted time string in 12-hour format
 */
export const formatTime = (date: Date | string | number): string => {
  try {
    const dateObj = new Date(date);
    if (isNaN(dateObj.getTime())) {
      return '-';
    }
    
    const hours = dateObj.getHours();
    const minutes = dateObj.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12; // Convert 0 to 12 for 12 AM
    
    return `${displayHours}:${minutes} ${ampm}`;
  } catch (error) {
    console.error('Error formatting time:', error);
    return '-';
  }
};
