import { useEffect, useRef, useState } from "react";
import { Subscription } from "rxjs";

import {
  StompClientConfig,
  StompWebSocketClient,
  ReconnectTimeMode,
} from "../lib/infrastructure/webSocket/stomp/StompClient";
import { TickerStrategy, Versions } from "@stomp/stompjs";
import {
  ConnectionState,
  StompConnectionError,
  StompMessageError,
  StompNetworkController,
  StompReconnectionError,
  StompSubscriptionError,
} from "../lib";
import { TopicPlugin } from "../lib/core/controllers/network/plugins/TopicPlugin";

/**
 * @link https://docs.google.com/spreadsheets/d/1Zks_T7K-21O_khH-ZqQ991d2xu0aXI6iQlrlOKFD9Ok/edit?pli=1&gid=892418279#gid=892418279
 */

const STOMP_CLIENT_CONFIG: StompClientConfig = {
  brokerURL: "wss://" + import.meta.env.VITE_WEBSOCKET_URL,
  connectHeaders: {
    authorization:
      "eyJraWQiOiJkZTViZjNkOC03NGE5LTQ0NjMtYWE2Yy0yNTgzNWViNzk0NGQiLCJ0eXAiOiJKV1QiLCJhbGciOiJFZERTQSJ9.eyJpc3MiOiJodHRwczovL2R2YXBwLnJmaWNlLmNvbSIsInN1YiI6InJmaWNlLTIxIiwidW4iOiJoc3NoaW5AcnN1cHBvcnQuY29tIiwiYXUiOiJHVUVTVCwgVVNFUiIsImV4cCI6MTc2NDUwMzkxNCwiaWF0IjoxNzY0NDk2NzE0fQ.WWoJg2OM4K6BjKT2az0u-cF776u88i6jIgvhGi84_i_RerV2wS9tVgrnS5o2rtxaef4Ye4S8wGruUJauTHlZAg",
    "device-key":
      "NdF0Gmlie3BUtfv0tNT33rjLnZAG_9YmWi0KUxH4G0UxDWnNYhZd4dNv8U6i0xRW",
    "device-type": "WEB",
    "app-version": "0.48.2.0",
  },
  beforeConnect: () => {
    console.log(StompWebSocketClient.name, "beforeConnect");
  },
  heartbeatStrategy: TickerStrategy.Worker,
  heartbeatIncoming: 5 * 1000,
  heartbeatOutgoing: 5 * 1000,
  stompVersions: new Versions(["1.2"]),
  maxReconnectDelay: 2 ** 5 * 1000,
  debug: (message: string) => {
    console.log("STOMP Debug:", message);
  },
  // 재연결 설정 추가
  maxAttempts: 5, // 최대 5회 재연결 시도
  delay: 2000, // 초기 지연 시간 2초
  tryReconnectTimeMode: ReconnectTimeMode.INTERVAL, // 지수백오프 모드 (기본값)
};

