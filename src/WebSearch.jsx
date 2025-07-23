import { useState, useRef, useEffect, memo } from "react";
import { Bubble, Sender } from "@ant-design/x";
import { Typography } from "antd";
import { RobotOutlined, UserOutlined } from "@ant-design/icons";
import { Button, Flex, Switch } from "antd";
import markdownit from "markdown-it";

const md = markdownit({ html: true, breaks: true });

const RenderMarkdown = ({ content }) => {
  return (
    <Typography>
      {/* biome-ignore lint/security/noDangerouslySetInnerHtml: used in demo */}
      <div dangerouslySetInnerHTML={{ __html: md.render(content) }} />
    </Typography>
  );
};

const rolesAsObject = {
  assistant: {
    placement: "start",
    avatar: { icon: <RobotOutlined />, style: { background: "#1d3acdff" } },
    style: {
      maxWidth: 1200,
    },
    messageRender: (content) => {
      return <RenderMarkdown content={content} />;
    },
  },
  user: {
    placement: "end",
    avatar: { icon: <UserOutlined />, style: { background: "#87d068" } },
  },
};

const WebSearchCard = memo(({ url, title, content }) => {
  return (
    <div className="border rounded-lg p-4 mb-4 h-40 overflow-y-auto bg-white shadow">
      <a
        href={url}
        className="text-blue-500 hover:underline break-all"
        target="_blank"
        rel="noopener noreferrer"
      >
        <h4 className="text-lg font-semibold mb-2">{title}</h4>
      </a>
      <Typography className="mt-2 text-gray-600">
        {content.substring(0, 100)}
      </Typography>
    </div>
  );
});

