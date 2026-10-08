// Events Management Page
// Manage Tomorrow AI events with approve/reject functionality

"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Check, X, RefreshCw, Calendar, Edit, Trash2, Plus } from "lucide-react";
import { usePersistedState } from "@/hooks/use-persisted-state";

interface Event {
  id: number;
  event_name: string;
  event_type: string;
  event_date: string;
  year: number;
  description: string;
  status: 'pending' | 'approved' | 'rejected';
}

export function ManageEventsPage({ onBack }: { onBack: () => void }) {
  const [events, setEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [filter, setFilter] = usePersistedState<'all' | 'approved' | 'rejected'>('manage_events_filter', 'all');
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [newEventName, setNewEventName] = useState('');
  const [newEventDate, setNewEventDate] = useState('');
  const [newEventType, setNewEventType] = useState<'fixed' | 'dynamic'>('fixed');
  const [dynamicYearDates, setDynamicYearDates] = useState<Record<number, string>>({});
  const [newEventSelectedDates, setNewEventSelectedDates] = useState<string[]>([]);

  // Generate years from current year - 2 to current year
  const years = Array.from({ length: 3 }, (_, i) => new Date().getFullYear() - 2 + i);

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/tomorrow-ai/events/all`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setEvents(data.data);
      }
    } catch (error) {
      console.error('Error fetching events:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const updateEventStatus = async (eventId: number, status: 'approved' | 'rejected') => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/tomorrow-ai/events/${eventId}/status`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status })
      });
      const data = await response.json();
      if (data.success) {
        // Update local state
        setEvents(events.map(e => e.id === eventId ? { ...e, status } : e));
      }
    } catch (error) {
      console.error('Error updating event status:', error);
    }
  };

  const updateEventDates = async (eventId: number, dates: string[]) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/tomorrow-ai/events/${eventId}/dates`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ dates })
      });
      const data = await response.json();
      if (data.success) {
        setEditingEvent(null);
        setSelectedDates([]);
        fetchEvents();
      } else {
        console.error('Error updating event dates:', data.error);
      }
    } catch (error) {
      console.error('Error updating event dates:', error);
    }
  };

  const createEvent = async () => {
    try {
      const token = localStorage.getItem('token');
      
      if (newEventType === 'fixed') {
        // Create event for all years with the same date
        const eventsToCreate = years.map(year => {
          const [month, day] = newEventDate.split('-');
          const eventDate = `${year}-${month}-${day}`;
          return {
            event_name: newEventName,
            event_type: 'fixed',
            event_date: eventDate,
            year: year,
            description: `${newEventName} (Fixed event)`,
            status: 'approved'
          };
        });

        for (const eventData of eventsToCreate) {
          const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/tomorrow-ai/events`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(eventData)
          });
          const data = await response.json();
          if (!data.success) {
            console.error('Error creating event:', data.error);
          }
        }
      } else if (newEventType === 'dynamic' && newEventSelectedDates.length > 0) {
        // Create events for selected dates (multi-date selection)
        for (const date of newEventSelectedDates) {
          const eventDate = new Date(date);
          const year = eventDate.getFullYear();
          
          const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/tomorrow-ai/events`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              event_name: newEventName,
              event_type: 'dynamic',
              event_date: date,
              year: year,
              description: `${newEventName} (Dynamic event)`,
              status: 'approved'
            })
          });
          const data = await response.json();
          if (!data.success) {
            console.error('Error creating event:', data.error);
          }
        }
      } else {
        // Dynamic event - create with specific dates for each year (old behavior)
        for (const [year, date] of Object.entries(dynamicYearDates)) {
          if (date) {
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/tomorrow-ai/events`, {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                event_name: newEventName,
                event_type: 'dynamic',
                event_date: date,
                year: parseInt(year),
                description: `${newEventName} (Dynamic event)`,
                status: 'approved'
              })
            });
            const data = await response.json();
            if (!data.success) {
              console.error('Error creating event:', data.error);
            }
          }
        }
      }

      setShowAddEvent(false);
      setNewEventName('');
      setNewEventDate('');
      setDynamicYearDates({});
      setNewEventSelectedDates([]);
      fetchEvents();
    } catch (error) {
      console.error('Error creating event:', error);
    }
  };

  const deleteEvent = async (eventId: number) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/tomorrow-ai/events/${eventId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setEvents(events.filter(e => e.id !== eventId));
      }
    } catch (error) {
      console.error('Error deleting event:', error);
    }
  };

  const handleDateToggle = (date: string) => {
    if (selectedDates.includes(date)) {
      setSelectedDates(selectedDates.filter(d => d !== date));
    } else {
      setSelectedDates([...selectedDates, date]);
    }
  };

  const handleSaveDates = () => {
    if (editingEvent && selectedDates.length > 0) {
      updateEventDates(editingEvent.id, selectedDates);
    }
  };

  const getDatesForYear = (year: number) => {
    const months = [];
    for (let month = 0; month < 12; month++) {
      const dates = [];
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month, day);
        dates.push({
          date: date.toISOString().split('T')[0],
          day: date.getDate(),
          month: date.toLocaleString('default', { month: 'short' })
        });
      }
      months.push({ monthName: new Date(year, month).toLocaleString('default', { month: 'long' }), dates });
    }
    return months;
  };

  const filteredEvents = events.filter(event => {
    if (filter === 'all') return true;
    return event.status === filter;
  }).filter(event => event.year === selectedYear);

  const getEventEmoji = (eventName: string) => {
    const name = eventName.toLowerCase();
    if (name.includes('valentine')) return '❤️';
    if (name.includes('holi')) return '🎨';
    if (name.includes('diwali')) return '🪔';

    if (name.includes('new year')) return '🎉';
    if (name.includes('mother')) return '🌸';
    if (name.includes('father')) return '👨';
    if (name.includes('children')) return '🧒';
    if (name.includes('eid')) return '🌙';
    if (name.includes('independence')) return '🇮🇳';
    if (name.includes('raksha')) return '🧵';
    return '🎉';
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-100 text-green-800 border-green-300">Approved</Badge>;
      case 'rejected':
        return <Badge className="bg-red-100 text-red-800 border-red-300">Rejected</Badge>;
      default:
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">Pending</Badge>;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Dashboard
        </Button>
        <Button onClick={fetchEvents} disabled={isLoading} variant="outline">
          <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Header Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-6 w-6 text-purple-600" />
            Events Management
          </CardTitle>
          <CardDescription>
            Approve or reject events for Tomorrow AI demand forecasting
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Year Slider */}
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-medium">Year:</span>
            </div>
            <div className="flex gap-2">
              {years.map((year) => (
                <Button
                  key={year}
                  variant={selectedYear === year ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedYear(year)}
                >
                  {year}
                </Button>
              ))}
            </div>
          </div>
          {/* Filter Buttons */}
          <div className="flex gap-2 mb-4">
            <Button
              variant={filter === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('all')}
            >
              All ({events.filter(e => e.year === selectedYear).length})
            </Button>
            <Button
              variant={filter === 'approved' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('approved')}
            >
              Approved ({events.filter(e => e.status === 'approved' && e.year === selectedYear).length})
            </Button>
            <Button
              variant={filter === 'rejected' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('rejected')}
            >
              Rejected ({events.filter(e => e.status === 'rejected' && e.year === selectedYear).length})
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Add Event Button */}
      <Dialog open={showAddEvent} onOpenChange={setShowAddEvent}>
        <DialogTrigger asChild>
          <Button className="w-full">
            <Plus className="mr-2 h-4 w-4" />
            Add Event
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Event</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="eventName">Event Name</Label>
              <Input
                id="eventName"
                value={newEventName}
                onChange={(e) => setNewEventName(e.target.value)}
                placeholder="e.g., Christmas"
              />
            </div>
            <div>
              <Label htmlFor="eventType">Event Type</Label>
              <div className="flex gap-2 mt-2">
                <Button
                  variant={newEventType === 'fixed' ? 'default' : 'outline'}
                  onClick={() => setNewEventType('fixed')}
                >
                  Fixed
                </Button>
                <Button
                  variant={newEventType === 'dynamic' ? 'default' : 'outline'}
                  onClick={() => setNewEventType('dynamic')}
                >
                  Dynamic
                </Button>
              </div>
            </div>
            {newEventType === 'fixed' && (
              <div>
                <Label htmlFor="eventDate">Date (MM-DD)</Label>
                <Input
                  id="eventDate"
                  type="date"
                  value={newEventDate}
                  onChange={(e) => setNewEventDate(e.target.value)}
                />
                <p className="text-sm text-muted-foreground mt-1">
                  This will create the event on this date for all years
                </p>
              </div>
            )}
            {newEventType === 'dynamic' && (
              <div>
                <Label>Select Multiple Dates (Click to toggle)</Label>
                <div className="space-y-4 mt-2 max-h-60 overflow-y-auto">
                  {getDatesForYear(selectedYear).map((month) => (
                    <div key={month.monthName}>
                      <h4 className="font-medium text-sm mb-2">{month.monthName}</h4>
                      <div className="grid grid-cols-7 gap-2">
                        {month.dates.map((date) => {
                          const isSelected = newEventSelectedDates.includes(date.date);
                          return (
                            <button
                              key={date.date}
                              onClick={() => {
                                if (isSelected) {
                                  setNewEventSelectedDates(newEventSelectedDates.filter(d => d !== date.date));
                                } else {
                                  setNewEventSelectedDates([...newEventSelectedDates, date.date]);
                                }
                              }}
                              title={`${date.month} ${date.day}`}
                              className={`p-2 text-sm rounded border ${
                                isSelected
                                  ? 'bg-purple-600 text-white border-purple-600'
                                  : 'bg-white hover:bg-gray-100'
                              }`}
                            >
                              {date.day}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  Selected: {newEventSelectedDates.length} dates
                </p>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => {
                setShowAddEvent(false);
                setNewEventSelectedDates([]);
              }}>
                Cancel
              </Button>
              <Button onClick={createEvent} disabled={!newEventName || (newEventType === 'fixed' && !newEventDate) || (newEventType === 'dynamic' && newEventSelectedDates.length === 0)}>
                Create Event
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Event Dialog */}
      <Dialog open={!!editingEvent} onOpenChange={(open) => !open && setEditingEvent(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Event Dates - {editingEvent?.event_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Select multiple dates for forecast calculation. Invoices from these dates will be used for real-time forecast API.
            </p>
            <div className="space-y-4">
              {editingEvent && getDatesForYear(editingEvent.year).map((month) => (
                <div key={month.monthName}>
                  <h4 className="font-medium text-sm mb-2">{month.monthName}</h4>
                  <div className="grid grid-cols-7 gap-2">
                    {month.dates.map((date) => {
                      const isSelected = selectedDates.includes(date.date);
                      return (
                        <button
                          key={date.date}
                          onClick={() => handleDateToggle(date.date)}
                          title={`${date.month} ${date.day}`}
                          className={`p-2 text-sm rounded border ${
                            isSelected
                              ? 'bg-purple-600 text-white border-purple-600'
                              : 'bg-white hover:bg-gray-100'
                          }`}
                        >
                          {date.day}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => {
                setEditingEvent(null);
                setSelectedDates([]);
              }}>
                Cancel
              </Button>
              <Button onClick={handleSaveDates} disabled={selectedDates.length === 0}>
                Save Dates ({selectedDates.length})
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Events Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Event</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEvents.map((event) => (
                <TableRow key={event.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{getEventEmoji(event.event_name)}</span>
                      <div>
                        <div className="font-medium">{event.event_name}</div>
                        <div className="text-sm text-muted-foreground">{event.year}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{event.event_type}</Badge>
                  </TableCell>
                  <TableCell>{formatDate(event.event_date)}</TableCell>
                  <TableCell>{getStatusBadge(event.status)}</TableCell>
                  <TableCell className="text-right">
                    {event.status === 'approved' && (
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditingEvent(event);
                            setSelectedDates([event.event_date]);
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateEventStatus(event.id, 'rejected')}
                        >
                          <X className="h-4 w-4 text-red-600" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => deleteEvent(event.id)}
                        >
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      </div>
                    )}
                    {event.status === 'rejected' && (
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateEventStatus(event.id, 'approved')}
                        >
                          <Check className="h-4 w-4 text-green-600" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => deleteEvent(event.id)}
                        >
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {filteredEvents.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    No events found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
