import { CloudinaryService } from './cloudinary.service';

const mockFile = (
  overrides: Partial<Express.Multer.File> = {},
): Express.Multer.File =>
  ({
    fieldname: 'foto',
    originalname: 'factura.jpg',
    mimetype: 'image/jpeg',
    size: 1024,
    buffer: Buffer.from('fake-image-data'),
    ...overrides,
  }) as Express.Multer.File;

describe('CloudinaryService (stub mode)', () => {
  let service: CloudinaryService;

  beforeEach(() => {
    delete process.env.CLOUDINARY_CLOUD_NAME;
    delete process.env.CLOUDINARY_API_KEY;
    delete process.env.CLOUDINARY_API_SECRET;
    service = new CloudinaryService();
  });

  it('upload() returns a stub URL when not configured', async () => {
    const result = await service.upload(mockFile(), '12345678');

    expect(result.url).toContain('stub-uploads');
    expect(result.url).toContain('12345678');
    expect(result.publicId).toContain('stub_');
  });

  it('upload() includes cedula in the stub URL path', async () => {
    const cedula = '87654321';
    const result = await service.upload(mockFile(), cedula);

    expect(result.url).toContain(cedula);
    expect(result.publicId).toContain(cedula);
  });

  it('getOcrData() returns null in stub mode', async () => {
    const result = await service.getOcrData('some/public/id');
    expect(result).toBeNull();
  });
});
