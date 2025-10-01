/**
 * @description STOMP 메시지 관련 에러
 */
export class StompMessageError extends Error {
  public readonly code: string;
  public readonly timestamp: Date;

  constructor(
    message: string,
    public readonly topic?: string,
    public readonly messageData?: unknown,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "StompMessageError";
    this.code = "STOMP_MESSAGE_ERROR";
    this.timestamp = new Date();
  }
}