const WebSearch = () => {
  const [query, setQuery] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState(null);
  const [steps, setSteps] = useState([]);
  const [streamMessage, setStreamMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const abortControllerRef = useRef(null);
  const streamMessageSourceNodeRef = useRef("");

  const RenderMarkdown = ({ content }) => {
    return (
      <Typography>
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: used in demo */}
        <div dangerouslySetInnerHTML={{ __html: md.render(content) }} />
      </Typography>
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
      setError("查询不能为空");
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
      if (!error) {
        setQuery("");
      }
      abortControllerRef.current = null;
    }
  };

  const parseEventData = (eventData) => {
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
  };

  const handleErrorEvent = (data) => {
    try {
      const errorData = JSON.parse(data);
      setError(errorData.error || "Unknown error");
    } catch (e) {
      setError("Invalid error format");
    }
  };

  const handleUpdatesEvent = (parsed) => {
    setStreamMessage((prev) => prev + `\n`);
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
  };

  const handleMessagesEvent = (parsed) => {
    streamMessageSourceNodeRef.current = parsed.metadata.langgraph_node;
    setStreamMessage((prev) => {
      return prev + parsed.llm_token.data.content;
    });
  };

  const processEvent = (eventData) => {
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
        const parsed = JSON.parse(data);

        if (parsed.mode === "updates") {
          handleUpdatesEvent(parsed);
        } else if (parsed.mode === "messages") {
          handleMessagesEvent(parsed);
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
    <div className="container mx-auto p-4 h-screen flex flex-col bg-gray-100">
      {/* Header区域 */}
      <header className="h-1/12 bg-white rounded-lg shadow p-4 mb-4">
        <h1 className="text-2xl font-bold text-gray-800">Web Search</h1>
        {error && (
          <div className="text-xs text-red-600 bg-red-50 p-2 rounded mt-2">
            Error: {error}
          </div>
        )}
      </header>
      {/* 搜索结果展示区域 */}
      <div className="flex flex-row gap-6 h-10/12">
        <div className="flex-2 w-2/3 h-full overflow-y-auto bg-white rounded-lg shadow p-4">
          {/* 临时流式消息区域，所有的mode:message类型的数据都会展示在这*/}
          <div className="mb-6">
            <h2 className="text-xl font-semibold mb-3 text-gray-700">
              Stream Message
            </h2>

            <div className="border rounded-lg p-4 bg-gray-50 min-h-[50px]">
              {streamMessage ? (
                <RenderMarkdown content={streamMessage} />
              ) : (
                <p className="text-gray-400">
                  {isStreaming
                    ? "Waiting for stream message..."
                    : "Stream message will appear here"}
                </p>
              )}
            </div>
          </div>
          {/* 步骤展示区域 */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-3 flex items-center text-gray-700">
              Processing Steps
              {isStreaming && (
                <span className="ml-2 text-sm text-green-500 animate-pulse">
                  (Live)
                </span>
              )}
            </h2>

            <div className="border rounded-lg p-4 bg-gray-50 min-h-[200px]">
              {steps.length === 0 ? (
                <p className="text-gray-400">
                  {isStreaming
                    ? "Waiting for steps..."
                    : "Processing steps will appear here"}
                </p>
              ) : (
                <div className="flex flex-wrap gap-4">
                  {steps.map((step) => (
                    <div
                      key={step.id}
                      className="p-3 bg-white border-l-4 border-blue-400 shadow rounded-lg overflow-y-auto"
                    >
                      <div className="flex gap-2 text-sm text-gray-600 mb-1">
                        <span>Step:</span>
                        <span className="font-bold text-gray-800">
                          {step.node}
                        </span>
                      </div>
                      {step.node === "analyze_need_web_search" && (
                        <div className="flex flex-wrap gap-4 mt-2">
                          <RenderMarkdown
                            content={JSON.stringify({
                              query: step.data.query,
                              isNeedWebSearch: step.data.isNeedWebSearch,
                              reason: step.data.reason,
                              confidence: step.data.confidence,
                            })}
                          />
                        </div>
                      )}
                      {/* generate_search_query 节点 */}
                      {step.node === "generate_search_query" && (
                        <div className="flex flex-wrap gap-4 mt-2">
                          <RenderMarkdown
                            content={JSON.stringify({
                              web_search_query: step.data.web_search_query,
                              web_search_depth: step.data.web_search_depth,
                              reason: step.data.reason,
                              confidence: step.data.confidence,
                            })}
                          />
                        </div>
                      )}
                      {/* web_search 节点 */}
                      {step.node === "web_search" && (
                        <div className="flex flex-wrap gap-4 mt-2">
                          {step.data.web_search_results.map((search_data) => (
                            <div className="w-[calc(20%-1rem)]">
                              <WebSearchCard
                                key={search_data.url}
                                url={search_data.url}
                                title={search_data.title}
                                content={search_data.content}
                              />
                            </div>
                          ))}
                        </div>
                      )}
                      {/* evaluate_search_results 节点 */}
                      {step.node === "evaluate_search_results" && (
                        <div className="flex flex-wrap gap-4 mt-2">
                          <RenderMarkdown
                            content={JSON.stringify({
                              is_sufficient: step.data.is_sufficient,
                              followup_search_query:
                                step.data.followup_search_query,
                              search_depth: step.data.search_depth,
                              reason: step.data.reason,
                              confidence: step.data.confidence,
                            })}
                          />
                        </div>
                      )}
                      {step.node === "assistant" && (
                        <div className="font-mono h-20 overflow-y-auto">
                          {JSON.stringify(step.data)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
        {/* 结果对话展示区域 */}
        <div className="flex-1 w-1/3 h-full overflow-y-auto bg-white rounded-lg shadow p-4">
          <Bubble.List
            roles={rolesAsObject}
            items={messages.map((message, i) => {
              return { key: i, role: message.role, content: message.content };
            })}
          />
        </div>
      </div>
      {/* 查询输入区域 */}
      <div className="flex justify-center items-center w-full mt-2 h-1/12 bg-white rounded-lg shadow p-4 z-10">
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
      </div>
    </div>
  );
};

export default WebSearch;
