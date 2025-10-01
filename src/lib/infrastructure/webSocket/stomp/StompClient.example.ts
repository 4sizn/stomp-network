/**
 * StompWebSocketClient 사용 예시
 * RxJS Observable 패턴을 활용한 STOMP 클라이언트 사용법
 */

import { Subscription } from "rxjs";
import {
  filter,
  map,
  debounceTime,
  retry,
  take,
  bufferTime,
} from "rxjs/operators";
import {
  StompWebSocketClient,
  StompClientConfig,
  ReconnectTimeMode,
} from "./StompClient";

// ============================================
// 1. 기본 사용 예시
// ============================================
async function basicExample() {
  const client = new StompWebSocketClient();
  const adapter = client.getAdapter();

  // 연결 설정 (ReconnectConfig 포함)
  const config: StompClientConfig = {
    brokerURL: "ws://localhost:8080/ws",
    heartbeatIncoming: 4000,
    heartbeatOutgoing: 4000,
    // 재연결 설정
    maxAttempts: 5,
    delay: 5000,
    tryReconnectTimeMode: ReconnectTimeMode.EXPONENTIAL,
  };

  // 연결 이벤트 구독
  adapter.connect$.subscribe(() => {
    console.log("✅ STOMP 서버에 연결되었습니다");
  });

  // 연결 해제 이벤트 구독
  adapter.disconnect$.subscribe(() => {
    console.log("❌ STOMP 서버 연결이 해제되었습니다");
  });

  // 에러 처리
  adapter.error$.subscribe((error) => {
    console.error("⚠️ STOMP 에러:", error.message);
  });

  // 연결
  await client.connect(config);

  // 메시지 구독
  const messageSubscription = adapter
    .subscribe("/topic/messages")
    .subscribe((message) => {
      console.log("📨 받은 메시지:", message.body);
    });

  // 메시지 전송
  adapter.sendToDestination(
    "/app/chat",
    JSON.stringify({
      user: "user1",
      message: "Hello, World!",
    })
  );

  // 정리
  setTimeout(() => {
    messageSubscription.unsubscribe();
    client.disconnect();
  }, 60000);
}

// ============================================
// 2. 연결 상태 모니터링
// ============================================
function connectionMonitoring() {
  const client = new StompWebSocketClient();
  const adapter = client.getAdapter();

  // 연결 상태 실시간 모니터링
  adapter.connectionState.subscribe((isConnected) => {
    console.log(`연결 상태: ${isConnected ? "연결됨 🟢" : "연결 안됨 🔴"}`);
  });

  // 연결 상태 변경만 감지
  adapter.connectionChanges$.subscribe((isConnected) => {
    console.log(`연결 상태 변경됨: ${isConnected ? "연결됨" : "연결 해제됨"}`);

    if (isConnected) {
      // 연결되면 자동으로 구독 시작
      subscribeToTopics(adapter);
    }
  });

  // 연결될 때까지 대기
  adapter.waitForConnection().subscribe(() => {
    console.log("연결 완료! 이제 메시지를 보낼 수 있습니다.");
  });
}

function subscribeToTopics(adapter: any) {
  // 여러 토픽 구독
  const topics = ["/topic/news", "/topic/alerts", "/topic/updates"];

  topics.forEach((topic) => {
    adapter.subscribe(topic).subscribe((message: any) => {
      console.log(`[${topic}] ${message.body}`);
    });
  });
}

// ============================================
// 3. 필터링된 메시지 구독
// ============================================
function filteredSubscription() {
  const client = new StompWebSocketClient();
  const adapter = client.getAdapter();

  // 헤더 기반 필터링
  adapter
    .subscribeWithFilter("/topic/notifications", { priority: "high" })
    .subscribe((message) => {
      console.log("🚨 높은 우선순위 알림:", message.body);
    });

  // RxJS 연산자를 사용한 추가 필터링
  adapter
    .subscribe("/topic/chat")
    .pipe(
      // JSON 파싱
      map((message) => ({
        ...message,
        parsedBody: JSON.parse(message.body),
      })),
      // 특정 사용자 메시지만 필터
      filter((message) => message.parsedBody.userId === "user123"),
      // 디바운싱 (300ms)
      debounceTime(300)
    )
    .subscribe((message) => {
      console.log("필터링된 메시지:", message.parsedBody);
    });
}

