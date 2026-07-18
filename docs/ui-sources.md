# Moverse UI source notes

Moverse의 지도 UI는 아래 공개 자료에서 구현 원칙만 참고했습니다. 외부 완성 컴포넌트나 이미지 에셋은 복사하지 않았고, 프로젝트의 기존 React·CSS 구조에 맞춰 다시 작성했습니다.

## Glass surfaces

- CodePen, [Transparent blurred header over map](https://codepen.io/pierreburel/pen/AJLqGY)
- CodePen, [Responsive mobile bottom navigation](https://codepen.io/Ahmod-Musa/pen/QwjLxNZ)
- CodePen, [Glassmorphism template](https://codepen.io/estoilkov/pen/dyWevwg)
- CodePen [Terms of Service](https://blog.codepen.io/legal/terms-of-service/): public Pens are MIT licensed.
- Microsoft, [Acrylic material guidance](https://learn.microsoft.com/en-us/windows/apps/design/style/acrylic): translucent material is limited to temporary or layered navigation surfaces.

Adapted pattern: an opaque fallback plus `rgba()` tint, 16px backdrop blur, restrained saturation, a single highlight border, and one soft shadow. It is used only on map overlays, not on dense content cards.

## Map-coupled 3D structures

- MapLibre, [3D extrusion floorplan example](https://maplibre.org/maplibre-gl-js/docs/examples/3d-extrusion-floorplan/)
- MapLibre, [`fill-extrusion` style specification](https://maplibre.org/maplibre-style-spec/layers/#fill-extrusion)
- MapLibre GL JS [BSD-3-Clause license](https://github.com/maplibre/maplibre-gl-js/blob/main/LICENSE.txt)

Move Spots and Move Events are derived into small GeoJSON polygons and rendered through native `fill-extrusion` layers. They remain locked to geographic coordinates while panning, zooming, pitching, and rotating. No real-world building extrusion, Three.js model, or third-party 3D asset is used.
