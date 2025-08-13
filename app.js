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