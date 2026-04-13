<#--
  ============================================================================
  Domain层查询请求模板
  版本: v1.1.0 | 层级: Core 层 | 维护人: pprod-team
  说明: 生成 Domain 层查询请求对象
  依赖: ConditionDalRequest, AdditionQueryRequest
  ============================================================================
-->
package ${packageName}.core.service${moduleName}.request;

import ${packageName}.common.dal${moduleName}.request.${javaBeanName}ConditionDalRequest;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * ${tableComment}搜索请求
 *
 * @author ${author}
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class ${javaBeanName}QueryRequest {

    /**
     * 查询筛选条件
     */
    private ${javaBeanName}ConditionDalRequest condition;

    /**
     * 附加可选返回信息
     */
    private ${javaBeanName}AdditionQueryRequest addition;
}
