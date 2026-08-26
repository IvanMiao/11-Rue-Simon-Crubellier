import React from 'react';

interface FigureProps {
  pose?: 'stand' | 'sit' | 'pair';
  coat?: string;
  hair?: string;
}

const COATS = ['#6a2a28', '#2a3a58', '#3a4a38', '#8a4a38', '#2a241c', '#5a3a60'];
const HAIR = ['#1a120c', '#3a2418', '#6a4a28', '#c4b49a', '#2a2018'];

const Person: React.FC<{
  pose: 'stand' | 'sit';
  coat: string;
  hair: string;
  x?: number;
}> = ({ pose, coat, hair, x = 0 }) => {
  const sitting = pose === 'sit';
  const dress = sitting || coat.startsWith('#6') || coat.startsWith('#8');
  return (
    <group position={[x, sitting ? 0.02 : 0.0, 0.1]}>
      <mesh position={[0, sitting ? 0.48 : 0.52, 0]} castShadow>
        <sphereGeometry args={[0.048, 14, 12]} />
        <meshStandardMaterial color="#c4a882" roughness={0.65} />
      </mesh>
      <mesh position={[0, sitting ? 0.515 : 0.555, -0.002]} castShadow>
        <sphereGeometry args={[0.05, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
        <meshStandardMaterial color={hair} roughness={0.8} />
      </mesh>
      <mesh position={[0, sitting ? 0.56 : 0.6, 0]} castShadow>
        <cylinderGeometry args={[0.02, 0.055, 0.04, 10]} />
        <meshStandardMaterial color={coat} roughness={0.6} />
      </mesh>
      <mesh position={[0.016, sitting ? 0.478 : 0.518, 0.04]}>
        <sphereGeometry args={[0.006, 6, 6]} />
        <meshStandardMaterial color="#1a120c" />
      </mesh>
      <mesh position={[-0.016, sitting ? 0.478 : 0.518, 0.04]}>
        <sphereGeometry args={[0.006, 6, 6]} />
        <meshStandardMaterial color="#1a120c" />
      </mesh>
      <mesh position={[0, sitting ? 0.46 : 0.5, 0.045]}>
        <sphereGeometry args={[0.007, 6, 6]} />
        <meshStandardMaterial color="#a87860" roughness={0.7} />
      </mesh>
      <mesh position={[0, sitting ? 0.36 : 0.34, 0]} castShadow>
        <cylinderGeometry args={[0.05, sitting ? 0.07 : 0.055, sitting ? 0.16 : 0.22, 12]} />
        <meshStandardMaterial color={coat} roughness={0.62} />
      </mesh>
      {dress ? (
        <mesh position={[0, sitting ? 0.22 : 0.16, 0]} castShadow>
          <cylinderGeometry args={[sitting ? 0.09 : 0.08, 0.05, 0.16, 12]} />
          <meshStandardMaterial color={coat} roughness={0.64} />
        </mesh>
      ) : (
        <>
          <mesh position={[-0.022, 0.12, 0]} castShadow>
            <cylinderGeometry args={[0.018, 0.02, 0.16, 8]} />
            <meshStandardMaterial color="#241c16" roughness={0.75} />
          </mesh>
          <mesh position={[0.022, 0.12, 0]} castShadow>
            <cylinderGeometry args={[0.018, 0.02, 0.16, 8]} />
            <meshStandardMaterial color="#241c16" roughness={0.75} />
          </mesh>
        </>
      )}
      <mesh position={[-0.07, sitting ? 0.34 : 0.32, 0.02]} rotation={[0.2, 0, 0.4]} castShadow>
        <cylinderGeometry args={[0.014, 0.016, 0.16, 8]} />
        <meshStandardMaterial color={coat} roughness={0.62} />
      </mesh>
      <mesh position={[0.07, sitting ? 0.34 : 0.32, 0.02]} rotation={[0.15, 0, -0.35]} castShadow>
        <cylinderGeometry args={[0.014, 0.016, 0.16, 8]} />
        <meshStandardMaterial color={coat} roughness={0.62} />
      </mesh>
      {sitting && (
        <mesh position={[0.08, 0.14, 0.04]} rotation={[-1.15, 0, 0.2]} castShadow>
          <cylinderGeometry args={[0.018, 0.02, 0.16, 8]} />
          <meshStandardMaterial color="#241c16" roughness={0.75} />
        </mesh>
      )}
    </group>
  );
};

const Figure: React.FC<FigureProps> = ({ pose = 'stand', coat, hair }) => {
  const c = coat || COATS[0];
  const h = hair || HAIR[0];
  if (pose === 'pair') {
    return (
      <group>
        <Person pose="stand" coat={c} hair={h} x={-0.09} />
        <Person pose="sit" coat={COATS[1]} hair={HAIR[3]} x={0.1} />
      </group>
    );
  }
  return <Person pose={pose} coat={c} hair={h} />;
};

export { COATS, HAIR };
export default Figure;
