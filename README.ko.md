# TimeTree MCP Server

[English](README.md) | [한국어](#한국어) | [日本語](README.ja.md)

## 한국어

> ⚠️ **면책조항**: 이것은 **개인 사용 전용** **비공식** TimeTree MCP 서버입니다. TimeTree, Inc.와 제휴 관계가 없으며 언제든 작동이 중단될 수 있습니다. 자세한 내용은 [DISCLAIMER.md](DISCLAIMER.md)를 참조하십시오.

Claude, Codex, Cursor, Windsurf 같은 MCP 클라이언트에서 TimeTree 캘린더, 일정, 메모, 댓글, 라벨, 멤버 정보를 로컬로 읽고 관리할 수 있게 해주는 비공식 MCP (Model Context Protocol) 서버입니다. 인증 정보는 MCP 클라이언트 설정에만 저장합니다.

> **크레딧**: 이 프로젝트는 [@eoleedi](https://github.com/eoleedi)의 [TimeTree-Exporter](https://github.com/eoleedi/TimeTree-Exporter)에서 영감을 받았으며 API 분석 결과를 활용했습니다.

### 기능

- 📅 **캘린더 목록** - 모든 TimeTree 캘린더 가져오기
- 📆 **이벤트 조회** - 자동 페이지네이션으로 캘린더 이벤트 조회
- ➕ **이벤트 생성** - 캘린더에 새 이벤트 추가
- ✏️ **이벤트 수정** - 기존 이벤트 수정
- 🗑️ **이벤트 삭제** - 캘린더에서 이벤트 제거
- 🗒️ **메모 관리** - TimeTree 메모 조회, 생성, 수정, 삭제
- 💬 **댓글 관리** - 이벤트 댓글 추가, 조회, 수정, 삭제
- 🏷️ **캘린더 메타데이터** - 라벨 조회/수정 및 멤버/가상 멤버 조회
- 🔐 **안전한 인증** - 이메일/비밀번호 인증 (MCP 설정에만 저장)
- ⚡ **속도 제한** - Token Bucket 알고리즘으로 API 과부하 방지
- 🔄 **자동 페이지네이션** - 여러 페이지에 걸친 모든 이벤트 자동 조회
- 🛡️ **에러 처리** - 사용자 친화적 메시지와 포괄적인 에러 처리
- 📝 **구조화된 로깅** - 민감한 데이터 마스킹이 포함된 상세 로그

### 요구사항

- Node.js >= 22
- Git (설치용)
- TimeTree 계정
- MCP 호환 클라이언트 (Claude Desktop, Claude Code, Codex, Antigravity, Cline 등)

### 설치

#### 🚀 에이전트를 위한 빠른 설치

Codex, Claude Code 같은 코딩 에이전트에게 아래 프롬프트를 입력하세요:

> `https://github.com/ehs208/TimeTree-MCP`를 클론하고, 클론한 디렉토리 안에서 `npm ci && npm run build`를 실행한 뒤, 내 MCP 클라이언트에 `timetree` 서버를 추가해줘. 실행 명령은 `node /absolute/path/to/TimeTree-MCP/dist/index.js` 형태로 실제 clone 경로를 사용하고, `TIMETREE_EMAIL`과 `TIMETREE_PASSWORD`는 MCP 클라이언트의 환경변수 설정에만 저장하며 절대 코드나 로그에 직접 쓰지 마.

도움이 됐다면 GitHub star로 응원해주세요: https://github.com/ehs208/TimeTree-MCP

#### 빠른 설치 (권장)

**한 줄 설치** - 자동으로 복제, 빌드, 선택적 `npm link` 시도 후 클라이언트 설정 예시를 출력:

```bash
curl -fsSL https://raw.githubusercontent.com/ehs208/TimeTree-MCP/main/TimeTree-MCP-install.sh | bash
```

이 프로젝트는 npm registry가 아니라 GitHub clone 기준으로 설치합니다. 스크립트가 로컬 clone을 빌드하고 선택적으로 `npm link`를 실행한 뒤, 절대 `node`/`dist/index.js` 경로를 사용하는 MCP 클라이언트 설정 예시를 보여줍니다. 사용하는 클라이언트의 설정을 복사하고 TimeTree 인증 정보만 입력하면 됩니다.

#### 수동 설치

<details>
<summary>수동 설치 단계 보기</summary>

1. **복제 및 빌드:**

```bash
git clone https://github.com/ehs208/TimeTree-MCP.git
cd TimeTree-MCP
npm ci
npm run build
```

2. **MCP 클라이언트 설정:**

아래 [설정](#설정) 섹션을 참조하여 사용하는 MCP 클라이언트에 맞게 설정하세요.

</details>

### 설정

**빠른 예시 (Claude Desktop - macOS):**

`~/Library/Application Support/Claude/claude_desktop_config.json` 파일 수정:

```json
{
  "mcpServers": {
    "timetree": {
      "command": "node",
      "args": ["/absolute/path/to/TimeTree-MCP/dist/index.js"],
      "env": {
        "TIMETREE_EMAIL": "your-email@example.com",
        "TIMETREE_PASSWORD": "your-password"
      }
    }
  }
}
```

경로를 실제 clone 경로로 바꾸세요. GUI 클라이언트가 `node`를 찾지 못하면 `command -v node` 결과의 절대경로를 `command`로 사용하세요. 그 다음 Claude Desktop을 재시작하세요 (Cmd+Q로 종료 후 재실행).

📖 **모든 MCP 클라이언트 설정 (Claude Desktop Windows, Claude Code CLI, Codex, Antigravity, VS Code 에디터 등):**
→ 자세한 설정 방법은 **[docs/MCP_CLIENTS.md](docs/MCP_CLIENTS.md)** 참조

### 업데이트

최신 버전으로 업데이트하려면:

```bash
cd /path/to/TimeTree-MCP  # 또는 설치 경로
git pull origin main
npm ci
npm run build
```

그 다음 MCP 클라이언트를 재시작하세요.

📖 **자세한 업데이트 방법 및 문제 해결:**
→ **[docs/UPDATING.md](docs/UPDATING.md)** 참조

### 사용법

📖 **자세한 사용 예시와 워크플로우는 [COMMANDS.md](COMMANDS.md) 참조**

### MCP 도구

- **list_calendars** - 참여 중인 사용자와 함께 모든 캘린더 조회
- **get_events** - 자동 페이지네이션으로 캘린더 이벤트 조회
- **get_updated_events** - 특정 시간 이후 업데이트된 이벤트 조회 (효율적인 증분 동기화)
- **create_event** - 캘린더에 새 이벤트 생성 (알림, 반복, 참석자, 체크리스트 지원)
- **update_event** - 기존 이벤트 수정
- **delete_event** - 캘린더에서 이벤트 삭제
- **list_memos / create_memo / update_memo / delete_memo** - TimeTree 메모 관리
- **add_event_comment / list_event_comments / update_event_comment / delete_event_comment** - 이벤트 댓글 관리
- **get_calendar_labels / update_calendar_labels** - 캘린더 라벨 조회 또는 병합 업데이트
- **get_calendar_members / get_calendar_virtual_members** - 캘린더 멤버 메타데이터 조회

📖 파라미터와 사용 세부사항은 [COMMANDS.md](COMMANDS.md) 참조

### 개발

```bash
# 프로젝트 빌드
npm run build

# Watch 모드 (변경사항 자동 재빌드)
npm run dev
```

### 제한사항

- **비공식 API**: TimeTree가 내부 API를 변경하면 작동이 중단될 수 있습니다
- **속도 제한**: 초당 10개 요청 (429 에러 시 자동 재시도)
- **공식 지원 없음**: TimeTree는 이 도구를 공식적으로 지원하지 않습니다
- **CSRF 토큰 필요**: 쓰기 작업은 CSRF 토큰 필요 (TimeTree 웹페이지에서 자동 추출)

### 보안

- 인증 정보는 **오직** 로컬 MCP 설정에만 저장됩니다
- 세션 쿠키는 메모리에만 저장 (디스크에 저장되지 않음)
- 비밀번호와 세션 ID는 로그에서 자동으로 마스킹됩니다
- 모든 통신은 HTTPS를 사용합니다

### 문제 해결

#### "Missing required environment variables" 오류

MCP 설정에 `TIMETREE_EMAIL`과 `TIMETREE_PASSWORD`가 설정되어 있는지 확인하세요.

#### 인증 실패

- 이메일과 비밀번호가 올바른지 확인하세요
- TimeTree 웹 앱에 로그인할 수 있는지 확인하세요
- TimeTree가 인증 API를 변경했을 수 있습니다

#### 캘린더나 이벤트가 반환되지 않음

- TimeTree 계정에 캘린더/이벤트가 있는지 확인하세요
- 자세한 오류 메시지는 로그를 확인하세요
- API가 변경되었을 수 있습니다

### 기여

기여를 환영합니다! 다음 절차를 따라주세요:

1. 저장소 포크
2. 기능 브랜치 생성
3. 변경사항 작성
4. Pull Request 제출

### 라이선스

MIT License - 자세한 내용은 [LICENSE](LICENSE) 파일 참조

### 프로젝트 응원

이 프로젝트가 도움이 되었다면 GitHub Star를 눌러주세요. 다른 사용자가 프로젝트를 찾는 데 도움이 됩니다.

### 면책조항

중요한 법적 및 사용 정보는 [DISCLAIMER.md](DISCLAIMER.md) 참조

---

**TIMETREE, INC.와 제휴 관계가 없습니다**

이것은 독립적이고 커뮤니티가 유지관리하는 프로젝트입니다.
