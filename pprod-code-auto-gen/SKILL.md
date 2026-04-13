---
name: pprod-code-auto-gen
description: |
  pprod（供需通用平台）代码编写辅助技能。当用户在 pprod 项目中进行任何代码编写、创建新功能、修改现有逻辑时，必须触发此技能。
  提供分层架构指导、代码模板、正确文件位置、规范注解使用、对象转换模式等，确保代码符合项目规范。
  适用于：创建 Controller、编写 BizService、实现 DomainService、定义 DO/Model/Request/VO、添加 Mapper、配置 Converter 等所有代码编写场景。
---

# pprod 代码编写指南

## 代码生成执行流程（必须遵循）

当用户请求生成代码（如提供 DDL、要求新建实体/功能等）时，**必须按以下步骤执行**：

### Step 1: 收集信息

从用户提供的 DDL 或描述中提取以下关键信息：
- 表名、表注释、业务主键字段
- 字段列表及类型
- 所属业务模块名（如 `pur`、`contract` 等）
- 作者名（默认取当前用户名）

### Step 2: 让用户选择生成层级

**必须使用 `AskQuestion` 工具**向用户提供选项，让用户选择要生成的层级：

```
标题: "请选择要生成的代码层级"
问题: "请选择需要生成的层级（支持多选）"
选项（allow_multiple = true）:
  - all: "全部层级（DAL + Core + Biz + Web）"
  - dal: "DAL层（DO、Mapper、MapperXML、ManualMapper、ConditionRequest）"
  - core: "Core层（Model、DomainService接口/实现、Request、Converter）"
  - biz: "Biz层（BizService接口/实现、Request、Converter）"
  - web: "Web层（Controller、VO、WebRequest、Converter）"
```

注意事项：
- 如果用户选择了 `all`，则生成全部层级
- 如果用户只选了上层（如 `web`），需提醒依赖层（`biz` → `core` → `dal`）是否已存在
- 层级之间有依赖关系：Web → Biz → Core → DAL，上层依赖下层

### Step 3: 确认生成方案

向用户展示即将生成的文件清单，包括：
- 每个文件的完整路径
- 所属层级
- 等待用户确认后再开始生成

### Step 4: 按层级从下到上生成

按照依赖关系从底层到上层依次生成：**DAL → Core → Biz → Web**

每个层级生成时，读取对应的 `.ftl` 模板文件（位于本 skill 的 `template/` 目录下），替换变量后生成代码。

### Step 5: 编译验证

生成完成后执行 `mvn clean compile -Pqa` 验证编译是否通过。

---

## 技术栈

- **语言**: Java 8
- **构建工具**: Maven
- **框架**: Spring Boot、Apache Dubbo、Spring Cloud OpenFeign、Apollo
- **ORM**: MyBatis + MyBatis-Plus（`@TableName`）+ PageHelper
- **工具库**: Lombok、MapStruct、Apache Commons、Hutool
- **任务调度**: XXL-Job（yzw-component-job）
- **API文档**: Swagger 2（`io.swagger.annotations`）+ OpenAPI 3
- **日志**: SLF4J + Logback
- **认证授权**: cn.yzw.iec.auac.sso.sdk
- **基础设施**: cn.yzw.infra.component.base

## 架构分层原则

```
Web → Biz → Core → Common
```
- 严格禁止反向依赖和跨层依赖
- 每层只能依赖下层

## 代码位置速查

| 层次 | 模块 | 路径 |
|------|------|------|
| Web | Controller | `pprod-web/pprod-web-home/src/main/java/cn/yzw/jc/pprod/web/home/` |
| Biz | 业务编排 | `pprod-biz/pprod-biz-shared/src/main/java/cn/yzw/jc/pprod/biz/shared/` |
| Biz | 定时任务 | `pprod-biz/pprod-biz-job/src/main/java/cn/yzw/jc/pprod/job/` |
| Biz | Dubbo实现 | `pprod-biz/pprod-service-facade-impl/src/main/java/cn/yzw/jc/pprod/service/facade/impl/` |
| Core | 领域模型 | `pprod-core/pprod-core-model/src/main/java/` |
| Core | 领域服务 | `pprod-core/pprod-core-service/src/main/java/` |
| Core | 外部集成 | `pprod-core/pprod-core-service-integration/src/main/java/` |
| Common | 工具类 | `pprod-common/pprod-common-util/src/main/java/` |
| Common | 数据访问 | `pprod-common/pprod-common-dal/src/main/java/` |
| Common | Facade定义 | `pprod-common/pprod-common-service-facade/src/main/java/` |

