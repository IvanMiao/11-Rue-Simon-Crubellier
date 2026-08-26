import React, { useMemo, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ContactShadows, Text } from '@react-three/drei';
import * as THREE from 'three';
import { RoomData } from '../../types';
import { ReachableMap } from '../../utils/gridLogic';
import { floorLabel } from '../../utils/roomArt';
import {
  CELL_H,
  CELL_W,
  buildingCenterY,
  layoutRooms,
  RoomBox,
} from '../../utils/sectionLayout';
import {
  cobbleTexture,
  limestoneTexture,
  nightSkyTexture,
  woodTexture,
  zincTexture,
} from '../../utils/canvasTextures';
import RoomVolume from './RoomVolume';
import { prefersReducedMotion } from '../../utils/motion';
import { lampStemGeo, lampShadeGeo } from './modelKit';

interface BuildingCanvasProps {
  onRoomSelect: (room: RoomData) => void;
  selectedRoomId: string | null;
  visitedRoomIds: Set<string>;
  reachable: ReachableMap;
  puzzlePiecesCollected: number;
  onBlocked?: (room: RoomData) => void;
}

function GazeRig({ focusY }: { focusY: number }) {
  const { camera, pointer } = useThree();
  const reduced = prefersReducedMotion();
  useFrame(() => {
    const targetX = reduced ? 3.6 : 3.6 + pointer.x * 1.5;
    const targetY = reduced ? 5.2 : 4.7 + focusY * 0.12 + pointer.y * 0.55;
    const targetZ = 13.6;
    camera.position.x = THREE.MathUtils.lerp(camera.position.x, targetX, 0.045);
    camera.position.y = THREE.MathUtils.lerp(camera.position.y, targetY, 0.045);
    camera.position.z = THREE.MathUtils.lerp(camera.position.z, targetZ, 0.045);
    camera.lookAt(0, 4.7 + focusY * 0.05, -0.35);
  });
  return null;
}

