// Avatar3D — renders a rotating GLB model with react-three-fiber on expo-gl.
// Isolated/optional: if 3D fails on a device, the 2D <Avatar/> still works.
//
// IMPORTANT lighting fix: Hunyuan3D GLBs export materials as metallic=1 with no
// vertex normals. In a PBR renderer with no environment map that renders dark.
// We force the materials to matte (metalness=0) — correct for plush toys — and
// recompute normals so simple lights shade them brightly.

import React, { Suspense, useRef, useState, useMemo } from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { getImageUrl } from '../services/axiosInstance';

let Canvas, useFrame, useGLTF;
try {
  ({ Canvas, useFrame } = require('@react-three/fiber/native'));
  ({ useGLTF } = require('@react-three/drei/native'));
} catch (_) { /* 3D libs unavailable */ }

// Make a loaded scene look like a bright matte plush toy.
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
      if ('metalness' in m) m.metalness = 0;       // kill the dark metallic look
      if ('roughness' in m) m.roughness = 0.85;    // soft matte
      if ('envMapIntensity' in m) m.envMapIntensity = 1.0;
      m.needsUpdate = true;
    });
  });
  return scene;
}

function ItemModel({ url, scale }) {
  const gltf = useGLTF(getImageUrl(url));
  const scene = useMemo(() => plushify(gltf.scene), [gltf.scene]);
  return <primitive object={scene} scale={scale} />;
}

function Model({ url, scale, equippedItems = [] }) {
  const gltf = useGLTF(getImageUrl(url));
  const scene = useMemo(() => plushify(gltf.scene), [gltf.scene]);
  const ref = useRef();
  useFrame((_, delta) => { if (ref.current) ref.current.rotation.y += delta * 0.6; });
  return (
    <group ref={ref}>
      <primitive object={scene} scale={scale} />
      {equippedItems.map((item, index) => {
        const itemUrl = typeof item === 'string' ? item : (item?.glb || item?.glb_url || item?.model_url);
        if (!itemUrl) return null;
        return (
          <Suspense key={`${itemUrl}-${index}`} fallback={null}>
            <ItemModel url={itemUrl} scale={scale} />
          </Suspense>
        );
      })}
    </group>
  );
}

export default function Avatar3D({ url, scale = 0.04, equippedItems = [], style, height = 220 }) {
  const [failed, setFailed] = useState(false);

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

  return (
    <View style={[{ height }, style]}>
      <Canvas camera={{ position: [0, 1.2, 4.2], fov: 50 }}>
        {/* Bright, even lighting so matte models read their true colors. */}
        <ambientLight intensity={1.1} />
        <hemisphereLight args={['#ffffff', '#b0b0b0', 1.1]} />
        <directionalLight position={[3, 5, 4]} intensity={1.4} />
        <directionalLight position={[-4, 2, -3]} intensity={0.7} />
        <directionalLight position={[0, -3, 2]} intensity={0.4} />
        <Suspense fallback={null}>
          <ErrorGuard onError={() => setFailed(true)}>
            <Model url={url} scale={scale} equippedItems={equippedItems} />
          </ErrorGuard>
        </Suspense>
      </Canvas>
    </View>
  );
}

// Minimal error boundary so a bad model doesn't crash the whole tree.
class ErrorGuard extends React.Component {
  componentDidCatch() { this.props.onError?.(); }
  render() { return this.props.children; }
}

const styles = StyleSheet.create({
  fallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#eef2ff', borderRadius: 16 },
  fallbackText: { color: '#94a3b8', fontWeight: '600' },
});
