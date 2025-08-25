// React 核心库导入
import { useState, useRef, useEffect, memo } from "react";
// Ant Design X 组件导入
import { Bubble, Sender, ThoughtChain, Welcome } from "@ant-design/x";
// Ant Design 组件导入
import { Typography, Card, Button, Drawer, List, Table, Tag } from "antd";
// Ant Design 图标导入
import {
  RobotOutlined,
  UserOutlined,
  ChromeOutlined,
  HistoryOutlined,
  FileTextOutlined,
  SearchOutlined,
  FilterOutlined,
} from "@ant-design/icons";
// Markdown 解析库导入
import markdownit from "markdown-it";
import ReactJson from "react-json-view";
import { v4 as uuidv4 } from "uuid";

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
const ContractSearchCard = memo(({ contract }) => {
  return (
    <div className="border rounded-lg p-4 mb-4 overflow-y-auto bg-white shadow hover:shadow-md transition-shadow duration-200">
      <div className="flex items-center mb-2">
        <FileTextOutlined className="text-blue-500 mr-2" />
        <h4 className="text-lg font-semibold text-gray-800">
          {contract.project_name}
        </h4>
      </div>
      <div className="mb-2">
        <Tag color="blue" className="mr-2">
          合同号: {contract.contact_no}
        </Tag>
        <Tag color="green">项目: {contract.project_name}</Tag>
      </div>
      <Typography className="text-gray-600">
        <strong>元数据:</strong> {contract.contract_meta?.substring(0, 200)}...
      </Typography>
      <div className="mt-2">
        <Typography className="text-gray-600">
          <strong>设备列表:</strong>{" "}
          {contract.equipment_table?.substring(0, 200)}...
        </Typography>
      </div>
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

const JsonRender = memo(({ data }) => {
  return (
    <ReactJson
      name={false}
      displayDataTypes={false}
      src={data}
      indentWidth={2}
      collapsed={2}
      sortKeys
    />
  );
});

function renderStep(step) {
  switch (step.node) {
    case "generate_search_words":
      return (
        <div className="mt-3">
          <div className="mb-2">
            <Tag color="blue" icon={<SearchOutlined />}>
              项目关键词
            </Tag>
            {step.data?.project_key_words?.map((word, index) => (
              <Tag key={index} className="ml-1">
                {word}
              </Tag>
            ))}
          </div>
          <div>
            <Tag color="green" icon={<SearchOutlined />}>
              设备关键词
            </Tag>
            {step.data?.equipments_key_words?.map((word, index) => (
              <Tag key={index} className="ml-1">
                {word}
              </Tag>
            ))}
          </div>
        </div>
      );
    case "vector_search":
      return (
        <div className="mt-3">
          <div className="mb-2">
            <Tag color="purple" icon={<SearchOutlined />}>
              向量搜索结果
            </Tag>
            <span className="text-sm text-gray-600 ml-2">
              {step.data?.length} 条合同记录
            </span>
          </div>
          {step.data?.slice(0, 3).map((contract, index) => (
            <div key={index} className="mb-2">
              <Tag color="blue">{contract.contact_no}</Tag>
              <span className="ml-2">{contract.project_name}</span>
            </div>
          ))}
          {step.data?.length > 3 && (
            <div className="text-gray-500 text-sm">
              ...等 {step.data.length} 条记录
            </div>
          )}
        </div>
      );
    case "keyword_search":
      return (
        <div className="mt-3">
          <div className="mb-2">
            <Tag color="orange" icon={<SearchOutlined />}>
              关键词搜索结果
            </Tag>
            <span className="text-sm text-gray-600 ml-2">
              {step.data?.length} 条合同记录
            </span>
          </div>
          {step.data?.slice(0, 3).map((contract, index) => (
            <div key={index} className="mb-2">
              <Tag color="blue">{contract.contact_no}</Tag>
              <span className="ml-2">{contract.project_name}</span>
            </div>
          ))}
          {step.data?.length > 3 && (
            <div className="text-gray-500 text-sm">
              ...等 {step.data.length} 条记录
            </div>
          )}
        </div>
      );
    case "filter_contracts":
      return (
        <div className="mt-3">
          <div className="mb-2">
            <Tag color="cyan" icon={<FilterOutlined />}>
              过滤后合同
            </Tag>
            <span className="text-sm text-gray-600 ml-2">
              {step.data?.length} 条有效合同
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {step.data?.slice(0, 4).map((contract, index) => (
              <ContractSearchCard key={index} contract={contract} />
            ))}
          </div>
        </div>
      );
    default:
      return (
        <div className="font-mono max-h-50 overflow-y-auto">
          <JsonRender data={step.data} />
        </div>
      );
  }
}

//设置步骤节点的渲染内容
function getThoughtChainContent(step) {
  if (step.status === "pending") {
    return <>{step.node} 节点正在执行...</>;
  } else {
    return renderStep(step);
  }
}

// 合同搜索主组件
const ContractSearch = () => {
  const [query, setQuery] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState(null);
  const [steps, setSteps] = useState([]); //步骤，keys:node,data
  const [streamMessage, setStreamMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [currentNode, setCurrentNode] = useState("");
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [history, setHistory] = useState(() => {
    const savedHistory = localStorage.getItem("chatHistory");
    return savedHistory ? JSON.parse(savedHistory) : [];
  });
  const [currentConversationId, setCurrentConversationId] = useState(null);
  const [loadingConversationId, setLoadingConversationId] = useState(null);
  const abortControllerRef = useRef(null);
  const [openStatus, setOpenStatus] = useState(false);

  // 将历史记录保存到localStorage中
  useEffect(() => {
    localStorage.setItem("chatHistory", JSON.stringify(history));
  }, [history]);

  // 监听messages变量的变化，在对话结束时保存记录
  useEffect(() => {
    // 只有在非流式传输状态下才保存记录
    if (!isStreaming && messages.length > 0) {
      saveConversationToHistory();
    }
  }, [messages, isStreaming]);

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

  // 保存当前对话到历史记录
  const saveConversationToHistory = () => {
    if (messages.length > 0) {
      const timestamp = new Date().toLocaleString();

      if (currentConversationId) {
        // 如果当前对话是从历史记录中恢复的，更新该历史记录
        setHistory((prevHistory) => {
          const existingIndex = prevHistory.findIndex(
            (item) => item.id === currentConversationId
          );
          if (existingIndex >= 0) {
            // 更新现有历史记录
            const updatedHistory = [...prevHistory];
            updatedHistory[existingIndex] = {
              ...updatedHistory[existingIndex],
              timestamp: timestamp,
              messages: [...messages],
            };
            return updatedHistory;
          } else {
            // 如果没有找到现有历史记录，创建新的历史记录
            const conversation = {
              id: uuidv4(),
              timestamp: timestamp,
              messages: [...messages],
            };
            return [conversation, ...prevHistory];
          }
        });
      } else {
        // 如果当前对话不是从历史记录中恢复的，创建新的历史记录
        const conversation = {
          id: uuidv4(),
          timestamp: timestamp,
          messages: [...messages],
        };
        setHistory((prevHistory) => [conversation, ...prevHistory]);
      }
    }
  };

  const handleNewSearch = () => {
    // 保存当前对话到历史记录
    saveConversationToHistory();

    // 清空当前恢复的对话的uuid
    setCurrentConversationId(null);

    setSteps([]);
    setMessages([]);
    setStreamMessage("");
    setIsStreaming(false);
    setCurrentNode("");
    setError(null);
    setQuery();
  };

  // 恢复历史对话
  const restoreConversation = (conversation) => {
    // 关闭Drawer
    setDrawerVisible(false);

    // 保存当前恢复的对话的uuid
    setCurrentConversationId(conversation.id);

    // 清空当前状态
    setSteps([]);
    setIsStreaming(false);
    setCurrentNode("");
    setError(null);

    // 设置历史对话为当前对话
    setMessages(conversation.messages);

    // 将最后一条assistant的消息设置为streamMessage
    const lastAssistantMessage = conversation.messages
      .filter((msg) => msg.role === "assistant")
      .pop();
    setStreamMessage(lastAssistantMessage ? lastAssistantMessage.content : "");
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
    setOpenStatus(true);
    setMessages((prev) => {
      return [
        ...prev,
        { role: "user", content: query },
        { role: "assistant", content: "", status: "loading" },
      ];
    });
    setStreamMessage("");
    setIsStreaming(true);

    try {
      // 创建中断控制器
      abortControllerRef.current = new AbortController();

      const response = await fetch("/llm/contract/stream", {
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

  // 处理custom数据，目前用来指示节点转换
  const handleCustomEvent = (parsed) => {
    console.log("Custom event from node:", parsed);
    if (parsed.data.type === "node_execute") {
      if (parsed.data.data.status === "running") {
        setCurrentNode(parsed.data.node);
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
              node: parsed.data.node,
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
  const handleUpdatesEvent = (parsed) => {
    // 处理更新事件，例如更新搜索状态
    console.log("Updates event:", parsed);
  };

  // 处理消息事件函数
  const handleMessagesEvent = (parsed) => {
    // 更新消息内容
    setStreamMessage((prev) => {
      return prev + (parsed.data.data.content || "");
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
      // 保存最后的消息
      setMessages((prev) => {
        let temp_arr = prev.slice(0, -1);
        return [...temp_arr, { role: "assistant", content: streamMessage }];
      });
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
      //暂存最后的临时消息
      setMessages((prev) => {
        let temp_arr = prev.slice(0, -1);
        return [...temp_arr, { role: "assistant", content: streamMessage }];
      });
    }
  };

  // 获取节点图标
  const getNodeIcon = (nodeName) => {
    switch (nodeName) {
      case "generate_search_words":
        return <SearchOutlined className="text-blue-500" />;
      case "vector_search":
        return <FileTextOutlined className="text-purple-500" />;
      case "keyword_search":
        return <FileTextOutlined className="text-orange-500" />;
      case "filter_contracts":
        return <FilterOutlined className="text-green-500" />;
      default:
        return <RobotOutlined />;
    }
  };

  return (
    <div className="container mx-auto p-2 h-screen flex flex-col bg-gray-100">
      {/* Header区域 */}
      <header className="h-1/12 flex flex-row px-3 justify-center items-center gap-6 bg-white rounded-lg shadow mb-2">
        <div className="flex-1">
          <h1 className="text-3xl font-bold">合同搜索</h1>
        </div>
        <div className="flex gap-2">
          <Button type="primary" onClick={handleNewSearch}>
            新对话
          </Button>
          <Button
            type="primary"
            icon={<HistoryOutlined />}
            onClick={() => setDrawerVisible(true)}
          >
            历史记录
          </Button>
        </div>
        {error && (
          <div className="text-xs text-red-600 bg-red-50 p-2 rounded mt-2">
            Error: {error}
          </div>
        )}
      </header>

      {/* 历史记录Drawer */}
      <Drawer
        title="历史对话记录"
        placement="left"
        closable={true}
        onClose={() => setDrawerVisible(false)}
        open={drawerVisible}
        width={400}
      >
        <List
          dataSource={history}
          renderItem={(item) => (
            <List.Item
              key={item.id}
              onClick={() => {
                restoreConversation(item);
              }}
              className={`cursor-pointer p-3 border rounded-xl mb-4 bg-white shadow-md hover:shadow-lg transition-all duration-300 ease-in-out ${
                item.id === currentConversationId
                  ? "border-blue-500 ring-2 ring-blue-200"
                  : "border-gray-200 hover:border-blue-400"
              }`}
            >
              <List.Item.Meta
                title={
                  <div className="flex justify-between items-center px-3">
                    <span className="font-medium text-gray-800 truncate max-w-xs">
                      {item.messages.length > 0
                        ? `${item.messages[0].content.substring(0, 20)}...`
                        : "空对话"}
                    </span>
                    <span className="text-xs text-gray-500 bg-white px-2 py-1 rounded">
                      {item.messages.length} 条消息
                    </span>
                  </div>
                }
                description={
                  <div className="text-xs text-gray-500 mt-3 px-3">
                    {item.timestamp}
                  </div>
                }
              />
            </List.Item>
          )}
        />
      </Drawer>

      {/* 搜索结果展示区域 */}
      <div className="flex flex-row gap-4 h-10/12">
        <div className="flex-2 w-2/3 h-full overflow-y-auto bg-white rounded-lg shadow p-4">
          {/* 步骤展示区域 */}
          {steps.length > 0 && (
            <CollapsiblePanel title="合同搜索流程" openStatus={openStatus}>
              <>
                <h2 className="text-xl font-semibold mb-3 flex items-center text-gray-700">
                  {isStreaming && currentNode && (
                    <span className="ml-2 text-sm text-green-500 animate-pulse">
                      {currentNode} 节点正在执行...
                    </span>
                  )}
                </h2>
                <ThoughtChain
                  items={steps.map((step) => {
                    return {
                      title: (
                        <div className="flex items-center">
                          {getNodeIcon(step.node)}
                          <span className="ml-2">{step.node}</span>
                          {step.status === "pending" && (
                            <span className="ml-2 text-xs text-gray-500">
                              (处理中...)
                            </span>
                          )}
                        </div>
                      ),
                      status: step.status,
                      content: getThoughtChainContent(step),
                    };
                  })}
                  collapsible={true}
                />
              </>
            </CollapsiblePanel>
          )}
          {/* 临时流式消息区域，所有的mode:message类型的数据都会展示在这*/}
          {streamMessage && (
            <div className="mt-4">
              <h2 className="text-xl font-semibold mb-3 text-gray-700">
                最终结果：
              </h2>

              <div className="border rounded-lg p-4 bg-gray-50 min-h-[100px]">
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
        <Sender
          submitType="shiftEnter"
          value={query}
          onChange={(value) => setQuery(value)}
          placeholder="输入合同查询问题，按 Shift + Enter 发送"
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

export default ContractSearch;