## 代码模板文件

本技能提供代码模板文件，位于 `template/` 目录下，可直接参考或复制使用：

| 文件 | 说明 | 模块层级 |
|------|------|------|
| `template/controller/controller.java.ftl` | Controller 层模板 | Web层 |
| `template/controller/vo.java.ftl` | VO 响应模板 | Web层 |
| `template/controller/add-request.java.ftl` | 新增请求模板 | Web层 |
| `template/controller/update-request.java.ftl` | 更新请求模板 | Web层 |
| `template/controller/query-request.java.ftl` | 查询请求模板 | Web层 |
| `template/controller/vo-converter.java.ftl` | VO 转换器模板 | Web层 |
| `template/controller/add-request-converter.java.ftl` | 新增请求转换器模板 | Web层 |
| `template/controller/update-request-converter.java.ftl` | 更新请求转换器模板 | Web层 |
| `template/controller/query-request-converter.java.ftl` | 查询请求转换器模板 | Web层 |
| `template/biz/biz-service.java.ftl` | BizService 接口模板 | Biz层 |
| `template/biz/biz-service-impl.java.ftl` | BizService 实现模板 | Biz层 |
| `template/biz/biz-add-request.java.ftl` | Biz层新增请求模板 | Biz层 |
| `template/biz/biz-update-request.java.ftl` | Biz层更新请求模板 | Biz层 |
| `template/biz/biz-add-request-converter.java.ftl` | Biz层新增请求转换器 | Biz层 |
| `template/biz/biz-update-request-converter.java.ftl` | Biz层更新请求转换器 | Biz层 |
| `template/domain/domain-service.java.ftl` | DomainService 接口模板 | Core层 |
| `template/domain/domain-service-impl.java.ftl` | DomainService 实现模板 | Core层 |
| `template/domain/domain-model.java.ftl` | Domain层模型模板 | Core层 |
| `template/domain/domain-add-request.java.ftl` | Domain层新增请求模板 | Core层 |
| `template/domain/domain-update-request.java.ftl` | Domain层更新请求模板 | Core层 |
| `template/domain/domain-query-request.java.ftl` | Domain层查询请求模板 | Core层 |
| `template/domain/domain-query-by-no-request.java.ftl` | Domain层单号查询请求模板 | Core层 |
| `template/domain/domain-query-by-nos-request.java.ftl` | Domain层多号查询请求模板 | Core层 |
| `template/domain/domain-addition-query-request.java.ftl` | Domain层附加查询请求模板 | Core层 |
| `template/domain/domain-model-converter.java.ftl` | Domain层模型转换器模板 | Core层 |
| `template/domain/domain-add-request-converter.java.ftl` | Domain层新增请求转换器模板 | Core层 |
| `template/domain/domain-update-request-converter.java.ftl` | Domain层更新请求转换器模板 | Core层 |
| `template/dal/dal-do.java.ftl` | DAL层 DO 对象模板 | Common层 |
| `template/dal/dal-mapper.java.ftl` | DAL层 Mapper 接口模板 | Common层 |
| `template/dal/dal-mapper.xml.ftl` | DAL层 Mapper XML 模板 | Common层 |
| `template/dal/dal-manual-mapper.java.ftl` | DAL层 ManualMapper 接口模板 | Common层 |
| `template/dal/dal-manual-mapper.xml.ftl` | DAL层 ManualMapper XML 模板 | Common层 |
| `template/dal/dal-condition-request.java.ftl` | DAL层条件查询请求模板 | Common层 |

