// FishModule.js - PHIEN BAN NHA MAY V3.1 - SUA LOI IMPORT

// <<< THAY ĐỔI DUY NHẤT Ở ĐÂY: THÊM DÒNG IMPORT BỊ THIẾU >>>
import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';

export function createFish(scene, camera, options = {}) {
    
    const defaults = {
        scale: 0.1,
        tiltAngle: 30,
        pathRadius: 12,
        pathRandomness: 2,
        yVariance: 3,
        colorHead: new THREE.Color(0x0180ff),
        colorTail: new THREE.Color(0xff8001),
        clickEffect: 'speedBoost',
        spinDirection: 1,
        spinType: 'roll', // 'roll' (dọc) hoặc 'pitch' (ngang)
    };
    const finalOptions = { ...defaults, ...options };

    return new Promise((resolve, reject) => {
        
        const fishState = {
            solidFish: null, hitSphere: null, trail: null, speedMultiplier: 1.0,
            customTime: 0, curve: null, fishLengthRatio: null,
            spinState: { active: false, speed: 0, angle: 0, }
        };

        const loader = new STLLoader(); // Dòng này bây giờ sẽ hoạt động

        loader.load("https://cywarr.github.io/small-shop/fish.stl", (objGeom) => {
                objGeom.center();
                objGeom.rotateX(Math.PI * -0.5);
                objGeom.rotateZ(Math.PI * -0.5);
                objGeom.scale(0.15 * finalOptions.scale, 0.15 * finalOptions.scale, 0.15 * finalOptions.scale);
                objGeom.computeVertexNormals();

                const fishBox = new THREE.Box3().setFromBufferAttribute(objGeom.getAttribute("position"));
                const fishObjSize = new THREE.Vector3();
                fishBox.getSize(fishObjSize);

                const baseVector = new THREE.Vector3(finalOptions.pathRadius, 0, 0).multiplyScalar(finalOptions.scale);
                const axis = new THREE.Vector3(0, 1, 0);
                const cPts = [];
                const cSegments = 8;
                const cStep = Math.PI * 2 / cSegments;
                for (let i = 0; i < cSegments; i++) {
                    const randomRadius = baseVector.x + THREE.MathUtils.randFloat(-finalOptions.pathRandomness, finalOptions.pathRandomness) * finalOptions.scale;
                    const point = new THREE.Vector3(randomRadius, 0, 0);
                    cPts.push(point.applyAxisAngle(axis, cStep * i).setY(THREE.MathUtils.randFloat(-finalOptions.yVariance, finalOptions.yVariance) * finalOptions.scale));
                }
                const tiltAngleInRadians = THREE.MathUtils.degToRad(finalOptions.tiltAngle);
                const rotationMatrix = new THREE.Matrix4().makeRotationZ(tiltAngleInRadians);
                cPts.forEach(point => point.applyMatrix4(rotationMatrix));
                fishState.curve = new THREE.CatmullRomCurve3(cPts, true, 'catmullrom', 0.75);

                const pathGeometry = new THREE.BufferGeometry().setFromPoints(fishState.curve.getPoints(200));
                const pathMaterial = new THREE.LineBasicMaterial({ color: 0x00ffff, transparent: false });
                //const pathLine = new THREE.Line(pathGeometry, pathMaterial);
                //scene.add(pathLine);

                const numPoints = 511;
                const tubeGeometry = new THREE.TubeGeometry(fishState.curve, numPoints, 1, 8, true);
                const cObjects = tubeGeometry;
                const cPoints = fishState.curve.getSpacedPoints(numPoints);
                fishState.fishLengthRatio = fishObjSize.z / fishState.curve.getLength();
                const data = [];
                const pushVectorData = (vector) => { data.push(vector.x, vector.y, vector.z, 0); };
                cPoints.forEach(pushVectorData);
                cObjects.binormals.forEach(pushVectorData);
                cObjects.normals.forEach(pushVectorData);
                cObjects.tangents.forEach(pushVectorData);
                const tex = new THREE.DataTexture(new Float32Array(data), numPoints + 1, 4, THREE.RGBAFormat, THREE.FloatType);
                tex.magFilter = THREE.NearestFilter;
                tex.needsUpdate = true;
                
                let spinTypeFloat = 0.0;
                if (finalOptions.clickEffect === 'spin') {
                    if (finalOptions.spinType === 'roll') spinTypeFloat = 1.0;
                    if (finalOptions.spinType === 'pitch') spinTypeFloat = 2.0;
                }

                const uniforms = {
                    uTime: { value: 0 }, uSpeed: { value: 1.0 }, uSpatialTexture: { value: tex },
                    uTextureSize: { value: new THREE.Vector2(numPoints + 1, 4) }, uLengthRatio: { value: fishState.fishLengthRatio },
                    uObjSize: { value: fishObjSize }, uColorHead: { value: finalOptions.colorHead },
                    uColorTail: { value: finalOptions.colorTail }, uSpinAngle: { value: 0.0 },
                    uSpinType: { value: spinTypeFloat },
                };
                
                const solidMat = new THREE.MeshStandardMaterial({
                    metalness: 0.6, roughness: 0.4, color: 0xffffff, side: THREE.DoubleSide,
                });
                
                solidMat.onBeforeCompile = shader => {
                    Object.assign(shader.uniforms, uniforms);
                    
                    shader.vertexShader = `
                        uniform float uTime;
                        uniform float uSpeed;
                        uniform float uLengthRatio;
                        uniform vec3 uObjSize;
                        uniform sampler2D uSpatialTexture;
                        uniform float uSpinAngle;
                        uniform float uSpinType;

                        varying float vSpeed;
                        varying float vPos_z;

                        struct splineData { vec3 point; vec3 binormal; vec3 normal; vec3 tangent; };
                        
                        splineData getSplineData(float t) {
                            t = fract(t);
                            splineData sd;
                            sd.point    = texture2D(uSpatialTexture, vec2(t, 0.125)).rgb;
                            sd.binormal = texture2D(uSpatialTexture, vec2(t, 0.375)).rgb;
                            sd.normal   = texture2D(uSpatialTexture, vec2(t, 0.625)).rgb;
                            sd.tangent  = texture2D(uSpatialTexture, vec2(t, 0.875)).rgb;
                            return sd;
                        }

                        mat3 rotationMatrix(vec3 axis, float angle) {
                            axis = normalize(axis);
                            float s = sin(angle); float c = cos(angle); float oc = 1.0 - c;
                            return mat3(oc * axis.x * axis.x + c,           oc * axis.x * axis.y - axis.z * s,  oc * axis.z * axis.x + axis.y * s,
                                        oc * axis.x * axis.y + axis.z * s,  oc * axis.y * axis.y + c,           oc * axis.y * axis.z - axis.x * s,
                                        oc * axis.z * axis.x - axis.y * s,  oc * axis.y * axis.z + axis.x * s,  oc * axis.z * axis.z + c);
                        }
                    ` + shader.vertexShader;

                    shader.vertexShader = shader.vertexShader.replace(
                        '#include <begin_vertex>',
                        `#include <begin_vertex>
                         vec3 rotatedPosition = position;
                         if (uSpinType > 0.0) {
                             vec3 spinAxis = (uSpinType == 1.0) ? vec3(0.0, 0.0, 1.0) : vec3(1.0, 0.0, 0.0);
                             mat3 spinMat = rotationMatrix(spinAxis, uSpinAngle);
                             rotatedPosition = spinMat * position;
                         }
                         float d = rotatedPosition.z / uObjSize.z;
                         float t = (uTime * 0.1) + (d * uLengthRatio);
                         splineData spline = getSplineData(t);
                         transformed = spline.point + (spline.binormal * rotatedPosition.x) + (spline.normal * rotatedPosition.y);
                         vPos_z = position.z / uObjSize.z + 0.5;
                         vSpeed = uSpeed;`
                    );

                    shader.vertexShader = shader.vertexShader.replace(
                        '#include <beginnormal_vertex>',
                        `#include <beginnormal_vertex>
                         vec3 rotatedNormal = objectNormal;
                         if (uSpinType > 0.0) {
                             vec3 spinAxis = (uSpinType == 1.0) ? vec3(0.0, 0.0, 1.0) : vec3(1.0, 0.0, 0.0);
                             mat3 spinMat = rotationMatrix(spinAxis, uSpinAngle);
                             rotatedNormal = spinMat * objectNormal;
                         }
                         float d_n = position.z / uObjSize.z;
                         float t_n = (uTime * 0.1) + (d_n * uLengthRatio);
                         splineData spline_n = getSplineData(t_n);
                         mat3 rotMat = mat3(spline_n.binormal, spline_n.normal, spline_n.tangent);
                         objectNormal = normalize(rotMat * rotatedNormal);`
                    );
                    
                    shader.fragmentShader = `
                        uniform float uSpeed;
                        uniform vec3 uColorHead;
                        uniform vec3 uColorTail;
                        varying float vSpeed;
                        varying float vPos_z;
                    ` + shader.fragmentShader;
                    shader.fragmentShader = shader.fragmentShader.replace(
                        '#include <color_fragment>',
                        `#include <color_fragment>
                            vec3 gradientColor = mix(uColorTail, uColorHead, vPos_z);
                            vec3 highSpeedColor = vec3(1.0, 1.0, 0.0);
                            diffuseColor.rgb *= gradientColor;
                            float mixFactor = smoothstep(1.0, 5.0, uSpeed);
                            diffuseColor.rgb = mix(diffuseColor.rgb, highSpeedColor, mixFactor);`
                    );
                };
                
                fishState.solidFish = new THREE.Mesh(objGeom, solidMat);
                scene.add(fishState.solidFish);

                const hitSphereRadius = fishObjSize.length() * 0.5;
                const hitSphereGeom = new THREE.SphereGeometry(hitSphereRadius, 16, 8);
                const hitSphereMat = new THREE.MeshBasicMaterial({ wireframe: true, visible: false });
                fishState.hitSphere = new THREE.Mesh(hitSphereGeom, hitSphereMat);
                scene.add(fishState.hitSphere);

                const raycaster = new THREE.Raycaster();
                const mouse = new THREE.Vector2();

                function onMouseDown(event) {
                    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
                    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
                    raycaster.setFromCamera(mouse, camera);
                    if (fishState.hitSphere) {
                        const intersects = raycaster.intersectObject(fishState.hitSphere);
                        if (intersects.length > 0) {
                            if (finalOptions.clickEffect === 'spin' && !fishState.spinState.active) {
                                fishState.spinState.active = true;
                                fishState.spinState.speed = 25.0;
                            } else if (finalOptions.clickEffect === 'speedBoost') {
                                fishState.speedMultiplier = 10.0;
                            }
                        }
                    }
                }
                window.addEventListener('mousedown', onMouseDown);
                
                let trailParticlesData = [], currentTrailParticleIndex = 0;
                const TRAIL_PARTICLE_COUNT = 500;
                const trailGeometry = new THREE.BufferGeometry();
                const trailPositions = new Float32Array(TRAIL_PARTICLE_COUNT * 3);
                const trailAlphas = new Float32Array(TRAIL_PARTICLE_COUNT);
                for (let i = 0; i < TRAIL_PARTICLE_COUNT; i++) {
                    trailParticlesData.push({ lifetime: 0, initialLifetime: 1 });
                    trailAlphas[i] = 0;
                }
                trailGeometry.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3));
                trailGeometry.setAttribute('alpha', new THREE.BufferAttribute(trailAlphas, 1));
                const trailMaterial = new THREE.PointsMaterial({
                    color: 0xffff88, size: 0.3 * finalOptions.scale, transparent: true,
                    blending: THREE.AdditiveBlending, depthWrite: false
                });
                trailMaterial.onBeforeCompile = (shader) => {
                     shader.vertexShader = 'attribute float alpha;\nvarying float vAlpha;\n' + shader.vertexShader;
                     shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvAlpha = alpha;');
                     shader.fragmentShader = 'varying float vAlpha;\n' + shader.fragmentShader;
                     shader.fragmentShader = shader.fragmentShader.replace('vec4 diffuseColor = vec4( diffuse, opacity );', 'vec4 diffuseColor = vec4( diffuse, vAlpha * opacity );');
                };
                fishState.trail = new THREE.Points(trailGeometry, trailMaterial);
                scene.add(fishState.trail);

                const animateFish = (delta) => {
                    if (fishState.speedMultiplier > 1.0) {
                        fishState.speedMultiplier = THREE.MathUtils.lerp(fishState.speedMultiplier, 1.0, 0.05);
                    }
                    if (fishState.spinState.active) {
                        fishState.spinState.speed = THREE.MathUtils.lerp(fishState.spinState.speed, 0, 0.04);
                        fishState.spinState.angle += fishState.spinState.speed * delta * finalOptions.spinDirection;
                        if (fishState.spinState.speed < 0.1) {
                            fishState.spinState.active = false;
                            fishState.spinState.speed = 0;
                        }
                    }
                    const speedFactor = 0.5;
                    fishState.customTime += delta * speedFactor * fishState.speedMultiplier;
                    uniforms.uTime.value = fishState.customTime;
                    uniforms.uSpeed.value = fishState.speedMultiplier;
                    uniforms.uSpinAngle.value = fishState.spinState.angle;
                    const t = (fishState.customTime * 0.1) % 1.0;
                    const position = fishState.curve.getPointAt(t);
                    fishState.hitSphere.position.copy(position);

                    for (let i = 0; i < TRAIL_PARTICLE_COUNT; i++) {
                        const data = trailParticlesData[i];
                        if (data.lifetime > 0) {
                            data.lifetime -= delta;
                            trailAlphas[i] = data.lifetime / data.initialLifetime;
                        } else {
                            trailAlphas[i] = 0;
                        }
                    }
                    const tail_t = ((fishState.customTime * 0.1) + (-0.5 * fishState.fishLengthRatio) + 1.0) % 1.0;
                    const tailPosition = fishState.curve.getPointAt(tail_t);
                    for (let i = 0; i < 3; i++) {
                        const pIndex = currentTrailParticleIndex;
                        trailParticlesData[pIndex].lifetime = THREE.MathUtils.randFloat(1.0, 2.5);
                        trailParticlesData[pIndex].initialLifetime = trailParticlesData[pIndex].lifetime;
                        const spread = 0.2 * finalOptions.scale;
                        trailPositions[pIndex * 3 + 0] = tailPosition.x + THREE.MathUtils.randFloatSpread(spread);
                        trailPositions[pIndex * 3 + 1] = tailPosition.y + THREE.MathUtils.randFloatSpread(spread);
                        trailPositions[pIndex * 3 + 2] = tailPosition.z + THREE.MathUtils.randFloatSpread(spread);
                        currentTrailParticleIndex = (currentTrailParticleIndex + 1) % TRAIL_PARTICLE_COUNT;
                    }
                    fishState.trail.geometry.attributes.position.needsUpdate = true;
                    fishState.trail.geometry.attributes.alpha.needsUpdate = true;
                };
                resolve(animateFish);
            },
            undefined, 
            (error) => { reject(error); }
        );
    });
}