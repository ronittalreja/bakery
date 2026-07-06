"use client"

import { useState } from "react"
import { useAuth } from "@/hooks/use-auth"
import { DateProvider } from "@/hooks/use-date-context"
import { LoginForm } from "@/components/login-form"
import { StaffDashboard } from "@/components/staff-dashboard"
import { AdminDashboard } from "@/components/admin-dashboard"

export default function HomePage() {
  const { user, loading } = useAuth()
  const [showAdmin, setShowAdmin] = useState(false)

  // Debug logging
  console.log("HomePage render:", { user, loading, showAdmin })

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-slate-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return <LoginForm />
  }

  // Demo users can toggle between staff and admin views
  const shouldShowAdmin = user.role === "admin" || (user.isDemo && showAdmin)

  // Force re-render by using a key that changes with user state
  return (
    <DateProvider key={`${user.id}-${user.role}-${showAdmin}`} userRole={shouldShowAdmin ? "admin" : "staff"}>
      {shouldShowAdmin ? (
        <AdminDashboard onBackToStaff={() => setShowAdmin(false)} />
      ) : (
        <StaffDashboard onSwitchToAdmin={() => setShowAdmin(true)} />
      )}
    </DateProvider>
  )
}
