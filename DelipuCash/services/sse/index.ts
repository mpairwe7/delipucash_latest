// SSE Service — barrel exports
export { SSEManager, getSSEManager } from './SSEManager';
export { useSSEConnection, useSSEEvent } from './useSSE';
export type {
  SSEEventType,
  SSEConnectionStatus,
  NotificationNewPayload,
  QuestionResponsePayload,
  PaymentStatusPayload,
  SurveyResponsePayload,
  SurveyCompletedPayload,
  VideoCommentPayload,
  VideoLikePayload,
} from './types';
