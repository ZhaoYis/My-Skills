<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE mapper PUBLIC "-//mybatis.org//DTD Mapper 3.0//EN" "http://mybatis.org/dtd/mybatis-3-mapper.dtd">
<#--
  ============================================================================
  ManualMapper XML 模板
  版本: v1.1.0 | 层级: Common 层 (DAL) | 维护人: pprod-team
  说明: 生成自定义查询 SQL 配置
  依赖: ManualMapper 接口
  ============================================================================
-->
<mapper namespace="${packageName}.common.dal${moduleName}.mapper.manual.${javaBeanName}ManualMapper">

    <!-- 自定义接口一：根据条件查询多条记录 -->
    <select id="queryByStartId" parameterType="${packageName}.common.dal${moduleName}.request.${javaBeanName}ConditionDalRequest" resultMap="${packageName}.common.dal${moduleName}.mapper.${javaBeanName}Mapper.BaseResultMap">
        SELECT
        <include refid="${packageName}.common.dal${moduleName}.mapper.${javaBeanName}Mapper.Base_Column_List" />
        FROM ${tableName}
        WHERE delete_flag=0
<#list columns as column>
    <#if column.columnName == "id">
        <if test="${column.javaFieldName} != null">
            AND ${column.columnName}=<#noparse>#{</#noparse>${column.javaFieldName}, jdbcType=${column.upperType}<#noparse>}</#noparse>
        </if>
        <if test="startId > 0">
            AND id&gt;<#noparse>#{startId, jdbcType=${column.upperType}}</#noparse>
        </if>
        <if test="endId != null">
            AND id &lt; <#noparse>#{endId, jdbcType=${column.upperType}}</#noparse>
        </if>
    <#elseif column.columnName == "create_time">
        <if test="createStartTime != null">
            AND create_time &gt;= <#noparse>#{createStartTime, jdbcType=${column.upperType}}</#noparse>
        </if>
        <if test="createEndTime != null">
            AND create_time &lt;= <#noparse>#{createEndTime, jdbcType=${column.upperType}}</#noparse>
        </if>
    <#elseif column.columnName == "update_time">
        <if test="updateStartTime != null">
            AND update_time &gt;= <#noparse>#{updateStartTime, jdbcType=${column.upperType}}</#noparse>
        </if>
        <if test="updateEndTime != null">
            AND update_time &lt;= <#noparse>#{updateEndTime, jdbcType=${column.upperType}}</#noparse>
        </if>
    <#elseif column.columnName != "delete_flag" && column.columnName != "create_user_id" && column.columnName != "create_name" && column.columnName != "update_user_id" && column.columnName != "update_name">
        <if test="${column.javaFieldName} != null">
            AND ${column.columnName}=<#noparse>#{</#noparse>${column.javaFieldName}, jdbcType=${column.upperType}<#noparse>}</#noparse>
        </if>
    </#if>
</#list>
        order by ${sortSql}
        limit <#noparse>#{pageSize}</#noparse>
    </select>

    <!-- 自定义接口二：根据条件查询多条记录，无limit -->
    <select id="queryByCondition" parameterType="${packageName}.common.dal${moduleName}.request.${javaBeanName}ConditionDalRequest" resultMap="${packageName}.common.dal${moduleName}.mapper.${javaBeanName}Mapper.BaseResultMap">
        SELECT
        <include refid="${packageName}.common.dal${moduleName}.mapper.${javaBeanName}Mapper.Base_Column_List" />
        FROM ${tableName}
        WHERE delete_flag=0
<#list columns as column>
    <#if column.columnName == "id">
        <if test="${column.javaFieldName} != null">
            AND ${column.columnName}=<#noparse>#{</#noparse>${column.javaFieldName}, jdbcType=${column.upperType}<#noparse>}</#noparse>
        </if>
        <if test="startId > 0">
            AND id&gt;<#noparse>#{startId, jdbcType=${column.upperType}}</#noparse>
        </if>
        <if test="endId != null">
            AND id &lt; <#noparse>#{endId, jdbcType=${column.upperType}}</#noparse>
        </if>
    <#elseif column.columnName == "create_time">
        <if test="createStartTime != null">
            AND create_time &gt;= <#noparse>#{createStartTime, jdbcType=${column.upperType}}</#noparse>
        </if>
        <if test="createEndTime != null">
            AND create_time &lt;= <#noparse>#{createEndTime, jdbcType=${column.upperType}}</#noparse>
        </if>
    <#elseif column.columnName == "update_time">
        <if test="updateStartTime != null">
            AND update_time &gt;= <#noparse>#{updateStartTime, jdbcType=${column.upperType}}</#noparse>
        </if>
        <if test="updateEndTime != null">
            AND update_time &lt;= <#noparse>#{updateEndTime, jdbcType=${column.upperType}}</#noparse>
        </if>
    <#elseif column.columnName != "delete_flag" && column.columnName != "create_user_id" && column.columnName != "create_name" && column.columnName != "update_user_id" && column.columnName != "update_name">
        <if test="${column.javaFieldName} != null">
            AND ${column.columnName}=<#noparse>#{</#noparse>${column.javaFieldName}, jdbcType=${column.upperType}<#noparse>}</#noparse>
        </if>
    </#if>
</#list>
    </select>

</mapper>
