import { IMessage } from "@stomp/stompjs";
import {
  Observable,
  BehaviorSubject,
  Subject,
  Subscription,
  EMPTY,
} from "rxjs";
import { filter, map, catchError, distinctUntilChanged } from "rxjs/operators";

import { StompWebSocketClient } from "../../../infrastructure/webSocket/stomp/StompClient";
import { AbstractController } from "../../abstract/AbstractController";
import { AbstractPlugin } from "./plugins/AbstractPlugin";

// Types and Errors
import {
  NetworkControllerConfig,
  SubscriptionInfo,
  ReconnectInfo,
  MessageFilter,
  ConnectionState,
  StompClientConfig,
} from "./types/NetworkControllerTypes";
import { StompConnectionError } from "./errors/StompConnectionError";
import { StompSubscriptionError } from "./errors/StompSubscriptionError";
import { StompMessageError } from "./errors/StompMessageError";
import { StompReconnectionError } from "./errors/StompReconnectionError";

export class StompNetworkController extends AbstractController {
  public readonly name = "StompNetworkController";

  // Core dependencies
  protected readonly stompClient: StompWebSocketClient;
  private config: NetworkControllerConfig;

  // Plugin system
  private plugins = new Map<string, AbstractPlugin>();

  // Subscription management
  private subscriptionMap = new Map<string, SubscriptionInfo>();

  // Observable state management
  private connectionState$ = new BehaviorSubject<ConnectionState>(
    ConnectionState.DISCONNECTED
  );
  private connectSubject = new Subject<void>();
  private disconnectSubject = new Subject<void>();
  private errorSubject = new Subject<Error>();
  private messageSubject = new Subject<IMessage>();
  private reconnectAttemptSubject = new Subject<ReconnectInfo>();
  private maxReconnectReachedSubject = new Subject<void>();

  // Internal subscriptions
  private internalSubscriptions: Subscription[] = [];

  constructor(stompClient: StompWebSocketClient) {
    super();
    this.stompClient = stompClient;
    // 기본값만 설정 (StompClientConfig에서 오버라이드됨)
    this.config = {
      maxReconnectAttempts: 5,
      reconnectDelay: 3000,
    };

    this.initializeEventListeners();
  }

  // ============================================
  // Public Observable Streams
  // ============================================

  /**
   * 연결 상태 Observable
   */
  public get connectionState(): Observable<ConnectionState> {
    return this.connectionState$.asObservable();
  }

  /**
   * 연결 이벤트 Observable
   */
  public get connect$(): Observable<void> {
    return this.connectSubject.asObservable();
  }

  /**
   * 연결 해제 이벤트 Observable
   */
  public get disconnect$(): Observable<void> {
    return this.disconnectSubject.asObservable();
  }

  /**
   * 에러 이벤트 Observable
   */
  public get error$(): Observable<Error> {
    return this.errorSubject.asObservable();
  }

  /**
   * 모든 메시지 Observable
   */
  public get message$(): Observable<IMessage> {
    return this.messageSubject.asObservable();
  }

  /**
   * 재연결 시도 Observable
   */
  public get reconnectAttempt$(): Observable<ReconnectInfo> {
    return this.reconnectAttemptSubject.asObservable();
  }

  /**
   * 최대 재연결 도달 Observable
   */
  public get maxReconnectReached$(): Observable<void> {
    return this.maxReconnectReachedSubject.asObservable();
  }

  /**
   * 연결 상태 변경 감지 Observable
   */
  public get connectionChanges$(): Observable<ConnectionState> {
    return this.connectionState$.pipe(distinctUntilChanged());
  }

  // ============================================
  // Plugin Management
  // ============================================

  /**
   * 플러그인 추가
   */
  public addPlugin(plugin: AbstractPlugin): void {
    console.log(`[StompNetworkController] 플러그인 추가: ${plugin.name}`);

    if (this.plugins.has(plugin.name)) {
      throw new Error(`플러그인이 이미 등록됨: ${plugin.name}`);
    }

    this.plugins.set(plugin.name, plugin);
    plugin.attach(this);
  }

  /**
   * 플러그인 제거
   */
  public removePlugin(pluginName: string): void {
    console.log(`[StompNetworkController] 플러그인 제거: ${pluginName}`);

    const plugin = this.plugins.get(pluginName);
    if (plugin) {
      plugin.detach();
      this.plugins.delete(pluginName);
    }
  }

