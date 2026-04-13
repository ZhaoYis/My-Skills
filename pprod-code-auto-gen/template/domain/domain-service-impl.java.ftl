<#--
  ============================================================================
  DomainService 实现模板
  版本: v1.1.0 | 层级: Core 层 | 维护人: pprod-team
  说明: 生成 DomainService 实现类
  依赖: Mapper, Model, Request, Converter
  ============================================================================
-->
package ${packageName}.core.service${moduleName}.impl;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.function.Function;
import java.util.stream.Collectors;
import java.util.Collections;

import ${packageName}.common.dal${moduleName}.model.${javaBeanName}DO;
import ${packageName}.common.dal${moduleName}.mapper.${javaBeanName}Mapper;
import ${packageName}.common.dal${moduleName}.mapper.manual.${javaBeanName}ManualMapper;
import ${packageName}.core.service${moduleName}.${javaBeanName}DomainService;
import ${packageName}.core.model${moduleName}.${javaBeanName}Model;
import ${packageName}.core.service${moduleName}.request.${javaBeanName}QueryRequest;
import ${packageName}.core.service${moduleName}.request.${javaBeanName}QueryByNoRequest;
import ${packageName}.core.service${moduleName}.request.${javaBeanName}QueryByNosRequest;
import ${packageName}.core.service${moduleName}.request.${javaBeanName}AddRequest;
import ${packageName}.core.service${moduleName}.request.${javaBeanName}UpdateRequest;
import ${packageName}.core.service${moduleName}.request.${javaBeanName}AdditionQueryRequest;
import ${packageName}.core.service${moduleName}.convert.${javaBeanName}ModelConverter;
import ${packageName}.core.service${moduleName}.convert.${javaBeanName}AddRequestConverter;
import ${packageName}.core.service${moduleName}.convert.${javaBeanName}UpdateRequestConverter;
import ${packageName}.core.service.integration.common.IdGeneratorFacadeClient;

import cn.yzw.infra.component.base.model.page.PageRequest;
import cn.yzw.infra.component.base.model.page.PageResult;
import com.github.pagehelper.PageHelper;
import com.github.pagehelper.Page;
import lombok.extern.slf4j.Slf4j;
import cn.yzw.infra.component.utils.AssertUtils;
import org.apache.commons.collections4.CollectionUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ${packageName}.common.dal.mysql.pprod.PageConvertUtils;

/**
 * ${tableComment} DomainServiceImpl
 *
 * @author ${author}
 */
@Slf4j
@Service
public class ${javaBeanName}DomainServiceImpl implements ${javaBeanName}DomainService {

    @Autowired
    private ${javaBeanName}Mapper ${javaBeanNameLF}Mapper;

    @Autowired
    private ${javaBeanName}ManualMapper ${javaBeanNameLF}ManualMapper;

    @Autowired
    private IdGeneratorFacadeClient idGeneratorFacadeClient;

    @Override
    public ${javaBeanName}Model queryPureByNo(${bizPkType} ${bizPkNo}) {
        ${javaBeanName}DO ${javaBeanNameLF}DO = ${javaBeanNameLF}Mapper.selectOneById(${bizPkNo});
        if (${javaBeanNameLF}DO == null) {
            return null;
        }
        return ${javaBeanName}ModelConverter.INSTANCE.convert(${javaBeanNameLF}DO);
    }

    @Override
    public List<${javaBeanName}Model> queryPureByNos(List<${bizPkType}> ${bizPkNo}s) {
        if (CollectionUtils.isEmpty(${bizPkNo}s)) {
            return Collections.emptyList();
        }
        List<${javaBeanName}DO> ${javaBeanNameLF}DOs = ${javaBeanNameLF}Mapper.selectListInId(${bizPkNo}s);
        if (CollectionUtils.isEmpty(${javaBeanNameLF}DOs)) {
            return Collections.emptyList();
        }
        // 按照逻辑主键固定顺序返回
        Map<${bizPkType}, ${javaBeanName}DO> ${javaBeanNameLF}Map = ${javaBeanNameLF}DOs.stream()
                .collect(Collectors.toMap(${javaBeanName}DO::get${bizPkMethodName}, Function.identity()));
        ${javaBeanNameLF}DOs = ${bizPkNo}s.stream().map(${javaBeanNameLF}Map::get).filter(Objects::nonNull)
                .collect(Collectors.toList());
        return ${javaBeanName}ModelConverter.INSTANCE.convertList(${javaBeanNameLF}DOs);
    }

    @Override
    public ${javaBeanName}Model queryByNo(${javaBeanName}QueryByNoRequest request) {
        ${javaBeanName}Model ${javaBeanNameLF}Model = this.queryPureByNo(request.get${bizPkMethodName}());
        if (${javaBeanNameLF}Model == null) {
            return null;
        }
        // 添加附加信息返回
        this.fillAddition(Collections.singletonList(${javaBeanNameLF}Model), request.getAddition());
        return ${javaBeanNameLF}Model;
    }

