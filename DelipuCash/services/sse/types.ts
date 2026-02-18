/**
 * SSE Event Type Definitions
 * Mirrors the server-side event taxonomy from eventBus.mjs
 */

export type SSEEventType =
  | 'notification.new'
  | 'notification.read'
  | 'notification.readAll'
  | 'question.new'
  | 'question.response'
  | 'question.vote'
  | 'response.like'
  | 'response.dislike'
  | 'response.reply'
  | 'payment.status'
  | 'survey.response'
  | 'survey.completed'
  | 'video.comment'
  | 'video.like'
  | 'livestream.started'
  | 'livestream.ended'
  | 'livestream.viewerCount'
  | 'livestream.chat'
  | 'reconnect';

// Payload types per event
export interface NotificationNewPayload {
  notificationId: string;
  title: string;
  type: string;
  priority: string;
  category: string;
}

export interface QuestionNewPayload {
  questionId: string;
  text: string;
  category: string;
}

export interface QuestionResponsePayload {
  questionId: string;
  responseId: string;
  userId: string;
}

export interface QuestionVotePayload {
  questionId: string;
  type: 'up' | 'down';
  totalVotes: number;
}

export interface ResponseLikePayload {
  responseId: string;
  questionId: string;
  likeCount: number;
}

export interface ResponseDislikePayload {
  responseId: string;
  questionId: string;
  dislikeCount: number;
}

export interface ResponseReplyPayload {
  responseId: string;
  questionId: string;
  replyId: string;
}

export interface PaymentStatusPayload {
  paymentId: string;
  status: 'PENDING' | 'SUCCESSFUL' | 'FAILED';
  amount: number;
  provider: string;
}

export interface SurveyResponsePayload {
  surveyId: string;
  responseCount: number;
}

export interface SurveyCompletedPayload {
  surveyId: string;
  reward: number;
}

export interface VideoCommentPayload {
  videoId: string;
  commentId: string;
  commentsCount: number;
}

export interface VideoLikePayload {
  videoId: string;
  likes: number;
}

export interface LivestreamStartedPayload {
  sessionId: string;
  userId: string;
  title: string;
}

export interface LivestreamEndedPayload {
  sessionId: string;
  durationSeconds: number;
}

export interface LivestreamViewerCountPayload {
  sessionId: string;
  viewerCount: number;
  peakViewerCount: number;
}

export interface LivestreamChatPayload {
  sessionId: string;
  messageId: string;
  userId: string;
  userName: string;
  text: string;
  timestamp: string;
}

export type SSEConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'error'
  | 'backgrounded'
  | 'unavailable';
