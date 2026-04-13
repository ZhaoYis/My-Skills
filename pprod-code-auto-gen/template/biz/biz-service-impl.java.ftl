<#--
  ============================================================================
  BizService 实现模板
  版本: v1.1.0 | 层级: Biz 层 | 维护人: pprod-team
  说明: 生成 BizService 实现类
  依赖: DomainService, Converter
  ============================================================================
-->
package ${packageName}.biz.shared${moduleName}.impl;

import ${packageName}.biz.shared${moduleName}.${javaBeanName}BizService;
import ${packageName}.core.service${moduleName}.${javaBeanName}DomainService;
import ${packageName}.core.model${moduleName}.${javaBeanName}Model;
import ${packageName}.core.service${moduleName}.request.${javaBeanName}QueryRequest;
import ${packageName}.core.service${moduleName}.request.${javaBeanName}QueryByNoRequest;
import ${packageName}.biz.shared${moduleName}.request.Biz${javaBeanName}AddRequest;
import ${packageName}.biz.shared${moduleName}.request.Biz${javaBeanName}UpdateRequest;
import ${packageName}.biz.shared${moduleName}.convert.Biz${javaBeanName}AddRequestConverter;
import ${packageName}.biz.shared${moduleName}.convert.Biz${javaBeanName}UpdateRequestConverter;
import ${packageName}.core.service${moduleName}.request.${javaBeanName}AddRequest;
import ${packageName}.core.service${moduleName}.request.${javaBeanName}UpdateRequest;
import cn.yzw.infra.component.base.model.page.PageRequest;
import cn.yzw.infra.component.base.model.page.PageResult;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

/**
 * ${tableComment} BizServiceImpl
 *
 * @author ${author}
 */
@Slf4j
@Service
public class ${javaBeanName}BizServiceImpl implements ${javaBeanName}BizService {

    @Autowired
    private ${javaBeanName}DomainService ${javaBeanNameLF}DomainService;

    @Override
    public ${javaBeanName}Model queryByNo(${javaBeanName}QueryByNoRequest request) {
        return ${javaBeanNameLF}DomainService.queryByNo(request);
    }

    @Override
    public PageResult<${javaBeanName}Model> queryByPage(PageRequest<${javaBeanName}QueryRequest> request) {
        return ${javaBeanNameLF}DomainService.queryByPage(request);
    }

    @Override
    public ${bizPkType} add${javaBeanName}(Biz${javaBeanName}AddRequest request) {
        ${javaBeanName}AddRequest addRequest = Biz${javaBeanName}AddRequestConverter.INSTANCE.convertReverse(request);
        return ${javaBeanNameLF}DomainService.add${javaBeanName}(addRequest);
    }

    @Override
    public void update${javaBeanName}(Biz${javaBeanName}UpdateRequest request) {
        ${javaBeanName}UpdateRequest updateRequest = Biz${javaBeanName}UpdateRequestConverter.INSTANCE.convertReverse(request);
        ${javaBeanNameLF}DomainService.update${javaBeanName}(updateRequest);
    }
}
