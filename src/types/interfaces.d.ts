import type { Cliente } from "../generated/models.js";

export type RegisterType = Omit<Cliente, 'id' | 'createdAt' | 'tipoCliente'>;

export type LoginType = Pick<Cliente, 'correo' | 'password'>;