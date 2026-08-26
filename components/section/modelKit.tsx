import React from 'react';
import * as THREE from 'three';
import { fabricTexture, leatherTexture, paintingTexture, rugTexture } from '../../utils/canvasTextures';

const lathe = (pairs: [number, number][], segs = 18) =>
  new THREE.LatheGeometry(pairs.map(([x, y]) => new THREE.Vector2(x, y)), segs);

export const lampStemGeo = lathe([
  [0.0, 0],
  [0.048, 0],
  [0.05, 0.016],
  [0.018, 0.022],
  [0.014, 0.12],
  [0.02, 0.138],
  [0.0, 0.138],
]);

export const lampShadeGeo = lathe([
  [0.0, 0],
  [0.09, 0],
  [0.055, 0.07],
  [0.0, 0.07],
], 20);

export const bottleGeo = lathe([
  [0.0, 0],
  [0.022, 0],
  [0.024, 0.055],
  [0.012, 0.08],
  [0.01, 0.12],
  [0.014, 0.128],
  [0.0, 0.128],
], 12);

export const barrelGeo = lathe([
  [0.0, 0],
  [0.08, 0],
  [0.1, 0.04],
  [0.108, 0.1],
  [0.1, 0.16],
  [0.08, 0.2],
  [0.0, 0.2],
], 16);

export const vaseGeo = lathe([
  [0.0, 0],
  [0.03, 0],
  [0.04, 0.03],
  [0.028, 0.07],
  [0.022, 0.1],
  [0.032, 0.11],
  [0.0, 0.11],
], 14);

export const knightBaseGeo = lathe([
  [0.0, 0],
  [0.07, 0],
  [0.072, 0.018],
  [0.048, 0.028],
  [0.04, 0.055],
  [0.05, 0.062],
  [0.032, 0.09],
  [0.028, 0.12],
  [0.0, 0.12],
], 20);

export const urnGeo = lathe([
  [0.0, 0],
  [0.055, 0],
  [0.06, 0.02],
  [0.04, 0.08],
  [0.05, 0.11],
  [0.0, 0.11],
], 12);

const WoodMat: React.FC<{ map?: THREE.Texture; color?: string }> = ({
  map,
  color = '#6b4a2c',
}) => <meshStandardMaterial map={map} color={color} roughness={0.58} metalness={0.04} />;

export const TurnedLamp: React.FC<{ color: string; x?: number; z?: number }> = ({
  color,
  x = 0,
  z = 0,
}) => (
  <group position={[x, 0, z]}>
    <mesh geometry={lampStemGeo} castShadow>
      <meshStandardMaterial color="#c4a06a" metalness={0.55} roughness={0.32} />
    </mesh>
    <mesh geometry={lampShadeGeo} position={[0, 0.138, 0]} castShadow>
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={0.85}
        roughness={0.7}
        side={THREE.DoubleSide}
      />
    </mesh>
  </group>
);

export const PedestalTable: React.FC<{ wood?: THREE.Texture; x?: number; z?: number }> = ({
  wood,
  x = 0,
  z = 0,
}) => (
  <group position={[x, 0, z]}>
    <mesh position={[0, 0.2, 0]} castShadow>
      <cylinderGeometry args={[0.16, 0.17, 0.025, 24]} />
      <WoodMat map={wood} color="#5c3c24" />
    </mesh>
    <mesh position={[0, 0.1, 0]} castShadow>
      <cylinderGeometry args={[0.025, 0.04, 0.18, 10]} />
      <WoodMat map={wood} />
    </mesh>
    <mesh position={[0, 0.015, 0]}>
      <cylinderGeometry args={[0.08, 0.09, 0.03, 16]} />
      <WoodMat map={wood} color="#4a301c" />
    </mesh>
  </group>
);

