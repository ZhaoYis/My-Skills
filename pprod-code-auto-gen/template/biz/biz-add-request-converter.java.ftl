<#--
  ============================================================================
  Biz层新增请求转换器模板
  版本: v1.1.0 | 层级: Biz 层 | 维护人: pprod-team
  说明: 生成 Biz 层新增请求到 Domain 层请求的转换器
  依赖: MapStruct, BaseConverter
  ============================================================================
-->
package ${packageName}.biz.shared${moduleName}.convert;

import ${packageName}.biz.shared${moduleName}.request.Biz${javaBeanName}AddRequest;
import ${packageName}.core.service${moduleName}.request.${javaBeanName}AddRequest;
import org.mapstruct.Mapper;
import org.mapstruct.Builder;
import org.mapstruct.factory.Mappers;
import ${packageName}.common.util.converter.BaseConverter;

/**
 * ${tableComment} Biz层新增请求转换器
 *
 * @author ${author}
 */
@Mapper(builder = @Builder(disableBuilder = true))
public abstract class Biz${javaBeanName}AddRequestConverter implements BaseConverter<Biz${javaBeanName}AddRequest, ${javaBeanName}AddRequest> {

    public static Biz${javaBeanName}AddRequestConverter INSTANCE = Mappers.getMapper(Biz${javaBeanName}AddRequestConverter.class);
}
