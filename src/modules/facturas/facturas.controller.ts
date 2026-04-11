import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  ParseIntPipe,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiConflictResponse,
  ApiUnauthorizedResponse,
  ApiBadRequestResponse,
  ApiConsumes,
  ApiBody,
  ApiParam,
} from '@nestjs/swagger';
import { FacturasService } from './facturas.service';
import { CargarFacturaDto } from '../../common/dtos/cargar-factura.dto';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

@ApiTags('facturas')
@ApiBearerAuth('api-key')
@ApiUnauthorizedResponse({ description: 'API Key inválida o ausente' })
@Controller('api/facturas')
@UseGuards(ApiKeyGuard)
export class FacturasController {
  constructor(private readonly facturasService: FacturasService) {}

  @Post()
  @ApiOperation({ summary: 'Cargar factura con imagen (multipart/form-data)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Datos de la factura + imagen adjunta',
    schema: {
      type: 'object',
      required: ['cedula', 'nombre', 'evento_id', 'numero_factura', 'sku', 'cantidad', 'foto'],
      properties: {
        cedula:          { type: 'string', example: '12345678' },
        nombre:          { type: 'string', example: 'Juan Perez' },
        celular:         { type: 'string', example: '04141234567' },
        ciudad:          { type: 'string', example: 'Caracas' },
        email:           { type: 'string', example: 'juan@email.com' },
        evento_id:       { type: 'integer', example: 1 },
        numero_factura:  { type: 'string', example: 'FAC-2024-001' },
        sku:             { type: 'string', enum: ['250g', '500g', '1kg', '5kg'] },
        cantidad:        { type: 'integer', example: 2 },
        foto:            { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiCreatedResponse({ description: 'Factura registrada y cupones asignados' })
  @ApiConflictResponse({ description: 'La factura ya fue registrada para esta cédula en este evento' })
  @ApiBadRequestResponse({ description: 'Datos inválidos o evento no disponible' })
  @UseInterceptors(FileInterceptor('foto', { limits: { fileSize: MAX_FILE_SIZE } }))
  async cargarFactura(
    @Body() dto: CargarFacturaDto,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: MAX_FILE_SIZE }),
          new FileTypeValidator({ fileType: /(jpg|jpeg|png)$/i, skipMagicNumbersValidation: true }),
        ],
      }),
    )
    file: Express.Multer.File,
  ) {
    return await this.facturasService.cargarFactura(dto, file);
  }

  @Get(':cedula/evento/:eventoId')
  @ApiOperation({ summary: 'Consultar cupones de un participante en un evento' })
  @ApiParam({ name: 'cedula', type: String, example: '12345678' })
  @ApiParam({ name: 'eventoId', type: Number, example: 1 })
  @ApiOkResponse({ description: 'Cupones acumulados y facturas del participante en el evento' })
  @ApiNotFoundResponse({ description: 'Participante no encontrado' })
  async getCupones(
    @Param('cedula') cedula: string,
    @Param('eventoId', ParseIntPipe) eventoId: number,
  ) {
    return await this.facturasService.getCuponesByCedulaEvento(cedula, eventoId);
  }

  @Get('id/:id')
  @ApiOperation({ summary: 'Obtener factura por ID interno' })
  @ApiParam({ name: 'id', type: Number, example: 1 })
  @ApiOkResponse({ description: 'Datos de la factura' })
  @ApiNotFoundResponse({ description: 'Factura no encontrada' })
  async getFacturaById(@Param('id', ParseIntPipe) id: number) {
    return await this.facturasService.getFacturaById(id);
  }
}
