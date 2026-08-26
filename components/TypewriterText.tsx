import React, { useEffect, useState } from 'react';
import { prefersReducedMotion } from '../utils/motion';
import { buildingAudio } from '../services/audioEngine';

interface TypewriterTextProps {
  text: string;
  cps?: number;
  className?: string;
  onDone?: () => void;
}

const TypewriterText: React.FC<TypewriterTextProps> = ({ text, cps = 92, className, onDone }) => {
  const [shown, setShown] = useState(prefersReducedMotion() ? text : '');

  useEffect(() => {
    if (!text) {
      setShown('');
      return;
    }
    if (prefersReducedMotion()) {
      setShown(text);
      onDone?.();
      return;
    }

    setShown('');
    buildingAudio.duck(0.45, 0.2);
    let i = 0;
    const stepMs = Math.max(8, 1000 / cps);
    const id = window.setInterval(() => {
      i += 2;
      setShown(text.slice(0, i));
      if (i % 8 === 0) buildingAudio.typewriter();
      if (i >= text.length) {
        window.clearInterval(id);
        buildingAudio.duck(1, 0.35);
        onDone?.();
      }
    }, stepMs);

    return () => {
      window.clearInterval(id);
      buildingAudio.duck(1, 0.2);
    };
    // onDone is optional punctuation; do not retrigger the typeset.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, cps]);

  const done = shown.length >= text.length;
  return (
    <div className={className}>
      {shown}
      {!done && <span className="caret" aria-hidden />}
    </div>
  );
};

export default TypewriterText;
