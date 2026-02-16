/**
 * LiveChat Component
 * Real-time chat overlay for livestreams using SSE events
 *
 * Features:
 * - Subscribes to `livestream.chat` SSE events filtered by sessionId
 * - FlatList of messages with auto-scroll
 * - 100-message rolling buffer
 * - TextInput for sending via `useSendLivestreamChat`
 * - Semi-transparent overlay design (TikTok/YouTube Live style)
 */

import React, { memo, useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  StyleSheet,
  Pressable,
  Keyboard,
  type ListRenderItemInfo,
} from 'react-native';
import { Send } from 'lucide-react-native';
import { useTheme, SPACING, TYPOGRAPHY, RADIUS, withAlpha } from '@/utils/theme';
import { useSSEEvent } from '@/services/sse/useSSE';
import { useSendLivestreamChat } from '@/services/videoHooks';
import type { LivestreamChatPayload } from '@/services/sse/types';

// ============================================================================
// TYPES
// ============================================================================

export interface LiveChatProps {
  /** Active livestream session ID to filter chat events */
  sessionId: string;
  /** Whether the chat input is enabled (streamer + viewer) */
  inputEnabled?: boolean;
  /** Maximum visible height for the chat overlay */
  maxHeight?: number;
}

interface ChatMessage {
  id: string;
  userId: string;
  userName: string;
  text: string;
  timestamp: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const MAX_MESSAGES = 100;
const MAX_MESSAGE_LENGTH = 200;

// ============================================================================
// COMPONENT
// ============================================================================

export const LiveChat = memo<LiveChatProps>(({
  sessionId,
  inputEnabled = true,
  maxHeight = 280,
}) => {
  const { colors } = useTheme();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const flatListRef = useRef<FlatList<ChatMessage>>(null);
  const sendChat = useSendLivestreamChat();

  // Subscribe to SSE chat events for this session
  useSSEEvent<LivestreamChatPayload>('livestream.chat', useCallback((data) => {
    if (data.sessionId !== sessionId) return;

    const msg: ChatMessage = {
      id: data.messageId,
      userId: data.userId,
      userName: data.userName,
      text: data.text,
      timestamp: data.timestamp,
    };

    setMessages((prev) => {
      const next = [...prev, msg];
      // Rolling buffer — keep last MAX_MESSAGES
      return next.length > MAX_MESSAGES ? next.slice(-MAX_MESSAGES) : next;
    });

    // Auto-scroll to bottom
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 50);
  }, [sessionId]));

  // Send message handler
  const handleSend = useCallback(() => {
    const text = inputText.trim();
    if (!text || !sessionId) return;

    sendChat.mutate(
      { sessionId, text },
      {
        onSuccess: () => {
          setInputText('');
          Keyboard.dismiss();
        },
      },
    );
  }, [inputText, sessionId, sendChat]);

  // Render individual chat message
  const renderMessage = useCallback(({ item }: ListRenderItemInfo<ChatMessage>) => (
    <View style={styles.messageRow}>
      <Text style={[styles.userName, { color: colors.primary }]} numberOfLines={1}>
        {item.userName}
      </Text>
      <Text style={[styles.messageText, { color: colors.text }]} numberOfLines={2}>
        {item.text}
      </Text>
    </View>
  ), [colors.primary, colors.text]);

  const keyExtractor = useCallback((item: ChatMessage) => item.id, []);

  return (
    <View style={[styles.container, { maxHeight }]}>
      {/* Message list */}
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={keyExtractor}
        style={styles.messageList}
        contentContainerStyle={styles.messageListContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        // Perf props
        removeClippedSubviews
        maxToRenderPerBatch={10}
        windowSize={5}
      />

      {/* Empty state */}
      {messages.length === 0 && (
        <View style={styles.emptyState}>
          <Text style={[styles.emptyText, { color: withAlpha(colors.text, 0.5) }]}>
            Chat messages will appear here
          </Text>
        </View>
      )}

      {/* Input bar */}
      {inputEnabled && (
        <View style={[styles.inputBar, { backgroundColor: withAlpha(colors.background, 0.6) }]}>
          <TextInput
            style={[
              styles.textInput,
              {
                color: colors.text,
                backgroundColor: withAlpha(colors.text, 0.1),
                borderColor: withAlpha(colors.text, 0.15),
              },
            ]}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Say something..."
            placeholderTextColor={withAlpha(colors.text, 0.4)}
            maxLength={MAX_MESSAGE_LENGTH}
            returnKeyType="send"
            onSubmitEditing={handleSend}
            blurOnSubmit={false}
          />
          <Pressable
            onPress={handleSend}
            disabled={!inputText.trim() || sendChat.isPending}
            style={[
              styles.sendButton,
              {
                backgroundColor: inputText.trim()
                  ? colors.primary
                  : withAlpha(colors.text, 0.15),
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Send chat message"
          >
            <Send
              size={18}
              color={inputText.trim() ? '#FFFFFF' : withAlpha(colors.text, 0.4)}
            />
          </Pressable>
        </View>
      )}
    </View>
  );
});

LiveChat.displayName = 'LiveChat';

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 100,
    left: 0,
    right: 0,
    paddingHorizontal: SPACING.md,
  },
  messageList: {
    flex: 1,
  },
  messageListContent: {
    paddingVertical: SPACING.xs,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 3,
    paddingHorizontal: SPACING.sm,
    borderRadius: RADIUS.sm,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    marginBottom: 4,
    gap: SPACING.xs,
  },
  userName: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: '700',
    flexShrink: 0,
  },
  messageText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: '400',
    flex: 1,
  },
  emptyState: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontStyle: 'italic',
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.xs,
    gap: SPACING.xs,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.xs,
  },
  textInput: {
    flex: 1,
    height: 36,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.md,
    fontSize: TYPOGRAPHY.fontSize.sm,
    borderWidth: 1,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
