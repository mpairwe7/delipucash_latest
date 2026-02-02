/**
 * VideoCommentsSheet Component
 * Bottom sheet for video comments (Instagram/TikTok style)
 * 
 * Features:
 * - Slide-up bottom sheet with gesture dismiss
 * - Comment list with infinite scroll
 * - Reply functionality
 * - Like/unlike comments
 * - Add new comments
 * - Accessibility support
 * 
 * @example
 * ```tsx
 * <VideoCommentsSheet
 *   visible={showComments}
 *   videoId={video.id}
 *   onClose={() => setShowComments(false)}
 * />
 * ```
 */

import React, { memo, useCallback, useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import {
  Gesture,
  GestureDetector,
} from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  X,
  Heart,
  Send,
  MessageCircle,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import {
  useTheme,
  SPACING,
  TYPOGRAPHY,
  RADIUS,
  SHADOWS,
  Z_INDEX,
  ICON_SIZE,
} from '@/utils/theme';
import { Comment } from '@/types';

// ============================================================================
// CONSTANTS
// ============================================================================

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SHEET_MAX_HEIGHT = SCREEN_HEIGHT * 0.75;
const DRAG_THRESHOLD = 100;

// ============================================================================
// TYPES
// ============================================================================

export interface VideoCommentsSheetProps {
  /** Whether the sheet is visible */
  visible: boolean;
  /** Video ID to load comments for */
  videoId: string;
  /** Comments data (if pre-loaded) */
  comments?: Comment[];
  /** Close handler */
  onClose: () => void;
  /** Add comment handler */
  onAddComment?: (text: string) => Promise<void>;
  /** Like comment handler */
  onLikeComment?: (commentId: string) => void;
  /** Reply to comment handler */
  onReplyComment?: (commentId: string, text: string) => Promise<void>;
  /** Test ID */
  testID?: string;
}

// Extended Comment type with likes support
interface CommentWithLikes extends Comment {
  likes?: number;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const formatTimeAgo = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
};

// ============================================================================
// COMMENT ITEM
// ============================================================================

interface CommentItemProps {
  comment: CommentWithLikes;
  onLike: () => void;
  onReply: () => void;
  isLiked: boolean;
}

const CommentItem = memo(({ comment, onLike, onReply, isLiked }: CommentItemProps) => {
  const { colors } = useTheme();
  const likeScale = useSharedValue(1);

  const handleLike = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    likeScale.value = withSpring(1.3, { damping: 8 }, () => {
      likeScale.value = withSpring(1);
    });
    onLike();
  }, [onLike, likeScale]);

  const likeStyle = useAnimatedStyle(() => ({
    transform: [{ scale: likeScale.value }],
  }));

  return (
    <View style={styles.commentItem}>
      <View style={[styles.avatar, { backgroundColor: colors.border }]}>
        <Text style={[styles.avatarText, { color: colors.text }]}>
          {(comment.userId || 'U').charAt(0).toUpperCase()}
        </Text>
      </View>

      <View style={styles.commentContent}>
        <View style={styles.commentHeader}>
          <Text style={[styles.commentAuthor, { color: colors.text }]}>
            @{comment.userId || 'user'}
          </Text>
          <Text style={[styles.commentTime, { color: colors.textMuted }]}>
            {formatTimeAgo(comment.createdAt)}
          </Text>
        </View>

        <Text style={[styles.commentText, { color: colors.text }]}>
          {comment.text}
        </Text>

        <View style={styles.commentActions}>
          <Pressable
            onPress={handleLike}
            style={styles.commentAction}
            accessibilityRole="button"
            accessibilityLabel={`${isLiked ? 'Unlike' : 'Like'} comment. ${comment.likes} likes`}
          >
            <Animated.View style={likeStyle}>
              <Heart
                size={16}
                color={isLiked ? '#FF2D55' : colors.textMuted}
                fill={isLiked ? '#FF2D55' : 'transparent'}
              />
            </Animated.View>
            <Text style={[styles.commentActionText, { color: colors.textMuted }]}>
              {comment.likes || 0}
            </Text>
          </Pressable>

          <Pressable
            onPress={onReply}
            style={styles.commentAction}
            accessibilityRole="button"
            accessibilityLabel="Reply to comment"
          >
            <MessageCircle size={16} color={colors.textMuted} />
            <Text style={[styles.commentActionText, { color: colors.textMuted }]}>
              Reply
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
});

