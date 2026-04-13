<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE mapper PUBLIC "-//mybatis.org//DTD Mapper 3.0//EN" "http://mybatis.org/dtd/mybatis-3-mapper.dtd">
<#--
  ============================================================================
  Mapper XML 模板
  版本: v1.1.0 | 层级: Common 层 (DAL) | 维护人: pprod-team
  说明: 生成 MyBatis Mapper XML 配置
  依赖: Mapper 接口
  ============================================================================
-->
<mapper namespace="${packageName}.common.dal${moduleName}.mapper.${javaBeanName}Mapper">

    <resultMap id="BaseResultMap" type="${packageName}.common.dal${moduleName}.model.${javaBeanName}DO">
<#list columns as column>
        <result column="${column.columnName}" jdbcType="${column.upperType}" property="${column.javaFieldName}" javaType="${column.javaAllTypeBox}" />
</#list>
    </resultMap>

    <sql id="Base_Column_List">
<#list columns as column>${column.columnName}<#if column?has_next>,</#if></#list>
    </sql>

    <!-- 通用接口一：单条新增 -->
    <insert id="insert" parameterType="${packageName}.common.dal${moduleName}.model.${javaBeanName}DO">
        INSERT INTO ${tableName}(
<#list columns as column>
    <#if column.columnName != "id" && column.columnName != "create_time" && column.columnName != "update_time" && column.columnName != "delete_flag">
            ${column.columnName},
    </#if>
</#list>
            delete_flag)
        VALUES(
<#list columns as column>
    <#if column.columnName != "id" && column.columnName != "create_time" && column.columnName != "update_time" && column.columnName != "delete_flag">
            <#noparse>#{</#noparse>${column.javaFieldName}, jdbcType=${column.upperType}<#noparse>},</#noparse>
    </#if>
</#list>
            0)
    </insert>

    <!-- 通用接口二：批量新增 -->
    <insert id="insertBatch" parameterType="java.util.List">
        INSERT INTO ${tableName}(
<#list columns as column>
    <#if column.columnName != "id" && column.columnName != "create_time" && column.columnName != "update_time" && column.columnName != "delete_flag">
            ${column.columnName},
    </#if>
</#list>
            delete_flag)
        VALUES
        <foreach collection="list" item="data" separator=",">
            (
<#list columns as column>
    <#if column.columnName != "id" && column.columnName != "create_time" && column.columnName != "update_time" && column.columnName != "delete_flag">
                <#noparse>#{data.</#noparse>${column.javaFieldName}, jdbcType=${column.upperType}<#noparse>},</#noparse>
    </#if>
</#list>
                0)
        </foreach>
    </insert>

    <!-- 通用接口三：根据ID修改记录 -->
    <update id="updateById" parameterType="${packageName}.common.dal${moduleName}.model.${javaBeanName}DO">
        UPDATE ${tableName}
        <set>
<#list columns as column>
    <#if column.columnName != "id" && column.columnName != "update_time">
            <if test="${column.javaFieldName} != null">
                ${column.columnName} = <#noparse>#{</#noparse>${column.javaFieldName}, jdbcType=${column.upperType}<#noparse>},</#noparse>
            </if>
    </#if>
</#list>
        </set>
        WHERE ${bizPkColumnName}=<#noparse>#{</#noparse>${bizPkNo}, jdbcType=${bizPkJdbcType}<#noparse>}</#noparse> AND delete_flag=0
    </update>

    <!-- 通用接口四：根据ID批量更新 -->
    <update id="updateBatchById" parameterType="java.util.List">
        <foreach collection="list" separator=";" item="m">
            UPDATE ${tableName}
            <set>
<#list columns as column>
    <#if column.columnName != "id" && column.columnName != "${bizPkColumnName}" && column.columnName != "create_user_id" && column.columnName != "create_name" && column.columnName != "create_time" && column.columnName != "update_time" && column.columnName != "delete_flag">
                <if test="m.${column.javaFieldName} != null">
                    ${column.columnName} = <#noparse>#{m.</#noparse>${column.javaFieldName}, jdbcType=${column.upperType}<#noparse>},</#noparse>
                </if>
    </#if>
</#list>
            </set>
            WHERE ${bizPkColumnName}=<#noparse>#{m.</#noparse>${bizPkNo}, jdbcType=${bizPkJdbcType}<#noparse>}</#noparse> AND delete_flag=0
        </foreach>
    </update>

    <!-- 通用接口五：通过ID查询单条记录 -->
    <select id="selectOneById" parameterType="${bizPkType}" resultMap="BaseResultMap">
        SELECT
        <include refid="Base_Column_List" />
        FROM ${tableName}
        WHERE ${bizPkColumnName}=<#noparse>#{</#noparse>${bizPkNo}, jdbcType=${bizPkJdbcType}<#noparse>}</#noparse> AND delete_flag=0
    </select>

    <!-- 通用接口六：根据条件查询单条记录 -->
    <select id="selectOne" parameterType="${packageName}.common.dal${moduleName}.model.${javaBeanName}DO" resultMap="BaseResultMap">
        SELECT
        <include refid="Base_Column_List" />
        FROM ${tableName}
        WHERE delete_flag=0
<#list columns as column>
    <#if column.columnName != "delete_flag">
        <if test="${column.javaFieldName} != null">
            AND ${column.columnName}=<#noparse>#{</#noparse>${column.javaFieldName}, jdbcType=${column.upperType}<#noparse>}</#noparse>
        </if>
    </#if>
</#list>
        LIMIT 0,1
    </select>

    <!-- 通用接口七：通过ID列表查询多条记录 -->
    <select id="selectListInId" parameterType="${bizPkType}" resultMap="BaseResultMap">
        SELECT
        <include refid="Base_Column_List" />
        FROM ${tableName}
        WHERE ${bizPkColumnName} IN
        <foreach collection="list" item="id" index="index" open="(" close=")" separator=",">
            <#noparse>#{id}</#noparse>
        </foreach>
        AND delete_flag=0
    </select>

    <!-- 通用接口八：逻辑删除 -->
    <update id="deleteById" parameterType="${bizPkType}">
        UPDATE ${tableName}
        SET delete_flag = 1
        WHERE ${bizPkColumnName}=<#noparse>#{</#noparse>${bizPkNo}, jdbcType=${bizPkJdbcType}<#noparse>}</#noparse> AND delete_flag=0
    </update>

</mapper>
