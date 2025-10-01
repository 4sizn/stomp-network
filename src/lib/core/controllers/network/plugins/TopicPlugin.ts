import { Observable, Subscription } from "rxjs";
import { map, catchError } from "rxjs/operators";
import { IMessage } from "@stomp/stompjs";
import { AbstractPlugin } from "./AbstractPlugin";
// TopicPlugin is standalone and doesn't directly reference StompNetworkController

/**
 * 토픽 구독 정보
 */
export interface TopicSubscriptionInfo {
  topic: string;
  subscription?: Subscription | undefined;
  isActive: boolean;
  createdAt: Date;
}

/**
 * TopicPlugin - 고급 토픽 구독 관리 플러그인
 *
 * 기능:
 * - 연결 전 단계에서 토픽 구독 설정 가능
 * - 구독 자동 복원 (재연결 시)
 * - 캡슐화된 토픽 관리
 */
export class TopicPlugin extends AbstractPlugin {
  public readonly name = "TopicPlugin";

  // 토픽 구독 정보 저장소
  private topicSubscriptions = new Map<string, TopicSubscriptionInfo>();

  // 활성 구독 관리
  private activeSubscriptions = new Map<string, Subscription>();

  // ============================================
  // Public API - 캡슐화된 토픽 관리
  // ============================================

  /**
   * 토픽 구독 등록 (연결 전에도 가능)
   */
  public subscribeTopic(topic: string): void {
    // 중복 구독 방지
    if (this.topicSubscriptions.has(topic)) {
      console.log(`[TopicPlugin] 이미 등록된 토픽: ${topic}`);
      return;
    }

    console.log(`[TopicPlugin] 토픽 구독 등록: ${topic}`);

    const subscriptionInfo: TopicSubscriptionInfo = {
      topic,
      isActive: false,
      createdAt: new Date(),
    };

    this.topicSubscriptions.set(topic, subscriptionInfo);

    // 이미 연결된 상태라면 즉시 구독 시도
    if (this.controller?.isConnected()) {
      this._activateSubscription(topic);
    }
  }

  /**
   * 토픽 구독 해제
   */
  public unsubscribeTopic(topic: string): void {
    console.log(`[TopicPlugin] 토픽 구독 해제: ${topic}`);

    // 활성 구독 해제
    this._deactivateSubscription(topic);

    // 구독 정보에서 제거
    this.topicSubscriptions.delete(topic);
  }

  /**
   * 특정 토픽의 메시지 Observable 반환
   */
  public getTopicMessages(topic: string): Observable<IMessage> {
    if (!this.controller) {
      throw new Error("TopicPlugin이 컨트롤러에 연결되지 않았습니다");
    }

    return this.controller.getMessagesForTopic(topic);
  }

  /**
   * 구독 중인 토픽 목록 반환
   */
  public getSubscribedTopics(): string[] {
    return Array.from(this.topicSubscriptions.keys());
  }

  /**
   * 구독 토픽 목록 반환
   */
  public getPersistentTopics(): string[] {
    return Array.from(this.topicSubscriptions.values())
      .map((info) => info.topic);
  }

  /**
   * 토픽 구독 상태 확인
   */
  public isTopicSubscribed(topic: string): boolean {
    const info = this.topicSubscriptions.get(topic);
    return info?.isActive || false;
  }

  /**
   * 토픽 구독 정보 조회
   */
  public getTopicInfo(topic: string): TopicSubscriptionInfo | undefined {
    return this.topicSubscriptions.get(topic);
  }

  /**
   * 모든 토픽 구독 정보 조회
   */
  public getAllTopicInfo(): TopicSubscriptionInfo[] {
    return Array.from(this.topicSubscriptions.values());
  }

  // ============================================
  // Plugin Lifecycle Hooks
  // ============================================

  protected onAttach(): void {
    console.log(`[TopicPlugin] 컨트롤러에 연결됨`);
  }

  protected onDetach(): void {
    console.log(`[TopicPlugin] 컨트롤러에서 분리됨`);
    this._deactivateAllSubscriptions();
  }

  public async onBeforeConnect(): Promise<void> {
    console.log(`[TopicPlugin] 연결 전 처리 - 구독 토픽 준비`);
    // 연결 전 단계에서는 특별한 처리 없음
    // 구독 정보는 이미 topicSubscriptions에 저장되어 있음
  }