function Mansard() {
  const zinc = useMemo(() => zincTexture(), []);
  const y = 10 * CELL_H + 0.02;
  const width = CELL_W * 10.35;
  return (
    <group position={[0, y, -0.55]}>
      <mesh position={[0, 0.18, -0.15]} rotation={[0.55, 0, 0]} castShadow>
        <boxGeometry args={[width, 0.06, 1.35]} />
        <meshStandardMaterial map={zinc} color="#6a6560" metalness={0.38} roughness={0.42} />
      </mesh>
      <mesh position={[0, 0.62, -0.85]} rotation={[0.18, 0, 0]} castShadow>
        <boxGeometry args={[width * 0.92, 0.05, 0.9]} />
        <meshStandardMaterial map={zinc} color="#5e5a54" metalness={0.4} roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.88, -0.95]} castShadow>
        <boxGeometry args={[width * 0.2, 0.08, 0.2]} />
        <meshStandardMaterial color="#4a4640" metalness={0.3} roughness={0.5} />
      </mesh>
      {[-3.8, -1.5, 1.4, 3.7].map((x) => (
        <group key={x} position={[x, 0.55, -0.55]}>
          <mesh castShadow>
            <boxGeometry args={[0.22, 0.55, 0.22]} />
            <meshStandardMaterial color="#8a6a52" roughness={0.82} />
          </mesh>
          <mesh position={[0, 0.32, 0]}>
            <cylinderGeometry args={[0.08, 0.09, 0.1, 10]} />
            <meshStandardMaterial color="#3a3228" roughness={0.65} />
          </mesh>
        </group>
      ))}
      {[-2.6, 0, 2.5].map((x) => (
        <group key={`d${x}`} position={[x, 0.28, 0.22]}>
          <mesh castShadow>
            <boxGeometry args={[0.42, 0.38, 0.28]} />
            <meshStandardMaterial map={zinc} color="#6a6560" metalness={0.3} roughness={0.45} />
          </mesh>
          <mesh position={[0, 0, 0.15]}>
            <planeGeometry args={[0.22, 0.2]} />
            <meshStandardMaterial color="#e8b14a" emissive="#e8b14a" emissiveIntensity={0.7} toneMapped={false} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function Shell() {
  const lime = useMemo(() => limestoneTexture(), []);
  const h = CELL_H * 10.15;
  const y = h / 2 - 0.08;
  return (
    <group>
      <mesh position={[-CELL_W * 5.08, y, -0.7]} castShadow receiveShadow>
        <boxGeometry args={[0.22, h, 1.9]} />
        <meshStandardMaterial map={lime} color="#c4b49a" roughness={0.88} />
      </mesh>
      <mesh position={[CELL_W * 5.08, y, -0.7]} castShadow receiveShadow>
        <boxGeometry args={[0.22, h, 1.9]} />
        <meshStandardMaterial map={lime} color="#c4b49a" roughness={0.88} />
      </mesh>
      {[-CELL_W * 5.08, CELL_W * 5.08].map((x) =>
        [1, 3, 5, 7].map((floor) => (
          <mesh key={`${x}-${floor}`} position={[x, floor * CELL_H + 0.15, 0.22]}>
            <planeGeometry args={[0.12, 0.16]} />
            <meshStandardMaterial
              color="#e8b14a"
              emissive="#e8b14a"
              emissiveIntensity={0.55}
              toneMapped={false}
            />
          </mesh>
        ))
      )}
    </group>
  );
}

function StreetLantern() {
  return (
    <group position={[4.6, 0, 1.6]}>
      <mesh position={[0, 0.7, 0]} castShadow>
        <cylinderGeometry args={[0.03, 0.04, 1.4, 10]} />
        <meshStandardMaterial color="#2a2420" metalness={0.4} roughness={0.45} />
      </mesh>
      <mesh geometry={lampStemGeo} position={[0, 1.35, 0]} scale={1.4}>
        <meshStandardMaterial color="#c4a06a" metalness={0.5} roughness={0.35} />
      </mesh>
      <mesh geometry={lampShadeGeo} position={[0, 1.55, 0]} scale={1.3}>
        <meshStandardMaterial
          color="#e8b14a"
          emissive="#e8b14a"
          emissiveIntensity={1.2}
          side={THREE.DoubleSide}
        />
      </mesh>
      <pointLight position={[0, 1.55, 0]} color="#f0c078" intensity={1.1} distance={6} />
    </group>
  );
}

function Street() {
  const cobble = useMemo(() => cobbleTexture(), []);
  const wood = useMemo(() => woodTexture(), []);
  return (
    <group>
      <mesh position={[0, -0.5, 0]} receiveShadow>
        <boxGeometry args={[14, 0.55, 6]} />
        <meshStandardMaterial map={wood} color="#4a3220" roughness={0.82} />
      </mesh>
      <mesh position={[0, -0.2, 0]} receiveShadow>
        <boxGeometry args={[12.4, 0.08, 4.2]} />
        <meshStandardMaterial map={wood} color="#3a2818" roughness={0.7} />
      </mesh>
      <mesh position={[0, -0.14, 1.55]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[16, 4.2]} />
        <meshStandardMaterial map={cobble} color="#4a453c" roughness={0.95} />
      </mesh>
      <Text
        position={[0, 0.01, 2.35]}
        rotation={[-Math.PI / 2.5, 0, 0]}
        fontSize={0.15}
        color="#d4c4a8"
        anchorX="center"
        letterSpacing={0.14}
      >
        RUE SIMON-CRUBELLIER  ·  20h00  ·  23 JUIN 1975
      </Text>
      <StreetLantern />
    </group>
  );
}

function DuskSky() {
  const sky = useMemo(() => nightSkyTexture(), []);
  return (
    <mesh position={[0, 5.2, -9]}>
      <planeGeometry args={[48, 28]} />
      <meshBasicMaterial map={sky} />
    </mesh>
  );
}

function Neighbors() {
  return (
    <group>
      {[-9.4, 9.4].map((x) => (
        <group key={x} position={[x, 3.8, -4.2]}>
          <mesh castShadow>
            <boxGeometry args={[3.2, 8.4, 1.4]} />
            <meshStandardMaterial color="#1a1614" roughness={0.95} />
          </mesh>
          {[-0.8, 0.2, 1.0].map((wx) =>
            [1.2, 0, -1.2, -2.4, 2.4].map((wy) => (
              <mesh key={`${wx}${wy}`} position={[wx, wy, 0.72]}>
                <planeGeometry args={[0.22, 0.28]} />
                <meshStandardMaterial
                  color="#e8b14a"
                  emissive="#c47848"
                  emissiveIntensity={0.35 + ((wx + wy) % 3) * 0.15}
                  toneMapped={false}
                />
              </mesh>
            ))
          )}
        </group>
      ))}
    </group>
  );
}

function FloorMarks() {
  return (
    <group>
      {[8, 7, 6, 5, 4, 3, 2, 1, 0, -1].map((floor) => {
        const y = (floor + 1) * CELL_H + CELL_H * 0.32;
        return (
          <Text
            key={floor}
            position={[-CELL_W * 5.45, y, 0.45]}
            fontSize={0.15}
            color="#c4b49a"
            anchorX="right"
            anchorY="middle"
          >
            {floorLabel(floor)}
          </Text>
        );
      })}
    </group>
  );
}

function BuildingModel({
  boxes,
  selectedRoomId,
  visitedRoomIds,
  reachable,
  onRoomSelect,
  onBlocked,
}: {
  boxes: RoomBox[];
  selectedRoomId: string | null;
  visitedRoomIds: Set<string>;
  reachable: ReachableMap;
  onRoomSelect: (room: RoomData) => void;
  onBlocked?: (room: RoomData) => void;
}) {
  return (
    <group>
      {boxes.map((box) => {
        const isSelected = selectedRoomId === box.id;
        const isKnight = reachable.knight.has(box.id);
        const isWalk = reachable.walk.has(box.id);
        const isReachable = reachable.all.has(box.id) || isSelected;
        return (
          <RoomVolume
            key={box.id}
            box={box}
            selected={isSelected}
            reachable={isReachable}
            visited={visitedRoomIds.has(box.id)}
            isKnight={isKnight}
            isWalk={isWalk}
            blocked={!isReachable && !isSelected}
            onSelect={() => onRoomSelect(box.room)}
            onBlocked={() => onBlocked?.(box.room)}
          />
        );
      })}
    </group>
  );
}

const BuildingCanvas: React.FC<BuildingCanvasProps> = ({
  onRoomSelect,
  selectedRoomId,
  visitedRoomIds,
  reachable,
  puzzlePiecesCollected,
  onBlocked,
}) => {
  const includeHundredth = puzzlePiecesCollected >= 5 || reachable.all.has('100-1');
  const boxes = useMemo(() => layoutRooms(includeHundredth), [includeHundredth]);
  const focus = boxes.find((b) => b.id === selectedRoomId);
  const focusY = (focus?.y ?? buildingCenterY()) - buildingCenterY();

  return (
    <Canvas
      shadows
      dpr={[1, 1.6]}
      camera={{ position: [3.6, 5.2, 13.6], fov: 30, near: 0.1, far: 80 }}
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.08 }}
      style={{ width: '100%', height: '100%', display: 'block' }}
    >
      <color attach="background" args={['#141218']} />
      <fog attach="fog" args={['#1a1716', 16, 34]} />
      <Suspense fallback={null}>
        <hemisphereLight args={['#8aa0c0', '#c47848', 0.48]} />
        <directionalLight
          position={[7, 11, 7]}
          intensity={1.05}
          color="#f4d8b0"
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
        />
        <directionalLight position={[-6, 3, 3]} intensity={0.4} color="#6a88c4" />
        <pointLight
          position={[focus?.x ?? 0, (focus?.y ?? 4) + 0.25, 0.45]}
          intensity={selectedRoomId ? 1.55 : 0.25}
          color="#e8b14a"
          distance={4.2}
        />
        <DuskSky />
        <Neighbors />
        <GazeRig focusY={focusY} />
        <Shell />
        <BuildingModel
          boxes={boxes}
          selectedRoomId={selectedRoomId}
          visitedRoomIds={visitedRoomIds}
          reachable={reachable}
          onRoomSelect={onRoomSelect}
          onBlocked={onBlocked}
        />
        <Mansard />
        <Street />
        <FloorMarks />
        <ContactShadows position={[0, -0.18, 0]} opacity={0.5} scale={24} blur={2.6} far={11} />
      </Suspense>
    </Canvas>
  );
};

export default BuildingCanvas;
