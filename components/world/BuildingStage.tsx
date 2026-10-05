import React, { useEffect, useRef, useState } from 'react';
import type {
  BuildingCallbacks,
  BuildingHandle,
  BuildingInput,
} from '../../art/stage/building';

interface BuildingStageProps {
  input: BuildingInput;
  callbacks: BuildingCallbacks;
  fallback: React.ReactNode;
}

const BuildingStage: React.FC<BuildingStageProps> = ({ input, callbacks, fallback }) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<BuildingHandle | null>(null);
  const inputRef = useRef(input);
  const callbacksRef = useRef(callbacks);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  inputRef.current = input;
  callbacksRef.current = callbacks;

  useEffect(() => {
    let active = true;
    let revealFrame = 0;
    import('../../art/stage/building')
      .then(({ mountBuilding }) => {
        if (!active || !hostRef.current) return;
        handleRef.current = mountBuilding(hostRef.current, inputRef.current, {
          onPickHotspot: (lineId) => callbacksRef.current.onPickHotspot(lineId),
          onPickCell: (cellId) => callbacksRef.current.onPickCell(cellId),
          onHoverCell: (cellId) => callbacksRef.current.onHoverCell(cellId),
          onViewChange: (view) => callbacksRef.current.onViewChange(view),
        });
        const revealWhenRendered = () => {
          if (!active) return;
          const handle = handleRef.current;
          if (handle && handle.stats().firstReadyMs !== null) {
            setReady(true);
            return;
          }
          revealFrame = requestAnimationFrame(revealWhenRendered);
        };
        revealWhenRendered();
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
      cancelAnimationFrame(revealFrame);
      handleRef.current?.dispose();
      handleRef.current = null;
    };
  }, []);

  useEffect(() => {
    handleRef.current?.update(input);
  }, [input]);

  return (
    <div className="building-stage-root" aria-label="瓦莱纳的整栋楼剖面">
      <div className={`building-stage-fallback ${ready && !failed ? 'is-hidden' : ''}`}>
        {fallback}
      </div>
      <div ref={hostRef} className={`building-stage-host ${ready && !failed ? 'is-ready' : ''}`} />
    </div>
  );
};

export default BuildingStage;
