import * as THREE from 'three';

export function disposeGroup(group: THREE.Group): void {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  group.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (mesh.geometry) geometries.add(mesh.geometry);
    const list = [
      ...(Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : []),
      ...(Array.isArray(mesh.userData.sketchOriginalMaterial)
        ? mesh.userData.sketchOriginalMaterial
        : mesh.userData.sketchOriginalMaterial
          ? [mesh.userData.sketchOriginalMaterial]
          : []),
      ...(mesh.userData.sketchSilhouetteMaterial ? [mesh.userData.sketchSilhouetteMaterial] : []),
    ] as THREE.Material[];
    for (const material of list) {
      if (material.userData.shared) continue;
      materials.add(material);
      for (const value of Object.values(material)) {
        if (value instanceof THREE.Texture && !value.userData.shared) textures.add(value);
      }
    }
  });
  textures.forEach((texture) => texture.dispose());
  materials.forEach((material) => material.dispose());
  geometries.forEach((geometry) => geometry.dispose());
  group.clear();
}