export const SalonChair: React.FC<{
  fabric: string;
  wood?: THREE.Texture;
  x?: number;
  z?: number;
  rot?: number;
}> = ({ fabric, wood, x = 0, z = 0, rot = 0 }) => {
  const cloth = React.useMemo(() => leatherTexture(fabric), [fabric]);
  return (
    <group position={[x, 0, z]} rotation={[0, rot, 0]}>
      <mesh position={[0, 0.11, 0]} castShadow>
        <cylinderGeometry args={[0.09, 0.1, 0.05, 16]} />
        <meshStandardMaterial map={cloth} color={fabric} roughness={0.72} />
      </mesh>
      <mesh position={[0, 0.22, -0.07]} rotation={[0.18, 0, 0]} castShadow>
        <torusGeometry args={[0.08, 0.022, 8, 14, Math.PI]} />
        <meshStandardMaterial map={cloth} color={fabric} roughness={0.7} />
      </mesh>
      {[
        [-0.06, 0.05, 0.05] as const,
        [0.06, 0.05, 0.05] as const,
        [-0.06, 0.05, -0.06] as const,
        [0.06, 0.05, -0.06] as const,
      ].map((p, i) => (
        <mesh key={i} position={[...p]} castShadow>
          <cylinderGeometry args={[0.012, 0.016, 0.1, 8]} />
          <WoodMat map={wood} />
        </mesh>
      ))}
    </group>
  );
};

export const Armchair: React.FC<{ fabric: string; x?: number; z?: number; rot?: number }> = ({
  fabric,
  x = 0,
  z = 0,
  rot = 0.4,
}) => {
  const cloth = React.useMemo(() => leatherTexture(fabric), [fabric]);
  return (
    <group position={[x, 0, z]} rotation={[0, rot, 0]}>
      <mesh position={[0, 0.1, 0]} castShadow>
        <boxGeometry args={[0.2, 0.08, 0.18]} />
        <meshStandardMaterial map={cloth} color={fabric} roughness={0.68} />
      </mesh>
      <mesh position={[0, 0.22, -0.07]} castShadow>
        <boxGeometry args={[0.2, 0.18, 0.05]} />
        <meshStandardMaterial map={cloth} color={fabric} roughness={0.68} />
      </mesh>
      <mesh position={[-0.11, 0.16, 0]} castShadow>
        <cylinderGeometry args={[0.025, 0.028, 0.14, 8]} />
        <meshStandardMaterial map={cloth} color={fabric} roughness={0.7} />
      </mesh>
      <mesh position={[0.11, 0.16, 0]} castShadow>
        <cylinderGeometry args={[0.025, 0.028, 0.14, 8]} />
        <meshStandardMaterial map={cloth} color={fabric} roughness={0.7} />
      </mesh>
    </group>
  );
};

export const Daybed: React.FC<{
  linen: string;
  wood?: THREE.Texture;
  x?: number;
  z?: number;
}> = ({ linen, wood, x = 0, z = 0 }) => (
  <group position={[x, 0, z]}>
    <mesh position={[0, 0.07, 0]} castShadow>
      <boxGeometry args={[0.42, 0.06, 0.22]} />
      <meshStandardMaterial color={linen} roughness={0.78} />
    </mesh>
    <mesh position={[-0.18, 0.16, 0]} castShadow>
      <boxGeometry args={[0.04, 0.16, 0.22]} />
      <WoodMat map={wood} color="#5a3c28" />
    </mesh>
    <mesh position={[-0.12, 0.12, 0]} rotation={[0, 0, 0.4]} castShadow>
      <cylinderGeometry args={[0.05, 0.05, 0.08, 12]} />
      <meshStandardMaterial color="#f0e6d2" roughness={0.85} />
    </mesh>
    <mesh position={[0.18, 0.04, 0]}>
      <cylinderGeometry args={[0.015, 0.018, 0.08, 8]} />
      <WoodMat map={wood} />
    </mesh>
  </group>
);

export const Wardrobe: React.FC<{ wood?: THREE.Texture; x?: number; z?: number }> = ({
  wood,
  x = 0,
  z = 0,
}) => (
  <group position={[x, 0, z]}>
    <mesh position={[0, 0.22, 0]} castShadow>
      <boxGeometry args={[0.2, 0.44, 0.12]} />
      <WoodMat map={wood} color="#5a4030" />
    </mesh>
    <mesh position={[0, 0.45, 0]}>
      <boxGeometry args={[0.22, 0.03, 0.13]} />
      <WoodMat map={wood} color="#4a3224" />
    </mesh>
    <mesh position={[0.05, 0.22, 0.062]}>
      <sphereGeometry args={[0.012, 8, 8]} />
      <meshStandardMaterial color="#c4a06a" metalness={0.6} roughness={0.3} />
    </mesh>
  </group>
);

