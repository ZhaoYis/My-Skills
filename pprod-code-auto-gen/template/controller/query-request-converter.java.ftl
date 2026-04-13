<#--
  ============================================================================
  Web层查询请求转换器模板
  版本: v1.1.0 | 层级: Web 层 | 维护人: pprod-team
  说明: 生成 Web 层查询请求到 DAL 层条件请求的转换器
  依赖: MapStruct, BaseConverter
  ============================================================================
-->
package ${packageName}.web.home${moduleName}.convert;

import ${packageName}.web.home${moduleName}.request.Web${javaBeanName}QueryRequest;
import ${packageName}.common.dal${moduleName}.request.${javaBeanName}ConditionDalRequest;
import org.mapstruct.Mapper;
import org.mapstruct.factory.Mappers;
import ${packageName}.common.util.converter.BaseConverter;

/**
 * ${tableComment} 查询请求转换器
 *
 * @author ${author}
 */
@Mapper
public abstract class Web${javaBeanName}QueryRequestConverter implements BaseConverter<Web${javaBeanName}QueryRequest, ${javaBeanName}ConditionDalRequest> {

    public static Web${javaBeanName}QueryRequestConverter INSTANCE = Mappers.getMapper(Web${javaBeanName}QueryRequestConverter.class);
}
