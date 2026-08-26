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
        <g>
          <rect x="4" y="5" width="16" height="14" rx="1" fill="#c45a32" />
          <rect x="4" y="5" width="16" height="14" rx="1" {...stroke} />
          <path d="M4 8h16M8 5v14" {...stroke} />
          <circle cx="15" cy="14" r="2.2" fill="#f0d78c" stroke="#2a2218" strokeWidth="1.2" />
        </g>
      )}
      {kind === 'teacup' && (
        <g>
          <path d="M6 9h10v5a4 4 0 0 1-4 4H10a4 4 0 0 1-4-4V9z" fill="#e8dcc8" stroke="#2a2218" strokeWidth="1.4" />
          <path d="M16 11h2.2a2.2 2.2 0 0 1 0 4.4H16" fill="none" stroke="#2a2218" strokeWidth="1.4" />
          <path d="M8 20h8" {...stroke} />
        </g>
      )}
      {kind === 'chess' && (
        <g>
          <path d="M8 20h8M9 16h6l.5 4H8.5L9 16z" fill="#2a2218" stroke="#2a2218" />
          <circle cx="12" cy="12" r="3.2" fill="#d4b06a" stroke="#2a2218" strokeWidth="1.3" />
          <path d="M12 4v4M9.5 8h5" {...stroke} />
        </g>
      )}
      {kind === 'letter' && (
        <g>
          <rect x="4" y="6" width="16" height="12" fill="#f4ead6" stroke="#2a2218" strokeWidth="1.4" />
          <path d="M4 7l8 6 8-6" fill="none" stroke="#2a2218" strokeWidth="1.4" />
        </g>
      )}
      {kind === 'glasses' && (
        <g>
          <circle cx="8" cy="13" r="3.2" fill="none" stroke="#2a2218" strokeWidth="1.5" />
          <circle cx="16" cy="13" r="3.2" fill="none" stroke="#2a2218" strokeWidth="1.5" />
          <path d="M11.2 13h1.6M5 12.2 3.5 9M19 12.2 20.5 9" {...stroke} />
        </g>
      )}
      {kind === 'clock' && (
        <g>
          <circle cx="12" cy="12" r="7" fill="#e8d2b0" stroke="#2a2218" strokeWidth="1.4" />
          <path d="M12 12V8M12 12l3 2" {...stroke} />
        </g>
      )}
      {kind === 'cloth' && (
        <g>
          <path d="M5 8c3 1 5-2 7 0s4 2 7 0v10H5V8z" fill="#c45a32" stroke="#2a2218" strokeWidth="1.4" />
          <path d="M9 12h6" {...stroke} />
        </g>
      )}
      {kind === 'newspaper' && (
        <g>
          <rect x="4" y="5" width="16" height="14" fill="#f4ead6" stroke="#2a2218" strokeWidth="1.4" />
          <path d="M7 8h10M7 11h10M7 14h6" {...stroke} />
        </g>
      )}
      {kind === 'buttons' && (
        <g>
          <circle cx="8" cy="12" r="3.4" fill="#d4b06a" stroke="#2a2218" strokeWidth="1.4" />
          <circle cx="16" cy="12" r="3.4" fill="#8a4a38" stroke="#2a2218" strokeWidth="1.4" />
          <circle cx="8" cy="12" r="0.6" fill="#2a2218" />
          <circle cx="16" cy="12" r="0.6" fill="#2a2218" />
        </g>
      )}
      {kind === 'keys' && (
        <g>
          <circle cx="8" cy="10" r="3" fill="#d4b06a" stroke="#2a2218" strokeWidth="1.4" />
          <path d="M11 10h9l-2 2 2 2" {...stroke} />
        </g>
      )}
      {kind === 'puzzle' && (
        <g>
          <path d="M5 5h6c0 2 2 2 2 0h6v6c-2 0-2 2 0 2v6h-6c0-2-2-2-2 0H5v-6c2 0 2-2 0-2V5z" fill="#c9a06a" stroke="#2a2218" strokeWidth="1.4" />
        </g>
      )}
      {kind === 'book' && (
        <g>
          <path d="M6 5h11v14H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z" fill="#6a2a28" stroke="#2a2218" strokeWidth="1.4" />
          <path d="M8 8h7M8 11h7" stroke="#f4ead6" strokeWidth="1.2" />
        </g>
      )}
      {kind === 'object' && (
        <g>
          <rect x="7" y="6" width="10" height="12" rx="1" fill="#8a6238" stroke="#2a2218" strokeWidth="1.4" />
          <path d="M7 10h10" {...stroke} />
        </g>
      )}
    </svg>
  );
};

export default StillLifeMark;