  /**
   * 플러그인 조회
   */
  public getPlugin<T extends AbstractPlugin>(
    pluginName: string
  ): T | undefined {
    return this.plugins.get(pluginName) as T;
  }

  /**
   * 등록된 플러그인 목록
   */
  public getPluginNames(): string[] {
    return Array.from(this.plugins.keys());
  }

  /**
   * TopicPlugin 인스턴스 가져오기 (OOP 통합을 위한 헬퍼)
   */
  private getTopicPlugin(): any | null {
    try {
      return this.getPlugin("TopicPlugin");
    } catch {
      return null;
    }
  }

  // ============================================
  // Connection Management
  // ============================================

  /**
   * STOMP 서버에 연결 (플러그인 훅 포함)
   */
  public async connect(config: StompClientConfig): Promise<void> {
    try {
      this.connectionState$.next(ConnectionState.CONNECTING);

      // 플러그인 연결 전 훅 실행
      await this._executePluginHooks("onBeforeConnect");

      // 재연결 시도 횟수 리셋
      const adapter = this.stompClient.getAdapter();
      adapter.resetReconnectAttempts();

      // StompClientConfig에서 재연결 설정 추출
      const { maxAttempts, delay, ...stompConfig } = config;

      await this.stompClient.connect({
        ...stompConfig,
        maxAttempts: maxAttempts || this.config.maxReconnectAttempts,
        delay: delay || this.config.reconnectDelay,
      });

      this.connectionState$.next(ConnectionState.CONNECTED);

      // 플러그인 연결 후 훅 실행
      await this._executePluginHooks("onAfterConnect");
    } catch (error) {
      this.connectionState$.next(ConnectionState.FAILED);
      const connectionError = new StompConnectionError(
        "STOMP 연결 실패",
        error
      );
      this.errorSubject.next(connectionError);
      throw connectionError;
    }
  }

  /**
   * STOMP 연결 해제 (플러그인 훅 포함)
   */
  public async disconnect(): Promise<void> {
    try {
      // 플러그인 연결 해제 전 훅 실행
      await this._executePluginHooks("onBeforeDisconnect");

      // 모든 활성 구독 해제
      this.subscriptionMap.forEach((info) => {
        info.subscription.unsubscribe();
      });
      this.subscriptionMap.clear();

      // STOMP 클라이언트 연결 해제
      this.stompClient.disconnect();
      this.connectionState$.next(ConnectionState.DISCONNECTED);

      // 플러그인 연결 해제 후 훅 실행
      await this._executePluginHooks("onAfterDisconnect");
    } catch (error) {
      const disconnectError = new StompConnectionError(
        "STOMP 연결 해제 실패",
        error
      );
      this.errorSubject.next(disconnectError);
      throw disconnectError;
    }
  }

  /**
   * 연결 상태 확인
   */
  public isConnected(): boolean {
    return this.connectionState$.value === ConnectionState.CONNECTED;
  }

  /**
   * 현재 연결 상태 반환
   */
  public getCurrentConnectionState(): ConnectionState {
    return this.connectionState$.value;
  }

  // ============================================
  // Subscription Management
  // ============================================

