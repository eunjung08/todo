# 오늘의 할일

오늘 날짜 기준 할일을 관리하는 반응형 웹앱입니다. HTML, CSS, JavaScript만 사용하며, Firebase **Firestore**로 데이터를 저장합니다.

## 실행 방법

1. 프로젝트 루트에서 로컬 서버 실행 (ES module 사용으로 `file://` 대신 HTTP 필요)
   ```bash
   npx serve .
   ```
   또는 `python -m http.server 8080`, `live-server` 등 사용

2. 브라우저에서 `http://localhost:3000` (또는 해당 포트) 접속

## Firebase 설정 (Firestore)

`firebase-config.js`에 **todo-ccee4** 프로젝트용 설정이 이미 적용되어 있습니다. (Firestore만 사용, Analytics 미사용)

- Firestore Database가 아직 없다면 [Firebase Console](https://console.firebase.google.com/) → **todo-ccee4** → **Firestore Database**에서 데이터베이스를 만들고, 테스트 모드로 시작하면 됩니다.
- **컬렉션 쿼리·복합 인덱스 불필요**: 날짜별 단일 문서(`todos/2025-01-28` 등)에 `items` 배열로 저장합니다.

### Firestore 보안 규칙 예시 (선택)

```txt
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /todos/{docId} {
      allow read, write: if true;  // 테스트용. 운영 시 인증 조건으로 변경
    }
  }
}
```

## 기능

- **달력**에서 날짜 선택 후 해당 날짜의 할일 조회·추가
- 할일 **추가** / **완료 토글** / **삭제**
- **필터**: 전체 / 진행중 / 완료
- **반응형** UI (모바일·데스크톱)
- Firestore **실시간 동기화**

## 파일 구조

```
├── index.html
├── styles.css
├── app.js
├── firebase-config.js
└── README.md
```

## 기술 스택

- HTML, CSS, JavaScript (Vanilla)
- Firebase Firestore (SDK 10.x, CDN)
