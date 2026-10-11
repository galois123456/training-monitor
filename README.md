# 강화 읽걷쓰 AI 연수 · GitHub + Vercel + Supabase ver1.00

기존 연수생 화면과 관리자 대시보드를 유지한 이전용 프로젝트입니다.
**기존 Supabase `game-classroom` 프로젝트를 그대로 사용합니다. 새 Supabase 프로젝트는 만들지 않습니다.**
연수 사이트용 GitHub 저장소와 Vercel 프로젝트만 별도로 만듭니다. 기존 게임 사이트에 파일을 덮어쓰지 마세요.

## 1. 기존 기능과 변경 사항

| 기존 Apps Script | 이 버전 |
| --- | --- |
| 학교·이름 입력 후 입장 | 동일. 별도 회원가입·이메일 인증 없음 |
| 수행함 / 미완료 / 선택 취소 | 동일. 활동별 마지막 상태 저장 |
| 질문·사진 제출 | 동일. 파일 선택·끌어놓기·붙여넣기 |
| 활동 코드 이전 / 다음 | 동일. DB에 등록한 순서대로 이동 |
| 5초마다 대시보드 동기화 | 동일. 현재 활동의 결과 조회 |
| 구글 시트 | Supabase `training_*` 테이블 |
| 구글 드라이브 사진 폴더 | Supabase `training-photos` 비공개 버킷 |
| 관리자 화면 접근 | 서버에서 비밀번호 확인 추가 |

기본 활동 코드는 GH01~GH10입니다. 원본 활동코드 시트 내용이 제공되지 않아 초기 예제로 넣었습니다.
사진은 브라우저에서 긴 변 1,920px 이하 JPEG로 변환한 후 서버에 보냅니다. 변환 후 2MB 이하입니다. 원본 사진 그대로 보관하는 기능은 아닙니다.
질문은 최대 5,000자이며, 활동이 바뀌어도 작성 중인 텍스트는 해당 활동의 임시 메모로 남습니다. 사진 임시본은 현재 페이지 메모리에만 남으므로 새로고침하면 사라집니다.

## 2. Supabase 설정 — game-classroom에서 실행

1. Supabase 프로젝트 목록에서 **game-classroom**을 누릅니다.
2. 왼쪽 **SQL Editor → New query**를 엽니다.
3. 이 폴더의 `supabase/schema.sql`을 텍스트 편집기로 열고 **전체 내용**을 복사하여 붙여넣습니다.
4. **Run**을 누릅니다.
5. **Table Editor**에서 아래 테이블이 생겼는지 확인합니다.

| 테이블 | 역할 |
| --- | --- |
| training_participants | 연수생 학교·이름 |
| training_activities | 활동 코드와 순서 |
| training_settings | 현재 활동 코드 |
| training_statuses | 연수생별 활동 수행 상태 |
| training_questions | 질문과 사진 경로 |
| training_rate_limits | 과도한 요청·비밀번호 반복 시도 제한 |

SQL은 이 접두사의 테이블·함수와 전용 버킷만 구성합니다. 기존 게임 테이블이나 Supabase Auth 사용자를 삭제하지 않습니다.
`schema.sql`을 다시 실행해도 연수생·수행 기록·질문은 초기화되지 않습니다. 다만 기본 GH01~GH10 중 삭제한 코드는 다시 추가될 수 있습니다.
기존 프로젝트에서 이미 같은 `training_*` 이름을 다른 용도로 쓰고 있다면 실행하기 전에 이름 충돌을 확인하세요.

6. **Storage**에서 `training-photos` 버킷이 생성되었는지 확인합니다. **Public은 꺼진 상태**여야 합니다.
7. 프로젝트 **Connect 또는 Settings의 Data API / API Keys**에서 다음 두 값을 확인합니다. 화면의 메뉴 이름은 Supabase 버전에 따라 다를 수 있습니다.
   - Project URL: `https://프로젝트ID.supabase.co`
   - Secret key: `sb_secret_...` 형식

이 프로젝트는 Supabase Auth 로그인, Anonymous sign-in, Edge Functions, 별도의 CLI 배포를 사용하지 않습니다. 기존 게임의 Auth·Site URL·Redirect URL 설정을 바꿀 필요가 없습니다.
공유 프로젝트에 모든 Storage 버킷을 허용하는 광범위한 기존 정책이 있다면 `training-photos`가 포함되지 않도록 범위를 확인하세요. 이 SQL은 기존 게임용 Storage 정책을 수정하지 않습니다.

## 3. GitHub에 올리기

1. GitHub에서 연수용 새 저장소를 만듭니다. 예: `training-monitor`.
2. ZIP 압축을 풉니다.
3. `training-monitor-ver1.00` **폴더 안의 파일과 폴더**를 새 저장소의 맨 위에 올립니다.
4. 맨 위에 `package.json`, `vercel.json`, `api`, `public`, `supabase`, `scripts`가 보이면 맞습니다.
5. **Commit changes**를 누릅니다.

