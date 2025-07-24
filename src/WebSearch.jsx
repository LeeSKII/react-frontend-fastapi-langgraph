// React 核心库导入
import { useState, useRef, useEffect, memo } from "react";
// Ant Design X 组件导入
import { Bubble, Sender, ThoughtChain, Welcome } from "@ant-design/x";
// Ant Design 组件导入
import { Typography, Card, Button } from "antd";
// Ant Design 图标导入
import { RobotOutlined, UserOutlined, ChromeOutlined } from "@ant-design/icons";
// 移除未使用的 Ant Design 组件导入
// Markdown 解析库导入
import markdownit from "markdown-it";

// 初始化 Markdown 解析器，支持 HTML 和换行
const md = markdownit({ html: true, breaks: true });

// 渲染 Markdown 内容的组件
const RenderMarkdown = ({ content }) => {
  return (
    <Typography>
      {/* biome-ignore lint/security/noDangerouslySetInnerHtml: used in demo */}
      <div dangerouslySetInnerHTML={{ __html: md.render(content) }} />
    </Typography>
  );
};
// 定义聊天角色的配置对象
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

// 搜索结果卡片组件
const WebSearchCard = memo(({ url, title, content }) => {
  return (
    <div className="border rounded-lg p-4 mb-4 h-40 overflow-y-auto bg-white shadow hover:shadow-md transition-shadow duration-200">
      <a
        href={url}
        className="text-blue-600 hover:underline break-all"
        target="_blank"
        rel="noopener noreferrer"
      >
        <h4 className="text-lg font-semibold mb-2 hover:text-blue-700 transition-colors duration-200">
          {title}
        </h4>
      </a>
      <Typography className="mt-2 text-gray-600">
        {content.substring(0, 100)}
      </Typography>
    </div>
  );
});

