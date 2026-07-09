import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  MercadoPagoErrorResponse,
  MercadoPagoCreatePaymentRequest,
  MercadoPagoCreatePreapprovalRequest,
  MercadoPagoPaymentResponse,
  MercadoPagoPreapprovalResponse,
  MercadoPagoStatusSnapshot,
  MercadoPagoTrackingFields,
} from './mercadopago.types';

@Injectable()
export class MercadoPagoService {
  private readonly logger = new Logger(MercadoPagoService.name);

  constructor(private readonly configService: ConfigService) {}

  async createAuthorizedPreapproval(
    params: MercadoPagoCreatePreapprovalRequest,
  ): Promise<MercadoPagoPreapprovalResponse> {
    const preapproval = await this.createPreapproval(params);
    const normalizedStatus = preapproval.status?.toLowerCase();

    if (normalizedStatus !== 'authorized') {
      throw new BadRequestException(
        `Suscripción MercadoPago no autorizada. status=${preapproval.status ?? 'n/a'}, detail=${preapproval.status_detail ?? 'n/a'}`,
      );
    }

    return preapproval;
  }

  async createPreapproval(
    params: MercadoPagoCreatePreapprovalRequest,
  ): Promise<MercadoPagoPreapprovalResponse> {
    const token = params.card_token_id?.trim();
    if (!token) {
      throw new BadRequestException(
        'El token de la tarjeta es obligatorio. Generá uno nuevo desde el formulario de pago.',
      );
    }

    const accessToken = this.getAccessToken();
    const backUrl =
      this.configService.get<string>('MERCADOPAGO_BACK_URL') ??
      'https://www.mercadopago.com.ar';

    this.logger.log(
      `MercadoPago createPreapproval: cred=${accessToken.slice(0, 12)}..., tokenLen=${token.length}, amount=${params.transaction_amount}, currency=${params.currency_id}`,
    );

    const preapprovalBody: Record<string, unknown> = {
      reason: params.reason,
      payer_email: params.payer_email,
      card_token_id: token,
      status: 'authorized',
      back_url: backUrl,
      auto_recurring: {
        frequency: 1,
        frequency_type: 'months',
        transaction_amount: params.transaction_amount,
        currency_id: params.currency_id,
      },
    };

    if (params.external_reference) {
      preapprovalBody.external_reference = params.external_reference;
    }

    const preapprovalResponse = await fetch('https://api.mercadopago.com/preapproval', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(preapprovalBody),
    });

    if (!preapprovalResponse.ok) {
      const body = await preapprovalResponse.text();
      this.logger.warn(
        `MercadoPago createPreapproval failed (${preapprovalResponse.status}): ${body}`,
      );
      throw new BadRequestException(
        this.mapCreatePreapprovalError(body, preapprovalResponse.status),
      );
    }

    return (await preapprovalResponse.json()) as MercadoPagoPreapprovalResponse;
  }

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
    const token = params.token?.trim();
    if (!token) {
      throw new BadRequestException(
        'El token de la tarjeta es obligatorio. Generá uno nuevo desde el formulario de pago.',
      );
    }

    const accessToken = this.getAccessToken();

    this.logger.log(
      `MercadoPago createPayment: cred=${accessToken.slice(0, 12)}..., tokenLen=${token.length}, issuer_id=${params.issuer_id ?? 'missing'}, payment_method_id=${params.payment_method_id}`,
    );

    const paymentBody: Record<string, unknown> = {
      transaction_amount: params.transaction_amount,
      token,
      description: params.description,
      installments: params.installments,
      payment_method_id: params.payment_method_id,
      payer: params.payer,
    };
    if (params.issuer_id != null) {
      paymentBody.issuer_id = params.issuer_id;
    }

    const idempotencyKey = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const paymentResponse = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        'X-Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify(paymentBody),
    });

    if (!paymentResponse.ok) {
      const body = await paymentResponse.text();
      this.logger.warn(
        `MercadoPago createPayment failed (${paymentResponse.status}): ${body}`,
      );
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

  extractPreapprovalTrackingFields(
    preapproval: MercadoPagoPreapprovalResponse,
  ): MercadoPagoTrackingFields {
    return {
      preapprovalId: this.toOptionalString(preapproval.id),
      externalReference: this.toOptionalString(preapproval.external_reference),
      status: this.toOptionalString(preapproval.status),
      statusDetail: this.toOptionalString(preapproval.status_detail),
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

  private mapCreatePreapprovalError(body: string, statusCode: number): string {
    let errorMessage = `No se pudo crear la suscripción en MercadoPago (${statusCode})`;
    try {
      const errorBody = JSON.parse(body) as MercadoPagoErrorResponse;
      const causeCode = errorBody.cause?.[0]?.code?.toString() ?? '';
      const mpMessage = errorBody.message?.trim() ?? '';

      if (
        causeCode === '2006' ||
        causeCode === '3008' ||
        mpMessage.toLowerCase().includes('card token not found')
      ) {
        errorMessage =
          'El token de la tarjeta no es válido, ya fue usado o expiró. Generá uno nuevo confirmando el pago otra vez (el token es de un solo uso). ' +
          'Verificá que Public Key y Access Token sean de la misma app y entorno en MercadoPago.';
      } else if (causeCode === '3' || mpMessage.toLowerCase().includes('token must be for test')) {
        errorMessage =
          'Las credenciales de MercadoPago no coinciden: el token fue generado en un entorno distinto al configurado en el servidor (test vs producción).';
      } else if (mpMessage) {
        errorMessage = `Error al crear la suscripción. Verifique los datos e intente nuevamente. ${mpMessage}`;
      }
    } catch {
      // Keep generic message when body is not JSON.
    }

    return errorMessage;
  }

  private mapCreatePaymentError(body: string, statusCode: number): string {
    let errorMessage = `No se pudo procesar el pago en MercadoPago (${statusCode})`;
    try {
      const errorBody = JSON.parse(body) as MercadoPagoErrorResponse;
      const causeCode = errorBody.cause?.[0]?.code?.toString() ?? '';
      const mpMessage = errorBody.message?.trim() ?? '';

      if (
        causeCode === '2006' ||
        causeCode === '3008' ||
        mpMessage.toLowerCase().includes('card token not found')
      ) {
        errorMessage =
          'El token de la tarjeta no es válido, ya fue usado o expiró. Generá uno nuevo confirmando el pago otra vez (el token es de un solo uso). ' +
          'Verificá que el frontend envíe token, payment_method_id e issuer_id juntos desde cardForm.getCardFormData(), ' +
          'y que Public Key y Access Token sean de la misma app y entorno en MercadoPago.';
      } else if (causeCode === '3' || mpMessage.toLowerCase().includes('token must be for test')) {
        errorMessage =
          'Las credenciales de MercadoPago no coinciden: el token fue generado en un entorno distinto al configurado en el servidor (test vs producción).';
      } else if (causeCode === '205' || causeCode.includes('cardNumber')) {
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
      } else if (mpMessage) {
        errorMessage = `Error al procesar el pago. Verifique los datos e intente nuevamente. ${mpMessage}`;
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
