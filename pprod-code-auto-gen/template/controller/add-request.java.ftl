<#--
  ============================================================================
  新增请求模板
  版本: v1.1.0 | 层级: Web 层 | 维护人: pprod-team
  说明: 生成新增请求对象
  依赖: Swagger 注解, Lombok
  ============================================================================
-->
package ${packageName}.web.home${moduleName}.request;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import io.swagger.annotations.ApiModel;
import io.swagger.annotations.ApiModelProperty;
import java.io.Serializable;
<#if hasLocalDateTimeField>
import java.time.LocalDateTime;
</#if>
<#if hasLocalDateField>
import java.time.LocalDate;
</#if>
<#if hasBigDecimalField>
import java.math.BigDecimal;
</#if>

/**
 * 新增${tableComment}请求
 *
 * @author ${author}
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@ApiModel("新增${tableComment}请求模型")
public class Web${javaBeanName}AddRequest implements Serializable {

    private static final long serialVersionUID = 1L;

<#list columns as column>
    <#if column.javaFieldName != "id" && column.javaFieldName != "createUserId" && column.javaFieldName != "createName" && column.javaFieldName != "createTime" && column.javaFieldName != "updateUserId" && column.javaFieldName != "updateName" && column.javaFieldName != "updateTime" && column.javaFieldName != "deleteFlag" && column.javaFieldName != "${bizPkNo}">
    /**
     * ${column.comment!""}
    <#if column.enumInfo??>
     * <p>
     * @see ${packageName}.common.service.facade${moduleName}.enums.${column.javaFieldNameUF}Enum
    </#if>
     */
    @ApiModelProperty("${column.comment!""}")
    private ${column.javaTypeBox} ${column.javaFieldName};
    </#if>
</#list>
}
