"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Store } from "lucide-react"
import { useAuth } from "@/hooks/use-auth"

interface Store {
  id: number
  store_code: string
  store_name: string
  address?: string
  city?: string
  state?: string
}

export function StoreSelector() {
  const { user } = useAuth()
  const [stores, setStores] = useState<Store[]>([])
  const [selectedStore, setSelectedStore] = useState<Store | null>(null)
  const [loading, setLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    if (user?.store_id) {
      fetchStores()
    }
  }, [user])

  const fetchStores = async () => {
    setLoading(true)
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"
      const token = localStorage.getItem("token")
      
      const response = await fetch(`${apiUrl}/api/stores`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      })

      if (response.ok) {
        const data = await response.json()
        if (data.success && data.stores) {
          setStores(data.stores)
          // Set current store based on user's store_id
          const currentStore = data.stores.find((s: Store) => s.id === user?.store_id)
          setSelectedStore(currentStore || null)
        }
      }
    } catch (error) {
      console.error("Failed to fetch stores:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleStoreChange = (storeId: string) => {
    const store = stores.find(s => s.id === parseInt(storeId))
    if (store) {
      setSelectedStore(store)
      // Store selection logic - for super admins, this would switch context
      // For other roles, this is just display
    }
  }

  // Only show store selector for super admins or if user has a store
  if (!user || (!user.store_id && user.role !== 'super_admin')) {
    return null
  }

  return (
    <Card className="bg-gradient-to-br from-white via-slate-50 to-slate-100 border border-slate-200 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-slate-900 flex items-center gap-2">
          <Store className="h-4 w-4 text-primary" />
          Store
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-sm text-slate-500">Loading stores...</div>
        ) : selectedStore ? (
          <div className="space-y-2">
            <div className="text-sm font-medium text-slate-900">
              {selectedStore.store_name}
            </div>
            <div className="text-xs text-slate-600">
              {selectedStore.store_code}
            </div>
            {user.role === 'super_admin' && stores.length > 1 && (
              <Select value={selectedStore.id.toString()} onValueChange={handleStoreChange}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Switch store" />
                </SelectTrigger>
                <SelectContent>
                  {stores.map((store) => (
                    <SelectItem key={store.id} value={store.id.toString()}>
                      {store.store_name} ({store.store_code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        ) : (
          <div className="text-sm text-slate-500">No store assigned</div>
        )}
      </CardContent>
    </Card>
  )
}
