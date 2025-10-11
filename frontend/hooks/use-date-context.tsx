"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"

interface DateContextType {
  selectedDate: string
  setSelectedDate: (date: string) => void
  currentWorkingDate: string
  isToday: boolean
  canEdit: boolean
  endDay: () => void
  isDayEnded: boolean
  resetWorkingDate: (date: string) => void
  adminSetStaffDate: (date: string) => void
  staffCanEndDay: boolean
  adminMainDate: string
  setAdminMainDate: (date: string) => void
}

const DateContext = createContext<DateContextType | undefined>(undefined)

interface DateProviderProps {
  children: ReactNode
  userRole: "admin" | "staff"
}

export function DateProvider({ children, userRole }: DateProviderProps) {
  const getCurrentDate = () => new Date().toISOString().split("T")[0]
  const [today, setToday] = useState(getCurrentDate())
  const [selectedDate, setSelectedDate] = useState(today)
  const [currentWorkingDate, setCurrentWorkingDate] = useState(today)
  const [isDayEnded, setIsDayEnded] = useState(false)
  const [adminControlledStaffDate, setAdminControlledStaffDate] = useState(today)
  const [adminMainDate, setAdminMainDate] = useState(today)

  // Update date at midnight
  useEffect(() => {
    const updateDate = () => {
      const newToday = getCurrentDate()
      console.log(`Date check: current today=${today}, new today=${newToday}`)
      if (newToday !== today) {
        console.log(`Date changed from ${today} to ${newToday}`)
        setToday(newToday)
        // Auto-update dates to new day at midnight
        if (userRole === "staff") {
          setSelectedDate(newToday)
          setCurrentWorkingDate(newToday)
          setAdminControlledStaffDate(newToday)
        } else {
          setAdminMainDate(newToday)
        }
      }
    }

    // Check every 30 seconds for more responsive date changes
    const interval = setInterval(updateDate, 30000)
    
    // Also check immediately
    updateDate()

    return () => clearInterval(interval)
  }, [today, userRole])

  const isToday = selectedDate === today
  const canEdit = userRole === "admin" || (selectedDate === currentWorkingDate && !isDayEnded)

  const staffCanEndDay = userRole === "staff" && selectedDate === adminControlledStaffDate && !isDayEnded

  const endDay = () => {
    if (userRole === "staff" && selectedDate === adminControlledStaffDate && !isDayEnded) {
      setIsDayEnded(true)
      // Advance to next day
      const nextDate = new Date(adminControlledStaffDate)
      nextDate.setDate(nextDate.getDate() + 1)
      const nextDateString = nextDate.toISOString().split("T")[0]
      setAdminControlledStaffDate(nextDateString)
      setCurrentWorkingDate(nextDateString)
      setSelectedDate(nextDateString)
      setIsDayEnded(false) // Reset for the new day
    }
  }

  const resetWorkingDate = (date: string) => {
    if (userRole === "admin") {
      setCurrentWorkingDate(date)
      setSelectedDate(date)
      setIsDayEnded(false)
    }
  }

  const adminSetStaffDate = (date: string) => {
    if (userRole === "admin") {
      setAdminControlledStaffDate(date)
      setCurrentWorkingDate(date)
      setSelectedDate(date)
      setIsDayEnded(false)
    }
  }

  const effectiveSelectedDate = userRole === "admin" ? adminMainDate : selectedDate

  return (
    <DateContext.Provider
      value={{
        selectedDate: effectiveSelectedDate,
        setSelectedDate,
        currentWorkingDate,
        isToday: effectiveSelectedDate === today,
        canEdit,
        endDay,
        isDayEnded,
        resetWorkingDate,
        adminSetStaffDate,
        staffCanEndDay,
        adminMainDate,
        setAdminMainDate,
      }}
    >
      {children}
    </DateContext.Provider>
  )
}

export function useDateContext() {
  const context = useContext(DateContext)
  if (context === undefined) {
    throw new Error("useDateContext must be used within a DateProvider")
  }
  return context
}
