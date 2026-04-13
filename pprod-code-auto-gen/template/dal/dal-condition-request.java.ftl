<#--
  ============================================================================
  DAL 条件查询请求模板
  版本: v1.1.0 | 层级: Common 层 (DAL) | 维护人: pprod-team
  说明: 生成条件查询请求对象
  依赖: BaseQueryByStartIdDO
  ============================================================================
-->
package ${packageName}.common.dal${moduleName}.request;

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
import cn.yzw.jc.pprod.common.util.lang.BaseQueryByStartIdDO;
import lombok.Data;
import lombok.experimental.SuperBuilder;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.EqualsAndHashCode;

/**
 * ${tableComment} 条件查询请求
 *
 * @author ${author}
 */
@Data
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(callSuper = false)
public class ${javaBeanName}ConditionDalRequest extends BaseQueryByStartIdDO {

<#list columns as column>
    <#if column.javaFieldName == "createTime">
    /**
     * 创建开始时间
     */
    private ${column.javaTypeBox} createStartTime;

    /**
     * 创建结束时间
     */
    private ${column.javaTypeBox} createEndTime;
    <#elseif column.javaFieldName == "updateTime">
    /**
     * 更新开始时间
     */
    private ${column.javaTypeBox} updateStartTime;

    /**
     * 更新结束时间
     */
    private ${column.javaTypeBox} updateEndTime;
    <#elseif column.javaFieldName != "id" && column.javaFieldName != "createUserId" && column.javaFieldName != "createName" && column.javaFieldName != "updateUserId" && column.javaFieldName != "updateName" && column.javaFieldName != "deleteFlag">
    <#if column.comment?? && column.comment != "">
    /**
     * ${column.comment}
     */
    </#if>
    private ${column.javaTypeBox} ${column.javaFieldName};
    </#if>
</#list>

}
