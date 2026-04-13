---
name: file-code-review
description: Review specified files or code snippets against project conventions and generate a code review report. Use when the user wants to review specific files (e.g., "review this file", "审查这个文件") or code blocks (e.g., "review this code", "审查这段代码") without git context. Supports single file, multiple files, or pasted code snippets.
license: MIT
compatibility: No special requirements
metadata:
  author: zhaoyi
  version: "1.3"
  generatedBy: "1.0.0"
---

Review specified files or code snippets against project conventions and generate a code review report.

**Input**: Specify what to review:
- File path(s): `/file-code-review path/to/file.java`
- Code snippet: User pastes code directly
- Multiple files: `/file-code-review file1.java file2.java`

**IMPORTANT**: This skill MUST read `openspec/project.md` before performing the review to understand project-specific conventions and constraints.

**重要**: 审查报告必须使用中文输出。

**Steps**

1. **Load project conventions**

   **CRITICAL**: First read `openspec/project.md` to get:
   - Technology stack constraints
   - Layered architecture rules
   - Naming conventions
   - Code style requirements
   - Design patterns
   - Important constraints

   Use these conventions as the baseline for the review.

2. **Determine review target**

   Check user input to determine what to review:

   **a. File path(s) provided:**
   - Read the specified file(s) using Read tool
   - Support glob patterns (e.g., `src/**/*.java`)

   **b. Code snippet provided:**
   - User directly pastes code in conversation
   - Analyze the code without file path context

   **c. No input provided:**
   - Ask user using **AskUserQuestion tool**:
     > "请提供要审查的文件路径或代码内容。您可以：
     > 1. 指定文件路径（如 `src/main/java/Example.java`）
     > 2. 直接粘贴代码内容"

3. **Secret scanning**

   Scan the code for potential secrets:
   - API keys (patterns like `api_key`, `apikey`, `API_KEY`)
   - Passwords (`password`, `passwd`, `pwd`)
   - Tokens (`token`, `access_token`, `refresh_token`)
   - Private keys (`-----BEGIN.*PRIVATE KEY-----`)
   - Database URLs with credentials
   - AWS/Azure/GCP credentials

   **If secrets detected:**
   - Add to Critical issues section
   - Suggest using environment variables or secret management

4. **Perform code review based on openspec/project.md**

   Analyze the code against the project conventions:

   **4.1 Technology Stack Compliance:**
   - Java 8 compatibility (no Java 9+ features: `var`, `record`, `sealed`, pattern matching, text blocks)
   - Spring Boot annotations usage
   - MyBatis/MyBatis-Plus usage (`@TableName`)
   - MapStruct for object conversion
   - Lombok annotations (`@Data`, `@Builder`, `@Slf4j`, `@AllArgsConstructor`, `@NoArgsConstructor`)
   - PageHelper for pagination
   - Swagger 2 (`@Api`, `@ApiOperation`, `@ApiModelProperty`) or OpenAPI 3 (`@Schema`)

   **4.2 Layered Architecture Compliance:**
   Check that code follows the strict layering: Web → Biz → Core → Common
   - No reverse dependencies (lower layers depending on upper layers)
   - No cross-layer dependencies (each layer only depends on direct lower layer)

   **4.3 Naming Conventions:**

   | Type | Pattern | Example |
   |------|---------|---------|
   | Controller | `*Controller` | `PurWebContractPaymentBaseController` |
   | BizService | `*BizService` / `*BizServiceImpl` | `ContractPaymentBaseBizService` |
   | DomainService | `*DomainService` / `*DomainServiceImpl` | `ContractPaymentBaseDomainService` |
   | DO | `*DO` | `ContractPaymentBaseDO` |
   | Model | `*Model` | `ContractPaymentBaseModel` |
   | VO | `*VO` | `WebContractPaymentConfirmedVO` |
   | Request | `*Request` | `ContractPaymentBaseAddRequest` |
   | Converter | `*Convert` / `*Converter` | `ContractPaymentBaseConvert` |
   | Utils | `*Utils` | `AssertUtils` |

   **4.4 Annotation Usage:**

   **Controller Layer:**
   - `@RestController`, `@RequestMapping`
   - `@Api` + `@ApiOperation` (Swagger 2) or `@Schema` (OpenAPI 3)
   - `@Slf4j`
   - `@Authority(permissionCode = ...)` or `@NonLoginAuthority`
   - `@Validated` with JSR-303 annotations
   - Return type: `YzwResult<T>`

   **BizService Layer:**
   - Interface: `*BizService`
   - Implementation: `@Service`, `@Slf4j`, `*BizServiceImpl`
   - Injection: `@Resource` (preferred) or `@Autowired`

   **DomainService Layer:**
   - Interface: `*DomainService`
   - Implementation: `@Service`, `@Slf4j`, `*DomainServiceImpl`
   - Write operations: `@Transactional(rollbackFor = Throwable.class)`

   **DO Objects:**
   - Extend `AbstractBaseDO`
   - `@TableName` (MyBatis-Plus)
   - `@Data`, `@ToString(callSuper = true)`, `@EqualsAndHashCode(callSuper = true)`

   **Model Objects:**
   - Extend `AbstractBaseBO`
   - `@Data`
   - JavaDoc for fields

   **Request Objects:**
   - AddRequest extends `CreateInfo`
   - UpdateRequest extends `UpdateInfo`
   - `@Data`, `@Builder`, `@AllArgsConstructor`, `@NoArgsConstructor`

   **4.5 Code Style:**
   - Import order: Java stdlib → Third-party → Project internal
   - No full package name imports (e.g., use `List` not `java.util.List`)
   - Empty lines between class members and methods
   - Use `log.debug()`, `log.info()`, `log.error()` - NO `System.out.println()`

   **4.6 Error Handling:**
   - Use `AssertUtils` for validation
   - Throw `BusinessException` with `BizErrorCode`
   - Private validation methods: `validateAddXxx()`, `validateUpdateXxx()`

   **4.7 Pagination:**
   - Use `PageHelper.startPage(pageNum, pageSize)`
   - Convert to `Page<DO>` type
   - Use `PageConvertUtils.pageResultConvert(PageInfo, List)`

   **4.8 Object Conversion:**
   - MUST use MapStruct (`@Mapper` with `INSTANCE` constant)
   - Call pattern: `XxxConvert.INSTANCE.method(...)`
   - NO manual field-by-field conversion

   **4.9 Collection Handling:**
   - Use `CollectionUtils.isEmpty()` / `CollectionUtils.isNotEmpty()`
   - Use `StringUtils` (Apache Commons Lang3) for strings

   **4.10 Transaction Management:**
   - Write operations MUST have `@Transactional(rollbackFor = Throwable.class)`
   - Read operations: no transaction needed

   **4.11 Security:**
   - SQL injection prevention (parameterized queries)
   - XSS prevention
   - Input validation
   - Authentication/Authorization with `@Authority`

   **4.12 Performance:**
   - N+1 query detection
   - Batch query optimization
   - Efficient algorithms

