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

// Avatar base key from its GLB url, e.g.
//   /media/models/avatars/pinkcat_socketed_CFAwb47.glb -> "pinkcat"
// Robust against Django's random re-import suffixes (matching by full url fails
// because the stored avatar_config can point at a stale filename).
function avatarBaseFromUrl(url) {
  if (!url) return null;
  const file = url.split('?')[0].split('/').pop() || '';
  const token = file.split('_')[0].toLowerCase();
  return token.replace(/[^a-z]/g, '') || null;
}

// Merge placement tuning for one item on one avatar. Most specific wins:
// avatar_overrides[base][slug] > socket_tuning[slug] > socket_tuning._default.
// Fixing an item once per avatar makes EVERY hand×head combination correct —
// items hang on independent sockets, so fixes compose automatically.
function resolveTuning(attachTuning, avatarBase, slug) {
  const t = attachTuning || {};
  const merged = { loc: [0, 0, 0], rot_deg: [0, 0, 0], scale: 1.0, abs: false };
  const override = slug && avatarBase ? ((t.avatar_overrides || {})[avatarBase] || {})[slug] : null;
  [(t.socket_tuning || {})._default,
   slug ? (t.socket_tuning || {})[slug] : null,
   override,
  ].forEach((layer) => {
    if (!layer) return;
    if (layer.loc) merged.loc = layer.loc;
    if (layer.rot_deg) merged.rot_deg = layer.rot_deg;
    if (layer.scale != null) merged.scale = layer.scale;
  });
  // Blender fixes (extract_offset.py) store the item's ABSOLUTE socket-space
  // transform — loc/rot/scale must be applied as-is, not on top of the generic
  // item_scale heuristic, or everything double-scales.
  if (override) merged.abs = true;
  return merged;
}

