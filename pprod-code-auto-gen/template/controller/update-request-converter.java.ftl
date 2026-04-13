<#--
  ============================================================================
  Web层更新请求转换器模板
  版本: v1.1.0 | 层级: Web 层 | 维护人: pprod-team
  说明: 生成 Web 层更新请求到 Biz 层请求的转换器
  依赖: MapStruct, BaseConverter
  ============================================================================
-->
package ${packageName}.web.home${moduleName}.convert;

import ${packageName}.biz.shared${moduleName}.request.Biz${javaBeanName}UpdateRequest;
import ${packageName}.web.home${moduleName}.request.Web${javaBeanName}UpdateRequest;
import org.mapstruct.Mapper;
import org.mapstruct.factory.Mappers;
import ${packageName}.common.util.converter.BaseConverter;

/**
 * ${tableComment} 更新请求转换器
 *
 * @author ${author}
 */
@Mapper
public abstract class Web${javaBeanName}UpdateRequestConverter implements BaseConverter<Web${javaBeanName}UpdateRequest, Biz${javaBeanName}UpdateRequest> {

    public static Web${javaBeanName}UpdateRequestConverter INSTANCE = Mappers.getMapper(Web${javaBeanName}UpdateRequestConverter.class);
}