### 模板变量说明

| 变量 | 说明 | 示例 |
|------|------|------|
| `${packageName}` | 基础包名 | `cn.yzw.jc.pprod` |
| `${moduleName}` | 模块名 | `.pur` |
| `${subPackage}` | 子包名 | `.controller.pur` |
| `${modulePath}` | 模块路径 | `/pur` |
| `${javaBeanName}` | Java 类名 | `Vendor` |
| `${javaBeanNameLF}` | Java 类名首字母小写 | `vendor` |
| `${tableComment}` | 表注释 | `供应商` |
| `${bizPkNo}` | 业务主键字段名 | `vendorNo` |
| `${bizPkColumnComment}` | 业务主键字段注释 | `供应商编号` |
| `${author}` | 作者名 | `zhaoyi` |
| `${tableName}` | 数据库表名 | `t_vendor` |
| `${bizPkColumnName}` | 业务主键数据库列名 | `vendor_no` |
| `${bizPkType}` | 业务主键Java类型 | `String` / `Long` |
| `${bizPkMethodName}` | 业务主键方法名（首字母大写） | `VendorNo` |
| `${bizPkJdbcType}` | 业务主键JDBC类型 | `VARCHAR` / `BIGINT` |
| `${columns}` | 字段列表 | `List<Column>` |
| `${hasDateField}` | 是否有Date类型字段 | `true/false` |
| `${hasLocalDateField}` | 是否有LocalDate类型字段 | `true/false` |
| `${hasLocalDateTimeField}` | 是否有LocalDateTime类型字段 | `true/false` |
| `${hasBigDecimalField}` | 是否有BigDecimal类型字段 | `true/false` |
| `${sortSql}` | ManualMapper 排序 SQL 片段（用于 `queryByStartId`） | `id asc` |

### MySQL 与 Java 数据类型映射

以下为数据库字段类型与 Java 代码类型的对应关系：

| MySQL 类型 | Java 类型 | 说明 |
|------|------|------|
| `VARCHAR` | `String` | 字符串 |
| `CHAR` | `String` | 字符串 |
| `TEXT` | `String` | 长文本 |
| `TINYINT` | `Integer` | 整数 |
| `SMALLINT` | `Integer` | 整数 |
| `INT` / `INTEGER` | `Integer` | 整数 |
| `BIGINT` | `Long` | 长整数 |
| `FLOAT` | `Float` | 浮点数 |
| `DOUBLE` | `Double` | 双精度浮点数 |
| `DECIMAL` | `BigDecimal` | 精确数值 |
| `DATE` | `LocalDate` | 日期 |
| `DATETIME` | `LocalDateTime` | 日期时间 |
| `TIMESTAMP` | `LocalDateTime` | 时间戳 |
| `TIME` | `LocalTime` | 时间 |
| `BOOLEAN` / `BOOL` | `Boolean` | 布尔值 |
| `BIT(1)` | `Boolean` | 布尔值 |
| `BLOB` | `byte[]` | 二进制数据 |
| `BINARY` | `byte[]` | 二进制数据 |
| `VARBINARY` | `byte[]` | 二进制数据 |
| `JSON` | `String` | JSON 字符串 |

### DDL 示例

用户可通过提供 DDL 语句生成代码，例如：

