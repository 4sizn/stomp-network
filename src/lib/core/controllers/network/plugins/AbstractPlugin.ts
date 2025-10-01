import type { StompNetworkController } from "../StompNetworkController";

/**
 * @description
 * StompNetworkController용 추상 플러그인 클래스
 */
export abstract class AbstractPlugin {
  public abstract readonly name: string;
  protected controller: StompNetworkController | null = null;

  /**
   * 플러그인이 컨트롤러에 연결될 때 호출
   */
  public attach(controller: StompNetworkController): void {
    this.controller = controller;
    this.onAttach();
  }

  /**
   * 플러그인이 컨트롤러에서 분리될 때 호출
   */
  public detach(): void {
    this.onDetach();
    this.controller = null;
  }

  /**
   * 연결 전 단계에서 호출되는 훅
   */
  public abstract onBeforeConnect(): Promise<void>;

  /**
   * 연결 후 단계에서 호출되는 훅
   */
  public abstract onAfterConnect(): Promise<void>;

  /**
   * 연결 해제 전 단계에서 호출되는 훅
   */
  public abstract onBeforeDisconnect(): Promise<void>;

  /**
   * 연결 해제 후 단계에서 호출되는 훅
   */
  public abstract onAfterDisconnect(): Promise<void>;

  /**
   * 플러그인이 컨트롤러에 연결될 때의 초기화 로직
   */
  protected abstract onAttach(): void;

  /**
   * 플러그인이 컨트롤러에서 분리될 때의 정리 로직
   */
  protected abstract onDetach(): void;
}