// ============================================
// 4. 에러 처리 및 재시도
// ============================================
function errorHandlingExample() {
  const client = new StompWebSocketClient();
  const adapter = client.getAdapter();

  // 재시도 로직이 포함된 구독
  adapter
    .subscribe("/topic/critical")
    .pipe(
      retry({
        count: 3,
        delay: 1000,
        resetOnSuccess: true,
      })
    )
    .subscribe({
      next: (message) => {
        console.log("중요 메시지:", message.body);
      },
      error: (error) => {
        console.error("구독 실패 (재시도 3회 후):", error);
      },
    });

  // 재연결 이벤트 구독
  adapter.reconnectAttempt$.subscribe(({ attempt, max }) => {
    console.log(`재연결 시도: ${attempt}/${max}`);
  });

  // 최대 재연결 도달 이벤트
  adapter.maxReconnectReached$.subscribe(() => {
    console.error("최대 재연결 시도 횟수에 도달했습니다.");
  });

  // 전역 에러 처리
  adapter.error$.subscribe((error) => {
    console.error("STOMP 에러 발생:", error);

    // 에러 타입에 따른 처리
    if (error.message.includes("WebSocket")) {
      console.log("WebSocket 연결 문제 - 재연결 시도 중...");
    } else if (error.message.includes("STOMP")) {
      console.log("STOMP 프로토콜 에러");
    }
  });
}

// ============================================
// 5. 복잡한 메시지 흐름 처리
// ============================================
function complexMessageFlow() {
  const client = new StompWebSocketClient();
  const adapter = client.getAdapter();
  const subscriptions: Subscription[] = [];

  // 채팅방 입장
  async function joinChatRoom(roomId: string) {
    // 연결 대기
    await adapter.waitForConnection().pipe(take(1)).toPromise();

    // 채팅방 메시지 구독
    const chatSub = adapter
      .subscribe(`/topic/room/${roomId}`)
      .pipe(
        map((message) => JSON.parse(message.body)),
        filter((data) => data.type === "chat")
      )
      .subscribe((chatMessage) => {
        console.log(`[${roomId}] ${chatMessage.user}: ${chatMessage.text}`);
      });

    // 시스템 메시지 구독
    const systemSub = adapter
      .subscribe(`/topic/room/${roomId}/system`)
      .subscribe((message) => {
        console.log(`[시스템] ${message.body}`);
      });

    // 입장 메시지 전송
    adapter.sendToDestination(
      `/app/room/${roomId}/join`,
      JSON.stringify({ user: "currentUser" })
    );

    subscriptions.push(chatSub, systemSub);
    return { chatSub, systemSub };
  }

  // 채팅방 퇴장
  function leaveChatRoom(roomId: string) {
    // 퇴장 메시지 전송
    adapter.sendToDestination(
      `/app/room/${roomId}/leave`,
      JSON.stringify({ user: "currentUser" })
    );

    // 구독 해제
    subscriptions.forEach((sub) => sub.unsubscribe());
    subscriptions.length = 0;
  }

  return { joinChatRoom, leaveChatRoom };
}

// ============================================
// 6. 타입 안전한 메시지 처리
// ============================================
interface ChatMessage {
  id: string;
  userId: string;
  text: string;
  timestamp: number;
}

interface NotificationMessage {
  type: "info" | "warning" | "error";
  title: string;
  body: string;
}

function typeSafeMessaging() {
  const client = new StompWebSocketClient();
  const adapter = client.getAdapter();

  // 타입 안전한 채팅 메시지 구독
  const chatMessages$ = adapter.subscribe("/topic/chat").pipe(
    map((message) => JSON.parse(message.body) as ChatMessage),
    filter((msg) => msg.text.length > 0)
  );

  chatMessages$.subscribe((chatMessage: ChatMessage) => {
    console.log(`[${chatMessage.userId}]: ${chatMessage.text}`);
  });

  // 타입 안전한 알림 구독
  const notifications$ = adapter
    .subscribe("/topic/notifications")
    .pipe(map((message) => JSON.parse(message.body) as NotificationMessage));

  notifications$.subscribe((notification: NotificationMessage) => {
    switch (notification.type) {
      case "error":
        console.error(`❌ ${notification.title}: ${notification.body}`);
        break;
      case "warning":
        console.warn(`⚠️ ${notification.title}: ${notification.body}`);
        break;
      case "info":
        console.info(`ℹ️ ${notification.title}: ${notification.body}`);
        break;
    }
  });

  // 타입 안전한 메시지 전송
  function sendChatMessage(text: string) {
    const message: ChatMessage = {
      id: Date.now().toString(),
      userId: "currentUser",
      text,
      timestamp: Date.now(),
    };

    adapter.sendToDestination("/app/chat", JSON.stringify(message));
  }

  return { sendChatMessage };
}

