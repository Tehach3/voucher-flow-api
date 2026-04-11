import {
  Controller,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiCreatedResponse,
  ApiUnauthorizedResponse,
  ApiBadRequestResponse,
  ApiConsumes,
  ApiBody,
  ApiQuery,
} from '@nestjs/swagger';
import { ImagenesService } from './imagenes.service';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';
import { REGEX } from '../../common/constants/regex.constants';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

@ApiTags('imagenes')
@ApiBearerAuth('api-key')
@ApiUnauthorizedResponse({ description: 'API Key inválida o ausente' })
@Controller('api/imagenes')
@UseGuards(ApiKeyGuard)
export class ImagenesController {
  constructor(private readonly imagenesService: ImagenesService) {}

  @Post('upload')
  @ApiOperation({ summary: 'Subir imagen directamente a Cloudinary' })
  @ApiConsumes('multipart/form-data')
  @ApiQuery({ name: 'cedula', required: true, type: String, example: '12345678', description: 'Cédula del participante (8 dígitos)' })
  @ApiBody({
    description: 'Imagen JPG/PNG hasta 5 MB',
    schema: {
      type: 'object',
      required: ['foto'],
      properties: {
        foto: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiCreatedResponse({ description: 'Imagen subida exitosamente, retorna URL y OCR data' })
  @ApiBadRequestResponse({ description: 'Cédula inválida o archivo no permitido' })
  @UseInterceptors(FileInterceptor('foto', { limits: { fileSize: MAX_FILE_SIZE } }))
  async subirImagen(
    @Query('cedula') cedula: string,
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
    if (!cedula || !REGEX.CEDULA.test(cedula)) {
      throw new BadRequestException(
        'Query param cedula es requerido y debe tener exactamente 8 dígitos',
      );
    }
    return await this.imagenesService.subirImagen(file, cedula);
  }
}
