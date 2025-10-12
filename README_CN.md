# CKB Spilman 支付通道 - AI 助手演示项目

基于 CKB (Nervos) 区块链的 Spilman 单向支付通道演示应用，集成 AI 对话助手，实现按块级别的实时微支付。

## 📋 项目概述

这是一个创新的去中心化应用（DApp），展示了如何在 AI 对话场景中使用 CKB 区块链的 Spilman 支付通道实现微支付。用户可以创建支付通道，与 AI 助手对话，并在接收到 AI 响应的每个数据块（chunk）时进行实时支付。

### 核心特性

- 🔐 **钱包认证**：基于 CKB 私钥的安全认证系统
- 💰 **支付通道管理**：创建、激活、结算 Spilman 单向支付通道
- 🤖 **AI 对话助手**：集成 OpenAI API 的智能对话系统
- 📊 **块级别支付**：实时追踪并支付 AI 响应的每个数据块
- ⚡ **自动支付**：支持自动支付和手动支付两种模式
- 🔄 **实时更新**：支付状态和余额的实时同步显示
- 📈 **管理后台**：完整的用户、通道和定时任务管理系统
- ⏰ **定时任务**：自动结算即将过期的支付通道

## 🏗️ 技术栈

### 前端
- **框架**: Next.js 15.5.2 (App Router)
- **UI 组件**: 
  - Radix UI - 无障碍组件库
  - Tailwind CSS 4.0 - 原子化 CSS
  - Lucide React - 图标库
  - Framer Motion - 动画库
- **AI 助手**: 
  - assistant-ui - AI 对话界面组件
  - AI SDK - 流式响应处理
- **日期处理**: Day.js (支持时区转换)

### 后端
- **运行时**: Next.js API Routes (Edge Runtime)
- **数据库**: Better-SQLite3 (本地 SQLite)
- **认证**: JWT (jose)
- **定时任务**: node-cron

### 区块链
- **网络**: CKB Devnet (测试网)
- **SDK**: @ckb-ccc/core v1.12.1
- **加密算法**: @noble/curves (secp256k1)
- **支付协议**: Spilman 单向支付通道

## 📁 项目结构

```
dapp_2/
├── app/                          # Next.js App Router
│   ├── admin/                    # 管理后台
│   │   ├── channels/            # 支付通道管理页面
│   │   ├── tasks/               # 定时任务管理页面
│   │   └── users/               # 用户管理页面
│   ├── api/                     # API 路由
│   │   ├── admin/               # 管理员 API
│   │   ├── auth/                # 认证 API (登录/登出)
│   │   ├── channel/             # 支付通道 API
│   │   ├── chat/                # AI 对话 API
│   │   └── chunks/              # 块级支付 API
│   ├── assistant.tsx            # AI 助手主页面
│   └── page.tsx                 # 首页
├── components/                   # 可复用组件
│   ├── shared/                  # 共享业务组件
│   └── ui/                      # UI 基础组件
├── features/                     # 功能模块
│   ├── admin/                   # 管理功能
│   ├── assistant/               # AI 助手功能
│   │   ├── components/          # 助手相关组件
│   │   └── hooks/               # 助手相关 Hooks
│   ├── auth/                    # 认证功能
│   ├── payment/                 # 支付功能
│   │   ├── components/          # 支付组件
│   │   └── hooks/               # 支付 Hooks
│   └── settings/                # 设置功能
├── lib/                         # 工具库
│   ├── client/                  # 客户端工具
│   │   ├── api.ts              # API 客户端
│   │   ├── auth-client.ts      # 认证客户端
│   │   └── chunk-payment-integration.ts
│   ├── server/                  # 服务端工具
│   │   ├── database.ts         # 数据库操作
│   │   ├── auth.ts             # 服务端认证
│   │   └── cron-manager.ts     # 定时任务管理
│   └── shared/                  # 共享工具
│       ├── ckb.ts              # CKB 区块链工具
│       ├── date-utils.ts       # 日期工具
│       └── utils.ts            # 通用工具
├── scripts/                     # 脚本文件
│   ├── clear-payment-channels.js
│   ├── clear-database-tables.js
│   ├── cron-auto-settle.js
│   └── cron-scheduler.js
└── deployment/                  # 部署配置
    └── devnet/                 # Devnet 配置
```

