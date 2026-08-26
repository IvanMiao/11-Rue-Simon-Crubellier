import React from 'react';

const KnightGlyph: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden>
    <path
      fill="currentColor"
      d="M6.8 20.2h10.4v1.4H6.8zm1.2-2.1 8.2.1-.4 1.4H8.3zm1.5-11.4c.2-1.6 1-3 2.7-3.9.7-.4 1.6-.4 2.1.3.4.6.2 1.3-.3 1.8-.4.3-.4.8 0 1.1l1.4 1.1c.8.6 1.2 1.6 1.1 2.6l-.2 1.8h-1.7l.1-1.3c.1-.5-.1-.9-.5-1.2L13 8.4c-1.1-.8-1.4-2-.9-3.1-.1.7-.6 1.2-1.3 1.4-1.2.4-2.1 1.4-2.4 2.6l-.5 2.3H6.2l.6-2.5c.3-1.2.9-2.2 1.7-3zm-.4 8.3h7.6l-.3 2.8H9.5z"
    />
  </svg>
);

export default KnightGlyph;
