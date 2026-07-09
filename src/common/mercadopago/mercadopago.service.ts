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
    this.logger.log(
      `[MP-PREAPPROVAL] createAuthorizedPreapproval START | payer_email=${params.payer_email} | amount=${params.transaction_amount} ${params.currency_id} | reason=${params.reason} | external_reference=${params.external_reference ?? 'n/a'} | card_token_id=${this.maskSecret(params.card_token_id)}`,
    );

    const preapproval = await this.createPreapproval(params);
    const normalizedStatus = preapproval.status?.toLowerCase();

    this.logger.log(
      `[MP-PREAPPROVAL] createAuthorizedPreapproval RESPONSE | id=${preapproval.id ?? 'n/a'} | status=${preapproval.status ?? 'n/a'} | status_detail=${preapproval.status_detail ?? 'n/a'} | normalizedStatus=${normalizedStatus ?? 'n/a'}`,
    );
    this.logger.debug(
      `[MP-PREAPPROVAL] createAuthorizedPreapproval FULL RESPONSE: ${JSON.stringify(preapproval)}`,
    );

    if (normalizedStatus !== 'authorized') {
      this.logger.error(
        `[MP-PREAPPROVAL] createAuthorizedPreapproval REJECTED | expected=authorized | got=${preapproval.status ?? 'n/a'} | detail=${preapproval.status_detail ?? 'n/a'} | full=${JSON.stringify(preapproval)}`,
      );
      throw new BadRequestException(
        `Suscripción MercadoPago no autorizada. status=${preapproval.status ?? 'n/a'}, detail=${preapproval.status_detail ?? 'n/a'}`,
      );
    }

    this.logger.log('[MP-PREAPPROVAL] createAuthorizedPreapproval SUCCESS');
    return preapproval;
  }

  async createPreapproval(
    params: MercadoPagoCreatePreapprovalRequest,
  ): Promise<MercadoPagoPreapprovalResponse> {
    const startedAt = Date.now();
    const token = params.card_token_id?.trim();
    if (!token) {
      this.logger.error('[MP-PREAPPROVAL] createPreapproval ABORT | card_token_id vacío o ausente');
      throw new BadRequestException(
        'El token de la tarjeta es obligatorio. Generá uno nuevo desde el formulario de pago.',
      );
    }

    const accessToken = this.getAccessToken();
    const backUrl =
      this.configService.get<string>('MERCADOPAGO_BACK_URL') ??
      'https://www.mercadopago.com.ar';
    const mpUrl = 'https://api.mercadopago.com/preapproval';

    this.logger.log(
      `[MP-PREAPPROVAL] createPreapproval CONFIG | url=${mpUrl} | accessTokenPrefix=${accessToken.slice(0, 16)}... | accessTokenSuffix=...${accessToken.slice(-8)} | accessTokenLen=${accessToken.length} | isTestCred=${accessToken.startsWith('TEST-')} | backUrl=${backUrl}`,
    );
    this.logger.log(
      `[MP-PREAPPROVAL] createPreapproval INPUT | payer_email=${params.payer_email} | payerEmailIsTestUser=${params.payer_email.includes('@testuser.com')} | card_token_id=${this.maskSecret(token)} | tokenLen=${token.length} | amount=${params.transaction_amount} | currency=${params.currency_id} | reason=${params.reason} | external_reference=${params.external_reference ?? 'n/a'}`,
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

    const requestBody = JSON.stringify(preapprovalBody);
    this.logger.log(
      `[MP-PREAPPROVAL] createPreapproval REQUEST BODY (sanitized): ${JSON.stringify(this.sanitizeForLog(preapprovalBody))}`,
    );
    this.logger.log(
      `[MP-PREAPPROVAL] createPreapproval REQUEST BODY size=${requestBody.length} bytes`,
    );

    let preapprovalResponse: Response;
    try {
      this.logger.log('[MP-PREAPPROVAL] createPreapproval FETCH START');
      preapprovalResponse = await fetch(mpUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: requestBody,
      });
      this.logger.log(
        `[MP-PREAPPROVAL] createPreapproval FETCH END | elapsedMs=${Date.now() - startedAt} | status=${preapprovalResponse.status} | statusText=${preapprovalResponse.statusText} | ok=${preapprovalResponse.ok}`,
      );
    } catch (networkError) {
      const message =
        networkError instanceof Error ? networkError.message : String(networkError);
      this.logger.error(
        `[MP-PREAPPROVAL] createPreapproval NETWORK ERROR | elapsedMs=${Date.now() - startedAt} | error=${message}`,
        networkError instanceof Error ? networkError.stack : undefined,
      );
      throw new BadRequestException(
        `Error de red al contactar MercadoPago: ${message}`,
      );
    }

    this.logResponseHeaders('createPreapproval', preapprovalResponse);

    const body = await preapprovalResponse.text();
    this.logger.log(
      `[MP-PREAPPROVAL] createPreapproval RAW RESPONSE BODY | status=${preapprovalResponse.status} | bodyLength=${body.length} | body=${body || '(empty)'}`,
    );

    if (!preapprovalResponse.ok) {
      this.logger.error(
        `[MP-PREAPPROVAL] createPreapproval FAILED | status=${preapprovalResponse.status} | statusText=${preapprovalResponse.statusText} | elapsedMs=${Date.now() - startedAt} | mappedError=${this.mapCreatePreapprovalError(body, preapprovalResponse.status)}`,
      );
      this.logger.error(
        `[MP-PREAPPROVAL] createPreapproval FAILED parsed JSON attempt: ${this.tryParseJsonForLog(body)}`,
      );
      throw new BadRequestException(
        this.mapCreatePreapprovalError(body, preapprovalResponse.status),
      );
    }

    let parsed: MercadoPagoPreapprovalResponse;
    try {
      parsed = JSON.parse(body) as MercadoPagoPreapprovalResponse;
    } catch (parseError) {
      const message = parseError instanceof Error ? parseError.message : String(parseError);
      this.logger.error(
        `[MP-PREAPPROVAL] createPreapproval JSON PARSE ERROR | error=${message} | rawBody=${body}`,
      );
      throw new BadRequestException('MercadoPago devolvió una respuesta inválida (no JSON).');
    }

    this.logger.log(
      `[MP-PREAPPROVAL] createPreapproval SUCCESS | elapsedMs=${Date.now() - startedAt} | id=${parsed.id ?? 'n/a'} | status=${parsed.status ?? 'n/a'} | status_detail=${parsed.status_detail ?? 'n/a'}`,
    );
    this.logger.debug(
      `[MP-PREAPPROVAL] createPreapproval SUCCESS full payload: ${JSON.stringify(parsed)}`,
    );

    return parsed;
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

  async cancelPreapproval(
    preapprovalId: string,
  ): Promise<MercadoPagoPreapprovalResponse> {
    const accessToken = this.getAccessToken();
    const url = `https://api.mercadopago.com/preapproval/${preapprovalId}`;

    this.logger.log(
      `[MP-PREAPPROVAL] cancelPreapproval START | preapprovalId=${preapprovalId}`,
    );

    try {
      const snapshot = await this.getPreapprovalStatus(preapprovalId, accessToken);
      const currentStatus = snapshot.status?.toLowerCase();
      if (currentStatus === 'cancelled' || currentStatus === 'canceled') {
        this.logger.warn(
          `[MP-PREAPPROVAL] cancelPreapproval skipped | already ${snapshot.status} | preapprovalId=${preapprovalId}`,
        );
        return snapshot.payload as MercadoPagoPreapprovalResponse;
      }
    } catch (statusError) {
      const message =
        statusError instanceof Error ? statusError.message : String(statusError);
      this.logger.warn(
        `[MP-PREAPPROVAL] cancelPreapproval status check failed | preapprovalId=${preapprovalId} | error=${message}`,
      );
    }

    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ status: 'cancelled' }),
    });

    const body = await response.text();
    this.logResponseHeaders('cancelPreapproval', response);
    this.logger.log(
      `[MP-PREAPPROVAL] cancelPreapproval RESPONSE | status=${response.status} | body=${body || '(empty)'}`,
    );

    if (response.ok) {
      return JSON.parse(body) as MercadoPagoPreapprovalResponse;
    }

    const alreadyCancelled = this.isPreapprovalAlreadyCancelled(body);
    if (alreadyCancelled) {
      this.logger.warn(
        `[MP-PREAPPROVAL] cancelPreapproval already cancelled | preapprovalId=${preapprovalId}`,
      );
      const snapshot = await this.getPreapprovalStatus(preapprovalId, accessToken);
      return snapshot.payload as MercadoPagoPreapprovalResponse;
    }

    throw new BadRequestException(
      this.mapCancelPreapprovalError(body, response.status),
    );
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
      this.logger.error('[MP] getAccessToken FAILED | MERCADOPAGO_ACCESS_TOKEN no configurado');
      throw new InternalServerErrorException(
        'Falta configurar MERCADOPAGO_ACCESS_TOKEN',
      );
    }

    this.logger.debug(
      `[MP] getAccessToken OK | prefix=${accessToken.slice(0, 16)}... | len=${accessToken.length} | isTest=${accessToken.startsWith('TEST-')}`,
    );
    return accessToken;
  }

  private maskSecret(value?: string): string {
    if (!value) return '(empty)';
    const trimmed = value.trim();
    if (trimmed.length <= 8) return '****';
    return `${trimmed.slice(0, 4)}...${trimmed.slice(-4)} (len=${trimmed.length})`;
  }

  private sanitizeForLog(payload: Record<string, unknown>): Record<string, unknown> {
    const clone = { ...payload };
    if (typeof clone.card_token_id === 'string') {
      clone.card_token_id = this.maskSecret(clone.card_token_id);
    }
    if (typeof clone.token === 'string') {
      clone.token = this.maskSecret(clone.token);
    }
    return clone;
  }

  private logResponseHeaders(operation: string, response: Response): void {
    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headers[key] = value;
    });
    this.logger.log(
      `[MP-PREAPPROVAL] ${operation} RESPONSE HEADERS: ${JSON.stringify(headers)}`,
    );
    this.logger.log(
      `[MP-PREAPPROVAL] ${operation} x-request-id=${response.headers.get('x-request-id') ?? 'n/a'} | x-correlation-id=${response.headers.get('x-correlation-id') ?? 'n/a'} | content-type=${response.headers.get('content-type') ?? 'n/a'}`,
    );
  }

  private tryParseJsonForLog(body: string): string {
    try {
      return JSON.stringify(JSON.parse(body), null, 2);
    } catch {
      return `(not valid JSON) raw=${body}`;
    }
  }

  private isPreapprovalAlreadyCancelled(body: string): boolean {
    const normalized = body.toLowerCase();
    return (
      normalized.includes('already cancelled') ||
      normalized.includes('already canceled') ||
      normalized.includes('ya fue cancelad')
    );
  }

  private mapCancelPreapprovalError(body: string, statusCode: number): string {
    let errorMessage = `No se pudo cancelar la suscripción en MercadoPago (${statusCode})`;
    try {
      const errorBody = JSON.parse(body) as MercadoPagoErrorResponse;
      const mpMessage = errorBody.message?.trim() ?? '';
      if (mpMessage) {
        errorMessage = `No se pudo cancelar la suscripción en MercadoPago. ${mpMessage}`;
      }
    } catch {
      // Keep generic message when body is not JSON.
    }
    return errorMessage;
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
