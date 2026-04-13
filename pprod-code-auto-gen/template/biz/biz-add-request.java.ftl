<#--
  ============================================================================
  Biz层新增请求模板
  版本: v1.1.0 | 层级: Biz 层 | 维护人: pprod-team
  说明: 生成 Biz 层新增请求对象
  依赖: CreateInfo, Lombok
  ============================================================================
-->
package ${packageName}.biz.shared${moduleName}.request;

<#list columns as column>
    <#if column.enumInfo??>
import ${packageName}.common.service.facade${moduleName}.enums.${column.javaFieldNameUF}Enum;
    </#if>
</#list>
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import ${packageName}.common.service.facade.base.CreateInfo;
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
public class Biz${javaBeanName}AddRequest extends CreateInfo {

<#list columns as column>
    <#if column.javaFieldName != "id" && column.javaFieldName != "createUserId" && column.javaFieldName != "createName" && column.javaFieldName != "createTime" && column.javaFieldName != "updateUserId" && column.javaFieldName != "updateName" && column.javaFieldName != "updateTime" && column.javaFieldName != "deleteFlag" && column.javaFieldName != "${bizPkNo}">
    /**
     * ${column.comment!""}
     */
    <#if column.enumInfo??>
    private ${column.javaFieldNameUF}Enum ${column.javaFieldName};
    <#else>
    private ${column.javaTypeBox} ${column.javaFieldName};
    </#if>
    </#if>
</#list>
}
