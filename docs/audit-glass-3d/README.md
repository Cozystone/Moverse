# Moverse 3D map and glass UI audit

Viewport: `390 × 844`

## Captured steps

1. `01-current-map.png` — **개선 필요**. 브랜드, 자원, 알림, 종료 시간, 검색, 장소, MOVE CTA, 하단 내비가 서로 다른 표면으로 떠 있어 지도를 가린다. Energy와 Coin도 숫자만으로는 구분하기 어렵다.
2. `02-current-activity.png` — **대체로 양호**. 다음 활동과 참가 예정 흐름은 명확하지만 행사 만들기 진입점이 지도 중앙 탭에 있어 정보 구조가 분리되어 있다.
3. `03-current-mates.png` — **양호**. 검색, 안전 안내, 메이트 목록의 위계가 명확하다. 글라스를 추가하면 오히려 읽기 어려워질 수 있다.
4. `04-current-growth.png` — **양호**. 정보량은 많지만 레벨, 주간 목표, 최근 활동 순서가 이해된다. 불투명한 카드 표면을 유지하는 편이 안전하다.
5. `05-after-map.png` — **양호**. 상단 상태 바와 장소·운영 바를 각각 한 표면으로 통합했고, 하단 중앙 행동을 MOVE로 단일화했다. Spot과 Event는 지도 좌표 기반 extrusion으로 솟는다.
6. `06-after-move-session.png` — **양호**. 이동 기록, 거리, Energy, 목적지, 종료 행동을 하나의 다크 글라스 세션으로 묶었다.
7. `07-after-activity.png` — **양호**. 행사 만들기를 활동 화면 헤더로 옮겨 지도 행동과 개최 행동의 경쟁을 제거했다.

## Highest-impact changes

- 지도 홈의 독립 표면 수를 줄이고 두 개의 상단 글라스 바와 하나의 하단 내비로 통합했다.
- Move Energy를 `오늘 움직임 0–100`, Move Coin을 `누적 활동 보상 C`로 명시했다.
- 기존 GeoJSON point와 별도로 작은 polygon을 만들어 MapLibre `fill-extrusion`으로 렌더링했다. DOM 마커나 실제 건물 데이터는 사용하지 않는다.
- 글라스는 지도 위 오버레이에만 사용하고 활동·메이트·성장 본문은 불투명하게 유지했다.

## Accessibility and evidence limits

- 키보드 포커스는 내비 아이콘 주변에 고대비 링으로 표시된다.
- 글라스 미지원 브라우저에는 흰색 또는 딥그린 불투명 표면이 적용된다.
- 스크린샷만으로 실제 저사양 GPU 성능, 야외 햇빛 아래 대비, 지도 라벨 충돌, 스크린리더 전체 흐름은 검증할 수 없다.
