<#--
  ============================================================================
  Domain层新增请求转换器模板
  版本: v1.1.0 | 层级: Core 层 | 维护人: pprod-team
  说明: 生成 Domain 层新增请求到 DO 的转换器
  依赖: MapStruct, BaseConverter
  ============================================================================
-->
package ${packageName}.core.service${moduleName}.convert;

import ${packageName}.common.dal${moduleName}.model.${javaBeanName}DO;
import ${packageName}.core.service${moduleName}.request.${javaBeanName}AddRequest;
import org.mapstruct.Mapper;
import org.mapstruct.factory.Mappers;
import ${packageName}.common.util.converter.BaseConverter;

/**
 * ${tableComment} 新增请求转换器
 *
 * @author ${author}
 */
@Mapper
public abstract class ${javaBeanName}AddRequestConverter implements BaseConverter<${javaBeanName}AddRequest, ${javaBeanName}DO> {

    public static ${javaBeanName}AddRequestConverter INSTANCE = Mappers.getMapper(${javaBeanName}AddRequestConverter.class);
}
