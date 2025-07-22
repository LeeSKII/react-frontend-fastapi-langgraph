import { useState, useRef, useEffect } from "react";
import { Bubble, Sender } from "@ant-design/x";
import markdownit from "markdown-it";

const LLMStreamPage = () => {
  const [query, setQuery] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState(null);
  const [steps, setSteps] = useState([]);
  const [streamMessage, setStreamMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const abortControllerRef = useRef(null);

  const md = markdownit({ html: true, breaks: true });

  const renderMarkdown = (content) => {
    return (
      <>
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: used in demo */}
        <div dangerouslySetInnerHTML={{ __html: md.render(content) }} />
      </>
    );
  };

  // 清理函数：组件卸载时中断请求
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const startStream = async () => {
    if (!query.trim()) {
      setError("Query cannot be empty");
      return;
    }

    // 重置状态
    setError(null);
    setSteps([]);
    // setMessages([]);
    setStreamMessage("");
    setIsStreaming(true);

    try {
      // 创建中断控制器
      abortControllerRef.current = new AbortController();

      const response = await fetch("/llm/search/stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query, messages }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
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
        setError(err.message || "Streaming failed");
      }
    } finally {
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  };

  const processEvent = (eventData) => {
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

    // 处理不同事件类型
    if (eventType === "error") {
      try {
        const errorData = JSON.parse(data);
        setError(errorData.error || "Unknown error");
      } catch (e) {
        setError("Invalid error format");
      }
    } else if (eventType === "end") {
      setIsStreaming(false);
    } else if (data) {
      // 忽略心跳包
      if (data === ":keep-alive") return;

      try {
        const parsed = JSON.parse(data);

        if (parsed.mode === "updates") {
          setSteps((prev) => [
            ...prev,
            {
              id: Date.now(),
              node: parsed.node,
              data: parsed.data,
              timestamp: new Date().toLocaleTimeString(),
            },
          ]);
          if (parsed.data.messages) setMessages(parsed.data.messages);
        } else if (parsed.mode === "messages") {
          setStreamMessage((prev) => prev + parsed.llm_token.data.content);
        }
      } catch (e) {
        console.error("Failed to parse event data:", e);
      }
    }
  };

  const stopStream = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsStreaming(false);
    }
  };

  return (
    <div className="container mx-auto p-4 max-w-8xl">
      <h1 className="text-2xl font-bold mb-6">Web Search</h1>

      {/* 查询输入区域 */}
      <div className="mb-6">
        <Sender
          submitType="shiftEnter"
          value={query}
          onChange={(value) => setQuery(value)}
          placeholder="Press Shift + Enter to send message"
          loading={isStreaming}
          onSubmit={() => {
            startStream();
          }}
          onCancel={() => {
            stopStream();
          }}
        />

        {error && (
          <div className="mt-2 text-red-500 bg-red-50 p-2 rounded">
            Error: {error}
          </div>
        )}
      </div>

      {/* 临时流式消息区域 */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-3">Stream Message</h2>
        <Bubble
          content={streamMessage}
          messageRender={renderMarkdown}
          // avatar={{ icon: <UserOutlined /> }}
        />
        <div className="border rounded p-4 bg-gray-50 min-h-[200px]">
          {streamMessage ? (
            <p className="text-gray-500">{streamMessage}</p>
          ) : (
            <p className="text-gray-500">
              {isStreaming
                ? "Waiting for stream message..."
                : "Stream message will appear here"}
            </p>
          )}
        </div>
      </div>

      {/* 步骤展示区域 */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-3 flex items-center">
          Processing Steps
          {isStreaming && (
            <span className="ml-2 text-sm text-green-500 animate-pulse">
              (Live)
            </span>
          )}
        </h2>

        <div className="border rounded p-4 bg-gray-50 min-h-[200px]">
          {steps.length === 0 ? (
            <p className="text-gray-500">
              {isStreaming
                ? "Waiting for steps..."
                : "Processing steps will appear here"}
            </p>
          ) : (
            <div className="space-y-2">
              {steps.map((step) => (
                <div
                  key={step.id}
                  className="p-3 bg-white border-l-4 border-blue-400 shadow-sm"
                >
                  <div className="flex justify-between text-sm text-gray-500 mb-1">
                    <span>Step:</span>
                    <span>{step.node}</span>
                  </div>
                  <div className="font-mono">{JSON.stringify(step.data)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 结果对话展示区域 */}
      <div>
        <h2 className="text-xl font-semibold mb-3">Results</h2>

        <div className="border rounded p-4 bg-gray-50 min-h-[200px]">
          {messages.length === 0 ? (
            <p className="text-gray-500">
              {isStreaming
                ? "Waiting for results..."
                : "Final results will appear here"}
            </p>
          ) : (
            <div className="space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className="p-4 bg-white rounded-lg shadow"
                >
                  <div className="flex justify-between text-sm text-gray-500 mb-2">
                    <span>Role:</span>
                    <span>{message.role}</span>
                  </div>
                  <div className="mb-3">{message.content}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LLMStreamPage;
