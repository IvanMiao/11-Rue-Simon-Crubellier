import React, { useMemo } from 'react';
import { Text } from '@react-three/drei';
import { ThreeEvent } from '@react-three/fiber';
import { RoomBox } from '../../utils/sectionLayout';
import { furnishSet, roomLook } from '../../utils/roomArt';
import {
  limestoneTexture,
  parquetTexture,
  plasterTexture,
  tiled,
  wallpaperTexture,
  PaperKind,
} from '../../utils/canvasTextures';
import { hashString } from '../../utils/rng';
import ChessKnight from './ChessKnight';
import Figure, { COATS, HAIR } from './Figure';
import Furniture from './Furniture';
import {
  BalconyRail,
  ElevatorCage,
  OrientalRug,
  PictureFrame,
  StairFlight,
  WindowBay,
} from './modelKit';

interface RoomVolumeProps {
  box: RoomBox;
  selected: boolean;
  reachable: boolean;
  visited: boolean;
  isKnight: boolean;
  isWalk: boolean;
  blocked: boolean;
  onSelect: () => void;
  onBlocked: () => void;
}

function paperKind(room: RoomVolumeProps['box']['room']): PaperKind {
  if (room.floor === -1) return 'stone';
  if (room.floor >= 8 || room.type === 'service') return 'stripe';
  if (room.floor === 0) return 'toile';
  return 'damask';
}

const RoomVolume: React.FC<RoomVolumeProps> = ({
  box,
  selected,
  reachable,
  visited,
  isKnight,
  blocked,
  onSelect,
  onBlocked,
}) => {
  const look = roomLook(box.room);
  const set = furnishSet(box.room, look.silhouette);
  const seed = hashString(box.id + (box.room.name || ''));
  const w = box.w - 0.04;
  const h = box.h - 0.02;
  const d = box.d - 0.04;
  const wall = 0.04;
  const lit = selected || reachable || visited;
  const kind = paperKind(box.room);

  const plaster = useMemo(() => tiled(plasterTexture(look.paint), w, h), [look.paint, w, h]);
  const paper = useMemo(
    () => tiled(wallpaperTexture(look.paint, look.lamp, kind), w * 1.15, h * 1.15),
    [look.paint, look.lamp, kind, w, h]
  );
  const parquet = useMemo(() => tiled(parquetTexture(), w * 1.6, d * 1.4), [w, d]);
  const stone = useMemo(() => tiled(limestoneTexture(), 1.1, h), [h]);

  const handle = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    if (blocked) onBlocked();
    else onSelect();
  };

  const isElevator = box.room.type === 'elevator';
  const isStair = box.room.type === 'stairwell';
  const glow = selected ? 1.8 : reachable ? 1.15 : visited ? 0.6 : 0.18;
  const coat = COATS[seed % COATS.length];
  const hair = HAIR[(seed >> 3) % HAIR.length];

  return (
    <group position={[box.x, box.y, box.z]}>
      <mesh
        position={[0, 0, d / 2 - 0.02]}
        onPointerDown={handle}
        onPointerOver={() => {
          document.body.style.cursor = blocked ? 'not-allowed' : 'pointer';
        }}
        onPointerOut={() => {
          document.body.style.cursor = 'auto';
        }}
      >
        <planeGeometry args={[w, h]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      <mesh position={[0, -h / 2 + 0.018, 0]} receiveShadow>
        <boxGeometry args={[w, 0.036, d]} />
        <meshStandardMaterial
          map={isElevator ? plaster : parquet}
          color={isElevator ? '#1a1612' : '#8a6238'}
          roughness={0.68}
        />
      </mesh>
      <mesh position={[0, h / 2 - 0.012, 0]}>
        <boxGeometry args={[w, 0.024, d]} />
        <meshStandardMaterial map={plaster} color="#d8cbb4" roughness={0.88} />
      </mesh>
      <mesh position={[0, h / 2 - 0.04, d / 2 - 0.04]}>
        <boxGeometry args={[w * 0.98, 0.03, 0.06]} />
        <meshStandardMaterial color="#d4c4a8" roughness={0.8} />
      </mesh>

      <mesh position={[0, 0, -d / 2 + wall / 2]} receiveShadow>
        <boxGeometry args={[w, h, wall]} />
        <meshStandardMaterial
          map={isElevator ? plaster : paper}
          color={isElevator ? '#16120e' : look.paint}
          roughness={0.82}
        />
      </mesh>
      <mesh position={[-w / 2 + wall / 2, 0, 0]}>
        <boxGeometry args={[wall, h, d]} />
        <meshStandardMaterial map={stone} color={look.paint} roughness={0.86} />
      </mesh>
      <mesh position={[w / 2 - wall / 2, 0, 0]}>
        <boxGeometry args={[wall, h, d]} />
        <meshStandardMaterial map={stone} color={look.paint} roughness={0.86} />
      </mesh>

      {!isElevator && (
        <group position={[0.02, h * 0.08, -d / 2 + wall + 0.02]}>
          <WindowBay w={w} h={h} glow={lit ? glow : 0.1} lamp={look.lamp} />
        </group>
      )}

      {!isElevator && look.occupied && w > 0.9 && (
        <PictureFrame
          seed={seed}
          lamp={look.lamp}
          paint={look.paint}
          x={-w * 0.28}
          y={h * 0.12}
          z={-d / 2 + wall + 0.03}
        />
      )}

      {box.room.floor >= 1 && box.room.floor <= 3 && !isElevator && (
        <BalconyRail width={w} z={d / 2 - 0.02} />
      )}

      {isElevator && <ElevatorCage w={w} h={h} d={d} selected={selected} />}
      {isStair && lit && <StairFlight h={h} />}

      <group position={[0, -h / 2 + 0.02, 0.04]} scale={Math.min(1.2, w * 0.95, h * 0.95)}>
        {!isElevator && !isStair && lit && look.occupied && set !== 'empty' && (
          <>
            <OrientalRug hex="#6a2a28" accent={look.lamp} w={w} d={d} />
            <Furniture
              set={set}
              lamp={look.lamp}
              paint={look.paint}
              seed={seed}
              width={w}
              depth={d}
            />
          </>
        )}
        {!isElevator && lit && look.occupied && look.silhouette !== 'empty' && look.silhouette !== 'lamp' && (
          <Figure
            pose={look.silhouette === 'pair' ? 'pair' : look.silhouette === 'sit' ? 'sit' : 'stand'}
            coat={coat}
            hair={hair}
          />
        )}
        {isKnight && !selected && (
          <group position={[w * 0.1, 0, d * 0.12]} scale={1.2}>
            <ChessKnight />
          </group>
        )}
      </group>

      {box.room.name && w > 0.65 && (
        <Text
          position={[0, -h / 2 + 0.065, d / 2 - 0.03]}
          fontSize={Math.min(0.1, w * 0.1)}
          color={selected ? '#f4ead6' : '#2a2218'}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.004}
          outlineColor={selected ? '#1a140e' : '#f4ead6'}
        >
          {box.room.name}
        </Text>
      )}

      {selected && (
        <mesh position={[0, 0, d / 2 - 0.008]}>
          <planeGeometry args={[w + 0.03, h + 0.03]} />
          <meshBasicMaterial color="#d4b06a" transparent opacity={0.08} />
        </mesh>
      )}

      {blocked && (
        <mesh position={[0, 0, d / 2 - 0.025]}>
          <planeGeometry args={[w, h]} />
          <meshBasicMaterial color="#100c08" transparent opacity={0.42} />
        </mesh>
      )}
    </group>
  );
};

export default RoomVolume;