const CollapsiblePanel = ({ title, openStatus, children }) => {
  const [isOpen, setIsOpen] = useState(openStatus);

  //外部属性变化之后触发状态
  useEffect(() => {
    setIsOpen(openStatus);
  }, [openStatus]);

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden shadow-sm">
      <button
        className="w-full px-4 py-3 text-left font-medium flex justify-between items-center bg-gray-50 hover:bg-gray-100 transition-colors duration-200"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span>{title}</span>
        <svg
          className={`w-5 h-5 transform transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      <div
        className={`transition-all duration-200 overflow-hidden ${
          isOpen ? "max-h-screen opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="p-4 bg-white">{children}</div>
      </div>
    </div>
  );
};

//设置步骤节点的渲染内容
function getThoughtChainContent(step) {
  if (step.status === "pending") {
    return <>{step.node} 节点正在执行...</>;
  } else {
    return (
      <div className="p-3 bg-white border-l-4 border-blue-400 shadow rounded-lg overflow-y-auto">
        {step.node === "analyze_need_web_search" && (
          <div className="flex flex-wrap gap-4 mt-2">
            <RenderMarkdown
              content={JSON.stringify({
                query: step.data?.query,
                isNeedWebSearch: step.data?.isNeedWebSearch,
                reason: step.data?.reason,
                confidence: step.data?.confidence,
              })}
            />
          </div>
        )}
        {/* generate_search_query 节点 */}
        {step.node === "generate_search_query" && (
          <div className="flex flex-wrap gap-4 mt-2">
            <RenderMarkdown
              content={JSON.stringify({
                web_search_query: step.data?.web_search_query,
                web_search_depth: step.data?.web_search_depth,
                reason: step.data?.reason,
                confidence: step.data?.confidence,
              })}
            />
          </div>
        )}
        {/* web_search 节点 */}
        {step.node === "web_search" && (
          <div className="flex flex-wrap gap-4 mt-2">
            {step.data &&
              step.data.web_search_results.map((search_data) => (
                <div className="w-[calc(20%-1rem)] p-2">
                  <WebSearchCard
                    key={search_data?.url}
                    url={search_data?.url}
                    title={search_data?.title}
                    content={search_data?.content}
                    snippet={search_data?.snippet}
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
                is_sufficient: step.data?.is_sufficient,
                followup_search_query: step.data?.followup_search_query,
                search_depth: step.data?.search_depth,
                reason: step.data?.reason,
                confidence: step.data?.confidence,
              })}
            />
          </div>
        )}
        {/* assistant 节点 */}
        {step.node === "assistant_node" && (
          <div className="font-mono h-20 overflow-y-auto">
            {JSON.stringify(step.data)}
          </div>
        )}
      </div>
    );
  }
}

// Web 搜索主组件
const WebSearch = () => {
  const [query, setQuery] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState(null);
  const [steps, setSteps] = useState([]); //步骤，keys:node,data
  const [streamMessage, setStreamMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [currentNode, setCurrentNode] = useState("");
  const abortControllerRef = useRef(null);
  const [openStatus, setOpenStatus] = useState(true);

  // 清理函数：组件卸载时中断请求
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  useEffect(() => {
    if (currentNode === "assistant_node") {
      setOpenStatus(false);
    }
  }, [currentNode]);

  const handleNewSearch = () => {
    setSteps([]);
    setMessages([]);
    setStreamMessage("");
    setIsStreaming(false);
    setCurrentNode("");
    setQuery();
  };

  // 开始流式传输函数
  const startStream = async () => {
    if (!query.trim()) {
      setError("查询不能为空");
      return;
    }

    // 重置状态
    setError(null);
    setSteps([]);
    setMessages((prev) => {
      return [
        ...prev,
        { role: "user", content: query },
        { role: "assistant", content: "开始回答...", status: "loading" },
      ];
    });
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

  // 解析事件数据函数
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

  // 处理错误事件函数
  const handleErrorEvent = (data) => {
    try {
      const errorData = JSON.parse(data);
      setError(errorData.error || "Unknown error");
    } catch (e) {
      setError("Invalid error format");
    }
  };

  //处理custom数据，目前用来指示节点转换
  const handleCustomEvent = (parsed) => {
    console.log("Custom event from node:", parsed);
    if (parsed.data.type === "node_execute") {
      if (parsed.data.data.status === "running") {
        setCurrentNode(parsed.node);
        setSteps((prev) => [
          ...prev,
          {
            id: Date.now(),
            node: parsed.data.node,
            status: "pending",
          },
        ]);
      }
      // 节点从正在执行变成已完成
      if (parsed.data.data.status === "done") {
        console.log("Node done:", parsed);
        setSteps((prev) => {
          let temp_arr = prev.slice(0, -1);
          return [
            ...temp_arr, // 排除最后一个元素
            {
              id: Date.now(),
              node: parsed.node,
              data: parsed.data.data.data,
              status: "success",
            },
          ];
        });
      }
    }

    // 节点有流式消息传输
    if (
      parsed.data.type === "update_stream_messages" &&
      parsed.data.data.status === "running"
    ) {
      setStreamMessage("");
    }
    if (parsed.data.type === "update_messages") {
      setMessages((prev) => {
        return [
          ...prev.slice(0, -1), // 排除最后一个元素
          parsed.data.data.messages[parsed.data.data.messages.length - 1],
        ];
      });
    }
  };

  // 处理更新事件函数
  const handleUpdatesEvent = (parsed) => {};

  // 处理消息事件函数
  const handleMessagesEvent = (parsed) => {
    setStreamMessage((prev) => {
      return prev + parsed.data.data.content;
    });
  };

  // 处理事件函数
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
        } else if (parsed.mode === "custom") {
          handleCustomEvent(parsed);
        }
      } catch (e) {
        console.error("Failed to parse event data:", e);
      }
    }
  };

  // 停止流式传输函数
  const stopStream = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsStreaming(false);
    }
  };

  return (
    <div className="container mx-auto p-2 h-screen flex flex-col bg-gray-100">
      {/* Header区域 */}
      <header className="h-1/12 flex flex-row gap-6 bg-white rounded-lg shadow p-2 mb-2">
        <div className="flex-1">
          <Welcome
            icon=<ChromeOutlined className="" />
            title="Deep Search"
            description="Base on Langgraph, fastapi and react"
          />
        </div>
        {error && (
          <div className="text-xs text-red-600 bg-red-50 p-2 rounded mt-2">
            Error: {error}
          </div>
        )}
      </header>

      {/* 搜索结果展示区域 */}
      <div className="flex flex-row gap-4 h-10/12">
        <div className="flex-2 w-2/3 h-full overflow-y-auto bg-white rounded-lg shadow p-4">
          {/* 步骤展示区域 */}
          {steps.length > 0 && (
            <CollapsiblePanel title="Process Steps" openStatus={openStatus}>
              <>
                <h2 className="text-xl font-semibold mb-3 flex items-center text-gray-700">
                  {isStreaming && (
                    <span className="ml-2 text-sm text-green-500 animate-pulse">
                      ({currentNode}+" 节点正在执行...")
                    </span>
                  )}
                </h2>
                <ThoughtChain
                  items={steps.map((step) => {
                    if (step.status && step.status === "pending") {
                      return {
                        title: step.node + " 节点正在执行...",
                        status: step.status,
                        content: getThoughtChainContent(step),
                      };
                    } else {
                      return {
                        title: step.node,
                        status: step.status,
                        content: getThoughtChainContent(step),
                      };
                    }
                  })}
                  collapsible={true}
                />
              </>
            </CollapsiblePanel>
          )}
          {/* 临时流式消息区域，所有的mode:message类型的数据都会展示在这*/}
          {streamMessage && (
            <div className="mb-6">
              <h2 className="text-xl font-semibold mb-3 text-gray-700">
                Stream Message
              </h2>

              <div className="border rounded-lg p-4 bg-gray-50 min-h-[50px]">
                {streamMessage ? (
                  <RenderMarkdown content={streamMessage} />
                ) : (
                  <p className="text-gray-500 italic">
                    {isStreaming ? "等待流式消息..." : "搜索结果将显示在这里"}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
        {/* 结果对话展示区域 */}
        <div className="flex-1 w-1/3 h-full overflow-y-auto bg-white rounded-lg shadow p-6">
          <Bubble.List
            roles={rolesAsObject}
            items={messages.map((message, i) => {
              let loading = false;
              if (message?.status === "loading") {
                loading = true;
              }
              return {
                key: i,
                role: message.role,
                content: message.content,
                loading: loading,
              };
            })}
          />
        </div>
      </div>
      {/* 查询输入区域 */}
      <div className="flex flex-row gap-2 justify-center items-center w-full mt-2 h-1/12 bg-white rounded-lg shadow p-4 z-10">
        <Button type="primary" size="large" onClick={handleNewSearch}>
          新对话
        </Button>
        <Sender
          submitType="shiftEnter"
          value={query}
          onChange={(value) => setQuery(value)}
          placeholder="按 Shift + Enter 发送消息"
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
