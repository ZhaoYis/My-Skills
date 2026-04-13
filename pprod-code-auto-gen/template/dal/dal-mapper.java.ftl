<#--
  ============================================================================
  Mapper 接口模板
  版本: v1.1.0 | 层级: Common 层 (DAL) | 维护人: pprod-team
  说明: 生成 MyBatis Mapper 接口
  依赖: DO 对象
  ============================================================================
-->
package ${packageName}.common.dal${moduleName}.mapper;

import java.util.List;
import ${packageName}.common.dal${moduleName}.model.${javaBeanName}DO;
import org.apache.ibatis.annotations.Param;
import org.springframework.stereotype.Repository;

/**
 * ${tableComment} Mapper
 *
 * @author ${author}
 */
@Repository
public interface ${javaBeanName}Mapper {

    /**
     * 通用接口一：单条新增
     * @param ${javaBeanNameLF}DO DO对象
     * @return count
     */
    int insert(${javaBeanName}DO ${javaBeanNameLF}DO);

    /**
     * 通用接口二：批量新增
     * @param ${javaBeanNameLF}DOList DO对象列表
     * @return count
     */
    int insertBatch(@Param("list") List<${javaBeanName}DO> ${javaBeanNameLF}DOList);

    /**
     * 通用接口三：根据ID修改非空信息
     * @param ${javaBeanNameLF}DO DO对象
     * @return count
     */
    int updateById(${javaBeanName}DO ${javaBeanNameLF}DO);

    /**
     * 通用接口四：根据ID批量修改非空信息
     * @param ${javaBeanNameLF}DOList DO对象列表
     * @return count
     */
    int updateBatchById(@Param("list") List<${javaBeanName}DO> ${javaBeanNameLF}DOList);

    /**
     * 通用接口五：根据ID查询单条记录
     * @param ${bizPkNo} 业务主键
     * @return DO对象
     */
    ${javaBeanName}DO selectOneById(${bizPkType} ${bizPkNo});

    /**
     * 通用接口六：根据条件查询单条记录
     * @param ${javaBeanNameLF}DO DO对象
     * @return DO对象
     */
    ${javaBeanName}DO selectOne(${javaBeanName}DO ${javaBeanNameLF}DO);

    /**
     * 通用接口七：通过ID列表查询多条记录
     * @param ${bizPkNo}s 业务id列表
     * @return DO对象列表
     */
    List<${javaBeanName}DO> selectListInId(@Param("list") List<${bizPkType}> ${bizPkNo}s);

    /**
     * 通用接口八：逻辑删除
     * @param ${bizPkNo} 业务主键
     * @return count
     */
    int deleteById(${bizPkType} ${bizPkNo});
}
