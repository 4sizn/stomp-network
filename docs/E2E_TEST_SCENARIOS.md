# STOMP Network Controller E2E 테스트 시나리오

## 📋 개요

이 문서는 STOMP Network Controller와 TopicPlugin의 E2E 테스트 시나리오를 정의합니다. 각 시나리오는 실제 사용자 동작을 기반으로 하며, 자동화 테스트 작성 시 참고할 수 있도록 구성되었습니다.

**테스트 페이지**: `/test/stomp`

---

## 🎯 테스트 환경 설정

### 사전 조건
- [ ] 서버가 실행 중이어야 함
- [ ] WebSocket URL이 올바르게 설정되어 있어야 함
- [ ] 유효한 인증 토큰이 설정되어 있어야 함

### 테스트 데이터
```javascript
const TEST_CONFIG = {
  // 유효한 토픽들 (권한 있음)
  validTopics: {
    common: "/topic/common/broadcast",
    controls: "/user/direct",
    publicUser: "/topic/public/user/rfice-21"
  },
  
  // 무효한 토픽들 (권한 없음 또는 존재하지 않음)
  invalidTopics: {
    unauthorized: "/topic/admin/private",
    nonexistent: "/topic/does/not/exist",
    malformed: "invalid-topic-format",
    test: "/topic/test"
  },
  
  // 메시지 전송 목적지
  destinations: {
    echo: "/app/echo",
    test: "/app/test"
  },
  
  // 테스트 메시지
  testMessage: "Hello World Test Message",
};
```

---

## 🔧 레거시 모드 테스트 시나리오

### TC-L001: 기본 연결 및 해제
**목적**: 기본적인 연결/해제 기능 검증

#### 테스트 단계
1. **Given**: 페이지 로드 완료
2. **When**: "🔧 레거시 모드" 선택
3. **Then**: 
   - [ ] 자동으로 서버 연결 시도
   - [ ] 연결 상태가 "연결됨 🟢"으로 표시
   - [ ] 런타임상 consumer에 기재된 `/topic/common/broadcast` 자동 구독 확인
   - [ ] 연결 로그에 성공 메시지 표시

4. **When**: "연결 해제" 버튼 클릭
5. **Then**:
   - [ ] 연결 상태가 "연결 안됨 🔴"으로 변경
   - [ ] 모든 구독이 해제됨
   - [ ] 연결 로그에 해제 메시지 표시

**예상 결과**: 정상적인 연결/해제 동작

---

### TC-L002: 토픽 구독 및 해제
**목적**: 레거시 모드에서의 토픽 구독 기능 검증

#### 테스트 단계
1. **Given**: 레거시 모드에서 연결 완료
2. **When**: 토픽 입력란에 `TEST_CONFIG.validTopics.controls` (`/user/direct`) 입력 후 "구독" 버튼 클릭
3. **Then**:
   - [ ] "구독 중인 토픽" 목록에 `/user/direct` 추가
   - [ ] 레거시 컨트롤러 구독 정보에 토픽 표시 (✅ 활성)
   - [ ] 연결 로그에 구독 성공 메시지

4. **When**: 해당 토픽의 "구독 해제" 버튼 클릭
5. **Then**:
   - [ ] 구독 목록에서 토픽 제거
   - [ ] 연결 로그에 구독 해제 메시지

**예상 결과**: 토픽 구독/해제가 정상 동작

---

### TC-L003: 메시지 송수신
**목적**: 레거시 모드에서의 메시지 송수신 검증

#### 테스트 단계
1. **Given**: 레거시 모드에서 `TEST_CONFIG.invalidTopics.test` (`/topic/test`) 구독 시도
2. **When**: 
   - Destination에 `TEST_CONFIG.destinations.echo` (`/app/echo`) 입력
   - 메시지 내용에 `TEST_CONFIG.testMessage` ("Hello World Test Message") 입력
   - "전송" 버튼 클릭
3. **Then**:
   - [ ] 연결 로그에 구독 실패 메시지 표시
   - [ ] 연결 로그에 메시지 전송 실패 로그
   - [ ] 적절한 에러 메시지 표시

**예상 결과**: 유효하지 않은 토픽 구독과 메시지 전송으로 Stomp Error 발생

---

### TC-L004: 연결 끊김 및 재연결
**목적**: 네트워크 불안정 상황에서의 동작 검증

#### 테스트 단계
1. **Given**: 레거시 모드에서 연결 및 구독 완료
2. **When**: 네트워크 연결 차단 (개발자 도구에서 Offline 모드)
3. **Then**:
   - [ ] 연결 상태가 "재연결 중 🟠"으로 변경
   - [ ] 재연결 시도 횟수 표시
   - [ ] 재연결 진행률 표시