export const Easel: React.FC<{
  seed: number;
  lamp: string;
  paint: string;
  x?: number;
  z?: number;
}> = ({ seed, lamp, paint, x = 0, z = 0 }) => {
  const canvas = React.useMemo(() => paintingTexture(seed, lamp, paint), [seed, lamp, paint]);
  return (
    <group position={[x, 0, z]} rotation={[0, 0.25, 0]}>
      <mesh position={[-0.06, 0.16, 0]} rotation={[0, 0, 0.18]} castShadow>
        <boxGeometry args={[0.02, 0.34, 0.02]} />
        <meshStandardMaterial color="#5a4030" roughness={0.7} />
      </mesh>
      <mesh position={[0.06, 0.16, 0]} rotation={[0, 0, -0.18]} castShadow>
        <boxGeometry args={[0.02, 0.34, 0.02]} />
        <meshStandardMaterial color="#5a4030" roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.22, 0.01]} castShadow>
        <boxGeometry args={[0.2, 0.26, 0.012]} />
        <meshStandardMaterial map={canvas} roughness={0.82} />
      </mesh>
    </group>
  );
};

export const PictureFrame: React.FC<{
  seed: number;
  lamp: string;
  paint: string;
  x?: number;
  y?: number;
  z?: number;
}> = ({ seed, lamp, paint, x = 0, y = 0.28, z = 0 }) => {
  const canvas = React.useMemo(() => paintingTexture(seed, lamp, paint), [seed, lamp, paint]);
  return (
    <group position={[x, y, z]}>
      <mesh>
        <boxGeometry args={[0.16, 0.2, 0.012]} />
        <meshStandardMaterial color="#4a3018" roughness={0.5} metalness={0.08} />
      </mesh>
      <mesh position={[0, 0, 0.008]}>
        <planeGeometry args={[0.13, 0.16]} />
        <meshStandardMaterial map={canvas} roughness={0.8} />
      </mesh>
    </group>
  );
};

export const OrientalRug: React.FC<{ hex: string; accent: string; w: number; d: number }> = ({
  hex,
  accent,
  w,
  d,
}) => {
  const map = React.useMemo(() => rugTexture(hex, accent), [hex, accent]);
  return (
    <mesh position={[0, 0.012, 0.04]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[Math.min(w * 0.55, 0.7), Math.min(d * 0.4, 0.45)]} />
      <meshStandardMaterial map={map} roughness={0.9} />
    </mesh>
  );
};

export const BookRow: React.FC<{ x?: number; z?: number; count?: number }> = ({
  x = 0,
  z = 0,
  count = 7,
}) => {
  const colors = ['#6a2a28', '#2a3a58', '#c4a060', '#3a4a38', '#8a4a38', '#2a241c', '#5a3a60'];
  return (
    <group position={[x, 0.22, z]}>
      {Array.from({ length: count }).map((_, i) => (
        <mesh
          key={i}
          position={[(i - count / 2) * 0.028, 0, 0]}
          rotation={[0, 0, (i % 5) * 0.02]}
          castShadow
        >
          <boxGeometry args={[0.022, 0.12 + (i % 3) * 0.02, 0.08]} />
          <meshStandardMaterial color={colors[i % colors.length]} roughness={0.7} />
        </mesh>
      ))}
    </group>
  );
};

export const Barrel: React.FC<{ x?: number; z?: number }> = ({ x = 0, z = 0 }) => (
  <group position={[x, 0.1, z]} rotation={[0, 0.4, Math.PI / 2]}>
    <mesh geometry={barrelGeo} castShadow>
      <meshStandardMaterial color="#5a3c28" roughness={0.8} />
    </mesh>
  </group>
);

