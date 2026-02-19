/**
 * Survey Components Index
 * Export all survey-related components from a single entry point
 */

// Skeletons & Loading
export {
  Skeleton,
  SurveyCardSkeleton,
  AnalyticsMetricSkeleton,
  AnalyticsChartSkeleton,
  TemplateCardSkeleton,
  SurveyListSkeleton,
  AnalyticsDashboardSkeleton,
} from './SurveySkeletons';

// Templates Gallery
export { SurveyTemplatesGallery } from './SurveyTemplatesGallery';

// Conversational Builder
export { ConversationalBuilder } from './ConversationalBuilder';

// Import Wizard
export { ImportWizard } from './ImportWizard';

// Share Modal
export { SurveyShareModal } from './SurveyShareModal';

// Analytics Dashboard
export { AnalyticsDashboard } from './AnalyticsDashboard';

// FAB & Creation Flow
export {
  SurveyCreationFAB,
  CompactFAB,
  CreationModeSelector,
  type CreationMode,
} from './SurveyCreationFAB';

// Undo/Redo Toolbar
export { UndoRedoToolbar } from './UndoRedoToolbar';

// Conditional Logic Editor
export { ConditionalLogicEditor } from './ConditionalLogicEditor';

// File Upload Question (respondent-facing)
export { FileUploadQuestion } from './FileUploadQuestion';

// Drag-to-Reorder Question List
export { DraggableQuestionList } from './DraggableQuestionList';

// Device Preview Frame
export { DevicePreviewFrame } from './DevicePreviewFrame';

// Shared Animation Configs
export {
  SPRING_QUICK,
  SPRING_STANDARD,
  SPRING_GENTLE,
  SPRING_BOUNCY,
  TIMING_FAST,
  TIMING_STANDARD,
  TIMING_SLOW,
  SCALE_PRESSED,
  SCALE_EMPHASIS,
  SCALE_DRAG,
  getAnimatedDuration,
  getSpringConfig,
} from './animations';

// Webhook Setup Modal
export { WebhookSetupModal } from './WebhookSetupModal';

// Creation Progress Badges (gamification)
export { CreationProgressBadges } from './CreationProgressBadges';
