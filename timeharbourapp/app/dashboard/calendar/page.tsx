'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';
import googleCalendarPlugin from '@fullcalendar/google-calendar';
import type { EventInput, DateSelectArg, EventClickArg, DatesSetArg, EventMountArg } from '@fullcalendar/core';
import { DateTime } from 'luxon';
import { CalendarDays, Link2, Link2Off, Loader2 } from 'lucide-react';
import { Button, Card, CardContent, Badge, Text, SmallMuted } from '@mieweb/ui';
import {
  fetchActivitiesByDateRange,
  type Activity,
} from '@/TimeharborAPI/dashboard';
import './calendar.scss';

/* ── Google Calendar configuration ──────────────────────── */
const GOOGLE_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_CALENDAR_API_KEY ?? '';
const GOOGLE_CAL_ID = process.env.NEXT_PUBLIC_GOOGLE_CALENDAR_ID ?? '';

/* ── helpers ────────────────────────────────────────────── */
function activityToEvent(a: Activity): EventInput {
  const classNames: string[] = [];
  const type = a.type?.toUpperCase() ?? '';

  if (type.includes('CLOCK') || type.includes('SESSION')) {
    classNames.push('fc-event--clock-in');
  } else if (type.includes('BREAK')) {
    classNames.push('fc-event--break');
  } else if (type.includes('TICKET') || a.subtitle) {
    classNames.push('fc-event--ticket');
  }

  return {
    id: a.id,
    title: a.subtitle || a.title,
    start: a.startTime,
    end: a.endTime ?? undefined,
    classNames,
    extendedProps: {
      description: a.description,
      status: a.status,
      type: a.type,
      link: a.link,
      durationMs: a.durationMs,
    },
  };
}

