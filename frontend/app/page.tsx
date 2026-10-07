"use client"

import { useState } from "react"
import { useAuth } from "@/hooks/use-auth"
import { DateProvider } from "@/hooks/use-date-context"
import { LoginForm } from "@/components/login-form"
import { StaffDashboard } from "@/components/developer-page"
import { UserDashboard } from "@/components/user-dashboard"

export default function HomePage() {
  const { user, loading } = useAuth()
  const [showUserDashboard, setShowUserDashboard] = useState(false)

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

  // Demo users can toggle between developer and user views
  const shouldShowUserDashboard = user.role === "store_manager" || (user.isDemo && showUserDashboard)

  // Force re-render by using a key that changes with user state
  return (
    <DateProvider key={`${user.id}-${user.role}-${showUserDashboard}`} userRole={shouldShowUserDashboard ? "store_manager" : "super_admin"}>
      {shouldShowUserDashboard ? (
        <UserDashboard onBackToDeveloper={() => setShowUserDashboard(false)} />
      ) : (
        <StaffDashboard onSwitchToUser={() => setShowUserDashboard(true)} />
      )}
    </DateProvider>
  )
}
