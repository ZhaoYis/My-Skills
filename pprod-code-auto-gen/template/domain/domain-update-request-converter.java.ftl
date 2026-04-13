<#--
  ============================================================================
  Domain层更新请求转换器模板
  版本: v1.1.0 | 层级: Core 层 | 维护人: pprod-team
  说明: 生成 Domain 层更新请求到 DO 的转换器
  依赖: MapStruct, BaseConverter
  ============================================================================
-->
package ${packageName}.core.service${moduleName}.convert;

import ${packageName}.common.dal${moduleName}.model.${javaBeanName}DO;
import ${packageName}.core.service${moduleName}.request.${javaBeanName}UpdateRequest;
import org.mapstruct.Mapper;
import org.mapstruct.factory.Mappers;
import ${packageName}.common.util.converter.BaseConverter;

/**
 * ${tableComment} 更新请求转换器
 *
 * @author ${author}
 */
@Mapper
public abstract class ${javaBeanName}UpdateRequestConverter implements BaseConverter<${javaBeanName}UpdateRequest, ${javaBeanName}DO> {

    public static ${javaBeanName}UpdateRequestConverter INSTANCE = Mappers.getMapper(${javaBeanName}UpdateRequestConverter.class);
}
