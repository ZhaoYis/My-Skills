<#--
  ============================================================================
  Domain层多号查询请求模板
  版本: v1.1.0 | 层级: Core 层 | 维护人: pprod-team
  说明: 生成 Domain 层根据多个业务主键查询的请求对象
  依赖: AdditionQueryRequest
  ============================================================================
-->
package ${packageName}.core.service${moduleName}.request;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.util.List;

/**
 * 多个${tableComment}查询请求
 *
 * @author ${author}
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class ${javaBeanName}QueryByNosRequest {

    /**
     * ${bizPkColumnComment}列表
     */
    private List<${bizPkType}> ${bizPkNo}s;

    /**
     * 附加信息
     */
    private ${javaBeanName}AdditionQueryRequest addition;
}
