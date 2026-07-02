# OpenClaw Agent + Telegram Bot + GitHub + Netlify 운영 매뉴얼

이 문서는 `phoenix detail page` 상세페이지 프로젝트를 텔레그램 봇으로 지시하고, OpenClaw 에이전트가 코드 수정, GitHub 업로드, Netlify 배포까지 처리하는 운영 방법을 정리한 간단 매뉴얼입니다.

## 1. 추천 운영 구조

가장 안정적인 흐름은 아래 방식입니다.

```txt
Telegram Bot
  -> OpenClaw Agent 실행 서버 또는 로컬 PC
  -> 현재 프로젝트 폴더 코드 수정
  -> GitHub main 브랜치에 push
  -> Netlify가 GitHub 변경 감지 후 자동 배포
```

이 방식의 장점은 Netlify 배포를 직접 명령하지 않아도 GitHub push만으로 자동 배포가 된다는 점입니다.

## 2. 가능한 방식 3가지

## 방식 A. GitHub push 기반 자동 배포

가장 추천하는 방식입니다.

1. OpenClaw 에이전트가 코드를 수정합니다.
2. 로컬에서 `npm run build`를 실행해 검증합니다.
3. GitHub에 commit/push 합니다.
4. Netlify가 GitHub 저장소 변경을 감지해 자동 배포합니다.

필요한 것:

```txt
GitHub 저장소
Netlify GitHub 연동
OpenClaw 에이전트가 접근 가능한 프로젝트 폴더
Telegram Bot Token
허용된 Telegram Chat ID
```

## 방식 B. Telegram 명령으로 Netlify CLI 직접 배포

OpenClaw 에이전트가 Netlify CLI까지 실행하는 방식입니다.

```bash
npm run build
netlify deploy --prod
```

이 방식은 빠르지만 Netlify 토큰을 에이전트 실행 환경에 저장해야 하므로 보안 관리가 더 중요합니다.

필요한 것:

```txt
NETLIFY_AUTH_TOKEN
NETLIFY_SITE_ID
Netlify CLI
```

## 방식 C. GitHub Actions 또는 Netlify Build Hook 호출

텔레그램 명령을 받으면 OpenClaw가 GitHub Actions workflow나 Netlify Build Hook을 호출하는 방식입니다.

예시 흐름:

```txt
Telegram 명령
  -> OpenClaw가 GitHub에 push
  -> GitHub Actions 또는 Netlify Build Hook 실행
  -> Netlify 배포
```

자동화가 많아질수록 이 방식이 관리하기 좋습니다.

## 3. 기본 준비물

## GitHub

GitHub에 빈 저장소를 만듭니다.

예시 저장소명:

```txt
phoenix-detail-page
```

현재 폴더에서 최초 업로드:

```bash
git init
git add .
git commit -m "Initial deploy"
git branch -M main
git remote add origin https://github.com/내아이디/phoenix-detail-page.git
git push -u origin main
```

## Netlify

Netlify에서 GitHub 저장소를 연결합니다.

빌드 설정:

```txt
Build command: npm run build
Publish directory: .next
Base directory: 비워둠
```

환경변수:

```txt
OPENAI_API_KEY
GOOGLE_API_KEY
DATABASE_URL
OPENAI_ANALYSIS_MODEL
OPENAI_ANALYSIS_TIMEOUT_MS
OPENAI_IMAGE_MODEL
OPENAI_IMAGE_SIZE
OPENAI_IMAGE_QUALITY
OPENAI_IMAGE_FALLBACK_QUALITY
OPENAI_IMAGE_PARTIAL_IMAGES
OPENAI_IMAGE_HIGH_TIMEOUT_MS
OPENAI_IMAGE_FALLBACK_TIMEOUT_MS
KNOWLEDGE_ACCESS_KEYS
KNOWLEDGE_ADMIN_KEY
```

`.env` 파일은 GitHub에 올리지 않습니다. 실제 키는 Netlify 환경변수에만 등록합니다.

## Telegram Bot

1. 텔레그램에서 `@BotFather`를 엽니다.
2. `/newbot`으로 새 봇을 만듭니다.
3. 발급받은 Bot Token을 저장합니다.
4. 본인 Telegram Chat ID를 확인합니다.

운영 환경에는 아래 값이 필요합니다.

```txt
TELEGRAM_BOT_TOKEN=텔레그램 봇 토큰
TELEGRAM_ALLOWED_CHAT_ID=내 채팅 ID
```

허용된 Chat ID가 아닌 사용자의 명령은 무시하도록 구성해야 합니다.

## OpenClaw Agent 실행 환경

OpenClaw 에이전트는 아래 작업을 할 수 있어야 합니다.

```txt
프로젝트 폴더 읽기/쓰기
npm install
npm run build
git status / add / commit / push
선택 사항: netlify deploy
```

Windows 로컬 PC에서 운영한다면 프로젝트 경로는 현재 폴더입니다.

```txt
C:\codex\agent\phoenix detail page
```

## 4. Telegram 명령 설계

봇 명령은 너무 자유롭게 열어두지 말고, 안전한 명령만 허용하는 것이 좋습니다.

추천 명령:

```txt
/status
/change 요청내용
/build
/commit 커밋메시지
/push
/deploy
/logs
```

