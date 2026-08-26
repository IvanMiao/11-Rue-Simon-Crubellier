import React from 'react';
import { knightBaseGeo } from './modelKit';

const ChessKnight: React.FC<{ color?: string }> = ({ color = '#d4b06a' }) => (
  <group>
    <mesh geometry={knightBaseGeo} castShadow>
      <meshStandardMaterial color={color} roughness={0.32} metalness={0.22} />
    </mesh>
    <mesh position={[0.01, 0.15, 0]} rotation={[0, 0, 0.35]} castShadow>
      <cylinderGeometry args={[0.018, 0.032, 0.1, 10]} />
      <meshStandardMaterial color={color} roughness={0.32} metalness={0.2} />
    </mesh>
    <mesh position={[0.055, 0.21, 0]} rotation={[0, 0, 0.9]} castShadow>
      <sphereGeometry args={[0.032, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.7]} />
      <meshStandardMaterial color={color} roughness={0.3} metalness={0.2} />
    </mesh>
    <mesh position={[0.078, 0.225, 0]} rotation={[0.2, 0, 1.1]} castShadow>
      <coneGeometry args={[0.012, 0.04, 8]} />
      <meshStandardMaterial color={color} roughness={0.3} />
    </mesh>
    <mesh position={[0.04, 0.245, 0.01]} castShadow>
      <coneGeometry args={[0.01, 0.035, 6]} />
      <meshStandardMaterial color={color} roughness={0.3} />
    </mesh>
    <mesh position={[0.04, 0.245, -0.01]} castShadow>
      <coneGeometry args={[0.01, 0.035, 6]} />
      <meshStandardMaterial color={color} roughness={0.3} />
    </mesh>
    <mesh position={[-0.01, 0.175, 0.018]} rotation={[0.4, 0.2, 0.1]}>
      <boxGeometry args={[0.02, 0.06, 0.012]} />
      <meshStandardMaterial color={color} roughness={0.35} />
    </mesh>
    <mesh position={[0.07, 0.215, 0.018]}>
      <sphereGeometry args={[0.006, 6, 6]} />
      <meshStandardMaterial color="#1a120c" roughness={0.6} />
    </mesh>
  </group>
);

export default ChessKnight;
