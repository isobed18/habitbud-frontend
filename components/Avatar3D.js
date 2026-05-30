// Avatar3D — interactive (drag-to-rotate) GLB viewer on react-three-fiber +
// expo-gl. Isolated/optional: if 3D fails, the 2D <Avatar/> still works.
//
// Perf: GLBs are cached to disk (expo-file-system) so they download once.
// Lighting fix: Hunyuan GLBs are metallic=1 with no normals -> dark. We force
// matte (metalness=0) + recompute normals so the plush colors read brightly.

import React, { Suspense, useRef, useState, useMemo, useEffect } from 'react';
import { View, ActivityIndicator, Text, StyleSheet, PanResponder } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { getImageUrl } from '../services/axiosInstance';

let Canvas, useFrame, useGLTF;
try {
  ({ Canvas, useFrame } = require('@react-three/fiber/native'));
  ({ useGLTF } = require('@react-three/drei/native'));
} catch (_) { /* 3D libs unavailable */ }

// Download a remote GLB to the cache dir once; return a local file:// uri.
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
      } catch (_) {
        if (alive) setUri(abs); // fall back to streaming
      }
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
  useFrame(() => {
    if (!ref.current) return;
    // Follow the user's drag (no constant auto-spin).
    ref.current.rotation.y = rot.current.y;
    ref.current.rotation.x = rot.current.x;
  });
  return <primitive ref={ref} object={scene} scale={scale} />;
}

export default function Avatar3D({ url, scale = 0.04, style, height = 220 }) {
  const [failed, setFailed] = useState(false);
  const localUri = useCachedGlb(url);
  const rot = useRef({ y: 0, x: 0 });

  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderMove: (_e, g) => {
      rot.current.y += g.dx * 0.01;
      // clamp vertical tilt so it can't flip upside down
      rot.current.x = Math.max(-0.6, Math.min(0.6, rot.current.x + g.dy * 0.005));
    },
  }), []);

  if (!url || !Canvas || !useGLTF) {
    return (
      <View style={[styles.fallback, { height }, style]}>
        <Text style={styles.fallbackText}>3B önizleme kullanılamıyor</Text>
      </View>
    );
  }
  if (failed) {
    return (
      <View style={[styles.fallback, { height }, style]}>
        <Text style={styles.fallbackText}>Model yüklenemedi</Text>
      </View>
    );
  }
  if (!localUri) {
    return (
      <View style={[styles.fallback, { height }, style]}>
        <ActivityIndicator color="#8b5cf6" />
      </View>
    );
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
