import React, { useRef, useMemo, useEffect } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

const vertexShader = `
varying vec2 vUv;
uniform float time;
uniform vec4 resolution;

void main() {
    vUv = uv;
    gl_Position = vec4(position, 1.0);
}
`

const fragmentShader = `
precision highp float;
varying vec2 vUv;
uniform float time;
uniform vec4 resolution;
uniform int rectCount;
uniform vec4 rects[16]; // x, y, w, h in normalized viewport coords (origin bottom-left)

float PI = 3.141592653589793238;

mat4 rotationMatrix(vec3 axis, float angle) {
    axis = normalize(axis);
    float s = sin(angle);
    float c = cos(angle);
    float oc = 1.0 - c;
    return mat4(oc * axis.x * axis.x + c,           oc * axis.x * axis.y - axis.z * s,  oc * axis.z * axis.x + axis.y * s,  0.0,
                oc * axis.x * axis.y + axis.z * s,  oc * axis.y * axis.y + c,           oc * axis.y * axis.z - axis.x * s,  0.0,
                oc * axis.z * axis.x - axis.y * s,  oc * axis.y * axis.z + axis.x * s,  oc * axis.z * axis.z + c,           0.0,
                0.0,                                0.0,                                0.0,                                1.0);
}

vec3 rotate(vec3 v, vec3 axis, float angle) {
    mat4 m = rotationMatrix(axis, angle);
    return (m * vec4(v, 1.0)).xyz;
}

float smin( float a, float b, float k ) {
    k *= 6.0;
    float h = max( k-abs(a-b), 0.0 )/k;
    return min(a,b) - h*h*h*k*(1.0/6.0);
}

float sphereSDF(vec3 p, float r) {
    return length(p) - r;
}

float sdf(vec3 p) {
    vec3 p1 = rotate(p, vec3(0.0, 0.0, 1.0), time/5.0);
    vec3 p2 = rotate(p, vec3(1.), -time/5.0);
    vec3 p3 = rotate(p, vec3(1., 1., 0.), -time/4.5);
    vec3 p4 = rotate(p, vec3(0., 1., 0.), -time/4.0);
    
    float final = sphereSDF(p1 - vec3(-0.5, 0.0, 0.0), 0.22);
    float nextSphere = sphereSDF(p2 - vec3(0.55, 0.0, 0.0), 0.18);
    final = smin(final, nextSphere, 0.1);
    nextSphere = sphereSDF(p2 - vec3(-0.8, 0.0, 0.0), 0.12);
    final = smin(final, nextSphere, 0.1);
    nextSphere = sphereSDF(p3 - vec3(1.0, 0.0, 0.0), 0.10);
    final = smin(final, nextSphere, 0.1);
    nextSphere = sphereSDF(p4 - vec3(0.45, -0.45, 0.0), 0.10);
    final = smin(final, nextSphere, 0.1);
    
    return final;
}

vec3 getNormal(vec3 p) {
    float d = 0.001;
    return normalize(vec3(
        sdf(p + vec3(d, 0.0, 0.0)) - sdf(p - vec3(d, 0.0, 0.0)),
        sdf(p + vec3(0.0, d, 0.0)) - sdf(p - vec3(0.0, d, 0.0)),
        sdf(p + vec3(0.0, 0.0, d)) - sdf(p - vec3(0.0, 0.0, d))
    ));
}

float rayMarch(vec3 rayOrigin, vec3 ray) {
    float t = 0.0;
    for (int i = 0; i < 100; i++) {
        vec3 p = rayOrigin + ray * t;
        float d = sdf(p);
        if (d < 0.001) return t;
        t += d;
        if (t > 100.0) break;
    }
    return -1.0;
}

void main() {
    vec2 newUV = (vUv - vec2(0.5)) * resolution.zw + vec2(0.5);
    vec3 cameraPos = vec3(0.0, 0.0, 5.0);
    vec3 ray = normalize(vec3((vUv - vec2(0.5)) * resolution.zw, -1));
    vec3 color = vec3(1.0);
    
    bool inText = false;
    for (int i = 0; i < 16; i++) {
        if (i >= rectCount) break;
        vec4 r = rects[i];
        if (vUv.x > r.x && vUv.x < (r.x + r.z) && vUv.y > r.y && vUv.y < (r.y + r.w)) {
            inText = true;
        }
    }
    
    float t = rayMarch(cameraPos, ray);
    if (t > 0.0) {
        vec3 p = cameraPos + ray * t;
        vec3 normal = getNormal(p);
        float fresnel = pow(1.0 + dot(ray, normal), 3.0);
        color = vec3(fresnel);
        if (inText) {
            color = mix(color, vec3(1.0), 0.85);
        }
        // приглушить яркость и не перекрывать нижний UI
        float uiMask = smoothstep(0.60, 0.64, vUv.y);
        vec3 outCol = mix(vec3(1.0), color, 0.6) * uiMask + (1.0 - uiMask);
        gl_FragColor = vec4(outCol, 1.0);
    } else {
        gl_FragColor = vec4(1.0);
    }
}
`

