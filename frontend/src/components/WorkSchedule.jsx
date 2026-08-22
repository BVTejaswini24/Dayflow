// src/components/WorkSchedule.jsx
// Displays a horizontal weekly timeline of the employee's attendance/schedule.
// Uses existing /attendance/me API — no new backend changes needed.

import { useEffect, useState } from 'react';
import api from '../api.js';

/** Returns an array of 7 Date objects for the week containing `date` (Sun–Sat). */
function getWeekDays(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay(); // 0 = Sun
  const sunday = new Date(d);
  sunday.setDate(d.getDate() - day);
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(sunday);
    day.setDate(sunday.getDate() + i);
    return day;
  });
}

/** "2026-08-16" */
function toISO(date) {
  return date.toISOString().slice(0, 10);
}

/** "Sun", "Mon" … */
function dayName(date) {
  return date.toLocaleDateString('en-IN', { weekday: 'short' });
}

/** Format decimal hours → "2:45 Hrs" */
function fmtHours(h) {
  if (!h || h <= 0) return null;
  const hours = Math.floor(h);
  const mins = Math.round((h - hours) * 60);
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')} Hrs`;
}

/** "16 Aug 2026 – 22 Aug 2026" */
function weekRange(days) {
  const opts = { day: 'numeric', month: 'short', year: 'numeric' };
  return `${days[0].toLocaleDateString('en-IN', opts)} – ${days[6].toLocaleDateString('en-IN', opts)}`;
}

const WEEKEND_DAYS = new Set([0, 6]); // Sunday = 0, Saturday = 6

export default function WorkSchedule() {
  const [records, setRecords] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [error, setError] = useState('');

  const today = new Date();
  const weekDays = getWeekDays(today);

  // Fetch attendance for current month (covers the whole visible week)
  useEffect(() => {
    const month = today.getMonth() + 1;
    const year = today.getFullYear();

    api.get('/attendance/me', { params: { month, year } })
      .then(({ data }) => setRecords(data.records || []))
      .catch((e) => setError(e.message));

    api.get('/leave/me')
      .then(({ data }) => setLeaves(data.leaves || []))
      .catch(() => {}); // non-critical
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /** Compute display info for a single day */
  function getDayInfo(date) {
    const iso = toISO(date);
    const isWeekend = WEEKEND_DAYS.has(date.getDay());
    const isToday = iso === toISO(today);

    // Check for an approved leave on this date
    const onLeave = leaves.some(
      (l) =>
        l.status === 'Approved' &&
        l.startDate <= iso &&
        l.endDate >= iso
    );

    // Find attendance record
    const rec = records.find((r) => r.date === iso);

    if (isWeekend) {
      return { status: 'Weekend', hours: null, isToday };
    }
    if (onLeave) {
      return { status: 'Leave', hours: null, isToday };
    }
    if (rec?.checkIn) {
      const hoursLabel = fmtHours(rec.workHours);
      return { status: rec.status || 'Present', hours: hoursLabel, isToday };
    }
    // Future days — don't mark absent yet
    if (date > today) {
      return { status: 'Scheduled', hours: null, isToday };
    }
    return { status: 'Absent', hours: null, isToday };
  }

  return (
    <div className="section-card work-schedule-card">
      {/* ── Header ── */}
      <div className="ws-header">
        <div className="ws-title-group">
          {/* Calendar/Schedule icon reusing existing SVG style */}
          <span className="ws-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <rect x="3" y="4" width="18" height="17" rx="2" stroke="currentColor" strokeWidth="1.6" />
              <path d="M3 9h18M8 2v4M16 2v4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              <circle cx="8" cy="14" r="1.2" fill="currentColor" />
              <circle cx="12" cy="14" r="1.2" fill="currentColor" />
              <circle cx="16" cy="14" r="1.2" fill="currentColor" />
            </svg>
          </span>
          <div>
            <h3 className="ws-heading">Work Schedule</h3>
            <span className="ws-range muted">{weekRange(weekDays)}</span>
          </div>
        </div>
        <div className="ws-shift-badge">
          <span className="ws-shift-label">General</span>
          <span className="ws-shift-time">9:00 AM – 6:00 PM</span>
        </div>
      </div>

      {error && <div className="alert alert-error" style={{ marginTop: 12, marginBottom: 0 }}>{error}</div>}

      {/* ── Weekly timeline ── */}
      <div className="ws-timeline-wrap">
        <div className="ws-timeline">
          {weekDays.map((date, i) => {
            const { status, hours, isToday } = getDayInfo(date);
            return (
              <div
                key={i}
                className={`ws-day${isToday ? ' ws-day--today' : ''}`}
              >
                {/* Connector line + dot */}
                <div className="ws-track">
                  <div className={`ws-dot ws-dot--${status.toLowerCase()}`} />
                  {i < 6 && <div className="ws-line" />}
                </div>

                {/* Day label */}
                <div className="ws-day-name">{dayName(date)}</div>
                <div className="ws-day-num">{date.getDate()}</div>

                {/* Status chip */}
                <span className={`ws-chip ws-chip--${status.toLowerCase()}`}>
                  {status}
                </span>

                {/* Work hours (only when present & worked) */}
                {hours && <span className="ws-hours">{hours}</span>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