  /**
   * 토픽 구독 (TopicPlugin이 있으면 자동으로 플러그인 기반 구독 사용)
   */
  public subscribe(topic: string): Observable<IMessage> {
    try {
      // TopicPlugin이 있으면 플러그인 기반 구독 사용
      const topicPlugin = this.getTopicPlugin();
      if (topicPlugin) {
        console.log(`[StompNetworkController] TopicPlugin 기반 구독: ${topic}`);
        // TopicPlugin에 토픽 등록 (이미 등록된 경우 중복 방지됨)
        topicPlugin.subscribeTopic(topic);
        // TopicPlugin의 Observable 반환
        return topicPlugin.getTopicMessages(topic);
      }

      // 기존 직접 구독 로직
      if (!this.isConnected()) {
        throw new StompSubscriptionError(
          "연결되지 않은 상태에서는 구독할 수 없습니다",
          topic
        );
      }

      if (this.subscriptionMap.has(topic)) {
        console.log(`이미 구독 중인 토픽: ${topic}`);
        // 이미 구독 중인 경우 기존 Observable 반환
        return this.getMessagesForTopic(topic);
      }

      console.log(`토픽 구독 시작: ${topic}`);

      const adapter = this.stompClient.getAdapter();
      const subscription = adapter
        .subscribe(topic)
        .pipe(
          map((message) => {
            this.messageSubject.next(message);
            return message;
          }),
          catchError((error) => {
            console.error(`토픽 구독 에러: ${topic}`, error);
            const subscriptionError = new StompSubscriptionError(
              `토픽 구독 에러: ${topic}`,
              topic,
              error
            );
            this.errorSubject.next(subscriptionError);
            this.removeSubscription(topic);
            return EMPTY;
          })
        )
        .subscribe({
          next: () => {
            console.log(`토픽 구독 성공: ${topic}`);
          },
          error: (error) => {
            console.error(`토픽 구독 실패: ${topic}`, error);
          },
        });

      // 구독 정보 저장 (레거시 모드는 모든 구독이 임시)
      const subscriptionInfo: SubscriptionInfo = {
        topic,
        subscription,
        isPersistent: false, // 레거시 모드는 항상 임시 구독
        createdAt: new Date(),
      };

      this.subscriptionMap.set(topic, subscriptionInfo);
      // 레거시 모드에서는 persistentTopics 사용하지 않음

      return this.getMessagesForTopic(topic);
    } catch (error) {
      console.error(`토픽 구독 실패: ${topic}`, error);
      if (error instanceof StompSubscriptionError) {
        throw error;
      }
      throw new StompSubscriptionError(
        `토픽 구독 실패: ${topic}`,
        topic,
        error
      );
    }
  }

  /**
   * 토픽 구독 해제 (TopicPlugin이 있으면 자동으로 플러그인 기반 해제 사용)
   */
  public async unsubscribe(topic: string): Promise<void> {
    try {
      // TopicPlugin이 있으면 플러그인 기반 구독 해제 사용
      const topicPlugin = this.getTopicPlugin();
      if (topicPlugin) {
        console.log(`[StompNetworkController] TopicPlugin 기반 구독 해제: ${topic}`);
        topicPlugin.unsubscribeTopic(topic);
        return;
      }

      // 기존 직접 구독 해제 로직
      const subscriptionInfo = this.subscriptionMap.get(topic);
      if (!subscriptionInfo) {
        throw new StompSubscriptionError(`구독되지 않은 토픽: ${topic}`, topic);
      }

      // 구독 해제
      subscriptionInfo.subscription.unsubscribe();
      this.subscriptionMap.delete(topic);
      // 레거시 모드에서는 persistentTopics 사용하지 않으므로 삭제 불필요
    } catch (error) {
      if (error instanceof StompSubscriptionError) {
        throw error;
      }
      throw new StompSubscriptionError(
        `토픽 구독 해제 실패: ${topic}`,
        topic,
        error
      );
    }
  }

  /**
   * 모든 구독 해제 (TopicPlugin이 있으면 플러그인 기반 해제 사용)
   */
  public async unsubscribeAll(): Promise<void> {
    // TopicPlugin이 있으면 플러그인의 모든 구독 해제
    const topicPlugin = this.getTopicPlugin();
    if (topicPlugin) {
      console.log(`[StompNetworkController] TopicPlugin 기반 모든 구독 해제`);
      const subscribedTopics = topicPlugin.getSubscribedTopics();
      subscribedTopics.forEach((topic: string) => {
        topicPlugin.unsubscribeTopic(topic);
      });
      return;
    }

    // 기존 직접 구독 해제 로직
    const topics = Array.from(this.subscriptionMap.keys());
    const unsubscribePromises = topics.map((topic) => this.unsubscribe(topic));
    await Promise.all(unsubscribePromises);
  }

  /**
   * 구독 여부 확인 (TopicPlugin이 있으면 플러그인 기반 확인 사용)
   */
  public isSubscribed(topic: string): boolean {
    // TopicPlugin이 있으면 플러그인의 구독 상태 확인
    const topicPlugin = this.getTopicPlugin();
    if (topicPlugin) {
      return topicPlugin.isTopicSubscribed(topic);
    }

    // 기존 직접 구독 확인 로직
    return this.subscriptionMap.has(topic);
  }

