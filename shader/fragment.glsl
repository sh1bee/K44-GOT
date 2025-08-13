precision highp float;
precision highp int;

uniform sampler2D _MainTexture;
uniform float _Time;
uniform float _Opacity;
uniform int uColorMode;
uniform vec3 _Color;
uniform float _ColorRotationSpeed; 
varying vec3 v_w_pos;
uniform float uLowQuality;
// =======================================================


// === CÁC HÀM HỖ TRỢ (Giữ nguyên) ===
// (Bộ hàm noise 4D, hàm rotation3dY, hàm getColorFromPalette của bạn)
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
float mod289(float x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
float permute(float x) { return mod289(((x*34.0)+1.0)*x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
vec4 grad4(float j, vec4 ip) {
    const vec4 ones = vec4(1.0, 1.0, 1.0, -1.0);
    vec4 p,s;
    p.xyz = floor( fract (vec3(j) * ip.xyz) * 7.0) * ip.z - 1.0;
    p.w = 1.5 - dot(abs(p.xyz), ones.xyz);
    s = vec4(lessThan(p, vec4(0.0)));
    p.xyz = p.xyz + (s.xyz*2.0 - 1.0) * s.www; 
    return p;
}
float snoise(vec4 v) {
    const vec4 C = vec4(0.138196601125010504, 0.276393202250021009, 0.414589803375031513, -0.447213595499957939);
    vec4 i = floor(v + dot(v, C.yyyy)); vec4 x0 = v - i + dot(i, C.xxxx);
    vec4 i0; vec3 isX = step(x0.yzw, x0.xxx); vec3 isYZ = step(x0.zww, x0.yyz);
    i0.x = isX.x + isX.y + isX.z; i0.yzw = 1.0 - isX;
    i0.y += isYZ.x + isYZ.y; i0.zw += 1.0 - isYZ.xy; i0.z += isYZ.z; i0.w += 1.0 - isYZ.z;
    vec4 i3 = clamp(i0, 0.0, 1.0); vec4 i2 = clamp(i0 - 1.0, 0.0, 1.0); vec4 i1 = clamp(i0 - 2.0, 0.0, 1.0);
    vec4 x1 = x0 - i1 + C.xxxx; vec4 x2 = x0 - i2 + C.yyyy; vec4 x3 = x0 - i3 + C.zzzz; vec4 x4 = x0 + C.wwww;
    i = mod289(i);
    float j0 = permute(permute(permute(permute(i.w) + i.z) + i.y) + i.x);
    vec4 j1 = permute(permute(permute(permute(i.w + vec4(i1.w, i2.w, i3.w, 1.0)) + i.z + vec4(i1.z, i2.z, i3.z, 1.0)) + i.y + vec4(i1.y, i2.y, i3.y, 1.0)) + i.x + vec4(i1.x, i2.x, i3.x, 1.0));
    vec4 ip = vec4(1.0 / 294.0, 1.0 / 49.0, 1.0 / 7.0, 0.0);
    vec4 p0 = grad4(j0, ip); vec4 p1 = grad4(j1.x, ip); vec4 p2 = grad4(j1.y, ip); vec4 p3 = grad4(j1.z, ip); vec4 p4 = grad4(j1.w, ip);
    vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
    vec3 m0 = max(0.6 - vec3(dot(x0, x0), dot(x1, x1), dot(x2, x2)), 0.0);
    vec2 m1 = max(0.6 - vec2(dot(x3, x3), dot(x4, x4)), 0.0);
    m0 = m0 * m0; m1 = m1 * m1;
    return 49.0 * (dot(m0 * m0, vec3(dot(p0, x0), dot(p1, x1), dot(p2, x2))) + dot(m1 * m1, vec2(dot(p3, x3), dot(p4, x4))));
}
mat3 rotation3dY(float angle) {
  float s = sin(angle); float c = cos(angle);
  return mat3(c, 0.0, -s, 0.0, 1.0, 0.0, s, 0.0, c);
}
vec3 getColorFromPalette(float value) {
    vec3 color1 = vec3(0.05, 0.0, 0.1); vec3 color2 = vec3(0.4, 0.1, 0.5);
    vec3 color3 = vec3(0.9, 0.2, 0.4); vec3 color4 = vec3(1.0, 0.8, 0.9);
    vec3 finalColor = color1;
    finalColor = mix(finalColor, color2, smoothstep(0.0, 0.3, value));
    finalColor = mix(finalColor, color3, smoothstep(0.3, 0.65, value));
    finalColor = mix(finalColor, color4, smoothstep(0.65, 0.8, value));
    return finalColor;
}


void main() {
    vec3 finalColor;

    if (uColorMode == 0) {
        float timeSpeed = 0.7;
        mat3 rotationMatrix = rotation3dY(_Time * _ColorRotationSpeed);
        vec3 rotated_pos = rotationMatrix * v_w_pos;
        float baseFrequency = 0.6;
        float noiseValue = 0.0;

        if(uLowQuality > 0.5) {
            // Chế độ low quality: chỉ dùng 1 octave, noise đơn giản
            float n = snoise(vec4(rotated_pos * baseFrequency, 0.0));
            noiseValue = (n * 0.5) + 0.5;
        } else {
            // Đầy đủ octave, màu động đẹp như cũ
            int octaves = 5;
            float amplitude = 0.5;
            float frequency = baseFrequency;
            for (int i = 0; i < octaves; i++) {
                float n = snoise(vec4(rotated_pos * frequency, 0.0));
                noiseValue += n * amplitude;
                frequency *= 2.0;
                amplitude *= 0.5;
            }
            noiseValue = (noiseValue + 1.0) / 2.0;
        }
        finalColor = getColorFromPalette(noiseValue);
    } else {
        finalColor = _Color;
    }

    vec4 tex = texture2D(_MainTexture, gl_PointCoord);
    float finalAlpha = tex.a * _Opacity;
    if (finalAlpha < 0.01) discard;
    gl_FragColor = vec4(finalColor, finalAlpha);
}