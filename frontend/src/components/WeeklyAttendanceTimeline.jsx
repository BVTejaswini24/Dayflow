// src/components/WeeklyAttendanceTimeline.jsx
// Detailed weekly attendance timeline for the employee Attendance page.
// Reuses /attendance/me and /leave/me APIs — no new backend changes.

import { useEffect, useState } from 'react';
import api from '../api.js';

// ─── Constants ────────────────────────────────────────────────────────────────

const WEEKEND_DAYS = new Set([0, 6]); // 0 = Sun, 6 = Sat

// Work-schedule window (General shift) — matches WorkSchedule component
const SCHEDULE_START_H = 9;   // 09:00
const SCHEDULE_END_H   = 18;  // 18:00
const TIME_SCALE_HOURS = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18];

// ─── Pure helpers ──────────────────────────────────────────────────────────────

/** "2026-08-16" from a Date */
function toISO(date) {
  return date.toISOString().slice(0, 10);
}

/** Returns Mon-Sun (index 0-6) array of Date objects for the week containing `ref`. */
function getWeekDays(ref = new Date()) {
  const d    = new Date(ref);
  const dow  = d.getDay();            // 0 = Sun
  const sun  = new Date(d);
  sun.setDate(d.getDate() - dow);     // back to Sunday
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(sun);
    day.setDate(sun.getDate() + i);
    return day;
  });
}

/** "Sun", "Mon" … */
function shortDay(date) {
  return date.toLocaleDateString('en-IN', { weekday: 'short' });
}

/**
 * Parse "HH:MM" → total minutes since midnight.
 * Returns null if the string is missing or malformed.
 */