export const WineBottle: React.FC<{ color: string; x?: number; z?: number }> = ({
  color,
  x = 0,
  z = 0,
}) => (
  <mesh geometry={bottleGeo} position={[x, 0, z]} castShadow>
    <meshStandardMaterial color={color} roughness={0.25} metalness={0.15} transparent opacity={0.92} />
  </mesh>
);

export const ShopGoods: React.FC<{ wood?: THREE.Texture; width: number; z?: number }> = ({
  wood,
  width,
  z = 0,
}) => (
  <group>
    <mesh position={[0, 0.16, z]} castShadow>
      <boxGeometry args={[width * 0.62, 0.04, 0.22]} />
      <WoodMat map={wood} color="#5a3e28" />
    </mesh>
    <mesh position={[0, 0.08, z]} castShadow>
      <boxGeometry args={[width * 0.58, 0.16, 0.2]} />
      <WoodMat map={wood} color="#4a3222" />
    </mesh>
    <mesh geometry={urnGeo} position={[-0.14, 0.18, z]} castShadow>
      <meshStandardMaterial color="#c45a32" roughness={0.4} />
    </mesh>
    <mesh geometry={vaseGeo} position={[0.02, 0.18, z]} castShadow>
      <meshStandardMaterial color="#d4b06a" roughness={0.45} />
    </mesh>
    <WineBottle color="#3a1a22" x={0.16} z={z} />
  </group>
);

export const IronStove: React.FC<{ x?: number; z?: number }> = ({ x = 0, z = 0 }) => (
  <group position={[x, 0, z]}>
    <mesh position={[0, 0.14, 0]} castShadow>
      <cylinderGeometry args={[0.08, 0.09, 0.28, 14]} />
      <meshStandardMaterial color="#3a4044" roughness={0.4} metalness={0.35} />
    </mesh>
    <mesh position={[0, 0.34, 0]}>
      <cylinderGeometry args={[0.025, 0.028, 0.16, 8]} />
      <meshStandardMaterial color="#2a3034" metalness={0.4} roughness={0.45} />
    </mesh>
    <mesh position={[0.05, 0.16, 0.07]}>
      <sphereGeometry args={[0.02, 8, 8]} />
      <meshStandardMaterial color="#e07030" emissive="#e07030" emissiveIntensity={0.9} />
    </mesh>
  </group>
);

export const WindowBay: React.FC<{
  w: number;
  h: number;
  glow: number;
  lamp: string;
  dusk?: boolean;
}> = ({ w, h, glow, lamp, dusk = true }) => {
  const ww = Math.min(0.38, w * 0.42);
  const hh = Math.min(0.42, h * 0.48);
  const fabric = React.useMemo(() => fabricTexture('#e8d2b0'), []);
  return (
    <group>
      <mesh>
        <planeGeometry args={[ww, hh]} />
        <meshStandardMaterial
          color={dusk ? '#f0c078' : lamp}
          emissive={dusk ? '#e8a050' : lamp}
          emissiveIntensity={glow}
          toneMapped={false}
        />
      </mesh>
      <mesh position={[0, 0, 0.004]}>
        <boxGeometry args={[ww + 0.03, 0.018, 0.02]} />
        <meshStandardMaterial color="#3a2a1c" roughness={0.6} />
      </mesh>
      <mesh position={[0, hh / 2, 0.004]}>
        <boxGeometry args={[ww + 0.03, 0.02, 0.022]} />
        <meshStandardMaterial color="#3a2a1c" roughness={0.6} />
      </mesh>
      <mesh position={[0, -hh / 2, 0.004]}>
        <boxGeometry args={[ww + 0.03, 0.02, 0.022]} />
        <meshStandardMaterial color="#3a2a1c" roughness={0.6} />
      </mesh>
      <mesh position={[-ww / 2, 0, 0.004]}>
        <boxGeometry args={[0.018, hh, 0.02]} />
        <meshStandardMaterial color="#3a2a1c" roughness={0.6} />
      </mesh>
      <mesh position={[ww / 2, 0, 0.004]}>
        <boxGeometry args={[0.018, hh, 0.02]} />
        <meshStandardMaterial color="#3a2a1c" roughness={0.6} />
      </mesh>
      <mesh position={[0, 0, 0.006]}>
        <boxGeometry args={[0.01, hh, 0.012]} />
        <meshStandardMaterial color="#2a1c12" />
      </mesh>
      <mesh position={[0, 0, 0.006]}>
        <boxGeometry args={[ww, 0.01, 0.012]} />
        <meshStandardMaterial color="#2a1c12" />
      </mesh>
      <mesh position={[-ww * 0.38, -0.02, 0.02]} rotation={[0, 0.15, 0]}>
        <planeGeometry args={[ww * 0.28, hh * 0.95]} />
        <meshStandardMaterial map={fabric} color="#e8dcc8" side={THREE.DoubleSide} roughness={0.85} transparent opacity={0.88} />
      </mesh>
      <mesh position={[ww * 0.38, -0.02, 0.02]} rotation={[0, -0.15, 0]}>
        <planeGeometry args={[ww * 0.28, hh * 0.95]} />
        <meshStandardMaterial map={fabric} color="#e8dcc8" side={THREE.DoubleSide} roughness={0.85} transparent opacity={0.88} />
      </mesh>
    </group>
  );
};

