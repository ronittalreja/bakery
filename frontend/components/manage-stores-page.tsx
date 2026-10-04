"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ArrowLeft, Plus, Edit2, Trash2, Store } from "lucide-react"
import { apiClient } from "@/lib/apiClient"

interface Store {
  id: number
  store_code: string
  store_name: string
  status: string
  created_at: string
}

interface StoreUser {
  id: number
  username: string
  store_id: number
  role: string
}

interface ManageStoresPageProps {
  onBack: () => void
}

export function ManageStoresPage({ onBack }: ManageStoresPageProps) {
  const [stores, setStores] = useState<Store[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingStore, setEditingStore] = useState<Store | null>(null)
  
  // Create form state
  const [newUsername, setNewUsername] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [newStoreName, setNewStoreName] = useState("")
  
  // Edit form state
  const [editUsername, setEditUsername] = useState("")
  const [editPassword, setEditPassword] = useState("")

  const fetchStores = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem("token")
      const data = await apiClient<{ success: boolean; stores: Store[] }>(
        "/api/stores",
        { headers: { Authorization: `Bearer ${token}` } }
      )
      if (data.success) {
        setStores(data.stores)
      }
    } catch (err: any) {
      setError(err.message || "Failed to fetch stores")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStores()
  }, [])

  const handleCreateStore = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (!newUsername || !newPassword || !newStoreName) {
      setError("All fields are required")
      return
    }

    try {
      const token = localStorage.getItem("token")
      const data = await apiClient<{ success: boolean; store: Store; user: StoreUser }>(
        "/api/stores",
        {
          method: "POST",
          headers: { 
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            store_code: newUsername,
            store_name: newStoreName,
            username: newUsername,
            password: newPassword
          })
        }
      )

      if (data.success) {
        setShowCreateForm(false)
        setNewUsername("")
        setNewPassword("")
        setNewStoreName("")
        fetchStores()
      }
    } catch (err: any) {
      setError(err.message || "Failed to create store")
    }
  }

  const handleEditStore = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (!editUsername || !editPassword) {
      setError("Username and password are required")
      return
    }

    try {
      const token = localStorage.getItem("token")
      const data = await apiClient<{ success: boolean }>(
        `/api/stores/${editingStore?.id}`,
        {
          method: "PUT",
          headers: { 
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            username: editUsername,
            password: editPassword
          })
        }
      )

      if (data.success) {
        setEditingStore(null)
        setEditUsername("")
        setEditPassword("")
        fetchStores()
      }
    } catch (err: any) {
      setError(err.message || "Failed to update store")
    }
  }

  const handleDeleteStore = async (storeId: number) => {
    if (!confirm("Are you sure you want to delete this store? This action cannot be undone.")) {
      return
    }

    try {
      const token = localStorage.getItem("token")
      const data = await apiClient<{ success: boolean }>(
        `/api/stores/${storeId}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` }
        }
      )

      if (data.success) {
        fetchStores()
      }
    } catch (err: any) {
      setError(err.message || "Failed to delete store")
    }
  }

  const openEditForm = (store: Store) => {
    setEditingStore(store)
    setEditUsername(store.store_code)
    setEditPassword("")
  }

  if (loading) {
    return (
      <div className="h-full bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading stores...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full bg-white p-6 overflow-y-auto">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button variant="outline" onClick={onBack} className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Manage Stores</h1>
              <p className="text-sm text-slate-600">Create and manage bakery stores</p>
            </div>
          </div>
          <Button 
            onClick={() => setShowCreateForm(true)}
            className="flex items-center gap-2 bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary"
          >
            <Plus className="h-4 w-4" />
            Create Store
          </Button>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Create Store Form */}
        {showCreateForm && (
          <Card className="mb-6 border-primary">
            <CardHeader>
              <CardTitle>Create New Store</CardTitle>
              <CardDescription>Enter store details to create a new store</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateStore} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="newUsername">Username (Store ID)</Label>
                  <Input
                    id="newUsername"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    placeholder="e.g., R3310"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="newStoreName">Store Name</Label>
                  <Input
                    id="newStoreName"
                    value={newStoreName}
                    onChange={(e) => setNewStoreName(e.target.value)}
                    placeholder="e.g., R3310 Bakery"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="newPassword">Password</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter password"
                    required
                  />
                </div>
                <div className="flex gap-2">
                  <Button type="submit" className="flex-1">
                    Create Store
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => {
                      setShowCreateForm(false)
                      setNewUsername("")
                      setNewPassword("")
                      setNewStoreName("")
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Edit Store Form */}
        {editingStore && (
          <Card className="mb-6 border-primary">
            <CardHeader>
              <CardTitle>Edit Store Credentials</CardTitle>
              <CardDescription>Update credentials for {editingStore.store_name}</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleEditStore} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="editUsername">Username</Label>
                  <Input
                    id="editUsername"
                    value={editUsername}
                    onChange={(e) => setEditUsername(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="editPassword">New Password</Label>
                  <Input
                    id="editPassword"
                    type="password"
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                    placeholder="Enter new password"
                    required
                  />
                </div>
                <div className="flex gap-2">
                  <Button type="submit" className="flex-1">
                    Update
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => {
                      setEditingStore(null)
                      setEditUsername("")
                      setEditPassword("")
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Stores List */}
        <div className="grid gap-4">
          {stores.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Store className="h-12 w-12 text-slate-400 mb-4" />
                <p className="text-slate-600">No stores found. Create your first store to get started.</p>
              </CardContent>
            </Card>
          ) : (
            stores.map((store) => (
              <Card key={store.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 text-white flex items-center justify-center">
                        <Store className="h-6 w-6" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-slate-900">{store.store_name}</h3>
                        <p className="text-sm text-slate-600">ID: {store.store_code}</p>
                        <p className="text-xs text-slate-500">Status: {store.status}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEditForm(store)}
                        className="flex items-center gap-2"
                      >
                        <Edit2 className="h-4 w-4" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteStore(store.id)}
                        className="flex items-center gap-2 text-red-600 hover:text-red-700 hover:border-red-300"
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
