export interface CheckoutInput { transactionReference:string; orderId:string; amount:number; currency:string; customerEmail:string; }
export interface CheckoutResult { checkoutSessionId:string; paymentIntentId?:string; url:string|null; }
export interface PaymentProvider { createCheckoutSession(input:CheckoutInput):Promise<CheckoutResult>; retrievePayment(paymentIntentId:string):Promise<{status:string;chargeId?:string}>; refundPayment(paymentIntentId:string):Promise<{refundId:string}>; }
