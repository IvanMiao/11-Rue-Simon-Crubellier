import React, { useEffect, useRef, useState } from 'react';
import type { StageHandle, StageInput } from '../../art/stage';

interface RoomStageProps {
  input: StageInput;
  onPick: (lineId: string) => void;
}

const RoomStage: React.FC<RoomStageProps> = ({ input, onPick }) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<StageHandle | null>(null);
  const inputRef = useRef(input);
  const pickRef = useRef(onPick);
  const [error, setError] = useState(false);

  inputRef.current = input;
  pickRef.current = onPick;

  useEffect(() => {
    let active = true;
    import('../../art/stage')
      .then(({ mountStage }) => {
        if (!active || !hostRef.current) return;
        handleRef.current = mountStage(hostRef.current, inputRef.current, (lineId) => {
          if (active) pickRef.current(lineId);
        });
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
      handleRef.current?.dispose();
      handleRef.current = null;
    };
  }, []);

  useEffect(() => {
    handleRef.current?.update(input);
  }, [input]);

  return (
    <div className="room-stage-frame" aria-label="房间纸剧场">
      <div ref={hostRef} className="room-stage-host">
        <div className="room-stage-placeholder">{error ? '纸剧场暂时无法打开。' : '瓦莱纳正在铺开房间……'}</div>
      </div>
      <span className="room-stage-caption">{input.cellId} · {input.hour}:00</span>
    </div>
  );
};

export default RoomStage;
