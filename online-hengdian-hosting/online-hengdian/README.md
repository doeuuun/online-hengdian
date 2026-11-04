# 온라인 헝디엔

3D 명청궁원을 걷고, 정전에서 신하들의 인사를 받고, 정자에서 차를 마시고, 소원 등불을 띄우는 웹 체험 공간입니다.
같은 시각에 접속한 사람끼리 서로 보이고 손 흔들기 인사를 할 수 있습니다. 로그인은 필요 없습니다.

## 구성
- `public/index.html` 화면과 게임 전체 (한 파일)
- `public/three.min.js` 3D 라이브러리 (three.js r128)
- `server.js` 웹 서버 + 접속자 위치/인사 중계 서버 (Node.js)

## 내 컴퓨터에서 실행
```
npm install
npm start
```
브라우저에서 http://localhost:3000 을 엽니다.

## 인터넷에 올리기 (Render 예시)
접속자끼리 보이게 하려면 정적 호스팅이 아니라 Node 서버를 돌릴 수 있는 곳에 올려야 합니다.

1. 이 폴더를 GitHub 저장소로 올립니다. (`node_modules`는 올리지 않습니다)
2. render.com 에서 New → Web Service → 그 저장소를 선택합니다. `render.yaml`이 있어 설정이 자동으로 채워집니다.
3. Build Command `npm install`, Start Command `npm start` 인지 확인하고 배포합니다.
4. 배포가 끝나면 나오는 `https://...onrender.com` 주소가 공개 링크입니다.
5. 자기 도메인을 쓰려면 Render의 Custom Domains에서 연결합니다.

Railway, Fly.io 등 Node.js를 실행할 수 있는 다른 서비스도 같은 방식(`npm install` 후 `npm start`)으로 올리면 됩니다.
Netlify, Cloudflare Pages, GitHub Pages 같은 정적 호스팅에는 `public` 폴더만 올릴 수 있으며, 그 경우 접속자끼리는 보이지 않고 혼자 둘러보는 모드로 동작합니다.

## 설정 (환경 변수)
- `PORT` 포트 번호. 호스팅 서비스가 자동으로 지정합니다.
- `MAX_CLIENTS` 동시 접속 상한. 기본 60.
- `MAX_PER_IP` 한 IP에서의 동시 접속 상한. 기본 4. 사무실 공용 와이파이처럼 여러 명이 같은 IP를 쓰면 올려주세요.
- `ALLOWED_ORIGINS` 접속을 허용할 주소 목록(쉼표 구분). 예: `https://hengdian.example.com`. 비우면 제한 없음.

## 알아두기
- 소원 등불, 역할, 도장은 각자 브라우저에만 저장됩니다. 다른 방문자의 소원은 보이지 않습니다.
- 연못 위에 처음부터 떠 있는 소원 4개는 분위기용 예시 문구입니다. 공개 전에 `public/index.html`의 `SAMPLE_WISHES`를 지우거나 바꿔주세요.
- 무료 호스팅 요금제는 한동안 접속이 없으면 서버가 잠들어 첫 접속이 느릴 수 있고, 서버가 재시작되면 접속 중이던 사람의 연결이 잠시 끊겼다 자동으로 다시 붙습니다.
- 옥좌는 황제 역할만 앉을 수 있고, 서버에서도 한 번 더 막습니다.