```sql
CREATE TABLE `t_vendor` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `vendor_no` varchar(32) NOT NULL COMMENT '供应商编号',
  `vendor_name` varchar(128) NOT NULL COMMENT '供应商名称',
  `contact_person` varchar(64) DEFAULT NULL COMMENT '联系人',
  `contact_phone` varchar(32) DEFAULT NULL COMMENT '联系电话',
  `vendor_type` tinyint DEFAULT NULL COMMENT '供应商类型：1-直供 2-渠道',
  `credit_limit` decimal(15,2) DEFAULT NULL COMMENT '信用额度',
  `address` varchar(256) DEFAULT NULL COMMENT '地址',
  `status` tinyint NOT NULL DEFAULT '1' COMMENT '状态：0-禁用 1-启用',
  `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `update_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `delete_flag` tinyint NOT NULL DEFAULT '0' COMMENT '删除标志：0-正常 1-已删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_vendor_no` (`vendor_no`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='供应商表';
```

基于上述 DDL，生成代码时的关键变量值：

- `${tableName}` = `t_vendor`
- `${tableComment}` = `供应商表`
- `${javaBeanName}` = `Vendor`
- `${bizPkNo}` = `vendorNo`
- `${bizPkColumnName}` = `vendor_no`
- `${bizPkType}` = `String`
- `${hasLocalDateTimeField}` = `true` (create_time, update_time)
- `${hasBigDecimalField}` = `true` (credit_limit)


---

## 代码模板（唯一真实来源：template/ 目录下的 .ftl 文件）

**重要**: 生成代码时必须读取 `template/` 目录下对应的 `.ftl` 模板文件，以模板为准。以下仅为各层关键结构说明。

### 各层级生成文件清单

#### DAL 层（Common）
| 模板文件 | 生成类 | 说明 |
|----------|--------|------|
| `template/dal/dal-do.java.ftl` | `XxxDO` | 继承 `AbstractBaseDO`，仅包含非基类字段 |
| `template/dal/dal-mapper.java.ftl` | `XxxMapper` | 8 个标准 CRUD 方法（含 `selectOne`） |
| `template/dal/dal-mapper.xml.ftl` | `XxxMapper.xml` | 对应 Mapper 接口的 SQL |
| `template/dal/dal-manual-mapper.java.ftl` | `XxxManualMapper` | 自定义查询接口 |
| `template/dal/dal-manual-mapper.xml.ftl` | `XxxManualMapper.xml` | 自定义查询 SQL（含 `queryByStartId`、`queryByCondition`） |
| `template/dal/dal-condition-request.java.ftl` | `XxxConditionDalRequest` | 继承 `BaseQueryByStartIdDO`，条件查询请求 |

#### Core 层
| 模板文件 | 生成类 | 说明 |
|----------|--------|------|
| `template/domain/domain-model.java.ftl` | `XxxModel` | 继承 `AbstractBaseBO`，领域模型 |
| `template/domain/domain-service.java.ftl` | `XxxDomainService` | 接口，含 8 个方法：`queryPureByNo`、`queryPureByNos`、`queryByNo`、`queryByNos`、`queryByPage`、`addXxx`、`updateXxx`、`deleteXxx` |
| `template/domain/domain-service-impl.java.ftl` | `XxxDomainServiceImpl` | 实现类，含 `fillAddition` 附加信息填充方法 |
| `template/domain/domain-add-request.java.ftl` | `XxxAddRequest` | 继承 `CreateInfo` |
| `template/domain/domain-update-request.java.ftl` | `XxxUpdateRequest` | 继承 `UpdateInfo` |
| `template/domain/domain-query-request.java.ftl` | `XxxQueryRequest` | 包含 `condition` + `addition` |
| `template/domain/domain-query-by-no-request.java.ftl` | `XxxQueryByNoRequest` | 单号查询 + `addition` |
| `template/domain/domain-query-by-nos-request.java.ftl` | `XxxQueryByNosRequest` | 多号查询 + `addition` |
| `template/domain/domain-addition-query-request.java.ftl` | `XxxAdditionQueryRequest` | 附加查询参数 |
| `template/domain/domain-model-converter.java.ftl` | `XxxModelConverter` | DO → Model 转换器 |
| `template/domain/domain-add-request-converter.java.ftl` | `XxxAddRequestConverter` | AddRequest → DO 转换器 |
| `template/domain/domain-update-request-converter.java.ftl` | `XxxUpdateRequestConverter` | UpdateRequest → DO 转换器 |

#### Biz 层
| 模板文件 | 生成类 | 说明 |
|----------|--------|------|
| `template/biz/biz-service.java.ftl` | `XxxBizService` | 接口，含 4 个方法：`queryByNo`、`queryByPage`、`addXxx`、`updateXxx`（不含 delete，delete 由 Controller 直接调用 DomainService） |
| `template/biz/biz-service-impl.java.ftl` | `XxxBizServiceImpl` | 实现类 |
| `template/biz/biz-add-request.java.ftl` | `BizXxxAddRequest` | 继承 `CreateInfo` |
| `template/biz/biz-update-request.java.ftl` | `BizXxxUpdateRequest` | 继承 `UpdateInfo` |
| `template/biz/biz-add-request-converter.java.ftl` | `BizXxxAddRequestConverter` | Biz → Domain 转换器 |
| `template/biz/biz-update-request-converter.java.ftl` | `BizXxxUpdateRequestConverter` | Biz → Domain 转换器 |

#### Web 层
| 模板文件 | 生成类 | 说明 |
|----------|--------|------|
| `template/controller/controller.java.ftl` | `XxxController` | REST 控制器，含 CRUD 5 个接口 |
| `template/controller/vo.java.ftl` | `XxxVO` | 视图对象，含 `@ApiModel`、`@ApiModelProperty` |
| `template/controller/add-request.java.ftl` | `WebXxxAddRequest` | Web 层新增请求 |
| `template/controller/update-request.java.ftl` | `WebXxxUpdateRequest` | Web 层更新请求 |
| `template/controller/query-request.java.ftl` | `WebXxxQueryRequest` | Web 层查询请求 |
| `template/controller/vo-converter.java.ftl` | `XxxVOConverter` | Model → VO 转换器 |
| `template/controller/add-request-converter.java.ftl` | `WebXxxAddRequestConverter` | WebRequest → BizRequest 转换器 |
| `template/controller/update-request-converter.java.ftl` | `WebXxxUpdateRequestConverter` | WebRequest → BizRequest 转换器 |
| `template/controller/query-request-converter.java.ftl` | `WebXxxQueryRequestConverter` | WebQuery → ConditionDalRequest 转换器 |

### 层级关键设计说明

**Controller 层调用关系**:
- 查询/新增/更新 → 调用 `BizService`
- 删除 → 直接调用 `DomainService`（BizService 不包含 delete 方法）

**DomainService 层方法体系**:
- `queryPureByNo` / `queryPureByNos`：纯数据查询，不填充附加信息
- `queryByNo` / `queryByNos`：支持 `AdditionQueryRequest` 附加信息填充
- `queryByPage`：分页查询 + 附加信息填充
- `addXxx` / `updateXxx` / `deleteXxx`：写操作，均需 `@Transactional`

**Converter 统一命名规范**:
- 类名统一以 `Converter` 结尾（如 `XxxModelConverter`、`XxxVOConverter`），**禁止使用 `Convert` 结尾**
- 使用 MapStruct 抽象类方式 + `BaseConverter` 接口
- 访问方式：`XxxConverter.INSTANCE.method()`

### XXL-Job 定时任务参考

```java
@Component
@Slf4j
public class XxxJob {

    @Autowired
    private XxxBizService xxxBizService;

    @XxlJob("xxxJobHandler")
    public void execute() {
        try {
            xxxBizService.executeTask();
        } catch (Exception e) {
            log.error("xxxJob执行失败", e);
            throw e;
        }
    }
}
```

## 编码细节规范

- **导入顺序**:
  1. Java 标准库
  2. 第三方库
  3. 项目内部包
  4. 禁止在代码中使用完整包名引入类
- **空行使用**: 类成员之间、方法之间使用空行分隔
- **异常处理**: 使用 `AssertUtils` 进行参数校验，抛出 `BusinessException`
- **日志使用**: 使用 `log.debug()`、`log.info()`、`log.error()` 等，避免使用 `System.out.println()`
- **事务管理**: 写操作方法必须使用 `@Transactional`，回滚策略为 `rollbackFor = Throwable.class`
- **分页处理**:
  - 使用 `PageHelper.startPage(pageNum, pageSize)` 标记分页
  - 查询结果需要转换为 `Page<DO>` 类型
  - 使用 `PageConvertUtils.pageResultConvert(PageInfo, List)` 进行分页结果转换
- **对象转换**: 统一使用 MapStruct（接口 + `INSTANCE`），可选实现 `BaseConverter`
- **集合处理**: 使用 `CollectionUtils.isEmpty()` 判断集合是否为空
- **Builder 模式**: Request 和 VO 对象优先使用 Builder 模式构建


## 规范检查清单

编写代码时必须检查：

- [ ] **包名**: `cn.yzw.jc.pprod.{layer}.{module}`
- [ ] **类名结尾**: Controller / BizService / BizServiceImpl / DomainService / DomainServiceImpl / Model / DO / Request / VO / Converter / Mapper / ManualMapper（转换器统一以 `Converter` 结尾，禁止使用 `Convert`）
- [ ] **注解**: 
  - Controller: `@RestController`, `@RequestMapping`, `@Api`, `@ApiOperation`, `@Slf4j`
  - Service: `@Service`, `@Slf4j`
  - 写操作: `@Transactional(rollbackFor = Throwable.class)`
- [ ] **返回类型**: Controller 必须返回 `YzwResult<T>`
- [ ] **参数校验**: 使用 `@Validated` + `@Valid` + `@NotBlank`/`@NotNull`
- [ ] **对象转换**: 必须使用 MapStruct `INSTANCE.method()`
- [ ] **分页**: 使用 `PageHelper.startPage()` + `PageConvertUtils.pageResultConvert()`
- [ ] **异常**: 使用 `BusinessException.create()`
- [ ] **日志**: 使用 `log.info()` / `log.error()`，禁止 `System.out.println()`

## 常用工具类导入

```java
// 校验
import cn.yzw.infra.component.utils.AssertUtils;
import cn.yzw.infra.component.base.exception.BusinessException;

// 转换
import cn.yzw.jc.pprod.common.dal.mysql.pprod.PageConvertUtils;
import org.apache.commons.collections4.CollectionUtils;

// 分页
import com.github.pagehelper.PageHelper;
import com.github.pagehelper.PageInfo;
import cn.yzw.infra.component.base.model.page.PageRequest;
import cn.yzw.infra.component.base.model.page.PageResult;

// 结果
import cn.yzw.infra.component.base.model.YzwResult;

// 用户上下文
import cn.yzw.jc.pprod.core.service.integration.common.UnifiedUserContextHolder;
```

## 重要约束

1. **Java 版本**: 必须使用 Java 8
2. **对象转换**: 必须使用 MapStruct Converter，禁止手动 getter/setter
3. **分页**: 必须使用 PageHelper 和 PageConvertUtils
4. **异常**: 必须使用 BusinessException
5. **事务**: 写操作必须加 `@Transactional(rollbackFor = Throwable.class)`

## 测试策略

- 单元测试：使用 JUnit，测试类命名以 `Test` 结尾
- 集成测试：在 `pprod-test` 模块中编写
- 测试覆盖率：关键业务逻辑要求覆盖

## Git 工作流

- 分支策略：主分支 `main/master`，功能分支 `feature/xxx`，修复分支 `fix/xxx`
- 提交约定：使用清晰的提交信息，描述变更内容
- 代码审查：所有代码变更需要通过代码审查

## 外部依赖

- **基础设施框架**: `cn.yzw.infra.component.base` - 提供基础组件（YzwResult、PageRequest、PageResult 等）
- **认证授权**: `cn.yzw.iec.auac.sso.sdk` - 提供 SSO 认证和权限控制
- **ID 生成服务**: 通过 `IdGeneratorFacadeClient` 调用外部 ID 生成服务
- **Dubbo 服务**: 通过 Dubbo 暴露与调用微服务
- **OpenFeign**: 通过 `@FeignClient` 调用第三方 HTTP 服务
- **配置中心**: Apollo
- **任务调度**: XXL-Job / yzw-component-job
