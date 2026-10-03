import { INITIAL_PLAYER_STATE } from '../utils/gameLogic';
import { PlayerState } from '../types';
import { Action } from './types';
import { step } from './step';

export interface SaveFile {
  version: 7;
  actions: Action[];
}

export function createSave(actions: Action[]): SaveFile {
  return { version: 7, actions: [...actions] };
}

export function replay(actions: Action[]): PlayerState {
  return actions.reduce((state, action) => step(state, action).state, INITIAL_PLAYER_STATE);
}
