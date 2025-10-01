/**
 * @description STOMP 연결 관련 에러
 */
export class StompConnectionError extends Error {
  public readonly code: string;
  public readonly timestamp: Date;

  constructor(message: string, public readonly details?: unknown) {
    super(message);
    this.name = "StompConnectionError";
    this.code = "STOMP_CONNECTION_ERROR";
    this.timestamp = new Date();
  }
}