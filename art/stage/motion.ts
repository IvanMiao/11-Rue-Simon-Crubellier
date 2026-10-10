import { cellOrigin3d, flightPath, SECTION_PITCH } from './sectionLayout';
import { playerSpot } from './cellScenes';

export interface Key {
  t: number;
  pos: [number, number, number];
  hop?: number;
}

export type MovementKind = 'walk' | 'knight' | 'elevator';

const WALK_STEP_MS = 420;
const KNIGHT_LEG_MS = 600;
const ELEVATOR_FLOOR_MS = 350;
const LIFT_COLUMN = 7;
const LIFT_Z = 1.84;

function positionForCell(cellId: string): [number, number, number] {
  const origin = cellOrigin3d(cellId);
  const spot = playerSpot(cellId);
  return [origin[0] + spot[0], origin[1] + spot[1], origin[2] + spot[2]];
}

function liftPosition(floor: number): [number, number, number] {
  const origin = cellOrigin3d(`${floor}:${LIFT_COLUMN}`);
  return [origin[0], origin[1] + 0.015, LIFT_Z];
}

function interpolate(
  from: [number, number, number],
  to: [number, number, number],
  t: number
): [number, number, number] {
  return [
    from[0] + (to[0] - from[0]) * t,
    from[1] + (to[1] - from[1]) * t,
    from[2] + (to[2] - from[2]) * t,
  ];
}

function appendWalk(
  keys: Key[],
  from: [number, number, number],
  to: [number, number, number],
  duration: number,
  hop = 0.18
): number {
  const started = duration;
  keys.push({
    t: started + WALK_STEP_MS / 2,
    pos: interpolate(from, to, 0.5),
    hop,
  });
  keys.push({ t: started + WALK_STEP_MS, pos: [...to], hop: 0 });
  return started + WALK_STEP_MS;
}

function walkKeys(
  path: string[],
  legDuration: number,
  passThroughDoors: boolean
): { duration: number; keys: Key[] } {
  const keys: Key[] = [{ t: 0, pos: positionForCell(path[0]), hop: 0 }];
  let duration = 0;
  for (let index = 1; index < path.length; index += 1) {
    const from = positionForCell(path[index - 1]);
    const to = positionForCell(path[index]);
    const started = duration;
    const [fromFloor, fromCol] = path[index - 1].split(':').map(Number);
    const [toFloor, toCol] = path[index].split(':').map(Number);
    const horizontalDoor =
      passThroughDoors && fromFloor === toFloor && Math.abs(fromCol - toCol) === 1;
    if (horizontalDoor) {
      const direction = Math.sign(toCol - fromCol);
      const boundary = (cellOrigin3d(path[index - 1])[0] + cellOrigin3d(path[index])[0]) / 2;
      const doorZ = 1.12;
      const doorStart: [number, number, number] = [
        boundary - direction * 0.08,
        from[1],
        doorZ,
      ];
      const doorEnd: [number, number, number] = [boundary + direction * 0.08, to[1], doorZ];
      keys.push(
        { t: started + legDuration / 3, pos: doorStart, hop: 0.08 },
        { t: started + (2 * legDuration) / 3, pos: doorEnd, hop: 0.08 }
      );
    } else {
      keys.push({
        t: started + legDuration / 2,
        pos: interpolate(from, to, 0.5),
        hop: legDuration === WALK_STEP_MS ? 0.18 : 0.34,
      });
    }
    duration += legDuration;
    keys.push({ t: duration, pos: to, hop: 0 });
  }
  return { duration, keys };
}

function elevatorKeys(path: string[]): { duration: number; keys: Key[] } {
  const fromId = path[0];
  const toId = path[path.length - 1];
  const fromFloor = Number(fromId.split(':')[0]);
  const toFloor = Number(toId.split(':')[0]);
  const fromLiftId = `${fromFloor}:${LIFT_COLUMN}`;
  const toLiftId = `${toFloor}:${LIFT_COLUMN}`;
  const keys: Key[] = [{ t: 0, pos: positionForCell(fromId), hop: 0 }];
  let duration = 0;

  if (fromId !== fromLiftId) {
    duration = appendWalk(keys, positionForCell(fromId), positionForCell(fromLiftId), duration);
  }
  const startLift = liftPosition(fromFloor);
  const endLift = liftPosition(toFloor);
  if (keys[keys.length - 1].pos.some((value, index) => value !== startLift[index])) {
    const from = keys[keys.length - 1].pos;
    const approachDuration = 120;
    keys.push({
      t: duration + approachDuration / 2,
      pos: interpolate(from, startLift, 0.5),
      hop: 0,
    });
    duration += approachDuration;
    keys.push({ t: duration, pos: startLift, hop: 0 });
  }

  const direction = Math.sign(toFloor - fromFloor);
  for (let floor = fromFloor; floor !== toFloor; floor += direction) {
    const y0 = floor * SECTION_PITCH.y + 0.015;
    const y1 = (floor + direction) * SECTION_PITCH.y + 0.015;
    for (let step = 1; step <= 4; step += 1) {
      const t = step / 4;
      const eased = t * t * (3 - 2 * t);
      duration += ELEVATOR_FLOOR_MS / 4;
      keys.push({
        t: duration,
        pos: [startLift[0], y0 + (y1 - y0) * eased, startLift[2]],
        hop: 0,
      });
    }
  }

  if (keys[keys.length - 1].pos.some((value, index) => value !== endLift[index])) {
    const from = keys[keys.length - 1].pos;
    const exitDuration = 120;
    keys.push({
      t: duration + exitDuration / 2,
      pos: interpolate(from, endLift, 0.5),
      hop: 0,
    });
    duration += exitDuration;
    keys.push({ t: duration, pos: endLift, hop: 0 });
  }
  if (toLiftId !== toId) {
    duration = appendWalk(keys, endLift, positionForCell(toId), duration);
  }
  return { duration, keys };
}

export function moveTimeline(
  path: string[],
  kind: MovementKind
): { duration: number; keys: Key[] } {
  if (path.length === 0) return { duration: 0, keys: [] };
  if (path.length === 1) return { duration: 0, keys: [{ t: 0, pos: positionForCell(path[0]), hop: 0 }] };
  if (kind === 'elevator') return elevatorKeys(path);
  const route = path.length === 2 ? flightPath(path[0], path[1], kind) : path;
  return walkKeys(route, kind === 'knight' ? KNIGHT_LEG_MS : WALK_STEP_MS, kind === 'walk');
}
