<#--
  ============================================================================
  BizService 接口模板
  版本: v1.1.0 | 层级: Biz 层 | 维护人: pprod-team
  说明: 生成 BizService 接口定义
  依赖: DomainService, Request 对象, Model
  ============================================================================
-->
package ${packageName}.biz.shared${moduleName};

import ${packageName}.core.model${moduleName}.${javaBeanName}Model;
import ${packageName}.core.service${moduleName}.request.${javaBeanName}QueryRequest;
import ${packageName}.biz.shared${moduleName}.request.Biz${javaBeanName}UpdateRequest;
import ${packageName}.core.service${moduleName}.request.${javaBeanName}QueryByNoRequest;
import ${packageName}.biz.shared${moduleName}.request.Biz${javaBeanName}AddRequest;
import cn.yzw.infra.component.base.model.page.PageRequest;
import cn.yzw.infra.component.base.model.page.PageResult;

/**
 * ${tableComment} BizService
 *
 * @author ${author}
 */
public interface ${javaBeanName}BizService {

    /**
     * 根据${bizPkColumnComment}查询${tableComment}信息, 支持可选附加参数查询
     * @param request 查询条件，${bizPkColumnComment}必传
     * @return ${tableComment}
     */
    ${javaBeanName}Model queryByNo(${javaBeanName}QueryByNoRequest request);

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
    ${bizPkType} add${javaBeanName}(Biz${javaBeanName}AddRequest request);

    /**
     * 更新${tableComment}
     * @param request 更新${tableComment}参数
     */
    void update${javaBeanName}(Biz${javaBeanName}UpdateRequest request);
}
