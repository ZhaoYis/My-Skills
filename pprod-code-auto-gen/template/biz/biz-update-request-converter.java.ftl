<#--
  ============================================================================
  Biz层更新请求转换器模板
  版本: v1.1.0 | 层级: Biz 层 | 维护人: pprod-team
  说明: 生成 Biz 层更新请求到 Domain 层请求的转换器
  依赖: MapStruct, BaseConverter
  ============================================================================
-->
package ${packageName}.biz.shared${moduleName}.convert;

import ${packageName}.biz.shared${moduleName}.request.Biz${javaBeanName}UpdateRequest;
import ${packageName}.core.service${moduleName}.request.${javaBeanName}UpdateRequest;
import org.mapstruct.Mapper;
import org.mapstruct.Builder;
import org.mapstruct.factory.Mappers;
import ${packageName}.common.util.converter.BaseConverter;

/**
 * ${tableComment} Biz层更新请求转换器
 *
 * @author ${author}
 */
@Mapper(builder = @Builder(disableBuilder = true))
public abstract class Biz${javaBeanName}UpdateRequestConverter implements BaseConverter<Biz${javaBeanName}UpdateRequest, ${javaBeanName}UpdateRequest> {

    public static Biz${javaBeanName}UpdateRequestConverter INSTANCE = Mappers.getMapper(Biz${javaBeanName}UpdateRequestConverter.class);
}