    @Override
    public List<${javaBeanName}Model> queryByNos(${javaBeanName}QueryByNosRequest request) {
        List<${javaBeanName}Model> ${javaBeanNameLF}Models = this.queryPureByNos(request.get${bizPkMethodName}s());
        // 添加附加信息返回
        this.fillAddition(${javaBeanNameLF}Models, request.getAddition());
        return ${javaBeanNameLF}Models;
    }

    @Override
    public PageResult<${javaBeanName}Model> queryByPage(PageRequest<${javaBeanName}QueryRequest> request) {
        // Step 1: 标记分页
        PageHelper.startPage(request.getPageNum(), request.getPageSize());
        List<${javaBeanName}DO> ${javaBeanNameLF}DOs = ${javaBeanNameLF}ManualMapper.queryByCondition(request.getParam().getCondition());
        if (CollectionUtils.isEmpty(${javaBeanNameLF}DOs)) {
            return PageConvertUtils.getResult(((Page<${javaBeanName}DO>) ${javaBeanNameLF}DOs).toPageInfo());
        }
        List<${javaBeanName}Model> ${javaBeanNameLF}Models = ${javaBeanName}ModelConverter.INSTANCE.convertList(${javaBeanNameLF}DOs);
        // 添加附加信息返回
        this.fillAddition(${javaBeanNameLF}Models, request.getParam().getAddition());
        return PageConvertUtils.pageResultConvert(((Page<${javaBeanName}DO>) ${javaBeanNameLF}DOs).toPageInfo(), ${javaBeanNameLF}Models);
    }

    @Override
    @Transactional(rollbackFor = Throwable.class)
    public ${bizPkType} add${javaBeanName}(${javaBeanName}AddRequest request) {
        // 参数校验
        this.validateAdd${javaBeanName}(request);
        ${javaBeanName}DO ${javaBeanNameLF}DO = ${javaBeanName}AddRequestConverter.INSTANCE.convertReverse(request);
        // bizId自动生成设置
        ${bizPkType} ${bizPkNo} = idGeneratorFacadeClient.genId(null);
        ${javaBeanNameLF}DO.set${bizPkMethodName}(${bizPkNo});
        ${javaBeanNameLF}Mapper.insert(${javaBeanNameLF}DO);
        return ${bizPkNo};
    }

    @Override
    @Transactional(rollbackFor = Throwable.class)
    public void update${javaBeanName}(${javaBeanName}UpdateRequest request) {
        ${javaBeanName}DO db${javaBeanName}DO = ${javaBeanNameLF}Mapper.selectOneById(request.get${bizPkMethodName}());
        // 参数校验
        this.validateUpdate${javaBeanName}(db${javaBeanName}DO, request);

        ${javaBeanName}DO ${javaBeanNameLF}DO = ${javaBeanName}UpdateRequestConverter.INSTANCE.convertReverse(request);
        ${javaBeanNameLF}DO.set${bizPkMethodName}(db${javaBeanName}DO.get${bizPkMethodName}());

        // 更新数据
        ${javaBeanNameLF}Mapper.updateById(${javaBeanNameLF}DO);
    }

    @Override
    @Transactional(rollbackFor = Throwable.class)
    public boolean delete${javaBeanName}(${bizPkType} ${bizPkNo}) {
        AssertUtils.notNull(${bizPkNo}, "${bizPkColumnComment}不能为空");
        ${javaBeanName}DO ${javaBeanNameLF}DO = ${javaBeanNameLF}Mapper.selectOneById(${bizPkNo});
        AssertUtils.notNull(${javaBeanNameLF}DO, "${tableComment}不存在");
        // 逻辑删除：设置 delete_flag = 1
        int count = ${javaBeanNameLF}Mapper.deleteById(${bizPkNo});
        return count > 0;
    }

    private void validateUpdate${javaBeanName}(${javaBeanName}DO ${javaBeanNameLF}DO, ${javaBeanName}UpdateRequest request) {
        AssertUtils.notNull(${javaBeanNameLF}DO, "${tableComment}不存在");
    }

    private void validateAdd${javaBeanName}(${javaBeanName}AddRequest request) {
        // 新增校验
    }

    private void fillAddition(List<${javaBeanName}Model> ${javaBeanNameLF}Models,
                             ${javaBeanName}AdditionQueryRequest addition) {
        if (CollectionUtils.isEmpty(${javaBeanNameLF}Models) || addition == null) {
            return;
        }

        // 示例: 附加信息填充
        // if (Boolean.TRUE.equals(addition.getIncludeDetail)) {
        //     // fill something
        // }
    }
}
