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
import { FacturasService } from './facturas.service';
import { CargarFacturaDto } from '../../common/dtos/cargar-factura.dto';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

@Controller('api/facturas')
@UseGuards(ApiKeyGuard)
export class FacturasController {
  constructor(private readonly facturasService: FacturasService) {}

  @Post()
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

  @Get(':cedula')
  async getCupones(@Param('cedula') cedula: string) {
    return await this.facturasService.getCuponesByCedula(cedula);
  }

  @Get('id/:id')
  async getFacturaById(@Param('id', ParseIntPipe) id: number) {
    return await this.facturasService.getFacturaById(id);
  }
}