ZIP 파일 하나만 올리면 배포되지 않습니다. 기존 game-classroom 게임 저장소에 `public`, `api`, `vercel.json`을 덮어쓰지 마세요.
실제 비밀번호·키를 코드나 GitHub에 입력하지 않습니다. `.env.example`에는 예시만 있습니다.

## 4. Vercel에 연결하기

1. Vercel에서 **Add New → Project**를 누릅니다.
2. 방금 만든 GitHub 저장소를 Import합니다.
3. **Framework Preset: Other**를 선택합니다.
4. **Root Directory**는 `package.json`이 있는 위치로 둡니다. GitHub 맨 위에 올렸다면 그대로 둡니다.
5. 아래 설정을 확인합니다. `vercel.json`에 이미 들어 있습니다.
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Node.js: `24.x`
   - Install Command: 기본값
6. **Environment Variables**에 아래 4개를 입력합니다.

| 이름 — 철자 그대로 | 값 |
| --- | --- |
| `SUPABASE_URL` | game-classroom의 Project URL |
| `SUPABASE_SECRET_KEY` | game-classroom의 `sb_secret_...` 키 |
| `ADMIN_PASSWORD` | 직접 정한 관리자 비밀번호, 12자 이상 |
| `SESSION_SECRET` | 직접 생성한 무작위 문자열, 32자 이상 |

`SESSION_SECRET`은 비밀번호 관리기의 48자 이상 무작위 비밀번호 생성 기능으로 만들면 됩니다. 다른 서비스 비밀번호를 재사용하지 마세요.
Secret 키 대신 기존 Legacy `service_role` 키를 쓰려면 변수명을 `SUPABASE_SERVICE_ROLE_KEY`로 사용합니다. 이 경우 `SUPABASE_SECRET_KEY`는 등록하지 않아도 됩니다. `anon` 또는 `sb_publishable_...` 키는 이 서버용 변수에 넣으면 안 됩니다.
서버 전용 키는 RLS를 우회하므로 브라우저 코드에 넣지 않습니다. 이 프로젝트는 Vercel 서버에서만 키를 사용합니다.

7. **Deploy**를 누릅니다.
8. 이후 환경변수를 바꾸면 **Redeploy**합니다.

배포된 Production 주소를 사용하세요. QR 코드 등으로 접속했을 때 Vercel 로그인이 뜨면 프로젝트 **Settings → Deployment Protection**에서 Production 도메인에 걸린 Vercel Authentication을 해제하도록 설정합니다. 연수생이 접근할 수 있는 공개 Production 주소인지 시크릿 창에서 확인합니다.

## 5. 접속 주소와 첫 확인

실제 Vercel 도메인이 `training-monitor.vercel.app`이라고 가정하면 다음과 같습니다. 아래 도메인은 설명용입니다.

| 화면 | 주소 형태 |
| --- | --- |
| 연수생 | `https://실제도메인.vercel.app/` |
| 강사용 | `https://실제도메인.vercel.app/Admin.html` |
| 강사용 짧은 주소 | `https://실제도메인.vercel.app/admin` |
| 구형 파라미터 호환 | `https://실제도메인.vercel.app/?page=Admin` |

1. 강사용 화면에서 Vercel에 넣은 `ADMIN_PASSWORD`를 입력합니다.
2. 다른 브라우저 또는 휴대전화로 연수생 화면을 엽니다.
3. 학교·이름을 입력하고 입장합니다.
4. 수행함을 누르면 관리자 카드가 녹색, 미완료를 누르면 주황색이 됩니다. 선택된 버튼을 다시 누르면 미선택으로 돌아갑니다.
5. 질문을 제출하면 빨간 테두리가 생깁니다. 질문 숫자는 **질문한 연수생 수**이며 질문 건수의 합이 아닙니다. 미선택은 미완료 숫자에 포함되지 않습니다.
6. 관리자가 카드를 누르면 해당 활동의 질문을 볼 수 있습니다. 사진 링크는 로그인한 관리자에게만 열립니다.
7. 다음을 눌러 GH02로 이동하고, 연수생 화면이 약 5초 이내에 바뀌는지 확인합니다. 다시 이전으로 돌아와 GH01 수행 상태가 복원되는지도 확인합니다.
8. 질문/사진 저장 후 새로고침해서 서버 기록을 확인합니다.

## 6. 활동 코드 수정

Supabase **Table Editor → training_activities**에서 수정합니다.
- `code`: GH01, GH02처럼 사용할 활동 코드.
- `sort_order`: 1, 2, 3처럼 이동 순서. 중복되지 않는 정수.
- 활동을 추가하면 별도 사이트 배포 없이 다음 버튼에 반영됩니다.
- 현재 활동은 `training_settings`의 `current_code`에 저장됩니다.
- 기록이 연결된 활동을 삭제하는 대신 계속 보존하는 편이 안전합니다. 외래키 때문에 참조 중인 활동은 바로 삭제되지 않습니다.

