import React from 'react';
import { StillKind } from '../utils/roomArt';

interface StillLifeMarkProps {
  kind: StillKind;
  className?: string;
}

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.4,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

const StillLifeMark: React.FC<StillLifeMarkProps> = ({ kind, className }) => {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      {kind === 'stamp' && (
        <g {...stroke}>
          <rect x="4" y="5" width="16" height="14" rx="1" />
          <path d="M4 8h16M8 5v14" />
          <circle cx="15" cy="14" r="2.2" />
        </g>
      )}
      {kind === 'teacup' && (
        <g {...stroke}>
          <path d="M6 9h10v5a4 4 0 0 1-4 4H10a4 4 0 0 1-4-4V9z" />
          <path d="M16 11h2.2a2.2 2.2 0 0 1 0 4.4H16" />
          <path d="M8 20h8" />
        </g>
      )}
      {kind === 'chess' && (
        <g {...stroke}>
          <path d="M8 20h8M9 16h6l.5 4H8.5L9 16z" />
          <path d="M12 4v4M9.5 8h5" />
          <circle cx="12" cy="12" r="3.2" />
        </g>
      )}
      {kind === 'letter' && (
        <g {...stroke}>
          <rect x="4" y="6" width="16" height="12" />
          <path d="M4 7l8 6 8-6" />
        </g>
      )}
      {kind === 'glasses' && (
        <g {...stroke}>
          <circle cx="8" cy="13" r="3.2" />
          <circle cx="16" cy="13" r="3.2" />
          <path d="M11.2 13h1.6M5 12.2 3.5 9M19 12.2 20.5 9" />
        </g>
      )}
      {kind === 'clock' && (
        <g {...stroke}>
          <circle cx="12" cy="12" r="7" />
          <path d="M12 12V8M12 12l3 2" />
        </g>
      )}
      {kind === 'cloth' && (
        <g {...stroke}>
          <path d="M5 8c3 1 5-2 7 0s4 2 7 0v10H5V8z" />
          <path d="M9 12h6" />
        </g>
      )}
      {kind === 'newspaper' && (
        <g {...stroke}>
          <rect x="4" y="5" width="16" height="14" />
          <path d="M7 8h10M7 11h10M7 14h6" />
        </g>
      )}
      {kind === 'buttons' && (
        <g {...stroke}>
          <circle cx="8" cy="12" r="3.4" />
          <circle cx="16" cy="12" r="3.4" />
          <circle cx="8" cy="12" r="0.6" fill="currentColor" />
          <circle cx="16" cy="12" r="0.6" fill="currentColor" />
        </g>
      )}
      {kind === 'keys' && (
        <g {...stroke}>
          <circle cx="8" cy="10" r="3" />
          <path d="M11 10h9l-2 2 2 2" />
        </g>
      )}
      {kind === 'puzzle' && (
        <g {...stroke}>
          <path d="M5 5h6c0 2 2 2 2 0h6v6c-2 0-2 2 0 2v6h-6c0-2-2-2-2 0H5v-6c2 0 2-2 0-2V5z" />
        </g>
      )}
      {kind === 'book' && (
        <g {...stroke}>
          <path d="M6 5h11v14H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z" />
          <path d="M8 8h7M8 11h7" />
        </g>
      )}
      {kind === 'object' && (
        <g {...stroke}>
          <rect x="7" y="6" width="10" height="12" rx="1" />
          <path d="M7 10h10" />
        </g>
      )}
    </svg>
  );
};

export default StillLifeMark;
