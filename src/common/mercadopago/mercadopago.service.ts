import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  MercadoPagoErrorResponse,
  MercadoPagoCreatePaymentRequest,
  MercadoPagoPaymentResponse,
  MercadoPagoStatusSnapshot,
  MercadoPagoTrackingFields,
} from './mercadopago.types';

@Injectable()
export class MercadoPagoService {
  constructor(private readonly configService: ConfigService) {}

  async createApprovedPayment(
    params: MercadoPagoCreatePaymentRequest,
  ): Promise<MercadoPagoPaymentResponse> {
    const payment = await this.createPayment(params);

    if (payment.status !== 'approved') {
      throw new BadRequestException(
        `Pago MercadoPago no aprobado. status=${payment.status}, detail=${payment.status_detail ?? 'n/a'}`,
      );
    }

    return payment;
  }

  async createPayment(
    params: MercadoPagoCreatePaymentRequest,
  ): Promise<MercadoPagoPaymentResponse> {
    const accessToken = this.getAccessToken();

    const idempotencyKey = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const paymentResponse = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        'X-Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify({
        transaction_amount: params.transaction_amount,
        token: params.token,
        description: params.description,
        installments: params.installments,
        payment_method_id: params.payment_method_id,
        payer: params.payer,
      }),
    });

    if (!paymentResponse.ok) {
      const body = await paymentResponse.text();
      throw new BadRequestException(this.mapCreatePaymentError(body, paymentResponse.status));
    }

    return (await paymentResponse.json()) as MercadoPagoPaymentResponse;
  }

  async fetchStatusForPlan(
    preapprovalId?: string,
    paymentId?: string,
  ): Promise<MercadoPagoStatusSnapshot | null> {
    const accessToken = this.getAccessToken();

    if (preapprovalId) {
      return this.getPreapprovalStatus(preapprovalId, accessToken);
    }

    if (paymentId) {
      return this.getPaymentStatus(paymentId, accessToken);
    }

    return null;
  }

  async getPreapprovalStatus(
    preapprovalId: string,
    accessToken?: string,
  ): Promise<MercadoPagoStatusSnapshot> {
    const token = accessToken ?? this.getAccessToken();
    const response = await fetch(`https://api.mercadopago.com/preapproval/${preapprovalId}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(
        `MercadoPago preapproval ${preapprovalId} devolvio ${response.status}. body=${errorBody}`,
      );
    }

    const payload = (await response.json()) as Record<string, unknown>;
    return {
      source: 'preapproval',
      status: this.toOptionalString(payload.status),
      statusDetail: this.toOptionalString(payload.status_detail),
      externalReference: this.toOptionalString(payload.external_reference),
      payload,
    };
  }

  async getPaymentStatus(
    paymentId: string,
    accessToken?: string,
  ): Promise<MercadoPagoStatusSnapshot> {
    const token = accessToken ?? this.getAccessToken();
    const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(
        `MercadoPago payment ${paymentId} devolvio ${response.status}. body=${errorBody}`,
      );
    }

    const payload = (await response.json()) as Record<string, unknown>;
    return {
      source: 'payment',
      status: this.toOptionalString(payload.status),
      statusDetail: this.toOptionalString(payload.status_detail),
      externalReference: this.toOptionalString(payload.external_reference),
      payload,
    };
  }

  extractTrackingFields(payment: MercadoPagoPaymentResponse): MercadoPagoTrackingFields {
    return {
      paymentId: this.toOptionalString(payment.id),
      preapprovalId: this.toOptionalString(payment.preapproval_id),
      externalReference: this.toOptionalString(payment.external_reference),
      status: this.toOptionalString(payment.status),
      statusDetail: this.toOptionalString(payment.status_detail),
    };
  }

  private getAccessToken(): string {
    const accessToken = this.configService.get<string>('MERCADOPAGO_ACCESS_TOKEN');
    if (!accessToken) {
      throw new InternalServerErrorException(
        'Falta configurar MERCADOPAGO_ACCESS_TOKEN',
      );
    }

    return accessToken;
  }

  private mapCreatePaymentError(body: string, statusCode: number): string {
    let errorMessage = `No se pudo consultar MercadoPago (${statusCode})`;
    try {
      const errorBody = JSON.parse(body) as MercadoPagoErrorResponse;
      const causeCode = errorBody.cause?.[0]?.code?.toString() ?? '';
      if (causeCode === '205' || causeCode.includes('cardNumber')) {
        errorMessage = 'El numero de tarjeta no es valido';
      } else if (causeCode === '208' || causeCode.includes('cardExpirationMonth')) {
        errorMessage = 'Mes de vencimiento invalido';
      } else if (causeCode === '209' || causeCode.includes('cardExpirationYear')) {
        errorMessage = 'Ano de vencimiento invalido';
      } else if (causeCode === '214' || causeCode.includes('identificationNumber')) {
        errorMessage = 'Numero de documento invalido';
      } else if (causeCode === '316' || causeCode.includes('cardholderName')) {
        errorMessage = 'Nombre del titular invalido';
      } else if (causeCode === 'E301' || causeCode.includes('securityCode')) {
        errorMessage = 'Codigo de seguridad invalido';
      } else if (errorBody.message) {
        errorMessage =
          'Error al procesar el pago. Verifique los datos e intente nuevamente.' + errorBody.message;
      }
    } catch {
      // Keep generic message when body is not JSON.
    }

    return errorMessage;
  }

  private toOptionalString(value: unknown): string | undefined {
    if (value === null || value === undefined) {
      return undefined;
    }

    const normalized = String(value).trim();
    return normalized.length > 0 ? normalized : undefined;
  }
}
