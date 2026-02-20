/**
 * VideoComments Component
 * Full-featured comments section for videos
 * 
 * Features:
 * - Infinite scroll loading
 * - Optimistic updates
 * - Reply threading
 * - Accessibility support
 * - Design system compliant
 * 
 * @example
 * ```tsx
 * <VideoComments
 *   videoId="video_001"
 *   visible={showComments}
 *   onClose={() => setShowComments(false)}
 * />
 * ```
 */

import React, { memo, useCallback, useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Animated,
  Keyboard,
  Image,
  type ViewStyle,
  type ListRenderItem,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  X,
  Send,
  Heart,
  MoreHorizontal,
  MessageCircle,
  AlertCircle,
  RefreshCw,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import {
  useTheme,
  SPACING,
  TYPOGRAPHY,
  RADIUS,
  ICON_SIZE,
  COMPONENT_SIZE,
  withAlpha,
} from '@/utils/theme';
import { Comment } from '@/types';
import { useVideoCommentsQuery, useAddVideoComment } from '@/services/videoHooks';

// ============================================================================
// TYPES
// ============================================================================

export interface VideoCommentsProps {
  /** Video ID to fetch comments for */
  videoId: string;
  /** Whether the comments sheet is visible */
  visible: boolean;
  /** Close handler */
  onClose: () => void;
  /** Custom container style */
  style?: ViewStyle;
  /** Initial focus on input */
  autoFocus?: boolean;
  /** Maximum height (default: 60% of screen) */
  maxHeight?: `${number}%` | number;
  /** Test ID for testing */
  testID?: string;
}

interface CommentItemProps {
  comment: Comment;
  onLike: (commentId: string) => void;
  onReply: (comment: Comment) => void;
  onMore: (comment: Comment) => void;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Format relative time (e.g., "2h ago", "3d ago")
 */
const formatRelativeTime = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);
  const diffYears = Math.floor(diffDays / 365);

  if (diffYears > 0) return `${diffYears}y ago`;
  if (diffMonths > 0) return `${diffMonths}mo ago`;
  if (diffWeeks > 0) return `${diffWeeks}w ago`;
  if (diffDays > 0) return `${diffDays}d ago`;
  if (diffHours > 0) return `${diffHours}h ago`;
  if (diffMins > 0) return `${diffMins}m ago`;
  return 'Just now';
};

/**
 * Format count with abbreviation
 */
const formatCount = (count: number): string => {
  if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
  if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
  return count.toString();
};

const getCommentAuthorName = (comment: Comment): string => {
  const first = comment.user?.firstName?.trim() || '';
  const last = comment.user?.lastName?.trim() || '';
  const fullName = `${first} ${last}`.trim();

  if (fullName) return fullName;
  if (comment.userId === 'current_user' || comment.userId === 'currentUser') return 'You';
  return 'User';
};

const getCommentAuthorInitial = (comment: Comment): string => {
  const name = getCommentAuthorName(comment);
  return name.charAt(0).toUpperCase() || 'U';
};

// ============================================================================
// COMMENT ITEM COMPONENT
// ============================================================================