// ============================================
// 7. 메시지 집계 및 통계
// ============================================
function messageAggregation() {
  const client = new StompWebSocketClient();
  const adapter = client.getAdapter();

  // 메시지 카운터 (stompMessage$ 사용)
  let messageCount = 0;
  adapter.message$.subscribe(() => {
    messageCount++;
    console.log(`총 받은 메시지 수: ${messageCount}`);
  });

  // 특정 토픽의 메시지 빈도 측정
  const startTime = Date.now();
  adapter.subscribe("/topic/metrics").subscribe(() => {
    const elapsed = (Date.now() - startTime) / 1000;
    const rate = messageCount / elapsed;
    console.log(`메시지 처리율: ${rate.toFixed(2)} msg/sec`);
  });

  // 메시지 그룹화 (5초 단위)
  adapter.stompMessage$
    .pipe(
      // 5초 동안 메시지 수집
      bufferTime(5000),
      filter((messages) => messages.length > 0)
    )
    .subscribe((messages) => {
      console.log(`5초 동안 ${messages.length}개의 메시지 수신`);
    });
}

// ============================================
// 8. 정리 및 리소스 관리
// ============================================
class StompManager {
  private client: StompWebSocketClient;
  private subscriptions: Map<string, Subscription> = new Map();

  constructor() {
    this.client = new StompWebSocketClient();
  }

  async connect(config: StompClientConfig): Promise<void> {
    const adapter = this.client.getAdapter();

    // 연결 이벤트 설정
    this.setupEventHandlers(adapter);

    // 연결
    await this.client.connect(config);
  }

  private setupEventHandlers(adapter: any): void {
    adapter.connect$.subscribe(() => {
      console.log("Manager: 연결됨");
      this.onConnected();
    });

    adapter.disconnect$.subscribe(() => {
      console.log("Manager: 연결 해제됨");
      this.cleanup();
    });

    adapter.error$.subscribe((error: Error) => {
      console.error("Manager: 에러", error);
    });

    // 재연결 이벤트 처리
    adapter.reconnectAttempt$.subscribe(
      ({ attempt, max }: { attempt: number; max: number }) => {
        console.log(`Manager: 재연결 시도 ${attempt}/${max}`);
      }
    );
  }

  private onConnected(): void {
    // 연결 시 자동 구독 설정
    this.subscribeTo("/topic/global", "global");
  }

  subscribeTo(destination: string, key: string): void {
    const adapter = this.client.getAdapter();

    // 기존 구독이 있으면 해제
    if (this.subscriptions.has(key)) {
      this.subscriptions.get(key)?.unsubscribe();
    }

    // 새 구독 생성
    const subscription = adapter
      .subscribe(destination)
      .subscribe((message: any) => {
        console.log(`[${key}] ${message.body}`);
      });

    this.subscriptions.set(key, subscription);
  }

  unsubscribeFrom(key: string): void {
    const subscription = this.subscriptions.get(key);
    if (subscription) {
      subscription.unsubscribe();
      this.subscriptions.delete(key);
      console.log(`구독 해제: ${key}`);
    }
  }

  sendMessage(destination: string, data: any): void {
    const adapter = this.client.getAdapter();
    adapter.sendToDestination(destination, JSON.stringify(data));
  }

  // 연결 상태 확인
  isConnected(): boolean {
    return this.client.getAdapter().isConnected();
  }

  // 재연결 정보 조회
  getReconnectInfo() {
    return this.client.getAdapter().getReconnectInfo();
  }

  private cleanup(): void {
    // 모든 구독 해제
    this.subscriptions.forEach((sub) => sub.unsubscribe());
    this.subscriptions.clear();
  }

  disconnect(): void {
    this.cleanup();
    this.client.disconnect();
  }
}

// ============================================
// 사용 예시 실행
// ============================================
async function main() {
  console.log("=== STOMP RxJS Client 예시 ===");

  // Manager 패턴 사용
  const manager = new StompManager();

  try {
    await manager.connect({
      brokerURL: "ws://localhost:8080/ws",
      maxAttempts: 3,
      delay: 3000,
      tryReconnectTimeMode: ReconnectTimeMode.EXPONENTIAL,
    });

    // 다양한 토픽 구독
    manager.subscribeTo("/topic/news", "news");
    manager.subscribeTo("/topic/alerts", "alerts");

    // 메시지 전송
    manager.sendMessage("/app/test", { message: "Hello!" });

    // 연결 상태 모니터링
    setInterval(() => {
      const isConnected = manager.isConnected();
      const reconnectInfo = manager.getReconnectInfo();
      console.log(
        `상태: ${isConnected ? "연결됨" : "연결 안됨"}, 재연결 시도: ${
          reconnectInfo.attempts
        }`
      );
    }, 5000);

    // 10초 후 정리
    setTimeout(() => {
      manager.disconnect();
    }, 10000);
  } catch (error) {
    console.error("연결 실패:", error);
  }
}

export {
  basicExample,
  connectionMonitoring,
  filteredSubscription,
  errorHandlingExample,
  complexMessageFlow,
  typeSafeMessaging,
  messageAggregation,
  StompManager,
  main,
};