CommentItem.displayName = 'CommentItem';

// ============================================================================
// MAIN COMPONENT
// ============================================================================

function VideoCommentsSheetComponent({
  visible,
  videoId,
  comments: propComments,
  onClose,
  onAddComment,
  onLikeComment,
  onReplyComment,
  testID,
}: VideoCommentsSheetProps): React.ReactElement | null {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);

  // Animation values
  const translateY = useSharedValue(SHEET_MAX_HEIGHT);
  const backdropOpacity = useSharedValue(0);

  // Local state
  const [comments, setComments] = useState<CommentWithLikes[]>(propComments || []);
  const [newComment, setNewComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [likedComments, setLikedComments] = useState<Set<string>>(new Set());
  const [replyingTo, setReplyingTo] = useState<string | null>(null);

  // ============================================================================
  // EFFECTS
  // ============================================================================

  // Animate in/out
  useEffect(() => {
    if (visible) {
      translateY.value = withSpring(0, { damping: 25, stiffness: 300 });
      backdropOpacity.value = withTiming(0.5, { duration: 200 });
    } else {
      translateY.value = withTiming(SHEET_MAX_HEIGHT, { duration: 200 });
      backdropOpacity.value = withTiming(0, { duration: 200 });
    }
  }, [visible, translateY, backdropOpacity]);

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleClose = useCallback(() => {
    translateY.value = withTiming(SHEET_MAX_HEIGHT, { duration: 200 });
    backdropOpacity.value = withTiming(0, { duration: 200 });
    setTimeout(onClose, 200);
  }, [translateY, backdropOpacity, onClose]);

  const handleSubmitComment = useCallback(async () => {
    if (!newComment.trim() || isSubmitting) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsSubmitting(true);

    try {
      if (onAddComment) {
        await onAddComment(newComment.trim());
      } else {
        // Mock: Add comment locally
        const mockComment: CommentWithLikes = {
          id: Date.now().toString(),
          text: newComment.trim(),
          userId: 'currentUser',
          videoId: videoId,
          mediaUrls: [],
          createdAt: new Date().toISOString(),
          likes: 0,
        };
        setComments((prev) => [mockComment, ...prev]);
      }
      setNewComment('');
      setReplyingTo(null);
    } catch (error) {
      console.error('Failed to add comment:', error);
    } finally {
      setIsSubmitting(false);
    }
  }, [newComment, isSubmitting, onAddComment, videoId]);

  const handleLikeComment = useCallback((commentId: string) => {
    setLikedComments((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(commentId)) {
        newSet.delete(commentId);
      } else {
        newSet.add(commentId);
      }
      return newSet;
    });
    onLikeComment?.(commentId);
  }, [onLikeComment]);

  const handleReply = useCallback((commentId: string) => {
    setReplyingTo(commentId);
    inputRef.current?.focus();
  }, []);

  // ============================================================================
  // GESTURE HANDLER (Reanimated v3 Gesture API)
  // ============================================================================

  const startY = useSharedValue(0);

  const panGesture = Gesture.Pan()
    .onStart(() => {
      startY.value = translateY.value;
    })
    .onUpdate((event) => {
      const newY = startY.value + event.translationY;
      translateY.value = Math.max(0, newY);
    })
    .onEnd((event) => {
      if (event.translationY > DRAG_THRESHOLD || event.velocityY > 500) {
        translateY.value = withTiming(SHEET_MAX_HEIGHT, { duration: 200 });
        backdropOpacity.value = withTiming(0, { duration: 200 });
        runOnJS(onClose)();
      } else {
        translateY.value = withSpring(0, { damping: 25 });
      }
    });

  // ============================================================================
  // ANIMATED STYLES
  // ============================================================================

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  // ============================================================================
  // RENDER
  // ============================================================================

  if (!visible) return null;

  return (
    <View style={styles.overlay} testID={testID}>
      {/* Backdrop */}
      <Pressable style={StyleSheet.absoluteFill} onPress={handleClose}>
        <Animated.View
          style={[styles.backdrop, backdropStyle]}
        />
      </Pressable>

      {/* Sheet */}
      <GestureDetector gesture={panGesture}>
        <Animated.View
          style={[
            styles.sheet,
            sheetStyle,
            {
              backgroundColor: colors.card,
              maxHeight: SHEET_MAX_HEIGHT,
              paddingBottom: insets.bottom,
            },
          ]}
        >
          {/* Handle */}
          <View style={styles.handleContainer}>
            <View style={[styles.handle, { backgroundColor: colors.border }]} />
          </View>

          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <Text style={[styles.headerTitle, { color: colors.text }]}>
              {comments.length} Comments
            </Text>
            <Pressable
              onPress={handleClose}
              style={styles.closeButton}
              accessibilityRole="button"
              accessibilityLabel="Close comments"
            >
              <X size={ICON_SIZE.lg} color={colors.text} />
            </Pressable>
          </View>

          {/* Comments List */}
          <FlatList
            data={comments}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <CommentItem
                comment={item}
                onLike={() => handleLikeComment(item.id)}
                onReply={() => handleReply(item.id)}
                isLiked={likedComments.has(item.id)}
              />
            )}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <MessageCircle size={48} color={colors.textMuted} />
                <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                  No comments yet. Be the first!
                </Text>
              </View>
            }
          />

          {/* Input */}
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={100}
          >
            <View style={[styles.inputContainer, { borderTopColor: colors.border }]}>
              {replyingTo && (
                <View style={styles.replyingContainer}>
                  <Text style={[styles.replyingText, { color: colors.textMuted }]}>
                    Replying to comment
                  </Text>
                  <Pressable onPress={() => setReplyingTo(null)}>
                    <X size={14} color={colors.textMuted} />
                  </Pressable>
                </View>
              )}
              <View style={styles.inputRow}>
                <TextInput
                  ref={inputRef}
                  style={[
                    styles.input,
                    {
                      backgroundColor: colors.background,
                      color: colors.text,
                      borderColor: colors.border,
                    },
                  ]}
                  placeholder="Add a comment..."
                  placeholderTextColor={colors.textMuted}
                  value={newComment}
                  onChangeText={setNewComment}
                  multiline
                  maxLength={500}
                  accessibilityLabel="Comment input"
                />
                <Pressable
                  onPress={handleSubmitComment}
                  disabled={!newComment.trim() || isSubmitting}
                  style={[
                    styles.sendButton,
                    {
                      backgroundColor: newComment.trim() ? colors.primary : colors.border,
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Send comment"
                  accessibilityState={{ disabled: !newComment.trim() || isSubmitting }}
                >
                  {isSubmitting ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Send size={18} color="#FFFFFF" />
                  )}
                </Pressable>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: Z_INDEX.modal,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
  },
  sheet: {
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    overflow: 'hidden',
    ...SHADOWS.lg,
  },
  handleContainer: {
    alignItems: 'center',
    paddingVertical: SPACING.sm,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.lg,
  },
  closeButton: {
    padding: SPACING.xs,
  },
  listContent: {
    padding: SPACING.md,
    flexGrow: 1,
  },
  commentItem: {
    flexDirection: 'row',
    marginBottom: SPACING.lg,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.sm,
  },
  avatarText: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  commentContent: {
    flex: 1,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: 2,
  },
  commentAuthor: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  commentTime: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.xs,
  },
  commentText: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
    lineHeight: TYPOGRAPHY.fontSize.sm * 1.4,
    marginBottom: SPACING.xs,
  },
  commentActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.lg,
  },
  commentAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  commentActionText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.xs,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SPACING['4xl'],
    gap: SPACING.md,
  },
  emptyText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.base,
    textAlign: 'center',
  },
  inputContainer: {
    borderTopWidth: 1,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  replyingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: SPACING.xs,
  },
  replyingText: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.xs,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: SPACING.sm,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.base,
    maxHeight: 100,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

// ============================================================================
// EXPORTS
// ============================================================================

export const VideoCommentsSheet = memo(VideoCommentsSheetComponent);
export default VideoCommentsSheet;
