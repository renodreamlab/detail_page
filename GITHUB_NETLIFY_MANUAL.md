# GitHub + Netlify 배포 간단 매뉴얼

## 1. GitHub에 업로드

현재 폴더에서 Git 저장소를 만들고 GitHub에 올립니다.

```bash
git init
git add .
git commit -m "Initial deploy"
git branch -M main
git remote add origin https://github.com/내아이디/phoenix-detail-page.git
git push -u origin main
```

GitHub에서 먼저 빈 저장소를 만든 뒤, 위 명령의 `내아이디/phoenix-detail-page` 부분만 본인 저장소 주소로 바꿔서 실행하면 됩니다.

## 2. Netlify에서 GitHub 저장소 연결

1. Netlify 접속
2. `Add new project` 선택
3. `Import an existing project` 선택
4. GitHub 연결
5. 방금 올린 `phoenix-detail-page` 저장소 선택

## 3. Netlify 빌드 설정

Netlify가 자동 감지하지 못하면 아래처럼 설정합니다.

```txt
Build command: npm run build
Publish directory: .next
Base directory: 비워둠
```

## 4. 환경변수 등록

Netlify 프로젝트 설정에서 아래로 이동합니다.

```txt
Project configuration > Environment variables
```

다음 값을 등록합니다.

```txt
OPENAI_API_KEY=본인 OpenAI API 키
GOOGLE_API_KEY=본인 Google API 키
DATABASE_URL=Neon Postgres 연결 주소
OPENAI_ANALYSIS_MODEL=gpt-5.5
OPENAI_ANALYSIS_TIMEOUT_MS=20000
OPENAI_IMAGE_MODEL=gpt-image-2
OPENAI_IMAGE_SIZE=1024x1536
OPENAI_IMAGE_QUALITY=high
OPENAI_IMAGE_FALLBACK_QUALITY=medium
OPENAI_IMAGE_PARTIAL_IMAGES=1
OPENAI_IMAGE_HIGH_TIMEOUT_MS=240000
OPENAI_IMAGE_FALLBACK_TIMEOUT_MS=240000
KNOWLEDGE_ACCESS_KEYS=사용자접근키
KNOWLEDGE_ADMIN_KEY=관리자등록키
```

`DATABASE_URL`, `KNOWLEDGE_ACCESS_KEYS`, `KNOWLEDGE_ADMIN_KEY`는 공통 지식 RAG 기능을 쓸 때 필요합니다. 우선 이미지 생성 기능만 테스트할 경우 OpenAI/Google 키부터 등록해도 됩니다.

## 5. 배포 실행

설정을 저장하면 Netlify가 자동으로 빌드와 배포를 시작합니다.

이후 GitHub의 `main` 브랜치에 새 커밋을 push하면 Netlify가 자동으로 다시 배포합니다.

```bash
git add .
git commit -m "Update site"
git push
```

## 6. 주의사항

- `.env` 파일은 GitHub에 올리지 않습니다.
- 실제 API 키는 Netlify 환경변수에만 넣습니다.
- 큰 PDF나 큰 이미지는 Netlify 함수 요청 용량 제한에 걸릴 수 있습니다.
- 이미지 생성이 오래 걸리면 서버리스 함수 제한 시간 때문에 실패할 수 있습니다.

## 7. 로컬 확인

배포 전 로컬에서 확인하려면 아래 명령을 사용합니다.

```bash
npm install
npm run build
npm run dev:local
```

로컬 주소:

```txt
http://localhost:3002/
```
