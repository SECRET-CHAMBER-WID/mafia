# Deep Network

여러 명이 각자 휴대폰으로 접속해서 진행하는 React 게임입니다. GitHub Pages에는 정적 파일만 올라가므로, 여러 기기 동기화는 Firebase Realtime Database를 사용합니다.

## Firebase 설정

1. Firebase Console에서 새 프로젝트를 만듭니다.
2. Realtime Database를 만들고, 테스트용으로 시작합니다.
3. 프로젝트 설정에서 웹 앱을 추가한 뒤 Firebase config 값을 복사합니다.
4. `src/firebaseConfig.js`의 `PASTE_...` 값을 실제 값으로 바꿉니다.
5. Realtime Database 규칙을 소규모 지인용 테스트라면 아래처럼 둘 수 있습니다. 같은 내용은 `firebase.rules.json`에도 넣어두었습니다.

```json
{
  "rules": {
    "rooms": {
      "$room": {
        ".read": true,
        ".write": true
      }
    }
  }
}
```

## 실행

```bash
npm install
npm run dev
```

## 게임 기능

- 플레이어 PIN: `1004`
- 마스터 PIN: `4001`
- 테스트 PIN: `0000`

마스터 화면에서 총 인원, 마피아 팀 인원, 경찰/의사/보디가드/영매/스파이 수, 라운드 시간을 설정할 수 있습니다. 설정 후 인원이 모두 접속하면 게임을 시작하세요.

`0000`으로 들어가면 실제 접속자 없이 마스터, 마피아, 경찰, 의사, 보디가드, 영매, 시민 화면을 번갈아 확인할 수 있습니다.

## GitHub Pages 배포

이 저장소를 GitHub에 올린 뒤 Repository Settings → Pages → Source를 `GitHub Actions`로 설정합니다. `main` 또는 `master` 브랜치에 push하면 `.github/workflows/deploy.yml`이 자동으로 빌드하고 배포합니다.

같은 게임에 들어갈 사람들은 같은 방 주소를 열면 됩니다.

```text
https://YOUR_ID.github.io/YOUR_REPO/?room=game1
```

방 이름만 바꾸면 다른 게임을 따로 진행할 수 있습니다.
