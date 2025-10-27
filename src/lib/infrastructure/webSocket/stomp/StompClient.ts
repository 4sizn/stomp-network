import {
  StompConfig,
  Client as StompClient,
  IMessage,
  IFrame,
} from "@stomp/stompjs";
import {
  Subject,
  Observable,
  BehaviorSubject,
  Subscription,
  timer,
} from "rxjs";
import {
  filter,
  distinctUntilChanged,
  skip,
  retry,
  takeUntil,
} from "rxjs/operators";

/**
 * @description
 * 재연결 시간 모드
 */
export enum ReconnectTimeMode {
  INTERVAL = "INTERVAL", // 고정 간격
  EXPONENTIAL = "EXPONENTIAL", // 지수백오프
}

/**
 * @description
 * 재연결 설정 인터페이스
 * use WebSocketClientAdapter
 */
export interface ReconnectConfig {
  maxAttempts?: number;
  delay?: number;
  tryReconnectTimeMode?: ReconnectTimeMode;
}

/**
 * @description
 * stomp/stompjs 라이브러리내, reconnectDelay와 reconnectTimeMode 는 내부 버그 문제로 프로퍼티를 사용하지 않습니다.
 * 재연결 및 지수백오프 자체구현 사용
 */
export type StompClientConfig = Omit<
  StompConfig,
  "reconnectDelay" | "reconnectTimeMode"
> &
  ReconnectConfig;

interface IWebSocketClientAdapter<_T = unknown> {
  connect(): Promise<void>;
  disconnect(): void;
  send(data: string): void;
  onMessage(callback: (data: string) => void): void;
  onError(callback: (error: IFrame | Error | Event) => void): void;
  onClose(callback: () => void): void;
  onConnect(callback: () => void): void;
}

export abstract class WebSocketClientAdapter<T, C>
  implements IWebSocketClientAdapter<T>
{
  protected client?: T;
  protected maxReconnectAttempts: number = 5; // 기본값 5회

  public abstract connect(config?: C): Promise<void>;
  public abstract disconnect(): void;
  public abstract send(data: string): void;
  public abstract onMessage(callback: (data: string) => void): void;
  public abstract onError(
    callback: (error: IFrame | Error | Event) => void
  ): void;
  public abstract onClose(callback: () => void): void;
  public abstract onConnect(callback: () => void): void;
  public abstract networkStatus(): number;
}

export class WebSocketClient<T, C> {
  constructor(private client?: WebSocketClientAdapter<T, C>) {
    this.client = client;
  }
  public connect(config: C): Promise<void> {
    return this.client!.connect(config);
  }
  public disconnect(): void {
    this.client!.disconnect();
  }
}

/**
 * @description
 * RxJS를 사용한 Reactive STOMP WebSocket Client Adapter
 * Observable 패턴을 통해 이벤트를 스트림으로 처리
 * 재연결 시도 횟수 제한 기능 포함
 */
export class StompWebSocketClientAdapter extends WebSocketClientAdapter<
  StompClient,
  StompConfig & ReconnectConfig
