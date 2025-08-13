import * as THREE from "three";





export function createCircleTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const context = canvas.getContext('2d');
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  const radius = canvas.width / 2;
  const gradient = context.createRadialGradient(
    centerX, centerY, 0,
    centerX, centerY, radius
  );
  gradient.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
  gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.5)');
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);
  return new THREE.CanvasTexture(canvas);
}

export function generateBgStars(scene, parameters) {
  const bgStarsGeometry = new THREE.BufferGeometry();
  const bgStarsPositions = new Float32Array(parameters.stars * 3);
  for (let j = 0; j < parameters.stars; j++) {
    bgStarsPositions[j * 3 + 0] = (Math.random() - 0.5) * 200;
    bgStarsPositions[j * 3 + 1] = (Math.random() - 0.5) * 200;
    bgStarsPositions[j * 3 + 2] = (Math.random() - 0.5) * 200;
  }
  bgStarsGeometry.setAttribute(
    "position",
    new THREE.BufferAttribute(bgStarsPositions, 3)
  );
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  canvas.width = 16;
  canvas.height = 16;
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(8, 8, 8, 0, 2 * Math.PI);
  ctx.fill();
  const shape = new THREE.CanvasTexture(canvas);
  const bgStarsMaterial = new THREE.PointsMaterial({
    size: parameters.size,
    depthWrite: false,
    sizeAttenuation: true,
    blending: THREE.AdditiveBlending,
    color: parameters.starColor,
    transparent: true,
    alphaMap: shape
  });
  const bgStars = new THREE.Points(bgStarsGeometry, bgStarsMaterial);
  scene.add(bgStars);
  return bgStars;
}