function parseTime(hhmm) {
  if (!hhmm || typeof hhmm !== 'string') return null;
  const [h, m] = hhmm.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

/** "09:05" → "09:05 AM" / "13:30" → "01:30 PM" */
function to12h(hhmm) {
  const mins = parseTime(hhmm);
  if (mins === null) return hhmm;
  const h   = Math.floor(mins / 60);
  const m   = mins % 60;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hh   = h % 12 || 12;
  return `${String(hh).padStart(2, '0')}:${String(m).padStart(2, '0')} ${ampm}`;
}

/**
 * Format decimal work-hours → "11:11 Hrs".
 * Always returns a string (shows "00:00 Hrs" for 0/null).
 */
function fmtWorkHours(h) {
  const val   = Number(h) || 0;
  const hours = Math.floor(val);
  const mins  = Math.round((val - hours) * 60);
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')} Hrs`;
}

/**
 * Given checkIn "HH:MM" and the schedule start (minutes), return a
 * human-readable "Late by HH:MM" string or null when on time / no data.
 */
function calcLate(checkIn) {
  const actual    = parseTime(checkIn);
  const scheduled = SCHEDULE_START_H * 60;          // 9:00 → 540 min
  if (actual === null || actual <= scheduled) return null;
  const diff = actual - scheduled;
  const lh   = Math.floor(diff / 60);
  const lm   = diff % 60;
  return `Late by ${String(lh).padStart(2, '0')}:${String(lm).padStart(2, '0')}`;
}

/**
 * Convert "HH:MM" to a 0–100 percentage within the schedule window
 * (09:00 → 0 %, 18:00 → 100 %).
 * Clamped to [0, 100].
 */
function timePct(hhmm) {
  const mins  = parseTime(hhmm);
  if (mins === null) return null;
  const start = SCHEDULE_START_H * 60;
  const end   = SCHEDULE_END_H   * 60;
  return Math.min(100, Math.max(0, ((mins - start) / (end - start)) * 100));
}

/** Format a scale hour (24h int) → "09 AM" / "01 PM" */
function scaleLabel(h) {
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hh   = h % 12 || 12;
  return `${String(hh).padStart(2, '0')} ${ampm}`;
}

// ─── Day-row sub-component ─────────────────────────────────────────────────────

function DayRow({ date, rec, leaveRec, isToday, todayRec }) {
  const isWeekend = WEEKEND_DAYS.has(date.getDay());
  const isFuture  = date > new Date(new Date().toDateString()); // after today (midnight)

  // ── Determine state ──────────────────────────────────────────────
  let state = 'absent';
  if (isWeekend)            state = 'weekend';
  else if (leaveRec)        state = 'leave';
  else if (rec?.checkIn)    state = rec.status === 'Half-day' ? 'half-day' : 'present';
  else if (isFuture)        state = 'scheduled';

  // Use todayRec for today if rec not yet available (in-progress check-in)
  const activeRec = (isToday && todayRec) ? todayRec : rec;

  const checkIn    = activeRec?.checkIn  || null;
  const checkOut   = activeRec?.checkOut || null;
  const workHours  = activeRec?.workHours ?? 0;
  const lateStr    = state === 'present' || state === 'half-day' ? calcLate(checkIn) : null;

  // ── Timeline bar positions ───────────────────────────────────────
  const inPct  = timePct(checkIn);
  const outPct = timePct(checkOut);
  // If checked in but not out yet (in progress), extend bar to "now" or end of window
  let barLeft  = inPct;
  let barWidth = null;
  if (inPct !== null) {
    const rightBound = outPct !== null ? outPct : (() => {
      if (isToday && !checkOut) {
        const nowMins = new Date().getHours() * 60 + new Date().getMinutes();
        return Math.min(100, Math.max(0,
          ((nowMins - SCHEDULE_START_H * 60) / ((SCHEDULE_END_H - SCHEDULE_START_H) * 60)) * 100
        ));
      }
      return inPct; // single dot
    })();
    barWidth = Math.max(0, rightBound - inPct);
  }

  // ── State → visual config ────────────────────────────────────────
  const stateConfig = {
    present:   { chipClass: 'wat-chip--present',   chipLabel: 'Present',   dotClass: 'wat-dot--present'   },
    'half-day':{ chipClass: 'wat-chip--half',      chipLabel: 'Half-day',  dotClass: 'wat-dot--half'      },
    absent:    { chipClass: 'wat-chip--absent',    chipLabel: 'Absent',    dotClass: 'wat-dot--absent'    },
    weekend:   { chipClass: 'wat-chip--weekend',   chipLabel: 'Weekend',   dotClass: 'wat-dot--weekend'   },
    leave:     { chipClass: 'wat-chip--leave',     chipLabel: 'On Leave',  dotClass: 'wat-dot--leave'     },
    scheduled: { chipClass: 'wat-chip--scheduled', chipLabel: 'Scheduled', dotClass: 'wat-dot--scheduled' },
  };
  const { chipClass, chipLabel, dotClass } = stateConfig[state] || stateConfig.absent;

  return (
    <div className={`wat-row${isToday ? ' wat-row--today' : ''}`}>
      {/* ── Col 1: Day label ── */}
      <div className="wat-day-col">
        <span className="wat-day-name">{shortDay(date)}</span>
        <span className={`wat-day-num${isToday ? ' wat-day-num--today' : ''}`}>
          {date.getDate()}
        </span>
        {isToday && <span className="wat-today-pill">Today</span>}
      </div>

      {/* ── Col 2: Check-in time ── */}
      <div className="wat-time-col wat-time-col--in">
        {checkIn
          ? <span className="wat-time">{to12h(checkIn)}</span>
          : <span className="wat-time wat-time--empty">—</span>
        }
        {lateStr && <span className="wat-late">{lateStr}</span>}
      </div>

      {/* ── Col 3: Timeline track ── */}
      <div className="wat-track-col">
        <div className="wat-track">
          {/* Shade the official schedule window */}
          <div className="wat-schedule-zone" />

          {/* Worked bar */}
          {barLeft !== null && barWidth !== null && (
            <div
              className={`wat-bar wat-bar--${state}`}
              style={{ left: `${barLeft}%`, width: `${Math.max(barWidth, 1)}%` }}
            />
          )}

          {/* Check-in dot */}
          {inPct !== null && (
            <div
              className={`wat-dot ${dotClass}`}
              style={{ left: `${inPct}%` }}
            />
          )}

          {/* Check-out dot */}
          {outPct !== null && (
            <div
              className={`wat-dot ${dotClass}`}
              style={{ left: `${outPct}%` }}
            />
          )}

          {/* Weekend / absent / leave label centred on track */}
          {(state === 'weekend' || state === 'absent' || state === 'leave' || state === 'scheduled') && (
            <div className="wat-track-label">
              <span className={`wat-chip ${chipClass}`}>{chipLabel}</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Col 4: Check-out time ── */}
      <div className="wat-time-col wat-time-col--out">
        {checkOut
          ? <span className="wat-time">{to12h(checkOut)}</span>
          : <span className="wat-time wat-time--empty">—</span>
        }
      </div>

      {/* ── Col 5: Work hours ── */}
      <div className="wat-hours-col">
        <span className={`wat-hours${workHours > 0 ? ' wat-hours--worked' : ''}`}>
          {fmtWorkHours(workHours)}
        </span>
        {(state === 'present' || state === 'half-day') && !checkOut && checkIn && (
          <span className="wat-in-progress">In progress</span>
        )}
      </div>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function WeeklyAttendanceTimeline({ records, todayRec }) {
  const [leaves, setLeaves]   = useState([]);

  useEffect(() => {
    api.get('/leave/me')
      .then(({ data }) => setLeaves(data.leaves || []))
      .catch(() => {});
  }, []);

  const today    = new Date();
  const weekDays = getWeekDays(today);
  const todayISO = toISO(today);

  // Build a quick-lookup map: ISO date → record
  const recMap = {};
  for (const r of records) recMap[r.date] = r;

  function getLeaveRec(iso) {
    return leaves.find(
      (l) => l.status === 'Approved' && l.startDate <= iso && l.endDate >= iso
    ) || null;
  }

  return (
    <div className="card wat-card">
      {/* ── Section header ── */}
      <div className="wat-header">
        <div className="wat-header-left">
          <span className="wat-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <rect x="3" y="4" width="18" height="17" rx="2"
                stroke="currentColor" strokeWidth="1.6" />
              <path d="M3 9h18M8 2v4M16 2v4"
                stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              <path d="M7 14h2M11 14h2M15 14h2"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </span>
          <div>
            <h3 className="wat-title">Weekly Attendance</h3>
            <span className="muted small">
              {weekDays[0].toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              {' – '}
              {weekDays[6].toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
          </div>
        </div>
        <div className="wat-schedule-badge">
          <span className="wat-schedule-name">General</span>
          <span className="wat-schedule-time">9:00 AM – 6:00 PM</span>
        </div>
      </div>

      {/* ── Column labels ── */}
      <div className="wat-col-labels">
        <div className="wat-day-col wat-col-label">Day</div>
        <div className="wat-time-col wat-col-label">Check In</div>
        <div className="wat-track-col wat-col-label">Timeline</div>
        <div className="wat-time-col wat-col-label">Check Out</div>
        <div className="wat-hours-col wat-col-label">Worked</div>
      </div>

      {/* ── Day rows ── */}
      <div className="wat-rows">
        {weekDays.map((date) => {
          const iso   = toISO(date);
          const rec   = recMap[iso] || null;
          const leave = getLeaveRec(iso);
          return (
            <DayRow
              key={iso}
              date={date}
              rec={rec}
              leaveRec={leave}
              isToday={iso === todayISO}
              todayRec={iso === todayISO ? todayRec : null}
            />
          );
        })}
      </div>

      {/* ── Time scale ── */}
      <div className="wat-scale-wrap">
        <div className="wat-scale-offset" />
        <div className="wat-scale">
          {TIME_SCALE_HOURS.map((h) => (
            <span key={h} className="wat-scale-tick">{scaleLabel(h)}</span>
          ))}
        </div>
        <div className="wat-scale-tail" />
      </div>
    </div>
  );
}
