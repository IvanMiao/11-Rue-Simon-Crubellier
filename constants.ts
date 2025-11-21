import { RoomData } from './types';

// The building is a 10x10 grid (Floors -1 to 8 = 10 floors).
// Total columns must sum to 10 per floor.

export const BUILDING_LAYOUT: RoomData[] = [
  // Floor 8 (Attics / Maid rooms)
  { id: '8-1', name: 'HUTTING', floor: 8, colSpan: 2, rowSpan: 2, type: 'apartment' },
  { id: '8-2', name: 'SMAUTF', floor: 8, colSpan: 1, type: 'service' },
  { id: '8-3', name: 'SUTTON', floor: 8, colSpan: 1, type: 'service' },
  { id: '8-4', name: 'ORLOWSKA', floor: 8, colSpan: 1, type: 'service' },
  { id: '8-5', name: 'ALBIN', floor: 8, colSpan: 1, type: 'service' },
  { id: '8-6', name: 'MORELLET', floor: 8, colSpan: 1, type: 'service' },
  { id: '8-7', name: 'PLASSAERT', floor: 8, colSpan: 3, type: 'apartment' },

  // Floor 7
  { id: '7-1', name: 'GRATIOLET', floor: 7, colSpan: 2, type: 'apartment' },
  { id: '7-2', name: 'CRESPI', floor: 7, colSpan: 1, type: 'apartment' },
  { id: '7-3', name: 'NIETO & ROGERS', floor: 7, colSpan: 1, type: 'apartment' },
  { id: '7-4', name: '', floor: 7, colSpan: 1, type: 'apartment' },
  { id: '7-5', name: '', floor: 7, colSpan: 1, type: 'apartment' },
  { id: '7-6', name: 'BREIDEL', floor: 7, colSpan: 1, type: 'service' },
  { id: '7-7', name: 'VALÈNE', floor: 7, colSpan: 1, type: 'apartment' },

  // Floor 6
  { id: '6-1', name: 'CINOC', floor: 6, colSpan: 2, type: 'apartment' },
  { id: '6-2', name: 'DINTEVILLE', floor: 6, colSpan: 3, type: 'apartment' },
  { id: 'ELEVATOR', name: 'ELEVATOR', floor: 6, colSpan: 2, rowSpan: 6, type: 'elevator' },
  { id: '6-3', name: 'WINCKLER', floor: 6, colSpan: 3, type: 'apartment' },

  // Floor 5
  { id: '5-1', name: 'RÉOL', floor: 5, colSpan: 2, type: 'apartment' },
  { id: '5-2', name: 'RORSCHASH', floor: 5, colSpan: 3, type: 'apartment' }, // Rorschach is a duplex ideally
  { id: '5-3', name: 'FOULEROT', floor: 5, colSpan: 3, type: 'apartment' },

  // Floor 4
  { id: '4-1', name: 'BERGER', floor: 4, colSpan: 2, type: 'apartment' },
  { id: '4-2', name: 'RORSCHASH (BAS)', floor: 4, colSpan: 3, type: 'apartment' },
  { id: '4-3', name: 'MARQUISEAUX', floor: 4, colSpan: 3, type: 'apartment' },

  // Floor 3
  { id: '3-1', name: 'BARTLEBOOTH', floor: 3, colSpan: 5, type: 'apartment' },
  { id: '3-2', name: 'FOUREAU', floor: 3, colSpan: 3, type: 'apartment' },

  // Floor 2
  { id: '2-1', name: 'ALTAMONT', floor: 2, colSpan: 5, type: 'apartment' },
  { id: '2-2', name: 'DE BEAUMONT', floor: 2, colSpan: 3, type: 'apartment' },

  // Floor 1
  { id: '1-1', name: 'MOREAU', floor: 1, colSpan: 5, type: 'apartment' },
  { id: '1-2', name: 'LOUVET', floor: 1, colSpan: 3, type: 'apartment' },

  // Floor 0 (Rez-de-chaussée)
  { id: '0-1', name: 'SERVICE', floor: 0, colSpan: 1, type: 'service' },
  { id: '0-2', name: 'MARCIA', floor: 0, colSpan: 1, type: 'apartment' },
  { id: '0-3', name: 'ANTIQUITÉS', floor: 0, colSpan: 2, type: 'service' },
  { id: '0-4', name: 'LOGE', floor: 0, colSpan: 1, type: 'service' },
  { id: '0-5', name: 'HALL', floor: 0, colSpan: 2, type: 'stairwell' },
  { id: '0-6', name: 'MARCIA (SALON)', floor: 0, colSpan: 3, type: 'apartment' },

  // Floor -1 (Caves / Basement)
  { id: '-1-1', name: '', floor: -1, colSpan: 1, type: 'basement' },
  { id: '-1-2', name: 'CAVE (B)', floor: -1, colSpan: 1, type: 'basement' },
  { id: '-1-3', name: 'CHAUFFERIE', floor: -1, colSpan: 2, type: 'basement' },
  { id: '-1-4', name: 'CAVE (R/D)', floor: -1, colSpan: 1, type: 'basement' },
  { id: '-1-5', name: 'MACHINERIE', floor: -1, colSpan: 2, type: 'basement' },
  { id: '-1-6', name: 'CAVE (A/G)', floor: -1, colSpan: 1, type: 'basement' },
  { id: '-1-7', name: 'CAVE (M/M)', floor: -1, colSpan: 1, type: 'basement' },
  { id: '-1-8', name: 'CAVE (De)', floor: -1, colSpan: 1, type: 'basement' },

  // Hidden Floor (End Game)
  { id: '100-1', name: 'THE 100TH KEY', floor: 100, colSpan: 10, type: 'apartment' },
];