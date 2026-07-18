import type {
  CustomLayerInterface,
  CustomRenderMethodInput,
  Map as MapLibreMap,
} from "maplibre-gl";
import { MercatorCoordinate } from "maplibre-gl";
import * as THREE from "three";
import {
  GLTFLoader,
  type GLTF,
} from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneModel } from "three/examples/jsm/utils/SkeletonUtils.js";

export const MOVER_3D_MODEL_URLS = [
  "/models/movers/character-a.glb",
  "/models/movers/character-b.glb",
  "/models/movers/character-e.glb",
  "/models/movers/character-f.glb",
] as const;

export type Mover3DAnimation = "idle" | "walk" | "sprint";
export type Mover3DPrivacy = "precise" | "approximate" | "hidden";

/**
 * A map-anchored Mover. Coordinates must already respect the user's privacy
 * choice: use an intentionally blurred coordinate for `approximate`, and the
 * layer will omit `hidden` people entirely.
 */
export interface Mover3DPerson {
  id: string;
  modelUrl: string;
  lng: number;
  lat: number;
  /** Clockwise degrees from north. */
  bearing?: number;
  /** Metres above the map surface. */
  altitude?: number;
  /** Multiplier applied to the model's metre-sized local coordinate system. */
  scale?: number;
  animation?: Mover3DAnimation;
  /** Accent used by the 3D ground ring. */
  accent?: string;
  privacy?: Mover3DPrivacy;
  visible?: boolean;
}

export interface Mover3DLayerOptions {
  id?: string;
  /** Hide detailed characters while the camera is too far away. */
  minZoom?: number;
  /** Hard GPU/animation budget. Defaults to four visible people. */
  maxPeople?: number;
  /** Default stylised scale. Kenney's characters are roughly two units tall. */
  defaultScale?: number;
  /** Zoom where the configured model scale is rendered at 1:1. */
  referenceZoom?: number;
  defaultAccent?: string;
  animationFadeSeconds?: number;
  onError?: (error: Error) => void;
}

export interface Mover3DLayerHandle {
  readonly layer: CustomLayerInterface;
  update: (people: readonly Mover3DPerson[]) => void;
  /** Removes the layer when mounted, otherwise releases any owned resources. */
  destroy: () => void;
}

interface NormalizedMover3DPerson {
  id: string;
  modelUrl: string;
  lng: number;
  lat: number;
  bearing: number;
  altitude: number;
  scale: number;
  animation: Mover3DAnimation;
  accent: string;
  privacy: Exclude<Mover3DPrivacy, "hidden">;
}

interface ModelTemplate {
  scene: THREE.Object3D;
  animations: readonly THREE.AnimationClip[];
}

interface MoverInstance {
  person: NormalizedMover3DPerson;
  anchor: THREE.Group;
  model: THREE.Object3D;
  mixer: THREE.AnimationMixer;
  clips: ReadonlyMap<string, THREE.AnimationClip>;
  action?: THREE.AnimationAction;
  actionName?: string;
  ring: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
  ownedMaterials: readonly THREE.Material[];
}

const DEFAULT_LAYER_ID = "moverse-people-3d";
const DEFAULT_ACCENT = "#c7ff32";
const MAX_FRAME_DELTA_SECONDS = 1 / 20;
const MAX_TEXTURE_ANISOTROPY = 8;
const MODEL_UPRIGHT_ROTATION = new THREE.Matrix4().makeRotationX(Math.PI / 2);
const MODEL_FORWARD_OFFSET_DEGREES = 180;

function asError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}

function normalizePeople(
  people: readonly Mover3DPerson[],
  maxPeople: number,
  defaultScale: number,
  defaultAccent: string,
): NormalizedMover3DPerson[] {
  const seen = new Set<string>();

  return people
    .filter((person) => {
      if (
        !person.id ||
        !person.modelUrl ||
        person.visible === false ||
        person.privacy === "hidden" ||
        !Number.isFinite(person.lng) ||
        !Number.isFinite(person.lat) ||
        Math.abs(person.lat) > 90 ||
        Math.abs(person.lng) > 180 ||
        seen.has(person.id)
      ) {
        return false;
      }

      seen.add(person.id);
      return true;
    })
    .slice(0, maxPeople)
    .map((person) => ({
      id: person.id,
      modelUrl: person.modelUrl,
      lng: person.lng,
      lat: person.lat,
      bearing: Number.isFinite(person.bearing) ? (person.bearing ?? 0) : 0,
      altitude: Number.isFinite(person.altitude) ? (person.altitude ?? 0) : 0,
      scale:
        Number.isFinite(person.scale) && (person.scale ?? 0) > 0
          ? (person.scale ?? defaultScale)
          : defaultScale,
      animation: person.animation ?? "idle",
      accent: person.accent ?? defaultAccent,
      privacy: person.privacy === "approximate" ? "approximate" : "precise",
    }));
}