// Secondary shader that reuses the same 3D SDF and raymarch as фон, но выводит только белую маску внутри сфер
const maskFrag = `
precision highp float;
varying vec2 vUv;
uniform float time;
uniform vec4 resolution;

mat4 rotationMatrix(vec3 axis, float angle) {
    axis = normalize(axis);
    float s = sin(angle);
    float c = cos(angle);
    float oc = 1.0 - c;
    return mat4(oc * axis.x * axis.x + c,           oc * axis.x * axis.y - axis.z * s,  oc * axis.z * axis.x + axis.y * s,  0.0,
                oc * axis.x * axis.y + axis.z * s,  oc * axis.y * axis.y + c,           oc * axis.y * axis.z - axis.x * s,  0.0,
                oc * axis.z * axis.x - axis.y * s,  oc * axis.y * axis.z + axis.x * s,  oc * axis.z * axis.z + c,           0.0,
                0.0,                                0.0,                                0.0,                                1.0);
}
vec3 rotate(vec3 v, vec3 axis, float angle){ mat4 m = rotationMatrix(axis, angle); return (m * vec4(v,1.0)).xyz; }
float smin( float a, float b, float k ) { k *= 6.0; float h = max( k-abs(a-b), 0.0 )/k; return min(a,b) - h*h*h*k*(1.0/6.0); }
float sphereSDF(vec3 p, float r){ return length(p) - r; }

float sdf(vec3 p) {
  vec3 p1 = rotate(p, vec3(0.0, 0.0, 1.0), time/5.0);
  vec3 p2 = rotate(p, vec3(1.), -time/5.0);
  vec3 p3 = rotate(p, vec3(1., 1., 0.), -time/4.5);
  vec3 p4 = rotate(p, vec3(0., 1., 0.), -time/4.0);
  float d = sphereSDF(p1 - vec3(-0.5, 0.0, 0.0), 0.35);
  d = smin(d, sphereSDF(p2 - vec3(0.55, 0.0, 0.0), 0.3), 0.1);
  d = smin(d, sphereSDF(p2 - vec3(-0.8, 0.0, 0.0), 0.2), 0.1);
  d = smin(d, sphereSDF(p3 - vec3(1.0, 0.0, 0.0), 0.15), 0.1);
  d = smin(d, sphereSDF(p4 - vec3(0.45, -0.45, 0.0), 0.15), 0.1);
  return d;
}
float rayMarch(vec3 ro, vec3 rd){ float t=0.0; for(int i=0;i<100;i++){ vec3 p=ro+rd*t; float d=sdf(p); if(d<0.001) return t; t+=d; if(t>100.0) break;} return -1.0; }

void main(){
  vec3 ro = vec3(0.0,0.0,5.0);
  vec3 rd = normalize(vec3((vUv-vec2(0.5))*resolution.zw, -1.0));
  float t = rayMarch(ro, rd);
  float inside = t>0.0 ? 1.0 : 0.0;
  gl_FragColor = vec4(vec3(inside), inside);
}
`

const MAX_RECTS = 16