4. **When**: 네트워크 연결 복원
5. **Then**:
   - [ ] 연결 상태가 "연결됨 🟢"으로 복원
   - [ ] 기본 토픽 자동 재구독

**예상 결과**: 자동 재연결 및 기본 토픽 복원

---

## 🔌 플러그인 모드 테스트 시나리오

### TC-P001: 플러그인 모드 기본 동작
**목적**: TopicPlugin의 기본 동작 검증

#### 테스트 단계
1. **Given**: 페이지 로드 완료
2. **When**: "🔌 플러그인 모드" 선택
3. **Then**:
   - [ ] 자동으로 서버 연결 시도
   - [ ] TopicPlugin 섹션 표시
   - [ ] 미리 등록된 구독 토픽들 확인:
     - `/topic/common/broadcast`
     - `/topic/system/notifications` (invalid token)

**예상 결과**: TopicPlugin이 정상 초기화됨

---

### TC-P002: 연결 전 토픽 등록
**목적**: 연결 전에 토픽을 등록하는 기능 검증

#### 테스트 단계
1. **Given**: 플러그인 모드 선택 (연결 전 상태)
2. **When**: "연결 해제" 버튼으로 연결 해제
3. **When**: TopicPlugin 테스트 섹션에서:
   - 토픽: `TEST_CONFIG.validTopics.publicUser` (`/topic/public/user/rfice-21`) 입력
   - "플러그인 구독" 버튼 클릭
4. **Then**:
   - [ ] 플러그인 구독 토픽 목록에 토픽 추가
   - [ ] 상태: "❌ 비활성" 표시

5. **When**: "연결" 버튼 클릭
6. **Then**:
   - [ ] 연결 완료 후 토픽 상태가 "✅ 활성"으로 변경
   - [ ] 모든 등록된 토픽들이 자동으로 구독됨

**예상 결과**: 연결 전 등록된 토픽이 연결 후 자동 활성화

---

### TC-P003: Authorization 헤더 변경 시 구독 복원
**목적**: Authorization 헤더가 변경되어도 구독이 자동 복원되는지 검증

#### 테스트 단계
1. **Given**: 플러그인 모드에서 연결 완료
2. **When**: 구독 등록
   - 토픽: `TEST_CONFIG.validTopics.publicUser` (`/topic/public/user/rfice-21`) 입력
   - "플러그인 구독" 버튼 클릭
3. **When**: 추가 구독 등록
   - 토픽: `TEST_CONFIG.validTopics.controls` (`/user/direct`) 입력
   - "플러그인 구독" 버튼 클릭
4. **Then**:
   - [ ] 두 토픽 모두 "✅ 활성" 상태
   - [ ] 메시지 수신 가능 확인

5. **When**: Authorization 헤더 변경
   - JWT Authorization Token 텍스트 영역에 새로운 토큰 입력
   - "수정하기" 버튼 클릭
6. **Then**:
   - [ ] 자동으로 재연결 시도
   - [ ] 모든 구독 토픽이 자동으로 "✅ 활성" 상태로 복원
   - [ ] 새로운 인증 정보로 메시지 수신 가능

**예상 결과**: 인증 헤더 변경에도 불구하고 모든 구독이 자동 복원됨

---

### TC-P004: 플러그인 메시지 수신
**목적**: TopicPlugin을 통한 메시지 수신 기능 검증

#### 테스트 단계
1. **Given**: 플러그인 모드에서 `TEST_CONFIG.validTopics.publicUser` (`/topic/public/user/rfice-21`) 구독 완료
2. **When**: 해당 토픽의 "메시지 듣기" 버튼 클릭
3. **When**: 메시지 전송
   - Destination: `TEST_CONFIG.destinations.test` (`/app/test`)
   - 메시지: "Plugin Test Message"
   - "전송" 버튼 클릭
4. **Then**:
   - [ ] 수신 메시지 영역에 "🔌 [/topic/public/user/rfice-21] Plugin Test Message" 형태로 표시
   - [ ] 타임스탬프와 함께 표시

**예상 결과**: TopicPlugin을 통한 메시지 수신이 정상 동작

---

## ⚠️ 에러 시나리오 테스트

### TC-E001: 권한 거부 에러
**목적**: 구독 권한이 없는 토픽에 대한 에러 처리 검증

#### 테스트 단계
1. **Given**: 플러그인 모드에서 연결 완료
2. **When**: 권한이 없는 토픽 구독 시도
   - 토픽: `TEST_CONFIG.invalidTopics.unauthorized` (`/topic/admin/private`) 입력
   - "플러그인 구독" 버튼 클릭
3. **Then**:
   - [ ] 연결 상태가 "실패 ❌"로 변경 (또는 구독 에러 발생)
   - [ ] 에러 로그에 "access denied" 메시지 표시
   - [ ] 해당 토픽이 비활성 상태로 표시

