<#--
  ============================================================================
  Domain层模型转换器模板
  版本: v1.1.0 | 层级: Core 层 | 维护人: pprod-team
  说明: 生成 DO 到 Model 的转换器
  依赖: MapStruct, BaseConverter
  ============================================================================
-->
package ${packageName}.core.service${moduleName}.convert;

import ${packageName}.common.dal${moduleName}.model.${javaBeanName}DO;
import ${packageName}.core.model${moduleName}.${javaBeanName}Model;
import org.mapstruct.Mapper;
import org.mapstruct.Builder;
import org.mapstruct.factory.Mappers;
import ${packageName}.common.util.converter.BaseConverter;

/**
 * ${tableComment} 模型转换器
 *
 * @author ${author}
 */
@Mapper(builder = @Builder(disableBuilder = true))
public abstract class ${javaBeanName}ModelConverter implements BaseConverter<${javaBeanName}Model, ${javaBeanName}DO> {

    public static ${javaBeanName}ModelConverter INSTANCE = Mappers.getMapper(${javaBeanName}ModelConverter.class);
}