5. **Save review report to file (使用中文)**

   **CRITICAL: 不需要询问用户，直接保存。**

   a. 如果 `openspec/review/` 目录不存在，先用 Shell 创建 `mkdir -p openspec/review`
   b. 使用 Write 工具将报告写入 `openspec/review/YYYY-MM-DD-HH:mm-file-review.md`（文件名中的时间使用当前时间）

   **Report structure (中文模板):**
   ```markdown
   # 代码审查报告

   **日期:** YYYY-MM-DD HH:mm
   **审查人:** Claude Opus 4.6
   **审查范围:** 指定文件 / 代码片段
   **规范基准:** openspec/project.md

   ## 审查目标

   - 文件: <file-path> (如果是文件)
   - 代码片段 (如果是代码块)

   ## 概要

   - 审查文件数: X
   - 总行数: X
   - 发现问题数: X (严重: X, 重要: X, 一般: X, 建议: X)

   ## 严重问题 🚨

   <!-- 必须立即修复的严重问题 -->

   1. **[安全] SQL注入风险** - `file.java:123`
      ```java
      // 问题代码片段
      ```
      **修复建议:** 使用参数化查询

   ## 重要问题 ⚠️

   <!-- 应该修复的重要问题 -->

   ## 一般问题 📝

   <!-- 轻微问题或代码风格改进 -->

   ## 改进建议 💡

   <!-- 可选的改进建议 -->

   ## 规范违规 (openspec/project.md)

   | 规范类型 | 位置 | 问题描述 |
   |----------|------|----------|
   | 命名规范 | file.java:10 | 类名不符合规范 |

   ## 敏感信息扫描结果

   - 未检测到敏感信息 ✅

   ## 修复建议

   1. 优先修复项
   2. 后续步骤

   ## 亮点肯定 ✨

   <!-- 代码中发现的良好实践 -->
   ```

6. **Output full report to conversation, then prompt for fix proposal (输出报告+询问提案，合并为一条消息)**

   **在同一条消息中完成以下全部内容：**

   a. **输出完整报告内容**到对话（与 Step 5 保存到文件的内容相同）
   b. **在报告末尾注明**：`> 报告已保存到 openspec/review/YYYY-MM-DD-HH:mm-file-review.md`
   c. **如果发现严重或重要问题**，在报告输出之后使用 **AskUserQuestion tool** 询问：
      > "审查发现 X 个严重问题和 Y 个重要问题。是否需要生成 OpenSpec 修复提案？"

      **选项：**
      - `生成修复提案` - 使用 `/opsx:propose` 生成修复提案
      - `暂不生成` - 稍后手动处理
   d. **如果仅有一般问题和建议**，不发起 AskQuestion，消息到此结束。

