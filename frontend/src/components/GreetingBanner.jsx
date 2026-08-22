// src/components/GreetingBanner.jsx
// Dynamic greeting banner for the employee dashboard.
// Reads the logged-in user from existing AuthContext — no new APIs.

import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';

/** Return greeting text + whether it's "night" (moon) based on current hour. */
function getTimeContext(hour) {
  if (hour >= 5 && hour < 12)  return { greeting: 'Good Morning',   isNight: false };
  if (hour >= 12 && hour < 17) return { greeting: 'Good Afternoon', isNight: false };
  if (hour >= 17 && hour < 24) return { greeting: 'Good Evening',   isNight: true  };
  /* 0 – 4 */                  return { greeting: 'Good Night',     isNight: true  };
}

function initials(name = '') {
  return name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('');
}

/** Inline SVG sun — warm yellow tones */
function SunIllustration() {
  return (
    <svg className="gb-illustration gb-illustration--sun" viewBox="0 0 96 96" fill="none" aria-hidden="true">
      {/* Glow */}
      <circle cx="48" cy="48" r="32" fill="rgba(253,224,71,0.18)" />
      {/* Core */}
      <circle cx="48" cy="48" r="20" fill="#FDE047" />
      <circle cx="48" cy="48" r="16" fill="#FACC15" />
      {/* Rays */}
      {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
        <line
          key={deg}
          x1="48" y1="22"
          x2="48" y2="14"
          stroke="#FDE047"
          strokeWidth="3"
          strokeLinecap="round"
          transform={`rotate(${deg} 48 48)`}
        />
      ))}
    </svg>
  );
}

/** Inline SVG moon + stars */
function MoonIllustration() {
  return (
    <svg className="gb-illustration gb-illustration--moon" viewBox="0 0 96 96" fill="none" aria-hidden="true">
      {/* Glow */}
      <circle cx="48" cy="48" r="32" fill="rgba(147,197,253,0.15)" />
      {/* Moon crescent */}
      <path
        d="M58 22a26 26 0 1 0 0 52 20 20 0 0 1 0-52z"
        fill="#BFDBFE"
      />
      <path
        d="M58 26a22 22 0 1 0 0 44 16 16 0 0 1 0-44z"
        fill="#93C5FD"
      />
      {/* Stars */}
      <circle cx="72" cy="26" r="2"   fill="#E0F2FE" />
      <circle cx="80" cy="42" r="1.5" fill="#BAE6FD" />
      <circle cx="68" cy="18" r="1.2" fill="#E0F2FE" />
    </svg>
  );
}

export default function GreetingBanner() {
  const { user } = useAuth();

  // Recalculate every minute so the greeting/illustration updates in real time
  const [hour, setHour] = useState(() => new Date().getHours());
  useEffect(() => {
    const id = setInterval(() => setHour(new Date().getHours()), 60_000);
    return () => clearInterval(id);
  }, []);

  const { greeting, isNight } = getTimeContext(hour);
  const fullName  = user?.name || '';

  return (
    <div className={`gb-banner${isNight ? ' gb-banner--night' : ' gb-banner--day'}`}>
      {/* ── Left side ── */}
      <div className="gb-left">
        {/* Avatar circle — same pattern as existing avatar-circle */}
        <span className="gb-avatar">
          {user?.profilePic
            ? <img src={user.profilePic} alt={fullName} />
            : initials(fullName)
          }
        </span>

        <div className="gb-text">
          <h2 className="gb-greeting">
            {greeting}, {fullName} 👋
          </h2>
          <p className="gb-sub">Have a productive day!</p>
        </div>
      </div>

      {/* ── Right side — sun or moon ── */}
      <div className="gb-right" aria-hidden="true">
        {isNight ? <MoonIllustration /> : <SunIllustration />}
      </div>
    </div>
  );
}
