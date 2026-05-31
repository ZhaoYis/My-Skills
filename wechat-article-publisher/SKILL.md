---
name: wechat-article-publisher
description: 发布 Markdown 或 HTML 文章到微信公众号草稿箱。支持检查 API key、列出已授权公众号账号、按 appid 发布内容、区分普通文章与小绿书图文，并与 wechat-article-writer 串联形成“写作→发布草稿”闭环。当用户提到发布公众号、发到微信公众号草稿箱、把 Markdown/HTML 发到微信公众平台、测试公众号发布时使用此 skill。
---

# 微信公众号草稿发布

目标：把用户已经写好的 Markdown 或 HTML 内容，稳定发布到微信公众号草稿箱，而不是正式自动发表。

## 核心原则

1. 只发布到草稿箱，绝不替用户正式群发。
2. 先检查 API key，再做账号查询和发布，尽早失败。
3. 先确认目标公众号账号；如果只有一个账号可自动使用，多个账号则让用户选择。
4. 尽量保持用户原始内容，不擅自改写正文。
5. 如果内容来自 `wechat-article-writer`，优先保存为 Markdown 后再发布。
6. 用户明确要“小绿书/图文消息”时，使用 `newspic` 类型；否则默认 `news`。

## 目录结构

- `scripts/wechat_api.py`：调用 wx.limyai.com API，支持列账号和发布

## 前置条件

执行前检查以下条件：

1. 环境变量 `WECHAT_API_KEY` 已设置
2. Python 3.9+
3. 用户的公众号已在 wx.limyai.com 完成授权
4. 待发布文件是以下格式之一：
   - `.md`
   - `.markdown`
   - `.html`
   - `.htm`

## 默认工作流

### Step 1：确认发布输入

先确认以下信息：
- 要发布的文件路径
- 文件格式：Markdown 还是 HTML
- 发布类型：
  - `news`：普通公众号文章
  - `newspic`：小绿书/图文消息
- 是否已指定公众号 appid

如果用户只说“帮我发布这篇公众号文章”，但没有给路径或内容，需要先补齐。

### Step 2：检查 API key

使用脚本先检查 API 能否正常调用。推荐先执行列账号命令，因为它天然能同时验证 key 是否有效：

```bash
python /absolute/path/to/scripts/wechat_api.py list-accounts
```

如果报错：
- `API_KEY_MISSING`：说明没有设置 key
- `API_KEY_INVALID`：说明 key 无效或已失效

此时不要继续发布，先把错误明确告诉用户。

### Step 3：获取公众号账号

执行：

```bash
python /absolute/path/to/scripts/wechat_api.py list-accounts
```

处理逻辑：
- 如果只有 1 个账号：直接使用该账号的 `wechatAppid`
- 如果有多个账号：列出名称、appid、状态，让用户选
- 如果账号为空：提示用户先去 wx.limyai.com 授权公众号
- 如果账号 token 过期：提示用户重新授权

## Step 4：识别文件格式

按文件扩展名判断：
- `.md` / `.markdown` → 使用 `--markdown`
- `.html` / `.htm` → 使用 `--html`

如果扩展名不明确，但用户明确说是 HTML/Markdown，可按用户指定处理。

## Step 5：发布到草稿箱

### 发布 Markdown

```bash
python /absolute/path/to/scripts/wechat_api.py publish \
  --appid <wechatAppid> \
  --markdown /path/to/article.md
```

### 发布 HTML

```bash
python /absolute/path/to/scripts/wechat_api.py publish \
  --appid <wechatAppid> \
  --html /path/to/article.html
```

### 发布小绿书/图文消息

```bash
python /absolute/path/to/scripts/wechat_api.py publish \
  --appid <wechatAppid> \
  --markdown /path/to/article.md \
  --type newspic
```

## Step 6：回报结果

成功后要明确告诉用户：
- 已经进入公众号草稿箱
- 还需要用户去微信公众平台手动预览和正式发布
- 返回关键 ID 方便排查：
  - `publicationId`
  - `materialId`
  - `mediaId`

## 与 wechat-article-writer 的衔接

如果用户先让你写文章，再要求发布：

1. 先用 `wechat-article-writer` 生成定稿
2. 把终稿保存为 Markdown 文件
3. 如用户没有指定账号，先查账号
4. 再调用本 skill 发布到草稿箱
5. 最终提醒用户：需要人工登录公众号后台审核与发布

## 推荐命令

以下路径都要使用绝对路径，当前 skill 目录下脚本路径为：

`/Users/mrzhaoyi/Workspace/LLM/My-Skills/wechat-article-publisher/scripts/wechat_api.py`

### 列出账号

```bash
python /Users/mrzhaoyi/Workspace/LLM/My-Skills/wechat-article-publisher/scripts/wechat_api.py list-accounts
```

### 发布 Markdown

```bash
python /Users/mrzhaoyi/Workspace/LLM/My-Skills/wechat-article-publisher/scripts/wechat_api.py publish \
  --appid <wechatAppid> \
  --markdown /absolute/path/to/article.md
```

### 发布 HTML

```bash
python /Users/mrzhaoyi/Workspace/LLM/My-Skills/wechat-article-publisher/scripts/wechat_api.py publish \
  --appid <wechatAppid> \
  --html /absolute/path/to/article.html
```

## 错误处理

### API_KEY_MISSING
现象：没配置 `WECHAT_API_KEY`
处理：提醒用户配置环境变量后再试

### API_KEY_INVALID
现象：key 无效
处理：提醒用户检查 `.env` 或重新生成有效 key

### ACCOUNT_NOT_FOUND
现象：账号不存在或未授权
处理：提醒用户先在 wx.limyai.com 授权公众号

### ACCOUNT_TOKEN_EXPIRED
现象：授权过期
处理：提醒用户重新授权

### INVALID_PARAMETER
现象：参数不合法，比如 appid 错、文件路径错、格式不支持
处理：检查命令参数，尤其是文件路径和格式

### WECHAT_API_ERROR
现象：微信接口调用失败
处理：可能是临时故障，可稍后重试

## 最佳实践

1. 发布前先确认标题是否合适，不要把临时草稿直接发上去
2. 标题尽量控制在 64 字以内
3. 摘要尽量控制在 120 字以内
4. HTML 适合复杂排版；Markdown 适合常规写作流
5. 如果只是测试 API，优先准备一篇最小 Markdown 文件进行验证
6. 遇到多个账号时，不要猜，必须让用户选

## 最小测试流程

当用户说“测试发布文章”时，默认这样做：

1. 先执行 `list-accounts` 验证 API key
2. 如果 key 正常，再确认测试文件路径
3. 自动识别文件类型
4. 选定账号后发布到草稿箱
5. 返回发布结果或错误原因

## 输出要求

发布成功时，答复至少包含：
- 目标公众号 appid 或账号名
- 发布文件路径
- 发布类型：`news` 或 `newspic`
- 是否成功进入草稿箱
- 后续提醒：请去公众号后台预览并手动发布

发布失败时，答复至少包含：
- 失败阶段：检查 key / 列账号 / 发布内容
- 错误码或错误信息
- 下一步建议

## 一句话总结

这个 skill 负责把已经写好的文章安全送进微信公众号草稿箱，重点是“稳定、可核查、不自动正式发布”。