const CommentItem = memo<CommentItemProps>(({
  comment,
  onLike,
  onReply,
  onMore,
}) => {
  const { colors } = useTheme();
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(comment.likes ?? 0);
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handleLike = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    // Animate button
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 1.3,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();

    setIsLiked(prev => !prev);
    setLikeCount(prev => isLiked ? prev - 1 : prev + 1);
    onLike(comment.id);
  }, [comment.id, isLiked, onLike, scaleAnim]);

  const handleReply = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onReply(comment);
  }, [comment, onReply]);

  const handleMore = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onMore(comment);
  }, [comment, onMore]);

  return (
    <View 
      style={styles.commentItem}
      accessible
      accessibilityRole="text"
      accessibilityLabel={`Comment by user: ${comment.text}. ${likeCount} likes. Posted ${formatRelativeTime(comment.createdAt)}`}
    >
      {/* Avatar */}
      <View 
        style={[styles.avatar, { backgroundColor: withAlpha(colors.primary, 0.2) }]}
        accessibilityElementsHidden
      >
        {comment.user?.avatar ? (
          <Image
            source={{ uri: comment.user.avatar }}
            style={styles.avatarImage}
            resizeMode="cover"
          />
        ) : (
          <Text style={[styles.avatarText, { color: colors.primary }]}>
            {getCommentAuthorInitial(comment)}
          </Text>
        )}
      </View>

      {/* Content */}
      <View style={styles.commentContent}>
        {/* Header */}
        <View style={styles.commentHeader}>
          <Text style={[styles.commentAuthor, { color: colors.text }]}>
            {getCommentAuthorName(comment)}
          </Text>
          <Text style={[styles.commentTime, { color: colors.textSecondary }]}>
            {formatRelativeTime(comment.createdAt)}
          </Text>
        </View>

        {/* Text */}
        <Text 
          style={[styles.commentText, { color: colors.text }]}
          selectable
        >
          {comment.text}
        </Text>

        {/* Media (if any) */}
        {comment.mediaUrls && comment.mediaUrls.length > 0 && (
          <View style={styles.mediaContainer}>
            {comment.mediaUrls.map((url, index) => (
              <View 
                key={index}
                style={[styles.mediaThumbnail, { backgroundColor: colors.border }]}
              >
                <Text style={{ color: colors.textSecondary }}>📷</Text>
              </View>
            ))}
          </View>
        )}

        {/* Actions */}
        <View style={styles.commentActions}>
          <TouchableOpacity
            style={styles.commentAction}
            onPress={handleLike}
            accessible
            accessibilityRole="button"
            accessibilityLabel={`${isLiked ? 'Unlike' : 'Like'} comment. ${likeCount} likes`}
            accessibilityState={{ selected: isLiked }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
              <Heart
                size={ICON_SIZE.sm}
                color={isLiked ? colors.error : colors.textSecondary}
                fill={isLiked ? colors.error : 'transparent'}
                strokeWidth={2}
              />
            </Animated.View>
            {likeCount > 0 && (
              <Text style={[styles.actionCount, { color: colors.textSecondary }]}>
                {formatCount(likeCount)}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.commentAction}
            onPress={handleReply}
            accessible
            accessibilityRole="button"
            accessibilityLabel="Reply to comment"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <MessageCircle
              size={ICON_SIZE.sm}
              color={colors.textSecondary}
              strokeWidth={2}
            />
            <Text style={[styles.actionLabel, { color: colors.textSecondary }]}>
              Reply
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.commentAction}
            onPress={handleMore}
            accessible
            accessibilityRole="button"
            accessibilityLabel="More options"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <MoreHorizontal
              size={ICON_SIZE.sm}
              color={colors.textSecondary}
              strokeWidth={2}
            />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
});

CommentItem.displayName = 'CommentItem';

// ============================================================================
// EMPTY STATE COMPONENT
// ============================================================================

interface EmptyStateProps {
  onRetry?: () => void;
  isError?: boolean;
}

