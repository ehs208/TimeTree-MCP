# TimeTree MCP Server

[English](README.md) | [한국어](#한국어)

## 한국어

> ⚠️ **면책조항**: 이것은 **개인 사용 전용** **비공식** TimeTree MCP 서버입니다. TimeTree, Inc.와 제휴 관계가 없으며 언제든 작동이 중단될 수 있습니다. 자세한 내용은 [DISCLAIMER.md](DISCLAIMER.md)를 참조하십시오.

Claude를 비롯한 MCP 클라이언트에서 TimeTree 캘린더 데이터를 읽을 수 있도록 하는 비공식 MCP (Model Context Protocol) 서버입니다.

> **크레딧**: 이 프로젝트는 [@eoleedi](https://github.com/eoleedi)의 [TimeTree-Exporter](https://github.com/eoleedi/TimeTree-Exporter)에서 영감을 받았으며 API 분석 결과를 활용했습니다.

### 기능

- 📅 **캘린더 목록** - 모든 TimeTree 캘린더 가져오기
- 📆 **이벤트 조회** - 자동 페이지네이션으로 모든 캘린더 이벤트 조회
- 🔐 **안전한 인증** - 이메일/비밀번호 인증 (MCP 설정에만 저장)
- ⚡ **속도 제한** - Token Bucket 알고리즘으로 API 과부하 방지
- 🔄 **자동 페이지네이션** - 여러 페이지에 걸친 모든 이벤트 자동 조회
- 🛡️ **에러 처리** - 사용자 친화적 메시지와 포괄적인 에러 처리
- 📝 **구조화된 로깅** - 민감한 데이터 마스킹이 포함된 상세 로그

### 요구사항

- Node.js >= 18.0.0
- TimeTree 계정
- MCP 호환 클라이언트 (Claude Desktop, Claude Code, Antigravity, Cline 등)

### 설치

#### 빠른 설치 (권장)

**한 줄 설치** - 자동으로 복제, 빌드, 설정:

```bash
curl -fsSL https://raw.githubusercontent.com/ehs208/TimeTree-MCP/main/TimeTree-MCP-install.sh | bash
```

스크립트가 지원하는 모든 MCP 클라이언트에 대한 설정 방법을 보여줍니다. 사용하는 클라이언트의 설정을 복사하고 TimeTree 인증 정보만 입력하면 됩니다.

**제거:**
```bash
curl -fsSL https://raw.githubusercontent.com/ehs208/TimeTree-MCP/main/TimeTree-MCP-uninstall.sh | bash
```

#### 수동 설치

<details>
<summary>수동 설치 단계 보기</summary>

1. **복제 및 빌드:**

```bash
git clone https://github.com/ehs208/TimeTree-MCP.git
cd TimeTree-MCP
npm install
npm run build
```

2. **설치 방법 선택:**

**옵션 A: 전역 링크 (더 깔끔함)**
```bash
npm link
```

**옵션 B: 직접 실행 (더 간단함)**
```bash
# 추가 단계 없음
```

3. **MCP 클라이언트 설정:**

아래 [설정](#설정) 섹션을 참조하여 사용하는 MCP 클라이언트에 맞게 설정하세요.

</details>

### 설정

#### 지원하는 MCP 클라이언트

<details>
<summary><b>1️⃣ Claude Desktop (macOS)</b></summary>

**파일:** `~/Library/Application Support/Claude/claude_desktop_config.json`

**npm link 사용 시:**
```json
{
  "mcpServers": {
    "timetree": {
      "command": "npx",
      "args": ["timetree-mcp"],
      "env": {
        "TIMETREE_EMAIL": "your-email@example.com",
        "TIMETREE_PASSWORD": "your-password"
      }
    }
  }
}
```

**npm link 미사용 시:**
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

**그 다음:** Claude Desktop 재시작 (Cmd+Q 후 재실행)

</details>

<details>
<summary><b>2️⃣ Claude Desktop (Windows)</b></summary>

**파일:** `%APPDATA%\Claude\claude_desktop_config.json`

**설정:** macOS와 동일 (위 참조)

**그 다음:** Claude Desktop 재시작

</details>

<details>
<summary><b>3️⃣ Claude Code (CLI)</b></summary>

**npm link 사용 시:**
```bash
claude mcp add timetree \
  --env TIMETREE_EMAIL=your@email.com \
  --env TIMETREE_PASSWORD=yourpass \
  -- npx timetree-mcp
```

**npm link 미사용 시:**
```bash
claude mcp add timetree \
  --env TIMETREE_EMAIL=your@email.com \
  --env TIMETREE_PASSWORD=yourpass \
  -- node /absolute/path/to/TimeTree-MCP/dist/index.js
```

</details>

<details>
<summary><b>4️⃣ Google Antigravity</b></summary>

**파일 (Windows):** `C:\Users\<USER_NAME>\.gemini\antigravity\mcp_config.json`
**파일 (macOS/Linux):** `~/.gemini/antigravity/mcp_config.json`

**또는 UI에서:** 우상단 ⋮ 클릭 → MCP Servers → Manage MCP Servers → View raw config

```json
{
  "mcpServers": {
    "timetree": {
      "command": "npx",
      "args": ["timetree-mcp"],
      "env": {
        "TIMETREE_EMAIL": "your-email@example.com",
        "TIMETREE_PASSWORD": "your-password"
      }
    }
  }
}
```

</details>

<details>
<summary><b>5️⃣ VS Code 기반 에디터 (Cline, Cursor, Windsurf 등)</b></summary>

설정 방식은 에디터마다 다를 수 있습니다. 대부분 비슷한 MCP 설정 형식을 사용합니다.

**Cline (VS Code Extension) 예시:**

**파일:** `cline_mcp_settings.json`

```json
{
  "mcpServers": {
    "timetree": {
      "command": "npx",
      "args": ["timetree-mcp"],
      "env": {
        "TIMETREE_EMAIL": "your-email@example.com",
        "TIMETREE_PASSWORD": "your-password"
      }
    }
  }
}
```

**그 다음:** 에디터 창 다시 로드

</details>

<details>
<summary><b>6️⃣ 기타 MCP 클라이언트</b></summary>

대부분의 MCP 클라이언트는 다음 표준 형식을 지원합니다:

```json
{
  "command": "npx",
  "args": ["timetree-mcp"],
  "env": {
    "TIMETREE_EMAIL": "your-email@example.com",
    "TIMETREE_PASSWORD": "your-password"
  }
}
```

</details>

### 사용법

📖 **자세한 사용 예시와 워크플로우는 [COMMANDS.md](COMMANDS.md) 참조**

### MCP Tools

- **list_calendars** - 참여자 정보를 포함한 캘린더 목록 조회
- **get_events** - 자동 페이지네이션으로 캘린더 이벤트 조회

📖 파라미터 및 사용법은 [COMMANDS.md](COMMANDS.md) 참조

### 개발

```bash
# 프로젝트 빌드
npm run build

# Watch 모드 (변경 시 자동 재빌드)
npm run dev
```

### 제한사항

- **읽기 전용**: 현재 캘린더 및 이벤트 읽기만 지원
- **비공식 API**: TimeTree가 내부 API를 변경하면 작동이 중단될 수 있음
- **속도 제한**: 초당 10개 요청 (429 오류 시 자동 재시도)
- **공식 지원 없음**: TimeTree는 이 도구를 공식적으로 지원하지 않음

### 보안

- 인증 정보는 로컬 MCP 설정에**만** 저장됨
- 세션 쿠키는 메모리에만 저장 (디스크에 저장되지 않음)
- 비밀번호와 세션 ID는 로그에서 자동으로 마스킹됨
- 모든 통신은 HTTPS 사용

### 문제 해결

#### "Missing required environment variables" 오류

MCP 설정에 `TIMETREE_EMAIL`과 `TIMETREE_PASSWORD`가 설정되어 있는지 확인하십시오.

#### 인증 실패

- 이메일과 비밀번호가 올바른지 확인
- TimeTree 웹 앱에 로그인할 수 있는지 확인
- TimeTree가 인증 API를 변경했을 수 있음

#### 캘린더나 이벤트가 반환되지 않음

- TimeTree 계정에 캘린더/이벤트가 있는지 확인
- 상세한 에러 메시지는 로그 확인
- API가 변경되었을 수 있음

### 기여

기여를 환영합니다! 다음 단계를 따르십시오:

1. 저장소 포크
2. 기능 브랜치 생성
3. 변경사항 작성
4. Pull Request 제출

### 라이선스

MIT License - 자세한 내용은 [LICENSE](LICENSE) 파일 참조.

### 면책조항

중요한 법적 및 사용 정보는 [DISCLAIMER.md](DISCLAIMER.md)를 참조하십시오.

---

**TIMETREE, INC.와 제휴 관계 없음**

이것은 독립적인 커뮤니티 유지 프로젝트입니다.
