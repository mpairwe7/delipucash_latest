import * as React from "react";

/**
 * Callback function for handling stream chunks
 */
export type OnChunkCallback = (content: string) => void;

/**
 * Callback function for handling stream completion
 */
export type OnFinishCallback = (content: string) => void;

/**
 * Props for the useHandleStreamResponse hook
 */
export interface UseHandleStreamResponseProps {
  /** Callback invoked on each chunk received from the stream */
  onChunk: OnChunkCallback;
  /** Callback invoked when the stream is complete */
  onFinish: OnFinishCallback;
}

/**
 * Handler function type for processing stream responses
 */
export type StreamResponseHandler = (response: Response) => Promise<void>;

/**
 * Custom hook for handling streaming HTTP responses
 * 
 * @description Provides a stable callback function for processing ReadableStream responses,
 * accumulating chunks and notifying via callbacks on each chunk and when finished.
 * 
 * @param props - Configuration object containing onChunk and onFinish callbacks
 * @returns Stable callback function for handling stream responses
 * 
 * @example
 * ```tsx
 * const handleStream = useHandleStreamResponse({
 *   onChunk: (content) => setStreamedContent(content),
 *   onFinish: (content) => console.log('Stream complete:', content.length)
 * });
 * 
 * const response = await fetch('/api/stream');
 * await handleStream(response);
 * ```
 */
function useHandleStreamResponse({
  onChunk,
  onFinish,
}: UseHandleStreamResponseProps): StreamResponseHandler {
  const handleStreamResponse = React.useCallback(
    async (response: Response): Promise<void> => {
      if (response.body) {
        const reader = response.body.getReader();
        if (reader) {
          const decoder = new TextDecoder();
          let content = "";
          
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              onFinish(content);
              break;
            }
            const chunk = decoder.decode(value, { stream: true });
            content += chunk;
            onChunk(content);
          }
        }
      }
    },
    [onChunk, onFinish]
  );

  const handleStreamResponseRef = React.useRef<StreamResponseHandler>(handleStreamResponse);
  
  React.useEffect(() => {
    handleStreamResponseRef.current = handleStreamResponse;
  }, [handleStreamResponse]);

  return React.useCallback(
    (response: Response) => handleStreamResponseRef.current(response),
    []
  );
}

export { useHandleStreamResponse };
export default useHandleStreamResponse;