**예상 결과**: 권한 에러가 적절히 처리됨

---

### TC-E002: 네트워크 에러 처리
**목적**: 네트워크 연결 실패 시의 동작 검증

#### 테스트 단계
1. **Given**: 잘못된 WebSocket URL 설정
2. **When**: 연결 시도
3. **Then**:
   - [ ] 연결 상태가 "실패 ❌"로 표시
   - [ ] 재연결 시도 시작
   - [ ] 최대 재연결 횟수 도달 시 재연결 중단

**예상 결과**: 네트워크 에러가 적절히 처리됨

---

### TC-E003: WebSocket 강제 종료
**목적**: WebSocket이 예기치 않게 종료될 때의 처리 검증

#### 테스트 단계
1. **Given**: 정상 연결 및 구독 상태
2. **When**: 개발자 도구에서 WebSocket 연결 강제 종료
3. **Then**:
   - [ ] 연결 상태가 "재연결 중 🟠"으로 변경
   - [ ] 자동 재연결 시도
   - [ ] "WebSocket is already in CLOSING or CLOSED state" 에러 없음

**예상 결과**: WebSocket 강제 종료 시에도 안전하게 처리됨

---

## 🔄 통합 시나리오 테스트

### TC-I001: 모드 전환 테스트
**목적**: 레거시 모드와 플러그인 모드 간 전환 검증

#### 테스트 단계
1. **Given**: 레거시 모드에서 연결 및 구독 완료
2. **When**: "🔌 플러그인 모드" 라디오 버튼 선택
3. **Then**:
   - [ ] 기존 연결이 해제됨
   - [ ] 페이지가 새로 초기화됨
   - [ ] TopicPlugin이 활성화됨

4. **When**: "🔧 레거시 모드" 라디오 버튼 선택
5. **Then**:
   - [ ] TopicPlugin 섹션이 숨겨짐
   - [ ] 레거시 구독 섹션이 표시됨
   - [ ] 기본 구독 방식으로 동작

**예상 결과**: 모드 전환이 정상적으로 동작함

---

### TC-I002: 대량 토픽 처리
**목적**: 많은 수의 토픽 구독 시의 성능 검증

#### 테스트 단계
1. **Given**: 플러그인 모드에서 연결 완료
2. **When**: 10개의 서로 다른 토픽을 빠르게 구독
3. **Then**:
   - [ ] 모든 토픽이 정상적으로 구독됨
   - [ ] UI가 끊김 없이 업데이트됨
   - [ ] 메모리 누수 없음

4. **When**: 모든 토픽을 빠르게 구독 해제
5. **Then**:
   - [ ] 모든 토픽이 정상적으로 해제됨
   - [ ] 에러 없이 정리됨

**예상 결과**: 대량 토픽 처리가 안정적으로 동작함

---

## 📊 테스트 체크리스트

### 기능 테스트
- [ ] TC-L001: 레거시 모드 기본 연결/해제
- [ ] TC-L002: 레거시 모드 토픽 구독/해제  
- [ ] TC-L003: 레거시 모드 메시지 송수신
- [ ] TC-L004: 레거시 모드 재연결
- [ ] TC-P001: 플러그인 모드 기본 동작
- [ ] TC-P002: 연결 전 토픽 등록
- [ ] TC-P003: Authorization 헤더 변경 시 구독 복원
- [ ] TC-P004: 플러그인 메시지 수신

### 에러 처리 테스트
- [ ] TC-E001: 권한 거부 에러
- [ ] TC-E002: 네트워크 에러 처리
- [ ] TC-E003: WebSocket 강제 종료

### 통합 테스트
- [ ] TC-I001: 모드 전환
- [ ] TC-I002: 대량 토픽 처리

---

## 🛠️ 자동화 테스트 가이드

### Playwright 예제 코드

