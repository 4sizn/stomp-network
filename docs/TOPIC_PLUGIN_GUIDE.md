# TopicPlugin 시스템 가이드

## 📖 개요

TopicPlugin은 StompNetworkController의 토픽 구독 관리 기능을 확장하는 플러그인입니다. 기존의 기본 구독 방식과 달리, **연결 전 단계에서의 토픽 등록**, **영구 구독 메커니즘**, **자동 복원** 등의 고급 기능을 제공합니다.

## 🎯 주요 특징

### 1. **연결 전 토픽 구독 등록**
- 서버에 연결하기 전에도 구독할 토픽을 미리 등록할 수 있습니다
- 연결 완료 시 등록된 모든 토픽이 자동으로 활성화됩니다

### 2. **영구 구독 메커니즘**
- **모든 구독이 영구 구독**: 연결 해제 후에도 유지되어 재연결 시 자동 복원됩니다
- **Authorization 헤더 변경 대응**: 인증 헤더가 변경되어도 재연결 시 구독이 자동으로 복원됩니다

### 3. **캡슐화된 토픽 관리**
- 플러그인을 통해서만 토픽 관리가 가능하여 안전성을 보장합니다
- StompNetworkController와 OOP 통합으로 투명한 사용 가능

### 4. **자동 복원**
- 네트워크 문제로 인한 연결 해제 후 재연결 시 모든 구독 토픽이 자동으로 복원됩니다

## 🏗️ 아키텍처

```
StompNetworkController
├── Plugin System
│   └── TopicPlugin
│       ├── Subscription Management
│       ├── Lifecycle Hooks
│       └── Message Filtering
└── Base STOMP Operations
```

## 📝 사용법

### 1. 기본 설정

```typescript
import { StompNetworkController } from "@/shared/core/controllers/network";
import { TopicPlugin } from "@/shared/core/controllers/network/plugins/TopicPlugin";

// 컨트롤러 생성
const controller = new StompNetworkController(stompClient);

// TopicPlugin 생성 및 등록
const topicPlugin = new TopicPlugin();
controller.addPlugin(topicPlugin);
```

### 2. 연결 전 토픽 등록

```typescript
// 연결하기 전에 토픽 등록 (모든 구독은 자동으로 영구 구독)
topicPlugin.subscribeTopic("/topic/common/broadcast");
topicPlugin.subscribeTopic("/topic/system/notifications");
topicPlugin.subscribeTopic("/topic/user/messages");

// 이제 연결하면 등록된 모든 토픽이 자동으로 구독됩니다
await controller.connect(config);
```

### 3. OOP 통합 사용법 (권장)

```typescript
// TopicPlugin이 등록된 상태에서는 StompNetworkController의 기본 메서드도 자동으로 플러그인을 통해 동작
controller.subscribe("/topic/runtime/events"); // 자동으로 TopicPlugin을 통한 영구 구독
controller.unsubscribe("/topic/runtime/events"); // 자동으로 TopicPlugin을 통한 구독 해제

// 구독 상태 확인
const isSubscribed = controller.isSubscribed("/topic/common/broadcast");
```

### 4. 직접 플러그인 사용법

```typescript
// 플러그인 메서드 직접 사용
topicPlugin.subscribeTopic("/topic/direct/access");
topicPlugin.unsubscribeTopic("/topic/direct/access");

// 구독 상태 확인
const isSubscribed = topicPlugin.isTopicSubscribed("/topic/common/broadcast");
```

### 5. 메시지 수신

```typescript
// OOP 통합 방식 (권장) - StompNetworkController 메서드 사용
const messageObservable = controller.subscribe("/topic/common/broadcast");
messageObservable.subscribe(message => {
  console.log("브로드캐스트 메시지:", message.body);
});

// 직접 플러그인 방식
topicPlugin.getTopicMessages("/topic/common/broadcast").subscribe(message => {
  console.log("브로드캐스트 메시지:", message.body);
});

// 여러 토픽 동시 처리
const topics = ["/topic/chat", "/topic/notifications"];
topics.forEach(topic => {
  controller.subscribe(topic).subscribe(message => { // TopicPlugin이 자동으로 처리
    console.log(`[${topic}] ${message.body}`);
  });
});
```

### 6. 구독 정보 조회

```typescript
// OOP 통합 방식 (권장)
const allTopics = controller.getSubscribedTopics(); // TopicPlugin이 있으면 플러그인 목록 반환
const persistentTopics = controller.getPersistentTopics(); // TopicPlugin이 있으면 모든 토픽 (모두 영구)

// 직접 플러그인 방식
const subscribedTopics = topicPlugin.getSubscribedTopics();
const persistentTopics = topicPlugin.getPersistentTopics(); // 모든 토픽이 영구 구독

// 상세 정보 조회
const topicInfo = topicPlugin.getTopicInfo("/topic/common/broadcast");
console.log(topicInfo);
// { topic: "/topic/common/broadcast", isActive: true, createdAt: Date }
```

## 🔄 라이프사이클

### 연결 과정

```
1. 플러그인 등록 → controller.addPlugin(topicPlugin)
2. 토픽 등록 → topicPlugin.subscribeTopic(...)
3. 연결 시작 → controller.connect(config)
4. onBeforeConnect → 연결 전 준비
5. 실제 연결 → STOMP 서버 연결
6. onAfterConnect → 등록된 모든 토픽 활성화
7. 연결 완료 → 메시지 수신 가능
```

### 연결 해제 과정

