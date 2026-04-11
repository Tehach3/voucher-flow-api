import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { FacturaEntity } from './entities/factura.entity';
import { ParticipacionEventoEntity } from '../participaciones/entities/participacion-evento.entity';
import { UsuariosService } from '../usuarios/usuarios.service';
import { EventosService } from '../eventos/eventos.service';
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
    @InjectRepository(ParticipacionEventoEntity)
    private readonly participacionesRepository: Repository<ParticipacionEventoEntity>,
    private readonly dataSource: DataSource,
    private readonly usuariosService: UsuariosService,
    private readonly eventosService: EventosService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  async cargarFactura(
    dto: CargarFacturaDto,
    file: Express.Multer.File,
  ): Promise<CargarFacturaResponse> {
    const { cedula, nombre, celular, ciudad, email, evento_id, numero_factura, sku, cantidad } = dto;

    this.logger.log(`[CARGAR_FACTURA] Iniciando carga para cédula: ${cedula}, evento: ${evento_id}`);

    // 1. Verificar que el evento existe y está abierto
    const [eventoRows] = await this.dataSource.query<[{ evento_esta_abierto: boolean }]>(
      'SELECT evento_esta_abierto($1) AS evento_esta_abierto',
      [evento_id],
    );

    if (!eventoRows?.evento_esta_abierto) {
      throw new BadRequestException(`El evento ${evento_id} no está disponible para recibir facturas`);
    }

    // 2. Buscar o crear usuario
    const usuario = await this.usuariosService.findOrCreate({
      cedula,
      nombre,
      celular,
      ciudad,
      email,
    });

    // 3. Crear participación si no existe (usando la función de DB)
    await this.dataSource.query(
      'SELECT crear_participacion_evento($1, $2)',
      [usuario.id, evento_id],
    );

    const participacion = await this.participacionesRepository.findOne({
      where: { usuario_id: usuario.id, evento_id },
    });

    if (!participacion) {
      throw new BadRequestException('No se pudo registrar la participación en el evento');
    }

    // 4. Validar factura no duplicada en el evento
    const existente = await this.facturasRepository.findOne({
      where: { evento_id, usuario_id: usuario.id, numero_factura },
    });

    if (existente) {
      this.logger.warn(
        `[CARGAR_FACTURA] Factura duplicada: ${numero_factura} para cédula ${cedula} en evento ${evento_id}`,
      );
      throw new ConflictException(
        `La factura ${numero_factura} ya fue registrada para esta cédula en este evento`,
      );
    }

    // 5. Upload imagen
    this.logger.debug(`[CARGAR_FACTURA] Subiendo imagen para cédula: ${cedula}`);
    const { url: fotoUrl, publicId } = await this.cloudinaryService.upload(file, cedula);

    // 6. Obtener OCR (no bloquea si falla)
    const ocrData = await this.cloudinaryService.getOcrData(publicId);

    // 7. Calcular cupones
    const cuponesGenerados = SKU_CUPONES[sku] * cantidad;
    this.logger.debug(
      `[CARGAR_FACTURA] Cupones calculados: ${sku} x ${cantidad} = ${cuponesGenerados}`,
    );

    // 8. Guardar factura — el trigger de DB actualiza cupones_acumulados en participaciones_evento
    const factura = this.facturasRepository.create({
      usuario_id: usuario.id,
      evento_id,
      participacion_id: participacion.id,
      numero_factura,
      sku,
      cantidad,
      cupones_generados: cuponesGenerados,
      foto_url: fotoUrl,
      ocr_data: ocrData,
    });
    await this.facturasRepository.save(factura);

    // 9. Leer cupones actualizados (el trigger ya los actualizó)
    const participacionActualizada = await this.participacionesRepository.findOne({
      where: { id: participacion.id },
    });

    const cuponesTotal = participacionActualizada?.cupones_acumulados ?? cuponesGenerados;

    this.logger.log(
      `[CARGAR_FACTURA] Completado para cédula ${cedula}: +${cuponesGenerados} cupones (total evento: ${cuponesTotal})`,
    );

    return {
      success: true,
      cedula,
      evento_id,
      cupones_generados: cuponesGenerados,
      cupones_totales: cuponesTotal,
      foto_url: fotoUrl,
      numero_factura,
    };
  }

  async getCuponesByCedulaEvento(cedula: string, evento_id: number): Promise<CuponesResponse> {
    const usuario = await this.usuariosService.findByCedula(cedula);

    const participacion = await this.participacionesRepository.findOne({
      where: { usuario_id: usuario.id, evento_id },
    });

    if (!participacion) {
      return {
        cedula,
        evento_id,
        cupones_acumulados: 0,
        total_facturas: 0,
        facturas: [],
      };
    }

    const facturas = await this.facturasRepository.find({
      where: { participacion_id: participacion.id },
      order: { fecha_carga: 'DESC' },
    });

    return {
      cedula,
      evento_id,
      cupones_acumulados: participacion.cupones_acumulados,
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