export default function StompTestDemo() {
  const controllerRef = useRef<StompNetworkController | null>(null);
  const topicPluginRef = useRef<TopicPlugin | null>(null);
  const subscriptionsRef = useRef<Subscription[]>([]);

  const [connectionState, setConnectionState] = useState<ConnectionState>(
    ConnectionState.DISCONNECTED
  );
  const [messages, setMessages] = useState<string[]>([]);
  const [connectionLog, setConnectionLog] = useState<string[]>([]);
  const [messageInput, setMessageInput] = useState("");
  const [topicInput, setTopicInput] = useState("/topic/test");
  const [subscribeTopicInput, setSubscribeTopicInput] = useState("/topic/test");
  const [subscribedTopics, setSubscribedTopics] = useState<string[]>([]);

  // 재연결 관련 상태
  const [reconnectInfo, setReconnectInfo] = useState<{
    attempts: number;
    maxAttempts: number;
    isReconnecting: boolean;
  }>({ attempts: 0, maxAttempts: 5, isReconnecting: false });
  const [maxReconnectReached, setMaxReconnectReached] = useState(false);

  // TopicPlugin 관련 상태
  const [useTopicPlugin, setUseTopicPlugin] = useState(false); // TopicPlugin 사용 여부 토글
  const [pluginEnabled, setPluginEnabled] = useState(false);
  const [pluginTopicInput, setPluginTopicInput] =
    useState("/topic/plugin-test");
  const [pluginTopics, setPluginTopics] = useState<
    { topic: string; isActive: boolean }[]
  >([]);

  // Authorization 헤더 수정 관련 상태
  const [authorizationHeader, setAuthorizationHeader] = useState(
    STOMP_CLIENT_CONFIG.connectHeaders?.authorization || ""
  );
  const [isReconnecting, setIsReconnecting] = useState(false);

  useEffect(() => {
    // StompWebSocketClient와 StompNetworkController 생성
    const stompClient = new StompWebSocketClient();
    const controller = new StompNetworkController(stompClient);
    controllerRef.current = controller;
    const adapter = stompClient.getAdapter();

    // TopicPlugin 조건부 생성 및 등록
    if (useTopicPlugin) {
      const topicPlugin = new TopicPlugin();
      topicPluginRef.current = topicPlugin;
      controller.addPlugin(topicPlugin);

      // 연결 전에 영구 구독 토픽 미리 등록 (테스트용)
      topicPlugin.subscribeTopic("/topic/common/broadcast");
      topicPlugin.subscribeTopic("/topic/public/user/rfice-22");
    } else {
      topicPluginRef.current = null;
    }

    // 헬퍼 함수들을 먼저 정의
    function addLog(log: string) {
      const timestamp = new Date().toLocaleTimeString();
      setConnectionLog((prev) => [...prev, `[${timestamp}] ${log}`]);
    }

    function addMessage(message: string) {
      const timestamp = new Date().toLocaleTimeString();
      setMessages((prev) => [...prev, `[${timestamp}] ${message}`]);
    }

    function subscribeToTopic(topic: string) {
      if (!controller.isConnected()) {
        addLog(`⚠️ 연결되지 않음 - ${topic} 구독 실패`);
        return;
      }

      // 이미 구독 중인지 확인
      const currentSubscribed = controller.getSubscribedTopics();
      if (currentSubscribed.includes(topic)) {
        addLog(`ℹ️ 이미 구독 중: ${topic}`);
        return;
      }

      try {
        // 레거시 컨트롤러의 기본 구독 메서드 사용 (영구 구독 비활성화)
        controller.subscribe(topic);

        setSubscribedTopics((prev) => [...prev, topic]);

        addLog(`📥 ${topic} 구독 시작`);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        addLog(`❌ ${topic} 구독 실패: ${errorMessage}`);
        console.error(`구독 실패 상세:`, error);
      }
    }

    async function connectToServer() {
      try {
        addLog("🔄 서버 연결 시도 중...");
        setReconnectInfo({
          attempts: 0,
          maxAttempts: 5,
          isReconnecting: false,
        });
        await controller.connect(STOMP_CLIENT_CONFIG);
        addLog("✅ 서버 연결 성공");
      } catch (error) {
        addLog(`❌ 서버 연결 실패: ${error}`);
        console.error("Connection failed:", error);
      }
    }

    // ============================================
    // 1. 연결 상태 모니터링
    // ============================================

    // 연결 상태 실시간 추적
    const connectionStateSub = controller.connectionState.subscribe((state) => {
      setConnectionState(state);
      const stateText = getConnectionStateText(state);
      addLog(`연결 상태: ${stateText}`);
    });

    // 연결 이벤트 구독
    const connectSub = adapter.connect$.subscribe(() => {
      addLog("✅ STOMP 서버에 연결되었습니다");

      // 재연결 성공 시 UI 상태 리셋
      setReconnectInfo({
        attempts: 0,
        maxAttempts: 5,
        isReconnecting: false,
      });
      setMaxReconnectReached(false);

      // 클라이언트 내부 재연결 상태도 리셋
      adapter.resetReconnectState();

      // TopicPlugin 미사용 시에만 기본 토픽 구독
      if (!useTopicPlugin) {
        subscribeToTopic("/topic/common/broadcast");
      }
    });

    // 연결 해제 이벤트
    const disconnectSub = controller.disconnect$.subscribe(() => {
      addLog("❌ STOMP 서버 연결이 해제되었습니다");
      setSubscribedTopics([]);
    });

    // 재연결 시도 이벤트
    const reconnectAttemptSub = controller.reconnectAttempt$.subscribe(
      (info) => {
        addLog(`🔄 재연결 시도 ${info.attempts}/${info.maxAttempts}`);
        setReconnectInfo({
          attempts: info.attempts,
          maxAttempts: info.maxAttempts,
          isReconnecting: true,
        });
      }
    );

    // 연결 상태 변경 감지
    const connectionChangesSub = controller.connectionChanges$.subscribe(
      (state) => {
        addLog(`🔄 연결 상태 변경: ${state}`);
        // 재연결 상태 업데이트
        setReconnectInfo((prev) => ({
          ...prev,
          isReconnecting: state === ConnectionState.RECONNECTING,
        }));
      }
    );

    // 최대 재연결 도달 이벤트
    const maxReconnectReachedSub = controller.maxReconnectReached$.subscribe(
      () => {
        addLog(
          "❌ 최대 재연결 시도 횟수에 도달했습니다. 연결이 중단되었습니다."
        );
        setMaxReconnectReached(true);
        setReconnectInfo((prev) => ({ ...prev, isReconnecting: false }));
      }
    );

    // 에러 처리
    const errorSub = controller.error$.subscribe((error) => {
      let errorMessage = "알 수 없는 에러";

      if (error instanceof StompConnectionError) {
        errorMessage = `연결 에러 [${error.code}]: ${error.message}`;
      } else if (error instanceof StompSubscriptionError) {
        errorMessage = `구독 에러 [${error.topic}]: ${error.message}`;
      } else if (error instanceof StompMessageError) {
        errorMessage = `메시지 에러 [${error.topic}]: ${error.message}`;
      } else if (error instanceof StompReconnectionError) {
        errorMessage = `재연결 에러 [${error.attempts}/${error.maxAttempts}]: ${error.message}`;
      } else {
        errorMessage = error.message;
      }

      addLog(`⚠️ ${errorMessage}`);
      console.error("Network Controller Error:", error);
    });

    // ============================================
    // 2. 메시지 수신 모니터링
    // ============================================

    // 모든 메시지 로깅
    const allMessagesSub = controller.message$.subscribe((message) => {
      const topic = message.headers.destination || "unknown";
      try {
        const parsedBody = JSON.parse(message.body);
        addMessage(`[${topic}] JSON: ${JSON.stringify(parsedBody)}`);
      } catch {
        addMessage(`[${topic}] Text: ${message.body}`);
      }
    });

    // 구독 저장
    subscriptionsRef.current = [
      connectionStateSub,
      connectSub,
      disconnectSub,
      reconnectAttemptSub,
      connectionChangesSub,
      maxReconnectReachedSub,
      errorSub,
      allMessagesSub,
    ];

    // ============================================
    // 3. 연결 시작
    // ============================================

    connectToServer();

    // Cleanup
    return () => {
      // 모든 구독 해제
      subscriptionsRef.current.forEach((sub) => sub.unsubscribe());
      subscriptionsRef.current = [];

      // 컨트롤러 정리
      if (controllerRef.current) {
        controllerRef.current.destroy();
        controllerRef.current = null;
      }
    };
  }, [useTopicPlugin]); // useTopicPlugin이 변경될 때마다 재실행

  // ============================================
  // 유틸리티 함수
  // ============================================

  const getConnectionStateText = (state: ConnectionState): string => {
    switch (state) {
      case ConnectionState.CONNECTED:
        return "연결됨 🟢";
      case ConnectionState.CONNECTING:
        return "연결 중 🟡";
      case ConnectionState.DISCONNECTED:
        return "연결 안됨 🔴";
      case ConnectionState.RECONNECTING:
        return "재연결 중 🟠";
      case ConnectionState.FAILED:
        return "실패 ❌";
      default:
        return "알 수 없음 ❓";
    }
  };

  const isConnected = connectionState === ConnectionState.CONNECTED;
  const isConnecting =
    connectionState === ConnectionState.CONNECTING ||
    connectionState === ConnectionState.RECONNECTING;

  // ============================================
  // 이벤트 핸들러
  // ============================================

  const handleConnect = async () => {
    if (controllerRef.current && !isConnected && !isConnecting) {
      try {
        setConnectionLog((prev) => [...prev, "🔄 수동 연결 시도..."]);
        setMaxReconnectReached(false);
        setReconnectInfo({
          attempts: 0,
          maxAttempts: 5,
          isReconnecting: false,
        });

        await controllerRef.current.connect(STOMP_CLIENT_CONFIG);
      } catch (error) {
        setConnectionLog((prev) => [...prev, `❌ 연결 실패: ${error}`]);
      }
    }
  };

  const handleDisconnect = async () => {
    if (controllerRef.current && isConnected) {
      await controllerRef.current.disconnect();
      setSubscribedTopics([]);
    }
  };

  const handleSendMessage = () => {
    if (!controllerRef.current || !isConnected) {
      alert("서버에 연결되어 있지 않습니다");
      return;
    }

    if (!messageInput.trim()) {
      alert("메시지를 입력하세요");
      return;
    }

    try {
      const messageData = {
        content: messageInput,
        timestamp: Date.now(),
        user: "TestUser",
      };

      controllerRef.current.sendMessage(
        topicInput,
        JSON.stringify(messageData)
      );

      setConnectionLog((prev) => [
        ...prev,
        `📤 메시지 전송: ${topicInput} -> ${messageInput}`,
      ]);
      setMessageInput("");
    } catch (error) {
      setConnectionLog((prev) => [...prev, `❌ 전송 실패: ${error}`]);
    }
  };

  const handleSubscribe = () => {
    if (!controllerRef.current || !isConnected) {
      alert("서버에 연결되어 있지 않습니다");
      return;
    }

    if (!subscribeTopicInput.trim()) {
      alert("토픽을 입력하세요");
      return;
    }

    // 이미 구독 중인지 확인
    if (subscribedTopics.includes(subscribeTopicInput)) {
      alert(`이미 구독 중: ${subscribeTopicInput}`);
      return;
    }

    try {
      // 레거시 컨트롤러의 기본 구독 메서드 사용
      controllerRef.current.subscribe(subscribeTopicInput);

      setSubscribedTopics((prev) => [...prev, subscribeTopicInput]);

      setConnectionLog((prev) => [
        ...prev,
        `📥 구독 시작: ${subscribeTopicInput}`,
      ]);
    } catch (error) {
      setConnectionLog((prev) => [...prev, `❌ 구독 실패: ${error}`]);
    }
  };

  const handleUnsubscribe = async (topic: string) => {
    if (!controllerRef.current) return;

    try {
      // 연결 상태 확인 후 구독 해제
      if (controllerRef.current.isConnected()) {
        await controllerRef.current.unsubscribe(topic);
        setConnectionLog((prev) => [...prev, `📤 구독 해제: ${topic}`]);
      } else {
        setConnectionLog((prev) => [
          ...prev,
          `⚠️ 연결 해제됨 - ${topic} 로컬에서만 제거`,
        ]);
      }

      setSubscribedTopics((prev) => prev.filter((t) => t !== topic));
    } catch (error) {
      setConnectionLog((prev) => [...prev, `❌ 구독 해제 실패: ${error}`]);
    }
  };

  const clearLogs = () => {
    setConnectionLog([]);
    setMessages([]);
  };

  // Authorization 헤더 수정 및 재연결 핸들러
  const handleUpdateAuthorization = async () => {
    if (!controllerRef.current) {
      alert("컨트롤러가 초기화되지 않았습니다");
      return;
    }

    if (!authorizationHeader.trim()) {
      alert("Authorization 헤더를 입력하세요");
      return;
    }

    setIsReconnecting(true);

    try {
      // 1. 기존 연결 완전히 해제
      if (controllerRef.current.isConnected()) {
        setConnectionLog((prev) => [...prev, "🔄 기존 연결 해제 중..."]);
        await controllerRef.current.disconnect();
      }

      // 2. 새로운 Authorization 헤더로 설정 업데이트
      const updatedConfig: StompClientConfig = {
        ...STOMP_CLIENT_CONFIG,
        connectHeaders: {
          ...STOMP_CLIENT_CONFIG.connectHeaders,
          authorization: authorizationHeader,
        },
      };

      setConnectionLog((prev) => [
        ...prev,
        `🔐 Authorization 헤더 업데이트: ${authorizationHeader.substring(
          0,
          50
        )}...`,
      ]);

      // 3. 잠시 대기 (연결 해제 완료 대기)
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // 4. 새로운 설정으로 재연결
      setConnectionLog((prev) => [
        ...prev,
        "🔄 새로운 Authorization으로 재연결 시도...",
      ]);
      setReconnectInfo({
        attempts: 0,
        maxAttempts: 5,
        isReconnecting: false,
      });
      setMaxReconnectReached(false);

      await controllerRef.current.connect(updatedConfig);

      setConnectionLog((prev) => [
        ...prev,
        "✅ Authorization 헤더 업데이트 및 재연결 성공",
      ]);
    } catch (error) {
      setConnectionLog((prev) => [...prev, `❌ 재연결 실패: ${error}`]);
      console.error("Authorization update failed:", error);
    } finally {
      setIsReconnecting(false);
    }
  };

  // ============================================
  // TopicPlugin 관련 핸들러
  // ============================================

  const handlePluginSubscribe = () => {
    if (!topicPluginRef.current) {
      alert("TopicPlugin이 초기화되지 않았습니다");
      return;
    }

    if (!pluginTopicInput.trim()) {
      alert("토픽을 입력하세요");
      return;
    }

    try {
      topicPluginRef.current.subscribeTopic(pluginTopicInput);
      updatePluginTopicsState();
      setConnectionLog((prev) => [
        ...prev,
        `🔌 [TopicPlugin] 토픽 구독 등록: ${pluginTopicInput}`,
      ]);
    } catch (error) {
      setConnectionLog((prev) => [
        ...prev,
        `❌ [TopicPlugin] 구독 등록 실패: ${error}`,
      ]);
    }
  };

  const handlePluginUnsubscribe = (topic: string) => {
    if (!topicPluginRef.current) return;

    try {
      topicPluginRef.current.unsubscribeTopic(topic);
      updatePluginTopicsState();
      setConnectionLog((prev) => [
        ...prev,
        `🔌 [TopicPlugin] 토픽 구독 해제: ${topic}`,
      ]);
    } catch (error) {
      console.warn(`TopicPlugin 구독 해제 에러:`, error);
      // TopicPlugin은 내부적으로 WebSocket 상태를 확인하므로 여기서는 성공으로 처리
      updatePluginTopicsState();
      setConnectionLog((prev) => [
        ...prev,
        `🔌 [TopicPlugin] 토픽 구독 해제: ${topic} (로컬 정리)`,
      ]);
    }
  };

  const updatePluginTopicsState = () => {
    if (!topicPluginRef.current) return;

    const allTopicInfo = topicPluginRef.current.getAllTopicInfo();
    const topicsState = allTopicInfo.map((info) => ({
      topic: info.topic,
      isActive: info.isActive,
    }));
    setPluginTopics(topicsState);
  };

  const handlePluginMessageListen = (topic: string) => {
    if (!topicPluginRef.current) return;

    try {
      const subscription = topicPluginRef.current
        .getTopicMessages(topic)
        .subscribe((message) => {
          const timestamp = new Date().toLocaleTimeString();
          setMessages((prev) => [
            ...prev,
            `[${timestamp}] 🔌 [${topic}] ${message.body}`,
          ]);
        });

      subscriptionsRef.current.push(subscription);
      setConnectionLog((prev) => [
        ...prev,
        `🔌 [TopicPlugin] 메시지 리스닝 시작: ${topic}`,
      ]);
    } catch (error) {
      setConnectionLog((prev) => [
        ...prev,
        `❌ [TopicPlugin] 메시지 리스닝 실패: ${error}`,
      ]);
    }
  };

  // 플러그인 상태 업데이트 (연결 상태 변경 시)
  useEffect(() => {
    updatePluginTopicsState();
  }, [connectionState]);

  const getSubscriptionInfo = () => {
    if (!controllerRef.current) return [];
    const subscribedTopics = controllerRef.current.getSubscribedTopics();

    return subscribedTopics.map((topic) => ({
      topic,
      isActive: controllerRef.current?.isSubscribed(topic) || false,
    }));
  };

  return (
    <div style={{ padding: "20px", fontFamily: "monospace" }}>
      <h1>@4sizn/stomp Demo - STOMP Network Controller Test</h1>

      {/* TopicPlugin 사용 여부 토글 */}
      <div
        style={{
          marginBottom: "20px",
          padding: "15px",
          backgroundColor: "#f8f9fa",
          border: "2px solid #6c757d",
          borderRadius: "8px",
        }}
      >
        <h2 style={{ color: "#6c757d", margin: "0 0 10px 0" }}>
          ⚙️ 테스트 모드 선택
        </h2>
        <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <input
              type="radio"
              name="testMode"
              checked={!useTopicPlugin}
              onChange={() => setUseTopicPlugin(false)}
            />
            <span style={{ fontWeight: useTopicPlugin ? "normal" : "bold" }}>
              🔧 레거시 모드 (기본 StompNetworkController)
            </span>
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <input
              type="radio"
              name="testMode"
              checked={useTopicPlugin}
              onChange={() => setUseTopicPlugin(true)}
            />
            <span style={{ fontWeight: useTopicPlugin ? "bold" : "normal" }}>
              🔌 플러그인 모드 (TopicPlugin 사용)
            </span>
          </label>
        </div>
        <div
          style={{
            marginTop: "10px",
            fontSize: "12px",
            color: "#6c757d",
            fontStyle: "italic",
          }}
        >
          {useTopicPlugin
            ? "TopicPlugin을 사용하여 고급 토픽 관리 기능을 테스트합니다."
            : "기본 StompNetworkController의 레거시 구독 기능을 테스트합니다."}
        </div>
      </div>

      {/* Authorization 헤더 수정 섹션 */}
      <div
        style={{
          marginBottom: "20px",
          padding: "15px",
          backgroundColor: "#fff3cd",
          border: "2px solid #ffc107",
          borderRadius: "8px",
        }}
      >
        <h2 style={{ color: "#856404", margin: "0 0 15px 0" }}>
          🔐 Authorization 헤더 수정
        </h2>
        <div style={{ marginBottom: "10px" }}>
          <label
            htmlFor="authorizationHeader"
            style={{
              display: "block",
              marginBottom: "5px",
              fontSize: "14px",
              fontWeight: "bold",
            }}
          >
            JWT Authorization Token:
          </label>
          <textarea
            value={authorizationHeader}
            onChange={(e) => setAuthorizationHeader(e.target.value)}
            placeholder="JWT token을 입력하세요 (예: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...)"
            style={{
              width: "100%",
              minHeight: "80px",
              padding: "8px",
              border: "1px solid #ffc107",
              borderRadius: "4px",
              fontFamily: "monospace",
              fontSize: "12px",
              resize: "vertical",
            }}
          />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <button
            type="button"
            onClick={handleUpdateAuthorization}
            disabled={isReconnecting || isConnecting}
            style={{
              backgroundColor: "#ffc107",
              color: "#212529",
              border: "none",
              padding: "8px 16px",
              borderRadius: "4px",
              fontWeight: "bold",
              cursor:
                isReconnecting || isConnecting ? "not-allowed" : "pointer",
              opacity: isReconnecting || isConnecting ? 0.6 : 1,
            }}
          >
            {isReconnecting ? "재연결 중..." : "수정하기"}
          </button>
          <span style={{ fontSize: "12px", color: "#856404" }}>
            ⚠️ 수정 시 기존 연결이 해제되고 새로운 토큰으로 재연결됩니다.
          </span>
        </div>
        <div
          style={{
            marginTop: "10px",
            padding: "8px",
            backgroundColor: "#e2e3e5",
            border: "1px solid #d3d3d4",
            borderRadius: "4px",
            fontSize: "11px",
            fontFamily: "monospace",
          }}
        >
          <strong>현재 토큰 (앞 50자):</strong>
          <br />
          {authorizationHeader.substring(0, 50)}...
        </div>
      </div>

      {/* 연결 상태 */}
      <div style={{ marginBottom: "20px" }}>
        <h2>연결 상태</h2>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div
            style={{
              width: "20px",
              height: "20px",
              borderRadius: "50%",
              backgroundColor: isConnected
                ? "#4CAF50"
                : isConnecting
                ? "#FFA500"
                : "#f44336",
            }}
          />
          <span>{getConnectionStateText(connectionState)}</span>
          <button
            type="button"
            onClick={handleConnect}
            disabled={isConnected || isConnecting}
          >
            연결
          </button>
          <button
            type="button"
            onClick={handleDisconnect}
            disabled={!isConnected}
          >
            연결 해제
          </button>
        </div>

        {/* 재연결 상태 표시 */}
        {reconnectInfo.isReconnecting && (
          <div
            style={{
              marginTop: "10px",
              padding: "10px",
              backgroundColor: "#fff3cd",
              border: "1px solid #ffc107",
              borderRadius: "4px",
            }}
          >
            <strong>⚠️ 재연결 시도 중</strong>
            <div>
              시도 횟수: {reconnectInfo.attempts} / {reconnectInfo.maxAttempts}
            </div>
            <div style={{ marginTop: "5px" }}>
              <progress
                value={reconnectInfo.attempts}
                max={reconnectInfo.maxAttempts}
                style={{ width: "100%" }}
              />
            </div>
          </div>
        )}

        {/* 최대 재연결 도달 알림 */}
        {maxReconnectReached && (
          <div
            style={{
              marginTop: "10px",
              padding: "10px",
              backgroundColor: "#f8d7da",
              border: "1px solid #f5c6cb",
              borderRadius: "4px",
            }}
          >
            <strong>❌ 연결 실패</strong>
            <div>
              최대 재연결 시도 횟수({reconnectInfo.maxAttempts}회)에
              도달했습니다.
            </div>
            <div>서버 상태를 확인하고 다시 시도해주세요.</div>
          </div>
        )}
      </div>

      {/* 메시지 전송 */}
      <div style={{ marginBottom: "20px" }}>
        <h2>메시지 전송</h2>
        <div style={{ display: "flex", gap: "10px", marginBottom: "10px" }}>
          <input
            type="text"
            placeholder="Destination (예: /app/chat)"
            value={topicInput}
            onChange={(e) => setTopicInput(e.target.value)}
            style={{ flex: 1, padding: "5px" }}
          />
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <input
            type="text"
            placeholder="메시지 내용"
            value={messageInput}
            onChange={(e) => setMessageInput(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
            style={{ flex: 1, padding: "5px" }}
          />
          <button
            type="button"
            onClick={handleSendMessage}
            disabled={!isConnected}
          >
            전송
          </button>
        </div>
      </div>

      {/* 레거시 토픽 구독 (TopicPlugin 미사용 시에만 표시) */}
      {!useTopicPlugin && (
        <div
          style={{
            marginBottom: "20px",
            border: "1px solid #dc3545",
            padding: "15px",
            borderRadius: "8px",
          }}
        >
          <h2 style={{ color: "#dc3545" }}>🔧 레거시 토픽 구독</h2>
          <div style={{ display: "flex", gap: "10px", marginBottom: "10px" }}>
            <input
              type="text"
              placeholder="Topic (예: /topic/test)"
              value={subscribeTopicInput}
              onChange={(e) => setSubscribeTopicInput(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleSubscribe()}
              style={{ flex: 1, padding: "5px" }}
            />
            <button
              type="button"
              onClick={handleSubscribe}
              disabled={!isConnected}
              style={{
                backgroundColor: "#dc3545",
                color: "white",
                border: "none",
                padding: "5px 10px",
                borderRadius: "4px",
              }}
            >
              구독
            </button>
          </div>

          {/* 구독 중인 토픽 목록 */}
          {subscribedTopics.length > 0 && (
            <div>
              <h3>구독 중인 토픽:</h3>
              <ul>
                {subscribedTopics.map((topic, index) => (
                  <li
                    key={`subscribed-${index}-${topic}`}
                    style={{ marginBottom: "5px" }}
                  >
                    <span>{topic}</span>
                    <button
                      type="button"
                      onClick={() => handleUnsubscribe(topic)}
                      style={{
                        marginLeft: "10px",
                        fontSize: "12px",
                        backgroundColor: "#dc3545",
                        color: "white",
                        border: "none",
                        padding: "2px 6px",
                        borderRadius: "3px",
                      }}
                    >
                      구독 해제
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* 구독 정보 표시 */}
          <div style={{ marginTop: "15px" }}>
            <h4 style={{ fontSize: "14px" }}>레거시 컨트롤러 구독 정보:</h4>
            <div style={{ fontSize: "12px", color: "#666" }}>
              {getSubscriptionInfo().map((info, index) => (
                <div
                  key={`info-${index}-${info.topic}`}
                  style={{ marginBottom: "3px" }}
                >
                  {info.topic} {info.isActive ? " ✅" : " ❌"}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TopicPlugin 섹션 (TopicPlugin 사용 시에만 표시) */}
      {useTopicPlugin && (
        <div
          style={{
            marginBottom: "20px",
            border: "2px solid #007bff",
            padding: "15px",
            borderRadius: "8px",
          }}
        >
          <h2 style={{ color: "#007bff" }}>
            🔌 TopicPlugin 테스트
            <button
              type="button"
              onClick={() => setPluginEnabled(!pluginEnabled)}
              style={{
                marginLeft: "10px",
                fontSize: "12px",
                backgroundColor: pluginEnabled ? "#dc3545" : "#28a745",
                color: "white",
                border: "none",
                padding: "5px 10px",
                borderRadius: "4px",
              }}
            >
              {pluginEnabled ? "숨기기" : "보이기"}
            </button>
          </h2>

          {pluginEnabled && (
            <>
              {/* 플러그인 토픽 구독 */}
              <div style={{ marginBottom: "15px" }}>
                <h3 style={{ fontSize: "16px" }}>
                  토픽 구독 등록 (연결 전에도 가능)
                </h3>
                <div
                  style={{
                    display: "flex",
                    gap: "10px",
                    marginBottom: "10px",
                    alignItems: "center",
                  }}
                >
                  <input
                    type="text"
                    placeholder="Topic (예: /topic/plugin-test)"
                    value={pluginTopicInput}
                    onChange={(e) => setPluginTopicInput(e.target.value)}
                    style={{ flex: 1, padding: "5px" }}
                  />
                  <button
                    type="button"
                    onClick={handlePluginSubscribe}
                    style={{
                      backgroundColor: "#007bff",
                      color: "white",
                      border: "none",
                      padding: "5px 10px",
                      borderRadius: "4px",
                    }}
                  >
                    플러그인 구독
                  </button>
                </div>
              </div>

              {/* 플러그인 구독 토픽 목록 */}
              {pluginTopics.length > 0 && (
                <div style={{ marginBottom: "15px" }}>
                  <h3 style={{ fontSize: "16px" }}>플러그인 구독 토픽 목록:</h3>
                  <div
                    style={{
                      border: "1px solid #ddd",
                      borderRadius: "4px",
                      padding: "10px",
                      backgroundColor: "#f8f9fa",
                    }}
                  >
                    {pluginTopics.map((topicInfo, index) => (
                      <div
                        key={`plugin-${index}-${topicInfo.topic}`}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginBottom: "8px",
                          padding: "8px",
                          backgroundColor: "white",
                          borderRadius: "4px",
                          border: "1px solid #e9ecef",
                        }}
                      >
                        <div>
                          <span style={{ fontWeight: "bold" }}>
                            {topicInfo.topic}
                          </span>
                          <span
                            style={{
                              marginLeft: "10px",
                              padding: "2px 6px",
                              borderRadius: "3px",
                              fontSize: "11px",
                              backgroundColor: "#28a745",
                              color: "white",
                            }}
                          >
                            구독
                          </span>
                          <span
                            style={{
                              marginLeft: "5px",
                              color: topicInfo.isActive ? "#28a745" : "#dc3545",
                            }}
                          >
                            {topicInfo.isActive ? "✅ 활성" : "❌ 비활성"}
                          </span>
                        </div>
                        <div>
                          <button
                            type="button"
                            onClick={() =>
                              handlePluginMessageListen(topicInfo.topic)
                            }
                            disabled={!topicInfo.isActive}
                            style={{
                              marginRight: "5px",
                              fontSize: "11px",
                              padding: "3px 8px",
                              backgroundColor: "#17a2b8",
                              color: "white",
                              border: "none",
                              borderRadius: "3px",
                              opacity: topicInfo.isActive ? 1 : 0.5,
                            }}
                          >
                            메시지 듣기
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              handlePluginUnsubscribe(topicInfo.topic)
                            }
                            style={{
                              fontSize: "11px",
                              padding: "3px 8px",
                              backgroundColor: "#dc3545",
                              color: "white",
                              border: "none",
                              borderRadius: "3px",
                            }}
                          >
                            구독 해제
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 플러그인 설명 */}
              <div
                style={{
                  backgroundColor: "#e3f2fd",
                  padding: "10px",
                  borderRadius: "4px",
                  fontSize: "12px",
                  color: "#0d47a1",
                }}
              >
                <strong>🔌 TopicPlugin 특징:</strong>
                <ul style={{ margin: "5px 0", paddingLeft: "20px" }}>
                  <li>
                    <strong>연결 전 구독:</strong> 연결하기 전에도 토픽 구독
                    등록 가능
                  </li>
                  <li>
                    <strong>임시 구독:</strong> 연결 해제 시 자동으로 제거됨
                  </li>
                  <li>
                    <strong>영구 구독:</strong> 연결 해제 후에도 유지되어 재연결
                    시 자동 복원
                  </li>
                  <li>
                    <strong>캡슐화:</strong> 플러그인을 통해서만 토픽 관리 가능
                  </li>
                  <li>
                    <strong>자동 복원:</strong> 재연결 시 영구 구독 토픽들이
                    자동으로 다시 구독됨
                  </li>
                </ul>
              </div>
            </>
          )}
        </div>
      )}

      {/* 연결 로그 */}
      <div style={{ marginBottom: "20px" }}>
        <h2>
          연결 로그
          <button
            type="button"
            onClick={clearLogs}
            style={{ marginLeft: "10px", fontSize: "12px" }}
          >
            Clear
          </button>
        </h2>
        <div
          style={{
            border: "1px solid #ccc",
            padding: "10px",
            height: "150px",
            overflowY: "auto",
            backgroundColor: "#f5f5f5",
          }}
        >
          {connectionLog.length === 0 ? (
            <div style={{ color: "#999" }}>로그가 없습니다</div>
          ) : (
            connectionLog.map((log, index) => (
              <div
                key={`log-${index}-${log.substring(0, 20)}`}
                style={{ marginBottom: "5px" }}
              >
                {log}
              </div>
            ))
          )}
        </div>
      </div>

      {/* 수신 메시지 */}
      <div>
        <h2>수신 메시지</h2>
        <div
          style={{
            border: "1px solid #ccc",
            padding: "10px",
            height: "200px",
            overflowY: "auto",
            backgroundColor: "#f5f5f5",
          }}
        >
          {messages.length === 0 ? (
            <div style={{ color: "#999" }}>수신된 메시지가 없습니다</div>
          ) : (
            messages.map((msg, index) => (
              <div
                key={`msg-${index}-${msg.substring(0, 20)}`}
                style={{
                  marginBottom: "5px",
                  padding: "5px",
                  backgroundColor: "#fff",
                  borderRadius: "3px",
                }}
              >
                {msg}
              </div>
            ))
          )}
        </div>
      </div>

      {/* 사용 가이드 */}
      <div style={{ marginTop: "30px", fontSize: "12px", color: "#666" }}>
        <h3>@rfice/stomp 라이브러리 사용 가이드:</h3>
        <ul>
          <li>페이지 로드 시 자동으로 서버에 연결됩니다</li>
          <li>
            <strong>레거시 모드:</strong> 연결 후 /topic/common/broadcast 토픽을
            자동으로 구독합니다
          </li>
          <li>
            <strong>플러그인 모드:</strong> TopicPlugin이 영구 구독 토픽들을
            자동 관리합니다
          </li>
          <li>기본 구독: 연결 해제 시 구독이 해제됩니다</li>
          <li>
            새로운 StompNetworkController를 사용하여 모든 기능을 관리합니다
          </li>
          <li>Observable 패턴으로 모든 이벤트를 처리합니다</li>
          <li>자동 재연결 및 구독 복원 기능이 포함되어 있습니다</li>
          <li>
            🔗 <strong>OOP 통합:</strong> TopicPlugin 활성화 시
            StompNetworkController의 subscribe/unsubscribe 메서드도 자동으로
            TopicPlugin을 통해 동작 (투명한 통합)
          </li>
          <li>
            🔌 <strong>TopicPlugin:</strong> 플러그인 시스템을 통한 고급 토픽
            관리
          </li>
          <li>
            🔌 <strong>연결 전 구독:</strong> 연결하기 전에도 토픽 구독 등록
            가능
          </li>
          <li>
            🔌 <strong>구독 유지:</strong> 연결 해제 후에도 유지되어 재연결 시
            자동 복원 (Authorization 헤더 수정 포함)
          </li>
          <li>
            🔌 <strong>캡슐화:</strong> 플러그인을 통해서만 토픽 관리하여 안전성
            보장
          </li>
        </ul>
      </div>
    </div>
  );
}
