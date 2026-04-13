<#--
  ============================================================================
  VO 响应模板
  版本: v1.1.0 | 层级: Web 层 | 维护人: pprod-team
  说明: 生成视图对象，用于前端响应
  依赖: Swagger 注解
  ============================================================================
-->
package ${packageName}.web.home${moduleName}.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.io.Serializable;
import io.swagger.annotations.ApiModel;
import io.swagger.annotations.ApiModelProperty;
<#if hasLocalDateTimeField>
import java.time.LocalDateTime;
import com.fasterxml.jackson.annotation.JsonFormat;
</#if>
<#if hasLocalDateField>
import java.time.LocalDate;
</#if>
<#if hasBigDecimalField>
import java.math.BigDecimal;
</#if>

/**
 * ${tableComment} VO
 *
 * @author ${author}
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@ApiModel("${tableComment}响应模型")
public class ${javaBeanName}VO implements Serializable {

    private static final long serialVersionUID = 1L;

<#list columns as column>
    <#if column.javaFieldName != "id" && column.javaFieldName != "createUserId" && column.javaFieldName != "updateUserId" && column.javaFieldName != "deleteFlag">
    /**
     * ${column.comment!""}
    <#if column.enumInfo??>
     * <p>
     * @see ${packageName}.common.service.facade${moduleName}.enums.${column.javaFieldNameUF}Enum
    </#if>
     */
    @ApiModelProperty("${column.comment!""}")
    <#if column.javaFieldName == "createTime" || column.javaFieldName == "updateTime">
    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    </#if>
    private ${column.javaTypeBox} ${column.javaFieldName};
    </#if>
</#list>
}
