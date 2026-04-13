<#--
  ============================================================================
  VO Converter 模板
  版本: v1.1.0 | 层级: Web 层 | 维护人: pprod-team
  说明: 生成 Model 到 VO 的转换器
  依赖: MapStruct, BaseConverter
  ============================================================================
-->
package ${packageName}.web.home${moduleName}.convert;

import ${packageName}.core.model${moduleName}.${javaBeanName}Model;
import ${packageName}.web.home${moduleName}.response.${javaBeanName}VO;
import org.mapstruct.Mapper;
import org.mapstruct.factory.Mappers;
import ${packageName}.common.util.converter.BaseConverter;

/**
 * ${tableComment} VO Converter
 *
 * @author ${author}
 */
@Mapper
public abstract class ${javaBeanName}VOConverter implements BaseConverter<${javaBeanName}VO, ${javaBeanName}Model> {

    public static ${javaBeanName}VOConverter INSTANCE = Mappers.getMapper(${javaBeanName}VOConverter.class);
}
