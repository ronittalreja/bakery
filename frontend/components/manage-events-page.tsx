// Events Management Page
// Manage Tomorrow AI events with approve/reject functionality

"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ArrowLeft, Check, X, RefreshCw, Calendar, Edit, Trash2 } from "lucide-react";
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
  const [filter, setFilter] = usePersistedState<'all' | 'pending' | 'approved' | 'rejected'>('manage_events_filter', 'all');
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [selectedDates, setSelectedDates] = useState<string[]>([]);

  // Generate years from current year - 2 to current year + 1
  const years = Array.from({ length: 4 }, (_, i) => new Date().getFullYear() - 2 + i);

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

  const updateEventStatus = async (eventId: number, status: 'approved' | 'rejected' | 'pending') => {
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
      }
    } catch (error) {
      console.error('Error updating event dates:', error);
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
    const dates = [];
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31);
    
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      dates.push(new Date(d).toISOString().split('T')[0]);
    }
    return dates;
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
              variant={filter === 'pending' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('pending')}
            >
              Pending ({events.filter(e => e.status === 'pending' && e.year === selectedYear).length})
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
                    {event.status === 'pending' && (
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
                    {event.status === 'approved' && (
                      <div className="flex justify-end gap-2">
                        <Dialog>
                          <DialogTrigger asChild>
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
                          </DialogTrigger>
                          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                            <DialogHeader>
                              <DialogTitle>Edit Event Dates - {event.event_name}</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4">
                              <p className="text-sm text-muted-foreground">
                                Select multiple dates for forecast calculation. Invoices from these dates will be used for real-time forecast API.
                              </p>
                              <div className="grid grid-cols-7 gap-2">
                                {getDatesForYear(event.year).map((date) => {
                                  const dateObj = new Date(date);
                                  const isSelected = selectedDates.includes(date);
                                  return (
                                    <button
                                      key={date}
                                      onClick={() => handleDateToggle(date)}
                                      className={`p-2 text-sm rounded border ${
                                        isSelected
                                          ? 'bg-purple-600 text-white border-purple-600'
                                          : 'bg-white hover:bg-gray-100'
                                      }`}
                                    >
                                      {dateObj.getDate()}
                                    </button>
                                  );
                                })}
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
