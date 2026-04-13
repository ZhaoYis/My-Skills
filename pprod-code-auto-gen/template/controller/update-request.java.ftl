<#--
  ============================================================================
  更新请求模板
  版本: v1.1.0 | 层级: Web 层 | 维护人: pprod-team
  说明: 生成更新请求对象
  依赖: Swagger 注解, Lombok, Validation
  ============================================================================
-->
package ${packageName}.web.home${moduleName}.request;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import io.swagger.annotations.ApiModel;
import io.swagger.annotations.ApiModelProperty;
import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;
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
 * 更新${tableComment}请求
 *
 * @author ${author}
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@ApiModel("更新${tableComment}请求模型")
public class Web${javaBeanName}UpdateRequest implements Serializable {

    private static final long serialVersionUID = 1L;

<#list columns as column>
    <#if column.javaFieldName != "id" && column.javaFieldName != "createUserId" && column.javaFieldName != "createName" && column.javaFieldName != "createTime" && column.javaFieldName != "updateUserId" && column.javaFieldName != "updateName" && column.javaFieldName != "updateTime" && column.javaFieldName != "deleteFlag">
    /**
     * ${column.comment!""}
    <#if column.enumInfo??>
     * <p>
     * @see ${packageName}.common.service.facade${moduleName}.enums.${column.javaFieldNameUF}Enum
    </#if>
     */
    @ApiModelProperty("${column.comment!""}")
    <#if column.javaFieldName == "${bizPkNo}">
    <#if bizPkType == "String">
    @NotBlank(message = "${bizPkColumnComment}不能为空")
    <#else>
    @NotNull(message = "${bizPkColumnComment}不能为空")
    </#if>
    </#if>
    private ${column.javaTypeBox} ${column.javaFieldName};
    </#if>
</#list>
}