// Measure the avatar at its native scale: geometric center (to recenter models
// whose origin is off) and each socket's FULL world matrix (position + rotation
// + scale). The matrix is essential: in the glTF/three.js (Y-up) scene the socket
// carries the avatar's Z-up->Y-up rotation, so item offsets/rotations from
// Blender (which are socket-relative) must be applied IN the socket's frame —
// applying them in the avatar-root frame puts the item in the wrong place with
// the wrong orientation. Returns { center, sockets:{ name: Matrix4 } }.
function measureScene(scene) {
  const result = { center: [0, 0, 0], sockets: {} };
  if (!scene || !THREE) return result;
  scene.scale.set(1, 1, 1);            // measure in native units, ignore render scale
  scene.position.set(0, 0, 0);
  scene.quaternion.identity();
  scene.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(scene);
  const c = box.getCenter(new THREE.Vector3());
  result.center = [c.x, c.y, c.z];
  ['socket_r', 'socket_l', 'socket_head', 'socket_back'].forEach((name) => {
    const node = scene.getObjectByName(name);
    if (!node) return;
    result.sockets[name] = node.matrixWorld.clone();  // relative to scene root
  });
  return result;
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

// One equipped item GLB, positioned at its socket (preferred) or anchor fallback,
// then adjusted by the per-(avatar,item) tuning offsets. Center-relative × baseScale.
function ItemGLTF({ localUri, anchor, scale, baseScale, sockets, center, tune }) {
  const gltf = useGLTF(localUri);
  // Recenter the item to its bounding-box center — mirrors attach_socket's
  // origin_set(BOUNDS) that the Blender tuning was measured against.
  const { scene, pivot } = useMemo(() => {
    const s = plushify(gltf.scene.clone());
    let p = [0, 0, 0];
    if (THREE) {
      const c = new THREE.Box3().setFromObject(s).getCenter(new THREE.Vector3());
      p = [c.x, c.y, c.z];
    }
    return { scene: s, pivot: p };
  }, [gltf.scene]);

  // Build the item's local matrix in the avatar's CENTERED-NATIVE frame:
  //   M = T(-center) · socketWorld · rel
  // where rel = compose(tune.loc, tune.rot, itemScale). socketWorld carries the
  // socket's true frame (incl. the Y-up rotation), so the offset/rotation land
  // exactly as set in Blender. Applied via matrixAutoUpdate=false.
  const matrix = useMemo(() => {
    if (!THREE) return null;
    const socketName = ANCHOR_TO_SOCKET[anchor];
    let socketMat = socketName && sockets ? sockets[socketName] : null;
    if (!socketMat) {
      const a = ANCHOR[anchor] || ANCHOR.none;       // fallback: position only
      socketMat = new THREE.Matrix4().makeTranslation(a[0], a[1], a[2]);
    }
    const loc = tune?.loc || [0, 0, 0];
    const rotEuler = new THREE.Euler(
      ...(tune?.rot_deg || [0, 0, 0]).map((d) => (d * Math.PI) / 180), 'XYZ');
    const s = tune?.abs ? (tune.scale ?? 1) : (scale ?? 1) * (tune?.scale ?? 1);
    const rel = new THREE.Matrix4().compose(
      new THREE.Vector3(loc[0], loc[1], loc[2]),
      new THREE.Quaternion().setFromEuler(rotEuler),
      new THREE.Vector3(s, s, s));
    // Blender fixes (extract_offset, abs mode) are authored in Blender's Z-up
    // axes; the socket node has identity rotation in the Y-up glTF scene, so the
    // socket-relative transform must be basis-changed Z-up -> Y-up (C = Rx(-90)):
    //   rel_gltf = C · rel_blender · C⁻¹.  Without this the offset/rotation get
    //   their up/forward axes swapped (item flies off the hand, wrong rotation).
    if (tune?.abs) {
      const C = new THREE.Matrix4().makeRotationX(-Math.PI / 2);
      const Cinv = new THREE.Matrix4().makeRotationX(Math.PI / 2);
      rel.premultiply(C).multiply(Cinv);
    }
    const recenter = new THREE.Matrix4().makeTranslation(-center[0], -center[1], -center[2]);
    return recenter.multiply(socketMat).multiply(rel);
  }, [anchor, sockets, center, tune, scale]);

  const groupRef = useRef();
  useEffect(() => {
    if (groupRef.current && matrix) {
      groupRef.current.matrixAutoUpdate = false;
      groupRef.current.matrix.copy(matrix);
      groupRef.current.matrixWorldNeedsUpdate = true;
    }
  }, [matrix]);

  return (
    <group ref={groupRef}>
      <primitive object={scene} position={[-pivot[0], -pivot[1], -pivot[2]]} />
    </group>
  );
}

function ItemMesh({ item, sockets, center, attachTuning, avatarBase }) {
  const local = useCachedGlb(item.url);
  if (!local) return null;
  const tune = resolveTuning(attachTuning, avatarBase, item.slug);
  return (
    <ItemGLTF
      localUri={local}
      anchor={item.anchor}
      sockets={sockets}
      center={center}
      tune={tune}
      scale={item.scale || 0.4}   /* native item scale (non-abs path); inner group adds render scale */
    />
  );
}

function Model({ localUri, scale, rot, equippedItems, attachTuning, avatarBase }) {
  const gltf = useGLTF(localUri);
  const scene = useMemo(() => plushify(gltf.scene), [gltf.scene]);
  const { center, sockets } = useMemo(() => measureScene(scene), [scene]);
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
    // idleBreath rides on top of the inner group's baseScale.
    ref.current.scale.setScalar(idleBreath);
  });
  return (
    <group ref={ref}>
      {/* Inner group applies the render scale ONCE; everything inside works in
          the avatar's centered-native units (avatar recentered, items placed via
          socketWorld·rel). This keeps avatar + items in one consistent frame. */}
      <group scale={scale}>
        <primitive object={scene} position={[-center[0], -center[1], -center[2]]} />
        {(equippedItems || []).map((it, i) => (
          <Suspense key={`${it.url}-${i}`} fallback={null}>
            <ItemMesh item={it} sockets={sockets} center={center} attachTuning={attachTuning} avatarBase={avatarBase} />
          </Suspense>
        ))}
      </group>
    </group>
  );
}

export default function Avatar3D({ url, scale = 0.04, equippedItems = [], style, height = 220, attachTuning = null, avatarBase = null }) {
  const [failed, setFailed] = useState(false);
  const localUri = useCachedGlb(url);
  // Derive the base from the url when the caller didn't pass one (or passed a
  // stale-match null) so per-avatar tuning always resolves.
  const effectiveBase = avatarBase || avatarBaseFromUrl(url);
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
      <Canvas camera={{ position: [0, 1.2, 4.2], fov: 50 }} dpr={[1, 1.5]}>
        <ambientLight intensity={1.1} />
        <hemisphereLight args={['#ffffff', '#b0b0b0', 1.1]} />
        <directionalLight position={[3, 5, 4]} intensity={1.4} />
        <directionalLight position={[-4, 2, -3]} intensity={0.7} />
        <directionalLight position={[0, -3, 2]} intensity={0.4} />
        <Suspense fallback={null}>
          <ErrorGuard onError={() => setFailed(true)}>
            <Model localUri={localUri} scale={scale} rot={rot} equippedItems={equippedItems} attachTuning={attachTuning} avatarBase={effectiveBase} />
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
