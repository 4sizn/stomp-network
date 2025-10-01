/**
 * @description STOMP 구독 관련 에러
 */
export class StompSubscriptionError extends Error {
  public readonly code: string;
  public readonly timestamp: Date;

  constructor(
    message: string,
    public readonly topic?: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "StompSubscriptionError";
    this.code = "STOMP_SUBSCRIPTION_ERROR";
    this.timestamp = new Date();
  }
}