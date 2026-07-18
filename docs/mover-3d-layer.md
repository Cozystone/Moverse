# Map-anchored Mover characters

`src/lib/create-mover-3d-layer.ts` renders GLB people in a MapLibre custom
layer. It is a real `renderingMode: "3d"` layer that shares the map WebGL
context, so characters pitch, rotate, zoom and depth-test with the map. It does
not use DOM markers or 2D sprites.

The projection transform follows MapLibre's official Three.js custom-layer
pattern:

- [Add a 3D model using Three.js](https://maplibre.org/maplibre-gl-js/docs/examples/add-a-3d-model-using-threejs/)
- [CustomLayerInterface](https://maplibre.org/maplibre-gl-js/docs/API/interfaces/CustomLayerInterface/)

## Integration

Create the handle once after the MapLibre map is ready, add its `layer`, and
send privacy-filtered locations through `update`.

```ts
const movers = createMover3DLayer({ minZoom: 14, maxPeople: 4 });
map.addLayer(movers.layer);

movers.update([
  {
    id: "me",
    modelUrl: MOVER_3D_MODEL_URLS[0],
    lng: 126.924,
    lat: 37.526,
    bearing: 72,
    animation: "sprint",
    accent: "#c7ff32",
    privacy: "precise",
  },
]);

// React/map cleanup
movers.destroy();
```

`privacy: "hidden"` is never added to the Three.js scene. For
`privacy: "approximate"`, the caller must send an already-obfuscated location;
the layer renders a wider, softer 3D ground ring to communicate that state.
The default budget is four animated people. Character scale is compensated
around `referenceZoom` so models stay legible instead of covering the map at
maximum zoom, while their feet remain anchored to the same coordinate.
Characters disappear below zoom
14, keeping Seoul-wide map movement lightweight.

## Character assets

The four bundled models are intentionally human rather than robot/fantasy
variants:

- `/models/movers/character-a.glb`
- `/models/movers/character-b.glb`
- `/models/movers/character-e.glb`
- `/models/movers/character-f.glb`

Their external PNG materials are preserved under
`/models/movers/Textures/texture-{a,b,e,f}.png`; keep that relative directory
when moving the GLBs.

They come from **Kenney Blocky Characters 2.0** and include `idle`, `walk` and
`sprint` animation clips. The pack is Creative Commons Zero (CC0 1.0). The
original notice is preserved at `public/models/movers/License.txt`.

- [Kenney](https://www.kenney.nl/)
- [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/)