```javascript
// 테스트 설정
const TEST_CONFIG = {
  validTopics: {
    common: "/topic/common/broadcast",
    controls: "/user/direct",
    publicUser: "/topic/public/user/rfice-21"
  },
  invalidTopics: {
    unauthorized: "/topic/admin/private",
    nonexistent: "/topic/does/not/exist",
    test: "/topic/test"
  },
  testMessage: "Hello World Test Message"
};

// 기본 연결 테스트 예제
test('TC-L001: 레거시 모드 기본 연결', async ({ page }) => {
  await page.goto('/test/stomp');
  
  // 레거시 모드 선택
  await page.check('input[name="testMode"][value="legacy"]');
  
  // 연결 상태 확인
  await expect(page.locator('.connection-status')).toContainText('연결됨 🟢');
  
  // 기본 토픽 구독 확인
  await expect(page.locator('.subscribed-topics')).toContainText(TEST_CONFIG.validTopics.common);
  
  // 연결 해제
  await page.click('button:has-text("연결 해제")');
  
  // 해제 상태 확인
  await expect(page.locator('.connection-status')).toContainText('연결 안됨 🔴');
});

// 토픽 구독 테스트 예제
test('TC-L002: 토픽 구독 및 해제', async ({ page }) => {
  await page.goto('/test/stomp');
  await page.check('input[name="testMode"][value="legacy"]');
  
  // 연결 대기
  await expect(page.locator('.connection-status')).toContainText('연결됨 🟢');
  
  // 유효한 토픽 구독
  await page.fill('input[placeholder*="Topic"]', TEST_CONFIG.validTopics.controls);
  await page.click('button:has-text("구독")');
  
  // 구독 확인
  await expect(page.locator('.subscribed-topics')).toContainText(TEST_CONFIG.validTopics.controls);
  
  // 구독 해제
  await page.click(`button:has-text("구독 해제")`);
  
  // 해제 확인
  await expect(page.locator('.subscribed-topics')).not.toContainText(TEST_CONFIG.validTopics.controls);
});
```

### Cypress 예제 코드

```javascript
// 테스트 설정
const TEST_CONFIG = {
  validTopics: {
    common: "/topic/common/broadcast",
    controls: "/user/direct",
    publicUser: "/topic/public/user/rfice-21"
  },
  invalidTopics: {
    unauthorized: "/topic/admin/private",
    nonexistent: "/topic/does/not/exist",
    test: "/topic/test"
  }
};

// 플러그인 모드 토픽 등록 테스트
describe('TC-P002: 연결 전 토픽 등록', () => {
  it('should register topic before connection', () => {
    cy.visit('/test/stomp');
    
    // 플러그인 모드 선택
    cy.get('input[name="testMode"]').check('plugin');
    
    // 연결 해제
    cy.contains('button', '연결 해제').click();
    
    // 유효한 토픽 등록
    cy.get('input[placeholder*="plugin-test"]').clear().type(TEST_CONFIG.validTopics.publicUser);
    // select 요소가 제거되었으므로 삭제
    cy.contains('button', '플러그인 구독').click();
    
    // 등록 확인
    cy.contains('.plugin-topics', TEST_CONFIG.validTopics.publicUser).should('exist');
    cy.contains('.plugin-topics', '❌ 비활성').should('exist');
    
    // 연결
    cy.contains('button', '연결').click();
    
    // 활성화 확인
    cy.contains('.plugin-topics', '✅ 활성').should('exist');
  });
});

// 권한 에러 테스트
describe('TC-E001: 권한 거부 에러', () => {
  it('should handle unauthorized topic subscription', () => {
    cy.visit('/test/stomp');
    cy.get('input[name="testMode"]').check('plugin');
    
    // 연결 대기
    cy.contains('.connection-status', '연결됨 🟢');
    
    // 권한 없는 토픽 구독 시도
    cy.get('input[placeholder*="plugin-test"]').clear().type(TEST_CONFIG.invalidTopics.test);
    // select 요소가 제거되었으므로 삭제
    cy.contains('button', '플러그인 구독').click();
    
    // 에러 처리 확인
    cy.contains('.connection-log', 'access denied').should('exist');
    // 또는 연결 상태가 실패로 변경되는지 확인
    // cy.contains('.connection-status', '실패 ❌').should('exist');
  });
});
```

---

## 📝 테스트 결과 기록

### 테스트 실행 로그 템플릿

```
날짜: YYYY-MM-DD
테스터: [이름]
브라우저: [Chrome/Firefox/Safari] [버전]
환경: [Development/Staging/Production]

=== 테스트 결과 ===
✅ TC-L001: 레거시 모드 기본 연결/해제 - PASS
✅ TC-L002: 레거시 모드 토픽 구독/해제 - PASS  
✅ TC-P003: Authorization 헤더 변경 시 구독 복원 - PASS
   - 모든 구독이 정상적으로 자동 복원됨
   - OOP 통합 기능으로 더욱 안정적인 구독 관리

=== 이슈 및 개선사항 ===
1. [발견된 이슈 설명]
2. [개선 제안]
```

---

## 🔧 문제 해결 가이드

### 자주 발생하는 문제들

1. **연결 실패**
   - WebSocket URL 확인
   - 인증 토큰 유효성 확인
   - 네트워크 연결 상태 확인

2. **구독 실패**
   - 토픽 권한 확인
   - 토픽 이름 형식 확인
   - 서버 로그 확인

3. **메시지 수신 안됨**
   - 구독 상태 확인
   - 메시지 형식 확인
   - 브라우저 콘솔 에러 확인

---

**이 문서는 지속적으로 업데이트되어야 하며, 새로운 기능 추가나 버그 수정 시 관련 테스트 시나리오를 추가해야 합니다.**