## 7. 기존 구글 시트·사진 자료

**이 패키지는 기능 이전용이며 기존 데이터 자동 이관은 포함하지 않습니다.**
지금까지 구글 시트에 쌓인 명단·수행 상태·질문과 Drive 사진은 원래 위치에 그대로 있습니다. 새 사이트에는 앞으로 입력한 내용부터 저장됩니다.
기존 기록까지 이관하려면 각 시트의 CSV와 사진 파일을 별도로 준비하여 필드를 매핑해야 합니다. 원본 Drive 폴더 ID는 새 사이트에서 사용하지 않습니다.

## 8. 운영할 때 알아둘 점

- 원본과 같이 **학교+이름이 같으면 같은 연수생**입니다. 다른 기기에서도 같은 이름으로 이어서 입장할 수 있습니다. 이는 본인 인증이 아니므로 다른 사람이 학교·이름을 알고 입력하면 수행 상태를 바꿀 수 있습니다. 관리자 명단·전체 질문·사진은 관리자 로그인으로 별도 보호합니다. 고부담 평가나 엄격한 본인 확인에는 이 입장 방식을 쓰지 마세요.
- 관리자 세션은 12시간, 연수생 세션은 30일입니다. 학교·이름 입력칸은 기기에 기억됩니다.
- 관리자 비밀번호를 변경하고 재배포하면 기존 관리자 세션이 무효화됩니다.
- 이 버전은 하나의 연수를 기준으로 합니다. 학교·이름이 같은 사람은 중복 생성되지 않으며, 여러 독립 연수를 동시에 구분하는 방 기능은 없습니다.
- 네트워크 실패 시 저장 성공으로 표시하지 않습니다. 질문 제출 재시도는 같은 제출 번호로 처리하여 중복을 줄입니다.
- 업로드 성공 직후 DB 저장이 실패하면 연결되지 않은 사진이 남을 수 있습니다. 같은 제출을 재시도하면 같은 경로를 재사용합니다. 취소된 실패 업로드 정리는 Storage에서 관리자가 확인합니다.
- 접속자 100명이 계속 화면을 보고 있으면 연수생 동기화만 약 20 API 요청/초가 발생합니다. 관리자 동기화·저장은 추가됩니다. 실제 동시접속 부하 시험은 수행하지 않았으며 무료 한도·성능을 보장하지 않습니다. 같은 Supabase 프로젝트의 기존 게임도 자원을 공유합니다.
- 숨겨진 탭은 주기적 조회를 쉬고 다시 보이면 동기화합니다.

## 9. 오류가 뜰 때

| 현상 | 확인할 것 |
| --- | --- |
| 서버 환경변수 설정 오류 | 변수 4개, 비밀번호 12자/비밀문자열 32자, 재배포 여부 |
| 서버 저장·조회 실패 | game-classroom에 schema.sql 전체 실행 여부, URL·Secret 키의 프로젝트 일치 여부 |
| 사진만 실패 | Storage 버킷 생성 여부, 사진 파일 형식·크기 |
| Vercel 로그인 요구 | Production 주소와 Deployment Protection 설정 |
| 관리자 로그인 제한 | 같은 IP에서 15분 동안 10회 시도 제한. 시간 후 재시도 |
| API가 404 | ZIP만 올리지 않았는지, 저장소 루트에 api/training.js가 있는지 |
| 화면은 열리지만 저장 안 됨 | HTML 더블클릭/GitHub Pages로 열지 않았는지. Vercel API가 필요함 |

## 10. 개발·검증

추가 npm 라이브러리 없이 Node 내장 기능으로 작동합니다. 스타일도 포함되어 외부 Tailwind CDN에 의존하지 않습니다.

```bash
npm run build
npm test
```

로컬 실행은 `.env.example`을 `.env`로 복사해 실제 값을 입력한 후 `npm run dev`로 시작합니다. `.env`는 Git에 올리지 않습니다.

제작 시 JavaScript 문법 검사, 정적 빌드, 모의 Supabase 응답을 이용한 API 테스트 15개를 통과했습니다. 테스트는 인증 분리·쿠키 위변조·수행 상태·중복 제출·사진 업로드·관리자 코드 변경·오류 처리를 확인합니다.
실제 game-classroom DB에 SQL을 실행하거나 Vercel에 배포하지 않았으며, 실제 DB 연동·브라우저 시각 검증·동시접속 검증은 아직 수행하지 않았습니다. 위 5번으로 배포 후 확인하세요.

## 공식 문서

- Vercel 함수와 설정: https://vercel.com/docs/project-configuration/vercel-json
- Vercel 함수 제한: https://vercel.com/docs/functions/limitations
- Vercel 접근 보호: https://vercel.com/docs/deployment-protection
- Supabase API 키: https://supabase.com/docs/guides/getting-started/api-keys
- Supabase RLS: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase Storage: https://supabase.com/docs/guides/storage/security/access-control
