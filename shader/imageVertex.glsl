uniform float _Time;
uniform float _Opacity;

varying vec2 vUv;
varying float vInstanceID;
varying float vAspectRatio;

void main() {
    vUv = uv;
    
    // Extract instance ID from instanceMatrix (use a simple approach)
    vInstanceID = float(gl_InstanceID);
    vAspectRatio = 1.0; // Will be handled by scaling in the InstancedMesh setup
    
    // Apply instanced transformation and basic animation
    vec4 instancePosition = instanceMatrix * vec4(position, 1.0);
    
    // Add some rotation animation
    float time = _Time * 0.5;
    float rotationAngle = time + float(gl_InstanceID) * 0.1;
    mat3 rotation = mat3(
        cos(rotationAngle), 0.0, sin(rotationAngle),
        0.0, 1.0, 0.0,
        -sin(rotationAngle), 0.0, cos(rotationAngle)
    );
    
    instancePosition.xyz = rotation * instancePosition.xyz;
    
    gl_Position = projectionMatrix * modelViewMatrix * instancePosition;
}