<#--
  ============================================================================
  Domain层单号查询请求模板
  版本: v1.1.0 | 层级: Core 层 | 维护人: pprod-team
  说明: 生成 Domain 层根据业务主键查询的请求对象
  依赖: AdditionQueryRequest
  ============================================================================
-->
package ${packageName}.core.service${moduleName}.request;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 根据${bizPkColumnComment}查询${tableComment}请求
 *
 * @author ${author}
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class ${javaBeanName}QueryByNoRequest {

    /**
     * ${bizPkColumnComment}
     */
    private ${bizPkType} ${bizPkNo};

    /**
     * 附加信息
     */
    private ${javaBeanName}AdditionQueryRequest addition;
}
