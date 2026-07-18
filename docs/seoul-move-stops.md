# 서울 전역 Move Stop 데이터

지도 탐색용 Move Stop은 서울시가 공개한 **실제 공원·하천 시설의 보행자 출입구**를 기준으로 만든다. 원본 시설 중심점을 임의로 복제하지 않고, 실제 조사된 출입구 하나하나를 후보 지점으로 사용했다.

## 결과

- Move Stop: **3,357개**
- 대표 시설: **1,309개**
- 범위: 서울시 공원(`FU_BI`)·하천(`FU_BJ`)
- 좌표: 각 시설의 실제 보행자 출입구 WGS84 좌표
- 앱 정책상 종료 시각: 최대 21:00. 원본 평일 운영 종료가 더 이르면 그 시각을 우선한다.

이 지점들은 지도 탐색과 체크인을 위한 `discovery` 스탑이다. 공식 스포츠 시설로 별도 확인한 지점이 아니므로 `verified: false`, `eventEligible: false`로 제공한다. 축구·농구 같은 팀 스포츠 이벤트 개설에는 기존의 공식 검증 구장 데이터만 사용해야 한다.

## 출처와 이용 조건

- [서울시 시설물 정보 (OA-21698)](https://data.seoul.go.kr/dataList/OA-21698/S/1/datasetView.do)
- [서울시 보행자 출입구 정보 (OA-21699)](https://data.seoul.go.kr/dataList/OA-21699/S/1/datasetView.do)
- 제공기관·저작권자: 서울특별시
- 데이터 갱신일: 2023-04-21
- 이용허락: **공공누리 제1유형(출처표시, 상업적 이용 및 변경 가능)**

Moverse가 가공한 데이터에도 위 출처 표시를 유지한다. 운영 전에는 현장 공사, 임시 폐쇄, 운영시간 변경 여부를 다시 확인해야 한다.

## 생성 규칙

1. OA-21698 시설 중 `sisulSpfc`가 `FU_BI` 또는 `FU_BJ`인 행만 선택한다.
2. 수동 검토에서 부적합한 `P0025`, `P1391`, `P1401`, `P1430`, `P1431`, `P1434`는 제외한다.
3. OA-21699를 `sisulId`로 조인한다.
4. 출입구 메모에 `폐문`, `폐쇄`, `외부인금지`, `외부인 금지`, `입주민전용`, `입주민 전용`, `잠김`, `통행불가`, `통행 불가`가 있으면 제외한다.
5. 접근 구분 `cmgSe=EIO_DA`, 평일 운영 `wkOpertime=WD_N`을 제외한다.
6. 동일 좌표는 ID가 앞선 출입구 하나만 남긴다.
7. 같은 시설 안에서 출입구 ID 순으로 40m greedy NMS를 적용한다. 서울 범위의 짧은 거리이므로 위도 1도를 111,000m로 둔 국소 equirectangular 거리식을 사용한다.

처리 단계별 개수는 다음과 같다.

| 단계 | 개수 |
| --- | ---: |
| 선택된 공원·하천 시설 | 1,454 |
| 조인 및 안전 필터 통과 출입구 | 5,574 |
| 완전 동일 좌표 제거 후 | 5,520 |
| 40m NMS 후 Move Stop | 3,357 |

## 재생성

Python 표준 라이브러리만 필요하다. 원본 ZIP은 OS 임시 폴더에서 처리한 뒤 삭제되며 저장소에 추가하지 않는다.

```powershell
python scripts/generate-seoul-stops.py
```

이미 두 원본 ZIP을 별도 폴더에 내려받았다면 네트워크 없이 재생성할 수 있다.

```powershell
python scripts/generate-seoul-stops.py --source-dir C:\path\to\source-zips
```

생성 결과는 `src/data/seoul-stops.json`이며, 앱에서는 `src/data/seoul-stops.ts`의 `SEOUL_DISCOVERY_STOPS`를 사용한다.
