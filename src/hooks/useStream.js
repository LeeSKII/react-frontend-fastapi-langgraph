import { useState, useRef, useCallback } from "react";

export const useBasicChat = (endpoint) => {
  // 状态管理
  const [streamMessage, setStreamMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState(null);
  const abortControllerRef = useRef(null);

  // 解析事件数据函数
  const parseEventData = useCallback((eventData) => {
    const lines = eventData.split("\n");
    let eventType = "messages";
    let data = null;

    for (const line of lines) {
      if (line.startsWith("event:")) {
        eventType = line.replace("event:", "").trim();
      } else if (line.startsWith("data:")) {
        data = line.replace("data:", "").trim();
      }
    }

    return { eventType, data };
  }, []);

  // 处理错误事件函数
  const handleErrorEvent = useCallback((data) => {
    try {
      const errorData = JSON.parse(data);
      setError(errorData.error || "Unknown error");
    } catch (e) {
      setError("Invalid error format");
    }
  }, []);

  // 处理custom数据，目前用来指示节点转换
  const handleCustomEvent = useCallback((parsed_data) => {
    if (parsed_data.data.type == "update_message") {
      // 更新当前流式消息的内容
      const ai_response = parsed_data.data.message;
      setMessages((prev) => {
        const tempArr = prev.slice(0, -1);
        return [...tempArr, { role: "assistant", content: ai_response }];
      });
    }
  }, []);

  // 处理更新事件函数
  const handleUpdatesEvent = useCallback((parsed_data) => {
    // 可以在这里实现更新逻辑
  }, []);

  // 处理消息事件函数
  const handleMessagesEvent = useCallback((parsed_data) => {
    // 更新最后一个assistant消息的内容（流式消息）
    const messageChunkId = parsed_data.data.data.id;
    const newContent = parsed_data.data.data.content;
    setMessages((prev) => {
      const lastAiMessage = prev[prev.length - 1];
      if (lastAiMessage.role === "assistant") {
        const tempContent = lastAiMessage.content + newContent;
        return [
          ...prev.slice(0, -1),
          { role: "assistant", content: tempContent },
        ];
      }
      return prev;
    });

    setStreamMessage((prev) => {
      return prev + newContent;
    });
  }, []);

  // 处理事件函数
  const processEvent = useCallback(
    (eventData) => {
      const { eventType, data } = parseEventData(eventData);

      // 处理不同事件类型
      if (eventType === "error") {
        handleErrorEvent(data);
      } else if (eventType === "end") {
        setIsStreaming(false);
      } else if (data) {
        // 忽略心跳包
        if (data === ":keep-alive") return;

        try {
          const parsed_data = JSON.parse(data);

          if (parsed_data.mode === "updates") {
            handleUpdatesEvent(parsed_data);
          } else if (parsed_data.mode === "messages") {
            handleMessagesEvent(parsed_data);
          } else if (parsed_data.mode === "custom") {
            handleCustomEvent(parsed_data);
          }
        } catch (e) {
          console.error("Failed to parse event data:", e);
        }
      }
    },
    [
      parseEventData,
      handleErrorEvent,
      handleUpdatesEvent,
      handleMessagesEvent,
      handleCustomEvent,
    ]
  );

  // 开始流式传输函数
  const startStream = async (message) => {
    setIsStreaming(true);
    setStreamMessage("");

    let sendMessages = [...messages, { role: "user", content: message }];
    // 添加一个空的assistant消息用于流式显示
    let showMessages = [
      ...sendMessages,
      { role: "assistant", content: "", status: "loading" },
    ];
    setMessages(showMessages);

    try {
      // 创建中断控制器
      abortControllerRef.current = new AbortController();

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ messages: sendMessages }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `HTTP error! status: ${response.status}, message: ${errorText}`
        );
      }

      if (!response.body) {
        throw new Error("ReadableStream not supported");
      }

      // 创建流式读取器
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        // 解码并处理数据块
        buffer += decoder.decode(value, { stream: true });

        // 处理完整的SSE事件 (以\n\n分隔)
        let eventEndIndex;
        while ((eventEndIndex = buffer.indexOf("\n\n")) !== -1) {
          const eventData = buffer.substring(0, eventEndIndex);
          buffer = buffer.substring(eventEndIndex + 2);
          console.log(eventData);
          processEvent(eventData);
        }
      }
    } catch (err) {
      if (err.name !== "AbortError") {
        console.error("Streaming error:", err);
        setError(err.message || "流式传输失败");
      }
    } finally {
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  };

  // 停止流式传输函数
  const stopStream = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsStreaming(false);
    }
  }, []);

  // 清理函数：组件卸载时中断请求
  const cleanup = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  // 重置聊天
  const resetChat = useCallback(() => {
    setStreamMessage("");
    setMessages([]);
    setIsStreaming(false);
    setError(null);
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  return {
    // 状态
    streamMessage,
    messages,
    isStreaming,
    error,
    abortControllerRef,

    // 动作
    setStreamMessage,
    setMessages,
    setIsStreaming,
    startStream,
    stopStream,
    resetChat,
    cleanup,
  };
};
