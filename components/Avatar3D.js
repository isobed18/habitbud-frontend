// Avatar3D — renders a rotating GLB model with react-three-fiber on top of
// expo-gl. Isolated and optional: if 3D fails on a device, the rest of the app
// (2D <Avatar/>) is unaffected. Pass a remote `url` to a .glb file.
//
// Generated character/item GLBs (e.g. from Hunyuan3D on the 3090) can be served
// from the backend `media/` and their URL stored in avatar_config / Item.model_url.

import React, { Suspense, useRef, useState } from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { getImageUrl } from '../services/axiosInstance';

let Canvas, useFrame, useGLTF;
try {
  ({ Canvas, useFrame } = require('@react-three/fiber/native'));
  ({ useGLTF } = require('@react-three/drei/native'));
} catch (_) { /* 3D libs unavailable */ }

function ItemModel({ url, scale }) {
  const absoluteUrl = getImageUrl(url);
  const gltf = useGLTF(absoluteUrl);
  return <primitive object={gltf.scene} scale={scale} />;
}

function Model({ url, scale, equippedItems = [] }) {
  const absoluteUrl = getImageUrl(url);
  const gltf = useGLTF(absoluteUrl);
  const ref = useRef();
  useFrame((_, delta) => { if (ref.current) ref.current.rotation.y += delta * 0.6; });
  return (
    <group ref={ref}>
      <primitive object={gltf.scene} scale={scale} />
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
      <Canvas camera={{ position: [0, 1.2, 4.2], fov: 50 }} onCreated={() => {}}>
        <ambientLight intensity={0.9} />
        <directionalLight position={[3, 5, 2]} intensity={1.1} />
        <directionalLight position={[-3, 2, -2]} intensity={0.5} />
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