  public async onAfterConnect(): Promise<void> {
    console.log(`[TopicPlugin] 연결 후 처리 - 모든 구독 토픽 활성화`);

    // 모든 등록된 토픽을 활성화
    for (const topic of this.topicSubscriptions.keys()) {
      await this._activateSubscription(topic);
    }
  }

  public async onBeforeDisconnect(): Promise<void> {
    console.log(`[TopicPlugin] 연결 해제 전 처리 - 활성 구독 정리`);
    // 모든 활성 구독 해제
    this._deactivateAllSubscriptions();
  }

  public async onAfterDisconnect(): Promise<void> {
    console.log(`[TopicPlugin] 연결 해제 후 처리 - 구독 정보 유지`);

    // 모든 구독 토픽들은 유지 (재연결 시 복원용)
    const subscribedTopics = this.getPersistentTopics();
    console.log(`[TopicPlugin] 구독 토픽 유지:`, subscribedTopics);
  }

  // ============================================
  // Private Methods
  // ============================================

  /**
   * 토픽 구독 활성화
   */
  private async _activateSubscription(topic: string): Promise<void> {
    if (!this.controller || !this.controller.isConnected()) {
      console.warn(`[TopicPlugin] 연결되지 않은 상태에서 구독 시도: ${topic}`);
      return;
    }

    const subscriptionInfo = this.topicSubscriptions.get(topic);
    if (!subscriptionInfo) {
      console.warn(`[TopicPlugin] 등록되지 않은 토픽: ${topic}`);
      return;
    }

    if (subscriptionInfo.isActive) {
      console.log(`[TopicPlugin] 이미 활성화된 토픽: ${topic}`);
      return;
    }

    try {
      // OOP 통합으로 인한 무한 참조를 피하기 위해 직접 레거시 구독 로직 호출
      const messageObservable = this._subscribeDirectly(topic);

      // 구독 정보 업데이트
      subscriptionInfo.isActive = true;
      subscriptionInfo.subscription = messageObservable.subscribe();

      // 활성 구독 맵에 저장
      this.activeSubscriptions.set(topic, subscriptionInfo.subscription);

      console.log(`[TopicPlugin] 토픽 구독 활성화 완료: ${topic}`);
    } catch (error) {
      console.error(`[TopicPlugin] 토픽 구독 활성화 실패: ${topic}`, error);
    }
  }

  /**
   * 토픽 구독 비활성화
   */
  private _deactivateSubscription(topic: string): void {
    const subscriptionInfo = this.topicSubscriptions.get(topic);
    const activeSubscription = this.activeSubscriptions.get(topic);

    if (activeSubscription) {
      try {
        // WebSocket 상태 확인 후 구독 해제
        if (this.controller?.isConnected()) {
          activeSubscription.unsubscribe();
        } else {
          console.log(
            `[TopicPlugin] WebSocket 닫힘 - ${topic} 로컬 구독만 정리`
          );
        }
      } catch (error) {
        console.warn(
          `[TopicPlugin] ${topic} 구독 해제 중 에러 (무시됨):`,
          error
        );
      }
      this.activeSubscriptions.delete(topic);
    }

    if (subscriptionInfo) {
      subscriptionInfo.isActive = false;
      subscriptionInfo.subscription = undefined;
    }

    console.log(`[TopicPlugin] 토픽 구독 비활성화: ${topic}`);
  }

  /**
   * OOP 통합을 우회하여 직접 레거시 구독 수행
   * (무한 참조 방지를 위해)
   */
  private _subscribeDirectly(topic: string): Observable<IMessage> {
    if (!this.controller) {
      throw new Error("TopicPlugin이 컨트롤러에 연결되지 않았습니다");
    }

    // StompNetworkController의 레거시 구독 로직을 직접 호출
    // TopicPlugin이 있어도 무시하고 직접 STOMP 구독 수행
    const stompClient = (this.controller as any).stompClient;
    const adapter = stompClient.getAdapter();

    return adapter
      .subscribe(topic)
      .pipe(
        map((message: any) => {
          // 컨트롤러의 messageSubject에도 알림
          (this.controller as any).messageSubject.next(message);
          return message;
        }),
        catchError((error: any) => {
          console.error(`[TopicPlugin] 직접 구독 에러: ${topic}`, error);
          throw error;
        })
      );
  }

  /**
   * 모든 활성 구독 비활성화
   */
  private _deactivateAllSubscriptions(): void {
    console.log(`[TopicPlugin] 모든 활성 구독 비활성화`);

    for (const topic of this.activeSubscriptions.keys()) {
      this._deactivateSubscription(topic);
    }
  }
}