function formatMs(ms: number): string {
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/* ── component ──────────────────────────────────────────── */
export default function CalendarPage() {
  const calendarRef = useRef<FullCalendar>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [googleSynced, setGoogleSynced] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<EventInput | null>(null);
  const [dateWindow, setDateWindow] = useState<{ start: string; end: string } | null>(null);

  /* ── fetch activities when visible date range changes ── */
  const loadActivities = useCallback(async (start: string, end: string) => {
    setIsLoading(true);
    try {
      const data = await fetchActivitiesByDateRange('', start, end);
      setActivities(data);
    } catch (err) {
      console.error('Failed to load calendar activities:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (dateWindow) {
      loadActivities(dateWindow.start, dateWindow.end);
    }
  }, [dateWindow, loadActivities]);

  const handleDatesSet = useCallback((arg: DatesSetArg) => {
    const start = DateTime.fromJSDate(arg.start).toISO() ?? '';
    const end = DateTime.fromJSDate(arg.end).toISO() ?? '';
    setDateWindow({ start, end });
  }, []);

  /* ── map activities → events ──────────────────────────── */
  const events = useMemo<EventInput[]>(
    () => activities.map(activityToEvent),
    [activities],
  );

  /* ── google calendar event source ──────────────────── */
  const googleEventSource = useMemo(() => {
    if (!googleSynced || !GOOGLE_API_KEY || !GOOGLE_CAL_ID) return [];
    return [
      {
        googleCalendarId: GOOGLE_CAL_ID,
        className: 'fc-event--google',
      },
    ];
  }, [googleSynced]);

  /* ── event click ──────────────────────────────────────── */
  const handleEventClick = useCallback((info: EventClickArg) => {
    // Prevent default navigation for Google Calendar events
    if (info.event.source?.internalEventSource?.meta?.googleCalendarId) {
      info.jsEvent.preventDefault();
    }

    setSelectedEvent({
      id: info.event.id,
      title: info.event.title,
      start: info.event.startStr,
      end: info.event.endStr,
      extendedProps: info.event.extendedProps,
    });
  }, []);

  /* ── magnify tooltip for cramped time-grid events ──── */
  const handleEventDidMount = useCallback((info: EventMountArg) => {
    // Only add tooltip to time-grid events
    if (!info.el.closest('.fc-timegrid-body')) return;

    const title = info.event.title || '';
    const start = info.event.start
      ? DateTime.fromJSDate(info.event.start).toFormat('h:mm a')
      : '';
    const end = info.event.end
      ? DateTime.fromJSDate(info.event.end).toFormat('h:mm a')
      : '';
    const type = info.event.extendedProps?.type || '';
    const durationMs = info.event.extendedProps?.durationMs;

    const tooltip = document.createElement('div');
    tooltip.className = 'fc-event-magnify';
    tooltip.setAttribute('aria-hidden', 'true');

    let html = `<div class="fc-magnify-title">${title}</div>`;
    if (start) {
      html += `<div class="fc-magnify-time">${start}${end ? ` – ${end}` : ''}`;
      if (durationMs) html += ` · ${formatMs(durationMs)}`;
      html += `</div>`;
    }
    if (type) {
      html += `<span class="fc-magnify-type">${type}</span>`;
    }
    tooltip.innerHTML = html;
    info.el.appendChild(tooltip);

    // Flip tooltip below if event is near the top of the grid
    const rect = info.el.getBoundingClientRect();
    if (rect.top < 180) {
      info.el.classList.add('fc-timegrid-event--flip-tooltip');
    }
    // Align left if near left edge
    if (rect.left < 80) {
      info.el.classList.add('fc-timegrid-event--align-left');
    }
  }, []);

  /* ── date select (placeholder for future event creation) */
  const handleDateSelect = useCallback((_info: DateSelectArg) => {
    // Future: open event creation dialog
  }, []);

  /* ── toggle Google sync ───────────────────────────────── */
  const toggleGoogleSync = () => {
    if (!GOOGLE_API_KEY || !GOOGLE_CAL_ID) {
      alert('Set NEXT_PUBLIC_GOOGLE_CALENDAR_API_KEY and NEXT_PUBLIC_GOOGLE_CALENDAR_ID in your .env to enable Google Calendar sync.');
      return;
    }
    setGoogleSynced((prev) => !prev);
  };

  /* ── today shortcut ───────────────────────────────────── */
  const goToday = () => calendarRef.current?.getApi().today();

  /* ── render ───────────────────────────────────────────── */
  return (
    <div className="calendar-page max-w-7xl mx-auto px-0 py-2 space-y-4">
      {/* ── Header Bar ───────────────────────────────── */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CalendarDays className="w-5 h-5 text-primary-600 dark:text-primary-400" />
          <Text size="xl" weight="bold">Calendar</Text>
          {isLoading && (
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" aria-label="Loading calendar events" />
          )}
        </div>

        <Button
          size="sm"
          variant={googleSynced ? 'primary' : 'outline'}
          onClick={toggleGoogleSync}
          aria-label={googleSynced ? 'Disconnect Google Calendar' : 'Connect Google Calendar'}
        >
          {googleSynced ? (
            <><Link2 className="w-4 h-4" /> Google Connected</>
          ) : (
            <><Link2Off className="w-4 h-4" /> Sync Google</>
          )}
        </Button>
      </div>

      {/* ── Calendar ─────────────────────────────────── */}
      <div>
          <FullCalendar
            ref={calendarRef}
            plugins={[
              dayGridPlugin,
              timeGridPlugin,
              listPlugin,
              interactionPlugin,
              ...(GOOGLE_API_KEY ? [googleCalendarPlugin] : []),
            ]}
            initialView="dayGridMonth"
            headerToolbar={{
              left: 'prev,next',
              center: 'title',
              right: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek',
            }}
            buttonText={{
              month: 'Month',
              week: 'Week',
              day: 'Day',
              list: 'List',
            }}
            events={events}
            eventSources={googleEventSource}
            googleCalendarApiKey={GOOGLE_API_KEY || undefined}
            /* interaction */
            selectable
            selectMirror
            select={handleDateSelect}
            eventClick={handleEventClick}
            eventDidMount={handleEventDidMount}
            /* responsive */
            height="auto"
            contentHeight="auto"
            expandRows
            stickyHeaderDates
            dayMaxEventRows={3}
            moreLinkClick="popover"
            /* time */
            nowIndicator
            slotMinTime="06:00:00"
            slotMaxTime="22:00:00"
            /* data range */
            datesSet={handleDatesSet}
            /* accessibility */
            navLinks
            dayHeaderFormat={{ weekday: 'short', day: 'numeric' }}
            /* mobile – swap default view on small screens */
            windowResize={(arg) => {
              const api = arg.view.calendar;
              if (window.innerWidth < 768) {
                if (api.view.type === 'dayGridMonth') api.changeView('listWeek');
              }
            }}
          />
      </div>

      {/* ── Event Detail Panel ───────────────────────── */}
      {selectedEvent && (
        <Card>
          <CardContent>
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1 min-w-0">
                <Text size="lg" weight="semibold" className="truncate">
                  {selectedEvent.title as string}
                </Text>

                <SmallMuted>
                  {selectedEvent.start
                    ? DateTime.fromISO(selectedEvent.start as string).toFormat('EEE, MMM d · h:mm a')
                    : ''}
                  {selectedEvent.end
                    ? ` – ${DateTime.fromISO(selectedEvent.end as string).toFormat('h:mm a')}`
                    : ''}
                </SmallMuted>

                {selectedEvent.extendedProps?.description && (
                  <Text size="sm" variant="muted" className="mt-2">
                    {selectedEvent.extendedProps.description}
                  </Text>
                )}

                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  {selectedEvent.extendedProps?.type && (
                    <Badge variant="default" size="sm">
                      {selectedEvent.extendedProps.type}
                    </Badge>
                  )}
                  {selectedEvent.extendedProps?.status && (
                    <Badge
                      variant={
                        selectedEvent.extendedProps.status === 'Active'
                          ? 'success'
                          : selectedEvent.extendedProps.status === 'Pending'
                            ? 'warning'
                            : 'secondary'
                      }
                      size="sm"
                    >
                      {selectedEvent.extendedProps.status}
                    </Badge>
                  )}
                  {selectedEvent.extendedProps?.durationMs && (
                    <Badge variant="outline" size="sm">
                      {formatMs(selectedEvent.extendedProps.durationMs)}
                    </Badge>
                  )}
                </div>
              </div>

              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSelectedEvent(null)}
                aria-label="Close event details"
              >
                ✕
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
