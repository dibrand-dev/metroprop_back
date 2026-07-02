export interface MercadoPagoErrorCause {
  code: number | string;
  description?: string;
}

export interface MercadoPagoErrorResponse {
  message?: string;
  error?: string;
  status?: number;
  cause?: MercadoPagoErrorCause[];
}

export interface MercadoPagoPaymentResponse {
  id: number | string;
  status: string;
  status_detail?: string;
  external_reference?: string;
  preapproval_id?: string;
  transaction_amount?: number;
  payer?: {
    email?: string;
  };
  [key: string]: unknown;
}

export interface MercadoPagoCreatePaymentRequest {
  transaction_amount: number;
  token: string;
  description: string;
  installments: number;
  payment_method_id: string;
  payer: unknown;
}

export interface MercadoPagoTrackingFields {
  paymentId?: string;
  preapprovalId?: string;
  externalReference?: string;
  status?: string;
  statusDetail?: string;
}

export interface MercadoPagoStatusSnapshot {
  source: 'preapproval' | 'payment';
  status?: string;
  statusDetail?: string;
  externalReference?: string;
  payload: Record<string, unknown>;
}