function cloneInstanceMaterials(root: THREE.Object3D): THREE.Material[] {
  const ownedMaterials: THREE.Material[] = [];

  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;

    object.frustumCulled = false;
    if (Array.isArray(object.material)) {
      object.material = object.material.map((material) => {
        const cloned = material.clone();
        ownedMaterials.push(cloned);
        return cloned;
      });
      return;
    }

    const cloned = object.material.clone();
    object.material = cloned;
    ownedMaterials.push(cloned);
  });

  return ownedMaterials;
}

function configureTemplateRendering(
  root: THREE.Object3D,
  maxSupportedAnisotropy: number,
): void {
  const textures = new Set<THREE.Texture>();

  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    const meshMaterials = Array.isArray(object.material)
      ? object.material
      : [object.material];

    for (const material of meshMaterials) {
      if (material instanceof THREE.MeshBasicMaterial) {
        material.toneMapped = false;
      }
      for (const value of Object.values(material)) {
        if (value instanceof THREE.Texture) textures.add(value);
      }
    }
  });

  for (const texture of textures) {
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = true;
    texture.anisotropy = Math.max(
      1,
      Math.min(MAX_TEXTURE_ANISOTROPY, maxSupportedAnisotropy),
    );
    texture.needsUpdate = true;
  }
}

function disposeTemplate(template: ModelTemplate): void {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();

  template.scene.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;

    geometries.add(object.geometry);
    const meshMaterials = Array.isArray(object.material)
      ? object.material
      : [object.material];

    for (const material of meshMaterials) {
      materials.add(material);
      for (const value of Object.values(material)) {
        if (value instanceof THREE.Texture) textures.add(value);
      }
    }
  });

  for (const geometry of geometries) geometry.dispose();
  for (const material of materials) material.dispose();
  for (const texture of textures) texture.dispose();
}

function setAnchorTransform(instance: MoverInstance, zoomScale = 1): void {
  const { person, anchor } = instance;
  const coordinate = MercatorCoordinate.fromLngLat(
    [person.lng, person.lat],
    person.altitude,
  );
  const metreScale =
    coordinate.meterInMercatorCoordinateUnits() * person.scale * zoomScale;
  const yaw = new THREE.Matrix4().makeRotationY(
    THREE.MathUtils.degToRad(MODEL_FORWARD_OFFSET_DEGREES - person.bearing),
  );

  // This is the same T * S * Rx pattern used by MapLibre's official Three.js
  // custom-layer example. The negative Y scale converts Three's world into
  // MapLibre's Mercator handedness while Rx stands the GLB upright.
  anchor.matrix
    .makeTranslation(coordinate.x, coordinate.y, coordinate.z)
    .scale(new THREE.Vector3(metreScale, -metreScale, metreScale))
    .multiply(MODEL_UPRIGHT_ROTATION)
    .multiply(yaw);
  anchor.matrixWorldNeedsUpdate = true;
}

function setRingAppearance(instance: MoverInstance): void {
  const approximate = instance.person.privacy === "approximate";
  instance.ring.material.color.set(instance.person.accent);
  instance.ring.material.opacity = approximate ? 0.52 : 0.88;
  instance.ring.scale.setScalar(approximate ? 1.55 : 1);
}

function setAnimation(
  instance: MoverInstance,
  name: Mover3DAnimation,
  fadeSeconds: number,
): void {
  if (instance.actionName === name) return;

  const clip =
    instance.clips.get(name) ??
    instance.clips.get("idle") ??
    instance.clips.values().next().value;
  if (!clip) return;

  const nextAction = instance.mixer.clipAction(clip);
  nextAction.reset().setLoop(THREE.LoopRepeat, Infinity).fadeIn(fadeSeconds).play();
  instance.action?.fadeOut(fadeSeconds);
  instance.action = nextAction;
  instance.actionName = name;
}

function disposeInstance(instance: MoverInstance, scene: THREE.Scene): void {
  instance.mixer.stopAllAction();
  instance.mixer.uncacheRoot(instance.model);
  scene.remove(instance.anchor);
  instance.ring.geometry.dispose();
  instance.ring.material.dispose();
  for (const material of instance.ownedMaterials) material.dispose();
}