export const BalconyRail: React.FC<{ width: number; z: number }> = ({ width, z }) => (
  <group position={[0, -0.28, z]}>
    <mesh position={[0, 0.02, 0]}>
      <boxGeometry args={[width * 0.92, 0.02, 0.08]} />
      <meshStandardMaterial color="#6a5a48" roughness={0.55} metalness={0.15} />
    </mesh>
    {Array.from({ length: Math.max(4, Math.round(width * 5)) }).map((_, i, arr) => (
      <mesh key={i} position={[((i + 0.5) / arr.length - 0.5) * width * 0.88, 0.08, 0]}>
        <cylinderGeometry args={[0.006, 0.006, 0.12, 6]} />
        <meshStandardMaterial color="#3a3230" metalness={0.45} roughness={0.4} />
      </mesh>
    ))}
    <mesh position={[0, 0.14, 0]}>
      <boxGeometry args={[width * 0.9, 0.012, 0.03]} />
      <meshStandardMaterial color="#2a2420" metalness={0.4} roughness={0.4} />
    </mesh>
  </group>
);

export const StairFlight: React.FC<{ h: number }> = ({ h }) => (
  <group>
    {Array.from({ length: 7 }).map((_, i) => (
      <mesh
        key={i}
        position={[Math.sin(i * 0.45) * 0.12, -h * 0.35 + i * 0.09, 0.05 - i * 0.04]}
        rotation={[0, i * 0.2, 0]}
        castShadow
      >
        <boxGeometry args={[0.28, 0.03, 0.12]} />
        <meshStandardMaterial color="#6a4a30" roughness={0.65} />
      </mesh>
    ))}
    <mesh position={[0.16, 0, 0]} castShadow>
      <cylinderGeometry args={[0.015, 0.015, h * 0.7, 8]} />
      <meshStandardMaterial color="#c4a06a" metalness={0.4} roughness={0.4} />
    </mesh>
  </group>
);

export const ElevatorCage: React.FC<{ w: number; h: number; d: number; selected: boolean }> = ({
  w,
  h,
  selected,
}) => (
  <group>
    {[-0.22, -0.11, 0, 0.11, 0.22].map((x) => (
      <mesh key={x} position={[x * Math.min(1, w), 0, 0.05]}>
        <cylinderGeometry args={[0.01, 0.01, h * 0.92, 8]} />
        <meshStandardMaterial color="#c4b07a" metalness={0.55} roughness={0.35} />
      </mesh>
    ))}
    <mesh position={[0, selected ? 0.08 : -h * 0.12, 0.08]} castShadow>
      <boxGeometry args={[w * 0.48, 0.28, 0.32]} />
      <meshStandardMaterial color="#2a241c" roughness={0.5} metalness={0.12} />
    </mesh>
    <mesh position={[0, selected ? 0.08 : -h * 0.12, 0.25]}>
      <planeGeometry args={[w * 0.32, 0.16]} />
      <meshStandardMaterial color="#e8b14a" emissive="#e8b14a" emissiveIntensity={0.4} />
    </mesh>
  </group>
);
