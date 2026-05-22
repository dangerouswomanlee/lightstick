# 응원봉 AR

손 인식으로 3D 응원봉을 AR로 체험하는 웹 앱입니다.

**(https://dancing-taiyaki-2e0711.netlify.app/)**

---

---

## 시연 영상

[![시연 영상]https://www.youtube.com/watch?v=CJzTn2X7HtQ

---

## 기능

- **NewJeans / NCT 응원봉** 3D 모델 지원
- **왼손**: 응원봉 위치 및 방향 제어
- **오른손 손가락 수**로 조명 모드 전환

  | 손가락 수 | 동작 |
  |:---------:|------|
  | 1 | 기본 발광 (상시) |
  | 2 | 느린 점멸 |
  | 3 | 빠른 점멸 |
  | 4 | 무지개 색상 변환 |
  | 5 | NewJeans ↔ NCT 모델 전환 |

- 주먹(0) — 마지막 조명 모드 유지

## 사용 방법

별도 설치 없이 브라우저에서 바로 실행됩니다.

1. 위 라이브 데모 링크 접속
2. 카메라 권한 허용
3. 손을 화면에 비추면 응원봉이 나타납니다

> 카메라가 있는 데스크탑/모바일 환경에서 이용해 주세요.

## 기술 스택

- [Three.js](https://threejs.org/) — 3D 렌더링
- [MediaPipe Hand Landmarker](https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker) — 실시간 손 인식
- WebGL / WebRTC — 카메라 및 AR 렌더링

## 로컬 실행

GLB 파일을 불러오기 위해 로컬 서버가 필요합니다.

```bash
# Python
python -m http.server 8000

# Node.js
npx serve .
```

이후 `http://localhost:8000` 접속
