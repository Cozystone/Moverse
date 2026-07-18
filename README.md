# Moverse

> 화면 밖에서 만나고, 함께 움직이다.

Moverse는 인증된 학생들이 3D 지도에서 주변 활동을 발견하고, 현실에서 만나 함께 운동하며, 얻은 보상으로 새로운 장소와 이벤트를 만드는 위치 기반 대면 활동 SNS입니다.

## 핵심 경험

1. 학생 인증과 선호 스포츠 설정
2. 3D 지도에서 Move Spot 및 Move Event 탐색
3. 걷기·조깅으로 Move Energy 획득
4. 스포츠 Event 예약 및 공개 Spot 체크인
5. 동적 QR을 이용한 상호 태그
6. 공동 활동 후 Coin·XP·Spot Energy 획득
7. 함께 활동한 사용자와 Move Mate 연결
8. DM의 Move Again 기능으로 다음 일정 조율
9. Coin으로 새로운 Event 개최

## 안전 원칙

- 인증 전에는 학생 개인의 정확한 위치를 공개하지 않습니다.
- 사람을 검색하는 대신 공개된 장소의 활동을 먼저 발견합니다.
- 첫 만남은 공개 Move Spot의 그룹 Event에서 시작합니다.
- 함께 활동하고 상호 연결된 Move Mate끼리만 DM을 사용할 수 있습니다.
- 야간 운영 시간이 지나면 Run Spot과 현장 체크인을 자동 종료합니다.
- 차단, 신고, 즉시 활동 이탈 기능을 제공합니다.

## 기술 스택

- Next.js 16 App Router
- React 19 + TypeScript
- Tailwind CSS 4
- MapLibre GL JS
- Zustand + localStorage 데모 영속화
- Framer Motion
- QRCode React
- Vercel

## 로컬 실행

```bash
npm install
npm run dev
```

브라우저에서 `http://localhost:3000`을 엽니다. 위치 또는 카메라 권한을 거절하더라도 발표용 데모 흐름을 끝까지 체험할 수 있습니다.

## 검증

```bash
npm run verify
```

## 문서

- [운영 아키텍처](docs/architecture.md): 현재 Vercel 데모와 실제 서비스의 위치·실시간·보상·안전 설계
- [대회 영상 스크립트](docs/demo-script.md): 1분 45초 촬영 순서, 내레이션, 45초 축약본
- [모바일 디자인 QA](design-qa.md): Zenly·Pokémon GO 참고 방향과 390×844 검증 기록

## 데모 시나리오

1. 온보딩에서 학생증 데모 인증을 완료합니다.
2. 관심 종목을 선택하고 Moverse 지도를 엽니다.
3. `Move 시작`으로 조깅 시뮬레이션을 확인합니다.
4. 지도에서 `선셋 20분 런앤워크`를 선택합니다.
5. 예약 → 위치 확인 → 동적 QR → 상호 태그 → 활동 완료를 진행합니다.
6. LUMI에게 Move Mate를 요청합니다.
7. Social에서 LUMI와 다음 일정을 잡습니다.
8. Create에서 새로운 스포츠 Event를 개최합니다.
9. My Verse에서 개인·관계·장소의 성장을 확인합니다.

## 배포

GitHub 저장소를 Vercel에 연결하거나 Vercel CLI로 배포합니다.

```bash
vercel --yes
vercel --prod
```

이 MVP의 학생 인증, AI 추천, 실시간 메시징은 대회 시연용 데모 데이터로 구성되어 있습니다. 실제 서비스에서는 인증기관, 데이터베이스, 관리자 안전 운영 체계를 별도로 연결해야 합니다.