> {
  // 연결 상태를 추적하는 BehaviorSubject
  private connectionState$ = new BehaviorSubject<boolean>(false);

  // 이벤트 스트림들
  private connectSubject = new Subject<IFrame>();
  private disconnectSubject = new Subject<IFrame | CloseEvent>();
  private errorSubject = new Subject<IFrame | Error | Event>();
  private messageSubject = new Subject<string>();
  private stompMessageSubject = new Subject<IMessage>();

  // 재연결 관련 스트림
  private reconnectAttemptSubject = new Subject<{
    attempt: number;
    max: number;
  }>();
  private maxReconnectReachedSubject = new Subject<void>();
  private stopReconnect$ = new Subject<void>();

  // Observable로 외부에 노출
  public connect$ = this.connectSubject.asObservable();
  public disconnect$ = this.disconnectSubject.asObservable();
  public error$ = this.errorSubject.asObservable();
  public message$ = this.messageSubject.asObservable();
  public stompMessage$ = this.stompMessageSubject.asObservable();
  public connectionState = this.connectionState$.asObservable();
  public reconnectAttempt$ = this.reconnectAttemptSubject.asObservable();
  public maxReconnectReached$ = this.maxReconnectReachedSubject.asObservable();

  // 연결 상태 변경 감지
  public connectionChanges$ = this.connectionState$.pipe(
    distinctUntilChanged(),
    skip(1) // 초기값 스킵
  );

  private _reconnectAttempts = 0;
  private reconnectDelay = 5000; // 기본 재연결 지연 시간
  private subscriptions = new Map<string, any>();
  private rxSubscriptions: Subscription[] = [];
  private connectionSubscription?: Subscription | undefined;

  public async connect(config: StompConfig & ReconnectConfig): Promise<void> {
    // 재연결 설정
    if (config.maxAttempts !== undefined) {
      this.maxReconnectAttempts = config.maxAttempts;
    }
    if (config.delay !== undefined) {
      this.reconnectDelay = config.delay;
    }

    // 이전 연결이 있다면 정리
    if (this.connectionSubscription) {
      this.connectionSubscription.unsubscribe();
    }

    // RxJS Observable을 사용한 연결 시도
    const connectionAttempt$ = new Observable<boolean>((observer) => {
      let isManualDisconnect = false;

      const stompConfig: StompConfig = {
        ...config,
        // 자동 재연결 비활성화 (RxJS retry로 제어)
        reconnectDelay: 0,

        onConnect: (_frame: IFrame) => {
          console.log("STOMP 연결 성공");
          this._reconnectAttempts = 0;
          this.connectionState$.next(true);
          this.connectSubject.next(_frame);
          observer.next(true);
          // observer.complete() 제거 - 연결 성공 시 Observable을 완료하지 않음
        },

        onDisconnect: (_frame: IFrame) => {
          this.connectionState$.next(false);
          this.disconnectSubject.next(_frame);

          // 수동 연결 해제가 아닌 경우에만 에러로 처리
          if (!isManualDisconnect && !observer.closed) {
            observer.error(new Error("STOMP connection disconnected"));
          }
        },

        onStompError: (frame: IFrame) => {
          this.errorSubject.next(frame);
          if (!observer.closed) {
            const error = new Error(frame.headers["message"] || "STOMP Error");
            observer.error(error);
          }
        },

        onWebSocketError: (_event: Event) => {
          this.errorSubject.next(_event);
          if (!observer.closed) {
            const error = new Error("WebSocket Error");
            observer.error(error);
          }
        },

        onWebSocketClose: (event: CloseEvent) => {
          this.connectionState$.next(false);
          this.disconnectSubject.next(event);

          // 수동 연결 해제가 아닌 경우에만 에러로 처리
          if (!isManualDisconnect && !observer.closed) {
            observer.error(new Error("WebSocket connection closed"));
          }
        },
      };

      this.client = new StompClient(stompConfig);
      this.client.activate();

      // cleanup function - 수동 연결 해제 플래그 설정
      return () => {
        isManualDisconnect = true;
        if (this.client?.active) {
          this.client.deactivate();
        }
      };
    });

    // retry 연산자를 사용한 재연결 로직
    return new Promise((resolve, reject) => {
      let resolved = false;

      this.connectionSubscription = connectionAttempt$
        .pipe(
          retry({
            count: this.maxReconnectAttempts,
            delay: (error, retryCount) => {
              this._reconnectAttempts = retryCount;

              const baseDelay = this.reconnectDelay;
              const reconnectMode =
                config.tryReconnectTimeMode || ReconnectTimeMode.EXPONENTIAL;
              let actualDelay: number;

              // 재연결 모드에 따른 지연 시간 계산
              if (reconnectMode === ReconnectTimeMode.INTERVAL) {
                // 고정 간격 모드: 항상 동일한 지연 시간
                actualDelay = baseDelay;
              } else {
                // 지수백오프 모드: baseDelay * (2 ^ (retryCount - 1))
                const exponentialDelay =
                  baseDelay * Math.pow(2, retryCount - 1);
                const maxDelay = config.maxReconnectDelay || 30000; // 30초 최대 제한
                actualDelay = Math.min(exponentialDelay, maxDelay);
              }

              console.log(
                `재연결 시도 ${retryCount}/${this.maxReconnectAttempts}: ${error.message} (모드: ${reconnectMode}, 지연: ${actualDelay}ms)`
              );

              // 재연결 시도 이벤트 발생
              this.reconnectAttemptSubject.next({
                attempt: retryCount,
                max: this.maxReconnectAttempts,
              });

              // 계산된 지연 시간 후 재시도
              return timer(actualDelay);
            },
            resetOnSuccess: true,
          }),
          takeUntil(this.stopReconnect$)
          // take(1) 제거 - 연결 성공 후에도 Observable을 유지
        )
        .subscribe({
          next: () => {
            if (!resolved) {
              resolved = true;
              console.log("연결 성공");
              resolve();
            }
          },
          error: (error) => {
            if (!resolved) {
              console.error(
                `최대 재연결 시도 횟수(${this.maxReconnectAttempts}) 초과:`,
                error
              );

              // 최대 재연결 도달 이벤트 발생
              this.maxReconnectReachedSubject.next();
              this.errorSubject.next(
                new Error(
                  `Maximum reconnection attempts (${this.maxReconnectAttempts}) reached`
                )
              );

              reject(error);
            }
          },
        });
    });
  }

  public disconnect(): void {
    // 재연결 중단 신호 발생
    this.stopReconnect$.next();

    // 연결 구독 해제
    if (this.connectionSubscription) {
      this.connectionSubscription.unsubscribe();
      this.connectionSubscription = undefined;
    }

    // 모든 STOMP 구독 해제
    this.subscriptions.forEach((subscription) => subscription.unsubscribe());
    this.subscriptions.clear();

    // 모든 RxJS 구독 해제
    this.rxSubscriptions.forEach((sub) => sub.unsubscribe());
    this.rxSubscriptions = [];

    // STOMP 클라이언트 비활성화
    this.client?.deactivate();

    // 연결 상태 업데이트
    this.connectionState$.next(false);
    // Manual disconnect 시에는 특별한 Close Event 생성
    const manualCloseEvent = new CloseEvent("close", {
      code: 1000,
      reason: "Manual disconnect",
      wasClean: true,
    });
    this.disconnectSubject.next(manualCloseEvent);
  }

  /**
   * Observable 기반 메시지 구독
   * @param destination STOMP destination
   * @returns Observable<IMessage>
   */
  public subscribe(destination: string): Observable<IMessage> {
    return new Observable((observer) => {
      // 연결될 때까지 대기
      const waitForConnection = () => {
        if (this.client?.connected) {
          try {
            console.log(`STOMP 구독 시도: ${destination}`);
            const subscription = this.client.subscribe(
              destination,
              (message) => {
                console.log(`STOMP 메시지 수신: ${destination}`, message);
                this.stompMessageSubject.next(message);
                this.messageSubject.next(message.body);
                observer.next(message);
              }
            );

            this.subscriptions.set(destination, subscription);
            console.log(`STOMP 구독 성공: ${destination}`);

            // cleanup function
            return () => {
              console.log(`STOMP 구독 해제: ${destination}`);
              subscription.unsubscribe();
              this.subscriptions.delete(destination);
            };
          } catch (error: unknown) {
            console.error(`STOMP 구독 실패: ${destination}`, error);
            const errorMessage =
              error instanceof Error ? error.message : String(error);
            const subscriptionError = new Error(
              `구독 실패: ${destination} - ${errorMessage}`
            );
            this.errorSubject.next(subscriptionError);
            observer.error(subscriptionError);
            return () => {};
          }
        } else {
          // 연결 대기
          console.log(`연결 대기 중... 구독 대상: ${destination}`);
          const connectSub = this.connect$.subscribe(() => {
            connectSub.unsubscribe();
            const cleanup = waitForConnection();
            if (cleanup) {
              // 원래 Observable의 cleanup에 추가
              const originalCleanup = observer.closed ? () => {} : cleanup;
              observer.add(originalCleanup);
            }
          });

          return () => {
            connectSub.unsubscribe();
          };
        }
      };

      const cleanup = waitForConnection();
      return cleanup || (() => {});
    });
  }

  /**
   * 특정 헤더를 가진 메시지만 필터링하여 구독
   * @param destination STOMP destination
   * @param headerFilter 헤더 필터
   * @returns Observable<IMessage>
   */
  public subscribeWithFilter(
    destination: string,
    headerFilter: { [key: string]: string }
  ): Observable<IMessage> {
    return this.subscribe(destination).pipe(
      filter((message) => {
        return Object.entries(headerFilter).every(
          ([key, value]) => message.headers[key] === value
        );
      })
    );
  }

  /**
   * 데이터 전송 (인터페이스 구현)
   * @param data 전송할 데이터 (JSON 형식 문자열)
   */
  public send(data: string): void {
    // JSON 파싱을 시도하여 destination과 body 추출
    try {
      const parsed = JSON.parse(data);
      const destination = parsed.destination || "/app/message";
      const body = parsed.body || data;
      const headers = parsed.headers || {};

      this.sendToDestination(destination, body, headers);
    } catch {
      // JSON이 아닌 경우 기본 destination으로 전송
      this.sendToDestination("/app/message", data);
    }
  }

  /**
   * STOMP 메시지를 특정 destination으로 전송
   * @param destination 목적지
   * @param body 메시지 본문
   * @param headers 추가 헤더
   */
  public sendToDestination(
    destination: string,
    body: string,
    headers?: any
  ): void {
    if (!this.client?.connected) {
      // 연결되지 않은 경우 에러 이벤트 발생
      this.errorSubject.next(new Error("STOMP client is not connected"));
      return;
    }

    this.client.publish({
      destination,
      body,
      headers,
    });
  }

  // 기존 인터페이스 구현 (하위 호환성)
  public onConnect(callback: () => void): void {
    const subscription = this.connect$.subscribe(callback);
    this.rxSubscriptions.push(subscription);
  }

  public onMessage(callback: (data: string) => void): void {
    const subscription = this.message$.subscribe(callback);
    this.rxSubscriptions.push(subscription);
  }

  public onError(callback: (error: IFrame | Error | Event) => void): void {
    const subscription = this.error$.subscribe(callback);
    this.rxSubscriptions.push(subscription);
  }

  public onClose(callback: () => void): void {
    const subscription = this.disconnect$.subscribe(callback);
    this.rxSubscriptions.push(subscription);
  }

  /**
   * 네트워크 상태 반환
   * @returns 1: 연결됨, 0: 연결 안됨
   */
  public networkStatus(): number {
    return this.connectionState$.value ? 1 : 0;
  }

  /**
   * 연결 상태를 기다리는 유틸리티 메서드
   * @returns Observable<boolean>
   */
  public waitForConnection(): Observable<boolean> {
    return this.connectionState$.pipe(
      filter((connected) => connected === true)
    );
  }

  /**
   * 재연결 시도 횟수 반환
   * @returns 재연결 시도 횟수
   */
  public getReconnectAttempts(): number {
    return this._reconnectAttempts;
  }

  /**
   * 현재 연결 상태 반환
   * @returns 연결 여부
   */
  public isConnected(): boolean {
    return this.connectionState$.value;
  }

  /**
   * 재연결 시도 횟수 리셋
   */
  public resetReconnectAttempts(): void {
    this._reconnectAttempts = 0;
  }

  /**
   * 재연결 정보 가져오기
   * @returns 재연결 관련 정보
   */
  public getReconnectInfo() {
    return {
      attempts: this._reconnectAttempts,
      maxAttempts: this.maxReconnectAttempts,
      isReconnecting:
        this._reconnectAttempts > 0 && !this.connectionState$.value,
    };
  }

  /**
   * 재연결 상태 강제 리셋 (연결 성공 시 호출)
   */
  public resetReconnectState(): void {
    this._reconnectAttempts = 0;
  }

  /**
   * 최대 재연결 시도 횟수 설정
   * @param max 최대 시도 횟수
   */
  public setMaxReconnectAttempts(max: number): void {
    this.maxReconnectAttempts = max;
  }
}

/**
 * @description
 * @stompjs/client는 자동 재연결 시나리오 및 고도화 기능을 내장하고 있어,
 * 재연결 희망시 client를 소거하지 말고 자체 config를 통해 재연결 기능을 활용합시다.
 */
export class StompWebSocketClient extends WebSocketClient<
  StompClient,
  StompConfig
> {
  private adapter: StompWebSocketClientAdapter;

  constructor() {
    const adapter = new StompWebSocketClientAdapter();
    super(adapter);
    this.adapter = adapter;
  }

  /**
   * Adapter에 직접 접근하여 Observable 기능 사용
   * @returns StompWebSocketClientAdapter
   */
  public getAdapter(): StompWebSocketClientAdapter {
    return this.adapter;
  }

  public async connect(config: StompConfig & ReconnectConfig): Promise<void> {
    return this.adapter.connect(config);
  }

  public disconnect(): void {
    this.adapter.disconnect();
  }
}
