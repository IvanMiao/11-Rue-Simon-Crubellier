import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { formatSeed } from '../utils/rng';
import { prefersReducedMotion } from '../utils/motion';
import { buildingAudio } from '../services/audioEngine';
import { Character } from '../types';

interface GeneratingCeremonyProps {
  seed: number;
  character?: Character;
}

const LINES = [
  '住户的秘密正在被排版。',
  '三条情节线互相缠绕，不肯被写成直线。',
  '电梯停在二十点。指针拒绝再走。',
  '缺的那一块还没有名字。',
];

const FLOORS = [8, 7, 6, 5, 4, 3, 2, 1, 0, -1];

const GeneratingCeremony: React.FC<GeneratingCeremonyProps> = ({ seed, character }) => {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    buildingAudio.weave();
    buildingAudio.startAmbient(0, 1);
    if (!rootRef.current || prefersReducedMotion()) return;

    const ctx = gsap.context(() => {
      gsap.from('.ceremony-kicker, .ceremony-title, .ceremony-seed', {
        y: 12,
        opacity: 0,
        duration: 0.6,
        stagger: 0.12,
        ease: 'power2.out',
      });
      gsap.from('.generating-floor', {
        scaleX: 0.2,
        opacity: 0,
        duration: 0.45,
        stagger: 0.12,
        ease: 'power2.out',
        delay: 0.3,
      });
      gsap.from('.ceremony-line', {
        opacity: 0,
        y: 6,
        duration: 0.5,
        stagger: 0.55,
        delay: 0.8,
        ease: 'power1.out',
      });
    }, rootRef);

    return () => ctx.revert();
  }, []);

  return (
    <div
      ref={rootRef}
      className="h-screen w-screen flex flex-col items-center justify-center bg-[#eae7dc] text-stone-800 px-6"
    >
      <p className="ceremony-kicker font-typewriter text-[10px] tracking-[0.4em] uppercase text-stone-500 mb-4">
        {character?.archetype || '列举者'} · 二十点整
      </p>
      <h2 className="ceremony-title font-serif text-3xl md:text-4xl font-bold mb-3 text-center">
        为这一局编织圣经
      </h2>
      <p className="ceremony-seed font-typewriter text-xs text-stone-500 mb-10 tracking-[0.25em]">
        SEED {formatSeed(seed)}
      </p>

      <div className="w-full max-w-sm mb-10 space-y-1.5">
        {FLOORS.map((floor) => (
          <div
            key={floor}
            className="generating-floor h-2 bg-stone-800/80 origin-left"
            style={{
              width: `${62 + ((floor + 3) % 5) * 7}%`,
              opacity: 0.35 + ((floor + 2) % 4) * 0.12,
            }}
          />
        ))}
      </div>

      <div className="min-h-[6.5rem] text-center space-y-2">
        {LINES.map((line) => (
          <p key={line} className="ceremony-line font-serif italic text-stone-600">
            {line}
          </p>
        ))}
      </div>
    </div>
  );
};

export default GeneratingCeremony;