/**
 * Creates a true MapLibre `renderingMode: "3d"` layer backed by Three.js.
 * The layer shares MapLibre's WebGL context, so models rotate, pitch, zoom and
 * depth-test as part of the map rather than floating above it as DOM markers.
 */
export function createMover3DLayer(
  options: Mover3DLayerOptions = {},
): Mover3DLayerHandle {
  const id = options.id ?? DEFAULT_LAYER_ID;
  const minZoom = options.minZoom ?? 14;
  const maxPeople = Math.max(1, Math.min(12, options.maxPeople ?? 4));
  const defaultScale = options.defaultScale ?? 2.7;
  const referenceZoom = options.referenceZoom ?? 15.3;
  const defaultAccent = options.defaultAccent ?? DEFAULT_ACCENT;
  const fadeSeconds = options.animationFadeSeconds ?? 0.18;

  let people: NormalizedMover3DPerson[] = [];
  let map: MapLibreMap | undefined;
  let renderer: THREE.WebGLRenderer | undefined;
  let scene: THREE.Scene | undefined;
  let camera: THREE.Camera | undefined;
  let mounted = false;
  let contextLost = false;
  let generation = 0;
  let resourceEpoch = 0;
  let previousFrame = 0;

  const loader = new GLTFLoader();
  const instances = new Map<string, MoverInstance>();
  const templates = new Map<string, ModelTemplate>();
  const pendingTemplates = new Map<string, Promise<ModelTemplate>>();

  const reportError = (value: unknown) => {
    const error = asError(value);
    if (options.onError) {
      options.onError(error);
      return;
    }
    console.error("Failed to render a Mover 3D character", error);
  };

  const loadTemplate = (modelUrl: string): Promise<ModelTemplate> => {
    const loaded = templates.get(modelUrl);
    if (loaded) return Promise.resolve(loaded);

    const pending = pendingTemplates.get(modelUrl);
    if (pending) return pending;

    const loadEpoch = resourceEpoch;
    const request = loader
      .loadAsync(modelUrl)
      .then((gltf: GLTF) => {
        configureTemplateRendering(
          gltf.scene,
          renderer?.capabilities.getMaxAnisotropy() ?? 1,
        );
        const template = {
          scene: gltf.scene,
          animations: gltf.animations,
        } satisfies ModelTemplate;
        if (pendingTemplates.get(modelUrl) === request) {
          pendingTemplates.delete(modelUrl);
        }
        if (!mounted || loadEpoch !== resourceEpoch) {
          disposeTemplate(template);
          throw new Error(`Discarded stale Mover model load: ${modelUrl}`);
        }
        templates.set(modelUrl, template);
        return template;
      })
      .catch((error: unknown) => {
        if (pendingTemplates.get(modelUrl) === request) {
          pendingTemplates.delete(modelUrl);
        }
        throw error;
      });

    pendingTemplates.set(modelUrl, request);
    return request;
  };

  const createInstance = (
    person: NormalizedMover3DPerson,
    template: ModelTemplate,
  ): MoverInstance => {
    if (!scene) throw new Error("Mover 3D layer has not been mounted");

    const model = cloneModel(template.scene);
    const ownedMaterials = cloneInstanceMaterials(model);
    const anchor = new THREE.Group();
    anchor.name = `mover:${person.id}`;
    anchor.matrixAutoUpdate = false;
    anchor.add(model);

    const ringMaterial = new THREE.MeshBasicMaterial({
      color: person.accent,
      depthWrite: false,
      opacity: 0.88,
      side: THREE.DoubleSide,
      transparent: true,
      toneMapped: false,
    });
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.58, 0.77, 32),
      ringMaterial,
    );
    ring.name = "mover-accent-ring";
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.025;
    ring.renderOrder = 1;
    anchor.add(ring);

    const mixer = new THREE.AnimationMixer(model);
    const instance: MoverInstance = {
      person,
      anchor,
      model,
      mixer,
      clips: new Map(template.animations.map((clip) => [clip.name, clip])),
      ring,
      ownedMaterials,
    };

    setAnchorTransform(instance);
    setRingAppearance(instance);
    setAnimation(instance, person.animation, 0);
    scene.add(anchor);
    return instance;
  };

  const reconcile = async () => {
    if (!mounted || !scene) return;
    const currentGeneration = ++generation;

    try {
      const loadedPeople = await Promise.all(
        people.map(async (person) => ({
          person,
          template: await loadTemplate(person.modelUrl),
        })),
      );

      if (!mounted || currentGeneration !== generation || !scene) return;

      const nextIds = new Set(loadedPeople.map(({ person }) => person.id));
      for (const [personId, instance] of instances) {
        const nextPerson = loadedPeople.find(({ person }) => person.id === personId)
          ?.person;
        if (!nextIds.has(personId) || nextPerson?.modelUrl !== instance.person.modelUrl) {
          disposeInstance(instance, scene);
          instances.delete(personId);
        }
      }

      for (const { person, template } of loadedPeople) {
        const existing = instances.get(person.id);
        if (!existing) {
          instances.set(person.id, createInstance(person, template));
          continue;
        }

        existing.person = person;
        setAnchorTransform(existing);
        setRingAppearance(existing);
        setAnimation(existing, person.animation, fadeSeconds);
      }

      map?.triggerRepaint();
    } catch (error) {
      if (mounted && currentGeneration === generation) reportError(error);
    }
  };

  const onContextLost = () => {
    contextLost = true;
  };

  const onContextRestored = () => {
    contextLost = false;
    previousFrame = performance.now();
    map?.triggerRepaint();
  };

  const release = () => {
    generation += 1;
    resourceEpoch += 1;
    mounted = false;
    contextLost = false;

    const activeScene = scene;
    if (activeScene) {
      for (const instance of instances.values()) {
        disposeInstance(instance, activeScene);
      }
      activeScene.clear();
    }
    instances.clear();

    for (const template of templates.values()) disposeTemplate(template);
    templates.clear();
    pendingTemplates.clear();

    map?.getCanvas().removeEventListener("webglcontextlost", onContextLost);
    map?.getCanvas().removeEventListener("webglcontextrestored", onContextRestored);

    // Three only releases resources it owns; never call forceContextLoss here
    // because the WebGL context belongs to MapLibre as well.
    renderer?.dispose();
    renderer = undefined;
    scene = undefined;
    camera = undefined;
    map = undefined;
  };

  const layer: CustomLayerInterface = {
    id,
    type: "custom",
    renderingMode: "3d",
    onAdd(nextMap, gl) {
      resourceEpoch += 1;
      map = nextMap;
      scene = new THREE.Scene();
      camera = new THREE.Camera();
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        canvas: nextMap.getCanvas(),
        context: gl,
      });
      renderer.autoClear = false;
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.08;

      const hemisphere = new THREE.HemisphereLight(0xf5f8ff, 0x181d27, 2.25);
      const key = new THREE.DirectionalLight(0xffffff, 3.2);
      key.position.set(-18, -35, 70).normalize();
      const rim = new THREE.DirectionalLight(0xb8ffdc, 1.6);
      rim.position.set(26, 18, 42).normalize();
      scene.add(hemisphere, key, rim);

      mounted = true;
      previousFrame = performance.now();
      nextMap.getCanvas().addEventListener("webglcontextlost", onContextLost);
      nextMap.getCanvas().addEventListener("webglcontextrestored", onContextRestored);
      void reconcile();
    },
    render(
      _gl: WebGLRenderingContext | WebGL2RenderingContext,
      input: CustomRenderMethodInput,
    ) {
      if (
        !mounted ||
        contextLost ||
        !map ||
        !renderer ||
        !scene ||
        !camera ||
        map.getZoom() < minZoom ||
        instances.size === 0
      ) {
        return;
      }

      const now = performance.now();
      const delta = Math.min(
        Math.max((now - previousFrame) / 1_000, 0),
        MAX_FRAME_DELTA_SECONDS,
      );
      previousFrame = now;

      const pulse = 1 + Math.sin(now / 420) * 0.055;
      const zoomScale = 2 ** (referenceZoom - map.getZoom());
      for (const instance of instances.values()) {
        // A map-space model would otherwise grow exponentially while zooming.
        // Compensating around the reference zoom keeps the character readable
        // like a game-map marker while its base stays on the exact coordinate.
        setAnchorTransform(instance, zoomScale);
        instance.mixer.update(delta);
        const privacyScale = instance.person.privacy === "approximate" ? 1.55 : 1;
        instance.ring.scale.setScalar(privacyScale * pulse);
      }

      camera.projectionMatrix.fromArray(input.defaultProjectionData.mainMatrix);
      camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
      renderer.resetState();
      renderer.render(scene, camera);
      renderer.resetState();
      map.triggerRepaint();
    },
    onRemove() {
      release();
    },
  };

  return {
    layer,
    update(nextPeople) {
      people = normalizePeople(
        nextPeople,
        maxPeople,
        defaultScale,
        defaultAccent,
      );
      void reconcile();
    },
    destroy() {
      if (map?.getLayer(id)) {
        map.removeLayer(id);
        return;
      }
      release();
    },
  };
}
