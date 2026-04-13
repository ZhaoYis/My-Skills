<#--
  ============================================================================
  DO 对象模板
  版本: v1.1.0 | 层级: Common 层 (DAL) | 维护人: pprod-team
  说明: 生成数据访问对象，对应数据库表
  依赖: AbstractBaseDO, TableName 注解
  ============================================================================
-->
package ${packageName}.common.dal${moduleName}.model;

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
import cn.yzw.infra.component.base.model.extension.AbstractBaseDO;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.ToString;

/**
 * ${tableComment} DO
 *
 * @author ${author}
 */
@Data
@ToString(callSuper = true)
@EqualsAndHashCode(callSuper = true)
@TableName("${tableName}")
public class ${javaBeanName}DO extends AbstractBaseDO {

<#list columns as column>
    <#if column.javaFieldName != "id" && column.javaFieldName != "createUserId" && column.javaFieldName != "createName" && column.javaFieldName != "createTime" && column.javaFieldName != "updateUserId" && column.javaFieldName != "updateName" && column.javaFieldName != "updateTime" && column.javaFieldName != "deleteFlag">
    <#if column.comment?? && column.comment != "">
    /**
     * ${column.comment}
     */
    </#if>
    private ${column.javaTypeBox} ${column.javaFieldName};
    </#if>
</#list>

}
