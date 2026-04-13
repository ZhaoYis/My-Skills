<#--
  ============================================================================
  Controller 层模板
  版本: v1.1.0 | 层级: Web 层 | 维护人: pprod-team
  说明: 生成 Controller 层代码，包含 CRUD 接口
  依赖: BizService, DomainService, VO, Request, Converter
  ============================================================================
-->
package ${packageName}.web.home${moduleName}.controller${subPackage};

import ${packageName}.biz.shared${moduleName}.${javaBeanName}BizService;
import ${packageName}.core.service${moduleName}.${javaBeanName}DomainService;
import ${packageName}.web.home${moduleName}.request.Web${javaBeanName}AddRequest;
import ${packageName}.web.home${moduleName}.request.Web${javaBeanName}QueryRequest;
import ${packageName}.web.home${moduleName}.request.Web${javaBeanName}UpdateRequest;
import ${packageName}.web.home${moduleName}.convert.Web${javaBeanName}AddRequestConverter;
import ${packageName}.web.home${moduleName}.convert.Web${javaBeanName}UpdateRequestConverter;
import ${packageName}.web.home${moduleName}.convert.Web${javaBeanName}QueryRequestConverter;
import ${packageName}.web.home${moduleName}.response.${javaBeanName}VO;
import ${packageName}.web.home${moduleName}.convert.${javaBeanName}VOConverter;
import ${packageName}.core.model${moduleName}.${javaBeanName}Model;
import ${packageName}.core.service${moduleName}.request.${javaBeanName}QueryByNoRequest;
import ${packageName}.core.service${moduleName}.request.${javaBeanName}AdditionQueryRequest;
import ${packageName}.core.service${moduleName}.request.${javaBeanName}QueryRequest;
import ${packageName}.common.dal${moduleName}.request.${javaBeanName}ConditionDalRequest;
import ${packageName}.biz.shared${moduleName}.request.Biz${javaBeanName}AddRequest;
import ${packageName}.biz.shared${moduleName}.request.Biz${javaBeanName}UpdateRequest;
import lombok.extern.slf4j.Slf4j;
import io.swagger.annotations.Api;
import io.swagger.annotations.ApiOperation;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;
import cn.yzw.infra.component.base.model.YzwResult;
import javax.validation.Valid;
import javax.validation.constraints.NotBlank;
import cn.yzw.infra.component.base.model.page.PageRequest;
import cn.yzw.infra.component.base.model.page.PageResult;
import cn.yzw.iec.auac.sso.sdk.annotation.AuthType;
import cn.yzw.iec.auac.sso.sdk.annotation.Authority;
import ${packageName}.common.util.converter.PageRequestConverter;
import ${packageName}.common.util.converter.PageResultConverter;
import ${packageName}.core.service.integration.common.UnifiedUserContextHolder;

/**
 * ${tableComment} Controller
 *
 * @author ${author}
 */
@Slf4j
@RestController
@RequestMapping("/rest${modulePath}/${javaBeanNameLF}")
@Api(tags = "${tableComment}")
public class ${javaBeanName}Controller {

    @Autowired
    private ${javaBeanName}BizService ${javaBeanNameLF}BizService;

    @Autowired
    private ${javaBeanName}DomainService ${javaBeanNameLF}DomainService;

    @Authority(type = AuthType.JUST_LOGIN)
    @GetMapping(value = "/queryByNo/{${bizPkNo}}")
    @ApiOperation("根据${bizPkColumnComment}查询${tableComment}")
    public YzwResult<${javaBeanName}VO> queryByNo(@Valid @NotBlank @PathVariable("${bizPkNo}") ${bizPkType} ${bizPkNo}) {
        ${javaBeanName}QueryByNoRequest request = ${javaBeanName}QueryByNoRequest.builder()
            .${bizPkNo}(${bizPkNo})
            .addition(${javaBeanName}AdditionQueryRequest.builder().build())
            .build();
        ${javaBeanName}Model ${javaBeanNameLF}Model = ${javaBeanNameLF}BizService.queryByNo(request);
        return YzwResult.success(${javaBeanName}VOConverter.INSTANCE.convert(${javaBeanNameLF}Model));
    }

    @Authority(type = AuthType.JUST_LOGIN)
    @PostMapping("/queryByPage")
    @ApiOperation("分页查询${tableComment}")
    public YzwResult<PageResult<${javaBeanName}VO>> queryByPage(@RequestBody @Valid PageRequest<Web${javaBeanName}QueryRequest> request) {
        ${javaBeanName}ConditionDalRequest condition = Web${javaBeanName}QueryRequestConverter.INSTANCE.convertReverse(request.getParam());
        ${javaBeanName}QueryRequest ${javaBeanNameLF}QueryRequest = ${javaBeanName}QueryRequest.builder()
            .condition(condition)
            .addition(${javaBeanName}AdditionQueryRequest.builder().build())
            .build();

        PageResult<${javaBeanName}Model> ${javaBeanNameLF}ModelPageResult = ${javaBeanNameLF}BizService.queryByPage(
            PageRequestConverter.convert(request, ${javaBeanNameLF}QueryRequest));
        return YzwResult.success(PageResultConverter.convert(${javaBeanNameLF}ModelPageResult,
            ${javaBeanName}VOConverter.INSTANCE.convertList(${javaBeanNameLF}ModelPageResult.getRecords())));
    }

    @Authority(type = AuthType.JUST_LOGIN)
    @PostMapping("/add")
    @ApiOperation("新增${tableComment}")
    public YzwResult<${bizPkType}> add${javaBeanName}(@RequestBody @Valid Web${javaBeanName}AddRequest request) {
        Biz${javaBeanName}AddRequest bizRequest = Web${javaBeanName}AddRequestConverter.INSTANCE.convertReverse(request);
        bizRequest.fillCreateUserContext(UnifiedUserContextHolder.getCurrentUser(false));
        ${bizPkType} ${bizPkNo} = ${javaBeanNameLF}BizService.add${javaBeanName}(bizRequest);
        return YzwResult.success(${bizPkNo});
    }

    @Authority(type = AuthType.JUST_LOGIN)
    @PutMapping("/update")
    @ApiOperation("更新${tableComment}")
    public YzwResult<Void> update${javaBeanName}(@RequestBody @Valid Web${javaBeanName}UpdateRequest request) {
        Biz${javaBeanName}UpdateRequest bizRequest = Web${javaBeanName}UpdateRequestConverter.INSTANCE.convertReverse(request);
        bizRequest.fillUpdateUserContext(UnifiedUserContextHolder.getCurrentUser(false));
        ${javaBeanNameLF}BizService.update${javaBeanName}(bizRequest);
        return YzwResult.success();
    }

    @Authority(type = AuthType.JUST_LOGIN)
    @DeleteMapping("/delete/{${bizPkNo}}")
    @ApiOperation("删除${tableComment}")
    public YzwResult<Void> delete${javaBeanName}(@Valid @NotBlank @PathVariable("${bizPkNo}") ${bizPkType} ${bizPkNo}) {
        ${javaBeanNameLF}DomainService.delete${javaBeanName}(${bizPkNo});
        return YzwResult.success();
    }
}