예시:

```txt
/change 메인 화면의 앱 이름을 phoenix detail page로 더 크게 보여줘
```

```txt
/build
```

```txt
/commit Rename app branding
```

```txt
/push
```

## 5. 권장 승인 흐름

완전 자동으로 바로 push/deploy하지 말고 아래 흐름을 추천합니다.

```txt
1. 사용자가 Telegram으로 수정 요청
2. OpenClaw가 코드 수정
3. OpenClaw가 변경 파일 목록과 요약을 Telegram으로 전송
4. 사용자가 /build 실행
5. 빌드 성공 시 /commit 실행
6. 사용자가 /push 실행
7. Netlify 자동 배포
```

이 구조면 실수로 API 키나 깨진 코드가 배포되는 일을 줄일 수 있습니다.

## 6. OpenClaw 에이전트 프롬프트 예시

OpenClaw 에이전트에 아래 역할을 부여합니다.

```txt
너는 phoenix detail page 프로젝트의 코딩/배포 에이전트다.

규칙:
1. 모든 작업은 C:\codex\agent\phoenix detail page 폴더에서 수행한다.
2. 사용자가 Telegram으로 요청한 범위만 수정한다.
3. .env, API 키, 토큰, 비밀번호는 절대 GitHub에 올리지 않는다.
4. 수정 후 npm run build를 실행해 검증한다.
5. 빌드 실패 시 commit/push/deploy를 하지 않는다.
6. GitHub push 또는 Netlify deploy 전에는 사용자 승인 명령을 기다린다.
7. 결과는 Telegram에 짧게 요약한다.
```

## 7. GitHub 업로드 명령

처음 한 번:

```bash
git init
git add .
git commit -m "Initial deploy"
git branch -M main
git remote add origin https://github.com/내아이디/phoenix-detail-page.git
git push -u origin main
```

이후 수정 때마다:

```bash
git status
npm run build
git add .
git commit -m "Update phoenix detail page"
git push
```

## 8. Netlify 배포 명령

GitHub 자동 배포를 쓰면 보통 직접 실행할 필요가 없습니다.

Netlify CLI로 직접 배포할 경우:

```bash
npm install -g netlify-cli
netlify login
npm run build
netlify deploy --prod
```

CI나 서버에서 실행할 경우:

```bash
netlify deploy --prod --dir=.next --site=$NETLIFY_SITE_ID --auth=$NETLIFY_AUTH_TOKEN
```

단, Next.js 프로젝트는 Netlify Git 연동으로 배포하는 편이 더 안전합니다.

## 9. 보안 체크리스트

반드시 지킬 것:

```txt
.env 파일 GitHub 업로드 금지
Telegram Bot Token GitHub 업로드 금지
Netlify Auth Token GitHub 업로드 금지
GitHub Personal Access Token GitHub 업로드 금지
허용된 Telegram Chat ID만 명령 실행
push/deploy 전 사용자 승인
```

확인 명령:

```bash
git status
git diff --cached
```

실수로 `.env`가 올라갈 것 같으면 즉시 중단합니다.

## 10. 추천 파일 구성

자동화 서버를 별도로 만든다면 이런 구성이 좋습니다.

```txt
automation/
  telegram-bot.js
  agent-runner.js
  deploy-runner.js
  .env
```

단, 이 자동화 파일을 현재 Next.js 앱 안에 넣을지, 별도 private 저장소로 둘지는 운영 방식에 따라 결정합니다.

추천은 별도 private 저장소입니다. 이유는 Telegram/Netlify/GitHub 토큰을 다루는 코드와 공개 웹앱 코드를 분리할 수 있기 때문입니다.

## 11. 운영 예시

텔레그램에서:

```txt
/change Netlify 배포용 안내 문구를 더 짧게 정리해줘
```

에이전트 응답:

```txt
수정 완료.
변경 파일:
- README.md
- GITHUB_NETLIFY_MANUAL.md

빌드하려면 /build 를 입력하세요.
```

텔레그램에서:

```txt
/build
```

에이전트 응답:

```txt
빌드 성공.
커밋하려면 /commit Update deploy guide 를 입력하세요.
```

텔레그램에서:

```txt
/commit Update deploy guide
/push
```

에이전트 응답:

```txt
GitHub push 완료.
Netlify 자동 배포가 시작됩니다.
```

## 12. 주의사항

이 프로젝트는 이미지 생성 API와 PDF 변환을 사용합니다. 작은 파일 테스트는 문제없지만, 큰 PDF나 긴 이미지 생성 작업은 Netlify 서버리스 함수의 용량/시간 제한에 걸릴 수 있습니다.

운영 안정성을 높이려면:

```txt
작은 파일부터 테스트
생성 장수는 1장부터 테스트
Netlify 빌드 로그 확인
실패 로그를 Telegram으로 요약 전송
```

## 13. 참고 공식 문서

- Telegram Bot API: https://core.telegram.org/bots/api
- GitHub CLI: https://cli.github.com/manual/
- Netlify Next.js: https://docs.netlify.com/build/frameworks/framework-setup-guides/nextjs/overview/
- Netlify CLI deploy: https://cli.netlify.com/commands/deploy/
- Netlify environment variables: https://docs.netlify.com/build/configure-builds/environment-variables/