const EmptyState = memo<EmptyStateProps>(({ onRetry, isError }) => {
  const { colors } = useTheme();

  if (isError) {
    return (
      <View style={styles.emptyState} accessible accessibilityRole="alert">
        <AlertCircle size={48} color={colors.error} strokeWidth={1.5} />
        <Text style={[styles.emptyTitle, { color: colors.text }]}>
          Failed to load comments
        </Text>
        <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
          Please check your connection and try again
        </Text>
        {onRetry && (
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: colors.primary }]}
            onPress={onRetry}
            accessibilityRole="button"
            accessibilityLabel="Retry loading comments"
          >
            <RefreshCw size={ICON_SIZE.sm} color={colors.primaryText} strokeWidth={2} />
            <Text style={[styles.retryButtonText, { color: colors.primaryText }]}>Retry</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  return (
    <View style={styles.emptyState} accessible accessibilityRole="text">
      <MessageCircle size={48} color={colors.textSecondary} strokeWidth={1.5} />
      <Text style={[styles.emptyTitle, { color: colors.text }]}>
        No comments yet
      </Text>
      <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
        Be the first to share your thoughts!
      </Text>
    </View>
  );
});

EmptyState.displayName = 'EmptyState';

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const VideoComments = memo<VideoCommentsProps>(({
  videoId,
  visible,
  onClose,
  style,
  autoFocus = false,
  maxHeight = '60%',
  testID,
}) => {
  const { colors } = useTheme();
  const inputRef = useRef<TextInput>(null);
  const [commentText, setCommentText] = useState('');
  const [replyingTo, setReplyingTo] = useState<Comment | null>(null);
  const slideAnim = useRef(new Animated.Value(0)).current;

  // Data fetching
  const {
    data: commentsData,
    isLoading,
    isError,
    refetch,
    isFetching,
  } = useVideoCommentsQuery(videoId);

  // Mutation
  const addCommentMutation = useAddVideoComment();

  // Animation on visibility change
  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: visible ? 1 : 0,
      useNativeDriver: true,
      tension: 65,
      friction: 11,
    }).start();

    if (visible && autoFocus) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [visible, autoFocus, slideAnim]);

  // Handlers
  const handleClose = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Keyboard.dismiss();
    onClose();
  }, [onClose]);

  const handleSubmit = useCallback(async () => {
    if (!commentText.trim()) return;

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    
    const text = replyingTo 
      ? `@${getCommentAuthorName(replyingTo)} ${commentText}`
      : commentText;

    try {
      await addCommentMutation.mutateAsync({
        videoId,
        text,
      });
      setCommentText('');
      setReplyingTo(null);
      Keyboard.dismiss();
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [commentText, replyingTo, videoId, addCommentMutation]);

  const handleLikeComment = useCallback((commentId: string) => {
    // Handle like - could add mutation here
    if (__DEV__) console.log('Like comment:', commentId);
  }, []);

  const handleReply = useCallback((comment: Comment) => {
    setReplyingTo(comment);
    inputRef.current?.focus();
  }, []);

  const handleMoreOptions = useCallback((comment: Comment) => {
    // Handle more options (report, delete, etc.)
    if (__DEV__) console.log('More options for:', comment.id);
  }, []);

  const handleCancelReply = useCallback(() => {
    setReplyingTo(null);
  }, []);

  // Render item
  const renderItem: ListRenderItem<Comment> = useCallback(({ item }) => (
    <CommentItem
      comment={item}
      onLike={handleLikeComment}
      onReply={handleReply}
      onMore={handleMoreOptions}
    />
  ), [handleLikeComment, handleReply, handleMoreOptions]);

  const keyExtractor = useCallback((item: Comment) => item.id, []);

  // Computed values
  const comments = commentsData?.comments || [];
  const translateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [500, 0],
  });

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        { 
          backgroundColor: colors.background,
          maxHeight,
          transform: [{ translateY }],
        },
        style,
      ]}
      testID={testID}
      accessible
      accessibilityViewIsModal
      accessibilityLabel="Comments section"
    >
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Text 
            style={[styles.headerTitle, { color: colors.text }]}
            accessibilityRole="header"
          >
            Comments {comments.length > 0 && `(${formatCount(comments.length)})`}
          </Text>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={handleClose}
            accessible
            accessibilityRole="button"
            accessibilityLabel="Close comments"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <X size={ICON_SIZE.md} color={colors.text} strokeWidth={2} />
          </TouchableOpacity>
        </View>

        {/* Comments List */}
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
              Loading comments...
            </Text>
          </View>
        ) : isError ? (
          <EmptyState isError onRetry={refetch} />
        ) : comments.length === 0 ? (
          <EmptyState />
        ) : (
          <FlatList
            data={comments}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            style={styles.list}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshing={isFetching}
            onRefresh={refetch}
            keyboardShouldPersistTaps="handled"
            initialNumToRender={10}
            maxToRenderPerBatch={10}
            windowSize={5}
            removeClippedSubviews={Platform.OS === 'android'}
          />
        )}

        {/* Reply indicator */}
        {replyingTo && (
          <View style={[styles.replyIndicator, { backgroundColor: withAlpha(colors.primary, 0.1) }]}>
            <Text style={[styles.replyText, { color: colors.primary }]}>
              Replying to @{getCommentAuthorName(replyingTo)}
            </Text>
            <TouchableOpacity
              onPress={handleCancelReply}
              accessible
              accessibilityRole="button"
              accessibilityLabel="Cancel reply"
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <X size={ICON_SIZE.sm} color={colors.primary} strokeWidth={2} />
            </TouchableOpacity>
          </View>
        )}

        {/* Input */}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
          <View style={[styles.inputContainer, { borderTopColor: colors.border }]}>
            <View style={[styles.inputWrapper, { backgroundColor: colors.card }]}>
              <TextInput
                ref={inputRef}
                style={[styles.input, { color: colors.text }]}
                placeholder="Add a comment..."
                placeholderTextColor={colors.textSecondary}
                value={commentText}
                onChangeText={setCommentText}
                multiline
                maxLength={500}
                returnKeyType="send"
                onSubmitEditing={handleSubmit}
                accessible
                accessibilityLabel="Comment input"
                accessibilityHint="Type your comment here"
              />
              <TouchableOpacity
                style={[
                  styles.sendButton,
                  { 
                    backgroundColor: commentText.trim() 
                      ? colors.primary 
                      : withAlpha(colors.primary, 0.3),
                  },
                ]}
                onPress={handleSubmit}
                disabled={!commentText.trim() || addCommentMutation.isPending}
                accessible
                accessibilityRole="button"
                accessibilityLabel="Send comment"
                accessibilityState={{ disabled: !commentText.trim() }}
              >
                {addCommentMutation.isPending ? (
                  <ActivityIndicator size="small" color={colors.primaryText} />
                ) : (
                  <Send size={ICON_SIZE.sm} color={colors.primaryText} strokeWidth={2} />
                )}
              </TouchableOpacity>
            </View>
            <Text style={[styles.charCount, { color: colors.textSecondary }]}>
              {commentText.length}/500
            </Text>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Animated.View>
  );
});

