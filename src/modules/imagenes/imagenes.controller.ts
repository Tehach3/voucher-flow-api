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
import { ImagenesService } from './imagenes.service';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';
import { REGEX } from '../../common/constants/regex.constants';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

@Controller('api/imagenes')
@UseGuards(ApiKeyGuard)
export class ImagenesController {
  constructor(private readonly imagenesService: ImagenesService) {}

  @Post('upload')
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
