<#--
  ============================================================================
  ManualMapper 接口模板
  版本: v1.1.0 | 层级: Common 层 (DAL) | 维护人: pprod-team
  说明: 生成自定义查询 Mapper 接口
  依赖: DO 对象, ConditionDalRequest
  ============================================================================
-->
package ${packageName}.common.dal${moduleName}.mapper.manual;

import org.springframework.stereotype.Repository;
import ${packageName}.common.dal${moduleName}.request.${javaBeanName}ConditionDalRequest;
import ${packageName}.common.dal${moduleName}.model.${javaBeanName}DO;
import java.util.List;

/**
 * ${tableComment} ManualMapper
 *
 * @author ${author}
 */
@Repository
public interface ${javaBeanName}ManualMapper {

    /**
     * 自定义接口一：根据条件查询多条记录，有limit默认limit 100，通过id asc排序
     * @param request 筛选条件
     * @return DO对象列表
     */
    List<${javaBeanName}DO> queryByStartId(${javaBeanName}ConditionDalRequest request);

    /**
     * 自定义接口二：根据条件深度分页查询，无limit
     * @param request 筛选条件
     * @return DO对象列表
     */
    List<${javaBeanName}DO> queryByCondition(${javaBeanName}ConditionDalRequest request);
}