function LavaLampShader(): JSX.Element {
  const meshRef = useRef<THREE.Mesh | null>(null)
  const { size } = useThree()

  const uniforms = useMemo(() => ({
    time: { value: 0 },
    resolution: { value: new THREE.Vector4() },
    rectCount: { value: 0 },
    rects: { value: Array.from({ length: MAX_RECTS }, () => new THREE.Vector4(0, 0, 0, 0)) }
  }), []) as { time: { value: number }; resolution: { value: THREE.Vector4 }; rectCount: { value: number }; rects: { value: THREE.Vector4[] } }

  // Update resolution when size changes
  useEffect(() => {
    const { width, height } = size
    const imageAspect = 1
    let a1: number, a2: number
    
    if (height / width > imageAspect) {
      a1 = (width / height) * imageAspect
      a2 = 1
    } else {
      a1 = 1
      a2 = (height / width) / imageAspect
    }
    uniforms.resolution.value.set(width, height, a1, a2)
  }, [size, uniforms])

  useFrame((state) => {
    if (meshRef.current) {
      uniforms.time.value = state.clock.elapsedTime
    }
  })

  // Collect rectangles of user messages to pass to shader (react only to foreground messages)
  useEffect(() => {
    const computeRects = () => {
      const nodes = Array.from(document.querySelectorAll('[data-user-msg="true"], .user-message')) as HTMLElement[]
      const vw = window.innerWidth
      const vh = window.innerHeight
      const list: THREE.Vector4[] = []
      for (let i = 0; i < nodes.length && list.length < MAX_RECTS; i++) {
        const r = nodes[i].getBoundingClientRect()
        const x = Math.max(0, r.left) / vw
        // convert DOM top-left to bottom-left origin for shader
        const y = Math.max(0, (vh - (r.top + r.height)) / vh)
        const w = Math.min(vw, Math.max(0, r.width)) / vw
        const h = Math.min(vh, Math.max(0, r.height)) / vh
        list.push(new THREE.Vector4(x, y, w, h))
      }
      uniforms.rectCount.value = list.length
      for (let i = 0; i < MAX_RECTS; i++) {
        const v = uniforms.rects.value[i]
        v.set(0, 0, 0, 0)
      }
      for (let i = 0; i < list.length; i++) {
        uniforms.rects.value[i].copy(list[i])
      }
    }

    computeRects()
    const ro = new ResizeObserver(() => computeRects())
    ro.observe(document.documentElement)
    const mo = new MutationObserver(() => computeRects())
    mo.observe(document.body, { childList: true, subtree: true, attributes: true })
    window.addEventListener('resize', computeRects)
    return () => {
      ro.disconnect()
      mo.disconnect()
      window.removeEventListener('resize', computeRects)
    }
  }, [uniforms])

  return (
    <mesh ref={meshRef as any}>
      <planeGeometry args={[5, 5]} />
      {/* @ts-expect-error three-stdlib shader material props */}
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
      />
    </mesh>
  )
}

function MaskShader(): JSX.Element {
  const meshRef = useRef<THREE.Mesh | null>(null)
  const { size } = useThree()
  const uniforms = useMemo(() => ({
    time: { value: 0 },
    resolution: { value: new THREE.Vector4() }
  }), []) as { time: { value: number }; resolution: { value: THREE.Vector4 } }

  useEffect(() => {
    const { width, height } = size
    uniforms.resolution.value.set(width, height, 1, 1)
  }, [size, uniforms])

  useFrame((state) => {
    if (meshRef.current) uniforms.time.value = state.clock.elapsedTime
  })

  return (
    <mesh ref={meshRef as any}>
      <planeGeometry args={[5, 5]} />
      {/* @ts-expect-error three-stdlib shader material props */}
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={vertexShader}
        fragmentShader={maskFrag}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        transparent
      />
    </mesh>
  )
}

export const LavaLamp = ({ onReady }: { onReady?: () => void } = {}): JSX.Element => {
  return (
    <div style={{ width: '100%', height: '100%', background: '#000', position: 'absolute', inset: 0 as any }}>
      {/* Visual background */}
      <Canvas
        camera={{
          left: -0.5,
          right: 0.5,
          top: 0.5,
          bottom: -0.5,
          near: -1000,
          far: 1000,
          position: [0, 0, 2]
        }}
        orthographic
        gl={{ antialias: true }}
        onCreated={({ gl }) => {
          // Сигнализируем после первого кадра, чтобы фон появился до текста
          requestAnimationFrame(() => {
            onReady && onReady()
          })
        }}
      >
        <LavaLampShader />
      </Canvas>
      {/* White mask for text inversion (difference) */}
      <Canvas
        style={{ position: 'absolute', inset: 0 as any, pointerEvents: 'none' }}
        camera={{
          left: -0.5,
          right: 0.5,
          top: 0.5,
          bottom: -0.5,
          near: -1000,
          far: 1000,
          position: [0, 0, 2]
        }}
        orthographic
        gl={{ antialias: true }}
      >
        <MaskShader />
      </Canvas>
    </div>
  )
}


