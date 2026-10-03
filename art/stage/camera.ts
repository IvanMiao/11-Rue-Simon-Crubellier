import type { OrthographicCamera } from 'three';

export const STAGE_CAMERA = {
  position: [4.8, 3.2, 6.8] as const,
  target: [0, 1.1, 0] as const,
  finalHeight: 4.4,
  introScale: 2.2,
} as const;

export function setStageCameraFrustum(
  camera: OrthographicCamera,
  width: number,
  height: number,
  viewHeight: number
) {
  const aspect = width / height;
  camera.left = (-viewHeight * aspect) / 2;
  camera.right = (viewHeight * aspect) / 2;
  camera.top = viewHeight / 2;
  camera.bottom = -viewHeight / 2;
  camera.updateProjectionMatrix();
}

export function configureStageCamera(
  camera: OrthographicCamera,
  width: number,
  height: number,
  viewHeight = STAGE_CAMERA.finalHeight
) {
  camera.position.set(...STAGE_CAMERA.position);
  camera.lookAt(...STAGE_CAMERA.target);
  setStageCameraFrustum(camera, width, height, viewHeight);
  camera.updateMatrixWorld();
}