```
1. 연결 해제 시작 → controller.disconnect()
2. onBeforeDisconnect → 활성 구독 정리
3. 실제 연결 해제 → STOMP 서버 연결 해제
4. onAfterDisconnect → 모든 구독 토픽 정보 유지 (재연결용)
5. 연결 해제 완료
```

### 재연결 과정 (Authorization 헤더 변경 포함)

```
1. 재연결 시작 → controller.connect(config) // 새로운 Authorization 헤더 포함
2. onBeforeConnect → 연결 전 준비
3. 실제 연결 → STOMP 서버 연결 (새 인증 정보로)
4. onAfterConnect → 모든 구독 토픽 자동 복원
5. 재연결 완료 → 모든 토픽 메시지 수신 재개
```

## 🆚 레거시 모드와의 비교

| 기능 | 레거시 모드 (임시 구독만) | TopicPlugin 모드 (영구 구독만) |
|------|------------------------|------------------------------|
| 연결 전 구독 등록 | ❌ 불가능 | ✅ 가능 |
| 구독 유형 | 임시 구독만 | 영구 구독만 |
| 자동 재구독 | ❌ 수동 처리 필요 | ✅ 자동 처리 |
| Authorization 헤더 변경 대응 | ❌ 수동 재구독 필요 | ✅ 자동 복원 |
| 구독 상태 관리 | ⚠️ 기본적 | ✅ 고급 |
| OOP 통합 | ❌ 없음 | ✅ 투명한 통합 |
| 연결 해제 시 처리 | 모든 구독 소거 | 구독 정보 유지 |

## 🧪 테스트 방법

### StompTestPage에서 테스트

1. `/test/stomp` 페이지로 이동
2. **🔌 TopicPlugin 테스트** 섹션에서 "보이기" 클릭
3. 다양한 시나리오 테스트:

#### 시나리오 1: 연결 전 구독 등록
```
1. 서버 연결 해제 상태에서 토픽 등록
2. 서버 연결
3. 등록된 모든 토픽이 자동으로 활성화되는지 확인
```

#### 시나리오 2: Authorization 헤더 변경 대응
```
1. 서버 연결 후 토픽 구독
2. Authorization 헤더 변경
3. 연결 해제 후 새 헤더로 재연결
4. 기존 구독 토픽들이 자동 복원되는지 확인
```

#### 시나리오 3: OOP 통합 테스트
```
1. TopicPlugin 활성화 상태
2. controller.subscribe() 메서드로 구독 (플러그인을 통해 자동 처리)
3. 연결 해제 후 재연결
4. OOP 메서드로 구독한 토픽도 자동 복원되는지 확인
```

#### 시나리오 4: 런타임 구독 관리
```
1. 서버 연결 후 런타임에 토픽 추가
2. 메시지 수신 확인
3. 토픽 구독 해제
4. 메시지 수신 중단 확인
```

## ⚠️ 주의사항

### 1. 플러그인 등록 순서
```typescript
// ✅ 올바른 순서
const controller = new StompNetworkController(stompClient);
const topicPlugin = new TopicPlugin();
controller.addPlugin(topicPlugin); // 먼저 플러그인 등록

topicPlugin.subscribeTopic("/topic/test"); // 그 다음 토픽 등록
await controller.connect(config);
```

### 2. 메모리 관리
```typescript
// ✅ 컴포넌트 언마운트 시 정리
useEffect(() => {
  return () => {
    // 모든 구독 해제
    subscriptions.forEach(sub => sub.unsubscribe());
    
    // 컨트롤러 정리 (플러그인도 함께 정리됨)
    controller.destroy();
  };
}, []);
```

### 3. 에러 처리
```typescript
try {
  // OOP 통합 방식 (권장)
  controller.subscribe("/topic/test");

  // 직접 플러그인 방식
  topicPlugin.subscribeTopic("/topic/test");
} catch (error) {
  console.error("토픽 구독 실패:", error);
}
```

## 🔧 고급 사용법

### 커스텀 플러그인 개발

```typescript
import { AbstractPlugin } from "@/shared/core/controllers/network/plugins/AbstractPlugin";

export class CustomPlugin extends AbstractPlugin {
  public readonly name = "CustomPlugin";

  protected onAttach(): void {
    console.log("커스텀 플러그인 연결됨");
  }

  protected onDetach(): void {
    console.log("커스텀 플러그인 분리됨");
  }

  public async onBeforeConnect(): Promise<void> {
    // 연결 전 처리
  }

  public async onAfterConnect(): Promise<void> {
    // 연결 후 처리
  }

  public async onBeforeDisconnect(): Promise<void> {
    // 연결 해제 전 처리
  }

  public async onAfterDisconnect(): Promise<void> {
    // 연결 해제 후 처리
  }
}
```

### 플러그인 조합 사용

```typescript
// 여러 플러그인 동시 사용
const topicPlugin = new TopicPlugin();
const customPlugin = new CustomPlugin();

controller.addPlugin(topicPlugin);
controller.addPlugin(customPlugin);

// 플러그인 간 상호작용
const registeredPlugins = controller.getPluginNames();
console.log("등록된 플러그인:", registeredPlugins);
```

## 📚 참고 자료

- [StompNetworkController 가이드](./STOMP_NETWORK_CONTROLLER.md)
- [플러그인 시스템 아키텍처](./PLUGIN_ARCHITECTURE.md)
- [FSD + OOP 개발 가이드](./FSD_OOP_DEVELOPMENT_GUIDE.md)

---

**TopicPlugin을 사용하여 더욱 안정적이고 유연한 실시간 통신 시스템을 구축하세요!** 🚀
