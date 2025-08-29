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

// 合同搜索主组件
const ContractSearch = () => {
  const [query, setQuery] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState(null);
  const [contracts, setContracts] = useState([]); // 选中的合同列表
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
    if (parsed.node === "generate_response") {
      //更新合同信息
      if (parsed.data.type === "update_info") {
        setContracts(parsed.data.data);
      }
      // 最后一个节点，回复节点
      if (parsed.data.type === "final_response") {
        console.log("更新最后消息：", parsed.data.data.response);
        setMessages((prev) => {
          return [
            ...prev.slice(0, -1), // 排除最后一个元素
            { role: "assistant", content: parsed.data.data.response },
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
          {/* 中间结果展示区域 */}
          {contracts.length > 0 &&
            contracts.map((contract, i) => {
              // 将合同数据转换为 JavaScript 对象
              const contractObj = typeof contract === 'string' ? JSON.parse(contract) : contract;
              
              // 解析 contract_meta 字符串为对象
              let contractMeta = {};
              if (contractObj?.contract_meta && typeof contractObj.contract_meta === 'string') {
                try {
                  // 替换单引号为双引号，并处理 None 为 null
                  const fixedMetaString = contractObj.contract_meta
                    .replace(/'/g, '"')
                    .replace(/None/g, 'null')
                    .replace(/True/g, 'true')
                    .replace(/False/g, 'false');
                  contractMeta = JSON.parse(fixedMetaString);
                } catch (e) {
                  console.error('Failed to parse contract_meta:', e);
                }
              }
              
              // 解析 equipment_table 字符串为数组
              let equipmentTableArray = [];
              if (contractObj?.equipment_table && typeof contractObj.equipment_table === 'string') {
                try {
                  // 首先尝试直接解析为 JSON
                  equipmentTableArray = JSON.parse(contractObj.equipment_table);
                } catch (e) {
                  try {
                    // 如果失败，使用更精确的替换方法
                    let tableString = contractObj.equipment_table;
                    
                    // 移除外层的方括号
                    if (tableString.startsWith('[') && tableString.endsWith(']')) {
                      tableString = tableString.substring(1, tableString.length - 1);
                    }
                    
                    // 按逗号分割，但保留引号内的内容
                    const items = [];
                    let currentItem = '';
                    let inQuotes = false;
                    let escapeNext = false;
                    
                    for (let i = 0; i < tableString.length; i++) {
                      const char = tableString[i];
                      
                      if (escapeNext) {
                        currentItem += char;
                        escapeNext = false;
                      } else if (char === '\\') {
                        escapeNext = true;
                      } else if (char === '\'' && !inQuotes) {
                        inQuotes = true;
                      } else if (char === '\'' && inQuotes) {
                        inQuotes = false;
                        items.push(currentItem);
                        currentItem = '';
                        // 跳过逗号和空格
                        while (i < tableString.length && (tableString[i + 1] === ',' || tableString[i + 1] === ' ')) {
                          i++;
                        }
                      } else if (inQuotes) {
                        currentItem += char;
                      }
                    }
                    
                    // 如果还有未处理的内容，添加到数组
                    if (currentItem) {
                      items.push(currentItem);
                    }
                    
                    equipmentTableArray = items;
                  } catch (e2) {
                    console.error('Failed to parse equipment_table with custom parser:', e2);
                    // 如果仍然失败，将整个字符串作为数组的单个元素
                    equipmentTableArray = [contractObj.equipment_table];
                  }
                }
              }
              
              return (
                <div key={i} className="mb-6 p-4 border rounded-lg bg-white shadow-sm">
                  {/* 合同基本信息 */}
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold mb-4">合同基本信息</h3>
                    
                    {/* 基本信息 */}
                    <div className="mb-4">
                      <h4 className="text-md font-medium mb-2 text-gray-800">基本信息</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        <div>
                          <span className="font-medium text-gray-700">买方合同编号：</span>
                          <span className="text-gray-900">{contractMeta?.buyer_contract_number || 'N/A'}</span>
                        </div>
                        <div>
                          <span className="font-medium text-gray-700">卖方合同编号：</span>
                          <span className="text-gray-900">{contractMeta?.seller_contract_number || 'N/A'}</span>
                        </div>
                        <div>
                          <span className="font-medium text-gray-700">合同类型：</span>
                          <span className="text-gray-900">{contractMeta?.contract_type || 'N/A'}</span>
                        </div>
                        <div>
                          <span className="font-medium text-gray-700">项目名称：</span>
                          <span className="text-gray-900">{contractMeta?.project_name || 'N/A'}</span>
                        </div>
                        <div>
                          <span className="font-medium text-gray-700">子项目名称：</span>
                          <span className="text-gray-900">{contractMeta?.sub_project_name || 'N/A'}</span>
                        </div>
                        <div>
                          <span className="font-medium text-gray-700">签约日期：</span>
                          <span className="text-gray-900">{contractMeta?.signing_date || 'N/A'}</span>
                        </div>
                      </div>
                    </div>
                    
                    {/* 金额信息 */}
                    <div className="mb-4">
                      <h4 className="text-md font-medium mb-2 text-gray-800">金额信息</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        <div>
                          <span className="font-medium text-gray-700">总金额：</span>
                          <span className="text-gray-900">{contractMeta?.total_amount || 'N/A'}</span>
                        </div>
                        <div>
                          <span className="font-medium text-gray-700">总金额（大写）：</span>
                          <span className="text-gray-900">{contractMeta?.total_amount_str || 'N/A'}</span>
                        </div>
                        <div>
                          <span className="font-medium text-gray-700">不含税金额：</span>
                          <span className="text-gray-900">{contractMeta?.tax_excluded_amount || 'N/A'}</span>
                        </div>
                        <div>
                          <span className="font-medium text-gray-700">税额：</span>
                          <span className="text-gray-900">{contractMeta?.tax_amount || 'N/A'}</span>
                        </div>
                      </div>
                    </div>
                    
                    {/* 买家信息 */}
                    <div className="mb-4">
                      <h4 className="text-md font-medium mb-2 text-gray-800">买家信息</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <span className="font-medium text-gray-700">名称：</span>
                          <span className="text-gray-900">{contractMeta?.buyer?.name || 'N/A'}</span>
                        </div>
                        <div>
                          <span className="font-medium text-gray-700">地址：</span>
                          <span className="text-gray-900">{contractMeta?.buyer?.address || 'N/A'}</span>
                        </div>
                        <div>
                          <span className="font-medium text-gray-700">联系人：</span>
                          <span className="text-gray-900">{contractMeta?.buyer?.contact_person || 'N/A'}</span>
                        </div>
                        <div>
                          <span className="font-medium text-gray-700">电话：</span>
                          <span className="text-gray-900">{contractMeta?.buyer?.phone || 'N/A'}</span>
                        </div>
                        <div>
                          <span className="font-medium text-gray-700">银行账户：</span>
                          <span className="text-gray-900">{contractMeta?.buyer?.bank_account || 'N/A'}</span>
                        </div>
                        <div>
                          <span className="font-medium text-gray-700">税号：</span>
                          <span className="text-gray-900">{contractMeta?.buyer?.tax_id || 'N/A'}</span>
                        </div>
                      </div>
                    </div>
                    
                    {/* 卖家信息 */}
                    <div className="mb-4">
                      <h4 className="text-md font-medium mb-2 text-gray-800">卖家信息</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <span className="font-medium text-gray-700">名称：</span>
                          <span className="text-gray-900">{contractMeta?.seller?.name || 'N/A'}</span>
                        </div>
                        <div>
                          <span className="font-medium text-gray-700">地址：</span>
                          <span className="text-gray-900">{contractMeta?.seller?.address || 'N/A'}</span>
                        </div>
                        <div>
                          <span className="font-medium text-gray-700">联系人：</span>
                          <span className="text-gray-900">{contractMeta?.seller?.contact_person || 'N/A'}</span>
                        </div>
                        <div>
                          <span className="font-medium text-gray-700">电话：</span>
                          <span className="text-gray-900">{contractMeta?.seller?.phone || 'N/A'}</span>
                        </div>
                        <div>
                          <span className="font-medium text-gray-700">银行账户：</span>
                          <span className="text-gray-900">{contractMeta?.seller?.bank_account || 'N/A'}</span>
                        </div>
                        <div>
                          <span className="font-medium text-gray-700">税号：</span>
                          <span className="text-gray-900">{contractMeta?.seller?.tax_id || 'N/A'}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* 设备表格 */}
                  {equipmentTableArray.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold mb-2">设备表格</h3>
                      <div className="space-y-4">
                        {equipmentTableArray.map((tableHtml, tableIndex) => {
                          // 移除首尾的单引号
                          const cleanTableHtml = typeof tableHtml === 'string'
                            ? tableHtml.replace(/^'|'$/g, '')
                            : tableHtml;
                          
                          return (
                            <div key={tableIndex} className="mb-4">
                              <div className="text-sm font-medium text-gray-600 mb-2">
                                表格 {tableIndex + 1}
                              </div>
                              <div
                                className="border rounded p-3 bg-gray-50 overflow-x-auto"
                                dangerouslySetInnerHTML={{ __html: cleanTableHtml }}
                              />
                              <style jsx>{`
                                table {
                                  width: 100%;
                                  border-collapse: collapse;
                                }
                                table th {
                                  font-weight: bold;
                                  background-color: #f8f9fa;
                                  padding: 8px;
                                  text-align: left;
                                  border: 1px solid #dee2e6;
                                }
                                table td {
                                  padding: 8px;
                                  border: 1px solid #dee2e6;
                                }
                                table tr:nth-child(even) {
                                  background-color: #f8f9fa;
                                }
                              `}</style>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

          {/* 临时流式消息区域，所有的mode:message类型的数据都会展示在这*/}
          {streamMessage && (
            <div className="mt-4">
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
