// Tomorrow AI Event-Based Demand Forecasting Page
// Event-based demand forecasting for Monginis

"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Brain, Calendar, RefreshCw, AlertCircle, CheckCircle, ArrowRight, TrendingUp } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

interface Event {
  id: number;
  event_name: string;
  event_type: string;
  event_date: string;
  year: number;
  description: string;
  days_to_go: number;
}

interface Forecast {
  product_id: string;
  product_name: string;
  ml_group_id: string;
  prediction: number;
  recommended_order: number;
  historical: {
    2024: number | null;
    2025: number | null;
    2026: number | null;
    2027: number | null;
  };
}

interface EventPattern {
  event: Event;
  pattern: Record<number, number | null>;
}

export default function TomorrowAIPage() {
  const { user } = useAuth();
  const [view, setView] = useState<"events" | "forecast">("events");
  const [nextEvent, setNextEvent] = useState<Event | null>(null);
  const [upcomingEvents, setUpcomingEvents] = useState<Event[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [forecasts, setForecasts] = useState<Forecast[]>([]);
  const [eventPattern, setEventPattern] = useState<EventPattern | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [syncStatus, setSyncStatus] = useState<{ message: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    fetchNextEvent();
    fetchUpcomingEvents();
  }, []);

  const fetchNextEvent = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/tomorrow-ai/events/next`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setNextEvent(data.data);
      }
    } catch (error) {
      console.error('Error fetching next event:', error);
    }
  };

  const fetchUpcomingEvents = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/tomorrow-ai/events/upcoming?limit=10`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setUpcomingEvents(data.data);
      }
    } catch (error) {
      console.error('Error fetching upcoming events:', error);
    }
  };

  const fetchEventForecast = async (event: Event) => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/tomorrow-ai/events/forecast?eventName=${event.event_name}&year=${event.year}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setForecasts(data.data.forecasts);
        setSelectedEvent(data.data.event);
        setView("forecast");
      }
    } catch (error) {
      console.error('Error fetching event forecast:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchEventPattern = async (event: Event, mlGroupId: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/tomorrow-ai/events/pattern?eventName=${event.event_name}&mlGroupId=${mlGroupId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setEventPattern(data.data);
      }
    } catch (error) {
      console.error('Error fetching event pattern:', error);
    }
  };

  const triggerHistoricalSync = async () => {
    setIsLoading(true);
    setSyncStatus(null);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/tomorrow-ai/sync/historical`, {
        method: 'POST',
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      const data = await response.json();
      if (data.success) {
        setSyncStatus({ message: `Historical sync completed: ${data.data.totalRecords} records`, type: "success" });
      } else {
        setSyncStatus({ message: data.error || "Sync failed", type: "error" });
      }
    } catch (error: any) {
      setSyncStatus({ message: error.message || "Sync failed", type: "error" });
    } finally {
      setIsLoading(false);
    }
  };

  const getEventEmoji = (eventName: string) => {
    const name = eventName.toLowerCase();
    if (name.includes('valentine')) return '❤️';
    if (name.includes('holi')) return '🎨';
    if (name.includes('diwali')) return '🪔';
    if (name.includes('christmas')) return '🎄';
    if (name.includes('new year')) return '🎉';
    if (name.includes('mother')) return '🌸';
    if (name.includes('father')) return '👨';
    if (name.includes('eid')) return '🌙';
    if (name.includes('independence')) return '🇮🇳';
    if (name.includes('raksha')) return '🧵';
    return '🎉';
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  return (
    <main className="container mx-auto px-4 py-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="h-6 w-6 text-purple-600" />
                  Tomorrow AI
                </CardTitle>
                <CardDescription>
                  Event-based demand forecasting
                </CardDescription>
              </div>
              <Badge variant="outline" className="text-purple-600 border-purple-600">
                Admin Only
              </Badge>
            </div>
          </CardHeader>
        </Card>

        {/* Sync Status */}
        {syncStatus && (
          <Alert variant={syncStatus.type === "success" ? "default" : "destructive"}>
            {syncStatus.type === "success" ? (
              <CheckCircle className="h-4 w-4" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
            <AlertDescription>{syncStatus.message}</AlertDescription>
          </Alert>
        )}

        {/* Events View */}
        {view === "events" && (
          <div className="space-y-6">
            {/* Next Event Card */}
            {nextEvent && (
              <Card className="bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-2xl">
                    🎉 Next Event
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-8">
                    <div className="text-4xl mb-4">{getEventEmoji(nextEvent.event_name)}</div>
                    <h2 className="text-3xl font-bold mb-2">{nextEvent.event_name}</h2>
                    <div className="text-5xl font-bold text-purple-600 mb-2">{nextEvent.days_to_go}</div>
                    <div className="text-xl text-muted-foreground mb-4">DAYS TO GO</div>
                    <div className="text-lg font-medium mb-6">{formatDate(nextEvent.event_date)}</div>
                    <Button 
                      size="lg" 
                      onClick={() => fetchEventForecast(nextEvent)}
                      disabled={isLoading}
                      className="bg-purple-600 hover:bg-purple-700"
                    >
                      View Forecast <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Upcoming Events */}
            <Card>
              <CardHeader>
                <CardTitle>Upcoming Events</CardTitle>
                <CardDescription>
                  Click on any event to view its demand forecast
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {upcomingEvents.map((event) => (
                    <div
                      key={event.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => fetchEventForecast(event)}
                    >
                      <div className="flex items-center gap-4">
                        <div className="text-3xl">{getEventEmoji(event.event_name)}</div>
                        <div>
                          <div className="font-semibold text-lg">{event.event_name}</div>
                          <div className="text-sm text-muted-foreground">{formatDate(event.event_date)}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <Badge variant="outline" className="text-purple-600 border-purple-600">
                          {event.days_to_go} days
                        </Badge>
                        <Button size="sm" variant="ghost">
                          <ArrowRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Data Sync */}
            <Card>
              <CardHeader>
                <CardTitle>Data Sync</CardTitle>
                <CardDescription>
                  Sync invoice/CRDR data to Tomorrow AI tables
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={triggerHistoricalSync}
                  disabled={isLoading}
                  className="w-full"
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                  Full Historical Sync
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Forecast View */}
        {view === "forecast" && selectedEvent && (
          <div className="space-y-6">
            {/* Back Button */}
            <Button variant="ghost" onClick={() => setView("events")}>
              ← Back to Events
            </Button>

            {/* Event Header */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-4">
                  <div className="text-5xl">{getEventEmoji(selectedEvent.event_name)}</div>
                  <div>
                    <CardTitle className="text-3xl">{selectedEvent.event_name} {selectedEvent.year}</CardTitle>
                    <CardDescription className="text-lg">{formatDate(selectedEvent.event_date)}</CardDescription>
                  </div>
                </div>
              </CardHeader>
            </Card>

            {/* Forecast Table */}
            <Card>
              <CardHeader>
                <CardTitle>Event Demand Forecast</CardTitle>
                <CardDescription>
                  Historical comparison and AI prediction for DISPLAY items
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead className="text-right">2027 Prediction</TableHead>
                      <TableHead className="text-right">2026</TableHead>
                      <TableHead className="text-right">2025</TableHead>
                      <TableHead className="text-right">2024</TableHead>
                      <TableHead className="text-right">Recommended Order</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {forecasts.map((forecast, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{forecast.product_name}</TableCell>
                        <TableCell className="text-right font-bold text-purple-600">
                          {forecast.prediction}
                        </TableCell>
                        <TableCell className="text-right">
                          {forecast.historical[2026] !== null ? forecast.historical[2026] : '—'}
                        </TableCell>
                        <TableCell className="text-right">
                          {forecast.historical[2025] !== null ? forecast.historical[2025] : '—'}
                        </TableCell>
                        <TableCell className="text-right">
                          {forecast.historical[2024] !== null ? forecast.historical[2024] : '—'}
                        </TableCell>
                        <TableCell className="text-right font-bold text-green-600">
                          {forecast.recommended_order}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* 7-Day Pattern */}
            {eventPattern && (
              <Card>
                <CardHeader>
                  <CardTitle>7-Day Event Pattern</CardTitle>
                  <CardDescription>
                    Average demand leading up to the event
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between px-4">
                    {[-7, -6, -5, -4, -3, -2, -1, 0].map((day) => (
                      <div key={day} className="text-center">
                        <div className="text-sm text-muted-foreground mb-2">
                          {day === 0 ? 'Event' : `${Math.abs(day)}d`}
                        </div>
                        <div className="w-12 h-12 flex items-center justify-center rounded-full bg-purple-100 text-purple-600 font-bold">
                          {eventPattern.pattern[day] !== null ? eventPattern.pattern[day] : '—'}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 text-center text-sm text-muted-foreground">
                    Days relative to event
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