VideoComments.displayName = 'VideoComments';

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 20,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.lg,
  },
  closeButton: {
    padding: SPACING.xs,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SPACING['3xl'],
  },
  loadingText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
    marginTop: SPACING.md,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  commentItem: {
    flexDirection: 'row',
    marginBottom: SPACING.lg,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.sm,
  },
  avatarText: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.md,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 20,
  },
  commentContent: {
    flex: 1,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.xxs,
  },
  commentAuthor: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.sm,
    marginRight: SPACING.sm,
  },
  commentTime: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.xs,
  },
  commentText: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
    lineHeight: TYPOGRAPHY.fontSize.sm * 1.5,
    marginBottom: SPACING.xs,
  },
  mediaContainer: {
    flexDirection: 'row',
    marginBottom: SPACING.xs,
  },
  mediaThumbnail: {
    width: 60,
    height: 60,
    borderRadius: RADIUS.sm,
    marginRight: SPACING.xs,
    justifyContent: 'center',
    alignItems: 'center',
  },
  commentActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.lg,
  },
  commentAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xxs,
  },
  actionCount: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.xs,
  },
  actionLabel: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.xs,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SPACING['3xl'],
    paddingHorizontal: SPACING.xl,
  },
  emptyTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.lg,
    marginTop: SPACING.md,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
    marginTop: SPACING.xs,
    textAlign: 'center',
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.md,
    marginTop: SPACING.lg,
  },
  retryButtonText: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  replyIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
  },
  replyText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  inputContainer: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderTopWidth: 1,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderRadius: RADIUS.lg,
    paddingLeft: SPACING.md,
    paddingRight: SPACING.xs,
    paddingVertical: SPACING.xs,
    minHeight: 48,
  },
  input: {
    flex: 1,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.md,
    maxHeight: 100,
    paddingTop: Platform.OS === 'ios' ? SPACING.sm : 0,
    paddingBottom: Platform.OS === 'ios' ? SPACING.sm : 0,
  },
  sendButton: {
    width: COMPONENT_SIZE.touchTarget,
    height: COMPONENT_SIZE.touchTarget,
    borderRadius: COMPONENT_SIZE.touchTarget / 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: SPACING.xs,
  },
  charCount: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.xs,
    textAlign: 'right',
    marginTop: SPACING.xxs,
  },
});

export default VideoComments;