## 🚀 快速开始

### 环境要求

- Node.js 18.0 或更高版本
- pnpm (推荐) 或 npm/yarn
- CKB Devnet 节点访问权限

### 安装步骤

1. **克隆项目**
   ```bash
   git clone <repository-url>
   cd dapp_2
   ```

2. **安装依赖**
   ```bash
   pnpm install
   # 或
   npm install
   ```

3. **启动 CKB Devnet 节点**
   ```bash
   # 使用 offckb 启动本地 CKB 开发网络
   offckb node
   ```
   
   > **注意**: 确保已安装 [offckb](https://github.com/RetricSu/offckb) 工具。如未安装，请先运行：
   > ```bash
   > npm install -g @offckb/cli
   > ```
   > 
   > 节点启动后默认运行在 `http://localhost:28114`，保持此终端窗口运行状态。

4. **配置环境变量**
   
   创建 `.env.local` 文件：
   ```env
   # OpenAI API 配置
   OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   OPENAI_BASE_URL=https://api.openai.com/v1  # 可选，自定义 API 端点
   
   # CKB 区块链配置
   CKB_NODE_URL=http://localhost:28114  # CKB Devnet 节点地址
   SELLER_PRIVATE_KEY=0xxxxxxxxxxxxx     # 卖方（服务端）私钥
   SELLER_ADDRESS=ckt1xxxxxxxxxxxxxxxxx   # 卖方地址
   
   # JWT 密钥（用于认证）
   JWT_SECRET=your-secret-key-here
   
5. **初始化数据库**
   
   首次运行时，数据库会自动创建。如需清空数据：
   ```bash
   # 清空支付通道数据
   pnpm run clear-channels
   
   # 清空所有数据表
   pnpm run clear-tables
   ```

6. **启动开发服务器**
   ```bash
   pnpm dev
   ```

7. **访问应用**
   
   打开浏览器访问 [http://localhost:3000](http://localhost:3000)

## 💡 使用指南

### 1. 用户登录

- 在主页面的登录表单中输入你的 CKB 私钥
- 点击"Login"完成登录

> **安全说明**: 
> - 🔒 **我们不会向服务端发送您的私钥**，私钥仅在客户端本地处理
> - 🔑 只有从私钥派生的公钥会发送到服务器进行身份验证
> - 💾 **演示目的**：私钥存储在浏览器的 localStorage 中
> - 🚫 **生产环境请勿使用此方式存储私钥**
>
> **获取测试账号**:
> ```bash
> # 查看可用的测试账号
> offckb accounts
> ```
> 选择其中一个账号的私钥用于测试。

### 2. 创建支付通道

- 认证成功后，进入"Payment Channels"标签
- 点击"Create New Channel"
- 设置通道参数：
  - **金额 (Amount)**: 充值金额（CKB）
  - **持续时间 (Duration)**: 通道有效期（天数）
- 点击"Create Channel"创建通道
- 等待链上确认后，通道状态变为"Active"

### 3. 激活支付通道

- 在支付通道列表中，点击"Confirm Funding"
- 系统会自动提交融资交易到 CKB 网络
- 确认后通道变为"Active"状态
- 设置为默认通道以开始使用

### 4. 与 AI 对话并支付

- 返回主页面，开始与 AI 助手对话
- 启用"Auto Pay"开关实现自动支付
- 每次 AI 响应都会生成数据块（chunk）
- 支付状态面板显示：
  - 当前消费的 Tokens
  - 剩余 Tokens
  - 支付记录列表
- 可以查看每笔支付的交易详情

### 5. 结算支付通道

- 在 Payment Channels 中选择要结算的通道
- 点击"Settle Channel"
- 系统会将最后一笔支付交易提交到链上
- 结算成功后，剩余金额退回买方地址

> **说明**: 为了演示我们在客户端增加了结算功能，其实在服务端也会跑一个定时任务，会把快过期的通道自动结算。

## 🔧 管理功能

访问 [http://localhost:3000/admin](http://localhost:3000/admin) 进入管理后台

### 功能模块

- **用户管理**: 查看所有用户、禁用/启用用户
- **支付通道管理**: 查看所有通道、结算
- **定时任务管理**: 
  - 自动结算即将过期的通道（15分钟内）
  - 检查并标记过期通道（主要是为了让客户端在 UI 上可以提取保证金，其实当过期后即使不做这个定时任务，您也可以拿交易数据自行提取保证金）
  - 查看任务执行日志

## 📊 数据库结构

### 主要数据表

1. **users** - 用户表
   - 存储用户信息、公钥、关联地址

2. **payment_channels** - 支付通道表
   - 通道 ID、金额、状态、时间戳
   - 签名数据、交易数据

3. **chunk_payments** - 块级支付记录表
   - 块 ID、Token 数量、支付状态
   - 交易数据、买方签名

4. **task_logs** - 定时任务日志表
   - 任务执行记录、状态、结果



## 🎯 核心概念

### Spilman 支付通道

Spilman 通道是一种单向支付通道，允许买方向卖方进行多次支付，但只需最终在链上结算一次：

1. **创建阶段**: 
   - 买方创建融资交易锁定资金
   - 卖方签名退款交易（带时间锁）
   
2. **支付阶段**:
   - 买方签名新的支付交易更新分配
   - 卖方持有最新的支付交易
   
3. **结算阶段**:
   - 卖方提交最后一笔支付交易到链上
   - 或者超时后买方可以退款

### 块级支付流程

1. 用户发送消息给 AI 助手
2. AI 开始流式返回响应数据
3. 每个数据块到达时：
   - 计算块的 Token 数量
   - 计算累计支付金额
   - 构造支付交易并签名
   - 发送到服务端验证
4. 服务端验证签名并存储
5. 前端更新支付状态

## 🛠️ 开发命令

```bash
# 开发
pnpm dev              # 启动开发服务器

# 构建
pnpm build            # 生产构建
pnpm start            # 启动生产服务器

# 代码质量
pnpm lint             # ESLint 检查
pnpm prettier         # Prettier 格式检查
pnpm prettier:fix     # 自动格式化

# 数据库管理
pnpm clear-channels   # 清空支付通道
pnpm clear-tables     # 清空所有表

# 定时任务
pnpm cron-auto-settle # 运行自动结算任务
pnpm cron-scheduler   # 运行定时任务调度器
```

## 📝 环境变量说明

| 变量名 | 说明 | 必需 | 示例 |
|--------|------|------|------|
| `OPENAI_API_KEY` | OpenAI API 密钥 | 是 | `sk-xxx...` |
| `OPENAI_BASE_URL` | OpenAI API 端点 | 否 | `https://api.openai.com/v1` |
| `SELLER_PRIVATE_KEY` | 卖方私钥 | 是 | `0x...` |
| `JWT_SECRET` | JWT 签名密钥 | 是 | `your-secret` |

## 🐛 故障排除

### 常见问题

**Q: 连接钱包失败**
- 检查私钥格式是否正确（需要 0x 前缀）
- 确认私钥对应的地址有足够的 CKB 余额

**Q: 支付通道创建失败**
- 检查 CKB 节点是否正常运行
- 确认卖方私钥和地址配置正确
- 查看浏览器控制台和服务器日志

**Q: AI 对话无响应**
- 检查 OPENAI_API_KEY 是否配置正确
- 确认网络连接正常
- 检查 API 配额是否用尽

**Q: 定时任务不执行**
- 进入管理后台检查任务状态
- 手动启动任务测试
- 查看任务执行日志


## 📄 许可证

本项目采用 MIT 许可证。

## 🙏 致谢

- [CKB (Nervos Network)](https://nervos.org/) - 区块链基础设施
- [assistant-ui](https://github.com/Yonom/assistant-ui) - AI 对话界面
- [Next.js](https://nextjs.org/) - React 框架
- [Radix UI](https://www.radix-ui.com/) - UI 组件库

## 📞 联系方式

如有问题或建议，请通过以下方式联系：

- 提交 GitHub Issue
- 发送邮件至: [happy.sonny.dev@gmail.com]

---

**注意**: 本项目仅用于演示和学习目的，请勿在生产环境中使用未经审计的代码。
