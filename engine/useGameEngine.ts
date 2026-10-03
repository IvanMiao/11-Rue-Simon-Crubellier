import { useCallback, useEffect, useRef, useState } from 'react';
import { STORAGE_KEY } from '../constants/skills';
import { INITIAL_PLAYER_STATE } from '../utils/gameLogic';
import { Action, GameEvent } from './types';
import { createSave, replay, SaveFile } from './save';
import { step } from './step';
import { PlayerState } from '../types';

export function useGameEngine() {
  const [state, setState] = useState<PlayerState>(INITIAL_PLAYER_STATE);
  const [actions, setActions] = useState<Action[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);
  const stateRef = useRef(state);
  const actionsRef = useRef(actions);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as SaveFile;
        if (parsed.version === 6 && Array.isArray(parsed.actions)) {
          const replayedState = replay(parsed.actions);
          stateRef.current = replayedState;
          actionsRef.current = parsed.actions;
          setState(replayedState);
          setActions(parsed.actions);
        }
      } catch (error) {
        console.error('Failed to replay saved run', error);
      }
    }
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (isHydrated) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(createSave(actions)));
    }
  }, [actions, isHydrated]);

  const dispatch = useCallback((action: Action): GameEvent[] => {
    const result = step(stateRef.current, action);
    const nextActions = [...actionsRef.current, action];
    stateRef.current = result.state;
    actionsRef.current = nextActions;
    setState(result.state);
    setActions(nextActions);
    return result.events;
  }, []);

  const reset = useCallback(() => {
    stateRef.current = INITIAL_PLAYER_STATE;
    actionsRef.current = [];
    setState(INITIAL_PLAYER_STATE);
    setActions([]);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const getState = useCallback(() => stateRef.current, []);

  return { state, actions, isHydrated, dispatch, reset, getState };
}
