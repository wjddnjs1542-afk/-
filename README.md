# TripFlow AI v0.7 — 여행 현장형 지도·일정 플래너

## v0.7 핵심 개선
- 모바일 지도 50% + 일정 50% 상태에서 일정 영역만 독립 스크롤
- 일정 본문을 스크롤해도 패널이 전체 화면으로 자동 전환되지 않음
- 장소명만 입력해도 다카마쓰·가가와 주변 Google Places 실제 검색 결과 제공
- 검색 결과에서 주소와 좌표를 확인한 뒤 정확한 장소 선택
- JR Hotel Clement Takamatsu처럼 한글 검색이 애매한 장소도 영문·일문 보강 검색
- 일정 수정 화면에서 위도·경도를 직접 입력해 잘못 찍힌 마커 보정
- 검색 장소 선택 즉시 지도 중심 이동 및 확대
- 패널 상태, DAY, 교통수단, 지도 위치와 확대 수준 자동 저장

## GitHub 업로드
ZIP 압축을 푼 뒤 저장소의 기존 파일을 모두 교체하여 업로드하세요. `index.html`, `styles.css`, `app.js`, `config.js`가 저장소 최상단에 있어야 합니다.

## Google Maps API
`config.js`의 API 키에는 HTTP referrer 제한을 설정하고 Maps JavaScript API, Places API, Directions API를 활성화하세요.
