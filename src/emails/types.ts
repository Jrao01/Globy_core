export interface EmpresaConfigInfo {
  nombreEmpresa: string;
  rif: string;
  direccionFiscal: string;
  telefono?: string;
  logoUrl?: string;
  colorPrimario?: string;
}

export interface DetalleInfo {
  producto: string;
  cantidad: number;
  precioUnit: number;
  total: number;
}

export interface ProductoSolicitud {
  nombre: string;
  stockActual: number;
  cantidadNecesaria: number;
}
