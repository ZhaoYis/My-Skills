<#--
  ============================================================================
  Domain Model 模板
  版本: v1.1.0 | 层级: Core 层 | 维护人: pprod-team
  说明: 生成领域模型对象
  依赖: AbstractBaseBO
  ============================================================================
-->
package ${packageName}.core.model${moduleName};

<#list columns as column>
    <#if column.enumInfo?? && column.javaFieldName != "deleteFlag">
import ${packageName}.common.service.facade${moduleName}.enums.${column.javaFieldNameUF}Enum;
    </#if>
</#list>
<#if hasDateField>
import java.util.Date;
</#if>
<#if hasLocalDateField>
import java.time.LocalDate;
</#if>
<#if hasLocalDateTimeField>
import java.time.LocalDateTime;
</#if>
<#if hasBigDecimalField>
import java.math.BigDecimal;
</#if>
import cn.yzw.infra.component.base.model.extension.AbstractBaseBO;
import lombok.Data;

/**
 * ${tableComment} Model
 *
 * @author ${author}
 */
@Data
public class ${javaBeanName}Model extends AbstractBaseBO {

<#list columns as column>
    <#if column.javaFieldName != "id" && column.javaFieldName != "createUserId" && column.javaFieldName != "createName" && column.javaFieldName != "createTime" && column.javaFieldName != "updateUserId" && column.javaFieldName != "updateName" && column.javaFieldName != "updateTime" && column.javaFieldName != "deleteFlag">
    <#if column.comment?? && column.comment != "">
    /**
     * ${column.comment}
     */
    </#if>
    <#if column.enumInfo??>
    private ${column.javaFieldNameUF}Enum ${column.javaFieldName};
    <#else>
    private ${column.javaTypeBox} ${column.javaFieldName};
    </#if>
    </#if>
</#list>
}
