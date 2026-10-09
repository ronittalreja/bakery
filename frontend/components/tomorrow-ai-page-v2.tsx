// Events AI V2 - Robust Event-Based Demand Forecasting Page
// Enhanced with comprehensive error handling and fallbacks

"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Brain, Calendar, RefreshCw, AlertCircle, CheckCircle, ArrowRight, TrendingUp, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { usePersistedState } from "@/hooks/use-persisted-state";

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
  historical: Record<number, number | null>;
}

interface EventPattern {
  event: Event;
  pattern: Record<number, number | null>;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

type ViewState = "events" | "forecast" | "error";

export default function TomorrowAIPageV2() {
  const { user } = useAuth();
  const [view, setView] = usePersistedState<ViewState>("tomorrow_ai_v2_view", "events");
  const [nextEvent, setNextEvent] = useState<Event | null>(null);
  const [upcomingEvents, setUpcomingEvents] = useState<Event[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [forecasts, setForecasts] = useState<Forecast[]>([]);
  const [eventPattern, setEventPattern] = useState<EventPattern | null>(null);
  const [yearWindow, setYearWindow] = useState<{ prediction_year: number; historical_years: number[] } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [syncProgress, setSyncProgress] = useState<any>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [isMounted, setIsMounted] = useState(true);
  const [lastRequestTime, setLastRequestTime] = useState<number>(0);
  const [requestQueue, setRequestQueue] = useState<number>(0);
  const [cache, setCache] = useState<Map<string, any>>(new Map());
  const [cacheTimestamp, setCacheTimestamp] = useState<number>(0);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
  const MAX_RETRIES = 3;
  const API_TIMEOUT = 15000; // 15 seconds (increased for slow connections)
  const REQUEST_COOLDOWN = 1000; // 1 second between requests (increased)
  const MAX_CONCURRENT_REQUESTS = 3; // Reduced to prevent overwhelming server
  const CACHE_TTL = 60000; // 1 minute cache

  // Robust API fetch with timeout and retry
  const fetchWithTimeout = async (url: string, options: RequestInit = {}, timeout = API_TIMEOUT): Promise<Response> => {
    // Rate limiting: check cooldown
    const now = Date.now();
    const timeSinceLastRequest = now - lastRequestTime;
    
    if (timeSinceLastRequest < REQUEST_COOLDOWN) {
      const waitTime = REQUEST_COOLDOWN - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    // Check concurrent request limit
    if (requestQueue >= MAX_CONCURRENT_REQUESTS) {
      throw new Error('Too many concurrent requests. Please wait.');
    }
    
    setRequestQueue(prev => prev + 1);
    setLastRequestTime(Date.now());
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    } finally {
      setRequestQueue(prev => Math.max(0, prev - 1));
    }
  };

  // Robust API call with error handling and caching
  const apiCall = async <T,>(
    endpoint: string,
    options: RequestInit = {},
    useCache = true
  ): Promise<ApiResponse<T>> => {
    // Check cache first
    if (useCache) {
      const now = Date.now();
      const cacheKey = endpoint;
      const cached = cache.get(cacheKey);
      
      if (cached && (now - cacheTimestamp < CACHE_TTL)) {
        console.log(`Cache hit [${endpoint}]`);
        return cached;
      }
    }
    
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('No authentication token found');
      }

      const response = await fetchWithTimeout(
        `${API_URL}${endpoint}`,
        {
          ...options,
          headers: {
            ...options.headers,
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log(`API Response [${endpoint}]:`, data);
      
      // Cache the response
      if (useCache && data.success) {
        setCache(prev => new Map(prev).set(endpoint, data));
        setCacheTimestamp(Date.now());
      }
      
      return data;
    } catch (error: any) {
      console.error(`API Error [${endpoint}]:`, error);
      if (error.name === 'AbortError') {
        return { success: false, error: 'Request timeout. Please try again.' };
      }
      return { success: false, error: error.message || 'Failed to fetch data' };
    }
  };

  const fetchNextEvent = useCallback(async () => {
    if (!isMounted) return;
    try {
      const result = await apiCall<Event>('/api/tomorrow-ai/events/next');
      if (isMounted && result.success && result.data) {
        setNextEvent(result.data);
      }
    } catch (error) {
      console.error('Error fetching next event:', error);
    }
  }, [isMounted]);

  const fetchUpcomingEvents = useCallback(async () => {
    if (!isMounted) return;
    try {
      const result = await apiCall<Event[]>('/api/tomorrow-ai/events/upcoming?limit=3');
      if (isMounted && result.success && result.data) {
        setUpcomingEvents(result.data);
      }
    } catch (error) {
      console.error('Error fetching upcoming events:', error);
    }
  }, [isMounted]);

  const fetchEventForecast = async (event: Event) => {
    if (!isMounted) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await apiCall<any>(
        `/api/tomorrow-ai/events/forecast?eventName=${encodeURIComponent(event.event_name)}&year=${event.year}`
      );
      
      if (isMounted && result.success && result.data) {
        setForecasts(result.data.forecasts || []);
        setSelectedEvent(result.data.event || event);
        setYearWindow(result.data.year_window || null);
        setView("forecast");
      } else if (isMounted) {
        setError(result.error || 'Failed to fetch forecast data');
      }
    } catch (error: any) {
      console.error('Error fetching event forecast:', error);
      if (isMounted) {
        setError(error.message || 'Failed to fetch forecast data');
      }
    } finally {
      if (isMounted) {
        setIsLoading(false);
      }
    }
  };

  const fetchEventPattern = async (event: Event, mlGroupId: string) => {
    try {
      const result = await apiCall<EventPattern>(
        `/api/tomorrow-ai/events/pattern?eventName=${encodeURIComponent(event.event_name)}&year=${event.year}&mlGroupId=${mlGroupId}`
      );
      if (result.success && result.data) {
        setEventPattern(result.data);
      }
    } catch (error) {
      console.error('Error fetching event pattern:', error);
    }
  };

  const fetchSyncProgress = async () => {
    try {
      const result = await apiCall<any>('/api/tomorrow-ai/sync/progress');
      if (result.success && result.data) {
        setSyncProgress(result.data);
      }
    } catch (error) {
      console.error('Error fetching sync progress:', error);
    }
  };

  const triggerHistoricalSync = async () => {
    setIsLoading(true);
    setIsSyncing(true);
    setSyncStatus(null);
    setSyncProgress(null);
    try {
      const result = await apiCall<any>('/api/tomorrow-ai/sync/historical', {
        method: 'POST',
      });
      
      if (result.success && result.data) {
        setSyncStatus({
          message: `Sync completed: ${result.data.datesProcessed} dates processed, ${result.data.totalRecords} records inserted, ${result.data.aliasMatches} matched via aliases, ${result.data.skippedProducts} skipped (not in product master)`,
          type: "success"
        });
      } else {
        setSyncStatus({ message: result.error || "Sync failed", type: "error" });
      }
    } catch (error: any) {
      setSyncStatus({ message: error.message || "Sync failed", type: "error" });
    } finally {
      setIsLoading(false);
      setIsSyncing(false);
    }
  };

  const handleRetry = () => {
    setRetryCount(prev => prev + 1);
    setError(null);
    setIsInitialLoading(true);
    Promise.all([fetchNextEvent(), fetchUpcomingEvents()])
      .finally(() => setIsInitialLoading(false));
  };

  useEffect(() => {
    setIsMounted(true);
    setRetryCount(0);
    // Clear cache on mount to ensure fresh data
    setCache(new Map());
    setCacheTimestamp(0);
    
    const loadData = async () => {
      setIsInitialLoading(true);
      setError(null);
      try {
        await Promise.all([fetchNextEvent(), fetchUpcomingEvents()]);
      } catch (error) {
        console.error('Error loading initial data:', error);
        if (isMounted) {
          setError('Failed to load events data. Please try again.');
        }
      } finally {
        if (isMounted) {
          setIsInitialLoading(false);
        }
      }
    };
    loadData();

    // Poll sync progress every 2 seconds if syncing
    const interval = setInterval(() => {
      if (isSyncing && isMounted) {
        fetchSyncProgress();
      }
    }, 2000);

    return () => {
      setIsMounted(false);
      clearInterval(interval);
    };
  }, [isSyncing, fetchNextEvent, fetchUpcomingEvents]);

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
    if (name.includes('christmas')) return '🎄';
    return '🎉';
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
    } catch (error) {
      return dateString;
    }
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
                  Events AI V2
                </CardTitle>
                <CardDescription>
                  Robust event-based demand forecasting
                </CardDescription>
              </div>
              <Badge variant="outline" className="text-purple-600 border-purple-600">
                Admin Only
              </Badge>
            </div>
          </CardHeader>
        </Card>

        {/* Loading State */}
        {isInitialLoading && (
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin text-purple-600 mx-auto mb-4" />
                <p className="text-muted-foreground">Loading events...</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Error State with Retry */}
        {error && !isInitialLoading && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between">
              <span>{error}</span>
              <Button
                size="sm"
                variant="outline"
                onClick={handleRetry}
                disabled={retryCount >= MAX_RETRIES}
                className="ml-4"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry {retryCount > 0 && `(${retryCount}/${MAX_RETRIES})`}
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Sync Status */}
        {syncStatus && !isInitialLoading && (
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
        {view === "events" && !isInitialLoading && !error && (
          <div className="space-y-6">
            {/* Next Event Card */}
            {nextEvent ? (
              <Card className="bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-xl">
                    🎉 Next Event
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-4">
                    <div className="text-3xl mb-2">{getEventEmoji(nextEvent.event_name)}</div>
                    <h2 className="text-2xl font-bold mb-1">{nextEvent.event_name}</h2>
                    <div className="text-4xl font-bold text-purple-600 mb-1">{nextEvent.days_to_go}</div>
                    <div className="text-sm text-muted-foreground mb-3">DAYS TO GO</div>
                    <div className="text-base font-medium mb-4">{formatDate(nextEvent.event_date)}</div>
                    <Button 
                      size="default" 
                      onClick={() => fetchEventForecast(nextEvent)}
                      disabled={isLoading}
                      className="bg-purple-600 hover:bg-purple-700"
                    >
                      {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                      View Forecast <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-lg font-medium mb-2">No upcoming events</p>
                    <p className="text-muted-foreground">Add events in the Manage Events page</p>
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
                {upcomingEvents.length > 0 ? (
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
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No upcoming events available
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Data Sync */}
            <Card>
              <CardHeader>
                <CardTitle>Data Sync</CardTitle>
                <CardDescription>
                  Sync invoice/CRDR data to Events AI tables
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {isSyncing && syncProgress && (
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <RefreshCw className="h-4 w-4 animate-spin text-blue-600" />
                      <span className="font-medium text-blue-900">Sync in progress...</span>
                    </div>
                    <div className="text-sm text-blue-700">
                      {syncProgress.records_processed} records processed
                    </div>
                  </div>
                )}
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
                {forecasts.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead className="text-right">{yearWindow?.prediction_year} Expected</TableHead>
                        {yearWindow?.historical_years.map(year => (
                          <TableHead key={year} className="text-right">{year}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {forecasts.map((forecast, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-medium">{forecast.product_name}</TableCell>
                          <TableCell className="text-right font-bold text-green-600">
                            {forecast.prediction}
                          </TableCell>
                          {yearWindow?.historical_years.map(year => (
                            <TableCell key={year} className="text-right">
                              {forecast.historical[year] !== null ? forecast.historical[year] : '—'}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No forecast data available
                  </div>
                )}
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

        {/* Error View */}
        {view === "error" && (
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <div className="text-center">
                <AlertCircle className="h-12 w-12 text-red-600 mx-auto mb-4" />
                <p className="text-lg font-medium mb-2">Something went wrong</p>
                <p className="text-muted-foreground mb-4">{error}</p>
                <Button onClick={() => setView("events")}>
                  Back to Events
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}
