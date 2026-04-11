import {
  Injectable,
  ConflictException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FacturaEntity } from './entities/factura.entity';
import { UsuariosService } from '../usuarios/usuarios.service';
import { CloudinaryService } from '../../services/cloudinary.service';
import { CargarFacturaDto } from '../../common/dtos/cargar-factura.dto';
import { SKU_CUPONES } from '../../common/constants/sku.constants';
import {
  CargarFacturaResponse,
  CuponesResponse,
  IFactura,
} from '../../common/interfaces/factura.interface';

@Injectable()
export class FacturasService {
  private readonly logger = new Logger(FacturasService.name);

  constructor(
    @InjectRepository(FacturaEntity)
    private readonly facturasRepository: Repository<FacturaEntity>,
    private readonly usuariosService: UsuariosService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  async cargarFactura(
    dto: CargarFacturaDto,
    file: Express.Multer.File,
  ): Promise<CargarFacturaResponse> {
    const { cedula, nombre, celular, ciudad, numero_factura, sku, cantidad } = dto;

    this.logger.log(`[CARGAR_FACTURA] Iniciando carga para cédula: ${cedula}`);

    // 1. Buscar o crear usuario
    const usuario = await this.usuariosService.findOrCreate({
      cedula,
      nombre,
      celular,
      ciudad,
    });

    // 2. Validar factura no duplicada
    const existente = await this.facturasRepository.findOne({
      where: { usuario_id: usuario.id, numero_factura },
    });

    if (existente) {
      this.logger.warn(
        `[CARGAR_FACTURA] Factura duplicada: ${numero_factura} para cédula ${cedula}`,
      );
      throw new ConflictException(
        `La factura ${numero_factura} ya fue registrada para esta cédula`,
      );
    }

    // 3. Upload imagen
    this.logger.debug(`[CARGAR_FACTURA] Subiendo imagen para cédula: ${cedula}`);
    const { url: fotoUrl, publicId } = await this.cloudinaryService.upload(
      file,
      cedula,
    );

    // 4. Obtener OCR (no bloquea si falla)
    const ocrData = await this.cloudinaryService.getOcrData(publicId);

    // 5. Calcular cupones
    const cuponesGenerados = SKU_CUPONES[sku] * cantidad;
    this.logger.debug(
      `[CARGAR_FACTURA] Cupones calculados: ${sku} x ${cantidad} = ${cuponesGenerados}`,
    );

    // 6. Guardar factura
    const factura = this.facturasRepository.create({
      usuario_id: usuario.id,
      numero_factura,
      sku,
      cantidad,
      cupones_generados: cuponesGenerados,
      foto_url: fotoUrl,
      ocr_data: ocrData,
    });
    await this.facturasRepository.save(factura);

    // 7. Incrementar cupones del usuario
    await this.usuariosService.incrementarCupones(usuario.id, cuponesGenerados);

    const cuponesTotal = usuario.cupones_acumulados + cuponesGenerados;

    this.logger.log(
      `[CARGAR_FACTURA] Completado para cédula ${cedula}: +${cuponesGenerados} cupones (total: ${cuponesTotal})`,
    );

    return {
      success: true,
      cedula,
      cupones_generados: cuponesGenerados,
      cupones_totales: cuponesTotal,
      foto_url: fotoUrl,
      numero_factura,
    };
  }

  async getCuponesByCedula(cedula: string): Promise<CuponesResponse> {
    const usuario = await this.usuariosService.findByCedula(cedula);

    const facturas = await this.facturasRepository.find({
      where: { usuario_id: usuario.id },
      order: { fecha_carga: 'DESC' },
    });

    return {
      cedula,
      cupones_acumulados: usuario.cupones_acumulados,
      total_facturas: facturas.length,
      facturas: facturas as IFactura[],
    };
  }

  async getFacturaById(id: number): Promise<IFactura> {
    const factura = await this.facturasRepository.findOne({
      where: { id },
      relations: ['usuario'],
    });

    if (!factura) {
      throw new NotFoundException(`Factura con id ${id} no encontrada`);
    }

    return factura as IFactura;
  }
}