  /**
   * 구독 중인 토픽 목록 반환 (TopicPlugin이 있으면 플러그인 기반 목록 사용)
   */
  public getSubscribedTopics(): string[] {
    // TopicPlugin이 있으면 플러그인의 구독 목록 반환
    const topicPlugin = this.getTopicPlugin();
    if (topicPlugin) {
      return topicPlugin.getSubscribedTopics();
    }

    // 기존 직접 구독 목록 반환
    return Array.from(this.subscriptionMap.keys());
  }

  /**
   * 영구 구독 토픽 목록 반환 (TopicPlugin이 있으면 플러그인 기반 목록 사용)
   */
  public getPersistentTopics(): string[] {
    // TopicPlugin이 있으면 모든 토픽이 영구 구독이므로 동일한 목록 반환
    const topicPlugin = this.getTopicPlugin();
    if (topicPlugin) {
      return topicPlugin.getPersistentTopics();
    }

    // 레거시 모드에서는 영구 구독 기능 없음 (빈 배열 반환)
    return [];
  }

  // ============================================
  // Message Handling
  // ============================================

  /**
   * 특정 토픽의 메시지 Observable
   */
  public getMessagesForTopic(topic: string): Observable<IMessage> {
    return this.messageSubject.pipe(
      filter((message) => {
        const destination = message.headers.destination;
        return destination === topic;
      })
    );
  }

  /**
   * 필터링된 메시지 Observable
   */
  public getFilteredMessages(
    messageFilter: MessageFilter
  ): Observable<IMessage> {
    return this.messageSubject.pipe(filter(messageFilter));
  }

  /**
   * 메시지 전송
   */
  public sendMessage(topic: string, message: unknown): void {
    try {
      if (!this.isConnected()) {
        throw new StompMessageError(
          "연결되지 않은 상태에서는 메시지를 전송할 수 없습니다",
          topic,
          message
        );
      }

      const adapter = this.stompClient.getAdapter();
      const messageBody =
        typeof message === "string" ? message : JSON.stringify(message);

      adapter.sendToDestination(topic, messageBody);
    } catch (error) {
      if (error instanceof StompMessageError) {
        throw error;
      }
      throw new StompMessageError(
        `메시지 전송 실패: ${topic}`,
        topic,
        message,
        error
      );
    }
  }

  // ============================================
  // Private Methods
  // ============================================

  /**
   * 이벤트 리스너 초기화
   */
  private initializeEventListeners(): void {
    const adapter = this.stompClient.getAdapter();

    // 연결 이벤트
    const connectSub = adapter.connect$.subscribe(() => {
      this.connectionState$.next(ConnectionState.CONNECTED);
      this.connectSubject.next();
      // 영구 구독 복원 비활성화 (테스트 목적) -> 플러그인 훅으로 대체
      // console.log("연결 완료 - 영구 구독 복원 비활성화됨");
      
      // 연결 완료 시 플러그인 훅 실행 (재연결 시에도 실행됨)
      this._executePluginHooks("onAfterConnect").catch((err) => {
        console.error("Failed to execute onAfterConnect hooks", err);
      });
    });

    // 연결 해제 이벤트
    const disconnectSub = adapter.disconnect$.subscribe(() => {
      this.connectionState$.next(ConnectionState.DISCONNECTED);
      this.disconnectSubject.next();
      
      // 연결 해제 시 플러그인 훅 실행 (비정상 종료 시에도 실행됨)
      // onBeforeDisconnect를 호출하여 구독 상태를 정리(isActive=false)하게 함
      this._executePluginHooks("onBeforeDisconnect").catch((err) => {
        console.error("Failed to execute onBeforeDisconnect hooks", err);
      });

      this.cleanupActiveSubscriptions();
    });

    // 에러 이벤트
    const errorSub = adapter.error$.subscribe((error) => {
      console.error("[StompNetworkController] STOMP 에러 발생:", error);

      // 심각한 에러인 경우 연결 상태를 FAILED로 변경
      if (this.connectionState$.value === ConnectionState.CONNECTED) {
        this.connectionState$.next(ConnectionState.FAILED);
      }

      this.errorSubject.next(error);
    });

    // 재연결 시도 이벤트
    const reconnectAttemptSub = adapter.reconnectAttempt$.subscribe(
      ({ attempt, max }) => {
        this.connectionState$.next(ConnectionState.RECONNECTING);
        this.reconnectAttemptSubject.next({
          attempts: attempt,
          maxAttempts: max,
          isReconnecting: true,
        });
      }
    );

    // 최대 재연결 도달 이벤트
    const maxReconnectReachedSub = adapter.maxReconnectReached$.subscribe(
      () => {
        this.connectionState$.next(ConnectionState.FAILED);
        this.maxReconnectReachedSubject.next();
        const reconnectionError = new StompReconnectionError(
          "최대 재연결 시도 횟수에 도달했습니다",
          this.config.maxReconnectAttempts,
          this.config.maxReconnectAttempts
        );
        this.errorSubject.next(reconnectionError);
      }
    );

    this.internalSubscriptions.push(
      connectSub,
      disconnectSub,
      errorSub,
      reconnectAttemptSub,
      maxReconnectReachedSub
    );
  }

