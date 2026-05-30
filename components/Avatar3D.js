// Avatar3D — smooth, inertial drag-to-rotate GLB viewer (react-three-fiber +
// expo-gl). Isolated/optional: if 3D fails, the 2D <Avatar/> still works.
//
// Perf: GLBs cached to disk (download once). Lighting: Hunyuan GLBs are
// metallic=1 with no normals -> dark; forced matte + recomputed normals here.

import React, { Suspense, useRef, useState, useMemo, useEffect } from 'react';
import { View, ActivityIndicator, Text, StyleSheet, PanResponder } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { getImageUrl } from '../services/axiosInstance';

let Canvas, useFrame, useGLTF;
try {
  ({ Canvas, useFrame } = require('@react-three/fiber/native'));
  ({ useGLTF } = require('@react-three/drei/native'));
} catch (_) { /* 3D libs unavailable */ }

function useCachedGlb(remoteUrl) {
  const [uri, setUri] = useState(null);
  useEffect(() => {
    let alive = true;
    const abs = getImageUrl(remoteUrl);
    if (!abs) { setUri(null); return; }
    if (abs.startsWith('file://') || !FileSystem.cacheDirectory) { setUri(abs); return; }
    const safe = abs.split('?')[0].split('/').pop() || 'model.glb';
    const local = FileSystem.cacheDirectory + 'glb_' + safe;
    (async () => {
      try {
        const info = await FileSystem.getInfoAsync(local);
        if (info.exists && info.size > 0) { if (alive) setUri(local); return; }
        const res = await FileSystem.downloadAsync(abs, local);
        if (alive) setUri(res.uri || abs);
      } catch (_) { if (alive) setUri(abs); }
    })();
    return () => { alive = false; };
  }, [remoteUrl]);
  return uri;
}

function plushify(scene) {
  if (!scene) return scene;
  scene.traverse((child) => {
    if (!child.isMesh) return;
    if (child.geometry && !child.geometry.attributes.normal) {
      try { child.geometry.computeVertexNormals(); } catch (_) {}
    }
    const mats = Array.isArray(child.material) ? child.material : [child.material];
    mats.forEach((m) => {
      if (!m) return;
      if ('metalness' in m) m.metalness = 0;
      if ('roughness' in m) m.roughness = 0.85;
      m.needsUpdate = true;
    });
  });
  return scene;
}

function Model({ localUri, scale, rot }) {
  const gltf = useGLTF(localUri);
  const scene = useMemo(() => plushify(gltf.scene), [gltf.scene]);
  const ref = useRef();
  const cur = useRef({ y: 0, x: 0 });
  useFrame(() => {
    if (!ref.current) return;
    const r = rot.current;
    // Momentum when not actively dragging.
    if (!r.dragging) {
      r.y += r.vy;
      r.vy *= 0.94;
      if (Math.abs(r.vy) < 0.0004) r.vy = 0;
    }
    // Smoothly ease the rendered rotation toward the target.
    cur.current.y += (r.y - cur.current.y) * 0.18;
    cur.current.x += (r.x - cur.current.x) * 0.18;
    ref.current.rotation.y = cur.current.y;
    ref.current.rotation.x = cur.current.x;
  });
  return <primitive ref={ref} object={scene} scale={scale} />;
}

export default function Avatar3D({ url, scale = 0.04, style, height = 220 }) {
  const [failed, setFailed] = useState(false);
  const localUri = useCachedGlb(url);
  // y/x = target rotation, vy = inertia, lastDx = per-move delta tracker.
  const rot = useRef({ y: 0, x: 0, vy: 0, lastDx: 0, dragging: false });

  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => { rot.current.dragging = true; rot.current.vy = 0; rot.current.lastDx = 0; },
    onPanResponderMove: (_e, g) => {
      const dy = g.dx - rot.current.lastDx;     // per-move horizontal delta
      rot.current.lastDx = g.dx;
      rot.current.y += dy * 0.007;               // lower sensitivity = calmer
      rot.current.x = Math.max(-0.5, Math.min(0.5, rot.current.x + (g.vy || 0) * 0.02));
    },
    onPanResponderRelease: (_e, g) => {
      rot.current.dragging = false;
      rot.current.vy = Math.max(-0.25, Math.min(0.25, (g.vx || 0) * 0.12)); // fling inertia
    },
    onPanResponderTerminate: () => { rot.current.dragging = false; },
  }), []);

  if (!url || !Canvas || !useGLTF) {
    return <View style={[styles.fallback, { height }, style]}><Text style={styles.fallbackText}>3B kullanılamıyor</Text></View>;
  }
  if (failed) {
    return <View style={[styles.fallback, { height }, style]}><Text style={styles.fallbackText}>Model yüklenemedi</Text></View>;
  }
  if (!localUri) {
    return <View style={[styles.fallback, { height }, style]}><ActivityIndicator color="#8b5cf6" /></View>;
  }

  return (
    <View style={[{ height }, style]} {...pan.panHandlers}>
      <Canvas camera={{ position: [0, 1.2, 4.2], fov: 50 }}>
        <ambientLight intensity={1.1} />
        <hemisphereLight args={['#ffffff', '#b0b0b0', 1.1]} />
        <directionalLight position={[3, 5, 4]} intensity={1.4} />
        <directionalLight position={[-4, 2, -3]} intensity={0.7} />
        <directionalLight position={[0, -3, 2]} intensity={0.4} />
        <Suspense fallback={null}>
          <ErrorGuard onError={() => setFailed(true)}>
            <Model localUri={localUri} scale={scale} rot={rot} />
          </ErrorGuard>
        </Suspense>
      </Canvas>
    </View>
  );
}

class ErrorGuard extends React.Component {
  componentDidCatch() { this.props.onError?.(); }
  render() { return this.props.children; }
}

const styles = StyleSheet.create({
  fallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#eef2ff', borderRadius: 16 },
  fallbackText: { color: '#94a3b8', fontWeight: '600' },
});
