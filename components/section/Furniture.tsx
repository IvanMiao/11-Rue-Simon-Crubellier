import React from 'react';
import { woodTexture } from '../../utils/canvasTextures';
import { FurnishSet } from '../../utils/roomArt';
import {
  Armchair,
  Barrel,
  BookRow,
  Daybed,
  Easel,
  IronStove,
  PedestalTable,
  SalonChair,
  ShopGoods,
  TurnedLamp,
  Wardrobe,
  WineBottle,
} from './modelKit';

interface FurnitureProps {
  set: FurnishSet;
  lamp: string;
  paint: string;
  seed: number;
  width: number;
  depth: number;
}

const Furniture: React.FC<FurnitureProps> = ({ set, lamp, paint, seed, width, depth }) => {
  const wood = React.useMemo(() => woodTexture(), []);
  const left = -width * 0.28;
  const right = width * 0.22;
  const back = -depth * 0.22;
  const flip = seed % 2 === 0 ? 1 : -1;
  const fabric = seed % 3 === 0 ? '#7a3a32' : seed % 3 === 1 ? '#2a3a58' : '#4a5a3c';

  if (set === 'empty') return null;

  return (
    <group scale={[flip, 1, 1]}>
      {set === 'cave' && (
        <>
          <Barrel x={left} z={back} />
          <WineBottle color="#3a1220" x={0.08} z={back} />
          <WineBottle color="#5a1a18" x={0.14} z={back + 0.05} />
          <TurnedLamp color={lamp} x={right * 0.4} z={back} />
        </>
      )}
      {set === 'shop' && <ShopGoods wood={wood} width={width} z={back} />}
      {set === 'service' && (
        <>
          <IronStove x={left} z={back} />
          <mesh position={[right, 0.08, 0.02]} rotation={[0, 0.3, 0]} castShadow>
            <cylinderGeometry args={[0.07, 0.08, 0.06, 12]} />
            <meshStandardMaterial color="#c4c0b4" roughness={0.45} metalness={0.2} />
          </mesh>
        </>
      )}
      {set === 'atelier' && (
        <>
          <Easel seed={seed} lamp={lamp} paint={paint} x={left} z={back} />
          <BookRow x={right} z={back} count={5} />
          <TurnedLamp color={lamp} x={right} z={back + 0.08} />
        </>
      )}
      {set === 'bedroom' && (
        <>
          <Daybed linen="#c4a882" wood={wood} x={left} z={back * 0.35} />
          <Wardrobe wood={wood} x={right} z={back} />
          <group position={[0.02, 0.2, back]}>
            <TurnedLamp color={lamp} />
          </group>
        </>
      )}
      {set === 'salon' && (
        <>
          <PedestalTable wood={wood} x={0.1} z={back} />
          <SalonChair fabric={fabric} wood={wood} x={-0.12} z={back + 0.08} rot={0.6} />
          <Armchair fabric={fabric} x={left} z={0.04} rot={-0.5} />
          <group position={[0.1, 0.21, back]}>
            <TurnedLamp color={lamp} />
          </group>
          <BookRow x={right} z={back} count={6} />
        </>
      )}
    </group>
  );
};

export default Furniture;
