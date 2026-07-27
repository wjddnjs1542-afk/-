# TripFlow AI · 다카마쓰 Phase 1 MVP

## 포함 기능
- PC / 태블릿 / 안드로이드 / iPhone 반응형 화면
- 다카마쓰 3박 4일 샘플 일정
- 날짜별 장소 추가·삭제·드래그 순서 변경
- 브라우저 자동 저장(LocalStorage)
- 직선거리 기반 스마트 동선 정리
- Google Maps 일반 / 하이브리드 / 위성
- Google Places 자동완성
- Google Directions 실제 이동경로
- Google Maps에서 일정 열기

## 실행
1. 압축을 풉니다.
2. 폴더의 `index.html`을 실행합니다.
3. API 키 없이도 일정 편집과 샘플 동선 기능을 확인할 수 있습니다.
4. 실제 지도는 우측 상단 `Google Maps 설정`에서 API 키를 입력합니다.

## Google Cloud 설정
- Maps JavaScript API
- Places API
- Directions API(프로젝트 구성에 따라 필요)

API 키에는 웹사이트(HTTP referrer) 제한을 적용하세요. 정식 서비스에서는 서버 측 Routes API 연동과 키 보호가 필요합니다.

## Netlify
압축을 푼 폴더를 Netlify Drop에 올리면 됩니다. Google API 키의 허용 도메인에 발급받은 Netlify 주소를 등록하세요.


## 2026-07 모바일 조작성 개선
- 지도 한 손가락 드래그 이동 지원
- 두 손가락 핀치 확대/축소 지원
- Google Maps gestureHandling: greedy 적용
