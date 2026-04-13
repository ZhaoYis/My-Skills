<#--
  ============================================================================
  DomainService 接口模板
  版本: v1.1.0 | 层级: Core 层 | 维护人: pprod-team
  说明: 生成 DomainService 接口定义，包含领域业务逻辑
  依赖: Model, Request 对象, Mapper
  ============================================================================
-->
package ${packageName}.core.service${moduleName};

import ${packageName}.core.model${moduleName}.${javaBeanName}Model;
import ${packageName}.core.service${moduleName}.request.${javaBeanName}QueryRequest;
import ${packageName}.core.service${moduleName}.request.${javaBeanName}QueryByNoRequest;
import ${packageName}.core.service${moduleName}.request.${javaBeanName}QueryByNosRequest;
import ${packageName}.core.service${moduleName}.request.${javaBeanName}AddRequest;
import ${packageName}.core.service${moduleName}.request.${javaBeanName}UpdateRequest;
import cn.yzw.infra.component.base.model.page.PageRequest;
import cn.yzw.infra.component.base.model.page.PageResult;
import java.util.List;

/**
 * ${tableComment} DomainService
 *
 * @author ${author}
 */
public interface ${javaBeanName}DomainService {

    /**
     * 根据${bizPkColumnComment}查询基本信息，只包含主数据
     * @param ${bizPkNo} ${bizPkColumnComment}
     * @return ${tableComment}主信息
     */
    ${javaBeanName}Model queryPureByNo(${bizPkType} ${bizPkNo});

    /**
     * 根据多个${bizPkColumnComment}查询基本信息，只包含主数据
     * @param ${bizPkNo}s ${bizPkColumnComment}列表
     * @return ${tableComment}主信息列表
     */
    List<${javaBeanName}Model> queryPureByNos(List<${bizPkType}> ${bizPkNo}s);

    /**
     * 根据${bizPkColumnComment}查询${tableComment}信息, 支持可选附加参数查询
     * @param request 查询条件，${bizPkColumnComment}必传
     * @return ${tableComment}
     */
    ${javaBeanName}Model queryByNo(${javaBeanName}QueryByNoRequest request);

    /**
     * 根据多个${bizPkColumnComment}查询${tableComment}信息, 支持可选附加参数查询
     * @param request 查询条件，${bizPkColumnComment}s必传
     * @return ${tableComment}列表
     */
    List<${javaBeanName}Model> queryByNos(${javaBeanName}QueryByNosRequest request);

    /**
     * 分页查询${tableComment}信息, 支持可选附加参数查询
     * @param request 查询条件
     * @return ${tableComment}列表
     */
    PageResult<${javaBeanName}Model> queryByPage(PageRequest<${javaBeanName}QueryRequest> request);

    /**
     * 新增${tableComment}
     * @param request 新增${tableComment}参数
     * @return ${bizPkNo}
     */
    ${bizPkType} add${javaBeanName}(${javaBeanName}AddRequest request);

    /**
     * 更新${tableComment}
     * @param request 更新${tableComment}参数
     */
    void update${javaBeanName}(${javaBeanName}UpdateRequest request);

    /**
     * 删除${tableComment}（逻辑删除）
     * @param ${bizPkNo} ${bizPkColumnComment}
     * @return 是否成功
     */
    boolean delete${javaBeanName}(${bizPkType} ${bizPkNo});
}