  /**
   * 활성 구독들 정리
   */
  private cleanupActiveSubscriptions(): void {
    // WebSocket이 이미 닫힌 상태인지 확인
    const adapter = this.stompClient.getAdapter();
    const isWebSocketClosed = !adapter.isConnected();

    this.subscriptionMap.forEach((info) => {
      try {
        // WebSocket이 열려있을 때만 UNSUBSCRIBE 메시지 전송
        if (!isWebSocketClosed) {
          info.subscription.unsubscribe();
        } else {
          // WebSocket이 닫힌 상태면 로컬에서만 구독 정리
          console.log(
            `[StompNetworkController] WebSocket 닫힘 - 로컬 구독만 정리`
          );
        }
      } catch (error) {
        console.warn(
          `[StompNetworkController] 구독 해제 중 에러 (무시됨):`,
          error
        );
      }
    });
    this.subscriptionMap.clear();
  }

  /**
   * 구독 제거
   */
  private removeSubscription(topic: string): void {
    const subscriptionInfo = this.subscriptionMap.get(topic);
    if (subscriptionInfo) {
      try {
        // WebSocket 상태 확인 후 구독 해제
        const adapter = this.stompClient.getAdapter();
        if (adapter.isConnected()) {
          subscriptionInfo.subscription.unsubscribe();
        } else {
          console.log(
            `[StompNetworkController] WebSocket 닫힘 - ${topic} 로컬 구독만 정리`
          );
        }
      } catch (error) {
        console.warn(
          `[StompNetworkController] ${topic} 구독 해제 중 에러 (무시됨):`,
          error
        );
      }
      this.subscriptionMap.delete(topic);
    }
  }

  // ============================================
  // Private Plugin Methods
  // ============================================

  /**
   * 모든 플러그인의 특정 훅 실행
   */
  private async _executePluginHooks(
    hookName: keyof AbstractPlugin
  ): Promise<void> {
    const promises: Promise<void>[] = [];

    for (const plugin of this.plugins.values()) {
      const hook = plugin[hookName];
      if (typeof hook === "function") {
        promises.push((hook as () => Promise<void>).call(plugin));
      }
    }

    try {
      await Promise.all(promises);
      console.log(
        `[StompNetworkController] 플러그인 훅 실행 완료: ${hookName}`
      );
    } catch (error) {
      console.error(
        `[StompNetworkController] 플러그인 훅 실행 실패: ${hookName}`,
        error
      );
      throw error;
    }
  }

  /**
   * 리소스 정리 (플러그인 포함)
   */
  public destroy(): void {
    // 모든 플러그인 분리
    for (const plugin of this.plugins.values()) {
      plugin.detach();
    }
    this.plugins.clear();

    // 모든 내부 구독 해제
    this.internalSubscriptions.forEach((sub) => sub.unsubscribe());
    this.internalSubscriptions = [];

    // 모든 토픽 구독 해제
    this.cleanupActiveSubscriptions();
    // 레거시 모드에서는 persistentTopics 사용하지 않으므로 clear 불필요

    // Subject들 완료
    this.connectSubject.complete();
    this.disconnectSubject.complete();
    this.errorSubject.complete();
    this.messageSubject.complete();
    this.reconnectAttemptSubject.complete();
    this.maxReconnectReachedSubject.complete();
    this.connectionState$.complete();

    // STOMP 클라이언트 연결 해제
    if (this.isConnected()) {
      this.disconnect();
    }
  }
}