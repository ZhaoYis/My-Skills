<#--
  ============================================================================
  Domain层附加查询请求模板
  版本: v1.1.0 | 层级: Core 层 | 维护人: pprod-team
  说明: 生成附加信息查询请求对象，用于控制是否返回关联数据
  依赖: Lombok
  ============================================================================
-->
package ${packageName}.core.service${moduleName}.request;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * ${tableComment} 附加信息查询请求
 *
 * @author ${author}
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class ${javaBeanName}AdditionQueryRequest {

    /**
     * 示例: 是否包含详情信息
     */
    private Boolean includeDetail;
}
