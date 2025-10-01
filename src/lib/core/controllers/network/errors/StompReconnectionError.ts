/**
 * @description STOMP 재연결 관련 에러
 */
export class StompReconnectionError extends Error {
  public readonly code: string;
  public readonly timestamp: Date;

  constructor(
    message: string,
    public readonly attempts?: number,
    public readonly maxAttempts?: number,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "StompReconnectionError";
    this.code = "STOMP_RECONNECTION_ERROR";
    this.timestamp = new Date();
  }
}