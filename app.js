import Sketch from "./function/Sketch.js";

let sketch = new Sketch({
  dom: document.getElementById("container"),
});
window.reloadGalaxyImages = function() {
  if (sketch) sketch.reloadImages();
};

const randomButton = document.querySelector(".btn");
randomButton.addEventListener("click", () => {
  sketch.moveCameraToRandomImage();
});
document.getElementById('next-btn').addEventListener('click', () => {
  // Nếu chưa có ảnh nào được chọn, chọn ảnh đầu tiên
  const nextIndex = sketch.currentImageIndex === -1 ? 0 : sketch.currentImageIndex + 1;
  sketch.focusOnImageByIndex(nextIndex);
});

document.getElementById('prev-btn').addEventListener('click', () => {
  // Nếu chưa có ảnh nào được chọn, chọn ảnh cuối cùng
  const prevIndex = sketch.currentImageIndex === -1 ? sketch.imageParticleData.length - 1 : sketch.currentImageIndex - 1;
  sketch.focusOnImageByIndex(prevIndex);
});