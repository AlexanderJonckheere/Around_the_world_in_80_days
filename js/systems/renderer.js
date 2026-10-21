import * as THREE from 'three/webgpu';

export async function createRenderer(container) {
  // No logarithmic depth: the cloud pass reads the depth buffer as standard perspective depth
  const renderer = new THREE.WebGPURenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setSize(window.innerWidth, window.innerHeight);
  // No tone mapping: the Shadertoy clouds are already display colours, and the baked cabin should
  // show exactly the colours from the bake
  renderer.toneMapping = THREE.NoToneMapping;
  container.appendChild(renderer.domElement);
  await renderer.init();
  return renderer;
}
