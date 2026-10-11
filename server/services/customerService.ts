import crypto from 'crypto';
import { AddressRepository } from '../repositories/addressRepository.ts';
import type { Address } from '../models/types.ts';
import type { CreateAddressDto } from '../schemas/validation.ts';
import { AuditService } from './auditService.ts';

export class CustomerService {
  public static async listAddresses(userId: string): Promise<Address[]> {
    return AddressRepository.findByUserId(userId);
  }

  public static async createAddress(userId: string, dto: CreateAddressDto): Promise<Address> {
    const addressId = `addr_${crypto.randomUUID()}`;
    const userAddresses = await AddressRepository.findByUserId(userId);
    const isFirst = userAddresses.length === 0;

    const newAddress: Address = {
      id: addressId,
      user_id: userId,
      label: dto.label.trim(),
      street: dto.street.trim(),
      number: dto.number.trim(),
      colony: dto.colony.trim(),
      city: dto.city.trim(),
      state: dto.state.trim(),
      postal_code: dto.postal_code.trim(),
      references: dto.references ? dto.references.trim() : '',
      is_default: dto.is_default !== undefined ? Boolean(dto.is_default) : isFirst,
      createdAt: new Date().toISOString(),
    };

    const saved = await AddressRepository.create(newAddress);
    await AuditService.log('address.created', 'address', saved.id, { label: saved.label }, userId, 'customer');
    return saved;
  }

  public static async updateAddress(userId: string, addressId: string, updates: Partial<CreateAddressDto>): Promise<Address> {
    const existing = await AddressRepository.findById(addressId);
    if (!existing || existing.user_id !== userId) {
      throw new Error('Dirección no encontrada');
    }

    const updated = await AddressRepository.update(addressId, updates);
    if (!updated) throw new Error('Error al actualizar dirección');

    await AuditService.log('address.updated', 'address', addressId, updates, userId, 'customer');
    return updated;
  }

  public static async deleteAddress(userId: string, addressId: string): Promise<boolean> {
    const existing = await AddressRepository.findById(addressId);
    if (!existing || existing.user_id !== userId) {
      throw new Error('Dirección no encontrada');
    }

    const result = await AddressRepository.delete(addressId);
    await AuditService.log('address.deleted', 'address', addressId, {}, userId, 'customer');
    return result;
  }
}