7. **If user chose to generate fix proposal, create proposal and append summary to report (提案生成+摘要回写)**

   **当用户选择"生成修复提案"后：**

   a. 根据问题类型生成提案名称（kebab-case）：
      - 安全问题：`fix-security-<issue-type>`
      - 规范违规：`fix-convention-<issue-type>`
      - 性能问题：`fix-performance-<issue-type>`
      - 混合问题：`fix-<主要问题描述>`

   b. 构建提案描述：
      - **Why**: 说明发现的问题及其影响
      - **What Changes**: 列出需要修复的文件和修改内容
      - 引用审查报告路径

   c. 调用 `/opsx:propose` 生成修复提案

   d. 提案生成完成后，**必须将提案摘要追加写入已保存的报告文件末尾**（Read 报告文件获取当前内容，在末尾追加后重新 Write），追加内容：

   ```markdown
   ## 修复提案

   **提案名称:** <change-name>
   **提案路径:** `openspec/changes/<change-name>/`
   **生成时间:** YYYY-MM-DD HH:mm

   ### 提案包含制品
   - `proposal.md` - 提案文档
   - `design.md` - 设计文档
   - `specs/` - 规格文档
   - `tasks.md` - 实施任务

   ### 后续操作
   运行 `/opsx:apply` 开始实施修复。
   ```

   e. 在对话中告知用户：提案已生成，摘要已追加到报告文件中，运行 `/opsx:apply` 开始实施修复。

**Output On Success (中文输出 - 无严重/重要问题)**

```
## 文件审查完成

**审查目标:** <file-path> / 代码片段
**规范基准:** openspec/project.md
**报告文件:** openspec/review/YYYY-MM-DD-HH:mm-file-review.md

### 问题统计

| 严重程度 | 数量 |
|----------|------|
| 严重 | 0 |
| 重要 | 0 |
| 一般 | X |
| 建议 | X |

### 敏感信息扫描
✅ 未检测到敏感信息
```

**Output On Success With Fix Proposal (有严重/重要问题且用户同意生成提案)**

```
## 文件审查完成

**审查目标:** <file-path> / 代码片段
**规范基准:** openspec/project.md
**报告文件:** openspec/review/YYYY-MM-DD-HH:mm-file-review.md

### 问题统计

| 严重程度 | 数量 |
|----------|------|
| 严重 | X |
| 重要 | X |
| 一般 | X |
| 建议 | X |

### 修复提案已生成

**提案名称:** fix-<issue-name>
**提案路径:** openspec/changes/fix-<issue-name>/
**提案摘要已追加到报告文件中。**

运行 `/opsx:apply` 开始实施修复。
```

**严重程度说明**

| 严重程度 | 图标 | 判定标准 | 处理建议 |
|----------|------|----------|----------|
| 严重 | 🚨 | 安全漏洞、Bug、破坏性变更、敏感信息泄露 | 必须立即修复 |
| 重要 | ⚠️ | 规范违规、性能问题、SOLID原则违反 | 应尽快修复 |
| 一般 | 📝 | 代码风格、命名、注释 | 建议修复 |
| 建议 | 💡 | 最佳实践、优化建议 | 可选修复 |

**Review Focus Areas**

When user specifies focus areas, prioritize:
- `security` - Focus on security vulnerabilities + secret scanning
- `performance` - Focus on performance issues + N+1 queries
- `style` - Focus on code style and conventions
- `architecture` - Focus on layered architecture and design patterns
- `all` - Full review (default)

**Guardrails**

- ALWAYS read `openspec/project.md` before reviewing
- Support file paths, glob patterns, and pasted code snippets
- Always run secret scanning
- **ALWAYS save review report to `openspec/review/` — do NOT ask, just save**
- **审查报告必须使用中文输出**
- Use severity levels consistently
- Check against project-specific conventions from openspec/project.md
- Provide actionable recommendations with file paths and line numbers
- Include code snippets in issue descriptions
- Include positive highlights to encourage good practices
- Never auto-fix issues without user confirmation
- **AskQuestion 使用约束**：整个流程中最多使用一次 AskQuestion（在 Step 6c，仅当存在严重或重要问题时）。不要在其他步骤额外询问。
- **Step 5 仅保存文件，Step 6 才输出到对话**：严格分离"保存"和"展示"两个动作，避免重复或遗漏。
- **生成修复提案时：**
  - 仅在发现严重或重要问题时提示生成提案
  - 提案名称使用 kebab-case 格式
  - 提案描述必须包含审查报告路径

**Error Handling**

- If `openspec/project.md` not found: Warn user and use default conventions
- If file not found: Inform user and ask for correct path
- If code snippet is too short: Ask user to provide more context
- If review directory creation fails: Show error and output to conversation

**Usage Examples**

```
# Review a single file
/file-code-review src/main/java/cn/yzw/jc/pprod/web/home/ExampleController.java

# Review multiple files
/file-code-review file1.java file2.java

# Review with glob pattern
/file-code-review "src/**/*Controller.java"

# Review pasted code (just paste code after invoking the skill)
/file-code-review
[用户粘贴代码]
```
