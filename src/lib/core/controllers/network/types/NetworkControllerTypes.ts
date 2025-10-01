import { IMessage, StompConfig } from "@stomp/stompjs";
import { Subscription } from "rxjs";

/**
 * @description 재연결 설정
 */
export interface ReconnectConfig {
  maxAttempts?: number;
  delay?: number;
}

/**
 * @description STOMP 클라이언트 설정 (StompConfig + 재연결 설정)
 */
export type StompClientConfig = StompConfig & ReconnectConfig;

/**
 * @description 네트워크 컨트롤러 설정
 */
export interface NetworkControllerConfig {
  maxReconnectAttempts: number;
  reconnectDelay: number;
}

/**
 * @description 구독 정보
 */
export interface SubscriptionInfo {
  topic: string;
  subscription: Subscription;
  isPersistent: boolean;
  createdAt: Date;
}

/**
 * @description 재연결 정보
 */
export interface ReconnectInfo {
  attempts: number;
  maxAttempts: number;
  isReconnecting: boolean;
}

/**
 * @description 메시지 필터 함수
 */
export type MessageFilter = (message: IMessage) => boolean;

/**
 * @description 연결 상태
 */
export enum ConnectionState {
  DISCONNECTED = "DISCONNECTED",
  CONNECTING = "CONNECTING",
  CONNECTED = "CONNECTED",
  RECONNECTING = "RECONNECTING",
  FAILED = "FAILED",
}