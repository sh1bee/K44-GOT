uniform sampler2D uAtlas;
uniform vec2 uAtlasGridSize;
uniform float _Opacity;

varying vec2 vUv;
varying float vInstanceID;
varying float vAspectRatio;

void main() {
  // Tính toán vị trí cột và hàng của instance trong atlas
  float col = mod(vInstanceID, uAtlasGridSize.x);
  float row = floor(vInstanceID / uAtlasGridSize.x);

  // Tính toán UV mới để "zoom" vào đúng ô ảnh
  vec2 newUv = vec2(
    (vUv.x + col) / uAtlasGridSize.x,
    (vUv.y + row) / uAtlasGridSize.y
  );

  vec4 color = texture2D(uAtlas, newUv);

  // Loại bỏ các pixel trong suốt (viền đen của canvas)
  if (color.a < 0.1) discard;

  // Apply opacity and fade towards edges for smoother blending
  float distance = length(vUv - 0.5) * 2.0;
  float edgeFade = 1.0 - smoothstep(0.7, 1.0, distance);
  
  color.a *= _Opacity * edgeFade;

  gl_FragColor = color;
}