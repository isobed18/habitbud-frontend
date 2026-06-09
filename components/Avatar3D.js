// Avatar3D — smooth inertial drag-to-rotate GLB viewer (r3f + expo-gl) with
// approximate anchor-based item attachment (non-rigged MVP). Isolated/optional.
//
// Perf: GLBs cached to disk. Lighting: Hunyuan GLBs are metallic=1 w/o normals
// -> dark; forced matte + recomputed normals.

import React, { Suspense, useRef, useState, useMemo, useEffect } from 'react';
import { View, ActivityIndicator, Text, StyleSheet, PanResponder } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { getImageUrl } from '../services/axiosInstance';

let Canvas, useFrame, useGLTF, THREE;
try {
  ({ Canvas, useFrame } = require('@react-three/fiber/native'));
  ({ useGLTF } = require('@react-three/drei/native'));
  THREE = require('three');
} catch (_) { /* 3D libs unavailable */ }

// Fallback attach points in the avatar's local space (model ~2 units tall),
// used only when the avatar GLB has no matching socket Empty.
const ANCHOR = {
  head: [0, 1.05, 0.15],
  face: [0, 0.68, 0.6],
  hand: [0.7, 0.05, 0.4],
  back: [0, 0.45, -0.55],
  neck: [0, 0.5, 0.4],
  none: [0, 0, 0],
};

// anchor -> socket Empty name baked into the avatar GLB by the rig tooling.
const ANCHOR_TO_SOCKET = { hand: 'socket_r', head: 'socket_head', face: 'socket_head', neck: 'socket_head', back: 'socket_back' };

// Read socket Empties' positions from the avatar scene, in avatar-local space
// (independent of the render scale). Returns { socket_r: [x,y,z], ... }.
function readSockets(scene) {
  const out = {};
  if (!scene || !THREE) return out;
  scene.updateMatrixWorld(true);
  ['socket_r', 'socket_l', 'socket_head', 'socket_back'].forEach((name) => {
    const node = scene.getObjectByName(name);
    if (!node) return;
    const p = new THREE.Vector3();
    node.getWorldPosition(p);
    scene.worldToLocal(p);            // -> avatar-local coords
    out[name] = [p.x, p.y, p.z];
  });
  return out;
}

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

// One equipped item GLB, positioned at its socket (preferred) or anchor fallback.
function ItemGLTF({ localUri, anchor, scale, baseScale, sockets }) {
  const gltf = useGLTF(localUri);
  const scene = useMemo(() => plushify(gltf.scene.clone()), [gltf.scene]);
  const socketName = ANCHOR_TO_SOCKET[anchor];
  const socketPos = socketName && sockets ? sockets[socketName] : null;
  // Socket coords are avatar-local -> convert to the group's render space (×baseScale).
  const pos = socketPos
    ? [socketPos[0] * baseScale, socketPos[1] * baseScale, socketPos[2] * baseScale]
    : (ANCHOR[anchor] || ANCHOR.none);
  return <primitive object={scene} position={pos} scale={scale} />;
}

function ItemMesh({ item, baseScale, sockets }) {
  const local = useCachedGlb(item.url);
  if (!local) return null;
  return (
    <ItemGLTF
      localUri={local}
      anchor={item.anchor}
      sockets={sockets}
      baseScale={baseScale}
      scale={(item.scale || 0.4) * baseScale}
    />
  );
}

function Model({ localUri, scale, rot, equippedItems }) {
  const gltf = useGLTF(localUri);
  const scene = useMemo(() => plushify(gltf.scene), [gltf.scene]);
  const sockets = useMemo(() => readSockets(scene), [scene]);
  const mixer = useMemo(() => {
    if (!THREE || !gltf.animations?.length) return null;
    return new THREE.AnimationMixer(scene);
  }, [gltf.animations, scene]);
  const ref = useRef();
  const cur = useRef({ y: 0, x: 0 });
  useEffect(() => {
    if (!mixer || !gltf.animations?.length) return undefined;
    gltf.animations.forEach((clip) => mixer.clipAction(clip).play());
    return () => mixer.stopAllAction();
  }, [gltf.animations, mixer]);
  useFrame(({ clock }, delta) => {
    if (!ref.current) return;
    if (mixer) mixer.update(delta);
    const r = rot.current;
    if (!r.dragging) { r.y += r.vy; r.vy *= 0.94; if (Math.abs(r.vy) < 0.0004) r.vy = 0; }
    cur.current.y += (r.y - cur.current.y) * 0.18;
    cur.current.x += (r.x - cur.current.x) * 0.18;
    const t = clock.getElapsedTime();
    const idleBreath = 1 + Math.sin(t * 2.1) * 0.018;
    const idleBounce = Math.sin(t * 2.4) * 0.025;
    const idleTilt = Math.sin(t * 1.35) * 0.045;
    ref.current.rotation.y = cur.current.y + idleTilt;
    ref.current.rotation.x = cur.current.x + Math.sin(t * 1.6) * 0.018;
    ref.current.position.y = idleBounce;
    ref.current.scale.setScalar(idleBreath);
  });
  return (
    <group ref={ref}>
      <primitive object={scene} scale={scale} />
      {(equippedItems || []).map((it, i) => (
        <Suspense key={`${it.url}-${i}`} fallback={null}>
          <ItemMesh item={it} baseScale={scale} sockets={sockets} />
        </Suspense>
      ))}
    </group>
  );
}

export default function Avatar3D({ url, scale = 0.04, equippedItems = [], style, height = 220 }) {
  const [failed, setFailed] = useState(false);
  const localUri = useCachedGlb(url);
  const rot = useRef({ y: 0, x: 0, vy: 0, lastDx: 0, dragging: false });

  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => { rot.current.dragging = true; rot.current.vy = 0; rot.current.lastDx = 0; },
    onPanResponderMove: (_e, g) => {
      const dy = g.dx - rot.current.lastDx;
      rot.current.lastDx = g.dx;
      rot.current.y += dy * 0.007;
      rot.current.x = Math.max(-0.5, Math.min(0.5, rot.current.x + (g.vy || 0) * 0.02));
    },
    onPanResponderRelease: (_e, g) => {
      rot.current.dragging = false;
      rot.current.vy = Math.max(-0.25, Math.min(0.25, (g.vx || 0) * 0.12));
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
            <Model localUri={localUri} scale={scale} rot={rot} equippedItems={equippedItems} />
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
